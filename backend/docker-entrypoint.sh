#!/bin/sh
# ZRH AI API 容器入口：迁移 → 种子 → 启动
set -e

# 由 POSTGRES_* 构造 Prisma CLI 所需的 DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
  export DATABASE_URL="postgresql://${POSTGRES_USER:-zrh_ai}:${POSTGRES_PASSWORD}@${POSTGRES_HOST:-zrh-ai-postgres}:${POSTGRES_PORT:-5432}/${POSTGRES_DB:-zrh_ai}?schema=public"
fi

echo "[entrypoint] prisma migrate deploy"
npx prisma migrate deploy

echo "[entrypoint] database seed (idempotent)"
node prisma/seed.js

echo "[entrypoint] starting api"
exec node dist/main.js
