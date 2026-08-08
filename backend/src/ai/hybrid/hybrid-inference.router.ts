import { Injectable, Logger, OnModuleDestroy, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { Observable, Subscriber } from 'rxjs';
import { OllamaProvider } from '../providers/ollama.provider';
import { AIGenerationOptions, AIMessage, AIStreamChunk } from '../types/ai.types';
import { CircuitBreaker } from './circuit-breaker';
import { HybridConfig, loadHybridConfig } from './hybrid-inference.config';
import {
  HybridInfraSnapshot,
  HybridNodeHealthStatus,
  HybridNodeId,
  HybridNodeRuntime,
  HybridRouteDecision,
  HybridRoutingMode,
  HybridStreamOutcome,
} from './hybrid-inference.types';

interface NodeState {
  id: HybridNodeId;
  label: string;
  connection: 'tailscale' | 'localhost' | 'private';
  provider: OllamaProvider;
  enabled: boolean;
  health: HybridNodeHealthStatus;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  lastLatencyMs: number | null;
  lastSeenAt: string | null;
  lastError: string | null;
  lastTtftMs: number | null;
  lastTokensPerSec: number | null;
  circuit: CircuitBreaker;
}

/**
 * HybridInferenceRouter — GPU-first with CPU failover.
 * Feature-flagged via HYBRID_INFERENCE_ENABLED (default false).
 */
@Injectable()
export class HybridInferenceRouter implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HybridInferenceRouter.name);
  private config: HybridConfig = loadHybridConfig();
  private nodes = new Map<HybridNodeId, NodeState>();
  private routingMode: HybridRoutingMode = 'AUTO';
  private healthTimer: NodeJS.Timeout | null = null;
  private probing = false;

  constructor() {
    // Build nodes immediately so AIGateway can register providers in its constructor.
    this.reloadConfig();
  }

  onModuleInit(): void {
    if (this.config.enabled) {
      this.startHealthLoop();
      void this.probeAll();
    }
  }

  onModuleDestroy(): void {
    if (this.healthTimer) clearInterval(this.healthTimer);
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  reloadConfig(): void {
    this.config = loadHybridConfig();
    this.routingMode = this.config.routingMode;
    this.nodes.clear();

    if (this.config.laptopBaseUrl) {
      this.nodes.set('laptop-gpu', {
        id: 'laptop-gpu',
        label: 'Laptop RTX 5060',
        connection: 'tailscale',
        provider: new OllamaProvider({
          code: 'laptop-gpu',
          baseUrl: this.config.laptopBaseUrl,
          healthTimeoutMs: this.config.healthTimeoutMs,
          loggerName: 'OllamaProvider:laptop-gpu',
        }),
        enabled: this.config.laptopEnabled,
        health: 'UNHEALTHY',
        consecutiveFailures: 0,
        consecutiveSuccesses: 0,
        lastLatencyMs: null,
        lastSeenAt: null,
        lastError: null,
        lastTtftMs: null,
        lastTokensPerSec: null,
        circuit: new CircuitBreaker({
          failureThreshold: this.config.circuitFailureThreshold,
          openMs: this.config.circuitOpenMs,
        }),
      });
    }

    this.nodes.set('server-cpu', {
      id: 'server-cpu',
      label: 'SA5212M5 CPU',
      connection: this.config.serverBaseUrl.includes('127.0.0.1') || this.config.serverBaseUrl.includes('localhost')
        ? 'localhost'
        : 'private',
      provider: new OllamaProvider({
        code: 'server-cpu',
        baseUrl: this.config.serverBaseUrl,
        healthTimeoutMs: this.config.healthTimeoutMs,
        loggerName: 'OllamaProvider:server-cpu',
      }),
      enabled: this.config.serverEnabled,
      health: 'UNHEALTHY',
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      lastLatencyMs: null,
      lastSeenAt: null,
      lastError: null,
      lastTtftMs: null,
      lastTokensPerSec: null,
      circuit: new CircuitBreaker({
        failureThreshold: this.config.circuitFailureThreshold,
        openMs: this.config.circuitOpenMs,
      }),
    });

    if (this.config.enabled) {
      this.startHealthLoop();
    } else if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = null;
    }
  }

  getProvider(nodeId: HybridNodeId): OllamaProvider | undefined {
    return this.nodes.get(nodeId)?.provider;
  }

  resolveLogicalModel(modelRef?: string): { logicalModel: string; modelName: string } {
    const raw = (modelRef ?? 'chat-default').trim();
    if (this.config.modelMap[raw]) {
      return { logicalModel: raw, modelName: this.config.modelMap[raw] };
    }
    // Strip known provider prefixes for hybrid physical model names
    const stripped = raw.replace(/^(ollama|laptop-gpu|server-cpu):/, '');
    if (this.config.modelMap[stripped]) {
      return { logicalModel: stripped, modelName: this.config.modelMap[stripped] };
    }
    return { logicalModel: stripped || 'chat-default', modelName: stripped || this.config.modelMap['chat-default'] };
  }

  decide(modelRef?: string): HybridRouteDecision {
    const { logicalModel, modelName } = this.resolveLogicalModel(modelRef);
    const order = this.candidateOrder();
    for (const id of order) {
      const node = this.nodes.get(id);
      if (!node || !node.enabled) continue;
      if (node.health === 'DISABLED' || node.health === 'UNHEALTHY') continue;
      if (id === 'laptop-gpu' && !node.circuit.allowRequest()) continue;
      if (node.health === 'RECOVERING' && id === 'laptop-gpu') continue;
      return {
        nodeId: id,
        providerCode: node.provider.code,
        modelName,
        logicalModel,
        reason: `hybrid:${this.routingMode}:${id}`,
        fallbackAvailable: order.some((other) => other !== id && this.isNodeUsable(other)),
      };
    }

    // Last resort: allow HALF_OPEN / DEGRADED GPU if CPU also down
    for (const id of order) {
      const node = this.nodes.get(id);
      if (!node || !node.enabled) continue;
      if (node.health === 'DISABLED') continue;
      if (node.circuit.getState() === 'OPEN') continue;
      return {
        nodeId: id,
        providerCode: node.provider.code,
        modelName,
        logicalModel,
        reason: `hybrid:degraded:${id}`,
        fallbackAvailable: false,
      };
    }

    throw new ServiceUnavailableException({
      code: 'AI_SERVICE_UNAVAILABLE',
      message: 'No healthy inference node available',
    });
  }

  /**
   * Stream with SSE failover rules:
   * A/B: pre-first-token failure → CPU retry
   * C: post-token failure → abort, no CPU splice
   */
  streamWithFailover(
    messages: AIMessage[],
    modelRef: string | undefined,
    options: AIGenerationOptions | undefined,
    context?: { conversationId?: number },
  ): {
    providerCode: string;
    modelName: string;
    nodeId: HybridNodeId;
    stream: Observable<AIStreamChunk>;
    outcomeHint: () => HybridStreamOutcome | null;
  } {
    const decision = this.decide(modelRef);
    let outcome: HybridStreamOutcome | null = null;

    const stream = new Observable<AIStreamChunk>((subscriber) => {
      const run = async () => {
        const primary = this.nodes.get(decision.nodeId);
        if (!primary) {
          outcome = { kind: 'unavailable', error: 'primary node missing', code: 'AI_SERVICE_UNAVAILABLE' };
          subscriber.next({ type: 'error', message: 'AI_SERVICE_UNAVAILABLE' });
          subscriber.complete();
          return;
        }

        const primaryResult = await this.consumeAttempt(
          primary,
          messages,
          decision.modelName,
          options,
          context,
          subscriber,
          { allowEmit: true },
        );

        if (primaryResult.status === 'ok') {
          this.recordInferenceSuccess(primary.id, primaryResult.ttftMs, primaryResult.tokensPerSec);
          outcome = {
            kind: 'ok',
            nodeId: primary.id,
            providerCode: primary.provider.code,
            modelName: decision.modelName,
          };
          subscriber.complete();
          return;
        }

        if (primaryResult.status === 'mid_stream') {
          this.recordInferenceFailure(primary.id, primaryResult.error);
          outcome = {
            kind: 'mid_stream_abort',
            nodeId: primary.id,
            error: primaryResult.error,
            code: 'AI_STREAM_PROVIDER_FAILED_NO_SPLICE',
          };
          subscriber.next({
            type: 'error',
            message: 'AI_STREAM_PROVIDER_FAILED_NO_SPLICE: provider failed after tokens; regenerate required',
          });
          subscriber.complete();
          return;
        }

        // Pre-token failure — try CPU failover once
        this.recordInferenceFailure(primary.id, primaryResult.error);
        const fallbackId = this.pickFallback(primary.id);
        if (!fallbackId) {
          outcome = {
            kind: 'unavailable',
            error: primaryResult.error,
            code: 'AI_SERVICE_UNAVAILABLE',
          };
          subscriber.next({ type: 'error', message: 'AI_SERVICE_UNAVAILABLE' });
          subscriber.complete();
          return;
        }

        const fallback = this.nodes.get(fallbackId)!;
        this.logger.warn(
          `hybrid pre-token failover ${primary.id} → ${fallbackId}: ${primaryResult.error}`,
        );
        const fb = await this.consumeAttempt(
          fallback,
          messages,
          decision.modelName,
          options,
          context,
          subscriber,
          { allowEmit: true },
        );
        if (fb.status === 'ok') {
          this.recordInferenceSuccess(fallback.id, fb.ttftMs, fb.tokensPerSec);
          outcome = {
            kind: 'failover_pre_token',
            from: primary.id,
            to: fallback.id,
            error: primaryResult.error,
          };
          subscriber.complete();
          return;
        }
        this.recordInferenceFailure(fallback.id, fb.error);
        outcome = {
          kind: 'unavailable',
          error: fb.error,
          code: 'AI_SERVICE_UNAVAILABLE',
        };
        subscriber.next({ type: 'error', message: 'AI_SERVICE_UNAVAILABLE' });
        subscriber.complete();
      };

      void run();
      return () => {
        if (context?.conversationId !== undefined) {
          for (const node of this.nodes.values()) {
            node.provider.stop(context.conversationId);
          }
        }
      };
    });

    return {
      providerCode: decision.providerCode,
      modelName: decision.modelName,
      nodeId: decision.nodeId,
      stream,
      outcomeHint: () => outcome,
    };
  }

  async generateWithFailover(
    messages: AIMessage[],
    modelRef?: string,
    options?: AIGenerationOptions,
  ): Promise<{ text: string; nodeId: HybridNodeId; providerCode: string; modelName: string }> {
    const decision = this.decide(modelRef);
    const order = [decision.nodeId, ...this.candidateOrder().filter((id) => id !== decision.nodeId)];
    let lastError = 'unknown';
    for (const id of order) {
      if (!this.isNodeUsable(id) && id !== decision.nodeId) continue;
      const node = this.nodes.get(id);
      if (!node || !node.enabled) continue;
      try {
        const text = await node.provider.generate(messages, decision.modelName, options);
        this.recordInferenceSuccess(id, null, null);
        return { text, nodeId: id, providerCode: node.provider.code, modelName: decision.modelName };
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        this.recordInferenceFailure(id, lastError);
      }
    }
    throw new ServiceUnavailableException({
      code: 'AI_SERVICE_UNAVAILABLE',
      message: lastError.slice(0, 300),
    });
  }

  stop(conversationId: number): boolean {
    let stopped = false;
    for (const node of this.nodes.values()) {
      if (node.provider.stop(conversationId)) stopped = true;
    }
    return stopped;
  }

  setRoutingMode(mode: HybridRoutingMode): void {
    this.routingMode = mode;
  }

  setNodeEnabled(nodeId: HybridNodeId, enabled: boolean): void {
    const node = this.nodes.get(nodeId);
    if (!node) return;
    node.enabled = enabled;
    if (!enabled) node.health = 'DISABLED';
    else if (node.health === 'DISABLED') node.health = 'RECOVERING';
  }

  getSnapshot(includeInternal: boolean): HybridInfraSnapshot {
    const nodes: HybridNodeRuntime[] = Array.from(this.nodes.values()).map((n) => ({
      id: n.id,
      label: n.label,
      providerCode: n.provider.code,
      connection: n.connection,
      enabled: n.enabled,
      health: n.health,
      circuit: n.circuit.getState(),
      lastLatencyMs: n.lastLatencyMs,
      lastSeenAt: n.lastSeenAt,
      consecutiveFailures: n.consecutiveFailures,
      consecutiveSuccesses: n.consecutiveSuccesses,
      lastError: n.lastError,
      lastTtftMs: n.lastTtftMs,
      lastTokensPerSec: n.lastTokensPerSec,
    }));

    const preferred = (() => {
      try {
        return this.decide('chat-default').nodeId;
      } catch {
        return null;
      }
    })();

    const snap: HybridInfraSnapshot = {
      enabled: this.config.enabled,
      routingMode: this.routingMode,
      strategy: 'GPU_FIRST_WITH_CPU_FAILOVER',
      currentPreferred: preferred,
      nodes,
    };
    if (includeInternal) {
      snap.internal = {
        laptopOllamaBaseUrl: this.config.laptopBaseUrl || '(unset)',
        serverOllamaBaseUrl: this.config.serverBaseUrl,
      };
    }
    return snap;
  }

  private candidateOrder(): HybridNodeId[] {
    if (this.routingMode === 'GPU_ONLY') return ['laptop-gpu'];
    if (this.routingMode === 'CPU_ONLY') return ['server-cpu'];
    return ['laptop-gpu', 'server-cpu'];
  }

  private isNodeUsable(id: HybridNodeId): boolean {
    const node = this.nodes.get(id);
    if (!node || !node.enabled) return false;
    if (node.health === 'DISABLED' || node.health === 'UNHEALTHY' || node.health === 'RECOVERING') return false;
    if (id === 'laptop-gpu' && !node.circuit.allowRequest()) return false;
    return node.health === 'HEALTHY' || node.health === 'DEGRADED';
  }

  private pickFallback(failed: HybridNodeId): HybridNodeId | null {
    if (this.routingMode === 'GPU_ONLY') return null;
    for (const id of this.candidateOrder()) {
      if (id === failed) continue;
      if (this.isNodeUsable(id)) return id;
      const node = this.nodes.get(id);
      // Allow attempting CPU even if health unknown / degraded when GPU just failed
      if (node?.enabled && node.health !== 'DISABLED' && node.circuit.allowRequest()) return id;
    }
    return null;
  }

  private startHealthLoop(): void {
    if (this.healthTimer) clearInterval(this.healthTimer);
    this.healthTimer = setInterval(() => {
      void this.probeAll();
    }, this.config.healthIntervalMs);
  }

  private async probeAll(): Promise<void> {
    if (this.probing) return;
    this.probing = true;
    try {
      await Promise.all(Array.from(this.nodes.keys()).map((id) => this.probeNode(id)));
    } finally {
      this.probing = false;
    }
  }

  private async probeNode(id: HybridNodeId): Promise<void> {
    const node = this.nodes.get(id);
    if (!node || !node.enabled) {
      if (node) node.health = 'DISABLED';
      return;
    }
    const health = await node.provider.health();
    if (health.status === 'online') {
      node.lastLatencyMs = health.latencyMs ?? null;
      node.lastSeenAt = new Date().toISOString();
      node.lastError = null;
      node.consecutiveFailures = 0;
      node.consecutiveSuccesses += 1;
      if (node.circuit.getState() === 'HALF_OPEN' || node.circuit.getState() === 'OPEN') {
        node.circuit.recordSuccess();
      }
      if (node.health === 'UNHEALTHY' || node.health === 'RECOVERING' || node.health === 'DISABLED') {
        if (node.consecutiveSuccesses >= this.config.recoverAfterSuccesses) {
          node.health = 'HEALTHY';
          this.logger.log(`hybrid node ${id} recovered → HEALTHY`);
        } else {
          node.health = 'RECOVERING';
        }
      } else if ((node.lastLatencyMs ?? 0) > 1500) {
        node.health = 'DEGRADED';
      } else {
        node.health = 'HEALTHY';
      }
    } else {
      node.consecutiveSuccesses = 0;
      node.consecutiveFailures += 1;
      node.lastError = health.error ?? 'offline';
      if (node.consecutiveFailures >= this.config.unhealthyAfterFailures) {
        node.health = 'UNHEALTHY';
      } else {
        node.health = 'DEGRADED';
      }
    }
  }

  private recordInferenceSuccess(id: HybridNodeId, ttftMs: number | null, tps: number | null): void {
    const node = this.nodes.get(id);
    if (!node) return;
    node.circuit.recordSuccess();
    node.lastSeenAt = new Date().toISOString();
    if (ttftMs != null) node.lastTtftMs = ttftMs;
    if (tps != null) node.lastTokensPerSec = tps;
    if (node.health !== 'DISABLED') node.health = 'HEALTHY';
  }

  private recordInferenceFailure(id: HybridNodeId, error: string): void {
    const node = this.nodes.get(id);
    if (!node) return;
    node.circuit.recordFailure();
    node.lastError = error.slice(0, 300);
    node.consecutiveFailures += 1;
    node.consecutiveSuccesses = 0;
    if (node.consecutiveFailures >= this.config.unhealthyAfterFailures) {
      node.health = 'UNHEALTHY';
    }
  }

  private consumeAttempt(
    node: NodeState,
    messages: AIMessage[],
    modelName: string,
    options: AIGenerationOptions | undefined,
    context: { conversationId?: number } | undefined,
    subscriber: Subscriber<AIStreamChunk>,
    opts: { allowEmit: boolean },
  ): Promise<
    | { status: 'ok'; ttftMs: number | null; tokensPerSec: number | null }
    | { status: 'pre_token'; error: string }
    | { status: 'mid_stream'; error: string }
  > {
    return new Promise((resolve) => {
      let emittedTokens = false;
      let firstTokenAt: number | null = null;
      const started = Date.now();
      let completionTokens: number | null = null;
      let durationMs: number | null = null;
      let settled = false;

      const finish = (
        result:
          | { status: 'ok'; ttftMs: number | null; tokensPerSec: number | null }
          | { status: 'pre_token'; error: string }
          | { status: 'mid_stream'; error: string },
      ) => {
        if (settled) return;
        settled = true;
        resolve(result);
      };

      const sub = node.provider.stream(messages, modelName, options, context).subscribe({
        next: (chunk) => {
          if (chunk.type === 'delta' && chunk.content) {
            if (!emittedTokens) {
              emittedTokens = true;
              firstTokenAt = Date.now();
            }
            if (opts.allowEmit) subscriber.next(chunk);
          } else if (chunk.type === 'done') {
            completionTokens = chunk.completionTokens ?? null;
            durationMs = chunk.durationMs ?? null;
            if (opts.allowEmit) subscriber.next(chunk);
            const ttft = firstTokenAt != null ? firstTokenAt - started : null;
            const tps =
              completionTokens != null && durationMs != null && durationMs > 0
                ? Math.round((completionTokens / (durationMs / 1000)) * 100) / 100
                : null;
            finish({ status: 'ok', ttftMs: ttft, tokensPerSec: tps });
          } else if (chunk.type === 'error') {
            const err = chunk.message ?? 'stream error';
            if (emittedTokens) finish({ status: 'mid_stream', error: err });
            else finish({ status: 'pre_token', error: err });
          }
        },
        error: (error: unknown) => {
          const err = error instanceof Error ? error.message : String(error);
          if (emittedTokens) finish({ status: 'mid_stream', error: err });
          else finish({ status: 'pre_token', error: err });
        },
        complete: () => {
          if (!settled) {
            if (emittedTokens) {
              const ttft = firstTokenAt != null ? firstTokenAt - started : null;
              finish({ status: 'ok', ttftMs: ttft, tokensPerSec: null });
            } else {
              finish({ status: 'pre_token', error: 'stream completed without tokens' });
            }
          }
        },
      });

      // Ensure unsubscribe when outer tears down — caller owns Observable lifecycle
      subscriber.add(() => sub.unsubscribe());
    });
  }
}
