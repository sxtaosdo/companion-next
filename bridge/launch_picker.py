"""Opt-in launcher for a complete, separately supplied, reviewed source tree.

Never run this launcher just to test the bridge: it creates the original cache
lease and server. Unit tests exercise source validation and handlers offline.
There is no bundled replacement backend and no path for skipping the pins.
"""
from __future__ import annotations

import argparse
from contextlib import contextmanager
from dataclasses import dataclass
import hashlib
import importlib
import importlib.abc
import importlib.util
import inspect
from pathlib import Path
import re
import sys
from types import MappingProxyType, ModuleType
from typing import Any, Iterator, Mapping

from .picker_bridge import attach_bridge, build_static_manifest

REVIEW_VERSION = "v0.1.0.20"
REVIEW_COMMIT = "776b7ea4de6d03b6dde408fcf27b51490967f367"
REVIEW_SHA256 = MappingProxyType({
    "app.py": "26e9e7cad8519c54fab2378eccd9e1833d23c51875fd552da0c7ecf3e62ad959",
    "publicImages.py": "4838d7c068cfcdbce5ca54a4c05618f93be783016313acaa2d3958cb669276b0",
    "taskStore.py": "41aa8936543b3d0117b0773871e61b6bcea8f78960b9b481fb9e43b7b71905a1",
})
# This dependency's path was confirmed in app.py, but its hash was not supplied.
# Require the original local source; never silently import a namesake elsewhere.
REQUIRED_LOCAL_DEPENDENCIES = ("imageManifest.py",)


class BaselineError(RuntimeError):
    pass


@dataclass(frozen=True)
class VerifiedSources:
    root: Path
    sources: Mapping[str, bytes]


def verify_review_root(review_root: str | Path) -> VerifiedSources:
    """Hash required real source files before executing any reviewed code."""
    root = Path(review_root).absolute()
    try:
        if root.resolve(strict=True) != root or not root.is_dir():
            raise BaselineError("review root must be a real, canonical directory")
        sources = {}
        for filename, expected in REVIEW_SHA256.items():
            source = root / filename
            if source.resolve(strict=True) != source or not source.is_file():
                raise BaselineError("review source must be a regular file: " + filename)
            content = source.read_bytes()
            if hashlib.sha256(content).hexdigest() != expected:
                raise BaselineError("review source SHA-256 mismatch: " + filename)
            sources[source.stem] = content
        for filename in REQUIRED_LOCAL_DEPENDENCIES:
            source = root / filename
            if source.resolve(strict=True) != source or not source.is_file():
                raise BaselineError("required original dependency must be a regular file: " + filename)
            sources[source.stem] = source.read_bytes()
    except OSError:
        raise BaselineError("the complete pinned review source tree is required") from None
    return VerifiedSources(root, MappingProxyType(sources))


class _VerifiedLoader(importlib.abc.Loader):
    def __init__(self, source: bytes, filename: str):
        self.source = source
        self.filename = filename

    def create_module(self, spec: Any) -> None:
        return None

    def exec_module(self, module: ModuleType) -> None:
        # Execute the verified bytes, never a .pyc or a second, mutable disk read.
        exec(compile(self.source, self.filename, "exec"), module.__dict__)


class _VerifiedFinder(importlib.abc.MetaPathFinder):
    def __init__(self, verified: VerifiedSources):
        self.verified = verified

    def find_spec(self, fullname: str, path: Any = None, target: Any = None) -> Any:
        source = self.verified.sources.get(fullname)
        if source is None:
            return None
        filename = str(self.verified.root / (fullname + ".py"))
        loader = _VerifiedLoader(source, filename)
        return importlib.util.spec_from_file_location(fullname, filename, loader=loader)


@contextmanager
def load_review_backend(review_root: str | Path) -> Iterator[Mapping[str, ModuleType]]:
    """Import original dependencies from review_root; missing imports fail closed.

    Existing modules with any required module's name are rejected, rather than
    silently reusing an unrelated module. Only verified source bytes are executed
    for the three pinned files. imageManifest.py is loaded from this tree too,
    without a claim that its unavailable hash was verified. Other original
    dependencies must already be available. No installation takes place.
    """
    verified = verify_review_root(review_root)
    names = tuple(verified.sources)
    if any(name in sys.modules for name in names):
        raise BaselineError("a required backend module name is already loaded")
    finder = _VerifiedFinder(verified)
    old_path = list(sys.path)
    old_bytecode = sys.dont_write_bytecode
    sys.path.insert(0, str(verified.root))
    sys.meta_path.insert(0, finder)
    sys.dont_write_bytecode = True
    try:
        modules = {name: importlib.import_module(name) for name in names}
        yield MappingProxyType(modules)
    except ImportError:
        raise BaselineError("a dependency from the complete review tree is unavailable") from None
    finally:
        sys.dont_write_bytecode = old_bytecode
        sys.path[:] = old_path
        if finder in sys.meta_path:
            sys.meta_path.remove(finder)
        for name in names:
            sys.modules.pop(name, None)


