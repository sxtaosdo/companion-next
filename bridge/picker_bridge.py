"""Extend the original backend handler; never replace its guards or exporter.

This module has no third-party dependencies, network startup, or token storage.
The launcher verifies and imports the complete separately supplied review source.
"""
from __future__ import annotations

from dataclasses import dataclass
from html.parser import HTMLParser
from http.server import BaseHTTPRequestHandler
import json
import mimetypes
import os
from pathlib import Path
import re
from types import MappingProxyType
from typing import Any, Mapping

MAX_EXPORT_BODY = 8192
_ID = re.compile(r"[0-9a-f]{32}\Z")
_CAPABILITIES = {"schema_version": 1, "guarded_export": True,
                 "guarded_review_actions": True, "guarded_selection": True}
_REVIEW_ACTIONS = frozenset({"select", "recycle", "restore", "stop", "retry", "task", "search"})


class BridgeError(Exception):
    """Only these constant, non-sensitive messages may reach an HTTP client."""

    def __init__(self, status: int, code: str):
        super().__init__(code)
        self.status = status
        self.code = code


def _bad_input() -> BridgeError:
    return BridgeError(400, "bad_input")


def _unique_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    value: dict[str, Any] = {}
    for key, item in pairs:
        if key in value:
            raise _bad_input()
        value[key] = item
    return value


def validate_export_payload(payload: Any) -> dict[str, Any]:
    """Validate before any lock acquisition or state mutation; copy the IDs."""
    if type(payload) is not dict or set(payload) != {"expected_task_id", "selected_ids"}:
        raise _bad_input()
    task_id, selected = payload["expected_task_id"], payload["selected_ids"]
    if type(task_id) is not str or _ID.fullmatch(task_id) is None:
        raise _bad_input()
    if type(selected) is not list or not 1 <= len(selected) <= 30:
        raise _bad_input()
    if any(type(item) is not str or _ID.fullmatch(item) is None for item in selected):
        raise _bad_input()
    if len(set(selected)) != len(selected):
        raise _bad_input()
    return {"expected_task_id": task_id, "selected_ids": list(selected)}


def _parse_body(body: bytes) -> Any:
    if not isinstance(body, bytes) or not 0 < len(body) <= MAX_EXPORT_BODY:
        raise _bad_input()
    try:
        payload = json.loads(body.decode("utf-8"), object_pairs_hook=_unique_object,
                             parse_constant=lambda _: (_ for _ in ()).throw(_bad_input()))
    except (UnicodeError, ValueError, RecursionError):
        raise _bad_input() from None
    return payload


def parse_export_body(body: bytes) -> dict[str, Any]:
    return validate_export_payload(_parse_body(body))


def validate_review_payload(action: str, payload: Any) -> dict[str, Any]:
    fields = {"select": {"expected_task_id", "selected_ids"},
              "recycle": {"expected_task_id", "selected_ids"},
              "restore": {"expected_task_id"}, "stop": {"expected_task_id"},
              "retry": {"expected_task_id", "id"}, "task": {"expected_task_id", "id"},
              "search": {"expected_task_id", "query", "limit", "source_ids"}}
    if action not in fields or type(payload) is not dict or set(payload) != fields[action]:
        raise _bad_input()
    result = dict(payload)
    expected = result["expected_task_id"]
    if not (expected is None and action in {"task", "search"}):
        if type(expected) is not str or _ID.fullmatch(expected) is None:
            raise _bad_input()
    if action in {"retry", "task"}:
        if type(result["id"]) is not str or _ID.fullmatch(result["id"]) is None:
            raise _bad_input()
    if action in {"select", "recycle"}:
        selected = result["selected_ids"]
        if (type(selected) is not list or len(selected) > 30
                or any(type(item) is not str or _ID.fullmatch(item) is None for item in selected)
                or len(set(selected)) != len(selected)):
            raise _bad_input()
        result["selected_ids"] = list(selected)
    if action == "search":
        query, limit, sources = result["query"], result["limit"], result["source_ids"]
        if (type(query) is not str or not 1 <= len(query.strip()) <= 200
                or any(ord(character) < 32 for character in query)
                or type(limit) is not int or not 1 <= limit <= 30):
            raise _bad_input()
        if (type(sources) is not list or not 1 <= len(sources) <= 30
                or any(type(source) is not str or not 1 <= len(source) <= 100 for source in sources)
                or len(set(sources)) != len(sources) or limit < len(sources)):
            raise _bad_input()
        result["source_ids"] = list(sources)
    return result


