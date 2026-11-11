import logging
import re
import time
import uuid
from collections.abc import Callable

from django.http import HttpRequest, HttpResponse

from core.request_context import bind_request_id, release_request_id

REQUEST_ID_HEADER = "X-Request-ID"
ACCEPTED_REQUEST_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{1,64}$")

access_logger = logging.getLogger("access")

ResponseProducer = Callable[[HttpRequest], HttpResponse]


class RequestIdMiddleware:
    def __init__(self, get_response: ResponseProducer) -> None:
        self._get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        request_id = self._resolve_request_id(request)
        token = bind_request_id(request_id)
        try:
            response = self._get_response(request)
        finally:
            release_request_id(token)
        response[REQUEST_ID_HEADER] = request_id
        return response

    @staticmethod
    def _resolve_request_id(request: HttpRequest) -> str:
        incoming_request_id = request.headers.get(REQUEST_ID_HEADER, "")
        if ACCEPTED_REQUEST_ID_PATTERN.fullmatch(incoming_request_id):
            return incoming_request_id
        return uuid.uuid4().hex


class AccessLogMiddleware:
    def __init__(self, get_response: ResponseProducer) -> None:
        self._get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        started_at = time.perf_counter()
        response = self._get_response(request)
        access_logger.info(
            "request_completed",
            extra={
                "http_method": request.method,
                "path": request.path,
                "status_code": response.status_code,
                "duration_ms": round((time.perf_counter() - started_at) * 1000, 1),
            },
        )
        return response
