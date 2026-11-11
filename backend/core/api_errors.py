import logging
from collections.abc import Mapping
from typing import Any

from rest_framework import status
from rest_framework.exceptions import APIException, ValidationError
from rest_framework.response import Response
from rest_framework.views import exception_handler as default_drf_exception_handler

from core.exceptions import (
    ApplicationError,
    NoRouteFoundError,
    PlaceNotFoundError,
    UpstreamServiceError,
)

logger = logging.getLogger(__name__)

HTTP_STATUS_BY_ERROR_TYPE: tuple[tuple[type[ApplicationError], int], ...] = (
    (PlaceNotFoundError, status.HTTP_404_NOT_FOUND),
    (NoRouteFoundError, status.HTTP_422_UNPROCESSABLE_ENTITY),
    (UpstreamServiceError, status.HTTP_502_BAD_GATEWAY),
)


def build_error_body(code: str, message: str, details: Any = None) -> dict[str, Any]:
    error: dict[str, Any] = {"code": code, "message": message}
    if details is not None:
        error["details"] = details
    return {"error": error}


def api_exception_handler(exception: Exception, context: Mapping[str, Any]) -> Response:
    if isinstance(exception, ApplicationError):
        return _application_error_response(exception)
    response = default_drf_exception_handler(exception, context)
    if response is None:
        logger.exception("unhandled_api_error", exc_info=exception)
        return Response(
            build_error_body("internal_error", "An unexpected error occurred."),
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
    if isinstance(exception, ValidationError):
        response.data = build_error_body(
            "invalid_request", "Request validation failed.", details=response.data
        )
    elif isinstance(exception, APIException):
        response.data = build_error_body(str(exception.default_code), str(exception.detail))
    return response


def _application_error_response(error: ApplicationError) -> Response:
    if isinstance(error, UpstreamServiceError):
        logger.warning(
            "upstream_service_failure",
            extra={
                "service_name": error.service_name,
                "upstream_status": error.status_code,
                "upstream_detail": error.detail,
            },
        )
    http_status = next(
        (
            mapped_status
            for error_type, mapped_status in HTTP_STATUS_BY_ERROR_TYPE
            if isinstance(error, error_type)
        ),
        status.HTTP_400_BAD_REQUEST,
    )
    return Response(build_error_body(error.error_code, error.message), status=http_status)