def parse_review_body(action: str, body: bytes) -> dict[str, Any]:
    return validate_review_payload(action, _parse_body(body))


def _check_expected(store: Any, expected: str | None) -> None:
    task = store.task
    matches = (task is None if expected is None else
               isinstance(task, dict) and task.get("id") == expected)
    if not matches:
        raise BridgeError(409, "stale_task")


def _select_locked(store: Any, selected: list[str], failure_code: str) -> None:
    """Retain the pinned store's policy checks, including its save failure phase.

    The verified TaskStore.select assigns the supplied (fresh) list only AFTER
    validating all IDs/policies and BEFORE save. A ValueError after assignment
    may be a persistence failure and must never be reported as a safe rejection.
    The caller holds both locks. Identity, not equality, detects same-ID saves.
    """
    task = store.task
    previous_selection = task.get("selected")
    try:
        store.select(selected)
    except ValueError:
        if store.task is task and task.get("selected") is previous_selection:
            raise _bad_input() from None
        raise BridgeError(500, failure_code) from None
    except Exception:
        raise BridgeError(500, failure_code) from None


class _GuardedClaim:
    """Per-call receiver for the pinned retry/start_search implementations.

    All state and ordinary bound methods belong to the real application. Only
    this receiver's claim is replaced; no application/global monkeypatch and no
    application lock held while entering the original method. The reviewed
    methods call claim once before task mutation or starting their real worker.
    That lock stays held until startup returns, so stop cannot target the old
    task between a search claim and publication of its newly created task.
    """
    __slots__ = ("_application", "_expected", "_retry_id", "_claimed", "_rejection", "_lock_held")

    def __init__(self, application: Any, expected: str | None, retry_id: str | None):
        self._application = application
        self._expected = expected
        self._retry_id = retry_id
        self._claimed = False
        self._rejection = None
        self._lock_held = False

    def __getattr__(self, name: str) -> Any:
        return getattr(self._application, name)

    def __setattr__(self, name: str, value: Any) -> None:
        if name in self.__slots__:
            object.__setattr__(self, name, value)
        else:
            setattr(self._application, name, value)

    def claim(self, operation: str = "") -> None:
        application = self._application
        try:
            if self._claimed:
                raise BridgeError(500, "review_action_failed")
            application.lock.acquire()
            self._lock_held = True
            if application.busy:
                raise BridgeError(409, "busy")
            with application.store.lock:
                _check_expected(application.store, self._expected)
                if self._retry_id is not None:
                    item = application.store.item(self._retry_id)
                    if not item or item.get("status") != "failed":
                        raise _bad_input()
                application.busy = True
                application.operation = operation
                application.cancel.clear()
                self._claimed = True
        except BridgeError as error:
            self._rejection = error
            raise


def _call_with_guarded_claim(application: Any, action: str, payload: dict[str, Any]) -> None:
    method = getattr(application, "retry" if action == "retry" else "start_search", None)
    function = getattr(method, "__func__", None)
    if not callable(function) or getattr(method, "__self__", None) is not application:
        raise BridgeError(500, "review_action_failed")
    receiver = _GuardedClaim(application, payload["expected_task_id"],
                             payload["id"] if action == "retry" else None)
    try:
        if action == "retry":
            function(receiver, payload["id"])
        else:
            function(receiver, payload["query"], payload["limit"], source_ids=payload["source_ids"])
        if not receiver._claimed:
            raise BridgeError(500, "review_action_failed")
    except BridgeError as error:
        if error is receiver._rejection and not receiver._claimed:
            raise
        raise BridgeError(500, "review_action_failed") from None
    except ValueError:
        # In the pinned methods only source/query validation precedes claim.
        # Cooldown, thread startup, create/save and download work are AFTER it.
        if receiver._claimed:
            raise BridgeError(500, "review_action_failed") from None
        raise _bad_input() from None
    except Exception:
        raise BridgeError(500, "review_action_failed") from None
    finally:
        if receiver._lock_held:
            application.lock.release()
            receiver._lock_held = False


