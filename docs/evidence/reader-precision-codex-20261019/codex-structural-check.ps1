param([ValidateSet('Before','After','Cleanup')][string]$Phase='Before',[string]$Marker='')
$ErrorActionPreference='Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Windows.Forms
$proof=[ordered]@{atUtc=[DateTime]::UtcNow.ToString('o');phase=$Phase;inputTextRetrieved=$false;inputChanged=$false;clipboardChanged=$false;sendInvoked=$false}
$apps=@(Get-Process -Name ChatGPT -ErrorAction SilentlyContinue | Where-Object {$_.MainWindowHandle -ne 0 -and $_.Path -like '*OpenAI.Codex*'})
if($apps.Count -ne 1){throw 'CODEX_WINDOW_NOT_UNIQUE'}
$window=[System.Windows.Automation.AutomationElement]::FromHandle($apps[0].MainWindowHandle)
$condition=New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty,[System.Windows.Automation.ControlType]::Edit)
$edits=@($window.FindAll([System.Windows.Automation.TreeScope]::Descendants,$condition) | Where-Object {-not $_.Current.IsOffscreen -and $_.Current.IsEnabled -and $_.Current.ClassName -like 'ProseMirror*'})
if($edits.Count -ne 1){throw 'CODEX_EDITOR_NOT_UNIQUE'}
$editor=$edits[0];$walker=[System.Windows.Automation.TreeWalker]::RawViewWalker
$first=$walker.GetFirstChild($editor)
$blank=($null -ne $first -and $first.Current.ClassName -eq 'placeholder' -and $null -eq $walker.GetNextSibling($first))
$proof.window=$apps[0].MainWindowHandle.ToInt64();$proof.pid=$apps[0].Id;$proof.uniqueVisibleEditor=$true;$proof.emptyDocumentDecoration=$blank
if($Phase -eq 'Before'){
 $data=[System.Windows.Forms.Clipboard]::GetDataObject()
 $proof.clipboardEmpty=($null -eq $data -or $data.GetFormats($false).Length -eq 0)
 $proof.ok=$blank -and $proof.clipboardEmpty
}else{
 if($Marker -notmatch '^COMPANION_PREFILL_ONLY_[A-Za-z0-9_]{12,80}$'){throw 'MARKER_FORMAT_INVALID'}
 $text=[System.Windows.Automation.TextPattern]$editor.GetCurrentPattern([System.Windows.Automation.TextPattern]::Pattern)
 $range=$text.DocumentRange;$match=$range.FindText($Marker,$false,$false)
 $exact=($null -ne $match -and $range.CompareEndpoints([System.Windows.Automation.Text.TextPatternRangeEndpoint]::Start,$match,[System.Windows.Automation.Text.TextPatternRangeEndpoint]::Start) -eq 0 -and $range.CompareEndpoints([System.Windows.Automation.Text.TextPatternRangeEndpoint]::End,$match,[System.Windows.Automation.Text.TextPatternRangeEndpoint]::End) -eq 0)
 $proof.exactMarkerInTarget=$exact
 if($Phase -eq 'Cleanup' -and $exact){
  $editor.SetFocus()
  if(-not $editor.Current.HasKeyboardFocus){throw 'TARGET_FOCUS_NOT_CONFIRMED'}
  $match.Select()
  if(-not $editor.Current.HasKeyboardFocus){throw 'TARGET_FOCUS_CHANGED'}
  [System.Windows.Forms.SendKeys]::SendWait('{BACKSPACE}')
  $proof.inputChanged=$true
  Start-Sleep -Milliseconds 100
  $afterFirst=$walker.GetFirstChild($editor)
  $proof.emptyAfterInputEvent=($null -ne $afterFirst -and $afterFirst.Current.ClassName -eq 'placeholder' -and $null -eq $walker.GetNextSibling($afterFirst))
 }
 # Read only for an exact comparison against the known test payload after our own write; never output or archive clipboard text.
 $clipboardMatches=[System.Windows.Forms.Clipboard]::ContainsText() -and [string]::Equals([System.Windows.Forms.Clipboard]::GetText(),$Marker,[StringComparison]::Ordinal)
 $proof.clipboardMatchesMarker=$clipboardMatches
 if($Phase -eq 'Cleanup' -and $clipboardMatches){[System.Windows.Forms.Clipboard]::Clear();$proof.clipboardChanged=$true}
 $proof.ok=$exact
 if($Phase -eq 'Cleanup'){$data=[System.Windows.Forms.Clipboard]::GetDataObject();$proof.clipboardEmptyAfter=($null -eq $data -or $data.GetFormats($false).Length -eq 0);$proof.ok=$exact -and $proof.emptyAfterInputEvent -and $proof.clipboardEmptyAfter}
}
$proof | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath "C:/Users/33272/AppData/Local/Temp/companion-safe-parity-20261019/codex-structural-$Phase.json" -Encoding UTF8
$proof | ConvertTo-Json -Depth 5
if(-not $proof.ok){exit 2}
