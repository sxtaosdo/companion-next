$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$proof=[ordered]@{atUtc=[DateTime]::UtcNow.ToString('o');clipboardEmpty=$null;clipboardContentRead=$false;inputContentRead=$false;inputCandidates=@();mutations=0;blocked=@()}
try {
 $data=[System.Windows.Forms.Clipboard]::GetDataObject()
 $proof.clipboardEmpty=($null -eq $data -or $data.GetFormats($false).Length -eq 0)
 if(-not $proof.clipboardEmpty){$proof.blocked+= 'CLIPBOARD_NO_LONGER_EMPTY'}
 $apps=@(Get-Process -Name Codex -ErrorAction SilentlyContinue | Where-Object {$_.MainWindowHandle -ne 0})
 $proof.windowCount=$apps.Count
 foreach($app in $apps){
  $window=[System.Windows.Automation.AutomationElement]::FromHandle($app.MainWindowHandle)
  $condition=New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty,[System.Windows.Automation.ControlType]::Edit)
  $edits=$window.FindAll([System.Windows.Automation.TreeScope]::Descendants,$condition)
  foreach($edit in $edits){
   $current=$edit.Current
   if($current.IsOffscreen){continue}
   $row=[ordered]@{pid=$app.Id;windowHandle=$app.MainWindowHandle.ToInt64();automationId=$current.AutomationId;className=$current.ClassName;enabled=$current.IsEnabled;canVerifyEmpty=$false;empty=$null}
   $pattern=$null
   if($edit.TryGetCurrentPattern([System.Windows.Automation.TextPattern]::Pattern,[ref]$pattern)){
    $range=$pattern.DocumentRange
    $row.canVerifyEmpty=$true
    $row.empty=($range.CompareEndpoints([System.Windows.Automation.TextPatternRangeEndpoint]::Start,$range,[System.Windows.Automation.TextPatternRangeEndpoint]::End) -eq 0)
   }
   $proof.inputCandidates+=,$row
  }
 }
 if($proof.inputCandidates.Count -ne 1){$proof.blocked+='TARGET_INPUT_NOT_UNIQUE'}
 elseif(-not $proof.inputCandidates[0].canVerifyEmpty){$proof.blocked+='TARGET_EMPTY_NOT_PROVABLE_WITHOUT_READING'}
 elseif(-not $proof.inputCandidates[0].empty){$proof.blocked+='TARGET_INPUT_NO_LONGER_EMPTY'}
}catch{$proof.blocked+='PREFLIGHT_INSPECTION_FAILED';$proof.errorType=$_.Exception.GetType().FullName}
$proof | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath 'C:/Users/33272/AppData/Local/Temp/companion-safe-parity-20261019/codex-empty-preflight.json' -Encoding UTF8
$proof | ConvertTo-Json -Depth 6
