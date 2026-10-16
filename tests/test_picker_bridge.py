"""Offline contract tests. Fake stores/handlers do not prove real-backend integration.

No listener, Windows process, network fetch, native chooser, or real export is
started here. Socket creation is prohibited for the entire test run.
"""
from __future__ import annotations

from contextlib import contextmanager
from email.message import Message
import hashlib
from http.server import BaseHTTPRequestHandler
import io
import json
from pathlib import Path, PureWindowsPath
import sys
import tempfile
import threading
import types
import unittest
from unittest import mock

from bridge import launch_picker
from bridge.picker_bridge import (
    BridgeError, MAX_EXPORT_BODY, StaticValidationError, attach_bridge,
    build_static_manifest, guarded_export, make_bridge_handler, parse_export_body,
    validate_export_payload, guarded_review_action, parse_review_body, validate_review_payload,
)

TASK = "a" * 32
OTHER_TASK = "b" * 32
FIRST = "1" * 32
SECOND = "2" * 32
REJECTED = "3" * 32
TRASH = "4" * 32
PAYLOAD = {"expected_task_id": TASK, "selected_ids": [FIRST]}
CSP = ("default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; "
       "connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'")


class FakeStore:
    """Test-only exporter spy. Production always calls the imported TaskStore."""
    def __init__(self):
        self.lock = threading.RLock()
        self.task = {"id": TASK, "selected": [SECOND], "items": []}
        self.select_calls = []
        self.export_calls = []
        self.export_error = None
        self.select_error = None
        self.export_result = [{"id": FIRST, "filename": "asset.png", "ok": True}]

    def select(self, ids):
        with self.lock:
            self.select_calls.append(list(ids))
            if self.select_error:
                raise self.select_error
            if any(item not in {FIRST, SECOND} for item in ids):
                raise ValueError("not ready or filtered")
            self.task["selected"] = list(ids)

    def export(self, directory):
        self.export_calls.append(directory)
        if self.export_error:
            raise self.export_error
        return self.export_result


class FakeApplication:
    def __init__(self):
        self.store = FakeStore()
        self.lock = threading.Lock()  # Deliberately non-reentrant.
        self.busy = False
        self.operation = ""
        self.cancel = threading.Event()
        self.cancel.set()
        self.chooser_calls = 0
        self.directory = "/chosen/output"
        self.chooser_error = None

    def chooser(self):
        self.chooser_calls += 1
        if self.chooser_error:
            raise self.chooser_error
        return self.directory


class FakeReviewStore(FakeStore):
    """Memory-only effects model, never an alternative cache implementation."""
    def __init__(self):
        super().__init__()
        self.task["items"] = [{"id": FIRST, "status": "ready"}, {"id": SECOND, "status": "ready"},
                              {"id": REJECTED, "status": "failed"}, {"id": TRASH, "status": "trash"}]
        self.recycle_calls = []
        self.load_calls = []
        self.recycle_error = None
        self.load_error = None
        self.after_select_error = None
        self.during_select = None

    def select(self, ids):
        with self.lock:
            if any(self.item(value)["status"] != "ready" for value in ids if self.item(value)):
                raise ValueError("not ready")
            super().select(ids)
            if self.during_select:
                self.during_select()
            if self.after_select_error:
                raise self.after_select_error

    def item(self, item_id):
        return next((item for item in self.task["items"] if item["id"] == item_id), None)

    def recycle(self, restore=False):
        with self.lock:
            self.recycle_calls.append((self.task["id"], list(self.task["selected"]), restore))
            for item in self.task["items"]:
                if restore and item["status"] == "trash":
                    item["status"] = "ready"
                elif not restore and item["status"] == "ready" and item["id"] not in self.task["selected"]:
                    item["status"] = "trash"
            if self.recycle_error:
                raise self.recycle_error

    def load(self, task_id):
        with self.lock:
            self.load_calls.append(task_id)
            self.task = {"id": task_id, "items": [], "selected": []}
            if self.load_error:
                raise self.load_error


class FakeReviewApplication(FakeApplication):
    """Contract-shaped methods and worker spies; no reference source is run."""
    def __init__(self):
        super().__init__()
        self.store = FakeReviewStore()
        self.original_claim_calls = []
        self.calls = []
        self.worker = None
        self.worker_started = threading.Event()
        self.worker_release = threading.Event()
        self.before_claim = None
        self.after_claim_error = None
        self.after_claim_before_create = None
        self.worker_write = None
        self.worker_receiver = None
        self.cooldown_checks = []

    def claim(self, operation=""):
        self.original_claim_calls.append(operation)
        with self.lock:
            if self.busy:
                raise ValueError("busy")
            self.busy, self.operation = True, operation
            self.cancel.clear()

    def _search(self, query, source_ids):
        self.worker_receiver = self
        self.worker_started.set()
        self.worker_release.wait(3)
        self.worker_write = (query, source_ids)
        self.busy = False

    def start_search(self, query, limit, source="openverse", source_ids=None):
        if any(value not in {"openverse", "commons"} for value in source_ids):
            raise ValueError("invalid source")
        if self.before_claim:
            self.before_claim()
        self.claim("search")
        try:
            if self.after_claim_error:
                raise self.after_claim_error
            if self.after_claim_before_create:
                self.after_claim_before_create()
            self.calls.append(("search", query, limit, list(source_ids)))
            with self.store.lock:
                self.store.task = {"id": OTHER_TASK, "selected": [], "items": []}
            self.worker = threading.Thread(target=self._search, args=(query, source_ids), daemon=True)
            self.worker.start()
        except Exception:
            self.busy = False
            raise

    def retry(self, item_id):
        self.claim("retry")
        try:
            with self.store.lock:
                item = self.store.item(item_id)
                if not item or item["status"] != "failed":
                    raise ValueError("retry requires a failed item")
                self.cooldown_checks.append(item_id)
                if self.after_claim_error:
                    raise self.after_claim_error
            self.calls.append(("retry", item_id))
            def run():
                try:
                    self.worker_started.set()
                    self.worker_release.wait(3)
                    self.worker_write = item_id
                finally:
                    self.busy = False
            self.worker = threading.Thread(target=run, daemon=True)
            self.worker.start()
        except Exception:
            self.busy = False
            raise


class FakeOriginalHandler(BaseHTTPRequestHandler):
    """The guards return only bool, matching the reviewed handler contract."""
    def trusted_host(self):
        self.guard_calls.append("host")
        return self.headers.get("Host") == "127.0.0.1:45678"

    def api_allowed(self):
        self.guard_calls.append("api")
        return self.trusted_host() and self.headers.get("X-Token") == "test-process-token"

    def send(self, status, content, content_type):
        self.response = (status, content, content_type)
        self.security_headers = {"Content-Security-Policy": CSP, "Cache-Control": "no-store",
                                 "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer"}

    def json(self, status, value):
        self.send(status, json.dumps(value, ensure_ascii=False).encode("utf-8"),
                  "application/json; charset=utf-8")

    def do_GET(self):
        self.original_route = ("GET", self.path)
        self.send(200, b"original-get", "text/plain")

    def do_POST(self):
        self.original_route = ("POST", self.path)
        self.send(200, b"original-post", "text/plain")


def handler_instance(handler_class, path, payload=PAYLOAD, *, host=True, token=True,
                     raw=None, headers=None):
    handler = object.__new__(handler_class)
    handler.path = path
    handler.headers = Message()
    handler.headers["Host"] = "127.0.0.1:45678" if host else "attacker.example"
    if token:
        handler.headers["X-Token"] = "test-process-token"
    body = json.dumps(payload).encode() if raw is None else raw
    if headers is None:
        handler.headers["Content-Type"] = "application/json"
        handler.headers["Content-Length"] = str(len(body))
    else:
        for key, value in headers:
            handler.headers[key] = value
    handler.rfile = io.BytesIO(body)
    handler.guard_calls = []
    handler.original_route = None
    handler.response = None
    handler.close_connection = False
    return handler


def create_dist(directory, html=None):
    root = Path(directory)
    (root / "assets").mkdir(parents=True, exist_ok=True)
    (root / "assets" / "app-AbC1.js").write_text("export const safe = true;\n", encoding="utf-8")
    (root / "assets" / "app-XyZ1.css").write_text("body { color: black; }\n", encoding="utf-8")
    default = ('<!doctype html><html><head><meta charset="UTF-8">'
               '<link rel="stylesheet" href="/assets/app-XyZ1.css">'
               '<script type="module" crossorigin src="/assets/app-AbC1.js"></script>'
               '</head><body><div id="app"></div></body></html>')
    (root / "index.html").write_text(default if html is None else html, encoding="utf-8")
    return root


class OfflineTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.no_sockets = mock.patch("socket.socket", side_effect=AssertionError("offline tests forbid sockets"))
        cls.no_sockets.start()
        cls.addClassCleanup(cls.no_sockets.stop)

    def assert_bridge_error(self, status, code, function, *args):
        with self.assertRaises(BridgeError) as caught:
            function(*args)
        self.assertEqual((caught.exception.status, caught.exception.code), (status, code))


