"""Request-local I/O hooks and deadlines; owner services retain their defaults."""
from collections.abc import Callable, Iterator
from contextvars import ContextVar
from dataclasses import dataclass
import ipaddress
import json
import subprocess
import sys
from time import monotonic
from typing import Any

import httpcore
import httpx


@dataclass(frozen=True)
class IOOverrides:
    auth_client: Callable[[], httpx.Client] | None = None
    route_get: Callable[..., httpx.Response] | None = None
    route_database: Callable[[], Any] | None = None


io_overrides: ContextVar[IOOverrides] = ContextVar("departure_io", default=IOOverrides())


@dataclass
class RequestBudget:
    """One monotonic deadline, shared by body/auth/DB/route/serialization work."""
    deadline: float
    clock: Callable[[], float] = monotonic

    @classmethod
    def start(cls, seconds: float = 30, clock: Callable[[], float] = monotonic) -> "RequestBudget":
        return cls(clock() + seconds, clock)

    def remaining(self, cap: float | None = None) -> float:
        seconds = self.deadline - self.clock()
        if seconds <= 0:
            raise httpx.TimeoutException("Departure request budget exhausted")
        return min(seconds, cap) if cap is not None else seconds


class DeadlineStream(httpcore.NetworkStream):
    """Clamp every blocking socket operation, including repeated reads, to deadline."""
    def __init__(self, inner: httpcore.NetworkStream, budget: RequestBudget):
        self.inner, self.budget = inner, budget

    def read(self, max_bytes: int, timeout: float | None = None) -> bytes:
        return self.inner.read(max_bytes, timeout=self.budget.remaining(timeout))

    def write(self, buffer: bytes, timeout: float | None = None) -> None:
        self.inner.write(buffer, timeout=self.budget.remaining(timeout))

    def start_tls(self, ssl_context, server_hostname=None, timeout=None):
        return DeadlineStream(self.inner.start_tls(ssl_context, server_hostname, self.budget.remaining(timeout)), self.budget)

    def close(self) -> None:
        self.inner.close()

    def get_extra_info(self, info: str) -> Any:
        return self.inner.get_extra_info(info)


class DeadlineBackend(httpcore.SyncBackend):
    def __init__(self, budget: RequestBudget):
        self.budget = budget

    def connect_tcp(self, host, port, timeout=None, local_address=None, socket_options=None):
        # socket.create_connection's timeout does not bound getaddrinfo. Resolve in
        # an isolated, killable child so a stuck platform resolver cannot outlive
        # the I/O budget or leave an abandoned worker performing a later request.
        addresses = self.resolve(host, port, timeout)
        stream = None
        for address in addresses:
            try:
                stream = super().connect_tcp(address, port, self.budget.remaining(timeout), local_address, socket_options)
                break
            except httpcore.ConnectError:
                continue  # Bounded address attempts, not an HTTP request retry.
        if stream is None:
            raise httpcore.ConnectError("Dependency connection failed")
        try:
            self.budget.remaining()
        except httpx.TimeoutException:
            stream.close()
            raise
        return DeadlineStream(stream, self.budget)

    def resolve(self, host: str, port: int, timeout: float | None) -> list[str]:
        try:
            ipaddress.ip_address(host)
            return [host]
        except ValueError:
            pass
        script = ("import json,socket,sys; "
                  "print(json.dumps([r[4][0] for r in socket.getaddrinfo(sys.argv[1],int(sys.argv[2]),type=socket.SOCK_STREAM)][:16]))")
        self.budget.remaining(timeout)
        try:
            with subprocess.Popen([sys.executable, "-I", "-S", "-c", script, host, str(port)],
                                  stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, close_fds=True) as process:
                try:
                    output, _ = process.communicate(timeout=self.budget.remaining(timeout))
                except (subprocess.TimeoutExpired, httpx.TimeoutException):
                    process.kill()
                    process.communicate()
                    raise httpcore.ConnectTimeout("Dependency name resolution timed out") from None
                if process.returncode:
                    raise httpcore.ConnectError("Dependency name resolution failed")
            self.budget.remaining()
            addresses = json.loads(output)
            if not isinstance(addresses, list) or not addresses or len(addresses) > 16:
                raise ValueError("Invalid addresses")
            for address in addresses:
                ipaddress.ip_address(address)
            return list(dict.fromkeys(addresses))
        except (OSError, ValueError, TypeError):
            raise httpcore.ConnectError("Dependency name resolution failed") from None


class DeadlineTransport(httpx.BaseTransport):
    """Use public httpcore network hooks, with no retries or environment proxies."""
    def __init__(self, budget: RequestBudget):
        self.pool = httpcore.ConnectionPool(network_backend=DeadlineBackend(budget), retries=0,
            max_connections=1, max_keepalive_connections=1)

    def handle_request(self, request: httpx.Request) -> httpx.Response:
        # httpx's standard exception mapping is kept in the client boundary below.
        response = self.pool.handle_request(httpcore.Request(
            method=request.method, url=httpcore.URL(scheme=request.url.raw_scheme,
                host=request.url.raw_host, port=request.url.port, target=request.url.raw_path),
            headers=request.headers.raw, content=request.stream, extensions=request.extensions))
        return httpx.Response(response.status, headers=response.headers,
            stream=CoreResponseStream(response.stream), extensions=response.extensions)

    def close(self) -> None:
        self.pool.close()


class CoreResponseStream(httpx.SyncByteStream):
    def __init__(self, stream):
        self.stream = stream

    def __iter__(self) -> Iterator[bytes]:
        yield from self.stream

    def close(self) -> None:
        self.stream.close()


class BoundedClient(httpx.Client):
    """Bound response bytes and actual transport operations, not only coroutine wait."""
    def __init__(self, budget: RequestBudget, cap: float, *, transport=None):
        self.budget, self.cap = budget, cap
        self.io_budget = RequestBudget(budget.deadline, budget.clock)
        super().__init__(transport=transport or DeadlineTransport(self.io_budget),
            timeout=httpx.Timeout(cap, connect=min(cap, 3)),
            follow_redirects=False, trust_env=False)

    def send(self, request: httpx.Request, *, stream=False, **kwargs) -> httpx.Response:
        remaining = self.budget.remaining(self.cap)
        self.io_budget.deadline = min(self.budget.deadline, self.budget.clock() + self.cap)
        request.extensions["timeout"] = {key: remaining for key in ("connect", "read", "write", "pool")}
        response = None
        try:
            response = super().send(request, stream=True, **kwargs)
            content = bytearray()
            for chunk in response.iter_bytes():
                self.io_budget.remaining()
                if len(content) + len(chunk) > 1_048_576:
                    raise httpx.RemoteProtocolError("Dependency response exceeds byte limit", request=request)
                content.extend(chunk)
            self.io_budget.remaining()
            # The SDK needs an eagerly read response even when it asks for streaming.
            response._content = bytes(content)
            return response
        except httpcore.TimeoutException:
            raise httpx.TimeoutException("Dependency timed out", request=request) from None
        except httpcore.NetworkError:
            raise httpx.NetworkError("Dependency connection failed", request=request) from None
        except httpcore.ProtocolError:
            raise httpx.RemoteProtocolError("Invalid dependency protocol", request=request) from None
        except httpx.DecodingError:
            raise httpx.RemoteProtocolError("Invalid dependency encoding", request=request) from None
        finally:
            if response is not None:
                response.close()
