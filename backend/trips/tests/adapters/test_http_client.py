import httpx
import pytest
import respx

from core.exceptions import UpstreamServiceError
from core.http import JsonGetRequest, JsonHttpClient, RetryPolicy

EXAMPLE_URL = "https://upstream.example/data"
INSTANT_RETRY_POLICY = RetryPolicy(max_attempts=3, initial_backoff_seconds=0.0)


def build_client() -> JsonHttpClient:
    return JsonHttpClient("example", retry_policy=INSTANT_RETRY_POLICY)


@respx.mock
def test_retries_transient_failure_then_succeeds() -> None:
    route = respx.get(EXAMPLE_URL).mock(
        side_effect=[httpx.Response(503), httpx.Response(200, json={"ok": True})]
    )

    assert build_client().get_json(EXAMPLE_URL) == {"ok": True}
    assert route.call_count == 2


@respx.mock
def test_client_error_is_not_retried() -> None:
    route = respx.get(EXAMPLE_URL).mock(return_value=httpx.Response(404, text="missing"))

    with pytest.raises(UpstreamServiceError) as raised:
        build_client().get_json(EXAMPLE_URL)

    assert raised.value.status_code == 404
    assert raised.value.is_client_error
    assert route.call_count == 1


@respx.mock
def test_network_failure_raises_after_all_attempts() -> None:
    route = respx.get(EXAMPLE_URL).mock(side_effect=httpx.ConnectTimeout("timed out"))

    with pytest.raises(UpstreamServiceError, match="example"):
        build_client().get_json(EXAMPLE_URL)

    assert route.call_count == INSTANT_RETRY_POLICY.max_attempts


@respx.mock
def test_invalid_json_raises_upstream_error() -> None:
    respx.get(EXAMPLE_URL).mock(return_value=httpx.Response(200, text="not json"))

    with pytest.raises(UpstreamServiceError):
        build_client().get_json(EXAMPLE_URL)


@respx.mock
def test_concurrent_requests_return_errors_in_place() -> None:
    respx.get(EXAMPLE_URL, params={"page": "1"}).mock(
        return_value=httpx.Response(200, json={"page": 1})
    )
    respx.get(EXAMPLE_URL, params={"page": "2"}).mock(return_value=httpx.Response(400))

    results = build_client().get_json_concurrently(
        [
            JsonGetRequest(EXAMPLE_URL, {"page": "1"}),
            JsonGetRequest(EXAMPLE_URL, {"page": "2"}),
        ],
        max_concurrency=2,
    )

    assert results[0] == {"page": 1}
    assert isinstance(results[1], UpstreamServiceError)


def test_concurrent_request_with_no_work_returns_empty_list() -> None:
    assert build_client().get_json_concurrently([], max_concurrency=2) == []