class PayloadTests(OfflineTest):
    def test_valid_payload_is_copied(self):
        result = validate_export_payload(PAYLOAD)
        self.assertEqual(result, PAYLOAD)
        self.assertIsNot(result["selected_ids"], PAYLOAD["selected_ids"])

    def test_invalid_payloads_are_rejected(self):
        invalid = [None, [], True, {}, {**PAYLOAD, "directory": "/tmp"},
                   {"selected_ids": [FIRST]}, {"expected_task_id": TASK},
                   {**PAYLOAD, "expected_task_id": "A" * 32},
                   {**PAYLOAD, "expected_task_id": TASK + "\n"},
                   {**PAYLOAD, "expected_task_id": 1},
                   {**PAYLOAD, "selected_ids": []},
                   {**PAYLOAD, "selected_ids": FIRST},
                   {**PAYLOAD, "selected_ids": [FIRST, FIRST]},
                   {**PAYLOAD, "selected_ids": [FIRST + "\n"]},
                   {**PAYLOAD, "selected_ids": ["G" * 32]},
                   {**PAYLOAD, "selected_ids": [False]},
                   {**PAYLOAD, "selected_ids": [f"{i:032x}" for i in range(31)]}]
        for value in invalid:
            with self.subTest(value=value):
                self.assert_bridge_error(400, "bad_input", validate_export_payload, value)

    def test_thirty_unique_ids_allowed(self):
        ids = [f"{i:032x}" for i in range(30)]
        self.assertEqual(validate_export_payload({**PAYLOAD, "selected_ids": ids})["selected_ids"], ids)

    def test_bad_json_and_duplicate_keys_rejected(self):
        bodies = [b"", b"\xff", b"[]", b"null", b"{} garbage", b"NaN", b"Infinity",
                  b'{"expected_task_id":"' + TASK.encode() + b'","expected_task_id":"' +
                  TASK.encode() + b'","selected_ids":["' + FIRST.encode() + b'"]}',
                  b"[" * 2000 + b"]" * 2000]
        for body in bodies:
            with self.subTest(body=body[:60]):
                self.assert_bridge_error(400, "bad_input", parse_export_body, body)

    def test_exact_body_limit_and_over_limit(self):
        body = json.dumps(PAYLOAD).encode()
        self.assertEqual(parse_export_body(body.ljust(MAX_EXPORT_BODY)), PAYLOAD)
        self.assert_bridge_error(400, "bad_input", parse_export_body, body.ljust(MAX_EXPORT_BODY + 1))


class ExportTests(OfflineTest):
    def setUp(self):
        self.application = FakeApplication()

    def test_valid_export_calls_store_export_and_releases_busy(self):
        result = guarded_export(self.application, PAYLOAD)
        self.assertEqual(result, {"cancelled": False, "directory": "/chosen/output",
                                  "results": self.application.store.export_result})
        self.assertEqual(self.application.store.select_calls, [[FIRST]])
        self.assertEqual(self.application.store.export_calls, ["/chosen/output"])
        self.assertFalse(self.application.busy)
        self.assertEqual(self.application.operation, "")
        self.assertFalse(self.application.cancel.is_set())

    def test_busy_never_changes_selection_or_opens_chooser(self):
        self.application.busy = True
        self.application.operation = "download"
        self.assert_bridge_error(409, "busy", guarded_export, self.application, PAYLOAD)
        self.assertEqual(self.application.store.task["selected"], [SECOND])
        self.assertEqual(self.application.store.select_calls, [])
        self.assertEqual(self.application.chooser_calls, 0)
        self.assertEqual(self.application.operation, "download")
        self.assertTrue(self.application.busy)

    def test_stale_task_never_changes_selection_or_opens_chooser(self):
        self.assert_bridge_error(409, "stale_task", guarded_export, self.application,
                                 {**PAYLOAD, "expected_task_id": OTHER_TASK})
        self.assertEqual(self.application.store.task["selected"], [SECOND])
        self.assertEqual(self.application.store.select_calls, [])
        self.assertEqual(self.application.chooser_calls, 0)
        self.assertFalse(self.application.busy)

    def test_absent_task_is_stale(self):
        self.application.store.task = None
        self.assert_bridge_error(409, "stale_task", guarded_export, self.application, PAYLOAD)
        self.assertEqual(self.application.store.select_calls, [])

    def test_original_select_policy_is_enforced(self):
        self.assert_bridge_error(400, "bad_input", guarded_export, self.application,
                                 {**PAYLOAD, "selected_ids": [REJECTED]})
        self.assertEqual(self.application.store.task["selected"], [SECOND])
        self.assertFalse(self.application.busy)
        self.assertEqual(self.application.chooser_calls, 0)
        self.assertEqual(self.application.store.export_calls, [])

    def test_malformed_payload_never_calls_store(self):
        self.assert_bridge_error(400, "bad_input", guarded_export, self.application,
                                 {**PAYLOAD, "selected_ids": [FIRST, FIRST]})
        self.assertEqual(self.application.store.select_calls, [])

    def test_chooser_runs_without_non_reentrant_application_lock(self):
        def chooser():
            acquired = self.application.lock.acquire(blocking=False)
            self.assertTrue(acquired, "chooser must not run under application.lock")
            try:
                self.assertTrue(self.application.busy)
                self.assertEqual(self.application.operation, "export")
            finally:
                if acquired:
                    self.application.lock.release()
            return "/chosen/output"
        self.application.chooser = chooser
        guarded_export(self.application, PAYLOAD)

    def test_cancel_retains_selection_but_does_not_export(self):
        for cancelled in (None, ""):
            with self.subTest(cancelled=cancelled):
                self.application.directory = cancelled
                self.assertEqual(guarded_export(self.application, PAYLOAD), {"cancelled": True, "results": []})
                self.assertEqual(self.application.store.export_calls, [])
                self.assertEqual(self.application.store.task["selected"], [FIRST])
                self.assertFalse(self.application.busy)
                self.assertEqual(self.application.operation, "")

    def test_chooser_exception_releases_busy(self):
        self.application.chooser_error = RuntimeError("private chooser detail")
        self.assert_bridge_error(500, "export_failed", guarded_export, self.application, PAYLOAD)
        self.assertFalse(self.application.busy)
        self.assertEqual(self.application.operation, "")
        self.assertEqual(self.application.store.export_calls, [])

    def test_export_exception_releases_busy(self):
        self.application.store.export_error = OSError("private output path")
        self.assert_bridge_error(500, "export_failed", guarded_export, self.application, PAYLOAD)
        self.assertFalse(self.application.busy)
        self.assertEqual(self.application.operation, "")

    def test_pathlike_chooser_result_is_supported(self):
        self.application.directory = Path("/chosen/output")
        result = guarded_export(self.application, PAYLOAD)
        # Path chooses the host platform's separator; the bridge preserves it.
        expected = str(self.application.directory)
        self.assertEqual(result["directory"], expected)
        self.assertEqual(self.application.store.export_calls, [expected])

    def test_windows_pathlike_chooser_preserves_drive_and_unc_semantics(self):
        # PureWindowsPath exercises Windows fspath semantics on every test host.
        # FakeStore never accesses these paths or creates any output files.
        for expected in (r"D:\Game Assets\output", r"\\server\share\Game Assets\output"):
            with self.subTest(directory=expected):
                application = FakeApplication()
                application.directory = PureWindowsPath(expected)
                result = guarded_export(application, PAYLOAD)
                self.assertEqual(result["directory"], expected)
                self.assertEqual(application.store.export_calls, [expected])
                self.assertFalse(result["cancelled"])
                self.assertFalse(application.busy)

    def test_concurrent_export_rejected_while_chooser_waits(self):
        entered, release = threading.Event(), threading.Event()
        results, errors = [], []
        def chooser():
            self.application.chooser_calls += 1
            entered.set()
            if not release.wait(3):
                raise AssertionError("test did not release chooser")
            return "/chosen/output"
        def first_export():
            try:
                results.append(guarded_export(self.application, PAYLOAD))
            except BaseException as error:
                errors.append(error)
        self.application.chooser = chooser
        worker = threading.Thread(target=first_export, daemon=True)
        worker.start()
        try:
            self.assertTrue(entered.wait(2), "export deadlocked before chooser")
            self.assert_bridge_error(409, "busy", guarded_export, self.application,
                                     {**PAYLOAD, "selected_ids": [SECOND]})
            self.assertEqual(self.application.store.task["selected"], [FIRST])
            self.assertEqual(self.application.store.select_calls, [[FIRST]])
            self.assertEqual(self.application.chooser_calls, 1)
        finally:
            release.set()
            worker.join(3)
        self.assertFalse(worker.is_alive())
        self.assertEqual(errors, [])
        self.assertEqual(len(results), 1)
        self.assertFalse(self.application.busy)