def guarded_review_action(application: Any, action: str, payload: Any) -> dict[str, Any]:
    """Bind the operation to the observed task; never promise file rollback."""
    payload = validate_review_payload(action, payload)
    if action in {"retry", "search"}:
        _call_with_guarded_claim(application, action, payload)
        return {"ok": True}  # Accepted only; the original worker owns completion.
    with application.lock:
        may_select_during_download = (action == "select" and
                                      application.operation in {"search", "retry", "import"})
        if action != "stop" and application.busy and not may_select_during_download:
            raise BridgeError(409, "busy")
        store = application.store
        with store.lock:
            _check_expected(store, payload["expected_task_id"])
            if action == "stop":
                try:
                    application.cancel.set()
                except Exception:
                    raise BridgeError(500, "review_action_failed") from None
                return {"ok": True}  # A cancel request does not close a chooser.
            if action in {"select", "recycle"}:
                _select_locked(store, payload["selected_ids"], "review_action_failed")
                if action == "select":
                    # Preserve the original selection-during-download policy;
                    # do not claim, cancel, or release the worker's busy state.
                    return {"ok": True}
            application.busy = True
            application.operation = "task" if action == "task" else "recycle"
            application.cancel.clear()
            try:
                if action == "task":
                    store.load(payload["id"])
                else:
                    store.recycle(action == "restore")
            except Exception:
                # load/recycle may have repaired/moved/saved earlier files.
                raise BridgeError(500, "review_action_failed") from None
            finally:
                application.busy = False
                application.operation = ""
    return {"ok": True}


def guarded_export(application: Any, payload: Any) -> dict[str, Any]:
    """Atomically check task, select, and reserve busy, then use the real exporter.

    Lock order is application.lock -> store.lock. The application's lock is
    non-reentrant: do not call application.snapshot/select/claim/export here.
    store.select re-enters store.lock and retains its existing policy validation.
    The busy reservation remains held while the native chooser/exporter runs.
    """
    payload = validate_export_payload(payload)
    with application.lock:
        if application.busy:
            raise BridgeError(409, "busy")
        store = application.store
        with store.lock:
            _check_expected(store, payload["expected_task_id"])
            _select_locked(store, payload["selected_ids"], "export_failed")
            application.busy = True
            application.operation = "export"
            application.cancel.clear()
    try:
        directory = application.chooser()
        if not directory:
            return {"cancelled": True, "results": []}
        directory = os.fsdecode(os.fspath(directory))
        # Deliberately call the original TaskStore.export. It owns directory/cache
        # separation, hash/size/policy rechecks, and exclusive image/source writes.
        results = store.export(directory)
        return {"cancelled": False, "directory": directory, "results": results}
    except Exception:
        # Once execution starts, even a BridgeError from a callback must never
        # masquerade as a preflight rejection: partial effects may have occurred.
        raise BridgeError(500, "export_failed") from None
    finally:
        with application.lock:
            application.busy = False
            application.operation = ""


@dataclass(frozen=True)
class StaticAsset:
    content: bytes
    content_type: str


class StaticValidationError(ValueError):
    pass


