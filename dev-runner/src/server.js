/**
 * ZRH AI Dev Runner — sandboxed FS / search / terminal / git plane.
 * Does NOT mount docker.sock. Requires shared token with API.
 * Phase 0.5: non-root image, precise-whitelist git staging, PowerShell escape
 * denial, terminal concurrency cap, testable exports.
 */
const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.RUNNER_PORT || 5055);
const ROOT = path.resolve(process.env.WORKSPACES_ROOT || path.join(process.cwd(), 'workspaces'));
const TOKEN = process.env.DEV_RUNNER_TOKEN || '';
// TOKEN is enforced in the server startup branch (require.main === module)
// so unit tests can import helpers without a token.
const MAX_TIMEOUT_MS = Number(process.env.RUNNER_MAX_TIMEOUT_MS || 120000);
const MAX_CONCURRENT_TERMINAL = Number(process.env.RUNNER_MAX_CONCURRENT_TERMINAL || 2);

const COMMAND_ALLOW = [
  /^git(\s|$)/,
  /^npm(\s|$)/,
  /^npx(\s|$)/,
  /^pnpm(\s|$)/,
  /^yarn(\s|$)/,
  /^node(\s|$)/,
  /^tsc(\s|$)/,
  /^prisma(\s|$)/,
  /^npx\s+prisma(\s|$)/,
  /^ls(\s|$)/,
  /^cat(\s|$)/,
  /^pwd$/,
  /^echo(\s|$)/,
  /^rg(\s|$)/,
  /^grep(\s|$)/,
  /^find(\s|$)/,
  /^head(\s|$)/,
  /^tail(\s|$)/,
  /^wc(\s|$)/,
];

const COMMAND_DENY = [
  /rm\s+-rf\s+[\/\\]/,
  /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;/,
  /mkfs/,
  /dd\s+if=/,
  /shutdown/,
  /reboot/,
  /curl\s+[^\n]*\|\s*(ba)?sh/,
  /wget\s+[^\n]*\|\s*(ba)?sh/,
  /git\s+push\s+[^\n]*--force/,
  /git\s+push\s+-f\b/,
  /git\s+reset\s+--hard/,
  /git\s+clean\b/,
  /git\s+add\s+(-A|--all|\.)(?=\s|$)/,
  /git\s+commit\s+[^\n]*-a(\s|$|m)/,
  /(^|\s)(powershell|pwsh)(\.exe)?(\s|$)/i,
  /Invoke-Expression/i,
];

const ENV_DENY = /(^|\/|\\)\.env($|\.|\/|\\)/i;

function json(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
  });
  res.end(data);
}

function auth(req) {
  const h = req.headers['x-runner-token'] || req.headers.authorization?.replace(/^Bearer\s+/i, '');
  return h && h === TOKEN;
}

function resolveWs(workspaceId, rel = '.') {
  const base = path.resolve(ROOT, String(workspaceId));
  const target = path.resolve(base, rel || '.');
  if (!target.startsWith(base + path.sep) && target !== base) {
    throw new Error('path escape denied');
  }
  return { base, target };
}

function assertSafePath(rel) {
  if (!rel) return;
  if (ENV_DENY.test(rel) || rel.includes('..')) throw new Error('path denied');
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

async function ensureRoot() {
  await fsp.mkdir(ROOT, { recursive: true });
}

async function treeWalk(dir, base, depth = 0, maxDepth = 6, acc = []) {
  if (depth > maxDepth) return acc;
  let entries;
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === '.git' || e.name === 'dist' || e.name === '.next') continue;
    const full = path.join(dir, e.name);
    const rel = path.relative(base, full).replace(/\\/g, '/');
    if (ENV_DENY.test(rel)) continue;
    acc.push({ name: e.name, path: rel, type: e.isDirectory() ? 'dir' : 'file' });
    if (e.isDirectory()) await treeWalk(full, base, depth + 1, maxDepth, acc);
  }
  return acc;
}

/** Feature Freeze: tokenize without spawning a shell */
function tokenize(command) {
  const c = String(command || '').trim();
  const args = [];
  let cur = '';
  let quote = null;
  for (let i = 0; i < c.length; i += 1) {
    const ch = c[i];
    if (quote) {
      if (ch === quote) quote = null;
      else cur += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = null;
      continue;
    }
    if (/\s/.test(ch)) {
      if (cur) {
        args.push(cur);
        cur = '';
      }
      continue;
    }
    cur += ch;
  }
  if (quote) throw new Error('unclosed quote');
  if (cur) args.push(cur);
  return args;
}

