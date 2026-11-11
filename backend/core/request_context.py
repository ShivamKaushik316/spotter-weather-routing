from contextvars import ContextVar, Token

UNKNOWN_REQUEST_ID = "-"

_current_request_id: ContextVar[str] = ContextVar("current_request_id", default=UNKNOWN_REQUEST_ID)


def current_request_id() -> str:
    return _current_request_id.get()


def bind_request_id(request_id: str) -> Token[str]:
    return _current_request_id.set(request_id)


def release_request_id(token: Token[str]) -> None:
    _current_request_id.reset(token)