class _IndexValidator(HTMLParser):
    """Conservative Vite entry validation; CSP remains the original handler's."""
    _TAGS = {"html", "head", "body", "meta", "title", "link", "script", "div", "noscript"}
    _URL_ATTRIBUTES = {"src", "href"}
    _GLOBAL_ATTRIBUTES = {"id", "class", "lang", "dir", "title", "role"}
    _TAG_ATTRIBUTES = {
        "html": set(), "head": set(), "body": set(), "title": set(),
        "div": set(), "noscript": set(),
        "meta": {"charset", "name", "content"},
        "link": {"href", "rel", "type", "crossorigin", "media", "integrity", "as", "sizes", "fetchpriority", "referrerpolicy"},
        "script": {"src", "type", "crossorigin", "defer", "async", "nomodule", "integrity", "referrerpolicy", "fetchpriority"},
    }

    def __init__(self, assets: Mapping[str, StaticAsset]):
        super().__init__(convert_charrefs=True)
        self.assets = assets
        self.in_script = False
        self.script_count = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag not in self._TAGS or self.in_script:
            raise StaticValidationError("unsupported index element")
        attributes = dict(attrs)
        if len(attributes) != len(attrs):
            raise StaticValidationError("duplicate index attribute")
        for name, value in attrs:
            allowed = (name in self._GLOBAL_ATTRIBUTES or name in self._TAG_ATTRIBUTES[tag]
                       or name.startswith(("aria-", "data-")))
            if not allowed:
                raise StaticValidationError("unsupported or inline index attribute")
            if name in self._URL_ATTRIBUTES and value not in self.assets:
                raise StaticValidationError("index resource is outside the asset whitelist")
        if tag == "script":
            source = attributes.get("src")
            if not source or source not in self.assets or not source.endswith((".js", ".mjs")):
                raise StaticValidationError("index script must be a whitelisted JavaScript file")
            self.in_script = True
            self.script_count += 1
        if tag == "link" and (not attributes.get("href") or attributes["href"] not in self.assets):
            raise StaticValidationError("index link must be a whitelisted asset")

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "script":
            raise StaticValidationError("self-closing script is not supported")
        self.handle_starttag(tag, attrs)

    def handle_endtag(self, tag: str) -> None:
        if tag not in self._TAGS:
            raise StaticValidationError("unsupported index closing element")
        if tag == "script":
            if not self.in_script:
                raise StaticValidationError("unexpected script closing element")
            self.in_script = False

    def handle_data(self, data: str) -> None:
        if self.in_script and data.strip():
            raise StaticValidationError("inline script is forbidden")

    def handle_decl(self, decl: str) -> None:
        if decl.lower() != "doctype html":
            raise StaticValidationError("unsupported index declaration")

    def unknown_decl(self, data: str) -> None:
        raise StaticValidationError("unsupported index declaration")

    def handle_pi(self, data: str) -> None:
        raise StaticValidationError("index processing instruction is forbidden")

    def finish(self) -> None:
        self.close()
        if self.in_script or not self.script_count:
            raise StaticValidationError("index requires closed external scripts")


def _real_path(path: Path) -> Path:
    absolute = path.absolute()
    if absolute.resolve(strict=True) != absolute:
        raise StaticValidationError("symlinks or non-canonical paths are forbidden")
    return absolute


def build_static_manifest(dist: str | Path) -> Mapping[str, StaticAsset]:
    """Read immutable bytes once; requests never join untrusted paths to disk."""
    root = _real_path(Path(dist))
    if not root.is_dir():
        raise StaticValidationError("dist must be a directory")
    asset_root = _real_path(root / "assets")
    if not asset_root.is_dir():
        raise StaticValidationError("dist/assets must be a directory")
    manifest: dict[str, StaticAsset] = {}
    for directory, directories, files in os.walk(asset_root, followlinks=False):
        for name in directories + files:
            candidate = _real_path(Path(directory) / name)
            if candidate.is_dir():
                continue
            if not candidate.is_file():
                raise StaticValidationError("only regular asset files are supported")
            relative = candidate.relative_to(root).as_posix()
            # Avoid ambiguous URL decoding and backslash behavior on Windows.
            if not re.fullmatch(r"assets/[A-Za-z0-9_./-]+", relative) or any(
                    part in {"", ".", ".."} for part in relative.split("/")):
                raise StaticValidationError("unsupported asset filename")
            suffix = candidate.suffix.lower()
            content_type = {".js": "text/javascript; charset=utf-8",
                            ".mjs": "text/javascript; charset=utf-8",
                            ".css": "text/css; charset=utf-8"}.get(suffix)
            content_type = content_type or mimetypes.guess_type(candidate.name)[0] or "application/octet-stream"
            manifest["/" + relative] = StaticAsset(candidate.read_bytes(), content_type)
    index = _real_path(root / "index.html")
    if not index.is_file():
        raise StaticValidationError("index must be a regular file")
    content = index.read_bytes()
    try:
        validator = _IndexValidator(manifest)
        validator.feed(content.decode("utf-8"))
        validator.finish()
    except UnicodeError:
        raise StaticValidationError("index must be UTF-8") from None
    entry = StaticAsset(content, "text/html; charset=utf-8")
    manifest["/companion/"] = entry
    manifest["/companion/index.html"] = entry
    return MappingProxyType(manifest)