function runCommand(cwd, commandOrArgs, timeoutMs) {
  return new Promise((resolve) => {
    let argv;
    try {
      argv = Array.isArray(commandOrArgs) ? commandOrArgs : tokenize(commandOrArgs);
    } catch (err) {
      resolve({ exitCode: 1, stdout: '', stderr: String(err.message || err), timedOut: false });
      return;
    }
    if (!argv.length) {
      resolve({ exitCode: 1, stdout: '', stderr: 'empty command', timedOut: false });
      return;
    }
    const [bin, ...rest] = argv;
    // Feature Freeze: never shell:true — argv only; minimal env (no DEV_RUNNER_TOKEN)
    const childEnv = {
      PATH: process.env.PATH || '',
      HOME: process.env.HOME || process.env.USERPROFILE || '',
      LANG: process.env.LANG || 'C.UTF-8',
      CI: '1',
      NODE_ENV: process.env.NODE_ENV || 'production',
      SystemRoot: process.env.SystemRoot,
      TEMP: process.env.TEMP || '/tmp',
      TMP: process.env.TMP || '/tmp',
    };
    const child = spawn(bin, rest, { cwd, shell: false, env: childEnv });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, Math.min(timeoutMs || 30000, MAX_TIMEOUT_MS));
    child.stdout.on('data', (d) => {
      stdout += d.toString();
      if (stdout.length > 200000) stdout = stdout.slice(-200000);
    });
    child.stderr.on('data', (d) => {
      stderr += d.toString();
      if (stderr.length > 200000) stderr = stderr.slice(-200000);
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ exitCode: 1, stdout, stderr: stderr || String(err.message || err), timedOut });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ exitCode: timedOut ? 124 : code ?? 1, stdout, stderr, timedOut });
    });
  });
}

