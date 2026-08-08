import { HybridCircuitState } from './hybrid-inference.types';

export interface CircuitBreakerOptions {
  failureThreshold: number;
  openMs: number;
}

/**
 * Simple circuit breaker for GPU provider jitter control.
 * CLOSED → OPEN after N consecutive inference failures;
 * OPEN → HALF_OPEN after cool-down; probe success → CLOSED.
 */
export class CircuitBreaker {
  private state: HybridCircuitState = 'CLOSED';
  private failures = 0;
  private openedAt = 0;

  constructor(private readonly opts: CircuitBreakerOptions) {}

  getState(): HybridCircuitState {
    this.maybeHalfOpen();
    return this.state;
  }

  getFailures(): number {
    return this.failures;
  }

  allowRequest(): boolean {
    const state = this.getState();
    if (state === 'OPEN') return false;
    return true;
  }

  recordSuccess(): void {
    this.failures = 0;
    this.state = 'CLOSED';
    this.openedAt = 0;
  }

  recordFailure(): void {
    this.failures += 1;
    if (this.failures >= this.opts.failureThreshold) {
      this.state = 'OPEN';
      this.openedAt = Date.now();
    }
  }

  forceOpen(): void {
    this.state = 'OPEN';
    this.openedAt = Date.now();
  }

  reset(): void {
    this.failures = 0;
    this.state = 'CLOSED';
    this.openedAt = 0;
  }

  private maybeHalfOpen(): void {
    if (this.state !== 'OPEN') return;
    if (Date.now() - this.openedAt >= this.opts.openMs) {
      this.state = 'HALF_OPEN';
    }
  }
}
