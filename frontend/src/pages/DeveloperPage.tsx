import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ZBadge, ZButton, ZCard, ZInput } from '../components/ui';
import { BrandMark } from '../design-system/BrandMark';
import { useAuthStore } from '../store/authStore';
import { developerApi, developerChatStream } from '../api/developer';
import { ApiError } from '../api/client';

/**
 * ZRH Developer Agent workbench — /developer
 */
export function DeveloperPage() {
  const { t } = useTranslation();
  const { hasPermission } = useAuthStore();
  if (!hasPermission('menu:developer') && !hasPermission('api:developer:read')) {
    return <Navigate to="/home" replace />;
  }

  const [workspaces, setWorkspaces] = useState<Array<Record<string, unknown>>>([]);
  const [wsId, setWsId] = useState<number | null>(null);
  const [tree, setTree] = useState<Array<{ name: string; path: string; type: string }>>([]);
  const [filePath, setFilePath] = useState('');
  const [fileContent, setFileContent] = useState('');
  const [gitStatus, setGitStatus] = useState('');
  const [skills, setSkills] = useState<Array<{ code: string; name: string }>>([]);
  const [skill, setSkill] = useState('feature');
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [chatLog, setChatLog] = useState('');
  const [plans, setPlans] = useState<Array<Record<string, unknown>>>([]);
  const [diff, setDiff] = useState<Record<string, unknown> | null>(null);
  const [termCmd, setTermCmd] = useState('npm -v');
  const [termOut, setTermOut] = useState('');
  const [audit, setAudit] = useState<Array<Record<string, unknown>>>([]);
  const [searchQ, setSearchQ] = useState('');
  const [searchOut, setSearchOut] = useState('');
  const [runnerOk, setRunnerOk] = useState<boolean | null>(null);
  const [newName, setNewName] = useState('');
  const [remoteUrl, setRemoteUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [dangerOp, setDangerOp] = useState<'reset-hard' | 'clean' | 'push-force' | ''>('');

  const selected = useMemo(
    () => workspaces.find((w) => Number(w.id) === wsId) || null,
    [workspaces, wsId],
  );

  const refresh = async () => {
    setError(null);
    try {
      const [ws, sk, health] = await Promise.all([
        developerApi.workspaces(),
        developerApi.skills(),
        developerApi.health().catch(() => ({ ok: false, runner: {} })),
      ]);
      setWorkspaces(ws);
      setSkills(sk);
      setRunnerOk(!!health.ok);
      if (!wsId && ws[0]) setWsId(Number(ws[0].id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'load failed');
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (!wsId) return;
    void (async () => {
      try {
        const [tr, git, pl, au] = await Promise.all([
          developerApi.tree(wsId),
          developerApi.git(wsId, 'status').catch(() => ({ stdout: '', stderr: '', ok: false })),
          developerApi.plans(wsId).catch(() => []),
          developerApi.audit(wsId).catch(() => []),
        ]);
        setTree(tr.items || []);
        setGitStatus(git.stdout || git.stderr || '');
        setPlans(pl);
        setAudit(au);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'workspace load failed');
      }
    })();
  }, [wsId]);

  const openFile = async (path: string) => {
    if (!wsId) return;
    setFilePath(path);
    const f = await developerApi.file(wsId, path);
    setFileContent(f.content);
  };

  const ensureSession = async () => {
    if (!wsId) return null;
    if (sessionId) return sessionId;
    const s = await developerApi.createSession({ workspaceId: wsId, skillCode: skill });
    setSessionId(s.id);
    return s.id;
  };

  const sendChat = async (e: FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const sid = await ensureSession();
    if (!sid) return;
    setChatLog((prev) => `${prev}\n\nYou: ${chatInput}`);
    const msg = chatInput;
    setChatInput('');
    let acc = '';
    await developerChatStream(
      sid,
      msg,
      (text) => {
        acc += text;
        setChatLog((prev) => {
          const base = prev.replace(/\n\nAgent:[\s\S]*$/, '');
          return `${base}\n\nAgent: ${acc}`;
        });
      },
      (done) => {
        if (done.plan) {
          void developerApi.plans(wsId!).then(setPlans);
        }
      },
    );
  };

  const createWs = async (e: FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const kind = remoteUrl.trim() ? 'git' : 'bind';
    await developerApi.createWorkspace({
      name: newName.trim(),
      kind,
      ...(remoteUrl.trim() ? { remoteUrl: remoteUrl.trim() } : {}),
    });
    setNewName('');
    setRemoteUrl('');
    await refresh();
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] min-h-[640px] flex-col lg:flex-row">
      {/* Projects */}
      <aside className="w-full shrink-0 border-b border-zrh-border lg:w-56 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <BrandMark size={24} className="h-6 w-6 shrink-0 rounded-md" />
            <p className="truncate text-xs font-semibold text-zrh-accent">{t('developer.title')}</p>
          </div>
          <ZBadge tone={runnerOk ? 'ok' : 'err'}>
            {runnerOk ? t('developer.runnerOk') : t('developer.runnerDown')}
          </ZBadge>
        </div>
        <ul className="max-h-40 space-y-1 overflow-auto px-2 pb-2 lg:max-h-none">
          {workspaces.map((w) => (
            <li key={String(w.id)}>
              <button
                type="button"
                className={`w-full rounded-lg px-2 py-1.5 text-left text-xs ${
                  Number(w.id) === wsId ? 'bg-zrh-accent/15 text-zrh-accent' : 'text-zrh-text-dim'
                }`}
                onClick={() => {
                  setWsId(Number(w.id));
                  setSessionId(null);
                }}
              >
                {String(w.name)}
              </button>
            </li>
          ))}
        </ul>
        {hasPermission('api:developer:admin') && (
          <form onSubmit={(e) => void createWs(e)} className="space-y-1 border-t border-zrh-border p-2">
            <ZInput
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t('developer.newProject')}
            />
            <ZInput
              value={remoteUrl}
              onChange={(e) => setRemoteUrl(e.target.value)}
              placeholder={t('developer.gitRemoteOptional')}
            />
            <ZButton type="submit" size="sm" className="w-full">
              {t('developer.add')}
            </ZButton>
          </form>
        )}
      </aside>

      {/* File tree */}
      <aside className="w-full shrink-0 border-b border-zrh-border lg:w-56 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between px-3 py-2">
          <p className="text-xs text-zrh-text-dim">{t('developer.files')}</p>
          {wsId && hasPermission('api:developer:write') && (
            <ZButton
              size="sm"
              variant="ghost"
              onClick={() =>
                void developerApi.rebuildIndex(wsId).then(() => setSearchOut(t('developer.indexOk')))
              }
            >
              {t('developer.index')}
            </ZButton>
          )}
        </div>
        <ul className="max-h-48 overflow-auto px-2 pb-2 text-[11px] lg:max-h-[calc(100%-2.5rem)]">
          {tree
            .filter((i) => i.type === 'file')
            .slice(0, 300)
            .map((i) => (
              <li key={i.path}>
                <button
                  type="button"
                  className="w-full truncate rounded px-1 py-0.5 text-left text-zrh-text-dim hover:text-zrh-accent"
                  onClick={() => void openFile(i.path)}
                >
                  {i.path}
                </button>
              </li>
            ))}
        </ul>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {error && (
          <p className="border-b border-zrh-err/40 bg-zrh-err/10 px-3 py-1 text-xs text-zrh-err">
            {error}
          </p>
        )}
        <div className="grid min-h-0 flex-1 gap-2 overflow-auto p-3 lg:grid-cols-2">
          <ZCard title={filePath || t('developer.code')} glow className="min-h-48">
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-[11px] text-zrh-text-dim">
              {fileContent || t('developer.selectFile')}
            </pre>
          </ZCard>

          <ZCard title={t('developer.agent')} glow className="min-h-48">
            <div className="mb-2 flex flex-wrap gap-2">
              <select
                className="rounded border border-zrh-border bg-zrh-surface px-2 py-1 text-xs"
                value={skill}
                onChange={(e) => {
                  setSkill(e.target.value);
                  setSessionId(null);
                }}
              >
                {skills.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name}
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-zrh-text-dim">
                {selected ? String(selected.name) : '—'}
              </span>
            </div>
            <pre className="mb-2 max-h-40 overflow-auto whitespace-pre-wrap text-[11px] text-zrh-text-dim">
              {chatLog || t('developer.chatHint')}
            </pre>
            <form onSubmit={(e) => void sendChat(e)} className="flex gap-2">
              <ZInput
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={t('developer.ask')}
              />
              <ZButton type="submit" disabled={!hasPermission('api:developer:chat')}>
                {t('developer.send')}
              </ZButton>
            </form>
          </ZCard>

          <ZCard title={t('developer.plan')} glow>
            <ul className="space-y-2 text-xs">
              {plans.map((p) => (
                <li key={String(p.id)} className="rounded border border-zrh-border p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-zrh-text">{String(p.title)}</span>
                    <ZBadge tone="dim">{String(p.status)}</ZBadge>
                  </div>
                  <p className="mt-1 text-zrh-text-dim">{String(p.summary)}</p>
                  {p.status === 'pending' && hasPermission('api:developer:write') && (
                    <div className="mt-2 flex gap-1">
                      <ZButton
                        size="sm"
                        onClick={() =>
                          void developerApi.approvePlan(Number(p.id)).then((r) => {
                            setDiff(r.diff);
                            return developerApi.plans(wsId!).then(setPlans);
                          })
                        }
                      >
                        {t('developer.approve')}
                      </ZButton>
                      <ZButton
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          void developerApi.rejectPlan(Number(p.id)).then(() =>
                            developerApi.plans(wsId!).then(setPlans),
                          )
                        }
                      >
                        {t('developer.reject')}
                      </ZButton>
                    </div>
                  )}
                </li>
              ))}
              {!plans.length && <p className="text-zrh-text-dim">{t('common.noData')}</p>}
            </ul>
          </ZCard>

          <ZCard title={t('developer.diff')} glow>
            {!diff ? (
              <p className="text-xs text-zrh-text-dim">{t('developer.diffHint')}</p>
            ) : (
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span>{String(diff.title)}</span>
                  <ZBadge tone="dim">{String(diff.status)}</ZBadge>
                </div>
                <ul className="space-y-1">
                  {(diff.files as Array<Record<string, unknown>> | undefined)?.map((f) => (
                    <li key={String(f.id)} className="rounded border border-zrh-border px-2 py-1">
                      <span className="text-zrh-accent">{String(f.changeType)}</span> {String(f.path)}
                      {f.changeType === 'delete' && !f.deleteConfirmed && (
                        <ZButton
                          size="sm"
                          variant="ghost"
                          className="ml-2"
                          onClick={() =>
                            void developerApi
                              .confirmDelete(Number(diff.id), Number(f.id))
                              .then(() => developerApi.getDiff(Number(diff.id)).then(setDiff))
                          }
                        >
                          {t('developer.confirmDelete')}
                        </ZButton>
                      )}
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-1">
                  <ZButton
                    size="sm"
                    onClick={() =>
                      void developerApi
                        .approveDiff(Number(diff.id))
                        .then((r) => setDiff(r as Record<string, unknown>))
                    }
                  >
                    {t('developer.approveDiff')}
                  </ZButton>
                  <ZButton
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      void developerApi.rejectDiff(Number(diff.id)).then(() => setDiff(null))
                    }
                  >
                    {t('developer.rejectDiff')}
                  </ZButton>
                  <ZButton
                    size="sm"
                    onClick={() =>
                      void developerApi
                        .applyDiff(Number(diff.id))
                        .then((r) => setDiff(r as Record<string, unknown>))
                    }
                  >
                    {t('developer.apply')}
                  </ZButton>
                </div>
              </div>
            )}
          </ZCard>

          <ZCard title={t('developer.terminal')} glow>
            <form
              className="mb-2 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!wsId) return;
                void developerApi
                  .terminal(wsId, termCmd)
                  .then((r) => setTermOut(String(r.stdout || r.stderr || r.reason || JSON.stringify(r))));
              }}
            >
              <ZInput value={termCmd} onChange={(e) => setTermCmd(e.target.value)} />
              <ZButton type="submit" disabled={!hasPermission('api:developer:terminal')}>
                {t('developer.run')}
              </ZButton>
            </form>
            <pre className="max-h-32 overflow-auto text-[11px] text-zrh-text-dim">{termOut}</pre>
          </ZCard>

          <ZCard title={t('developer.git')} glow>
            <pre className="mb-2 max-h-28 overflow-auto text-[11px] text-zrh-text-dim">
              {gitStatus || '—'}
            </pre>
            {wsId && hasPermission('api:developer:write') && (
              <div className="flex flex-wrap gap-1">
                <ZButton
                  size="sm"
                  onClick={() =>
                    void developerApi.commit(wsId, 'chore: zrh developer agent update').then(() =>
                      developerApi.git(wsId, 'status').then((g) => setGitStatus(g.stdout || '')),
                    )
                  }
                >
                  {t('developer.commit')}
                </ZButton>
                <select
                  className="rounded border border-zrh-border bg-zrh-surface px-2 py-1 text-xs"
                  value={dangerOp}
                  onChange={(e) =>
                    setDangerOp(e.target.value as 'reset-hard' | 'clean' | 'push-force' | '')
                  }
                >
                  <option value="">{t('developer.dangerousOp')}</option>
                  <option value="reset-hard">reset --hard</option>
                  <option value="clean">git clean</option>
                  <option value="push-force">push --force</option>
                </select>
                <ZButton
                  size="sm"
                  variant="ghost"
                  disabled={!dangerOp}
                  onClick={() => {
                    if (!wsId || !dangerOp) return;
                    const ok = window.confirm(t('developer.dangerousConfirm'));
                    void developerApi
                      .dangerousGit(wsId, dangerOp, ok)
                      .then((r) => setTermOut(JSON.stringify(r)))
                      .catch((e) =>
                        setError(e instanceof ApiError ? e.message : t('developer.dangerousDenied')),
                      );
                  }}
                >
                  {t('developer.confirmDangerous')}
                </ZButton>
              </div>
            )}
          </ZCard>

          <ZCard title={t('developer.search')} glow>
            <form
              className="mb-2 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!wsId) return;
                void developerApi
                  .search(wsId, 'semantic', searchQ)
                  .then((r) => setSearchOut(JSON.stringify(r, null, 2)));
              }}
            >
              <ZInput value={searchQ} onChange={(e) => setSearchQ(e.target.value)} />
              <ZButton type="submit">{t('common.search')}</ZButton>
            </form>
            <pre className="max-h-28 overflow-auto text-[10px] text-zrh-text-dim">{searchOut}</pre>
          </ZCard>

          <ZCard title={t('developer.history')} glow>
            <ul className="max-h-36 space-y-1 overflow-auto text-[11px] text-zrh-text-dim">
              {audit.map((a) => (
                <li key={String(a.id)}>
                  {String(a.createdAt)} · {String(a.action)} · {String(a.result)}
                </li>
              ))}
            </ul>
          </ZCard>
        </div>
      </div>
    </div>
  );
}
