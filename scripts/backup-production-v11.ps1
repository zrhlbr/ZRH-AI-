# Full Production backup before V1.2 Blue-Green cutover.
# Target: zrh-admin@192.168.10.74:/home/zrh-admin/zrh-ai
$ErrorActionPreference = 'Stop'

$Key = Join-Path $env:USERPROFILE '.ssh\zrh_accounting_deploy'
$HostName = if ($env:ZRH_AI_DEPLOY_HOST) { $env:ZRH_AI_DEPLOY_HOST } else { '192.168.10.74' }
$User = 'zrh-admin'
$SshTarget = "${User}@${HostName}"
$RemoteDir = '/home/zrh-admin/zrh-ai'
$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$BackupName = "v1.1.0-final-$Stamp"

$Ssh = @(
    '-o', 'BatchMode=yes',
    '-o', 'ConnectTimeout=20',
    '-o', 'IdentitiesOnly=yes',
    '-i', $Key,
    $SshTarget
)

Write-Host "[backup] $BackupName on $SshTarget" -ForegroundColor Cyan

$remote = @"
set -euo pipefail
REMOTE_DIR='$RemoteDir'
BACKUP_ROOT="\$REMOTE_DIR/backups/$BackupName"
mkdir -p "\$BACKUP_ROOT"/{db,redis,env,compose,nginx,images,meta,tree}

cd "\$REMOTE_DIR"
# --- env / compose / meta ---
cp -a .env "\$BACKUP_ROOT/env/.env"
cp -a docker-compose.production.yml "\$BACKUP_ROOT/compose/" 2>/dev/null || true
cp -a docker-compose.yml "\$BACKUP_ROOT/compose/" 2>/dev/null || true
cp -a .deploy-meta "\$BACKUP_ROOT/meta/" 2>/dev/null || true
cp -a VERSION "\$BACKUP_ROOT/meta/" 2>/dev/null || true
cp -a deploy/nginx "\$BACKUP_ROOT/nginx/" 2>/dev/null || true
# best-effort system nginx copy (may need read perms)
cp -a /etc/nginx/sites-available/ai.zrhtech.com "\$BACKUP_ROOT/nginx/sites-available-ai.zrhtech.com" 2>/dev/null || true
cp -a /etc/nginx/sites-enabled/ai.zrhtech.com "\$BACKUP_ROOT/nginx/sites-enabled-ai.zrhtech.com" 2>/dev/null || true

# --- postgres dump ---
docker exec zrh-ai-postgres sh -c 'pg_dump -U "\$POSTGRES_USER" -d "\$POSTGRES_DB" -Fc' > "\$BACKUP_ROOT/db/zrh_ai.dump"
docker exec zrh-ai-postgres sh -c 'pg_dump -U "\$POSTGRES_USER" -d "\$POSTGRES_DB" --schema-only' > "\$BACKUP_ROOT/db/schema.sql"

# --- redis RDB ---
REDIS_PW=\$(grep -E '^REDIS_PASSWORD=' .env | cut -d= -f2-)
docker exec zrh-ai-redis sh -c "redis-cli -a \"\$REDIS_PW\" --no-auth-warning BGSAVE" || true
sleep 2
docker cp zrh-ai-redis:/data/dump.rdb "\$BACKUP_ROOT/redis/dump.rdb" 2>/dev/null || true
docker exec zrh-ai-redis sh -c "redis-cli -a \"\$REDIS_PW\" --no-auth-warning --rdb /tmp/zrh-ai.rdb" 2>/dev/null || true
docker cp zrh-ai-redis:/tmp/zrh-ai.rdb "\$BACKUP_ROOT/redis/zrh-ai.rdb" 2>/dev/null || true

# --- docker images (V1.1 rollback) ---
docker save zrh-ai-api:1.1.0 zrh-ai-web:1.1.0 | gzip -c > "\$BACKUP_ROOT/images/zrh-ai-1.1.0-images.tar.gz"
# also keep retag aliases for fast rollback
docker tag zrh-ai-api:1.1.0 zrh-ai-api:v1.1.0-final-backup || true
docker tag zrh-ai-web:1.1.0 zrh-ai-web:v1.1.0-final-backup || true

# --- tree snapshot of current production code ---
tar -czf "\$BACKUP_ROOT/tree/zrh-ai-v1.1-tree.tar.gz" \
  --exclude=./backups --exclude=./.git --exclude=./frontend/node_modules \
  --exclude=./backend/node_modules --exclude=./frontend/dist --exclude=./backend/dist \
  -C "\$REMOTE_DIR" .