class ReviewPayloadTests(OfflineTest):
    def test_action_payloads_and_null_current_task_scope(self):
        payloads = {"select": PAYLOAD, "recycle": PAYLOAD, "restore": {"expected_task_id": TASK},
                    "stop": {"expected_task_id": TASK}, "retry": {"expected_task_id": TASK, "id": REJECTED},
                    "task": {"expected_task_id": None, "id": OTHER_TASK},
                    "search": {"expected_task_id": None, "query": "forest", "limit": 2,
                               "source_ids": ["openverse", "commons"]}}
        for action, payload in payloads.items():
            with self.subTest(action=action):
                self.assertEqual(parse_review_body(action, json.dumps(payload).encode()), payload)
                self.assert_bridge_error(400, "bad_input", validate_review_payload, action, {**payload, "extra": 1})
                self.assert_bridge_error(400, "bad_input", validate_review_payload, action, {})
                self.assert_bridge_error(400, "bad_input", validate_review_payload, action,
                                         {**payload, "expected_task_id": "A" * 32})
                if action not in {"task", "search"}:
                    self.assert_bridge_error(400, "bad_input", validate_review_payload, action,
                                             {**payload, "expected_task_id": None})

    def test_recycle_allows_empty_but_requires_unique_bounded_ids(self):
        for action in ("select", "recycle"):
            self.assertEqual(validate_review_payload(action, {**PAYLOAD, "selected_ids": []})["selected_ids"], [])
            for ids in ([FIRST, FIRST], [1], [FIRST + "\n"], [f"{i:032x}" for i in range(31)], FIRST):
                with self.subTest(action=action, ids=ids):
                    self.assert_bridge_error(400, "bad_input", validate_review_payload, action,
                                             {**PAYLOAD, "selected_ids": ids})
            result = validate_review_payload(action, PAYLOAD)
            self.assertIsNot(result["selected_ids"], PAYLOAD["selected_ids"])

    def test_search_strict_fields_types_and_owned_source_list(self):
        payload = {"expected_task_id": TASK, "query": "forest", "limit": 2, "source_ids": ["openverse"]}
        result = validate_review_payload("search", payload)
        self.assertIsNot(result["source_ids"], payload["source_ids"])
        changes = [{"query": ""}, {"query": " "}, {"query": "x\ny"}, {"query": "x" * 201},
                   {"query": 7}, {"limit": True}, {"limit": 0}, {"limit": 31},
                   {"source_ids": []}, {"source_ids": ["openverse", "openverse"]},
                   {"source_ids": [False]}, {"source_ids": [""]}, {"source_ids": ["x" * 101]},
                   {"source_ids": "openverse"}, {"limit": 1, "source_ids": ["openverse", "commons"]}]
        for change in changes:
            with self.subTest(change=change):
                self.assert_bridge_error(400, "bad_input", validate_review_payload, "search", {**payload, **change})

    def test_review_bodies_reject_duplicates_non_utf8_nonfinite_and_oversize(self):
        for body in (b"\xff", b"NaN", b"Infinity", b"null", b"[]", b"{} " * 3000,
                     ('{"expected_task_id":"' + TASK + '","expected_task_id":"' + TASK + '"}').encode()):
            with self.subTest(body=body[:40]):
                self.assert_bridge_error(400, "bad_input", parse_review_body, "stop", body)
        self.assert_bridge_error(400, "bad_input", validate_review_payload, "unknown", {})


