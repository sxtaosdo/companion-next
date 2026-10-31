# Parse exactly one explicitly marked business result; gate banners are not results.
function Read-StartupDiagnosticHint([string]$fencePath) {
 $fallback='启动结果待核对；未自动重试。请使用只读诊断。'
 try {
  $f=Get-Item -LiteralPath $fencePath -ErrorAction Stop
  if($f.Length -gt 4096 -or ($f.Attributes -band [IO.FileAttributes]::ReparsePoint)){return $fallback}
  $pending=ConvertFrom-Json ([IO.File]::ReadAllText($f.FullName))
  if($pending.schemaVersion -cne 'desktop-start-v1' -or $pending.id -cnotmatch '^[a-f0-9-]{36}$'){return $fallback}
  $file=Get-Item -LiteralPath (Join-Path $f.DirectoryName ('startup-'+$pending.id+'.diagnostic.json')) -ErrorAction Stop
  if($file.Length -gt 8192 -or ($file.Attributes -band [IO.FileAttributes]::ReparsePoint)){return $fallback}
  $d=ConvertFrom-Json ([IO.File]::ReadAllText($file.FullName))
  if($d.schemaVersion -cne 'desktop-start-diagnostic-v1' -or $d.id -cne $pending.id -or $d.state -cne 'unknown'){return $fallback}
  switch -CaseSensitive ($d.reason) {
   'ACCOUNT_PROVIDER_UNCONFIRMED' {return '认证服务尚未确认就绪；启动结果待核对，未自动重试。'}
   'HOST_START_REQUIRES_NODE_25_ABI_141' {return '本机运行环境版本不符合要求；请核对 Node 25 安装。'}
   'DAEMON_READINESS_UNCONFIRMED' {return '后台尚未确认就绪；请使用只读诊断，未自动重试。'}
   'LOCAL_CONFIG_MISSING' {return '启动配置文件缺失；请恢复本机已批准的配置。'}
   'OFFICIAL_START_PORT_OCCUPIED' {return '后台端口已被占用；未结束其他进程，请核对端口。'}
   default {return $fallback}
  }
 } catch {return $fallback}
}
function Read-DesktopResult([string]$text, [string]$action) {
 if ($action -cnotin @('start','diagnose','recover','continue','inspect-continuation') -or $null -eq $text -or $text.Length -gt 131072) { return $null }
 $matches = @($text -split "`r?`n" | Where-Object { $_.StartsWith('COMPANION_DESKTOP_RESULT_V1:',[System.StringComparison]::Ordinal) })
 if ($matches.Count -ne 1) { return $null }
 $raw = $matches[0].Substring('COMPANION_DESKTOP_RESULT_V1:'.Length)
 if ($action -ceq 'inspect-continuation') { if ($raw -cmatch '^\{"schemaVersion":"companion-desktop-result-v1","action":"inspect-continuation","state":"(ready|unknown|retry-available)"\}$') { return (ConvertFrom-Json $raw) }; return $null }
 if ($action -ceq 'continue') { if ($raw -cmatch '^\{"schemaVersion":"companion-desktop-result-v1","action":"continue","state":"(ready|unknown)"\}$') { return (ConvertFrom-Json $raw) }; return $null }
 if ($action -ceq 'recover') { if ($raw -cmatch '^\{"schemaVersion":"companion-desktop-result-v1","action":"recover","state":"(recovered|unknown)"\}$') { return (ConvertFrom-Json $raw) }; return $null }
 # The producer emits a flat canonical object in this order. Reject duplicate
 # keys, escapes, extra fields and ambiguous spellings before JSON parsing.
 $pattern = '^\{"schemaVersion":"companion-desktop-result-v1","action":"(start|diagnose)","state":"(ready|unknown)"(,"ui":"(missing|invalid|unverified)")?(,"reason":"(UI_FILES_MISSING|UI_FILES_INVALID|UI_HTTP_UNVERIFIED|UI_INSPECTION_UNAVAILABLE|NOT_READY|DAEMON_AUTH_REJECTED|DAEMON_IDENTITY_UNVERIFIED|DAEMON_START_IDENTITY_CHANGED|DAEMON_NOT_READY|UNEXPECTED_DAEMON_URL|DAEMON_READINESS_UNCONFIRMED|DAEMON_DISCOVERY_UNCONFIRMED|DIAGNOSIS_UNAVAILABLE)")?(,"start":"confirmed")?\}$'
 if ($raw -cnotmatch $pattern) { return $null }
 try { $value = ConvertFrom-Json -InputObject $raw -ErrorAction Stop } catch { return $null }
 if ($null -eq $value -or $value -is [array] -or $value -isnot [System.Management.Automation.PSCustomObject]) { return $null }
 $names = @($value.PSObject.Properties.Name)
 if (@($names | Where-Object { $_ -cnotin @('schemaVersion','action','state','ui','reason','start') }).Count -ne 0) { return $null }
 if ($value.schemaVersion -cne 'companion-desktop-result-v1' -or $value.action -cne $action -or $value.state -cnotin @('ready','unknown')) { return $null }
 if ($names -ccontains 'start' -and ($value.start -cne 'confirmed' -or $action -cne 'start')) { return $null }
 if ($value.state -ceq 'ready') {
  if ($action -ceq 'start' -and $value.start -cne 'confirmed') { return $null }
  if ($value.ui -cnotin @('missing','invalid','unverified')) { return $null }
  $expected = switch ($value.ui) { 'missing' { @('UI_FILES_MISSING') } 'invalid' { @('UI_FILES_INVALID') } 'unverified' { @('UI_HTTP_UNVERIFIED','UI_INSPECTION_UNAVAILABLE') } }
  if ($value.reason -cnotin $expected) { return $null }
 } else {
  if ($names -ccontains 'ui') { return $null }
  if ($names -ccontains 'reason' -and $value.reason -cnotin @('NOT_READY','DAEMON_AUTH_REJECTED','DAEMON_IDENTITY_UNVERIFIED','DAEMON_START_IDENTITY_CHANGED','DAEMON_NOT_READY','UNEXPECTED_DAEMON_URL','DAEMON_READINESS_UNCONFIRMED','DAEMON_DISCOVERY_UNCONFIRMED','DIAGNOSIS_UNAVAILABLE')) { return $null }
 }
 return $value
}
