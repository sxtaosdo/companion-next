param([ValidateSet('cocos-creator-cocos-214a2184','cocos-creator-cook-cdc0709d')][string]$Target,[ValidateSet('before','after')][string]$Stage)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$pids=@(Get-CimInstance Win32_Process -Filter "Name='Cursor.exe'"|ForEach-Object {[int]$_.ProcessId})
$roots=[System.Windows.Automation.AutomationElement]::RootElement.FindAll([System.Windows.Automation.TreeScope]::Children,[System.Windows.Automation.Condition]::TrueCondition)
$windows=@($roots|Where-Object {$_.Current.ProcessId-in$pids-and$_.Current.ControlType-eq[System.Windows.Automation.ControlType]::Window});if($windows.Count-ne1){throw 'Ambiguous daily Cursor window'}
$window=$windows[0];$pattern=$window.GetCurrentPattern([System.Windows.Automation.WindowPattern]::Pattern);if($pattern.Current.WindowVisualState-eq[System.Windows.Automation.WindowVisualState]::Minimized){throw 'Daily Cursor minimized; do not accept stale accessibility status'}
$controls=$window.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition)
$texts=@($controls|Where-Object {$_.Current.ControlType-eq[System.Windows.Automation.ControlType]::Text}|ForEach-Object {$_.Current.Name})
if(('Configure '+$Target)-notin$texts){throw 'Wrong target dialog'}
$buttons=@($controls|Where-Object {$_.Current.ControlType-eq[System.Windows.Automation.ControlType]::Button})
$toolRegex='^Disable (.+) for '+[Regex]::Escape($Target)+'$'
$toolNames=@($buttons|ForEach-Object {if($_.Current.Name-match$toolRegex){$Matches[1]}})
$sourceEnabled=@($buttons|Where-Object {$_.Current.Name-eq('Disable '+$Target+' for User source')}).Count-eq1
$proof=[ordered]@{atUtc=[DateTime]::UtcNow.ToString('o');actualDailyCursorPid=$window.Current.ProcessId;windowName=$window.Current.Name;target=$Target;stage=$Stage;dialogTitleVerified=$true;connected=('Connected'-in$texts);originalSourceButtonPresent=(@($buttons|Where-Object {$_.Current.Name-eq'~/.cursor/mcp.json'}).Count-eq1);existingSourceEnabled=$sourceEnabled;listedToolCount=$toolNames.Count;readonlyStatusToolListed=('project_get_status'-in$toolNames);visibleActions=@($buttons|Where-Object {!$_.Current.IsOffscreen-and$_.Current.IsEnabled-and$_.Current.Name-in@('Reload','Done','Run','Test','Invoke','Call Tool')}|ForEach-Object {$_.Current.Name});permissionOrToolTogglesChanged=$false;chatOrInferenceSubmitted=$false;otherServerActions=0}
$path='C:/Users/33272/AppData/Local/Temp/companion-cursor-daily-acceptance-20261020/'+$Target+'-'+$Stage+'.json'
if(Test-Path -LiteralPath $path){throw 'Receipt already exists; inspect rather than overwrite'}
$proof|ConvertTo-Json -Depth 4|Set-Content -LiteralPath $path -Encoding utf8
$proof|ConvertTo-Json -Depth 4 -Compress