class ReviewActionTests(OfflineTest):
    def setUp(self):
        self.application = FakeReviewApplication()
        self.addCleanup(self.finish_worker)

    def finish_worker(self):
        self.application.worker_release.set()
        if self.application.worker:
            self.application.worker.join(3)
            self.assertFalse(self.application.worker.is_alive())

    def action(self, action, payload=None):
        return guarded_review_action(self.application, action, payload or {"expected_task_id": TASK})

    def search_payload(self, expected=TASK):
        return {"expected_task_id": expected, "query": "forest", "limit": 2, "source_ids": ["openverse"]}

    def test_select_persists_via_store_without_claim_recycle_or_cancel_change(self):
        self.assertEqual(self.action("select", PAYLOAD), {"ok": True})
        self.assertEqual(self.application.store.select_calls, [[FIRST]])
        self.assertEqual(self.application.store.task["selected"], [FIRST])
        self.assertEqual(self.application.store.recycle_calls, [])
        self.assertEqual(self.application.store.export_calls, [])
        self.assertEqual(self.application.original_claim_calls, [])
        self.assertEqual(self.application.chooser_calls, 0)
        self.assertTrue(self.application.cancel.is_set())
        self.assertFalse(self.application.busy)
        self.assertEqual(self.application.operation, "")

    def test_select_empty_list_clears_selection_without_recycling(self):
        self.assertEqual(self.action("select", {**PAYLOAD, "selected_ids": []}), {"ok": True})
        self.assertEqual(self.application.store.task["selected"], [])
        self.assertEqual(self.application.store.select_calls, [[]])
        self.assertEqual(self.application.store.item(FIRST)["status"], "ready")
        self.assertEqual(self.application.store.item(SECOND)["status"], "ready")
        self.assertEqual(self.application.store.recycle_calls, [])

    def test_select_allowed_during_search_retry_import_preserves_worker_state(self):
        for operation in ("search", "retry", "import"):
            with self.subTest(operation=operation):
                self.application.busy, self.application.operation = True, operation
                self.assertEqual(self.action("select", PAYLOAD), {"ok": True})
                self.assertTrue(self.application.busy)
                self.assertEqual(self.application.operation, operation)
                self.assertTrue(self.application.cancel.is_set())
                self.assertEqual(self.application.store.task["selected"], [FIRST])

    def test_select_rejects_other_busy_operations_before_store(self):
        for operation in ("export", "task", "recycle", "", "unknown"):
            with self.subTest(operation=operation):
                self.application.busy, self.application.operation = True, operation
                self.assert_bridge_error(409, "busy", guarded_review_action,
                                         self.application, "select", PAYLOAD)
                self.assertTrue(self.application.busy)
                self.assertEqual(self.application.operation, operation)
                self.assertEqual(self.application.store.task["selected"], [SECOND])
                self.assertEqual(self.application.store.select_calls, [])

    def test_select_enforces_ready_and_original_policy_during_download(self):
        self.application.busy, self.application.operation = True, "import"
        for selected in ([REJECTED], [TRASH], ["5" * 32]):
            with self.subTest(selected=selected):
                self.assert_bridge_error(400, "bad_input", guarded_review_action, self.application,
                                         "select", {**PAYLOAD, "selected_ids": selected})
                self.assertEqual(self.application.store.task["selected"], [SECOND])
                self.assertTrue(self.application.busy)
        self.application.store.select_error = ValueError("original filter policy refused")
        self.assert_bridge_error(400, "bad_input", guarded_review_action,
                                 self.application, "select", PAYLOAD)
        self.assertEqual(self.application.store.task["selected"], [SECOND])
        self.assertEqual(self.application.operation, "import")

    def test_select_missing_or_changed_task_is_stale_even_during_download(self):
        self.application.busy, self.application.operation = True, "search"
        self.assert_bridge_error(409, "stale_task", guarded_review_action, self.application, "select",
                                 {**PAYLOAD, "expected_task_id": OTHER_TASK})
        self.application.store.task = None
        self.assert_bridge_error(409, "stale_task", guarded_review_action,
                                 self.application, "select", PAYLOAD)
        self.assertEqual(self.application.store.select_calls, [])
        self.assertTrue(self.application.busy)

    def test_select_save_failure_preserves_download_busy_and_is_unknown(self):
        self.application.busy, self.application.operation = True, "retry"
        self.application.store.after_select_error = ValueError("private save failure")
        self.assert_bridge_error(500, "review_action_failed", guarded_review_action,
                                 self.application, "select", PAYLOAD)
        self.assertEqual(self.application.store.task["selected"], [FIRST])
        self.assertTrue(self.application.busy)
        self.assertEqual(self.application.operation, "retry")
        self.assertTrue(self.application.cancel.is_set())
        acquired = self.application.lock.acquire(blocking=False)
        self.assertTrue(acquired, "failed selection must release its application lock")
        if acquired:
            self.application.lock.release()

    def test_select_while_retry_worker_runs_does_not_finish_the_worker(self):
        self.action("retry", {"expected_task_id": TASK, "id": REJECTED})
        self.assertTrue(self.application.worker_started.wait(2))
        self.assertEqual(self.action("select", PAYLOAD), {"ok": True})
        self.assertTrue(self.application.busy)
        self.assertTrue(self.application.worker.is_alive())
        self.assertEqual(self.application.store.task["selected"], [FIRST])
        self.finish_worker()
        self.assertFalse(self.application.busy)

    def test_select_waits_for_history_switch_then_rejects_old_task(self):
        switching, finish_switch = threading.Event(), threading.Event()
        attempted, finished = threading.Event(), threading.Event()
        results, errors = [], []
        original_load = self.application.store.load
        def held_load(task_id):
            switching.set()
            if not finish_switch.wait(3):
                raise AssertionError("history switch was not released")
            original_load(task_id)
        def switch():
            try:
                self.action("task", {"expected_task_id": TASK, "id": OTHER_TASK})
            except BaseException as error:
                errors.append(error)
        def select():
            attempted.set()
            try:
                results.append(self.action("select", PAYLOAD))
            except BridgeError as error:
                results.append((error.status, error.code))
            finally:
                finished.set()
        self.application.store.load = held_load
        switch_thread = threading.Thread(target=switch, daemon=True)
        select_thread = threading.Thread(target=select, daemon=True)
        switch_thread.start()
        try:
            self.assertTrue(switching.wait(2))
            acquired = self.application.lock.acquire(blocking=False)
            if acquired:
                self.application.lock.release()
            self.assertFalse(acquired)
            select_thread.start()
            self.assertTrue(attempted.wait(2))
            self.assertFalse(finished.is_set())
        finally:
            finish_switch.set()
            switch_thread.join(3)
            if select_thread.ident is not None:
                select_thread.join(3)
        self.assertFalse(switch_thread.is_alive())
        self.assertFalse(select_thread.is_alive())
        self.assertEqual(errors, [])
        self.assertEqual(results, [(409, "stale_task")])
        self.assertEqual(self.application.store.select_calls, [])

    def test_select_cannot_change_frozen_export_while_chooser_waits(self):
        entered, release = threading.Event(), threading.Event()
        errors = []
        def chooser():
            entered.set()
            if not release.wait(3):
                raise AssertionError("chooser was not released")
            return "/chosen/output"
        def export():
            try:
                guarded_export(self.application, PAYLOAD)
            except BaseException as error:
                errors.append(error)
        self.application.chooser = chooser
        worker = threading.Thread(target=export, daemon=True)
        worker.start()
        try:
            self.assertTrue(entered.wait(2))
            self.assert_bridge_error(409, "busy", guarded_review_action, self.application,
                                     "select", {**PAYLOAD, "selected_ids": [SECOND]})
            self.assertEqual(self.application.store.task["selected"], [FIRST])
            self.assertEqual(self.application.store.select_calls, [[FIRST]])
            self.assertTrue(self.application.busy)
        finally:
            release.set()
            worker.join(3)
        self.assertFalse(worker.is_alive())
        self.assertEqual(errors, [])

    def test_recycle_freezes_this_requests_selection_then_calls_original_store(self):
        self.assertEqual(self.action("recycle", PAYLOAD), {"ok": True})
        self.assertEqual(self.application.store.recycle_calls, [(TASK, [FIRST], False)])
        self.assertEqual(self.application.store.item(FIRST)["status"], "ready")
        self.assertEqual(self.application.store.item(SECOND)["status"], "trash")
        self.assertFalse(self.application.busy)
        self.assertEqual(self.application.operation, "")
        self.assertEqual(self.application.original_claim_calls, [])

    def test_empty_selection_recycles_every_ready_item(self):
        self.action("recycle", {**PAYLOAD, "selected_ids": []})
        self.assertEqual(self.application.store.recycle_calls, [(TASK, [], False)])
        self.assertTrue(all(item["status"] != "ready" for item in self.application.store.task["items"]))

    def test_restore_restores_all_trash_without_setting_selection(self):
        self.assertEqual(self.action("restore"), {"ok": True})
        self.assertEqual(self.application.store.item(TRASH)["status"], "ready")
        self.assertEqual(self.application.store.select_calls, [])
        self.assertEqual(self.application.store.recycle_calls, [(TASK, [SECOND], True)])

    def test_stale_recycle_restore_stop_retry_task_search_do_not_mutate(self):
        payloads = {"select": PAYLOAD, "recycle": PAYLOAD, "restore": {}, "stop": {},
                    "retry": {"id": REJECTED}, "task": {"id": OTHER_TASK}, "search": self.search_payload()}
        for action, payload in payloads.items():
            with self.subTest(action=action):
                self.assert_bridge_error(409, "stale_task", guarded_review_action, self.application, action,
                                         {**payload, "expected_task_id": OTHER_TASK})
        self.assertEqual(self.application.store.select_calls, [])
        self.assertEqual(self.application.store.recycle_calls, [])
        self.assertEqual(self.application.store.load_calls, [])
        self.assertEqual(self.application.calls, [])
        self.assertEqual(self.application.cooldown_checks, [])
        self.assertEqual(self.application.store.task["selected"], [SECOND])
        self.assertFalse(self.application.busy)

    def test_busy_rejections_do_not_release_another_operation(self):
        self.application.busy, self.application.operation = True, "export"
        payloads = {"select": PAYLOAD, "recycle": PAYLOAD, "restore": {}, "retry": {"id": REJECTED},
                    "task": {"id": OTHER_TASK}, "search": self.search_payload()}
        for action, payload in payloads.items():
            with self.subTest(action=action):
                self.assert_bridge_error(409, "busy", guarded_review_action, self.application, action,
                                         {**payload, "expected_task_id": TASK})
                self.assertTrue(self.application.busy)
                self.assertEqual(self.application.operation, "export")
        self.assertEqual(self.application.store.select_calls, [])
        self.assertEqual(self.application.store.recycle_calls, [])
        self.assertEqual(self.application.store.load_calls, [])

    def test_stop_only_sets_cancel_and_does_not_stop_export_or_open_chooser(self):
        self.application.busy, self.application.operation = True, "export"
        self.application.cancel.clear()
        self.assertEqual(self.action("stop"), {"ok": True})
        self.assertTrue(self.application.cancel.is_set())
        self.assertTrue(self.application.busy)
        self.assertEqual(self.application.operation, "export")
        self.assertEqual(self.application.chooser_calls, 0)
        self.assertEqual(self.application.store.export_calls, [])

    def test_stale_stop_does_not_cancel_new_task(self):
        self.application.cancel.clear()
        self.assert_bridge_error(409, "stale_task", guarded_review_action, self.application, "stop",
                                 {"expected_task_id": OTHER_TASK})
        self.assertFalse(self.application.cancel.is_set())

    def test_history_task_change_uses_original_load_and_null_means_no_task(self):
        self.assert_bridge_error(409, "stale_task", guarded_review_action, self.application, "task",
                                 {"expected_task_id": None, "id": OTHER_TASK})
        self.application.store.task = None
        self.assertEqual(self.action("task", {"expected_task_id": None, "id": OTHER_TASK}), {"ok": True})
        self.assertEqual(self.application.store.load_calls, [OTHER_TASK])
        self.assertEqual(self.application.store.task["id"], OTHER_TASK)
        self.assertFalse(self.application.busy)

    def test_selection_validation_precedes_recycle_and_does_not_reserve_busy(self):
        self.assert_bridge_error(400, "bad_input", guarded_review_action, self.application, "recycle",
                                 {**PAYLOAD, "selected_ids": [REJECTED]})
        self.assertEqual(self.application.store.recycle_calls, [])
        self.assertEqual(self.application.store.task["selected"], [SECOND])
        self.assertFalse(self.application.busy)

    def test_selection_save_value_error_is_unknown_even_if_ids_equal_previous(self):
        self.application.store.after_select_error = ValueError("private cache write failure")
        for action, function in (("select", lambda p: self.action("select", p)),
                                 ("recycle", lambda p: self.action("recycle", p)),
                                 ("export", lambda p: guarded_export(self.application, p))):
            with self.subTest(action=action):
                before = self.application.store.task["selected"]
                self.assert_bridge_error(500, "export_failed" if action == "export" else "review_action_failed",
                                         function, {**PAYLOAD, "selected_ids": [SECOND]})
                self.assertIsNot(before, self.application.store.task["selected"])
                self.assertFalse(self.application.busy)
        self.assertEqual(self.application.store.recycle_calls, [])
        self.assertEqual(self.application.chooser_calls, 0)

    def test_recycle_partial_effect_and_history_errors_are_unknown_not_400(self):
        for error in (ValueError("private path"), OSError("private path"), BridgeError(409, "busy")):
            with self.subTest(error=error):
                self.application.store.recycle_error = error
                self.assert_bridge_error(500, "review_action_failed", guarded_review_action,
                                         self.application, "restore", {"expected_task_id": TASK})
                self.assertEqual(self.application.store.item(TRASH)["status"], "ready")
                self.assertFalse(self.application.busy)
                self.assertEqual(self.application.operation, "")
        self.application.store.load_error = ValueError("save after task assignment")
        self.assert_bridge_error(500, "review_action_failed", guarded_review_action, self.application,
                                 "task", {"expected_task_id": TASK, "id": OTHER_TASK})
        self.assertEqual(self.application.store.task["id"], OTHER_TASK)
        self.assertFalse(self.application.busy)

    def test_select_and_recycle_hold_both_locks_without_calling_app_claim(self):
        checked = []
        def inspect_locks():
            def competitor():
                for lock in (self.application.lock, self.application.store.lock):
                    acquired = lock.acquire(blocking=False)
                    checked.append(acquired)
                    if acquired:
                        lock.release()
            worker = threading.Thread(target=competitor, daemon=True)
            worker.start()
            worker.join(2)
            self.assertFalse(worker.is_alive())
        self.application.store.during_select = inspect_locks
        for action in ("select", "recycle"):
            self.action(action, PAYLOAD)
        self.assertEqual(checked, [False, False, False, False])

    def test_cross_tab_selection_cannot_slip_between_selection_and_recycle(self):
        attempted = threading.Event()
        finished = threading.Event()
        observed = []
        def other_tab():
            attempted.set()
            with self.application.lock:
                with self.application.store.lock:
                    observed.append(self.application.store.item(SECOND)["status"])
                    self.application.store.task["selected"] = [SECOND]
            finished.set()
        worker = threading.Thread(target=other_tab, daemon=True)
        def during_select():
            worker.start()
            self.assertTrue(attempted.wait(2))
            self.assertFalse(finished.is_set())
        self.application.store.during_select = during_select
        self.action("recycle", PAYLOAD)
        worker.join(2)
        self.assertFalse(worker.is_alive())
        self.assertEqual(self.application.store.recycle_calls, [(TASK, [FIRST], False)])
        self.assertEqual(observed, ["trash"])

    def test_cross_tab_history_switch_rejects_previous_task_action(self):
        self.action("task", {"expected_task_id": TASK, "id": OTHER_TASK})
        self.assert_bridge_error(409, "stale_task", guarded_review_action,
                                 self.application, "recycle", PAYLOAD)
        self.assertEqual(self.application.store.select_calls, [])

    def test_retry_reuses_method_cooldown_and_proxy_worker_writes_to_real_app(self):
        original_claim = self.application.claim
        self.assertEqual(self.action("retry", {"expected_task_id": TASK, "id": REJECTED}), {"ok": True})
        self.assertTrue(self.application.worker_started.wait(2))
        self.assertTrue(self.application.busy)
        self.assertEqual(self.application.operation, "retry")
        self.assertEqual(self.application.cooldown_checks, [REJECTED])
        self.assertEqual(self.application.original_claim_calls, [])
        self.assertEqual(self.application.claim, original_claim)
        self.finish_worker()
        self.assertEqual(self.application.worker_write, REJECTED)
        self.assertFalse(self.application.busy)

    def test_retry_rejects_nonfailed_or_missing_candidate_before_claim(self):
        for candidate in (FIRST, "5" * 32):
            with self.subTest(candidate=candidate):
                self.assert_bridge_error(400, "bad_input", guarded_review_action, self.application, "retry",
                                         {"expected_task_id": TASK, "id": candidate})
                self.assertFalse(self.application.busy)
                self.assertEqual(self.application.operation, "")
                self.assertEqual(self.application.cooldown_checks, [])

    def test_search_keeps_original_bound_worker_and_creates_new_task(self):
        original_claim = self.application.claim
        self.assertEqual(self.action("search", self.search_payload()), {"ok": True})
        self.assertTrue(self.application.worker_started.wait(2))
        self.assertIs(self.application.worker_receiver, self.application)
        self.assertEqual(self.application.store.task["id"], OTHER_TASK)
        self.assertEqual(self.application.calls, [("search", "forest", 2, ["openverse"])])
        self.assertTrue(self.application.busy)
        self.assertEqual(self.application.claim, original_claim)
        self.finish_worker()
        self.assertEqual(self.application.worker_write, ("forest", ["openverse"]))

    def test_search_null_expectation_only_works_without_current_task(self):
        self.assert_bridge_error(409, "stale_task", guarded_review_action, self.application,
                                 "search", self.search_payload(None))
        self.application.store.task = None
        self.assertEqual(self.action("search", self.search_payload(None)), {"ok": True})

    def test_original_source_validation_is_400_before_claim_and_no_side_effect(self):
        self.assert_bridge_error(400, "bad_input", guarded_review_action, self.application, "search",
                                 {**self.search_payload(), "source_ids": ["not-a-provider"]})
        self.assertFalse(self.application.busy)
        self.assertEqual(self.application.calls, [])
        self.assertEqual(self.application.store.task["id"], TASK)

    def test_original_after_claim_value_errors_are_500_and_original_cleans_up(self):
        for action, payload in (("retry", {"expected_task_id": TASK, "id": REJECTED}),
                                ("search", self.search_payload())):
            for error in (ValueError("cooldown detail"), BridgeError(400, "bad_input"), RuntimeError("private")):
                with self.subTest(action=action, error=error):
                    self.application.after_claim_error = error
                    self.assert_bridge_error(500, "review_action_failed", guarded_review_action,
                                             self.application, action, payload)
                    self.assertFalse(self.application.busy)
                    self.assertEqual(self.application.calls, [])

    def test_task_change_during_original_search_validation_is_stale_at_claim(self):
        self.application.before_claim = lambda: self.action("task", {"expected_task_id": TASK, "id": OTHER_TASK})
        self.assert_bridge_error(409, "stale_task", guarded_review_action,
                                 self.application, "search", self.search_payload())
        self.assertEqual(self.application.calls, [])
        self.assertFalse(self.application.busy)

    def test_stop_cannot_cancel_new_search_during_old_task_publication_window(self):
        between_claim_and_create, publish_task = threading.Event(), threading.Event()
        stop_attempted, stop_finished = threading.Event(), threading.Event()
        results, errors = [], []
        def before_create():
            between_claim_and_create.set()
            if not publish_task.wait(3):
                raise AssertionError("search creation was not released")
        def start_search():
            try:
                results.append(self.action("search", self.search_payload()))
            except BaseException as error:
                errors.append(error)
        def stale_stop():
            stop_attempted.set()
            try:
                self.action("stop")
                errors.append(AssertionError("old-task stop cancelled the new search"))
            except BridgeError as error:
                results.append((error.status, error.code))
            finally:
                stop_finished.set()
        self.application.after_claim_before_create = before_create
        search_thread = threading.Thread(target=start_search, daemon=True)
        stop_thread = threading.Thread(target=stale_stop, daemon=True)
        search_thread.start()
        try:
            self.assertTrue(between_claim_and_create.wait(2))
            acquired = self.application.lock.acquire(blocking=False)
            if acquired:
                self.application.lock.release()
            self.assertFalse(acquired, "task publication must remain inside the guarded claim lock")
            stop_thread.start()
            self.assertTrue(stop_attempted.wait(2))
            self.assertFalse(stop_finished.is_set())
        finally:
            publish_task.set()
            search_thread.join(3)
            if stop_thread.ident is not None:
                stop_thread.join(3)
        self.assertFalse(search_thread.is_alive())
        self.assertFalse(stop_thread.is_alive())
        self.assertEqual(errors, [])
        self.assertIn({"ok": True}, results)
        self.assertIn((409, "stale_task"), results)
        self.assertFalse(self.application.cancel.is_set())

    def test_stop_while_chooser_waits_does_not_close_it_or_release_busy(self):
        entered, close_chooser = threading.Event(), threading.Event()
        results, errors = [], []
        def chooser():
            entered.set()
            if not close_chooser.wait(3):
                raise AssertionError("chooser was not released")
            return "/chosen/output"
        def export():
            try:
                results.append(guarded_export(self.application, PAYLOAD))
            except BaseException as error:
                errors.append(error)
        self.application.chooser = chooser
        worker = threading.Thread(target=export, daemon=True)
        worker.start()
        try:
            self.assertTrue(entered.wait(2))
            self.assertEqual(self.action("stop"), {"ok": True})
            self.assertTrue(self.application.busy)
            self.assertTrue(worker.is_alive())
            self.assertEqual(self.application.store.export_calls, [])
        finally:
            close_chooser.set()
            worker.join(3)
        self.assertFalse(worker.is_alive())
        self.assertEqual(errors, [])
        self.assertFalse(results[0]["cancelled"])
        self.assertEqual(self.application.store.export_calls, ["/chosen/output"])

    def test_unknown_method_failure_must_not_release_a_newer_operation(self):
        def broken(receiver, query, limit, source_ids=None):
            receiver.claim("search")
            # Model state being changed again before an unknown failure. The
            # bridge must not implement a blanket busy cleanup for async calls.
            receiver.busy = False
            receiver.busy, receiver.operation = True, "export"
            raise ValueError("unknown after side effects")
        self.application.start_search = types.MethodType(broken, self.application)
        self.assert_bridge_error(500, "review_action_failed", guarded_review_action,
                                 self.application, "search", self.search_payload())
        self.assertTrue(self.application.busy)
        self.assertEqual(self.application.operation, "export")

    def test_unbound_or_nonclaiming_original_method_cannot_report_success(self):
        self.application.start_search = lambda *args, **kwargs: None
        self.assert_bridge_error(500, "review_action_failed", guarded_review_action,
                                 self.application, "search", self.search_payload())
        def no_claim(receiver, query, limit, source_ids=None):
            return None
        self.application.start_search = types.MethodType(no_claim, self.application)
        self.assert_bridge_error(500, "review_action_failed", guarded_review_action,
                                 self.application, "search", self.search_payload())
        self.assertFalse(self.application.busy)


