/**
 * Phase 0.5 code-model benchmark — qwen2.5-coder:7b via local Ollama.
 * Runs on the host:  node docs/code-engineer-v1/benchmark-phase05.js
 * Writes docs/code-engineer-v1/benchmarks-phase05.json with raw responses
 * and timing (tok/s from Ollama eval_count/eval_duration).
 */
const fs = require('fs');
const path = require('path');

const OLLAMA = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const MODEL = process.env.BENCH_MODEL || 'qwen2.5-coder:7b';

const TASKS = [
  {
    id: 'ts-single-file-fix',
    title: 'TS 单文件修复',
    prompt:
      'This TypeScript function has a bug. Fix it and explain in one sentence.\n\n' +
      '```ts\nfunction sum(nums: number[]): number {\n  let total = 0;\n  for (let i = 0; i <= nums.length; i++) {\n    total += nums[i];\n  }\n  return total;\n}\n```\n' +
      'Return only the fixed function in a code block, then the one-sentence explanation.',
  },
  {
    id: 'react-component',
    title: 'React 组件生成',
    prompt:
      'Write a React + TypeScript function component `SearchBox` with props { onSearch: (q: string) => void; placeholder?: string }. ' +
      'It must debounce input by 300ms using useEffect/useRef, show a clear button when non-empty, and be accessible (label + aria). Return a single tsx code block.',
  },
  {
    id: 'nestjs-controller-service',
    title: 'NestJS Controller/Service',
    prompt:
      'Write a NestJS controller `ProjectsController` and injectable `ProjectsService` for a CRUD resource `Project` { id: number; name: string }. ' +
      'Service keeps an in-memory array; controller exposes GET /projects, GET /projects/:id, POST /projects. Use ParseIntPipe. Return two code blocks.',
  },
  {
    id: 'prisma-schema-advice',
    title: 'Prisma schema 建议',
    prompt:
      'Given this Prisma model, point out up to 3 concrete problems (indexing, relations, integrity) and show the improved model.\n\n' +
      '```prisma\nmodel Order {\n  id Int @id @default(autoincrement())\n  userId Int\n  items String\n  total Float\n  createdAt DateTime @default(now())\n}\n```',
  },
  {
    id: 'unit-test-generation',
    title: '单测生成',
    prompt:
      'Write Jest unit tests for this function covering normal, empty, and negative cases:\n\n' +
      '```ts\nexport function clamp(v: number, min: number, max: number): number {\n  if (min > max) throw new Error("min>max");\n  return Math.min(Math.max(v, min), max);\n}\n```\n' +
      'Return one code block.',
  },
  {
    id: 'multi-file-impact',
    title: '多文件影响分析',
    prompt:
      'A function `getUserById(id)` in `src/users/user.service.ts` is used by `src/auth/auth.service.ts`, `src/admin/admin.controller.ts`, and `src/billing/billing.worker.ts`. ' +
      'If its return type changes from `User` to `User | null`, list the concrete code changes needed in each consumer file (short bullets), then the safest rollout order.',
  },
];

async function runTask(task) {
  const started = Date.now();
  const res = await fetch(`${OLLAMA}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: task.prompt }],
      stream: false,
      options: { num_predict: 640, temperature: 0.2 },
    }),
  });
  if (!res.ok) throw new Error(`ollama HTTP ${res.status}`);
  const json = await res.json();
  const wallMs = Date.now() - started;
  const evalCount = json.eval_count || 0;
  const evalTps = json.eval_duration ? +(evalCount / (json.eval_duration / 1e9)).toFixed(1) : null;
  return {
    id: task.id,
    title: task.title,
    wallMs,
    evalTokens: evalCount,
    evalTokPerSec: evalTps,
    loadMs: json.load_duration ? Math.round(json.load_duration / 1e6) : null,
    totalMs: json.total_duration ? Math.round(json.total_duration / 1e6) : null,
    response: (json.message && json.message.content) || '',
  };
}

async function main() {
  const out = { model: MODEL, ollama: OLLAMA, runAt: new Date().toISOString(), tasks: [] };
  for (const t of TASKS) {
    process.stdout.write(`running ${t.id} ... `);
    const r = await runTask(t);
    console.log(`${r.evalTokPerSec} tok/s, ${r.evalTokens} tokens`);
    out.tasks.push(r);
  }
  const file = path.join(__dirname, 'benchmarks-phase05.json');
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  console.log(`saved ${file}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
