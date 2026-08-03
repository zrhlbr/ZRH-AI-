/**
 * ZRH AI Dev Runner — sandboxed FS / search / terminal / git plane.
 * Does NOT mount docker.sock. Requires shared token with API.
 */
const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.RUNNER_PORT || 5055);
const ROOT = path.resolve(process.env.WORKSPACES_ROOT || path.join(process.cwd(), 'workspaces'));
const TOKEN = process.env.DEV_RUNNER_TOKEN || '';
if (!TOKEN) {
  console.error('[dev-runner] DEV_RUNNER_TOKEN is required');
  process.exit(1);
}
const MAX_TIMEOUT_MS = Number(process.env.RUNNER_MAX_TIMEOUT_MS || 120000);

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
  /^docker(\s|$)/,
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
      quote = ch;
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
      TEMP: process.env.TEMP,
      TMP: process.env.TMP,
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
      return json(res, 200, { path: body.path, content: redact(content), size: st.size });
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
      const hash = crypto.createHash('sha256').update(body.content ?? '').digest('hex');
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
        // Prefer full content when provided; else naive @@ patch apply of new file content after +++
        let next = body.content;
        if (next == null && body.patch) {
          const lines = String(body.patch).split('\n');
          const out = [];
          for (const line of lines) {
            if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('@@')) continue;
            if (line.startsWith('+')) out.push(line.slice(1));
            else if (line.startsWith('-')) continue;
            else if (line.startsWith('\\')) continue;
            else out.push(line.startsWith(' ') ? line.slice(1) : line);
          }
          next = out.join('\n');
        }
        if (next == null) throw new Error('no content/patch');
        await fsp.writeFile(target, next, 'utf8');
        return json(res, 200, { ok: true });
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
      const body = await readBody(req);
      const gate = allowCommand(body.command, !!body.allowDangerous);
      if (!gate.ok) return json(res, 403, { ok: false, status: 'denied', reason: gate.reason });
      const { base } = resolveWs(body.workspaceId);
      const cwd = body.cwd ? resolveWs(body.workspaceId, body.cwd).target : base;
      const result = await runCommand(cwd, body.command, body.timeoutMs || 60000);
      return json(res, 200, {
        ok: !result.timedOut && result.exitCode === 0,
        ...result,
        stdout: redact(result.stdout),
        stderr: redact(result.stderr),
        status: result.timedOut ? 'timeout' : result.exitCode === 0 ? 'ok' : 'error',
      });
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
        const msg = String(body.message || 'chore: update');
        const add = await runCommand(base, ['git', 'add', '-A'], 60000);
        if (add.exitCode !== 0) {
          return json(res, 200, {
            ok: false,
            op,
            ...add,
            stdout: redact(add.stdout),
            stderr: redact(add.stderr),
            status: 'error',
          });
        }
        argv = ['git', 'commit', '-m', msg];
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

      if (['reset-hard', 'clean', 'push-force'].includes(op) && !body.confirmed) {
        return json(res, 403, { ok: false, status: 'denied', reason: 'dangerous git requires confirmation' });
      }
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

ensureRoot().then(() => {
  // Feature Freeze: bind loopback by default; override with RUNNER_BIND=0.0.0.0 only inside private networks
  const bind = process.env.RUNNER_BIND || '127.0.0.1';
  server.listen(PORT, bind, () => {
    // eslint-disable-next-line no-console
    console.log(`[zrh-ai-dev-runner] listening on ${bind}:${PORT} root=${ROOT}`);
  });
});
