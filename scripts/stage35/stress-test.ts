import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_DIR = path.join(__dirname, '..', '..', 'frontend', 'e2e', 'output', 'stage35');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const BASE_URL = 'http://localhost:4010';
const ADMIN = { username: 'admin', password: 'Zrh@e6878233406e' };
const DURATION_MINUTES = 120;
const TARGET_RUNS = 100;
const PROMPTS = [
  '请详细描写一座未来城市的日常生活，包括交通、工作、娱乐、教育、环境五个方面，不少于 800 字。',
  '请用中文写一份关于人工智能伦理的详细分析，包含定义、主要争议、案例、建议，不少于 800 字。',
  '请详细解释区块链技术的原理、共识机制、应用场景和风险，不少于 800 字。',
  '请描述一次完整的软件开发流程，从需求分析到上线运维，不少于 800 字。',
  '请写一份关于气候变化的科普文章，包含原因、影响、应对措施，不少于 800 字。',
];

interface Run {
  index: number;
  model: string;
  prompt: string;
  startTime: string;
  firstTokenMs: number | null;
  totalMs: number;
  tokens: number | null;
  tokenSpeed: number | null;
  status: 'done' | 'error' | 'stopped';
  error?: string;
}

interface Sample {
  time: string;
  cpu: string;
  memory: string;
  docker: { name: string; cpu: string; mem: string }[];
  redis: { usedMemory: string; connectedClients: number } | null;
  postgres: { connections: number | null; size: string | null } | null;
  ollama: { status: string; latencyMs: number } | null;
}

interface Report {
  startTime: string;
  endTime?: string;
  durationMinutes: number;
  targetRuns: number;
  completedRuns: number;
  errorRuns: number;
  runs: Run[];
  samples: Sample[];
  summary: {
    avgTotalMs: number;
    avgTokenSpeed: number;
    minTokenSpeed: number;
    maxTokenSpeed: number;
    avgFirstTokenMs: number;
  };
}

const report: Report = {
  startTime: new Date().toISOString(),
  durationMinutes: DURATION_MINUTES,
  targetRuns: TARGET_RUNS,
  completedRuns: 0,
  errorRuns: 0,
  runs: [],
  samples: [],
  summary: {
    avgTotalMs: 0,
    avgTokenSpeed: 0,
    minTokenSpeed: 0,
    maxTokenSpeed: 0,
    avgFirstTokenMs: 0,
  },
};

const startTime = Date.now();

function sh(cmd: string): string {
  try {
    return execSync(cmd, { encoding: 'utf-8' }).trim();
  } catch (e) {
    return '';
  }
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

let tokens: AuthTokens | null = null;

async function login(): Promise<AuthTokens> {
  const res = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ADMIN),
  });
  const data = await res.json();
  const t = data.data;
  // accessTokenExpiresIn 单位为秒，默认 30 分钟
  return {
    accessToken: t.accessToken,
    refreshToken: t.refreshToken,
    expiresAt: Date.now() + (t.accessTokenExpiresIn || 30 * 60) * 1000,
  };
}

