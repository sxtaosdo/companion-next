# 仅供用户本人在本机执行。代理只能静态检查，不能运行本脚本。
# 清除当前进程的明文密钥变量，仅传递固定 DPAPI 路径；不读取或解密凭据。
# 沿用已审查的 guarded restart；失败立即停止，不强制终止进程。
param([switch]$StartOnly, [switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
Remove-Item Env:WEKNORA_API_KEY, Env:KNOWLEDGE_SYNC_API_KEY -ErrorAction SilentlyContinue
$readerReference = 'D:/services/weknora/cli/private/pilot-recovery-reader.dpapi'
# Persist only the existing path, never a key. Reject an unrelated prior configuration.
$savedReference = [Environment]::GetEnvironmentVariable('COMPANION_KNOWLEDGE_CREDENTIAL_FILE', 'User')
if ($savedReference -and $savedReference.Replace('\','/').TrimEnd('/') -ne $readerReference) {
    throw 'Existing knowledge reader reference differs; no configuration was replaced.'
}
$readerInfo = Get-Item -LiteralPath $readerReference -ErrorAction Stop
if ($readerInfo.PSIsContainer -or ($readerInfo.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
    throw 'The existing knowledge reader file must be an ordinary file.'
}
if (-not $savedReference) {
    [Environment]::SetEnvironmentVariable('COMPANION_KNOWLEDGE_CREDENTIAL_FILE', $readerReference, 'User')
}
$env:COMPANION_KNOWLEDGE_CREDENTIAL_FILE = [Environment]::GetEnvironmentVariable('COMPANION_KNOWLEDGE_CREDENTIAL_FILE', 'User')
if ($env:COMPANION_KNOWLEDGE_CREDENTIAL_FILE.Replace('\','/') -ne $readerReference) { throw 'Knowledge reader reference was not retained.' }
$env:PATH = "$env:SystemRoot\System32\WindowsPowerShell\v1.0;$env:PATH"
$env:CREATOR_AI_OWNER_PYTHON = 'C:/Users/33272/miniconda3/python.exe'
$env:CREATOR_AI_OWNER_BRIDGE_ROOT = 'D:/code/shidai3/P8000/companion-next'
$env:CREATOR_AI_OWNER_REVIEW_ROOT = 'D:/code/shidai3/P8000/public-image-review'
$env:CREATOR_AI_OWNER_CACHE = 'C:/Users/33272/AppData/Local/Temp/companion-owner-host-implementation-20261018/directed-acceptance-cache'
$daemonArguments = @('D:/code/shidai3/P8000/cocos-mcp/mcp/dist/companion/creator-ai.js', 'daemon', 'start')
if (-not $StartOnly) { $daemonArguments += '--restart' }
& 'C:/Program Files/nodejs/node.exe' @daemonArguments
if ($LASTEXITCODE -ne 0) { throw 'Guarded Companion restart did not succeed; stop here.' }
if (-not $NoBrowser) {
    & 'C:/Program Files/nodejs/node.exe' 'D:/code/shidai3/P8000/cocos-mcp/mcp/dist/companion/creator-ai.js' ui
}