class StaticTests(OfflineTest):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.dist = create_dist(self.temp.name)

    def test_manifest_is_exact_and_immutable(self):
        manifest = build_static_manifest(self.dist)
        self.assertEqual(set(manifest), {"/companion/", "/companion/index.html",
                                         "/assets/app-AbC1.js", "/assets/app-XyZ1.css"})
        self.assertIs(manifest["/companion/"], manifest["/companion/index.html"])
        with self.assertRaises(TypeError):
            manifest["/extra"] = manifest["/companion/"]

    def test_startup_snapshot_does_not_follow_later_changes(self):
        manifest = build_static_manifest(self.dist)
        prior = manifest["/assets/app-AbC1.js"].content
        (self.dist / "assets" / "app-AbC1.js").write_text("changed")
        (self.dist / "assets" / "new.js").write_text("new")
        self.assertEqual(manifest["/assets/app-AbC1.js"].content, prior)
        self.assertNotIn("/assets/new.js", manifest)

    def test_non_asset_root_files_are_not_exposed(self):
        (self.dist / "secret.json").write_text('{"private":true}')
        self.assertNotIn("/secret.json", build_static_manifest(self.dist))

    def test_inline_and_external_index_resources_rejected(self):
        bad = ['<script>alert(1)</script>',
               '<script src="https://evil.example/x.js"></script>',
               '<script src="//evil.example/x.js"></script>',
               '<script src="/assets/app-AbC1.js">alert(1)</script>',
               '<script src="/assets/app-AbC1.js"/>',
               '<script src="/assets/../app.py"></script>',
               '<script src="/assets/missing.js"></script>',
               '<script src="/assets/app-AbC1.js?query"></script>',
               '<base href="https://evil.example/">',
               '<html manifest="https://evil.example/manifest.appcache">',
               '<link rel="preload" href="/assets/app-AbC1.js" imagesrcset="https://evil.example/x 1x">',
               '<script src="/assets/app-AbC1.js" attributionsrc="https://evil.example/"></script>',
               '<style>body{color:red}</style>',
               '<div onclick="evil()"></div>',
               '<div style="color:red"></div>',
               '<meta http-equiv="refresh" content="0;url=https://evil.example/">',
               '<iframe src="/assets/app-AbC1.js"></iframe>',
               '<link rel="icon" href="/favicon.svg">',
               '<link rel="preload" href="data:text/plain,secret">',
               '<script src="/assets/app-AbC1.js" src="/assets/app-AbC1.js"></script>']
        valid = (self.dist / "index.html").read_text()
        for snippet in bad:
            with self.subTest(snippet=snippet):
                (self.dist / "index.html").write_text(valid.replace("</head>", snippet + "</head>"))
                with self.assertRaises(StaticValidationError):
                    build_static_manifest(self.dist)

    def test_symlink_file_directory_and_root_rejected(self):
        outside = self.dist / "outside.txt"
        outside.write_text("not an asset")
        link = self.dist / "assets" / "alias.js"
        link.symlink_to(outside)
        with self.assertRaises(StaticValidationError):
            build_static_manifest(self.dist)
        link.unlink()
        directory_link = self.dist / "assets" / "alias"
        directory_link.symlink_to(self.dist, target_is_directory=True)
        with self.assertRaises(StaticValidationError):
            build_static_manifest(self.dist)
        directory_link.unlink()
        root_link = self.dist / "root-alias"
        root_link.symlink_to(self.dist, target_is_directory=True)
        with self.assertRaises(StaticValidationError):
            build_static_manifest(root_link)

    def test_percent_encoded_asset_names_are_rejected(self):
        (self.dist / "assets" / "%2e%2e.js").write_text("unsafe")
        with self.assertRaises(StaticValidationError):
            build_static_manifest(self.dist)


