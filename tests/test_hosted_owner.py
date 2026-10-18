"""Offline shutdown/lease contract; no network, original cache or model."""
import contextlib
import os
import sys
import io
import json
import threading
import time
import types
import unittest
from unittest.mock import patch
from bridge import hosted_owner

class HostLifecycle(unittest.TestCase):
    @unittest.skipUnless(os.name == "nt", "Windows process standard-handle regression")
    def test_child_nul_does_not_replace_control_stdin_or_crt_fd_and_restores_on_error(self):
        import ctypes
        from ctypes import wintypes
        import msvcrt
        kernel=ctypes.WinDLL("kernel32",use_last_error=True)
        kernel.GetStdHandle.argtypes=[wintypes.DWORD]
        kernel.GetStdHandle.restype=wintypes.HANDLE
        key=wintypes.DWORD(-10 & 0xffffffff)
        previous=kernel.GetStdHandle(key)
        stream=sys.stdin
        crt=msvcrt.get_osfhandle(0)
        with self.assertRaisesRegex(ValueError,"fixture"):
            with hosted_owner.isolated_child_stdin():
                self.assertNotEqual(kernel.GetStdHandle(key),previous)
                self.assertIs(sys.stdin,stream)
                self.assertEqual(msvcrt.get_osfhandle(0),crt)
                raise ValueError("fixture")
        self.assertEqual(kernel.GetStdHandle(key),previous)
        self.assertEqual(msvcrt.get_osfhandle(0),crt)

    def test_lease_waits_for_active_handler_busy_and_worker(self):
        events=[]
        busy=threading.Event();busy.set()
        handler_release=threading.Event()
        worker_release=threading.Event()
        started=threading.Event()
        class Store:
            def __init__(self,*args,**kwargs):self.lock=threading.RLock()
            def load_last(self):pass
        class Lease:
            def __init__(self,store):events.append('lease-acquired')
            def close(self):events.append('lease-closed')
        class Handler:
            def handle(self):started.set();handler_release.wait(3)
        class Server:
            server_address=('127.0.0.1',12345)
            RequestHandlerClass=Handler
            def __init__(self):self.stop=threading.Event()
            def serve_forever(self):self.stop.wait(3)
            def shutdown(self):events.append('shutdown');self.stop.set()
            def server_close(self):events.append('server-close')
        server=Server()
        class Application:
            def __init__(self,*args,**kwargs):
                self.lock=threading.RLock();self.worker=threading.Thread(target=worker_release.wait,args=(3,));self.worker.start();app.append(self)
            @property
            def busy(self):return busy.is_set()
        app=[]
        modules={'app':types.SimpleNamespace(ImageApplication=Application,make_server=lambda *a,**k:server)}
        @contextlib.contextmanager
        def loader(root):yield modules
        class Input:
            def __iter__(self):
                h=threading.Thread(target=server.RequestHandlerClass().handle);h.start();started.wait(3)
                yield json.dumps({'operation':'observe','id':1})+'\n'
                yield json.dumps({'operation':'close'})+'\n'
        output=io.StringIO()
        with patch.object(hosted_owner,'load_review_backend',loader),patch.object(hosted_owner,'resolve_export',side_effect=lambda m,key:Store if key.endswith('TaskStore') else Lease),patch.object(hosted_owner,'_check_application'),patch.object(hosted_owner,'attach_bridge'),patch.object(hosted_owner.sys,'stdin',Input()),patch.object(hosted_owner.sys,'stdout',output):
            done=threading.Event()
            def serve():hosted_owner.serve('unused','unused');done.set()
            thread=threading.Thread(target=serve);thread.start()
            self.assertTrue(started.wait(3))
            for _ in range(100):
                if 'shutdown' in events:break
                time.sleep(.01)
            self.assertIn('shutdown',events);self.assertNotIn('lease-closed',events)
            handler_release.set();time.sleep(.06);self.assertNotIn('lease-closed',events)
            busy.clear();time.sleep(.06);self.assertNotIn('lease-closed',events)
            worker_release.set();thread.join(3);self.assertTrue(done.is_set())
        self.assertEqual(events,['lease-acquired','shutdown','server-close','lease-closed'])
        rows=[json.loads(row) for row in output.getvalue().splitlines()]
        self.assertEqual(rows[1],{'event':'observation','id':1,'handlers':1,'busy':True,'worker':True,'closing':False})
        self.assertEqual(rows[-1],{'event':'closed'})

if __name__=='__main__':unittest.main()
