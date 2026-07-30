# ZRH AI 状态脚本（仅查询 zrh-ai-* 容器）
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$Compose = 'C:\Program Files\Docker\Docker\resources\bin\docker-compose.exe'
if (-not (Test-Path $Compose)) { $Compose = 'docker-compose' }
$Docker = 'C:\Program Files\Docker\Docker\resources\bin\docker.exe'
if (-not (Test-Path $Docker)) { $Docker = 'docker' }

Write-Host '===== ZRH AI 容器状态 =====' -ForegroundColor Cyan
& $Compose --env-file "$Root\.env" -f "$Root\docker-compose.yml" ps

Write-Host ''
Write-Host '===== 后端健康检查 =====' -ForegroundColor Cyan
try {
    $health = Invoke-RestMethod -Uri 'http://localhost:4010/api/v1/health' -TimeoutSec 5
    $health | ConvertTo-Json -Depth 5
} catch {
    Write-Host "后端暂不可达: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host ''
Write-Host '===== Ollama 状态（经后端代理） =====' -ForegroundColor Cyan
try {
    $ollama = Invoke-RestMethod -Uri 'http://localhost:4010/api/v1/ollama/health' -TimeoutSec 8
    $ollama | ConvertTo-Json -Depth 5
} catch {
    Write-Host "Ollama 状态暂不可达: $($_.Exception.Message)" -ForegroundColor Yellow
}
