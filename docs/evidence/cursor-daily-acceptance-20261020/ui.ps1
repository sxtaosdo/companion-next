param([ValidateSet('Snapshot','Settings','InvokeSettings')][string]$Mode='Snapshot',[ValidateSet('Settings','Open Customize','Customize','Back','MCPs','MCP','Tools & MCP','Configure cocos-creator-cocos-214a2184','Configure cocos-creator-cook-cdc0709d','Reload','Done')][string]$ControlName='Settings',[ValidateSet('cocos-creator-cocos-214a2184','cocos-creator-cook-cdc0709d')][string]$TargetServer='cocos-creator-cocos-214a2184')
$ErrorActionPreference='Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Windows.Forms
$cursorPids=@(Get-CimInstance Win32_Process -Filter "Name='Cursor.exe'"|ForEach-Object {[int]$_.ProcessId})
$windows=[System.Windows.Automation.AutomationElement]::RootElement.FindAll([System.Windows.Automation.TreeScope]::Children,[System.Windows.Automation.Condition]::TrueCondition)
$targets=@($windows|Where-Object {$_.Current.ProcessId-in$cursorPids-and$_.Current.ControlType-eq[System.Windows.Automation.ControlType]::Window})
if($targets.Count-ne1){throw "Expected exactly one daily Cursor window; found $($targets.Count)"}
$window=$targets[0]
if($Mode-eq'InvokeSettings'){
 if($ControlName-in@('Reload','Done')){
  $guard=New-Object System.Windows.Automation.AndCondition((New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty,('Configure '+$TargetServer))),(New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty,[System.Windows.Automation.ControlType]::Text)))
  if(!$window.FindFirst([System.Windows.Automation.TreeScope]::Descendants,$guard)){throw 'Approved target dialog not present; no action sent'}
 }
 $condition=New-Object System.Windows.Automation.AndCondition((New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty,$ControlName)),(New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty,[System.Windows.Automation.ControlType]::Button)))
 $button=$window.FindFirst([System.Windows.Automation.TreeScope]::Descendants,$condition);$limit=[DateTime]::UtcNow.AddSeconds(5)
 while(!$button-and[DateTime]::UtcNow-lt$limit){[Threading.Thread]::Sleep(100);$button=$window.FindFirst([System.Windows.Automation.TreeScope]::Descendants,$condition)}
 if(!$button){throw 'Named Cursor control missing; no action sent'}
 $invoke=$null
 if($button.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern,[ref]$invoke)){([System.Windows.Automation.InvokePattern]$invoke).Invoke();"Invoked the verified daily Cursor control: $ControlName";exit}
 Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public static class CursorSettingsClick{[DllImport("user32.dll")]public static extern bool SetForegroundWindow(IntPtr h);[DllImport("user32.dll")]public static extern IntPtr GetForegroundWindow();[DllImport("user32.dll")]public static extern bool SetCursorPos(int x,int y);[DllImport("user32.dll")]public static extern void mouse_event(uint f,uint x,uint y,uint d,UIntPtr e);}'
 $handle=[IntPtr]$window.Current.NativeWindowHandle;[void][CursorSettingsClick]::SetForegroundWindow($handle);if([CursorSettingsClick]::GetForegroundWindow()-ne$handle){throw 'Cursor not foreground; no click sent'}
 $rect=$button.Current.BoundingRectangle;if($button.Current.IsOffscreen-or$rect.Width-lt1){throw 'Settings button not visible'}
 [void][CursorSettingsClick]::SetCursorPos([int]($rect.X+$rect.Width/2),[int]($rect.Y+$rect.Height/2));[CursorSettingsClick]::mouse_event(2,0,0,0,[UIntPtr]::Zero);[CursorSettingsClick]::mouse_event(4,0,0,0,[UIntPtr]::Zero)
 "Clicked the verified visible daily Cursor navigation button: $ControlName";exit
}
if($Mode-eq'Settings'){
 Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public static class CursorWindowFocus{[DllImport("user32.dll")]public static extern bool SetForegroundWindow(IntPtr h);[DllImport("user32.dll")]public static extern IntPtr GetForegroundWindow();}'
 $handle=[IntPtr]$window.Current.NativeWindowHandle
 [void][CursorWindowFocus]::SetForegroundWindow($handle)
 if([CursorWindowFocus]::GetForegroundWindow()-ne$handle){throw 'Cursor foreground focus not established; no keyboard action sent'}
 [System.Windows.Forms.SendKeys]::SendWait('^+j');'Sent normal Cursor Settings shortcut to the verified foreground Cursor window';exit
}
$controls=$window.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition)
$rows=@();$index=0
foreach($control in $controls){$index++;if($index-gt3000){break};$c=$control.Current;$type=$c.ControlType.ProgrammaticName;$name=$c.Name
 if($c.IsPassword){continue}
 if($type-match'Button|MenuItem|TabItem|Edit|Hyperlink|CheckBox|ToggleButton|ComboBox'-or($type-match'Text'-and$name-match'(?i)mcp|cocos|cook|settings|login|sign in|工具|连接|设置|登录|connected|connecting|disconnected|tools|failed|error|permission|managed|enabled|disabled|117|test|run')){
  $rows+=[pscustomobject]@{index=$index;type=$type;name=if($name.Length-gt160){$name.Substring(0,160)}else{$name};id=$c.AutomationId;enabled=$c.IsEnabled;offscreen=$c.IsOffscreen;x=[int]$c.BoundingRectangle.X;y=[int]$c.BoundingRectangle.Y;width=[int]$c.BoundingRectangle.Width;height=[int]$c.BoundingRectangle.Height}
 }
}
@{window=@{pid=$window.Current.ProcessId;name=$window.Current.Name};controlCount=$controls.Count;controls=$rows}|ConvertTo-Json -Depth 5 -Compress
