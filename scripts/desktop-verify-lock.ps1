param([int]$OwnerPid)
$ErrorActionPreference='Stop'
$p=Get-CimInstance Win32_Process -Filter "ProcessId=$OwnerPid" -ErrorAction Stop
$expected=Join-Path $PSScriptRoot 'desktop-exclusive.ps1'
if(-not $p -or $p.Name -ine 'powershell.exe' -or $p.CommandLine -notlike ('*'+$expected+'*')){throw 'MUTEX_OWNER_UNVERIFIED'}
$sid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$mutex=[System.Threading.Mutex]::OpenExisting('Local\CompanionDesktopStart-'+$sid)
$acquired=$false
try {try {$acquired=$mutex.WaitOne(0)}catch [System.Threading.AbandonedMutexException]{$acquired=$true};if($acquired){throw 'MUTEX_NOT_HELD'}}finally{if($acquired){$mutex.ReleaseMutex()};$mutex.Dispose()}
