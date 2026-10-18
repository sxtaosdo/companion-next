import { windowsFocusScript } from '../host/windows-focus.ts'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {writeFile} from 'node:fs/promises'
import {pathToFileURL} from 'node:url'
import assert from 'node:assert/strict'
const exec=promisify(execFile),pid=process.pid
const replacements={
EnumWindows:'static bool EnumWindows(WindowCallback c, IntPtr p) { return c(new IntPtr(10003),p); }',
GetWindow:'static IntPtr GetWindow(IntPtr h,uint c) { return IntPtr.Zero; }',
GetForegroundWindow:'static IntPtr GetForegroundWindow() { return Foreground; }',
GetWindowThreadProcessId:'static uint GetWindowThreadProcessId(IntPtr h,out uint p) { p=h.ToInt64()==10003 ? '+pid+'u : '+(pid+1)+'u; return (uint)h.ToInt64(); }',
GetCurrentThreadId:'static uint GetCurrentThreadId() { return 30000; }',
IsWindowVisible:'static bool IsWindowVisible(IntPtr h) { return true; }',
IsIconic:'static bool IsIconic(IntPtr h) { return Scenario==2; }',
ShowWindowAsync:'static bool ShowWindowAsync(IntPtr h,int c) { Foreground=new IntPtr(10002); return true; }',
GetLastActivePopup:'static IntPtr GetLastActivePopup(IntPtr h) { return h; }',
SetForegroundWindow:'static bool SetForegroundWindow(IntPtr h) { Calls++; if(Scenario==1 && Calls==1) { Foreground=new IntPtr(10002); return true; } if(Calls==1 && (Scenario==3||Scenario==4))return false; Foreground=h; return true; }',
BringWindowToTop:'static bool BringWindowToTop(IntPtr h) { return true; }',
GetAsyncKeyState:'static short GetAsyncKeyState(int key) { return 0; }',
AttachThreadInput:'static bool AttachThreadInput(uint a,uint b,bool on) { if(on){Attached++;if(Scenario==4)Foreground=new IntPtr(10002);}else Detached++;return true; }',
}
async function evaluate(script,scenario){
 let s=script.replace('public class CompanionWindowFocus {','public class CompanionWindowFocus {\n public static IntPtr Foreground=new IntPtr(10001);\n public static int Scenario='+scenario+',Calls=0,Attached=0,Detached=0;')
 s=s.split('\n').map(line=>{
  if(!line.includes('[DllImport('))return line
  const m=line.match(/extern\s+\w+\s+(\w+)\(/)
  assert(m&&replacements[m[1]],'unmapped native declaration '+line)
  return replacements[m[1]]
 }).join('\n')
 assert(!s.includes('[DllImport('),'All Win32 imports replaced: no desktop activation')
 s=s.slice(0,s.indexOf('$result ='))+`
try { $r=[CompanionWindowFocus]::Focus(${pid}); $result=@{failed=$false;receipt=$r} }
catch { $result=@{failed=$true;reason=$_.Exception.GetType().Name} }
$result.calls=[CompanionWindowFocus]::Calls
$result.attached=[CompanionWindowFocus]::Attached
$result.detached=[CompanionWindowFocus]::Detached
[Console]::Out.Write(($result|ConvertTo-Json -Depth 5 -Compress))
`
 const r=await exec('powershell.exe',['-NoProfile','-NonInteractive','-Command',s],{windowsHide:true,timeout:10000})
 return JSON.parse(r.stdout)
}
const results={}
if(process.argv[2]){
 const old=await import(pathToFileURL(process.argv[2]).href)
 results.before=await evaluate(old.windowsFocusScript(pid),1)
 assert.equal(results.before.receipt.verified,true,'reproduce previous re-grab')
}
results.after=await evaluate(windowsFocusScript(pid),1)
assert.equal(results.after.receipt.verified,false);assert.equal(results.after.attached,0)
results.restoreRace=await evaluate(windowsFocusScript(pid),2)
assert.equal(results.restoreRace.failed,true);assert.equal(results.restoreRace.calls,0)
results.fallback=await evaluate(windowsFocusScript(pid),3)
assert.equal(results.fallback.receipt.verified,true);assert.equal(results.fallback.attached,2);assert.equal(results.fallback.detached,2)
results.attachRace=await evaluate(windowsFocusScript(pid),4)
assert.equal(results.attachRace.failed,true);assert.equal(results.attachRace.detached,results.attachRace.attached);assert.equal(results.attachRace.calls,1)
results.coverage='Actual C# control flow compiled with every Win32 import stubbed; no desktop activation. Actual desktop helper acceptance separate.'
if(process.argv[3])await writeFile(process.argv[3],JSON.stringify(results,null,2)+'\n')
console.log(JSON.stringify(results))
