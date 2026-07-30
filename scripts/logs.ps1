# ZRH AI 日志脚本（仅查看 zrh-ai-* 容器日志）
# 用法: .\scripts\logs.ps1 [服务名]   例如: .\scripts\logs.ps1 zrh-ai-api
param(
    [string]$Service = ''
)
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$Compose = 'C:\Program Files\Docker\Docker\resources\bin\docker-compose.exe'
if (-not (Test-Path $Compose)) { $Compose = 'docker-compose' }

if ($Service) {
    & $Compose --env-file "$Root\.env" -f "$Root\docker-compose.yml" logs -f --tail=100 $Service
} else {
    & $Compose --env-file "$Root\.env" -f "$Root\docker-compose.yml" logs -f --tail=100
}
