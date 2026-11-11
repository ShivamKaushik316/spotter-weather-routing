class ApplicationError(Exception):
    error_code = "application_error"

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class PlaceNotFoundError(ApplicationError):
    error_code = "place_not_found"


class NoRouteFoundError(ApplicationError):
    error_code = "no_route_found"


class UpstreamServiceError(ApplicationError):
    error_code = "upstream_service_error"

    def __init__(self, service_name: str, detail: str, status_code: int | None = None) -> None:
        super().__init__(f"The {service_name} service is currently unavailable.")
        self.service_name = service_name
        self.detail = detail
        self.status_code = status_code

    @property
    def is_client_error(self) -> bool:
        return self.status_code is not None and 400 <= self.status_code < 500