async function ensureToken(): Promise<string> {
  if (!tokens) {
    tokens = await login();
    return tokens.accessToken;
  }
  // 提前 2 分钟刷新
  if (Date.now() > tokens.expiresAt - 120_000) {
    try {
      const res = await fetch(`${BASE_URL}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: tokens.refreshToken }),
      });
      const data = await res.json();
      const t = data.data;
      tokens = {
        accessToken: t.accessToken,
        refreshToken: t.refreshToken,
        expiresAt: Date.now() + (t.accessTokenExpiresIn || 30 * 60) * 1000,
      };
    } catch {
      tokens = await login();
    }
  }
  return tokens.accessToken;
}

async function sampleMetrics(): Promise<Sample> {
  const dockerStats = sh('docker stats --no-stream --format "{{.Name}}|{{.CPUPerc}}|{{.MemUsage}}" zrh-ai-api zrh-ai-web zrh-ai-postgres zrh-ai-redis');
  const docker = dockerStats.split('\n').filter(l => l.includes('|')).map(l => {
    const [name, cpu, mem] = l.split('|');
    return { name, cpu, mem };
  });

  // Redis 信息
  let redis: Sample['redis'] = null;
  try {
    const redisPwd = sh('docker exec zrh-ai-redis printenv REDIS_PASSWORD');
    const redisInfo = sh(`docker exec zrh-ai-redis redis-cli -a "${redisPwd}" --no-auth-warning INFO memory`);
    const used = redisInfo.match(/used_memory_human:(.+)/)?.[1]?.trim();
    const clients = redisInfo.match(/connected_clients:(\d+)/)?.[1];
    redis = { usedMemory: used || '', connectedClients: clients ? parseInt(clients) : 0 };
  } catch { /* ignore */ }

  // Postgres 连接数与大小
  let postgres: Sample['postgres'] = null;
  try {
    const conn = sh('docker exec zrh-ai-postgres psql -U zrh_ai -d zrh_ai -t -c "SELECT count(*) FROM pg_stat_activity;"');
    const size = sh("docker exec zrh-ai-postgres psql -U zrh_ai -d zrh_ai -t -c \"SELECT pg_size_pretty(pg_database_size('zrh_ai'));\"");
    postgres = { connections: parseInt(conn.trim()) || null, size: size.trim() || null };
  } catch { /* ignore */ }

  // Ollama 健康
  let ollama: Sample['ollama'] = null;
  try {
    const t0 = Date.now();
    const res = await fetch('http://localhost:11434/api/tags');
    ollama = { status: res.ok ? 'online' : 'offline', latencyMs: Date.now() - t0 };
  } catch {
    ollama = { status: 'offline', latencyMs: -1 };
  }

  // 宿主机 CPU / Memory（简化：取 Node process + loadavg）
  const load = sh('powershell -Command "(Get-Counter \'\\Processor(_Total)\\% Processor Time\').CounterSamples.CookedValue"');
  const mem = sh('powershell -Command "$p = Get-Counter \'\\Memory\\Available MBytes\'; $p.CounterSamples.CookedValue"');

  return {
    time: new Date().toISOString(),
    cpu: load || '',
    memory: mem ? `${mem} MB available` : '',
    docker,
    redis,
    postgres,
    ollama,
  };
}

async function runConversation(index: number): Promise<Run> {
  const model = index % 3 === 0 ? 'qwen3:8b' : index % 3 === 1 ? 'deepseek-r1:8b' : 'deepseek-coder:latest';
  const prompt = PROMPTS[index % PROMPTS.length];
  const start = Date.now();
  let firstTokenMs: number | null = null;
  let tokens = 0;
  let status: Run['status'] = 'done';
  let error: string | undefined;

  try {
    let token = await ensureToken();
    let res = await fetch(`${BASE_URL}/api/v1/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ message: prompt, model }),
    });
    if (res.status === 401) {
      tokens = null;
      token = await ensureToken();
      res = await fetch(`${BASE_URL}/api/v1/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: prompt, model }),
      });
    }
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
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
          if (event.type === 'delta') {
            if (firstTokenMs === null) firstTokenMs = Date.now() - start;
            tokens += 1;
          } else if (event.type === 'done') {
            if (event.completionTokens) tokens = event.completionTokens;
            status = event.status || 'done';
          } else if (event.type === 'error') {
            status = 'error';
            error = event.message;
          }
        } catch { /* ignore */ }
      }
    }
  } catch (e) {
    status = 'error';
    error = e instanceof Error ? e.message : String(e);
  }

  const totalMs = Date.now() - start;
  const tokenSpeed = tokens && totalMs > 0 ? (tokens / (totalMs / 1000)) : null;
  return {
    index,
    model,
    prompt,
    startTime: new Date(start).toISOString(),
    firstTokenMs,
    totalMs,
    tokens,
    tokenSpeed,
    status,
    error,
  };
}

async function main() {
  console.log(`[stress] logging in...`);
  tokens = await login();
  console.log(`[stress] start ${DURATION_MINUTES} min stress test, target ${TARGET_RUNS} runs`);

  const endTime = Date.now() + DURATION_MINUTES * 60 * 1000;
  let runIndex = 0;

  // 采样任务：每 30 秒一次
  const sampleInterval = setInterval(async () => {
    const s = await sampleMetrics();
    report.samples.push(s);
    fs.writeFileSync(path.join(OUTPUT_DIR, 'stress-report.json'), JSON.stringify(report, null, 2));
  }, 30_000);

  // 对话任务：平均间隔约 72 秒，120 分钟完成 100 次
  const intervalMs = (DURATION_MINUTES * 60 * 1000) / TARGET_RUNS;

  while (Date.now() < endTime && runIndex < TARGET_RUNS) {
    const run = await runConversation(runIndex++);
    report.runs.push(run);
    if (run.status === 'done') report.completedRuns++;
    else report.errorRuns++;
    console.log(`[stress] run ${run.index} ${run.status} ${run.totalMs}ms tokens=${run.tokens} speed=${run.tokenSpeed?.toFixed(2) || '-'}`);
    fs.writeFileSync(path.join(OUTPUT_DIR, 'stress-report.json'), JSON.stringify(report, null, 2));

    const nextStart = startTime + (runIndex + 1) * intervalMs;
    const wait = Math.max(0, nextStart - Date.now());
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
  }

  clearInterval(sampleInterval);
  report.endTime = new Date().toISOString();

  // 汇总
  const done = report.runs.filter(r => r.status === 'done');
  const speeds = done.map(r => r.tokenSpeed).filter((v): v is number => v !== null);
  const firstTokens = done.map(r => r.firstTokenMs).filter((v): v is number => v !== null);
  report.summary = {
    avgTotalMs: done.length ? done.reduce((a, b) => a + b.totalMs, 0) / done.length : 0,
    avgTokenSpeed: speeds.length ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0,
    minTokenSpeed: speeds.length ? Math.min(...speeds) : 0,
    maxTokenSpeed: speeds.length ? Math.max(...speeds) : 0,
    avgFirstTokenMs: firstTokens.length ? firstTokens.reduce((a, b) => a + b, 0) / firstTokens.length : 0,
  };

  fs.writeFileSync(path.join(OUTPUT_DIR, 'stress-report.json'), JSON.stringify(report, null, 2));
  console.log('[stress] completed', report.summary);
}

main().catch(e => {
  console.error('[stress] fatal:', e);
  process.exit(1);
});
