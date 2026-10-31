# Windows desktop panel; does not create services or handle credentials itself.
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
. (Join-Path $PSScriptRoot 'desktop-protocol.ps1')
[System.Windows.Forms.Application]::EnableVisualStyles()
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$gatePath = Join-Path $PSScriptRoot 'runtime-gate.mjs'
$controlPath = Join-Path $PSScriptRoot 'desktop-control.mjs'
$fencePath = Join-Path $env:LOCALAPPDATA 'CompanionNext\desktop-launch\startup.pending'
$form = New-Object System.Windows.Forms.Form
$form.Text = '游戏开发后台'
$form.Width = 560; $form.Height = 420; $form.StartPosition = 'CenterScreen'
$form.MinimumSize = New-Object System.Drawing.Size(560,390)
$title = New-Object System.Windows.Forms.Label
$title.Text = '游戏开发后台'; $title.Font = New-Object System.Drawing.Font('Microsoft YaHei UI', 13, [System.Drawing.FontStyle]::Bold)
$title.Location = New-Object System.Drawing.Point(20,18); $title.AutoSize = $true
$status = New-Object System.Windows.Forms.Label
$status.Text = '可启动后台、只读检查或打开已运行的后台。'
$status.Location = New-Object System.Drawing.Point(23,60); $status.Size = New-Object System.Drawing.Size(490,45)
$start = New-Object System.Windows.Forms.Button; $start.Text = '启动后台'; $start.SetBounds(22,118,140,38)
$check = New-Object System.Windows.Forms.Button; $check.Text = '只读诊断'; $check.SetBounds(180,118,140,38)
$open = New-Object System.Windows.Forms.Button; $open.Text = '打开后台'; $open.SetBounds(338,118,140,38)
$hint = New-Object System.Windows.Forms.Label
$hint.Text = '关闭此窗口不会关闭后台。启动结果不明时请先诊断，不会自动重复启动。'
$hint.Location = New-Object System.Drawing.Point(23,177); $hint.Size = New-Object System.Drawing.Size(490,48)
$recover = New-Object System.Windows.Forms.Button; $recover.Text = '核查并恢复启动'; $recover.SetBounds(22,230,200,38)
$continue = New-Object System.Windows.Forms.Button; $continue.Text = '认证就绪后继续启动'; $continue.SetBounds(240,230,238,38)
$inspect = New-Object System.Windows.Forms.Button; $inspect.Text = '核查上次续接结果'; $inspect.SetBounds(22,278,200,38)
$form.Controls.AddRange(@($title,$status,$start,$check,$open,$hint,$recover,$continue,$inspect))
$timer = New-Object System.Windows.Forms.Timer; $timer.Interval = 300
$script:worker = $null; $script:workerOutput = $null; $script:workerError = $null; $script:workerAction = ''
function Set-Idle { $start.Enabled = -not (Test-Path -LiteralPath $fencePath); $check.Enabled = $true; $open.Enabled = $true; $recover.Enabled = Test-Path -LiteralPath $fencePath; $continue.Enabled = Test-Path -LiteralPath $fencePath; $inspect.Enabled = Test-Path -LiteralPath $fencePath }
function Start-Worker([string]$action) {
 if ($script:worker) { return }
 if ($action -eq 'start' -and (Test-Path -LiteralPath $fencePath)) { $status.Text = '已有启动结果待核对；请使用只读诊断，未重复启动。'; Set-Idle; return }
 try {
  $node = (Get-Command node.exe -ErrorAction Stop).Source
  if (-not [System.IO.Path]::IsPathRooted($node) -or -not (Test-Path -LiteralPath $gatePath) -or -not (Test-Path -LiteralPath $controlPath)) { throw 'Required local executable unavailable' }
  $info = New-Object System.Diagnostics.ProcessStartInfo
  $info.FileName = $node
  $info.Arguments = '"' + $gatePath + '" host-start -- "' + $controlPath + '" ' + $action
  $info.WorkingDirectory = $projectRoot; $info.UseShellExecute = $false; $info.CreateNoWindow = $true
  $info.RedirectStandardOutput = $true; $info.RedirectStandardError = $true
  $process = New-Object System.Diagnostics.Process; $process.StartInfo = $info
  if (-not $process.Start()) { throw 'Process did not start' }
  $script:worker = $process; $script:workerAction = $action
  $script:workerOutput = $process.StandardOutput.ReadToEndAsync(); $script:workerError = $process.StandardError.ReadToEndAsync()
  $start.Enabled = $false; $check.Enabled = $false; $open.Enabled = $false; $recover.Enabled = $false; $continue.Enabled = $false; $inspect.Enabled = $false
  $status.Text = if ($action -eq 'start') { '正在启动并核对后台，请稍候。' } else { '正在只读核对后台，请稍候。' }
  $timer.Start()
 } catch { $status.Text = '无法启动诊断程序，请检查安装与运行环境。'; Set-Idle }
}
$timer.Add_Tick({
 if (-not $script:worker -or -not $script:worker.HasExited) { return }
 $timer.Stop(); $value = $null
 try { $value = Read-DesktopResult $script:workerOutput.Result $script:workerAction } catch {}
 if ($script:workerAction -eq 'inspect-continuation') { $status.Text = switch ($value.state) { 'ready' {'后台已就绪，原记录已归档。'} 'retry-available' {'上次结果仍为未知；当前无启动活动。可再次明确点击继续启动。'} default {'续接状态仍待核对；记录保留，未重复启动。'} } } elseif ($script:workerAction -eq 'continue') { $status.Text = if($script:worker.ExitCode -eq 0 -and $value.state -eq 'ready') {'后台续接已就绪；原启动记录已保留归档。'} else {'续接尚未确认；已保留记录，不会重复启动。请使用只读诊断。'} } elseif ($script:workerAction -eq 'recover') { $status.Text = if($script:worker.ExitCode -eq 0 -and $value.state -eq 'recovered') {'原启动记录已保留并归档；未自动启动。现在可点击启动后台。'} else {'尚不能安全恢复启动；原记录保留。请检查重启、进程和端口状态。'} } elseif ($script:worker.ExitCode -eq 0 -and $value.state -eq 'ready') {
  $status.Text = switch ($value.ui) {
   'missing' { '后台已就绪，但界面文件缺失（UI_FILES_MISSING）；请修复界面文件。' }
   'invalid' { '后台已就绪，但界面文件不符合预期；请核对界面文件。' }
   'ready' { '后台及界面已核验，可以打开后台。' }
   default { '后台已就绪；网页访问尚未核验，请检查界面。' }
  }
 } else {
  if ($script:workerAction -eq 'start' -and $value.start -eq 'confirmed') { $status.Text = '后台启动曾获确认，但当前状态待核对；未自动重试。' }
  elseif ($script:workerAction -eq 'start') { $status.Text = Read-StartupDiagnosticHint $fencePath }
  else { $status.Text = switch ($value.reason) {
   'DAEMON_AUTH_REJECTED' { '后台认证核对未通过；未启动服务。' }
   'DAEMON_IDENTITY_UNVERIFIED' { '后台身份无法核验；未启动服务。' }
   'UNEXPECTED_DAEMON_URL' { '后台地址与受信地址不一致；未启动服务。' }
   'DAEMON_NOT_READY' { '后台入口尚未开放；未启动服务。' }
   default { '暂无法确认后台身份和入口状态；未启动服务。' }
  } }
 }
 $script:worker.Dispose(); $script:worker = $null; $script:workerOutput = $null; $script:workerError = $null; Set-Idle
})
$inspect.Add_Click({ Start-Worker 'inspect-continuation' })
$continue.Add_Click({ Start-Worker 'continue' })
$recover.Add_Click({ Start-Worker 'recover' })
$start.Add_Click({ Start-Worker 'start' }); $check.Add_Click({ Start-Worker 'diagnose' })
$open.Add_Click({
 try {
  $edge = @('C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe','C:\Program Files\Microsoft\Edge\Application\msedge.exe') | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
  if (-not $edge) { throw 'Edge unavailable' }
  Start-Process -FilePath $edge -ArgumentList 'http://127.0.0.1:32180/next/index.html#/overview' | Out-Null
  $status.Text = '已请求在 Edge 中打开后台；如需登录请使用原登录页面。'
 } catch { $status.Text = '无法打开 Edge，请检查浏览器安装。' }
})
Set-Idle
if (Test-Path -LiteralPath $fencePath) { $status.Text = '已有启动结果待核对；请先进行只读诊断。' }
[void]$form.ShowDialog()
$timer.Stop()
# A running worker is deliberately not terminated when the panel closes.
