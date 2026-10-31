param([ValidateSet('start','recover','continue','inspect-continuation')][string]$Action)
$ErrorActionPreference='Stop'
$sid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$mutex=New-Object System.Threading.Mutex($false,('Local\CompanionDesktopStart-'+$sid))
$held=$false
try {
 try {$held=$mutex.WaitOne(0)} catch [System.Threading.AbandonedMutexException] {$held=$true}
 if(-not $held){throw 'START_RECOVERY_BUSY'}
 $node=(Get-Command node.exe -ErrorAction Stop).Source
 & $node (Join-Path $PSScriptRoot 'desktop-control.mjs') $Action '--mutex-held'
 exit $LASTEXITCODE
} finally {if($held){$mutex.ReleaseMutex()};$mutex.Dispose()}