class HandlerTests(OfflineTest):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.application = FakeApplication()
        manifest = build_static_manifest(create_dist(self.temp.name))
        self.handler_class = make_bridge_handler(FakeOriginalHandler, self.application, manifest)

    def test_original_routes_are_preserved(self):
        for method, paths in [("GET", ["/", "/api/state", "/image/token/id/full"]),
                              ("POST", ["/api/select", "/api/export", "/api/import"])]:
            for path in paths:
                with self.subTest(method=method, path=path):
                    handler = handler_instance(self.handler_class, path)
                    getattr(handler, "do_" + method)()
                    self.assertEqual(handler.original_route, (method, path))

    def test_static_uses_original_host_check_send_and_csp(self):
        handler = handler_instance(self.handler_class, "/companion/", token=False)
        handler.do_GET()
        self.assertEqual(handler.response[0], 200)
        self.assertEqual(handler.guard_calls, ["host"])
        self.assertEqual(handler.security_headers["Content-Security-Policy"], CSP)
        self.assertEqual(handler.security_headers["Cache-Control"], "no-store")

    def test_static_bad_host_rejected_explicitly(self):
        handler = handler_instance(self.handler_class, "/assets/app-AbC1.js", host=False)
        handler.do_GET()
        self.assertEqual(handler.response[0], 403)
        self.assertNotIn(b"export const", handler.response[1])

    def test_unknown_and_traversal_assets_fail_closed(self):
        for path in ["/assets/missing.js", "/assets/../app.py", "/assets/%2e%2e/app.py",
                     "/assets/app-AbC1.js?cache=1", "/assets/..\\app.py",
                     "/companion/../../app.py", "/companion/index.html/extra"]:
            with self.subTest(path=path):
                handler = handler_instance(self.handler_class, path)
                handler.do_GET()
                self.assertEqual(handler.response[0], 404)
                self.assertIsNone(handler.original_route)

    def test_capabilities_require_original_host_and_token(self):
        for host, token in [(False, True), (True, False)]:
            with self.subTest(host=host, token=token):
                handler = handler_instance(self.handler_class, "/api/companion/capabilities", host=host, token=token)
                handler.do_GET()
                self.assertEqual(handler.response[0], 403)
                self.assertEqual(handler.guard_calls, ["api", "host"])
        handler = handler_instance(self.handler_class, "/api/companion/capabilities")
        handler.do_GET()
        self.assertEqual(json.loads(handler.response[1]), {"schema_version": 1, "guarded_export": True,
                                                         "guarded_review_actions": True, "guarded_selection": True})
        self.assertEqual(handler.response[0], 200)
        self.assertEqual(handler.security_headers["Content-Security-Policy"], CSP)

    def test_export_auth_failure_has_no_side_effect(self):
        for host, token in [(False, True), (True, False)]:
            with self.subTest(host=host, token=token):
                handler = handler_instance(self.handler_class, "/api/companion/export", host=host, token=token)
                handler.do_POST()
                self.assertEqual(handler.response[0], 403)
                self.assertEqual(handler.rfile.tell(), 0)
                self.assertTrue(handler.close_connection)
        self.assertEqual(self.application.store.select_calls, [])
        self.assertEqual(self.application.chooser_calls, 0)

    def test_export_happy_path_preserves_original_send_headers(self):
        handler = handler_instance(self.handler_class, "/api/companion/export")
        handler.do_POST()
        self.assertEqual(handler.response[0], 200)
        self.assertEqual(handler.guard_calls, ["api", "host"])
        self.assertFalse(json.loads(handler.response[1])["cancelled"])
        self.assertEqual(handler.security_headers["Content-Security-Policy"], CSP)

    def test_invalid_headers_fail_before_body_read(self):
        invalid = [[], [("Content-Length", "1")], [("Content-Type", "application/json")],
                   [("Content-Type", "application/json"), ("Content-Length", "8193")],
                   [("Content-Type", "application/json"), ("Content-Length", "-1")],
                   [("Content-Type", "application/json"), ("Content-Length", "+1")],
                   [("Content-Type", "application/json"), ("Content-Length", "0")],
                   [("Content-Type", "text/plain"), ("Content-Length", "1")],
                   [("Content-Type", "application/json; charset=latin-1"), ("Content-Length", "1")],
                   [("Content-Type", "application/json"), ("Content-Length", "1"), ("Content-Length", "1")],
                   [("Content-Type", "application/json"), ("Content-Type", "application/json"), ("Content-Length", "1")],
                   [("Content-Type", "application/json"), ("Content-Length", "1"), ("Transfer-Encoding", "chunked")]]
        for headers in invalid:
            with self.subTest(headers=headers):
                handler = handler_instance(self.handler_class, "/api/companion/export", headers=headers)
                handler.do_POST()
                self.assertEqual(handler.response[0], 400)
                self.assertEqual(handler.rfile.tell(), 0)
                self.assertTrue(handler.close_connection)
        self.assertEqual(self.application.chooser_calls, 0)

    def test_short_body_rejected(self):
        handler = handler_instance(self.handler_class, "/api/companion/export", raw=b"{}",
                                   headers=[("Content-Type", "application/json"), ("Content-Length", "100")])
        handler.do_POST()
        self.assertEqual(handler.response[0], 400)

    def test_busy_stale_and_invalid_map_to_expected_http_status(self):
        handler = handler_instance(self.handler_class, "/api/companion/export",
                                   payload={**PAYLOAD, "expected_task_id": OTHER_TASK})
        handler.do_POST()
        self.assertEqual(handler.response[0], 409)
        self.assertEqual(json.loads(handler.response[1]), {"error": "stale_task"})
        self.application.busy = True
        handler = handler_instance(self.handler_class, "/api/companion/export")
        handler.do_POST()
        self.assertEqual(handler.response[0], 409)
        self.application.busy = False
        handler = handler_instance(self.handler_class, "/api/companion/export", payload={**PAYLOAD, "extra": 1})
        handler.do_POST()
        self.assertEqual(handler.response[0], 400)

    def test_unexpected_errors_do_not_leak_details_and_release_busy(self):
        self.application.store.export_error = RuntimeError("secret-token /private/home")
        handler = handler_instance(self.handler_class, "/api/companion/export")
        handler.do_POST()
        self.assertEqual(handler.response[0], 500)
        self.assertEqual(json.loads(handler.response[1]), {"error": "export_failed"})
        self.assertNotIn(b"secret", handler.response[1])
        self.assertFalse(self.application.busy)
        self.assertEqual(self.application.operation, "")


    def test_chooser_and_export_value_errors_are_500_not_validation_rejection(self):
        for phase in ("chooser", "export"):
            with self.subTest(phase=phase):
                self.application.chooser_error = ValueError("private chooser data") if phase == "chooser" else None
                self.application.store.export_error = ValueError("private export data") if phase == "export" else None
                handler = handler_instance(self.handler_class, "/api/companion/export")
                handler.do_POST()
                self.assertEqual(handler.response[0], 500)
                self.assertEqual(json.loads(handler.response[1]), {"error": "export_failed"})
                self.assertFalse(self.application.busy)
                self.assertEqual(self.application.operation, "")

    def test_execution_phase_bridge_errors_are_500_not_preflight_rejections(self):
        for phase in ("chooser", "export"):
            for status, code in ((400, "bad_input"), (409, "busy")):
                with self.subTest(phase=phase, status=status):
                    self.application.chooser_error = BridgeError(status, code) if phase == "chooser" else None
                    self.application.store.export_error = BridgeError(status, code) if phase == "export" else None
                    handler = handler_instance(self.handler_class, "/api/companion/export")
                    handler.do_POST()
                    self.assertEqual(handler.response[0], 500)
                    self.assertEqual(json.loads(handler.response[1]), {"error": "export_failed"})
                    self.assertGreater(self.application.chooser_calls, 0)
                    self.assertFalse(self.application.busy)
                    self.assertEqual(self.application.operation, "")

    def test_unserializable_export_result_is_unknown_500(self):
        self.application.store.export_result = object()
        handler = handler_instance(self.handler_class, "/api/companion/export")
        handler.do_POST()
        self.assertEqual(handler.response[0], 500)
        self.assertFalse(self.application.busy)

    def test_attach_subclasses_existing_handler_without_opening_socket(self):
        server = types.SimpleNamespace(RequestHandlerClass=FakeOriginalHandler)
        manifest = build_static_manifest(Path(self.temp.name))
        self.assertIs(attach_bridge(server, self.application, manifest), server)
        self.assertTrue(issubclass(server.RequestHandlerClass, FakeOriginalHandler))

    def test_missing_original_guard_is_rejected(self):
        class MissingGuard(FakeOriginalHandler):
            api_allowed = None
        with self.assertRaises(TypeError):
            make_bridge_handler(MissingGuard, self.application, {})


