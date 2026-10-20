param([ValidateSet('cocos-creator-cocos-214a2184','cocos-creator-cook-cdc0709d')][string]$Target)
$ErrorActionPreference='Stop'
$work='C:/Users/33272/AppData/Local/Temp/companion-cursor-daily-acceptance-20261020'
if(Test-Path -LiteralPath "$work/$Target-reload-issued.json"){throw 'Reload already issued; inspect receipt and logs instead of repeating'}
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
function Window {
 $pids=@(Get-CimInstance Win32_Process -Filter "Name='Cursor.exe'"|ForEach-Object {[int]$_.ProcessId})
 $roots=[System.Windows.Automation.AutomationElement]::RootElement.FindAll([System.Windows.Automation.TreeScope]::Children,[System.Windows.Automation.Condition]::TrueCondition)
 $rows=@($roots|Where-Object {$_.Current.ProcessId-in$pids-and$_.Current.ControlType.ProgrammaticName-eq'ControlType.Window'})
 if($rows.Count-ne1){throw 'Ambiguous daily Cursor window'};return $rows[0]
}
function Snapshot($window) {
 $controls=$window.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition)
 $texts=@();$buttons=@();foreach($c in $controls){if($c.Current.ControlType.ProgrammaticName-eq'ControlType.Text'){$texts+=$c.Current.Name};if($c.Current.ControlType.ProgrammaticName-eq'ControlType.Button'){$buttons+=$c}}
 $title='Configure '+$Target;$hasTitle=$texts-contains$title
 $tools=@();foreach($b in $buttons){if($b.Current.Name-match('^Disable (.+) for '+[Regex]::Escape($Target)+'$')){$tools+=$Matches[1]}}
 return @{atUtc=[DateTime]::UtcNow.ToString('o');pid=$window.Current.ProcessId;target=$Target;dialogTitleVerified=$hasTitle;connected=($texts-contains'Connected');toolCount=$tools.Count;readonlyStatusListed=($tools-contains'project_get_status');sourcePresent=(@($buttons|Where-Object {$_.Current.Name-eq'~/.cursor/mcp.json'}).Count-eq1);visibleActions=@($buttons|Where-Object {!$_.Current.IsOffscreen-and$_.Current.IsEnabled-and$_.Current.Name-in@('Reload','Done','Run','Test','Invoke','Call Tool')}|ForEach-Object {$_.Current.Name});buttons=$buttons}
}
function Save($name,$value){$copy=@{};foreach($k in $value.Keys){if($k-ne'buttons'){$copy[$k]=$value[$k]}};$json=$copy|ConvertTo-Json -Depth 4;$stream=[IO.File]::Open("$work/$name",[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read);try{$bytes=[Text.Encoding]::UTF8.GetBytes($json);$stream.Write($bytes,0,$bytes.Length);$stream.Flush($true)}finally{$stream.Dispose()}}
$window=Window
& "$work/ui.ps1" -Mode InvokeSettings -ControlName ('Configure '+$Target)
$limit=[DateTime]::UtcNow.AddSeconds(5);do{$before=Snapshot $window;if($before.dialogTitleVerified){break};[Threading.Thread]::Sleep(100)}while([DateTime]::UtcNow-lt$limit)
if(!$before.dialogTitleVerified){throw 'Target dialog did not open; no reload sent'}
Save "$Target-ui-before.json" $before
if(!$before.sourcePresent){throw 'Original user source not shown; no reload sent'}
$reload=@($before.buttons|Where-Object {$_.Current.Name-eq'Reload'-and$_.Current.IsEnabled-and!$_.Current.IsOffscreen});if($reload.Count-ne1){throw 'Unique target Reload unavailable; no reload sent'}
$invoke=$reload[0].GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
Save "$Target-reload-issued.json" @{atUtc=[DateTime]::UtcNow.ToString('o');pid=$window.Current.ProcessId;target=$Target;onlyTargetDialogVerified=$true;allServerAction=$false;toolPermissionChanges=0}
([System.Windows.Automation.InvokePattern]$invoke).Invoke()
$limit=[DateTime]::UtcNow.AddSeconds(10);do{[Threading.Thread]::Sleep(200);$after=Snapshot $window;if($after.dialogTitleVerified-and$after.connected-and$after.toolCount-gt0){break}}while([DateTime]::UtcNow-lt$limit)
Save "$Target-ui-after.json" $after
$summary=@{target=$Target;connectedAfter=$after.connected;dialogAfter=$after.dialogTitleVerified;toolCount=$after.toolCount;readonlyStatusListed=$after.readonlyStatusListed;sourcePresent=$after.sourcePresent;visibleActions=$after.visibleActions;reloadInvocations=1;toolPermissionChanges=0}
$summary|ConvertTo-Json -Depth 3 -Compress
if(!$after.dialogTitleVerified-or!$after.connected){throw 'Target reload outcome requires log inspection; do not repeat'}
$done=@($after.buttons|Where-Object {$_.Current.Name-eq'Done'-and$_.Current.IsEnabled});if($done.Count-eq1){$pattern=$done[0].GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern);([System.Windows.Automation.InvokePattern]$pattern).Invoke()}
