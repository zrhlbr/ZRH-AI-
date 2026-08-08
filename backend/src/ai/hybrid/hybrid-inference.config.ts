import { HybridRoutingMode } from './hybrid-inference.types';

function envBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return /^(1|true|yes|on)$/i.test(raw.trim());
}

function envInt(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/**
 * Hybrid inference configuration (server-side only).
 * Default: disabled — Production keeps legacy OLLAMA_BASE_URL path until 赵总批准切换.
 */
export function loadHybridConfig() {
  const routingRaw = (process.env.HYBRID_ROUTING_MODE ?? 'AUTO').trim().toUpperCase();
  const routingMode: HybridRoutingMode =
    routingRaw === 'GPU_ONLY' || routingRaw === 'CPU_ONLY' || routingRaw === 'AUTO'
      ? routingRaw
      : 'AUTO';

  return {
    enabled: envBool('HYBRID_INFERENCE_ENABLED', false),
    routingMode,
    laptopBaseUrl: (process.env.LAPTOP_OLLAMA_BASE_URL ?? '').replace(/\/$/, ''),
    serverBaseUrl: (
      process.env.SERVER_OLLAMA_BASE_URL ??
      process.env.OLLAMA_BASE_URL ??
      'http://127.0.0.1:11434'
    ).replace(/\/$/, ''),
    laptopEnabled: envBool('HYBRID_LAPTOP_ENABLED', true),
    serverEnabled: envBool('HYBRID_SERVER_CPU_ENABLED', true),
    healthIntervalMs: envInt('HYBRID_HEALTH_INTERVAL_MS', 15000),
    healthTimeoutMs: envInt('HYBRID_HEALTH_TIMEOUT_MS', 1800),
    unhealthyAfterFailures: envInt('HYBRID_UNHEALTHY_FAILURES', 2),
    recoverAfterSuccesses: envInt('HYBRID_RECOVER_SUCCESSES', 3),
    circuitFailureThreshold: envInt('HYBRID_CIRCUIT_FAILURES', 3),
    circuitOpenMs: envInt('HYBRID_CIRCUIT_OPEN_MS', 45000),
    modelMap: {
      'chat-default': process.env.HYBRID_MODEL_CHAT ?? 'qwen3:8b',
      'coder-default': process.env.HYBRID_MODEL_CODER ?? 'qwen2.5-coder:7b',
    } as Record<string, string>,
  };
}

export type HybridConfig = ReturnType<typeof loadHybridConfig>;
