# Explicit installer; creates a single shortcut and never starts the backend.
$ErrorActionPreference = 'Stop'
$panel = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'desktop-panel.ps1'))
if (-not (Test-Path -LiteralPath $panel -PathType Leaf)) { throw 'Desktop panel is missing.' }
$desktop = [Environment]::GetFolderPath('DesktopDirectory')
if (-not $desktop -or -not (Test-Path -LiteralPath $desktop -PathType Container)) { throw 'Desktop directory unavailable.' }
$target = Join-Path $desktop '游戏开发后台.lnk'
if (Test-Path -LiteralPath $target) { throw 'Shortcut already exists; it was not replaced.' }
$temp = Join-Path $desktop ('.companion-shortcut-' + [guid]::NewGuid().ToString('N') + '.lnk')
try {
 $shell = New-Object -ComObject WScript.Shell
 $link = $shell.CreateShortcut($temp)
 $link.TargetPath = Join-Path $PSHOME 'powershell.exe'
 $link.Arguments = '-NoProfile -NonInteractive -WindowStyle Hidden -STA -File "' + $panel + '"'
 $link.WorkingDirectory = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
 $link.Description = '游戏开发后台启动与只读诊断'
 $link.Save()
 [System.IO.File]::Move($temp, $target)
 Write-Output '桌面入口已安装；后台尚未启动。'
} finally { if (Test-Path -LiteralPath $temp) { Remove-Item -LiteralPath $temp } }
