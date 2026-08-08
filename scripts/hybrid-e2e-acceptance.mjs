/**
 * ZRHLBR Hybrid Inference V1.0 — offline acceptance self-tests
 * Covers circuit breaker + SSE failover semantics without Production cutover.
 *
 * Run: node scripts/hybrid-e2e-acceptance.mjs
 */

import assert from 'node:assert/strict';

class CircuitBreaker {
  constructor(opts) {
    this.opts = opts;
    this.state = 'CLOSED';
    this.failures = 0;
    this.openedAt = 0;
  }
  getState() {
    if (this.state === 'OPEN' && Date.now() - this.openedAt >= this.opts.openMs) {
      this.state = 'HALF_OPEN';
    }
    return this.state;
  }
  allowRequest() {
    return this.getState() !== 'OPEN';
  }
  recordSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
    this.openedAt = 0;
  }
  recordFailure() {
    this.failures += 1;
    if (this.failures >= this.opts.failureThreshold) {
      this.state = 'OPEN';
      this.openedAt = Date.now();
    }
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Simulate SSE failover rules used by HybridInferenceRouter */
function sseFailover(primaryChunks, fallbackChunks) {
  let emitted = false;
  const out = [];
  for (const c of primaryChunks) {
    if (c.type === 'delta') {
      emitted = true;
      out.push({ from: 'gpu', ...c });
    } else if (c.type === 'error') {
      if (emitted) {
        return {
          result: 'mid_stream_abort',
          code: 'AI_STREAM_PROVIDER_FAILED_NO_SPLICE',
          out,
          spliced: false,
        };
      }
      // pre-token → CPU retry
      for (const f of fallbackChunks) {
        if (f.type === 'delta') out.push({ from: 'cpu', ...f });
        if (f.type === 'done') out.push({ from: 'cpu', ...f });
        if (f.type === 'error') {
          return { result: 'unavailable', code: 'AI_SERVICE_UNAVAILABLE', out, spliced: false };
        }
      }
      return { result: 'failover_pre_token', code: null, out, spliced: false };
    } else if (c.type === 'done') {
      out.push({ from: 'gpu', ...c });
      return { result: 'ok_gpu', code: null, out, spliced: false };
    }
  }
  return { result: 'unavailable', code: 'AI_SERVICE_UNAVAILABLE', out, spliced: false };
}

async function main() {
  const results = [];

  // Circuit breaker
  const cb = new CircuitBreaker({ failureThreshold: 3, openMs: 80 });
  assert.equal(cb.allowRequest(), true);
  cb.recordFailure();
  cb.recordFailure();
  assert.equal(cb.getState(), 'CLOSED');
  cb.recordFailure();
  assert.equal(cb.getState(), 'OPEN');
  assert.equal(cb.allowRequest(), false);
  // While OPEN, would not flap to GPU
  let flap = 0;
  for (let i = 0; i < 5; i++) {
    if (!cb.allowRequest()) flap += 1; // stay on CPU path
  }
  assert.equal(flap, 5);
  await sleep(100);
  assert.equal(cb.getState(), 'HALF_OPEN');
  assert.equal(cb.allowRequest(), true);
  cb.recordSuccess();
  assert.equal(cb.getState(), 'CLOSED');
  results.push({ id: 'STEP6_CIRCUIT', status: 'PASS' });

  // TEST 8 pre-token
  const t8 = sseFailover(
    [{ type: 'error', message: 'gpu down' }],
    [{ type: 'delta', content: 'cpu-ok' }, { type: 'done' }],
  );
  assert.equal(t8.result, 'failover_pre_token');
  assert.equal(t8.out.every((x) => x.from === 'cpu' || x.type === 'done'), true);
  results.push({ id: 'TEST8_SSE_PRE_TOKEN', status: 'PASS' });

  // TEST 9 mid-stream no splice
  const t9 = sseFailover(
    [{ type: 'delta', content: 'hello' }, { type: 'error', message: 'gpu crash' }],
    [{ type: 'delta', content: 'SHOULD_NOT_APPEND' }, { type: 'done' }],
  );
  assert.equal(t9.result, 'mid_stream_abort');
  assert.equal(t9.code, 'AI_STREAM_PROVIDER_FAILED_NO_SPLICE');
  assert.equal(t9.spliced, false);
  assert.equal(t9.out.some((x) => String(x.content || '').includes('SHOULD_NOT_APPEND')), false);
  results.push({ id: 'TEST9_SSE_NO_SPLICE', status: 'PASS' });

  // Both unavailable
  const t7 = sseFailover(
    [{ type: 'error', message: 'gpu' }],
    [{ type: 'error', message: 'cpu' }],
  );
  assert.equal(t7.code, 'AI_SERVICE_UNAVAILABLE');
  results.push({ id: 'TEST7_UNAVAILABLE_SEMANTICS', status: 'PASS' });

  console.log(JSON.stringify({ ok: true, results }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