# --- inventory ---
{
  echo "BACKUP_NAME=$BackupName"
  echo "CREATED_AT=\$(date -Iseconds)"
  echo "HOST=\$(hostname)"
  docker ps --filter name=zrh-ai --format '{{.Names}} {{.Image}} {{.Status}}'
  echo '---IMAGES---'
  docker images 'zrh-ai-*' --format '{{.Repository}}:{{.Tag}} {{.ID}} {{.Size}}'
  echo '---HEALTH---'
  curl -sS http://127.0.0.1:4010/api/v1/health || true
} > "\$BACKUP_ROOT/meta/inventory.txt"

ln -sfn "$BackupName" "\$REMOTE_DIR/backups/v1.1.0-final-latest"
echo "BACKUP_OK \$BACKUP_ROOT"
du -sh "\$BACKUP_ROOT"
"@

# Fix escaped dollars for remote bash — write via temp file for reliability
$remoteFile = Join-Path $env:TEMP "zrh-ai-backup-$Stamp.sh"
# Use single-quoted here-string content built carefully
@'
set -euo pipefail
REMOTE_DIR='/home/zrh-admin/zrh-ai'
BACKUP_NAME='__BACKUP_NAME__'
BACKUP_ROOT="$REMOTE_DIR/backups/$BACKUP_NAME"
mkdir -p "$BACKUP_ROOT"/{db,redis,env,compose,nginx,images,meta,tree}
cd "$REMOTE_DIR"

cp -a .env "$BACKUP_ROOT/env/.env"
cp -a docker-compose.production.yml "$BACKUP_ROOT/compose/" 2>/dev/null || true
cp -a docker-compose.yml "$BACKUP_ROOT/compose/" 2>/dev/null || true
cp -a .deploy-meta "$BACKUP_ROOT/meta/" 2>/dev/null || true
cp -a VERSION "$BACKUP_ROOT/meta/" 2>/dev/null || true
cp -a deploy/nginx "$BACKUP_ROOT/nginx/" 2>/dev/null || true
cp -a /etc/nginx/sites-available/ai.zrhtech.com "$BACKUP_ROOT/nginx/sites-available-ai.zrhtech.com" 2>/dev/null || true
cp -a /etc/nginx/sites-enabled/ai.zrhtech.com "$BACKUP_ROOT/nginx/sites-enabled-ai.zrhtech.com" 2>/dev/null || true

docker exec zrh-ai-postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$BACKUP_ROOT/db/zrh_ai.dump"
docker exec zrh-ai-postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --schema-only' > "$BACKUP_ROOT/db/schema.sql"

REDIS_PW=$(grep -E '^REDIS_PASSWORD=' .env | cut -d= -f2-)
docker exec zrh-ai-redis sh -c "redis-cli -a \"$REDIS_PW\" --no-auth-warning BGSAVE" || true
sleep 2
docker cp zrh-ai-redis:/data/dump.rdb "$BACKUP_ROOT/redis/dump.rdb" 2>/dev/null || true

docker save zrh-ai-api:1.1.0 zrh-ai-web:1.1.0 | gzip -c > "$BACKUP_ROOT/images/zrh-ai-1.1.0-images.tar.gz"
docker tag zrh-ai-api:1.1.0 zrh-ai-api:v1.1.0-final-backup || true
docker tag zrh-ai-web:1.1.0 zrh-ai-web:v1.1.0-final-backup || true

tar -czf "$BACKUP_ROOT/tree/zrh-ai-v1.1-tree.tar.gz" \
  --exclude=./backups --exclude=./.git --exclude=./frontend/node_modules \
  --exclude=./backend/node_modules --exclude=./frontend/dist --exclude=./backend/dist \
  -C "$REMOTE_DIR" .

{
  echo "BACKUP_NAME=$BACKUP_NAME"
  echo "CREATED_AT=$(date -Iseconds)"
  echo "HOST=$(hostname)"
  docker ps --filter name=zrh-ai --format '{{.Names}} {{.Image}} {{.Status}}'
  echo '---IMAGES---'
  docker images 'zrh-ai-*' --format '{{.Repository}}:{{.Tag}} {{.ID}} {{.Size}}'
  echo '---HEALTH---'
  curl -sS http://127.0.0.1:4010/api/v1/health || true
  echo
} > "$BACKUP_ROOT/meta/inventory.txt"

ln -sfn "$BACKUP_NAME" "$REMOTE_DIR/backups/v1.1.0-final-latest"
echo "BACKUP_OK $BACKUP_ROOT"
du -sh "$BACKUP_ROOT"
'@.Replace('__BACKUP_NAME__', $BackupName) | Set-Content -Path $remoteFile -Encoding utf8NoBOM

scp -o BatchMode=yes -o IdentitiesOnly=yes -i $Key $remoteFile "${SshTarget}:/tmp/zrh-ai-backup.sh"
ssh @Ssh "bash /tmp/zrh-ai-backup.sh"
Write-Host "[backup] complete: $BackupName" -ForegroundColor Green
Write-Output $BackupName
