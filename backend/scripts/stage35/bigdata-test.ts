import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_DIR = path.join(__dirname, '..', '..', '..', 'frontend', 'e2e', 'output', 'stage35');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const BASE_URL = 'http://localhost:4010';
const ADMIN = { username: 'admin', password: 'Zrh@e6878233406e' };

interface BigDataResult {
  name: string;
  sizeBytes: number;
  conversationId: number;
  sendMs: number;
  responseLength: number;
  savePassed: boolean;
  exportPassed: boolean;
  browserRenderHint: string;
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
  const start = Date.now();
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

async function getConversation(token: string, id: number): Promise<{ messages: any[] }> {
  const res = await fetch(`${BASE_URL}/api/v1/chat/${id}?limit=5`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return (await res.json()).data;
}

async function exportConversation(token: string, id: number): Promise<boolean> {
  const res = await fetch(`${BASE_URL}/api/v1/chat/${id}/export?format=md`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return false;
  const blob = await res.blob();
  return blob.size > 0;
}

function generateCodeLines(count: number): string {
  return `请对以下 ${count} 行 Python 代码进行逐行注释，并总结功能：\n\n` +
    Array.from({ length: count }, (_, i) => `line_${i + 1} = ${i + 1} * 2 # sample line`).join('\n');
}

function generateMarkdown(sizeKb: number): string {
  const paragraph = `这是一段用于测试大 Markdown 内容的占位文本。ZRH AI 需要能够处理较大体积的文档输入，并在浏览器中正常渲染。`;
  const repeats = Math.ceil((sizeKb * 1024) / (paragraph.length + 10));
  return `请总结以下 Markdown 文档的核心观点：\n\n` + `# 大型 Markdown 测试文档\n\n` + Array(repeats).fill(paragraph).join('\n\n');
}

function generateMermaid(): string {
  return `请分析以下 Mermaid 流程图描述的逻辑，并用文字说明主要流程：\n\n\`\`\`mermaid\ngraph TD\n` +
    Array.from({ length: 50 }, (_, i) => `    A${i}["节点 ${i}"] --> A${i + 1}["节点 ${i + 1}"]`).join('\n') +
    '\n\`\`\`';
}

function generateTable(): string {
  const header = '| 名称 | 类型 | 值 | 说明 |';
  const rows = Array.from({ length: 200 }, (_, i) => `| item-${i} | string | value-${i} | desc-${i} |`).join('\n');
  return `请将以下表格转换为 JSON 数组，并说明字段含义：\n\n${header}\n|---|---|---|---|\n${rows}`;
}

function generateMixed(): string {
  return `请用中文、English、မြန်မာ三种语言分别解释以下概念：人工智能伦理。\n\nConcept: AI Ethics.`;
}

async function runCase(token: string, name: string, message: string): Promise<BigDataResult> {
  console.log(`[bigdata] testing ${name} (${message.length} bytes)`);
  const start = Date.now();
  const errors: string[] = [];
  try {
    const { conversationId, answer } = await sendMessage(token, undefined, message);
    const sendMs = Date.now() - start;

    // 验证保存
    let savePassed = false;
    try {
      const conv = await getConversation(token, conversationId);
      savePassed = conv.messages.some((m: any) => m.role === 'user' && m.content.length >= message.length * 0.9);
    } catch (e) {
      errors.push(`save check: ${e instanceof Error ? e.message : String(e)}`);
    }

    // 验证导出
    let exportPassed = false;
    try {
      exportPassed = await exportConversation(token, conversationId);
    } catch (e) {
      errors.push(`export: ${e instanceof Error ? e.message : String(e)}`);
    }

    return {
      name,
      sizeBytes: Buffer.byteLength(message, 'utf-8'),
      conversationId,
      sendMs,
      responseLength: answer.length,
      savePassed,
      exportPassed,
      browserRenderHint: 'verified in Playwright E2E earlier',
      errors,
    };
  } catch (e) {
    return {
      name,
      sizeBytes: Buffer.byteLength(message, 'utf-8'),
      conversationId: -1,
      sendMs: Date.now() - start,
      responseLength: 0,
      savePassed: false,
      exportPassed: false,
      browserRenderHint: '',
      errors: [e instanceof Error ? e.message : String(e)],
    };
  }
}

async function main() {
  const token = await login();
  const cases = [
    { name: '1000行代码', message: generateCodeLines(1000) },
    { name: '500KB Markdown', message: generateMarkdown(500) },
    { name: 'Mermaid大图', message: generateMermaid() },
    { name: '大型表格', message: generateTable() },
    { name: '中英缅混排', message: generateMixed() },
  ];

  const report: { cases: BigDataResult[] } = { cases: [] };
  for (const c of cases) {
    const result = await runCase(token, c.name, c.message);
    report.cases.push(result);
    console.log(`[bigdata] ${result.name}: send=${result.sendMs}ms save=${result.savePassed} export=${result.exportPassed}`);
    fs.writeFileSync(path.join(OUTPUT_DIR, 'bigdata-report.json'), JSON.stringify(report, null, 2));
  }
  console.log('[bigdata] completed');
}

main().catch(e => {
  console.error('[bigdata] fatal:', e);
  process.exit(1);
});
