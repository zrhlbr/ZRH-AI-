import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';

@Injectable()
export class RunnerClientService {
  private readonly logger = new Logger(RunnerClientService.name);

  private baseUrl() {
    return (process.env.DEV_RUNNER_URL || 'http://127.0.0.1:5055').replace(/\/$/, '');
  }

  private token() {
    const token = process.env.DEV_RUNNER_TOKEN || '';
    if (!token) {
      throw new ServiceUnavailableException('DEV_RUNNER_TOKEN is required');
    }
    return token;
  }

  async request<T>(path: string, body?: Record<string, unknown>, timeoutMs = 60000): Promise<T> {
    const url = `${this.baseUrl()}${path}`;
    try {
      const res = await fetch(url, {
        method: path === '/health' ? 'GET' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Runner-Token': this.token(),
        },
        body: path === '/health' ? undefined : JSON.stringify(body ?? {}),
        signal: AbortSignal.timeout(timeoutMs),
      });
      const data = (await res.json().catch(() => ({}))) as T & { error?: string };
      if (!res.ok) {
        throw new ServiceUnavailableException(
          (data as { error?: string }).error || `runner HTTP ${res.status}`,
        );
      }
      return data;
    } catch (err) {
      this.logger.warn(`runner call failed ${path}: ${err instanceof Error ? err.message : err}`);
      if (err instanceof ServiceUnavailableException) throw err;
      throw new ServiceUnavailableException(
        `dev-runner unavailable at ${this.baseUrl()}; start zrh-ai-dev-runner`,
      );
    }
  }

  health() {
    return this.request<{ service: string; status: string }>('/health');
  }

  ensureWorkspace(input: { workspaceId: number; kind?: string; remoteUrl?: string }) {
    return this.request('/workspaces/ensure', input, 120000);
  }

  tree(workspaceId: number) {
    return this.request<{ items: Array<{ name: string; path: string; type: string }> }>('/fs/tree', {
      workspaceId,
    });
  }

  readFile(workspaceId: number, path: string) {
    return this.request<{ path: string; content: string; size: number; sha256?: string }>('/fs/read', {
      workspaceId,
      path,
    });
  }

  writeFile(workspaceId: number, path: string, content: string) {
    return this.request('/fs/write', { workspaceId, path, content, changeType: 'modify' });
  }

  applyPatch(input: {
    workspaceId: number;
    path: string;
    changeType: string;
    patch?: string;
    content?: string;
    deleteConfirmed?: boolean;
  }) {
    return this.request('/fs/apply-patch', input);
  }

  searchFiles(workspaceId: number, query: string) {
    return this.request<{ items: Array<{ path: string; type: string }> }>('/search/files', {
      workspaceId,
      query,
    });
  }

  searchContent(workspaceId: number, query: string) {
    return this.request<{ items: Array<{ path: string; line: number; snippet: string }> }>(
      '/search/content',
      { workspaceId, query },
    );
  }

  terminal(input: {
    workspaceId: number;
    command: string;
    cwd?: string;
    timeoutMs?: number;
    allowDangerous?: boolean;
  }) {
    return this.request<{
      ok: boolean;
      exitCode: number;
      stdout: string;
      stderr: string;
      timedOut: boolean;
      status: string;
      reason?: string;
    }>('/terminal', input, (input.timeoutMs || 60000) + 5000);
  }

  git(input: {
    workspaceId: number;
    op: string;
    message?: string;
    sha?: string;
    confirmed?: boolean;
    files?: string[];
  }) {
    return this.request<{
      ok: boolean;
      stdout: string;
      stderr: string;
      status: string;
      exitCode?: number;
      reason?: string;
    }>('/git', input);
  }
}