class ReviewHandlerTests(OfflineTest):
    PAYLOADS = {"select": PAYLOAD, "recycle": PAYLOAD, "restore": {"expected_task_id": TASK},
                "stop": {"expected_task_id": TASK}, "retry": {"expected_task_id": TASK, "id": REJECTED},
                "task": {"expected_task_id": TASK, "id": OTHER_TASK},
                "search": {"expected_task_id": TASK, "query": "forest", "limit": 2,
                           "source_ids": ["openverse"]}}

    def setUp(self):
        self.application = FakeReviewApplication()
        self.handler_class = make_bridge_handler(FakeOriginalHandler, self.application, {})
        self.addCleanup(self.finish_worker)

    def finish_worker(self):
        self.application.worker_release.set()
        if self.application.worker:
            self.application.worker.join(3)
            self.assertFalse(self.application.worker.is_alive())

    def handler(self, action, **kwargs):
        return handler_instance(self.handler_class, "/api/companion/" + action,
                                payload=self.PAYLOADS[action], **kwargs)

    def test_every_review_endpoint_authenticates_before_reading_body(self):
        for action in self.PAYLOADS:
            for host, token in ((False, True), (True, False)):
                with self.subTest(action=action, host=host, token=token):
                    handler = self.handler(action, host=host, token=token)
                    handler.do_POST()
                    self.assertEqual(handler.response[0], 403)
                    self.assertEqual(handler.rfile.tell(), 0)
                    self.assertTrue(handler.close_connection)
                    self.assertEqual(handler.guard_calls, ["api", "host"])
        self.assertEqual(self.application.store.select_calls, [])
        self.assertEqual(self.application.store.recycle_calls, [])
        self.assertEqual(self.application.calls, [])

    def test_every_endpoint_rejects_bad_framing_before_body_read(self):
        invalid = [[], [("Content-Type", "application/json"), ("Content-Length", "8193")],
                   [("Content-Type", "application/json"), ("Content-Length", "2"), ("Transfer-Encoding", "chunked")],
                   [("Content-Type", "application/json"), ("Content-Length", "2"), ("Content-Length", "2")]]
        for action in self.PAYLOADS:
            for headers in invalid:
                with self.subTest(action=action, headers=headers):
                    handler = self.handler(action, headers=headers)
                    handler.do_POST()
                    self.assertEqual(handler.response[0], 400)
                    self.assertEqual(handler.rfile.tell(), 0)
                    self.assertTrue(handler.close_connection)

    def test_every_endpoint_rejects_extra_fields_without_effects(self):
        for action, payload in self.PAYLOADS.items():
            with self.subTest(action=action):
                handler = self.handler(action, raw=json.dumps({**payload, "path": "/forbidden"}).encode())
                handler.do_POST()
                self.assertEqual(handler.response[0], 400)
                self.assertEqual(json.loads(handler.response[1]), {"error": "bad_input"})
        self.assertEqual(self.application.store.task["id"], TASK)
        self.assertEqual(self.application.store.select_calls, [])
        self.assertEqual(self.application.store.recycle_calls, [])
        self.assertEqual(self.application.store.load_calls, [])
        self.assertIsNone(self.application.worker)

    def test_all_actions_use_original_headers_and_return_acceptance(self):
        for action in self.PAYLOADS:
            with self.subTest(action=action):
                self.application = FakeReviewApplication()
                self.handler_class = make_bridge_handler(FakeOriginalHandler, self.application, {})
                handler = self.handler(action)
                handler.do_POST()
                self.assertEqual(handler.response[0], 200)
                self.assertEqual(json.loads(handler.response[1]), {"ok": True})
                self.assertEqual(handler.security_headers["Content-Security-Policy"], CSP)
                self.assertEqual(handler.security_headers["Cache-Control"], "no-store")
                self.assertEqual(handler.guard_calls, ["api", "host"])
                self.assertIsNone(handler.original_route)
                self.finish_worker()

    def test_stale_http_is_constant_409_and_has_no_effect(self):
        for action, payload in self.PAYLOADS.items():
            with self.subTest(action=action):
                handler = self.handler(action, raw=json.dumps({**payload, "expected_task_id": OTHER_TASK}).encode())
                handler.do_POST()
                self.assertEqual(handler.response[0], 409)
                self.assertEqual(json.loads(handler.response[1]), {"error": "stale_task"})
        self.assertEqual(self.application.store.select_calls, [])
        self.assertEqual(self.application.store.recycle_calls, [])

    def test_partial_recycle_value_error_is_500_with_no_private_details(self):
        self.application.store.recycle_error = ValueError("private-token C:\\private\\cache")
        handler = self.handler("recycle")
        handler.do_POST()
        self.assertEqual(handler.response[0], 500)
        self.assertEqual(json.loads(handler.response[1]), {"error": "review_action_failed"})
        self.assertNotIn(b"private", handler.response[1])
        self.assertEqual(self.application.store.item(SECOND)["status"], "trash")
        self.assertFalse(self.application.busy)

    def test_selection_http_during_download_and_save_failure_preserve_busy(self):
        self.application.busy, self.application.operation = True, "import"
        handler = self.handler("select")
        handler.do_POST()
        self.assertEqual(handler.response[0], 200)
        self.assertEqual(json.loads(handler.response[1]), {"ok": True})
        self.assertTrue(self.application.busy)
        self.application.store.after_select_error = ValueError("private cache path")
        handler = self.handler("select")
        handler.do_POST()
        self.assertEqual(handler.response[0], 500)
        self.assertEqual(json.loads(handler.response[1]), {"error": "review_action_failed"})
        self.assertNotIn(b"private", handler.response[1])
        self.assertTrue(self.application.busy)
        self.assertEqual(self.application.operation, "import")

    def test_original_review_routes_are_still_delegated(self):
        for action in self.PAYLOADS:
            handler = handler_instance(self.handler_class, "/api/" + action)
            handler.do_POST()
            self.assertEqual(handler.original_route, ("POST", "/api/" + action))


