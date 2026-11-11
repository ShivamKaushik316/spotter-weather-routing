import asyncio
import logging
import time
from collections.abc import Awaitable, Callable, Mapping, Sequence
from dataclasses import dataclass, field
from typing import Any

import httpx

from core.exceptions import UpstreamServiceError

logger = logging.getLogger(__name__)

RETRYABLE_STATUS_CODES = frozenset({429, 500, 502, 503, 504})
ERROR_PREVIEW_CHARACTERS = 300


@dataclass(frozen=True, slots=True)
class RetryPolicy:
    max_attempts: int = 3
    initial_backoff_seconds: float = 0.4
    retryable_status_codes: frozenset[int] = RETRYABLE_STATUS_CODES

    def allows_retry_after(self, attempt_number: int) -> bool:
        return attempt_number < self.max_attempts

    def delay_after(self, attempt_number: int) -> float:
        return self.initial_backoff_seconds * 2 ** (attempt_number - 1)


DEFAULT_RETRY_POLICY = RetryPolicy()


@dataclass(frozen=True, slots=True)
class JsonGetRequest:
    url: str
    query_parameters: Mapping[str, str] = field(default_factory=dict)


class JsonHttpClient:
    def __init__(
        self,
        service_name: str,
        *,
        timeout_seconds: float = 10.0,
        retry_policy: RetryPolicy = DEFAULT_RETRY_POLICY,
        default_headers: Mapping[str, str] | None = None,
    ) -> None:
        self._service_name = service_name
        self._timeout_seconds = timeout_seconds
        self._retry_policy = retry_policy
        self._default_headers = dict(default_headers or {})
        self._client = httpx.Client(timeout=timeout_seconds, headers=self._default_headers)

    def get_json(self, url: str, query_parameters: Mapping[str, str] | None = None) -> Any:
        return self._send_with_retries(lambda: self._client.get(url, params=query_parameters))

    def post_json(
        self, url: str, json_body: Any, query_parameters: Mapping[str, str] | None = None
    ) -> Any:
        return self._send_with_retries(
            lambda: self._client.post(url, json=json_body, params=query_parameters)
        )

    def get_json_concurrently(
        self, requests: Sequence[JsonGetRequest], max_concurrency: int
    ) -> list[Any | UpstreamServiceError]:
        if not requests:
            return []
        return asyncio.run(self._get_all(requests, max_concurrency))

    def _send_with_retries(self, send: Callable[[], httpx.Response]) -> Any:
        attempt_number = 1
        while True:
            try:
                response = send()
            except httpx.TransportError as error:
                if not self._retry_policy.allows_retry_after(attempt_number):
                    raise self._network_failure(error) from error
            else:
                if not self._should_retry(response, attempt_number):
                    return self._decode(response)
            self._log_retry(attempt_number)
            time.sleep(self._retry_policy.delay_after(attempt_number))
            attempt_number += 1

    async def _send_with_retries_async(self, send: Callable[[], Awaitable[httpx.Response]]) -> Any:
        attempt_number = 1
        while True:
            try:
                response = await send()
            except httpx.TransportError as error:
                if not self._retry_policy.allows_retry_after(attempt_number):
                    raise self._network_failure(error) from error
            else:
                if not self._should_retry(response, attempt_number):
                    return self._decode(response)
            self._log_retry(attempt_number)
            await asyncio.sleep(self._retry_policy.delay_after(attempt_number))
            attempt_number += 1

    async def _get_all(
        self, requests: Sequence[JsonGetRequest], max_concurrency: int
    ) -> list[Any | UpstreamServiceError]:
        concurrency_limit = asyncio.Semaphore(max_concurrency)
        async with httpx.AsyncClient(
            timeout=self._timeout_seconds, headers=self._default_headers
        ) as client:

            async def fetch(request: JsonGetRequest) -> Any | UpstreamServiceError:
                async with concurrency_limit:
                    try:
                        return await self._send_with_retries_async(
                            lambda: client.get(request.url, params=request.query_parameters)
                        )
                    except UpstreamServiceError as error:
                        return error

            return list(await asyncio.gather(*(fetch(request) for request in requests)))

    def _should_retry(self, response: httpx.Response, attempt_number: int) -> bool:
        return (
            response.status_code in self._retry_policy.retryable_status_codes
            and self._retry_policy.allows_retry_after(attempt_number)
        )

    def _decode(self, response: httpx.Response) -> Any:
        if response.is_error:
            raise UpstreamServiceError(
                self._service_name,
                f"HTTP {response.status_code}: {response.text[:ERROR_PREVIEW_CHARACTERS]}",
                status_code=response.status_code,
            )
        try:
            return response.json()
        except ValueError as error:
            raise UpstreamServiceError(
                self._service_name, "Response body is not valid JSON."
            ) from error

    def _network_failure(self, error: httpx.TransportError) -> UpstreamServiceError:
        return UpstreamServiceError(self._service_name, f"Network failure: {type(error).__name__}")

    def _log_retry(self, attempt_number: int) -> None:
        logger.warning(
            "upstream_request_retry",
            extra={"service_name": self._service_name, "failed_attempt": attempt_number},
        )
