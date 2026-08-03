# ZRH AI Enterprise V1.2 P2 — Developer Agent Architecture

**Status:** Approved for implementation on `test/v1.2`  
**Baseline:** V1.1 Production frozen (`v1.1.0`); do not deploy this stage to production  
**Brand rule:** First-party ZRH Developer Agent. Do not copy or claim Cursor proprietary models, source, or internals. Cursor Cloud Agent is an optional official-API provider, disabled by default.

## Locked decisions

- Server-side workspaces only (bind mount or git clone under whitelist root)
- New container `zrh-ai-dev-runner` for shell/git/build; API orchestrates only
- Plan Mode required for writes; delete / hard reset / clean / force-push need explicit second approval
- UI shows engine aliases only (no third-party brand names in normal UI)
- Production compose defaults remain `1.1.0`; runner enabled on test line only

## Architecture summary

| Plane | Responsibility | Process |
|-------|----------------|---------|
| Control | Auth, Plan, Diff, model routing, audit, index metadata | `zrh-ai-api` |
| Execution | FS, search, whitelisted commands, git, build/test | `zrh-ai-dev-runner` |
| Models | All LLM via AI Gateway | Ollama / cloud / optional Cursor API |

## API prefix

`/api/v1/developer/*` — workspaces, search, sessions/chat (SSE), plans, diffs, terminal, git, audit, skills

## Permissions

`menu:developer`, `api:developer:read|chat|write|terminal|admin`  
Workspace ACL via `dev_workspace_members`.

## Tables

`dev_workspaces`, `dev_workspace_members`, `dev_workspace_repos`, `dev_sessions`, `dev_session_messages`, `dev_plans`, `dev_plan_steps`, `dev_diffs`, `dev_diff_files`, `dev_terminal_runs`, `dev_git_ops`, `dev_code_files`, `dev_code_symbols`, `dev_code_vectors`, `dev_audit_logs`, `dev_skills`, `dev_provider_settings`

## Reuse

AI Gateway · Agent Center (`developer`) · Tool Center · MCP Gateway · embedding/pgvector providers (separate `dev_code_*` tables).  
No business changes to Chat / RAG / Knowledge / Workflow / Business Hub.

## Milestones

P2.1 Foundation → P2.2 Search → P2.3 Plan/Diff → P2.4 Agent loop → P2.5 Terminal/Git → P2.6 MCP → P2.7 UI → P2.8 Models → P2.9 Acceptance (then decide `v1.2.0` / production).

## Acceptance gates

See Development Acceptance Report produced at end of P2 implementation. Production tag `v1.2.0` deferred.
