/**
 * Bootstrap min-privilege "ZRHPay Website Assistant" service account on ZRHLBR AI.
 *
 * Usage (cwd = ZRH-AI/backend, DATABASE_URL set):
 *   WEBSITE_AI_ENV=test WEBSITE_AI_PASSWORD='***' node ../scripts/create-zrhpay-website-assistant.mjs
 *
 * Env:
 *   WEBSITE_AI_ENV         required: "test" | "production"
 *   WEBSITE_AI_USERNAME   optional override (defaults differ by env)
 *   WEBSITE_AI_PASSWORD   required (min 12). Never logged.
 *
 * Grants ONLY:
 *   api:ai:write
 *   api:ai:read
 *   api:chat:read
 *
 * Idempotent: upserts role/user and resets role permissions to the min set.
 * Does NOT grant ADMIN / SUPER_ADMIN / ENTERPRISE.
 * Production MUST use a different username than the test default.
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ENV = (process.env.WEBSITE_AI_ENV || "").trim().toLowerCase();
const PASSWORD = process.env.WEBSITE_AI_PASSWORD;
const ROLE_CODE = "WEBSITE_AI_ASSISTANT";
const PERMS = ["api:ai:write", "api:ai:read", "api:chat:read"];
const TEST_DEFAULT_USER = "zrhpay_website_assistant_test";
const PROD_DEFAULT_USER = "zrhpay_website_assistant_prod";

function resolveUsername() {
  const override = (process.env.WEBSITE_AI_USERNAME || "").trim();
  if (ENV === "test") return override || TEST_DEFAULT_USER;
  if (ENV === "production") return override || PROD_DEFAULT_USER;
  throw new Error('Set WEBSITE_AI_ENV to "test" or "production".');
}

async function main() {
  if (ENV !== "test" && ENV !== "production") {
    throw new Error('Set WEBSITE_AI_ENV to "test" or "production".');
  }
  if (!PASSWORD || PASSWORD.length < 12) {
    throw new Error("Set WEBSITE_AI_PASSWORD (min 12 chars). Password is never logged.");
  }

  const username = resolveUsername();
  if (ENV === "production" && username === TEST_DEFAULT_USER) {
    throw new Error(
      `Refusing production bootstrap with test username "${TEST_DEFAULT_USER}". Use a distinct production account.`,
    );
  }
  if (ENV === "test" && username === PROD_DEFAULT_USER) {
    throw new Error(
      `Refusing test bootstrap with production username "${PROD_DEFAULT_USER}".`,
    );
  }

  const permissions = await prisma.permission.findMany({ where: { code: { in: PERMS } } });
  if (permissions.length !== PERMS.length) {
    const found = new Set(permissions.map((p) => p.code));
    const missing = PERMS.filter((c) => !found.has(c));
    throw new Error(`Missing permissions in DB (run seed first): ${missing.join(", ")}`);
  }

  const role = await prisma.role.upsert({
    where: { code: ROLE_CODE },
    update: {
      name: "ZRHPay Website AI Assistant",
      description: "Min privilege website proxy — chat only",
    },
    create: {
      code: ROLE_CODE,
      name: "ZRHPay Website AI Assistant",
      description: "Min privilege website proxy — chat only",
    },
  });

  await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
  await prisma.rolePermission.createMany({
    data: permissions.map((p) => ({ roleId: role.id, permissionId: p.id })),
  });

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const existing = await prisma.user.findUnique({ where: { username } });
  await prisma.user.upsert({
    where: { username },
    update: {
      passwordHash,
      roleId: role.id,
      displayName: `ZRHPay Website Assistant (${ENV})`,
      status: "active",
    },
    create: {
      username,
      displayName: `ZRHPay Website Assistant (${ENV})`,
      passwordHash,
      roleId: role.id,
      status: "active",
    },
  });

  console.log(
    `[ok] env=${ENV} action=${existing ? "updated" : "created"} role=${ROLE_CODE} user=${username} perms=${PERMS.join(",")}`,
  );
  console.log(
    "[ok] Configure ZRHPay backend only: ZRHLBR_AI_SERVICE_ACCOUNT / ZRHLBR_AI_SERVICE_PASSWORD (never commit secrets).",
  );
  console.log("[ok] Do not reuse test credentials in production.");
}

main()
  .catch((e) => {
    console.error("[fail]", e instanceof Error ? e.message : "unknown_error");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