function allowCommand(command, allowDangerous = false) {
  const c = String(command || '').trim();
  if (!c) return { ok: false, reason: 'empty command' };
  // Reject shell metacharacters / chaining (defense in depth with shell:false)
  if (/[;&|`$<>]|\n|\r|\(|\)|\{|\}/.test(c)) {
    return { ok: false, reason: 'shell metacharacters denied' };
  }
  // allowDangerous never bypasses denylist for force-push / reset / clean via terminal
  for (const re of COMMAND_DENY) {
    if (re.test(c)) return { ok: false, reason: 'dangerous command denied' };
  }
  if (allowDangerous) {
    return { ok: false, reason: 'use git/dangerous API for privileged git ops' };
  }
  if (!COMMAND_ALLOW.some((re) => re.test(c))) {
    return { ok: false, reason: 'command not in whitelist' };
  }
  // Feature Freeze: deny interpreter/exec escape hatches even with shell:false
  let argv;
  try {
    argv = tokenize(c);
  } catch {
    return { ok: false, reason: 'invalid command quoting' };
  }
  const bin = path.basename(argv[0] || '').toLowerCase().replace(/\.exe$/, '');
  const rest = argv.slice(1);
  if (bin === 'node' && rest.some((a) => a === '-e' || a === '--eval' || a === '-p' || a === '--print')) {
    return { ok: false, reason: 'node eval flags denied' };
  }
  if ((bin === 'npm' || bin === 'npx' || bin === 'pnpm' || bin === 'yarn') && rest.some((a) => a === '-e' || a === '--eval')) {
    return { ok: false, reason: 'package-manager eval denied' };
  }
  if (bin === 'find' && rest.some((a) => a === '-exec' || a === '-execdir' || a === '-ok')) {
    return { ok: false, reason: 'find -exec denied' };
  }
  return { ok: true };
}

function redact(text) {
  return String(text || '')
    .replace(/(api[_-]?key|token|password|secret)\s*[:=]\s*['"]?[^\s'"]+/gi, '$1=***')
    .replace(/Bearer\s+[A-Za-z0-9._\-]+/gi, 'Bearer ***');
}

function sha256(text) {
  return crypto.createHash('sha256').update(text ?? '').digest('hex');
}

/* ---------------------------------------------------------------------------
 * Phase 0.5: precise-whitelist git staging (no git add -A / git add . ever)
 * ------------------------------------------------------------------------- */

function parseNameStatus(out) {
  return String(out || '')
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      const [status, ...rest] = l.split('\t');
      return { status: status.trim(), path: rest.join('\t') };
    });
}

/** Reject symlink escapes: resolved real path must stay inside base. */
async function realpathInside(base, rel) {
  const realBase = await fsp.realpath(base);
  const target = path.resolve(base, rel);
  if (!target.startsWith(base + path.sep) && target !== base) {
    throw new Error('path escape denied');
  }
  try {
    const real = await fsp.realpath(target);
    if (!real.startsWith(realBase + path.sep) && real !== realBase) {
      throw new Error('symlink escape denied');
    }
  } catch (err) {
    if (err && err.code === 'ENOENT') return target; // deleted/new paths allowed
    throw err;
  }
  return target;
}

/**
 * Stage exactly `files` (whitelist) and verify the staged set matches it.
 * Returns { ok, status, reason?, files?, nameStatus?, stat?, stagedDiff? }.
 * Never uses shell; each file is a separate argv entry (no glob expansion).
 */
async function stageWhitelist(base, files) {
  if (!Array.isArray(files) || !files.length) {
    return { ok: false, status: 'denied', reason: 'empty whitelist — commit requires an exact file list' };
  }
  const clean = [];
  try {
    for (const f of files) {
      const rel = String(f).replace(/\\/g, '/');
      if (!rel || rel.includes('\0')) throw new Error('invalid path');
      assertSafePath(rel);
      await realpathInside(base, rel);
      clean.push(rel);
    }
  } catch (err) {
    return { ok: false, status: 'denied', reason: String(err.message || err) };
  }
  const want = [...new Set(clean)];

  // Refuse when the index already holds unrelated staged entries
  const pre = await runCommand(base, ['git', 'diff', '--cached', '--name-only'], 30000);
  if (pre.exitCode !== 0) {
    return { ok: false, status: 'error', reason: 'git index check failed', stderr: redact(pre.stderr) };
  }
  if (pre.stdout.trim()) {
    return { ok: false, status: 'conflict', reason: 'staged area not clean — unstage unrelated files first' };
  }

  const add = await runCommand(base, ['git', 'add', '--', ...want], 60000);
  if (add.exitCode !== 0) {
    return { ok: false, status: 'error', reason: 'git add failed', stderr: redact(add.stderr) };
  }

  const ns = await runCommand(base, ['git', 'diff', '--cached', '--name-status'], 30000);
  const stagedPaths = parseNameStatus(ns.stdout).map((e) => e.path);
  const wantSet = new Set(want);
  const extra = stagedPaths.filter((p) => !wantSet.has(p));
  if (extra.length || stagedPaths.length === 0) {
    // Abort: unstage everything we just staged (plain reset, never --hard)
    await runCommand(base, ['git', 'reset', '-q', '--', ...stagedPaths], 30000);
    return {
      ok: false,
      status: 'conflict',
      reason: `staged mismatch (extra: ${extra.join(', ') || 'none'}; empty: ${stagedPaths.length === 0})`,
    };
  }

  const stat = await runCommand(base, ['git', 'diff', '--cached', '--stat'], 30000);
  const diff = await runCommand(base, ['git', 'diff', '--cached'], 60000);
  return {
    ok: true,
    status: 'staged',
    files: stagedPaths,
    nameStatus: redact(ns.stdout),
    stat: redact(stat.stdout),
    stagedDiff: redact(diff.stdout),
  };
}

/** Verify the already-staged set equals the whitelist, then commit. */
async function commitStaged(base, files, message) {
  const want = [...new Set(files.map((f) => String(f).replace(/\\/g, '/')))];
  const ns = await runCommand(base, ['git', 'diff', '--cached', '--name-status'], 30000);
  const stagedPaths = parseNameStatus(ns.stdout).map((e) => e.path);
  const wantSet = new Set(want);
  const match =
    stagedPaths.length > 0 &&
    stagedPaths.length === wantSet.size &&
    stagedPaths.every((p) => wantSet.has(p));
  if (!match) {
    return {
      ok: false,
      status: 'conflict',
      reason: 'staged set does not match whitelist — run stage step first',
    };
  }
  const msg = String(message || 'chore: zrh developer agent update').slice(0, 200);
  const r = await runCommand(base, ['git', 'commit', '-m', msg], 60000);
  if (r.exitCode !== 0) {
    return { ok: false, status: 'error', reason: 'git commit failed', stderr: redact(r.stderr) };
  }
  const sha = await runCommand(base, ['git', 'rev-parse', 'HEAD'], 30000);
  return {
    ok: true,
    status: 'ok',
    files: stagedPaths,
    commitSha: sha.stdout.trim(),
    stdout: redact(r.stdout),
    stderr: redact(r.stderr),
  };
}

/* ------------------------------------------------------------------------- */

let terminalInFlight = 0;

const server = http.createServer(async (req, res) => {
  try {
    if (!auth(req) && req.url !== '/health') {
      return json(res, 401, { error: 'unauthorized' });
    }
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
    const p = url.pathname;

    if (req.method === 'GET' && p === '/health') {
      return json(res, 200, { service: 'zrh-ai-dev-runner', status: 'ok', root: ROOT });
    }

    if (req.method === 'POST' && p === '/workspaces/ensure') {
      const body = await readBody(req);
      const { base } = resolveWs(body.workspaceId);
      await fsp.mkdir(base, { recursive: true });
      if (body.kind === 'git' && body.remoteUrl) {
        const gitDir = path.join(base, '.git');
        if (!fs.existsSync(gitDir)) {
          const remoteUrl = String(body.remoteUrl);
          if (!/^https?:\/\//i.test(remoteUrl) && !/^git@/.test(remoteUrl)) {
            return json(res, 400, { error: 'invalid remoteUrl' });
          }
          const r = await runCommand(ROOT, ['git', 'clone', '--depth', '1', remoteUrl, base], 120000);
          return json(res, 200, { ok: r.exitCode === 0, ...r, stdout: redact(r.stdout), stderr: redact(r.stderr) });
        }
      }
      return json(res, 200, { ok: true, path: base });
    }

    if (req.method === 'POST' && p === '/fs/tree') {
      const body = await readBody(req);
      const { base } = resolveWs(body.workspaceId);
      const items = await treeWalk(base, base);
      return json(res, 200, { items });
    }

    if (req.method === 'POST' && p === '/fs/read') {
      const body = await readBody(req);
      assertSafePath(body.path);
      const { target } = resolveWs(body.workspaceId, body.path);
      const st = await fsp.stat(target);
      if (!st.isFile()) throw new Error('not a file');
      if (st.size > 2_000_000) throw new Error('file too large');
      const content = await fsp.readFile(target, 'utf8');
      return json(res, 200, { path: body.path, content: redact(content), size: st.size, sha256: sha256(content) });
    }

    if (req.method === 'POST' && p === '/fs/write') {
      const body = await readBody(req);
      assertSafePath(body.path);
      if (body.changeType === 'delete') {
        const { target } = resolveWs(body.workspaceId, body.path);
        await fsp.rm(target, { force: true });
        return json(res, 200, { ok: true, deleted: body.path });
      }
      const { base, target } = resolveWs(body.workspaceId, body.path);
      await fsp.mkdir(path.dirname(target), { recursive: true });
      await fsp.writeFile(target, body.content ?? '', 'utf8');
      const hash = sha256(body.content ?? '');
      return json(res, 200, { ok: true, path: body.path, hash, base });
    }

    if (req.method === 'POST' && p === '/fs/apply-patch') {
      const body = await readBody(req);
      assertSafePath(body.path);
      const { target } = resolveWs(body.workspaceId, body.path);
      if (body.changeType === 'delete') {
        if (!body.deleteConfirmed) throw new Error('delete not confirmed');
        await fsp.rm(target, { force: true });
        return json(res, 200, { ok: true });
      }
      if (body.changeType === 'create' || body.changeType === 'modify') {
        await fsp.mkdir(path.dirname(target), { recursive: true });
        // Phase 0.5: full content only. Naive +/- patch replay is no longer
        // an accepted production path (proper unified diff lands in Phase 3).
        const next = body.content;
        if (next == null) throw new Error('full content required (patch replay disabled in Phase 0.5)');
        await fsp.writeFile(target, next, 'utf8');
        return json(res, 200, { ok: true, sha256: sha256(next) });
      }
      throw new Error('unknown changeType');
    }

    if (req.method === 'POST' && p === '/search/files') {
      const body = await readBody(req);
      const { base } = resolveWs(body.workspaceId);
      const q = String(body.query || '').toLowerCase();
      const items = (await treeWalk(base, base)).filter(
        (i) => i.type === 'file' && (!q || i.path.toLowerCase().includes(q)),
      );
      return json(res, 200, { items: items.slice(0, 200) });
    }

    if (req.method === 'POST' && p === '/search/content') {
      const body = await readBody(req);
      const { base } = resolveWs(body.workspaceId);
      const q = String(body.query || '');
      if (!q) return json(res, 200, { items: [] });
      const files = (await treeWalk(base, base)).filter((i) => i.type === 'file').slice(0, 400);
      const items = [];
      for (const f of files) {
        if (ENV_DENY.test(f.path)) continue;
        try {
          const text = await fsp.readFile(path.join(base, f.path), 'utf8');
          const idx = text.indexOf(q);
          if (idx >= 0) {
            const line = text.slice(0, idx).split('\n').length;
            items.push({ path: f.path, line, snippet: redact(text.split('\n')[line - 1] || '').slice(0, 200) });
          }
        } catch {
          // skip binary
        }
        if (items.length >= 100) break;
      }
      return json(res, 200, { items });
    }

    if (req.method === 'POST' && p === '/terminal') {
      if (terminalInFlight >= MAX_CONCURRENT_TERMINAL) {
        return json(res, 429, { ok: false, status: 'busy', reason: 'too many concurrent terminal tasks' });
      }
      const body = await readBody(req);
      const gate = allowCommand(body.command, !!body.allowDangerous);
      if (!gate.ok) return json(res, 403, { ok: false, status: 'denied', reason: gate.reason });
      const { base } = resolveWs(body.workspaceId);
      const cwd = body.cwd ? resolveWs(body.workspaceId, body.cwd).target : base;
      terminalInFlight += 1;
      try {
        const result = await runCommand(cwd, body.command, body.timeoutMs || 60000);
        return json(res, 200, {
          ok: !result.timedOut && result.exitCode === 0,
          ...result,
          stdout: redact(result.stdout),
          stderr: redact(result.stderr),
          status: result.timedOut ? 'timeout' : result.exitCode === 0 ? 'ok' : 'error',
        });
      } finally {
        terminalInFlight -= 1;
      }
    }

    if (req.method === 'POST' && p === '/git') {
      const body = await readBody(req);
      const op = String(body.op || '');
      const dangerous = ['reset-hard', 'clean', 'push-force'].includes(op);
      if (dangerous && !body.confirmed) {
        return json(res, 403, { ok: false, status: 'denied', reason: 'dangerous git requires confirmation' });
      }
      const { base } = resolveWs(body.workspaceId);
      let argv = null;
      if (op === 'status') argv = ['git', 'status', '--porcelain=v1', '-b'];
      else if (op === 'diff') argv = ['git', 'diff'];
      else if (op === 'log') argv = ['git', 'log', '-n', '30', '--oneline'];
      else if (op === 'branches') argv = ['git', 'branch', '-a'];
      else if (op === 'commit') {
        // Phase 0.5: exact-whitelist staging only. Never git add -A / git add .
        const files = Array.isArray(body.files) ? body.files : null;
        if (!files) {
          return json(res, 400, {
            ok: false,
            status: 'denied',
            reason: 'files whitelist required — derive exact paths from the approved/applied diff',
          });
        }
        const result = body.confirmed
          ? await commitStaged(base, files, body.message)
          : await stageWhitelist(base, files);
        return json(res, result.ok ? 200 : result.status === 'conflict' ? 409 : 403, {
          op,
          needsConfirmation: result.status === 'staged',
          ...result,
        });
      } else if (op === 'revert') {
        const sha = String(body.sha || 'HEAD');
        if (sha !== 'HEAD' && !/^[0-9a-f]{7,40}$/i.test(sha)) {
          return json(res, 400, { error: 'invalid sha' });
        }
        argv = ['git', 'revert', '--no-edit', sha];
      } else if (op === 'reset-hard') argv = ['git', 'reset', '--hard', 'HEAD'];
      else if (op === 'clean') argv = ['git', 'clean', '-fd'];
      else if (op === 'push-force') argv = ['git', 'push', '--force'];
      else return json(res, 400, { error: 'unknown git op' });

      const result = await runCommand(base, argv, 60000);
      return json(res, 200, {
        ok: result.exitCode === 0,
        op,
        ...result,
        stdout: redact(result.stdout),
        stderr: redact(result.stderr),
        status: result.exitCode === 0 ? 'ok' : 'error',
      });
    }

    json(res, 404, { error: 'not found' });
  } catch (err) {
    json(res, 400, { error: err instanceof Error ? err.message : String(err) });
  }
});

if (require.main === module) {
  if (!TOKEN) {
    console.error('[dev-runner] DEV_RUNNER_TOKEN is required');
    process.exit(1);
  }
  ensureRoot().then(() => {
    // Feature Freeze: bind loopback by default; override with RUNNER_BIND=0.0.0.0 only inside private networks
    const bind = process.env.RUNNER_BIND || '127.0.0.1';
    server.listen(PORT, bind, () => {
      // eslint-disable-next-line no-console
      console.log(`[zrh-ai-dev-runner] listening on ${bind}:${PORT} root=${ROOT}`);
    });
  });
}

module.exports = {
  tokenize,
  allowCommand,
  stageWhitelist,
  commitStaged,
  parseNameStatus,
  realpathInside,
  redact,
  sha256,
};