def _read_export_request(handler: Any, action: str = "export") -> dict[str, Any]:
    lengths = handler.headers.get_all("Content-Length", [])
    content_types = handler.headers.get_all("Content-Type", [])
    if handler.headers.get_all("Transfer-Encoding", []) or len(lengths) != 1 or len(content_types) != 1:
        raise _bad_input()
    raw_length = lengths[0]
    if not re.fullmatch(r"[0-9]{1,5}", raw_length):
        raise _bad_input()
    length = int(raw_length)
    media_type = content_types[0].lower().replace(" ", "")
    if media_type not in {"application/json", "application/json;charset=utf-8"}:
        raise _bad_input()
    if not 0 < length <= MAX_EXPORT_BODY:
        raise _bad_input()
    body = handler.rfile.read(length)
    if len(body) != length:
        raise _bad_input()
    return parse_export_body(body) if action == "export" else parse_review_body(action, body)


def make_bridge_handler(base_handler: type, application: Any,
                        manifest: Mapping[str, StaticAsset]) -> type:
    """Build a subclass, preserving all original routes and security helpers."""
    if not isinstance(base_handler, type) or not issubclass(base_handler, BaseHTTPRequestHandler):
        raise TypeError("backend handler must inherit BaseHTTPRequestHandler")
    for name in ("trusted_host", "api_allowed", "json", "send", "do_GET", "do_POST"):
        if not callable(getattr(base_handler, name, None)):
            raise TypeError("backend handler interface is incomplete")
    assets = MappingProxyType(dict(manifest))

    class CompanionHandler(base_handler):
        def do_GET(self) -> None:
            if self.path == "/api/companion/capabilities":
                if not self.api_allowed():
                    self.json(403, {"error": "forbidden"})
                    return
                self.json(200, dict(_CAPABILITIES))
                return
            if self.path in assets or self.path.startswith(("/assets/", "/companion/")):
                if not self.trusted_host():
                    self.json(403, {"error": "forbidden"})
                    return
                asset = assets.get(self.path)
                if asset is None:
                    self.json(404, {"error": "not_found"})
                else:
                    self.send(200, asset.content, asset.content_type)
                return
            super().do_GET()

        def do_POST(self) -> None:
            action = self.path.removeprefix("/api/companion/")
            if self.path != "/api/companion/" + action or action not in _REVIEW_ACTIONS | {"export"}:
                super().do_POST()
                return
            if not self.api_allowed():
                self.close_connection = True
                self.json(403, {"error": "forbidden"})
                return
            try:
                payload = _read_export_request(self, action)
                result = (guarded_export(application, payload) if action == "export"
                          else guarded_review_action(application, action, payload))
                # Validate serializability before emitting a success status.
                json.dumps(result, ensure_ascii=False, allow_nan=False)
            except BridgeError as error:
                self.close_connection = True
                self.json(error.status, {"error": error.code})
            except Exception:
                self.close_connection = True
                self.json(500, {"error": "export_failed" if action == "export" else "review_action_failed"})
            else:
                self.json(200, result)

    CompanionHandler.__name__ = "Companion" + base_handler.__name__
    return CompanionHandler


def attach_bridge(server: Any, application: Any,
                  manifest: Mapping[str, StaticAsset]) -> Any:
    """Install before serve_forever; no socket is opened by this function."""
    server.RequestHandlerClass = make_bridge_handler(server.RequestHandlerClass, application, manifest)
    return server