def resolve_export(modules: Mapping[str, ModuleType], reference: str) -> Any:
    """Require explicit app:Name or taskStore:Name; do not guess class locations."""
    match = re.fullmatch(r"(app|taskStore):([A-Za-z_][A-Za-z0-9_]*)", reference)
    if match is None:
        raise BaselineError("export reference must be app:Name or taskStore:Name")
    value = getattr(modules[match[1]], match[2], None)
    if not callable(value):
        raise BaselineError("the configured backend export is unavailable")
    return value


def _supports(function: Any, *args: Any, **kwargs: Any) -> None:
    if not callable(function):
        raise BaselineError("the pinned backend interface is incomplete")
    try:
        inspect.signature(function).bind(*args, **kwargs)
    except (TypeError, ValueError):
        raise BaselineError("the pinned backend interface does not match this bridge") from None


def _check_application(application: Any, store: Any) -> None:
    if getattr(application, "store", None) is not store:
        raise BaselineError("backend application did not retain the supplied store")
    for name in ("busy", "operation", "cancel", "lock"):
        if not hasattr(application, name):
            raise BaselineError("backend application state interface is incomplete")
    for lock in (application.lock, getattr(store, "lock", None)):
        if not callable(getattr(lock, "__enter__", None)) or not callable(getattr(lock, "__exit__", None)):
            raise BaselineError("backend lock interface is incomplete")
    if not hasattr(store, "task") or not callable(getattr(application.cancel, "clear", None)):
        raise BaselineError("backend task interface is incomplete")
    _supports(application.chooser)
    _supports(store.select, [])
    _supports(store.export, "directory-interface-probe")


def run(review_root: str | Path, dist: str | Path, cache: str | Path,
        port: int = 0) -> None:
    """Start only when explicitly invoked. No startup is performed on import."""
    if type(port) is not int or not 0 <= port <= 65535:
        raise BaselineError("port must be between 0 and 65535")
    manifest = build_static_manifest(dist)
    with load_review_backend(review_root) as modules:
        original = modules["app"]
        # Both names were confirmed in the reviewed taskStore.py. Do not search
        # other modules or substitute a compatibility implementation.
        task_store = resolve_export(modules, "taskStore:TaskStore")
        cache_lease = resolve_export(modules, "taskStore:CacheLease")
        application_factory = getattr(original, "ImageApplication", None)
        make_server = getattr(original, "make_server", None)
        cache_path = Path(cache)
        # Check callable contracts before the first cache or server side effect.
        _supports(task_store, cache_path, restore=False)
        _supports(cache_lease, object())
        _supports(application_factory, cache_path, store=object())
        _supports(make_server, object(), port=port)
        store = task_store(cache_path, restore=False)
        _supports(getattr(store, "load_last", None))
        lease = cache_lease(store)
        server = None
        try:
            _supports(getattr(lease, "close", None))
            store.load_last()
            application = application_factory(cache_path, store=store)
            _check_application(application, store)
            server = make_server(application, port=port)
            # The original make_server owns host binding; never broaden it.
            if server.server_address[0] not in {"127.0.0.1", "::1", "localhost"}:
                raise BaselineError("the original server must bind to loopback")
            attach_bridge(server, application, manifest)
            print("Companion bridge: http://127.0.0.1:%d/companion/" % server.server_address[1], flush=True)
            server.serve_forever()
        finally:
            try:
                if server is not None:
                    server.server_close()
            finally:
                if callable(getattr(lease, "close", None)):
                    lease.close()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--review-root", required=True, type=Path,
                        help="complete original v0.1.0.20 source directory; all three SHA-256 pins are enforced")
    parser.add_argument("--dist", required=True, type=Path, help="built Companion dist directory")
    parser.add_argument("--cache", required=True, type=Path, help="original review backend cache directory")
    parser.add_argument("--port", type=int, default=0)
    args = parser.parse_args(argv)
    try:
        run(args.review_root, args.dist, args.cache, args.port)
    except KeyboardInterrupt:
        return 0
    except Exception:
        # No traceback, arbitrary original exception, chooser path, or token is
        # disclosed. Library callers can inspect explicit validation exceptions.
        print("Companion bridge did not start or stopped: validate the complete pinned source, configured exports, build, and cache.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