class BaselineTests(OfflineTest):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def fake_review_tree(self):
        sources = {"app.py": b"from publicImages import ImageApplication\nfrom taskStore import TaskStore, CacheLease\nfrom imageManifest import MAX_MANIFEST_BYTES\n",
                   "imageManifest.py": b"MAX_MANIFEST_BYTES = 100\n",
                   "publicImages.py": b"class ImageApplication:\n    pass\n",
                   "taskStore.py": b"class TaskStore:\n    pass\nclass CacheLease:\n    pass\n"}
        for name, source in sources.items():
            (self.root / name).write_bytes(source)
        return {name: hashlib.sha256(source).hexdigest() for name, source in sources.items()
                if name in launch_picker.REVIEW_SHA256}

    def test_production_pins_are_exact_and_immutable(self):
        self.assertEqual(launch_picker.REVIEW_VERSION, "v0.1.0.20")
        self.assertEqual(launch_picker.REVIEW_COMMIT, "776b7ea4de6d03b6dde408fcf27b51490967f367")
        self.assertEqual(dict(launch_picker.REVIEW_SHA256), {
            "app.py": "26e9e7cad8519c54fab2378eccd9e1833d23c51875fd552da0c7ecf3e62ad959",
            "publicImages.py": "4838d7c068cfcdbce5ca54a4c05618f93be783016313acaa2d3958cb669276b0",
            "taskStore.py": "41aa8936543b3d0117b0773871e61b6bcea8f78960b9b481fb9e43b7b71905a1"})
        with self.assertRaises(TypeError):
            launch_picker.REVIEW_SHA256["app.py"] = "0" * 64

    def test_missing_tree_rejected_before_import(self):
        with self.assertRaises(launch_picker.BaselineError):
            launch_picker.verify_review_root(self.root)

    def test_modified_source_rejected_before_any_execution(self):
        pins = self.fake_review_tree()
        (self.root / "app.py").write_text('raise AssertionError("must never execute")\n')
        with mock.patch.object(launch_picker, "REVIEW_SHA256", pins):
            with self.assertRaisesRegex(launch_picker.BaselineError, "SHA-256 mismatch"):
                with launch_picker.load_review_backend(self.root):
                    self.fail("modified backend imported")
        self.assertNotIn("app", sys.modules)

    def test_all_pinned_files_checked_before_import(self):
        pins = self.fake_review_tree()
        (self.root / "taskStore.py").write_text("modified source\n")
        with mock.patch.object(launch_picker, "REVIEW_SHA256", pins):
            with self.assertRaisesRegex(launch_picker.BaselineError, "taskStore.py"):
                with launch_picker.load_review_backend(self.root):
                    self.fail("incomplete verification")
        self.assertNotIn("app", sys.modules)

    def test_validated_bytes_import_original_dependencies_and_cleanup(self):
        pins = self.fake_review_tree()
        original_path = list(sys.path)
        original_bytecode = sys.dont_write_bytecode
        with mock.patch.object(launch_picker, "REVIEW_SHA256", pins):
            with launch_picker.load_review_backend(self.root) as modules:
                self.assertIs(modules["app"].ImageApplication, modules["publicImages"].ImageApplication)
                self.assertIs(modules["app"].TaskStore, modules["taskStore"].TaskStore)
                self.assertIs(launch_picker.resolve_export(modules, "taskStore:CacheLease"), modules["taskStore"].CacheLease)
                self.assertTrue(sys.dont_write_bytecode)
        self.assertEqual(sys.path, original_path)
        self.assertEqual(sys.dont_write_bytecode, original_bytecode)
        self.assertFalse((self.root / "__pycache__").exists())
        for name in ("app", "publicImages", "taskStore", "imageManifest"):
            self.assertNotIn(name, sys.modules)


    def test_required_unpinned_dependency_must_exist_locally(self):
        pins = self.fake_review_tree()
        (self.root / "imageManifest.py").unlink()
        with mock.patch.object(launch_picker, "REVIEW_SHA256", pins):
            with self.assertRaises(launch_picker.BaselineError):
                launch_picker.verify_review_root(self.root)

    def test_required_unpinned_dependency_cannot_be_symlink(self):
        pins = self.fake_review_tree()
        source = self.root / "imageManifest.py"
        moved = self.root / "originalManifest.py"
        source.rename(moved)
        source.symlink_to(moved)
        with mock.patch.object(launch_picker, "REVIEW_SHA256", pins):
            with self.assertRaises(launch_picker.BaselineError):
                launch_picker.verify_review_root(self.root)

    def test_preexisting_pinned_module_is_not_reused(self):
        pins = self.fake_review_tree()
        existing = types.ModuleType("app")
        with mock.patch.object(launch_picker, "REVIEW_SHA256", pins), mock.patch.dict(sys.modules, {"app": existing}):
            with self.assertRaisesRegex(launch_picker.BaselineError, "already loaded"):
                with launch_picker.load_review_backend(self.root):
                    self.fail("reused module")
            self.assertIs(sys.modules["app"], existing)

    def test_backend_symlink_rejected(self):
        pins = self.fake_review_tree()
        source = self.root / "app.py"
        moved = self.root / "other.py"
        source.rename(moved)
        source.symlink_to(moved)
        with mock.patch.object(launch_picker, "REVIEW_SHA256", pins):
            with self.assertRaises(launch_picker.BaselineError):
                launch_picker.verify_review_root(self.root)

    def test_missing_original_dependency_fails_closed(self):
        pins = self.fake_review_tree()
        source = b"import companion_missing_original_dependency\n"
        (self.root / "app.py").write_bytes(source)
        pins["app.py"] = hashlib.sha256(source).hexdigest()
        with mock.patch.object(launch_picker, "REVIEW_SHA256", pins):
            with self.assertRaisesRegex(launch_picker.BaselineError, "dependency"):
                with launch_picker.load_review_backend(self.root):
                    self.fail("missing dependency was ignored")
        self.assertNotIn("app", sys.modules)

    def test_export_reference_and_interface_fail_closed(self):
        modules = {"app": types.SimpleNamespace(), "taskStore": types.SimpleNamespace()}
        for reference in ("taskStore:CacheLease", "os:system", "taskStore:Nested.attr", "app:__dict__"):
            with self.subTest(reference=reference):
                with self.assertRaises(launch_picker.BaselineError):
                    launch_picker.resolve_export(modules, reference)
        with self.assertRaises(launch_picker.BaselineError):
            launch_picker._supports(lambda: None, "unexpected argument")

    def test_verified_source_snapshot_is_used_instead_of_changed_disk_bytes(self):
        pins = self.fake_review_tree()
        with mock.patch.object(launch_picker, "REVIEW_SHA256", pins):
            verified = launch_picker.verify_review_root(self.root)
            (self.root / "app.py").write_text('raise AssertionError("changed source must not execute")\n')
            with mock.patch.object(launch_picker, "verify_review_root", return_value=verified):
                with launch_picker.load_review_backend(self.root) as modules:
                    self.assertIs(modules["app"].TaskStore, modules["taskStore"].TaskStore)


class LauncherTests(OfflineTest):
    """A fake server records startup order. No real make_server is called."""
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.dist = create_dist(self.temp.name)
        self.events = []
        self.failure = None
        events = self.events
        owner = self

        class Store(FakeStore):
            def __init__(self, cache, restore=True):
                super().__init__()
                events.append(("store", cache, restore))

            def load_last(self):
                events.append("load_last")
                if owner.failure == "load_last":
                    raise RuntimeError("restore failure")

        class Lease:
            def __init__(self, store):
                events.append("lease")

            def close(self):
                events.append("lease_close")

        class Server:
            RequestHandlerClass = FakeOriginalHandler
            server_address = ("127.0.0.1", 45678)

            def serve_forever(self):
                events.append("serve")
                owner.assertTrue(issubclass(self.RequestHandlerClass, FakeOriginalHandler))
                owner.assertIsNot(self.RequestHandlerClass, FakeOriginalHandler)
                if owner.failure == "serve":
                    raise RuntimeError("serve failure")

            def server_close(self):
                events.append("server_close")

        def application_factory(cache, store=None):
            events.append("application")
            application = FakeApplication()
            application.store = store
            return application

        def make_server(application, port=0):
            events.append(("server", port))
            if owner.failure == "server":
                raise RuntimeError("server failure")
            server = Server()
            if owner.failure == "non_loopback":
                server.server_address = ("0.0.0.0", 45678)
            return server

        self.modules = {"app": types.SimpleNamespace(ImageApplication=application_factory, make_server=make_server),
                        "taskStore": types.SimpleNamespace(TaskStore=Store, CacheLease=Lease)}
        @contextmanager
        def load_review_backend(root):
            events.append("load_verified_backend")
            yield self.modules
        patcher = mock.patch.object(launch_picker, "load_review_backend", load_review_backend)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.stdout = io.StringIO()
        output = mock.patch("sys.stdout", self.stdout)
        output.start()
        self.addCleanup(output.stop)

    def launch(self):
        launch_picker.run("/explicit/review/root", self.dist, "/explicit/cache")

    def test_original_startup_and_cleanup_order(self):
        self.launch()
        self.assertEqual(self.events, ["load_verified_backend", ("store", Path("/explicit/cache"), False),
                                       "lease", "load_last", "application", ("server", 0), "serve",
                                       "server_close", "lease_close"])
        self.assertIn("http://127.0.0.1:45678/companion/", self.stdout.getvalue())
        self.assertNotIn("token", self.stdout.getvalue())

    def test_restore_failure_releases_lease_without_server(self):
        self.failure = "load_last"
        with self.assertRaises(RuntimeError):
            self.launch()
        self.assertEqual(self.events[-1], "lease_close")
        self.assertNotIn("application", self.events)
        self.assertNotIn("server_close", self.events)

    def test_server_failure_releases_lease(self):
        self.failure = "server"
        with self.assertRaises(RuntimeError):
            self.launch()
        self.assertEqual(self.events[-1], "lease_close")
        self.assertNotIn("server_close", self.events)

    def test_serve_failure_closes_server_then_lease(self):
        self.failure = "serve"
        with self.assertRaises(RuntimeError):
            self.launch()
        self.assertEqual(self.events[-2:], ["server_close", "lease_close"])

    def test_non_loopback_server_is_closed_without_serving(self):
        self.failure = "non_loopback"
        with self.assertRaises(launch_picker.BaselineError):
            self.launch()
        self.assertNotIn("serve", self.events)
        self.assertEqual(self.events[-2:], ["server_close", "lease_close"])

    def test_missing_configured_export_does_not_create_store_or_lease(self):
        del self.modules["taskStore"].CacheLease
        with self.assertRaises(launch_picker.BaselineError):
            self.launch()
        self.assertEqual(self.events, ["load_verified_backend"])

    def test_cli_requires_explicit_paths_and_has_no_hash_bypass(self):
        with mock.patch("sys.stderr", io.StringIO()):
            with self.assertRaises(SystemExit) as caught:
                launch_picker.main([])
        self.assertEqual(caught.exception.code, 2)
        with mock.patch("sys.stderr", io.StringIO()):
            with self.assertRaises(SystemExit) as caught:
                launch_picker.main(["--review-root", "/review", "--dist", str(self.dist),
                                    "--cache", "/cache", "--skip-hash"])
        self.assertEqual(caught.exception.code, 2)



if __name__ == "__main__":
    unittest.main()
