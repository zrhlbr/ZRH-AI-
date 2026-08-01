# Sync ZRH AI source to zrh-server and bring up production compose.
# Does not reload system nginx (requires sudo on server).
$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $PSScriptRoot
$Key = Join-Path $env:USERPROFILE '.ssh\zrh_accounting_deploy'
$HostName = if ($env:ZRH_AI_DEPLOY_HOST) { $env:ZRH_AI_DEPLOY_HOST } else { '192.168.10.74' }
$User = 'zrh-admin'
$RemoteDir = '/home/zrh-admin/zrh-ai'
$SshTarget = "${User}@${HostName}"

$SshBase = @(
    '-o', 'BatchMode=yes',
    '-o', 'ConnectTimeout=20',
    '-o', 'IdentitiesOnly=yes',
    '-i', $Key,
    $SshTarget
)

Write-Host "[deploy] target $SshTarget:$RemoteDir" -ForegroundColor Cyan

ssh @SshBase "mkdir -p $RemoteDir"

# Prefer rsync if available; else tar+scp
$hasRsync = Get-Command rsync -ErrorAction SilentlyContinue
if ($hasRsync) {
    & rsync -az --delete `
        --exclude node_modules --exclude .git --exclude '.env' `
        --exclude 'frontend/dist' --exclude 'backend/dist' `
        --exclude 'frontend/node_modules' --exclude 'backend/node_modules' `
        "$Root/" "${SshTarget}:${RemoteDir}/"
} else {
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $tar = Join-Path $env:TEMP "zrh-ai-deploy-$stamp.tar.gz"
    Write-Host "[deploy] packing $tar"
    # NOTE: Windows tar --exclude=./logs also drops backend/src/**/logs — do not exclude those names.
    tar -czf $tar `
        --exclude=./node_modules --exclude=./.git `
        --exclude=./frontend/node_modules --exclude=./backend/node_modules `
        --exclude=./frontend/dist --exclude=./backend/dist `
        --exclude=./.env `
        -C $Root .
    scp -o BatchMode=yes -o IdentitiesOnly=yes -i $Key $tar "${SshTarget}:/tmp/zrh-ai-deploy.tar.gz"
    ssh @SshBase "mkdir -p $RemoteDir && tar -xzf /tmp/zrh-ai-deploy.tar.gz -C $RemoteDir && rm -f /tmp/zrh-ai-deploy.tar.gz"
    Remove-Item -Force $tar -ErrorAction SilentlyContinue
}

$gitSha = (git -C $Root rev-parse HEAD).Trim()
ssh @SshBase "cd $RemoteDir && if [ ! -f .env ]; then cp .env.production.example .env; echo 'CREATED_ENV=1'; else echo 'CREATED_ENV=0'; fi && echo GIT_SHA=$gitSha > .deploy-meta && echo IMAGE_TAG=1.1.0 >> .deploy-meta"

Write-Host "[deploy] sync complete. Ensure .env secrets are set, then:" -ForegroundColor Green
Write-Host "  ssh $SshTarget `"cd $RemoteDir && docker compose -f docker-compose.production.yml --env-file .env up -d --build`""
