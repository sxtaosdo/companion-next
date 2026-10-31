$ErrorActionPreference='Stop'
$all=@(Get-CimInstance Win32_Process -ErrorAction Stop)
if($all.Count -lt 1){throw 'PROCESS_OBSERVATION_UNAVAILABLE'}
$os=Get-CimInstance Win32_OperatingSystem -ErrorAction Stop
$system=@($all | Where-Object ProcessId -eq 4)
if($system.Count -ne 1 -or -not $system[0].CreationDate){throw 'BOOT_OBSERVATION_UNAVAILABLE'}
$ancestry=New-Object 'System.Collections.Generic.HashSet[int]'
$next=$PID
while($next -gt 0 -and $ancestry.Add($next)){$p=@($all | Where-Object ProcessId -eq $next);if($p.Count -ne 1){break};$next=[int]$p[0].ParentProcessId}
$active=$false
foreach($p in $all){
 if($p.Name -notmatch '^(node|powershell|pwsh)\.exe$'){continue}
 if(-not $p.CommandLine){throw 'PROCESS_IDENTITY_UNAVAILABLE'}
 if($ancestry.Contains([int]$p.ProcessId)){if($p.CommandLine -match '(start-companion\.mjs|local-launcher\.cjs|local-start\.cjs|companion-daemon\.js|game-ops-admin.*bootstrap\.js)'){throw 'ACTIVE_START_ANCESTOR'};continue}
 if($p.CommandLine -match '(desktop-control\.mjs|start-companion\.mjs|local-launcher\.cjs|local-start\.cjs|companion-daemon\.js|game-ops-admin.*bootstrap\.js|creator-ai\.js[" ]+daemon[ ]+start)'){$active=$true}
}
$listeners=@(Get-NetTCPConnection -State Listen -ErrorAction Stop)
$absent=@($listeners | Where-Object {$_.LocalPort -in @(32180,18001)}).Count -eq 0
$machine=(Get-ItemProperty -LiteralPath 'HKLM:\SOFTWARE\Microsoft\Cryptography' -Name MachineGuid -ErrorAction Stop).MachineGuid
$sha=[System.Security.Cryptography.SHA256]::Create()
try {$machineHash=([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($machine)))).Replace('-','').ToLowerInvariant()} finally {$sha.Dispose()}
@{schemaVersion='desktop-start-observation-v1';complete=$true;active=$active;portsAbsent=$absent;machine=$machineHash;bootTime=([DateTimeOffset]$os.LastBootUpTime).ToUnixTimeMilliseconds();bootIdentity=$system[0].CreationDate.ToUniversalTime().ToString('O')} | ConvertTo-Json -Compress
