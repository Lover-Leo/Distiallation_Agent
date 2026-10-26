$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$env:BASELINE_DIR = 'outputs/local-baseline-v1'
$env:CHAT_PROVIDER = 'local'
node src/server.mjs
