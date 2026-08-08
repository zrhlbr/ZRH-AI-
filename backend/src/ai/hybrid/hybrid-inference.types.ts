/**
 * ZRHLBR Hybrid Inference V1.0 — types
 * Laptop RTX 5060 (priority) + SA5212M5 CPU (failover)
 */

export type HybridNodeId = 'laptop-gpu' | 'server-cpu';

export type HybridNodeHealthStatus = 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'RECOVERING' | 'DISABLED';

export type HybridRoutingMode = 'AUTO' | 'GPU_ONLY' | 'CPU_ONLY';

export type HybridCircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface HybridNodeRuntime {
  id: HybridNodeId;
  label: string;
  providerCode: string;
  connection: 'tailscale' | 'localhost' | 'private';
  enabled: boolean;
  health: HybridNodeHealthStatus;
  circuit: HybridCircuitState;
  lastLatencyMs: number | null;
  lastSeenAt: string | null;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  lastError: string | null;
  lastTtftMs: number | null;
  lastTokensPerSec: number | null;
}

export interface HybridInfraSnapshot {
  enabled: boolean;
  routingMode: HybridRoutingMode;
  strategy: 'GPU_FIRST_WITH_CPU_FAILOVER';
  currentPreferred: HybridNodeId | null;
  nodes: HybridNodeRuntime[];
  /** Internal URLs only for SUPER_ADMIN — never expose to USER APIs */
  internal?: {
    laptopOllamaBaseUrl: string;
    serverOllamaBaseUrl: string;
  };
}

export interface HybridRouteDecision {
  nodeId: HybridNodeId;
  providerCode: string;
  modelName: string;
  logicalModel: string;
  reason: string;
  fallbackAvailable: boolean;
}

export type HybridStreamOutcome =
  | { kind: 'ok'; nodeId: HybridNodeId; providerCode: string; modelName: string }
  | { kind: 'failover_pre_token'; from: HybridNodeId; to: HybridNodeId; error: string }
  | { kind: 'unavailable'; error: string; code: 'AI_SERVICE_UNAVAILABLE' }
  | {
      kind: 'mid_stream_abort';
      nodeId: HybridNodeId;
      error: string;
      code: 'AI_STREAM_PROVIDER_FAILED_NO_SPLICE';
    };
