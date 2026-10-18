"""Daemon-owned original Owner, private stdin maintenance, no frontend token API."""
from __future__ import annotations
import argparse
import json
from pathlib import Path
import sys
import threading
import time
from .launch_picker import load_review_backend, resolve_export, _check_application
from .picker_bridge import attach_bridge

def serve(review_root: str, cache: str) -> None:
    with load_review_backend(review_root) as modules:
        store = resolve_export(modules, "taskStore:TaskStore")(Path(cache), restore=False)
        lease = resolve_export(modules, "taskStore:CacheLease")(store)
        server = None
        thread = None
        gate = threading.Condition(threading.RLock())
        active = 0
        closing = False
        try:
            store.load_last()
            application = modules["app"].ImageApplication(Path(cache), store=store)
            _check_application(application, store)
            server = modules["app"].make_server(application, port=0)
            if server.server_address[0] != "127.0.0.1":
                raise ValueError("owner must bind exact IPv4 loopback")
            attach_bridge(server, application, {})
            original = server.RequestHandlerClass
            class TrackedHandler(original):
                def handle(self):
                    nonlocal active
                    with gate:
                        if closing:
                            return
                        active += 1
                    try:
                        super().handle()
                    finally:
                        with gate:
                            active -= 1
                            gate.notify_all()
            server.RequestHandlerClass = TrackedHandler
            def observation():
                with gate:
                    with application.lock:
                        with store.lock:
                            worker = getattr(application, "worker", None)
                            return {"handlers": active, "busy": bool(application.busy),
                                    "worker": bool(worker and worker.is_alive()), "closing": closing}
            def emit(value):
                print(json.dumps(value, separators=(",", ":")), flush=True)
            thread = threading.Thread(target=server.serve_forever, name="owner-http", daemon=False)
            thread.start()
            emit({"event": "ready", "port": server.server_address[1]})
            for line in sys.stdin:
                if len(line) > 512:
                    continue
                try:
                    command = json.loads(line)
                except ValueError:
                    continue
                if command.get("operation") == "observe" and isinstance(command.get("id"), int):
                    emit({"event": "observation", "id": command["id"], **observation()})
                elif command == {"operation": "close"}:
                    break
            # Admission closes BEFORE HTTP shutdown. Never abandon daemon handlers/workers.
            with gate:
                closing = True
            server.shutdown()
            thread.join()
            while True:
                state = observation()
                if not state["handlers"] and not state["busy"] and not state["worker"]:
                    break
                with gate:
                    gate.wait(timeout=0.05)
            server.server_close()
            server = None
            lease.close()
            lease = None
            emit({"event": "closed"})
        finally:
            # Startup failure can only release after handlers/workers have drained too.
            if server is not None:
                with gate:
                    closing = True
                if thread and thread.is_alive():
                    server.shutdown()
                    thread.join()
                while active or ("application" in locals() and (application.busy or (application.worker and application.worker.is_alive()))):
                    time.sleep(0.05)
                server.server_close()
            if lease is not None:
                lease.close()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--review-root", required=True)
    parser.add_argument("--cache", required=True)
    args = parser.parse_args()
    serve(args.review_root, args.cache)

if __name__ == "__main__":
    try:
        main()
    except Exception:
        # Closed local diagnostic only. No token/path/raw upstream exception.
        print('{"event":"failed"}', flush=True)
        raise SystemExit(1) from None
