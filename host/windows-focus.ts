export type WindowsFocusRunner = (script: string) => Promise<string>
// Loaded only by the Node host; frontend typechecking needs no Node dependency.
const run: WindowsFocusRunner = async script => {
  const builtin = 'node:child_process'
  const { execFile } = await import(builtin)
  return new Promise<string>((resolve, reject) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script],
      { windowsHide: true, timeout: 5000, maxBuffer: 16 * 1024 },
      (error: Error | null, stdout: string) => error ? reject(new Error('Windows 未确认目标 Creator 窗口到前台。')) : resolve(stdout))
  })
}

/** Explicit focus only; no policy changes, keyboard injection or persistent grants. */
export async function focusWindowsPid(pid: number, runner: WindowsFocusRunner = run): Promise<void> {
  if (!Number.isSafeInteger(pid) || pid <= 0 || pid > 2147483647) throw new Error('Invalid Creator PID')
  const raw = await runner(windowsFocusScript(pid))
  let receipt: unknown
  try { receipt = JSON.parse(raw) } catch { throw new Error('Windows 聚焦回执无法核实。') }
  const r = receipt as Record<string, unknown> | null
  if (!r || typeof r !== 'object' || r.targetPid !== pid || r.foregroundPid !== pid
    || r.verified !== true || r.detached !== true) throw new Error('Windows 未确认目标 Creator 窗口到前台。')
}

export function windowsFocusScript(pid: number): string {
  if (!Number.isSafeInteger(pid) || pid <= 0 || pid > 2147483647) throw new Error('Invalid Creator PID')
  return `
$ErrorActionPreference = 'Stop'
$env:PSModulePath = Join-Path $PSHOME 'Modules'
Add-Type @"
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Threading;
public class CompanionWindowFocus {
 delegate bool WindowCallback(IntPtr h, IntPtr l);
 [DllImport("user32.dll")] static extern bool EnumWindows(WindowCallback c, IntPtr p);
 [DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr h, uint c);
 [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint p);
 [DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();
 [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
 [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
 [DllImport("user32.dll")] static extern bool ShowWindowAsync(IntPtr h, int c);
 [DllImport("user32.dll")] static extern IntPtr GetLastActivePopup(IntPtr h);
 [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
 [DllImport("user32.dll")] static extern bool BringWindowToTop(IntPtr h);
 [DllImport("user32.dll")] static extern short GetAsyncKeyState(int key);
 [DllImport("user32.dll")] static extern bool AttachThreadInput(uint a, uint b, bool attach);
 static uint Pid(IntPtr h) { uint p; GetWindowThreadProcessId(h, out p); return p; }
 public static object Focus(int pid) {
  var originalForeground=GetForegroundWindow();
  var process = Process.GetProcessById(pid);
  var target = process.MainWindowHandle;
  if (target == IntPtr.Zero || Pid(target) != pid || !IsWindowVisible(target)) {
   target = IntPtr.Zero;
   EnumWindows((h,l) => {
    if (Pid(h) == pid && IsWindowVisible(h) && GetWindow(h,4) == IntPtr.Zero) { target=h; return false; }
    return true;
   }, IntPtr.Zero);
  }
  if (target == IntPtr.Zero) throw new Exception("NO_VISIBLE_WINDOW");
  var popup = GetLastActivePopup(target);
  if (popup != IntPtr.Zero && IsWindowVisible(popup) && Pid(popup) == pid) target=popup;
  if (IsIconic(target)) { ShowWindowAsync(target,9); Thread.Sleep(50); }
  if (GetForegroundWindow()!=originalForeground && Pid(GetForegroundWindow())!=pid) throw new Exception("FOREGROUND_CHANGED");
  bool directResult=SetForegroundWindow(target);
  var afterDirect=GetForegroundWindow();
  bool directVerified=Pid(afterDirect)==pid;
  bool foregroundAttached=false, targetAttached=false, detached=true;
  uint me=GetCurrentThreadId(), ignored;
  var observedForeground=originalForeground;
  uint foregroundThread=GetWindowThreadProcessId(observedForeground, out ignored);
  uint targetThread=GetWindowThreadProcessId(target, out ignored);
  bool keysReleased=true;
  for (int key=1;key<255;key++) if ((GetAsyncKeyState(key) & 0x8000)!=0) { keysReleased=false; break; }
  if (!directResult && !directVerified && keysReleased && GetForegroundWindow()==observedForeground) {
   try {
    if (GetForegroundWindow()!=observedForeground) throw new Exception("FOREGROUND_CHANGED");
    if (foregroundThread != 0 && foregroundThread != me)
     foregroundAttached=AttachThreadInput(me,foregroundThread,true);
    if (targetThread != 0 && targetThread != me && targetThread != foregroundThread)
     targetAttached=AttachThreadInput(me,targetThread,true);
    if (Pid(target)!=pid) throw new Exception("TARGET_CHANGED");
    if (GetForegroundWindow()!=observedForeground && Pid(GetForegroundWindow())!=pid) throw new Exception("FOREGROUND_CHANGED");
    BringWindowToTop(target);
    SetForegroundWindow(target);
   } finally {
    if (targetAttached) detached=AttachThreadInput(me,targetThread,false) && detached;
    if (foregroundAttached) detached=AttachThreadInput(me,foregroundThread,false) && detached;
   }
  }
  for (int i=0;i<10 && Pid(GetForegroundWindow())!=pid;i++) Thread.Sleep(25);
  uint actual=Pid(GetForegroundWindow());
  return new { targetPid=pid, foregroundPid=actual, verified=actual==pid, detached=detached };
 }
}
"@
$result = [CompanionWindowFocus]::Focus(${pid})
[Console]::Out.Write(($result | ConvertTo-Json -Compress))
`
}
