# ZRH AI 启动脚本（仅影响 zrh-ai-* 容器，不触碰其他项目）
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$Compose = 'C:\Program Files\Docker\Docker\resources\bin\docker-compose.exe'
if (-not (Test-Path $Compose)) { $Compose = 'docker-compose' }

if (-not (Test-Path "$Root\.env")) {
    Write-Host '[ZRH AI] .env 不存在，请先复制 .env.example 并填入真实密码' -ForegroundColor Red
    exit 1
}

& $Compose --env-file "$Root\.env" -f "$Root\docker-compose.yml" up -d --build
Write-Host '[ZRH AI] 启动完成。前端 http://localhost:3010 后端 http://localhost:4010/api/health' -ForegroundColor Green
