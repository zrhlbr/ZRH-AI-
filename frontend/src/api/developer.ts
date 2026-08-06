import { request } from './client';

export const developerApi = {
  health: () => request<{ ok: boolean; runner: Record<string, unknown> }>('/developer/health'),
  workspaces: () => request<Array<Record<string, unknown>>>('/developer/workspaces'),
  createWorkspace: (body: { name: string; kind?: string; remoteUrl?: string; description?: string }) =>
    request('/developer/workspaces', { method: 'POST', body: JSON.stringify(body) }),
  tree: (id: number) =>
    request<{ items: Array<{ name: string; path: string; type: string }> }>(
      `/developer/workspaces/${id}/tree`,
    ),
  file: (id: number, path: string) =>
    request<{ path: string; content: string }>(
      `/developer/workspaces/${id}/file?path=${encodeURIComponent(path)}`,
    ),
  git: (id: number, op: string) =>
    request<{ stdout: string; stderr: string; ok: boolean }>(`/developer/workspaces/${id}/git/${op}`),
  search: (id: number, kind: 'files' | 'symbols' | 'refs' | 'semantic', query: string) =>
    request(`/developer/workspaces/${id}/search/${kind}`, {
      method: 'POST',
      body: JSON.stringify({ query }),
    }),
  rebuildIndex: (id: number) =>
    request(`/developer/workspaces/${id}/index/rebuild`, { method: 'POST', body: '{}' }),
  createSession: (body: { workspaceId: number; skillCode?: string; title?: string }) =>
    request<{ id: number; modelAlias?: string }>('/developer/sessions', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  plans: (workspaceId: number) =>
    request<Array<Record<string, unknown>>>(`/developer/plans?workspaceId=${workspaceId}`),
  approvePlan: (id: number) =>
    request<{ plan: Record<string, unknown>; diff: Record<string, unknown> }>(
      `/developer/plans/${id}/approve`,
      { method: 'POST', body: '{}' },
    ),
  rejectPlan: (id: number) =>
    request(`/developer/plans/${id}/reject`, { method: 'POST', body: '{}' }),
  getDiff: (id: number) => request<Record<string, unknown>>(`/developer/diffs/${id}`),
  approveDiff: (id: number) =>
    request(`/developer/diffs/${id}/approve`, { method: 'POST', body: '{}' }),
  rejectDiff: (id: number) =>
    request(`/developer/diffs/${id}/reject`, { method: 'POST', body: '{}' }),
  applyDiff: (id: number) =>
    request(`/developer/diffs/${id}/apply`, { method: 'POST', body: '{}' }),
  confirmDelete: (diffId: number, fileId: number) =>
    request(`/developer/diffs/${diffId}/files/${fileId}/confirm-delete`, {
      method: 'POST',
      body: '{}',
    }),
  terminal: (id: number, command: string) =>
    request<Record<string, unknown>>(`/developer/workspaces/${id}/terminal`, {
      method: 'POST',
      body: JSON.stringify({ command }),
    }),
  commit: (id: number, message: string, confirmed = false) =>
    request<Record<string, unknown>>(`/developer/workspaces/${id}/git/commit`, {
      method: 'POST',
      body: JSON.stringify({ message, confirmed }),
    }),
  rollbackDiff: (id: number) =>
    request(`/developer/diffs/${id}/rollback`, { method: 'POST', body: '{}' }),
  dangerousGit: (
    id: number,
    op: 'reset-hard' | 'clean' | 'push-force',
    confirmed: boolean,
  ) =>
    request(`/developer/workspaces/${id}/git/dangerous`, {
      method: 'POST',
      body: JSON.stringify({ op, confirmed }),
    }),
  skills: () => request<Array<{ code: string; name: string; description?: string }>>('/developer/skills'),
  audit: (workspaceId?: number) =>
    request<Array<Record<string, unknown>>>(
      `/developer/audit${workspaceId ? `?workspaceId=${workspaceId}` : ''}`,
    ),
};

/** SSE chat — bypasses envelope helper */
export async function developerChatStream(
  sessionId: number,
  message: string,
  onToken: (text: string) => void,
  onDone: (payload: Record<string, unknown>) => void,
) {
  const { useAuthStore } = await import('../store/authStore');
  const token = useAuthStore.getState().accessToken;
  const res = await fetch(`/api/v1/developer/sessions/${sessionId}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ message, planMode: true }),
  });
  if (!res.ok || !res.body) throw new Error(`chat failed HTTP ${res.status}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split('\n\n');
    buf = parts.pop() || '';
    for (const part of parts) {
      const line = part.split('\n').find((l) => l.startsWith('data: '));
      if (!line) continue;
      try {
        const data = JSON.parse(line.slice(6)) as { type: string; text?: string };
        if (data.type === 'token' && data.text) onToken(data.text);
        if (data.type === 'done') onDone(data as Record<string, unknown>);
      } catch {
        // ignore
      }
    }
  }
}
