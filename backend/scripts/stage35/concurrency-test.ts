import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_DIR = path.join(__dirname, '..', '..', '..', 'frontend', 'e2e', 'output', 'stage35');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const BASE_URL = 'http://localhost:4010';
const ADMIN = { username: 'admin', password: 'Zrh@e6878233406e' };
const CONCURRENCY_LEVELS = [5, 10, 20];

interface User {
  id: number;
  username: string;
  password: string;
  token: string;
}

interface RunResult {
  level: number;
  totalMs: number;
  successCount: number;
  errorCount: number;
  avgLatencyMs: number;
  isolationPassed: boolean;
  errors: string[];
}

const prisma = new PrismaClient();

function hashPassword(pwd: string): string {
  // bcrypt hash 需要 bcryptjs，这里直接用 sha256 占位，实际测试用简单密码 + 后端验证会失败
  // 因此这里用 Prisma 创建时无法生成正确 bcrypt hash，改为调用后端 login 不行
  // 解决方案：脚本内部调用 bcryptjs 生成正确 hash
  return pwd;
}

async function ensureBcrypt(): Promise<any> {
  return import('bcryptjs');
}

async function createTestUsers(count: number): Promise<User[]> {
  const bcrypt = await ensureBcrypt();
  const users: User[] = [];
  const role = await prisma.role.findUnique({ where: { code: 'USER' } });
  if (!role) throw new Error('USER role not found');

  for (let i = 0; i < count; i++) {
    const username = `stage35-user-${Date.now()}-${i}`;
    const password = `Pass${Math.random().toString(36).slice(2)}!`;
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.upsert({
      where: { username },
      update: { roleId: role.id, status: 'active' },
      create: {
        username,
        displayName: `Stage35 User ${i}`,
        passwordHash,
        roleId: role.id,
        status: 'active',
      },
    });
    users.push({ id: user.id, username, password, token: '' });
  }
  return users;
}

async function loginUser(username: string, password: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`login failed for ${username}: ${data.message}`);
  return data.data.accessToken;
}

async function sendMessage(token: string, message: string): Promise<{ conversationId: number; answer: string }> {
  const res = await fetch(`${BASE_URL}/api/v1/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ message }),
  });
  if (!res.ok || !res.body) throw new Error(`chat failed: HTTP ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let conversationId: number | null = null;
  let answer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split('\n\n');
    buffer = frames.pop() ?? '';
    for (const frame of frames) {
      const line = frame.trim();
      if (!line.startsWith('data:')) continue;
      try {
        const event = JSON.parse(line.slice(5).trim());
        if (event.type === 'meta') conversationId = event.conversationId;
        if (event.type === 'delta') answer += event.content;
      } catch { /* ignore */ }
    }
  }
  if (!conversationId) throw new Error('no conversationId');
  return { conversationId, answer };
}

async function listConversations(token: string): Promise<{ id: number; title: string }[]> {
  const res = await fetch(`${BASE_URL}/api/v1/chat/list`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  return data.data?.items ?? data.items ?? [];
}

async function runLevel(level: number, users: User[]): Promise<RunResult> {
  console.log(`[concurrency] testing level ${level}`);
  const start = Date.now();
  const results = await Promise.all(
    users.slice(0, level).map(async (u) => {
      try {
        u.token = await loginUser(u.username, u.password);
        const secret = `USER_${u.id}_SECRET_${Math.random().toString(36).slice(2, 8)}`;
        const { conversationId, answer } = await sendMessage(u.token, `请记住这段专属文本：${secret}`);
        return { userId: u.id, conversationId, secret, answer, error: null };
      } catch (e) {
        return { userId: u.id, conversationId: -1, secret: '', answer: '', error: e instanceof Error ? e.message : String(e) };
      }
    }),
  );

  // 隔离性检查：每个用户只能看到自己的 conversation
  let isolationPassed = true;
  const errors: string[] = [];
  for (const r of results) {
    if (r.error) {
      errors.push(r.error);
      continue;
    }
    const list = await listConversations(users.find(u => u.id === r.userId)!.token);
    const ownIds = list.map(c => c.id);
    if (!ownIds.includes(r.conversationId)) {
      isolationPassed = false;
      errors.push(`user ${r.userId} cannot see own conversation ${r.conversationId}`);
    }
    // 检查是否看到其他用户的 conversation
    const otherIds = results.filter(x => x.userId !== r.userId && x.conversationId > 0).map(x => x.conversationId);
    const leaked = ownIds.filter(id => otherIds.includes(id));
    if (leaked.length > 0) {
      isolationPassed = false;
      errors.push(`user ${r.userId} leaked conversations: ${leaked.join(',')}`);
    }
  }

  const successCount = results.filter(r => !r.error).length;
  const errorCount = results.filter(r => r.error).length;
  return {
    level,
    totalMs: Date.now() - start,
    successCount,
    errorCount,
    avgLatencyMs: successCount ? Math.round(results.filter(r => !r.error).reduce((a, b) => a + (b.answer.length > 0 ? 1 : 0), 0) / successCount) : 0,
    isolationPassed,
    errors,
  };
}

async function cleanup(users: User[]) {
  for (const u of users) {
    await prisma.conversation.deleteMany({ where: { userId: u.id } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: u.id } }).catch(() => {});
  }
}

async function main() {
  console.log('[concurrency] creating test users...');
  const maxUsers = Math.max(...CONCURRENCY_LEVELS);
  const users = await createTestUsers(maxUsers);
  console.log(`[concurrency] created ${users.length} users`);

  const report: { levels: RunResult[] } = { levels: [] };
  for (const level of CONCURRENCY_LEVELS) {
    const result = await runLevel(level, users);
    report.levels.push(result);
    console.log(`[concurrency] level ${level}: success=${result.successCount}/${level}, isolation=${result.isolationPassed}, ms=${result.totalMs}`);
    fs.writeFileSync(path.join(OUTPUT_DIR, 'concurrency-report.json'), JSON.stringify(report, null, 2));
  }

  await cleanup(users);
  await prisma.$disconnect();
  console.log('[concurrency] completed');
}

main().catch(async (e) => {
  console.error('[concurrency] fatal:', e);
  await prisma.$disconnect();
  process.exit(1);
});
