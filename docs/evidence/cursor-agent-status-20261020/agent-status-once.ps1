param([ValidateSet('Prepare','Send','Observe')][string]$Mode='Observe')
$ErrorActionPreference='Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Windows.Forms
$dir=Split-Path $PSCommandPath
$marker=Join-Path $dir 'agent-status-send-issued.json'
$prompt='One-shot MCP connection acceptance. Make exactly ONE tool call: project_get_status with empty arguments {} on the existing MCP server cocos-creator-cocos-214a2184 (project 214a2184be887306). Then report the actual tool result and stop. Do not call any other tool or any other server. Do not read or attach source files. Do not write code, modify files/configuration, run shell/terminal commands, start or stop Creator, models, or any service. Do not create a plan, background task, automatic continuation, or retries. If this exact tool is unavailable or any extra permission, login, extension, subscription or payment is required, stop and report it without taking further action.'
$pids=@(Get-CimInstance Win32_Process -Filter "Name='Cursor.exe'"|ForEach-Object {[int]$_.ProcessId})
$wins=@([System.Windows.Automation.AutomationElement]::RootElement.FindAll([System.Windows.Automation.TreeScope]::Children,[System.Windows.Automation.Condition]::TrueCondition)|Where-Object {$_.Current.ProcessId-in$pids-and$_.Current.ControlType-eq[System.Windows.Automation.ControlType]::Window})
if($wins.Count-ne1){throw 'Expected one existing daily Cursor window'}
$w=$wins[0]
$edits=@($w.FindAll([System.Windows.Automation.TreeScope]::Descendants,(New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty,[System.Windows.Automation.ControlType]::Edit)))|Where-Object {!$_.Current.IsOffscreen-and!$_.Current.IsPassword})
if($Mode-eq'Observe'){
 $tabs=@($w.FindAll([System.Windows.Automation.TreeScope]::Descendants,(New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty,[System.Windows.Automation.ControlType]::TabItem)))|Where-Object {$_.Current.Name-like'*Chat Editors*'})
 if(!$tabs.Count){throw 'No chat editor'}
 $parent=[System.Windows.Automation.TreeWalker]::ControlViewWalker.GetParent($tabs[-1]);1..2|ForEach-Object {$parent=[System.Windows.Automation.TreeWalker]::ControlViewWalker.GetParent($parent)}
 $rows=@($parent.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition)|Where-Object {!$_.Current.IsPassword}|ForEach-Object {[pscustomobject]@{type=$_.Current.ControlType.ProgrammaticName;name=$_.Current.Name;id=$_.Current.AutomationId;enabled=$_.Current.IsEnabled}})
 $proof=@{atUtc=[DateTime]::UtcNow.ToString('o');pid=$w.Current.ProcessId;sendMarkerExists=(Test-Path -LiteralPath $marker);controls=$rows}
 $proof|ConvertTo-Json -Depth 5|Set-Content -LiteralPath (Join-Path $dir 'agent-status-observed.json') -Encoding utf8
 $proof|ConvertTo-Json -Depth 5 -Compress;exit
}
if(Test-Path -LiteralPath $marker){throw 'Send already issued or uncertain; no repeat permitted'}
if($edits.Count-ne1){throw 'Expected one visible empty Agent composer'}
$e=$edits[0];$v=[System.Windows.Automation.ValuePattern]$e.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
if($Mode-eq'Prepare'){
 if($v.Current.Value.Trim().Length-ne0-and!$v.Current.Value.StartsWith('One-shotMCPconnectionacceptance')){throw 'Composer not empty or not our unsent draft; no overwrite'}
 Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public static class CursorDraftFocus{[DllImport("user32.dll")]public static extern bool SetForegroundWindow(IntPtr h);[DllImport("user32.dll")]public static extern IntPtr GetForegroundWindow();}'
 $h=[IntPtr]$w.Current.NativeWindowHandle
 $e.SetFocus()
 [void][CursorDraftFocus]::SetForegroundWindow($h)
 if([CursorDraftFocus]::GetForegroundWindow()-ne$h){
  Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public static class CursorActivate{[DllImport("kernel32.dll")]public static extern uint GetCurrentThreadId();[DllImport("user32.dll")]public static extern uint GetWindowThreadProcessId(IntPtr h,IntPtr p);[DllImport("user32.dll")]public static extern bool AttachThreadInput(uint a,uint b,bool x);[DllImport("user32.dll")]public static extern bool BringWindowToTop(IntPtr h);}'
  $self=[CursorActivate]::GetCurrentThreadId();$front=[CursorActivate]::GetWindowThreadProcessId([CursorDraftFocus]::GetForegroundWindow(),[IntPtr]::Zero)
  $attached=[CursorActivate]::AttachThreadInput($self,$front,$true)
  try{[void][CursorActivate]::BringWindowToTop($h);[void][CursorDraftFocus]::SetForegroundWindow($h)}finally{if($attached){[void][CursorActivate]::AttachThreadInput($self,$front,$false)}}
 }
 if([CursorDraftFocus]::GetForegroundWindow()-ne$h){
  Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public static class CursorDraftClick{[StructLayout(LayoutKind.Sequential)] public struct POINT{public int X;public int Y;}[DllImport("user32.dll")]public static extern IntPtr WindowFromPoint(POINT p);[DllImport("user32.dll")]public static extern IntPtr GetAncestor(IntPtr h,uint f);[DllImport("user32.dll")]public static extern bool SetCursorPos(int x,int y);[DllImport("user32.dll")]public static extern void mouse_event(uint f,uint x,uint y,uint d,UIntPtr e);}'
  $r=$e.Current.BoundingRectangle;$point=[CursorDraftClick+POINT]::new();$point.X=[int]($r.X+$r.Width/2);$point.Y=[int]($r.Y+$r.Height/2)
  if($e.Current.IsOffscreen-or$r.Width-lt1-or[CursorDraftClick]::GetAncestor([CursorDraftClick]::WindowFromPoint($point),2)-ne$h){throw 'Verified composer covered; no click or typing'}
  [void][CursorDraftClick]::SetCursorPos($point.X,$point.Y);[CursorDraftClick]::mouse_event(2,0,0,0,[UIntPtr]::Zero);[CursorDraftClick]::mouse_event(4,0,0,0,[UIntPtr]::Zero)
  if([CursorDraftFocus]::GetForegroundWindow()-ne$h){throw 'Cursor not foreground after verified click; no typing'}
 }
 $e.SetFocus()
 if(!$e.Current.HasKeyboardFocus){throw 'Composer not focused; no typing'}
 $clipboardBefore=[System.Windows.Forms.Clipboard]::GetDataObject()
 try{
  [System.Windows.Forms.Clipboard]::SetText($prompt)
  [System.Windows.Forms.SendKeys]::SendWait('^a')
  [System.Windows.Forms.SendKeys]::SendWait('^v')
  [Threading.Thread]::Sleep(500)
 }finally{if($clipboardBefore){[System.Windows.Forms.Clipboard]::SetDataObject($clipboardBefore,$true)}else{[System.Windows.Forms.Clipboard]::Clear()}}
 if($v.Current.Value-ne$prompt){throw 'Prepared prompt not exact'}
 [IO.File]::WriteAllText((Join-Path $dir 'agent-status-prompt.txt'),$prompt,[Text.UTF8Encoding]::new($false))
 'Prepared exact bounded request; NOT sent';exit
}
if($v.Current.Value-ne$prompt){throw 'Composer differs from approved bounded request; no send'}
Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public static class CursorAgentFocus{[DllImport("user32.dll")]public static extern bool SetForegroundWindow(IntPtr h);[DllImport("user32.dll")]public static extern IntPtr GetForegroundWindow();}'
$handle=[IntPtr]$w.Current.NativeWindowHandle
[void][CursorAgentFocus]::SetForegroundWindow($handle)
if([CursorAgentFocus]::GetForegroundWindow()-ne$handle){throw 'Cursor not foreground; no send'}
$e.SetFocus()
if(!$e.Current.HasKeyboardFocus){throw 'Composer not focused; no send'}
$receipt=@{atUtc=[DateTime]::UtcNow.ToString('o');pid=$w.Current.ProcessId;target='cocos-creator-cocos-214a2184';tool='project_get_status';arguments=@{};requestedCalls=1;sendAttempts=1;state='issued-or-uncertain'}|ConvertTo-Json
$stream=[IO.File]::Open($marker,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
try{$bytes=[Text.Encoding]::UTF8.GetBytes($receipt);$stream.Write($bytes,0,$bytes.Length);$stream.Flush()}finally{$stream.Dispose()}
[System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
'Issued Enter once to exact verified composer; inspect existing round, never resend'
