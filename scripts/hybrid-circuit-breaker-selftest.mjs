/**
 * Lightweight self-test for Hybrid circuit breaker semantics (no Jest dependency).
 * Run: node scripts/hybrid-circuit-breaker-selftest.mjs
 */

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

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const cb = new CircuitBreaker({ failureThreshold: 3, openMs: 50 });
assert(cb.allowRequest() === true, 'closed allows');
cb.recordFailure();
cb.recordFailure();
assert(cb.getState() === 'CLOSED', 'not open yet');
cb.recordFailure();
assert(cb.getState() === 'OPEN', 'opens at 3');
assert(cb.allowRequest() === false, 'open blocks');
await new Promise((r) => setTimeout(r, 60));
assert(cb.getState() === 'HALF_OPEN', 'half open after cool-down');
assert(cb.allowRequest() === true, 'half open allows probe');
cb.recordSuccess();
assert(cb.getState() === 'CLOSED', 'success closes');
console.log('PASS hybrid-circuit-breaker-selftest');
