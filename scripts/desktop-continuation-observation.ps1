$ErrorActionPreference='Stop'
$account=(& (Join-Path $PSScriptRoot 'desktop-account-observation.ps1')) | ConvertFrom-Json
$all=@(Get-CimInstance Win32_Process -ErrorAction Stop)
if($all.Count -lt 1){throw 'PROCESS_OBSERVATION_UNAVAILABLE'}
foreach($p in $all){if($p.Name -eq 'node.exe'){if(-not $p.CommandLine){throw 'PROCESS_UNVERIFIED'};if($p.CommandLine -match 'companion-daemon\.js|start-companion\.mjs|creator-ai\.js[" ]+daemon[ ]+start|local-launcher\.cjs'){throw 'START_STILL_ACTIVE'}}}
$rows=@(Get-NetTCPConnection -ErrorAction Stop | Where-Object {$_.LocalPort -eq 32180})
if($rows.Count -gt 0){throw 'DAEMON_PORT_PRESENT'}
@{pid=$account.pid;creation=$account.creation;noStartingProcess=$true;complete=$true;daemonAbsent=$true}|ConvertTo-Json -Compress
