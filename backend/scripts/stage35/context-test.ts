import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_DIR = path.join(__dirname, '..', '..', '..', 'frontend', 'e2e', 'output', 'stage35');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const BASE_URL = 'http://localhost:4010';
const ADMIN = { username: 'admin', password: 'Zrh@e6878233406e' };
const LEVELS = [20, 50, 100];

interface ContextTestResult {
  level: number;
  conversationId: number;
  totalMs: number;
  correctRecall: boolean;
  newConversationIsolated: boolean;
  errors: string[];
}

async function login(): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ADMIN),
  });
  const data = await res.json();
  return data.data.accessToken;
}

async function sendMessage(token: string, conversationId: number | undefined, message: string): Promise<{ conversationId: number; answer: string }> {
  const body: any = { message };
  if (conversationId) body.conversationId = conversationId;
  const res = await fetch(`${BASE_URL}/api/v1/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let cid: number | null = null;
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
        if (event.type === 'meta') cid = event.conversationId;
        if (event.type === 'delta') answer += event.content;
      } catch { /* ignore */ }
    }
  }
  if (!cid) throw new Error('no conversationId');
  return { conversationId: cid, answer };
}

async function runLevel(token: string, level: number): Promise<ContextTestResult> {
  console.log(`[context] testing ${level} rounds...`);
  const start = Date.now();
  const errors: string[] = [];
  const secret = `SECRET_${Date.now()}`;

  // 第一轮：埋下秘密
  const first = await sendMessage(token, undefined, `请记住这段文本：${secret}`);
  let conversationId = first.conversationId;

  // 中间轮：闲聊
  for (let i = 2; i <= level - 1; i++) {
    try {
      await sendMessage(token, conversationId, `请用一句话总结数字 ${i} 的特点`);
    } catch (e) {
      errors.push(`round ${i}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // 最后一轮：测试上下文记忆
  let correctRecall = false;
  try {
    const last = await sendMessage(token, conversationId, `我之前让你记住了一段文本，内容是什么？`);
    correctRecall = last.answer.includes(secret);
    if (!correctRecall) errors.push('context recall failed');
  } catch (e) {
    errors.push(`recall: ${e instanceof Error ? e.message : String(e)}`);
  }

  // 新建对话，测试隔离
  let newConversationIsolated = false;
  try {
    const fresh = await sendMessage(token, undefined, `我之前让你记住了一段文本，内容是什么？`);
    newConversationIsolated = !fresh.answer.includes(secret);
    if (!newConversationIsolated) errors.push('new conversation inherited old context');
  } catch (e) {
    errors.push(`isolation: ${e instanceof Error ? e.message : String(e)}`);
  }

  return {
    level,
    conversationId,
    totalMs: Date.now() - start,
    correctRecall,
    newConversationIsolated,
    errors,
  };
}

async function main() {
  const token = await login();
  const report: { levels: ContextTestResult[] } = { levels: [] };
  for (const level of LEVELS) {
    const result = await runLevel(token, level);
    report.levels.push(result);
    console.log(`[context] level ${level}: recall=${result.correctRecall}, isolated=${result.newConversationIsolated}, ms=${result.totalMs}`);
    fs.writeFileSync(path.join(OUTPUT_DIR, 'context-report.json'), JSON.stringify(report, null, 2));
  }
  console.log('[context] completed');
}

main().catch(e => {
  console.error('[context] fatal:', e);
  process.exit(1);
});
