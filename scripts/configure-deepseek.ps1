$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$secretValue = Read-Host '输入 DeepSeek API Key（输入隐藏，仅保存到本机 .env）' -AsSecureString
$secretPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secretValue)
try {
    $plainValue = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secretPointer)
    if ($plainValue -notmatch '^[A-Za-z0-9._-]+$') { throw '密钥格式无效，未保存。' }
    $envPath = Join-Path $projectRoot '.env'
    $existingLines = if (Test-Path -LiteralPath $envPath) { @(Get-Content -LiteralPath $envPath) } else { @() }
    $retainedLines = @($existingLines | Where-Object { $_ -notmatch '^\s*(export\s+)?DEEPSEEK_API_KEY\s*=' })
    $updatedLines = @($retainedLines) + @('DEEPSEEK_API_KEY=' + $plainValue)
    if (-not ($retainedLines -match '^\s*DEEPSEEK_MODEL\s*=')) { $updatedLines += 'DEEPSEEK_MODEL=deepseek-flash' }
    [IO.File]::WriteAllLines($envPath, $updatedLines, [Text.UTF8Encoding]::new($false))
    Write-Output '已保存本机 .env，请重新启动服务。'
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretPointer)
    $plainValue = $null
    $secretValue.Dispose()
}
