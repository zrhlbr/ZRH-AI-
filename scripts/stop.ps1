# ZRH AI 停止脚本（仅停止 zrh-ai-* 容器，保留数据卷）
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$Compose = 'C:\Program Files\Docker\Docker\resources\bin\docker-compose.exe'
if (-not (Test-Path $Compose)) { $Compose = 'docker-compose' }

& $Compose --env-file "$Root\.env" -f "$Root\docker-compose.yml" down
Write-Host '[ZRH AI] 已停止（数据卷 zrh-ai-postgres-data / zrh-ai-redis-data 保留）' -ForegroundColor Green
