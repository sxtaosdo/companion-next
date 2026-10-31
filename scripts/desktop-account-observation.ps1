$ErrorActionPreference='Stop'
$all=@(Get-CimInstance Win32_Process -ErrorAction Stop)
# Outer desktop controllers may still drain pipes; only actual startup workers block.
foreach($p in $all){if($p.Name -eq 'node.exe'){if(-not $p.CommandLine){throw 'PROCESS_UNVERIFIED'};if($p.CommandLine -match 'start-companion\.mjs|creator-ai\.js[" ]+daemon[ ]+start|local-launcher\.cjs') {throw 'START_STILL_ACTIVE'}}}
$rows=@(Get-NetTCPConnection -LocalPort 18001 -ErrorAction Stop | Where-Object {$_.RemotePort -eq 0})
if($rows.Count -ne 1 -or $rows[0].LocalAddress -ne '127.0.0.1'){throw 'ACCOUNT_PORT_UNVERIFIED'}
$owner=[int]$rows[0].OwningProcess
$p=@($all|Where-Object ProcessId -eq $owner)
$node='D:\code\shidai3\P8000\dual-game-build\node_modules\node\bin\node.exe'
$script='D:\code\shidai3\P8000\game-ops-admin\server\bootstrap.js'
if($p.Count -ne 1 -or $p[0].ExecutablePath -ine $node -or $p[0].CommandLine.Replace('/','\') -notmatch ('^"?'+[regex]::Escape($node)+'"?\s+"?'+[regex]::Escape($script)+'"?$') -or -not $p[0].CreationDate){throw 'ACCOUNT_PROCESS_UNVERIFIED'}
@{pid=$owner;creation=$p[0].CreationDate.ToUniversalTime().ToString('O');noStartingProcess=$true}|ConvertTo-Json -Compress
