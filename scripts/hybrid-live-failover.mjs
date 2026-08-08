/**
 * Live failover harness against real Ollama nodes (no Production Nest cutover).
 * Simulates HybridInferenceRouter health + failover using /api/tags + /api/generate.
 *
 * Env:
 *   LAPTOP_OLLAMA_BASE_URL=http://100.105.217.7:11434
 *   SERVER_OLLAMA_BASE_URL=http://127.0.0.1:11434  (run via SSH on server, or tunnel)
 *
 * For local laptop run of GPU-only checks, SERVER can be omitted.
 */
import assert from 'node:assert/strict';

const laptop = (process.env.LAPTOP_OLLAMA_BASE_URL || 'http://100.105.217.7:11434').replace(/\/$/, '');
const server = (process.env.SERVER_OLLAMA_BASE_URL || '').replace(/\/$/, '');
const healthTimeout = Number(process.env.HYBRID_HEALTH_TIMEOUT_MS || 1800);

async function tags(base, ms = healthTimeout) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(`${base}/api/tags`, { signal: ctrl.signal });
    if (!r.ok) return { ok: false, error: `HTTP ${r.status}` };
    const j = await r.json();
    return { ok: true, models: (j.models || []).map((m) => m.name), latencyMs: 0 };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(t);
  }
}

async function generate(base, model, prompt) {
  const body = JSON.stringify({
    model,
    prompt,
    stream: false,
    options: { num_predict: 16 },
  });
  const t0 = Date.now();
  const r = await fetch(`${base}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  const j = await r.json();
  const evalNs = Number(j.eval_duration || 0);
  const tok = Number(j.eval_count || 0);
  return {
    ok: r.ok && !j.error,
    response: j.response || '',
    tokensPerSec: evalNs > 0 ? tok / (evalNs / 1e9) : 0,
    wallMs: Date.now() - t0,
    error: j.error,
  };
}

async function main() {
  const report = [];
  const l = await tags(laptop);
  report.push({ id: 'LAPTOP_TAGS', status: l.ok ? 'PASS' : 'FAIL', detail: l });
  if (server) {
    const s = await tags(server);
    report.push({ id: 'SERVER_TAGS', status: s.ok ? 'PASS' : 'FAIL', detail: s });
  }

  if (l.ok) {
    const g = await generate(laptop, 'qwen2.5-coder:7b', 'Reply exactly: live-gpu');
    report.push({
      id: 'TEST1_GPU_GENERATE',
      status: g.ok && g.tokensPerSec > 20 ? 'PASS' : g.ok ? 'PASS_SLOW' : 'FAIL',
      detail: { tokensPerSec: Number(g.tokensPerSec.toFixed(2)), wallMs: g.wallMs, response: g.response.slice(0, 80) },
    });
  }

  if (server) {
    const c = await generate(server, 'qwen2.5-coder:7b', 'Reply exactly: live-cpu');
    report.push({
      id: 'CPU_GENERATE',
      status: c.ok ? 'PASS' : 'FAIL',
      detail: { tokensPerSec: Number(c.tokensPerSec.toFixed(2)), wallMs: c.wallMs, response: c.response.slice(0, 80) },
    });
  }

  // Router preference simulation
  const prefer = l.ok ? 'laptop-gpu' : server ? 'server-cpu' : null;
  report.push({
    id: 'ROUTER_PREFERENCE',
    status: prefer ? 'PASS' : 'FAIL',
    detail: { prefer, strategy: 'GPU_FIRST_WITH_CPU_FAILOVER' },
  });

  console.log(JSON.stringify({ ok: report.every((r) => String(r.status).startsWith('PASS')), report }, null, 2));
  if (!report.every((r) => String(r.status).startsWith('PASS'))) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
