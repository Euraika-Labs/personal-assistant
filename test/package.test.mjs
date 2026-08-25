import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtime = path.join(root, 'runtime', 'personal-assistant-hook.mjs');
const cli = path.join(root, 'bin', 'personal-assistant.mjs');
const packageVersion = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;

function run(file, args, { env = {}, input = '' } = {}) {
  return spawnSync(process.execPath, [file, ...args], { encoding: 'utf8', input, env: { ...process.env, ...env } });
}

test('runtime self-test succeeds', () => {
  const r = run(runtime, ['--self-test']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /ok/);
});

test('SessionStart emits only the compact progressive-disclosure bootstrap', () => {
  const r = run(runtime, ['session-start'], { input: JSON.stringify({ hook_event_name: 'SessionStart' }) });
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  const context = out.hookSpecificOutput.additionalContext;
  assert.equal(out.hookSpecificOutput.hookEventName, 'SessionStart');
  assert.match(context, /personal_assistant_bootstrap/);
  assert.match(context, /Load its detailed references only when relevant/);
  assert.doesNotMatch(context, /<health>/);
  assert.ok(context.length < 1400, 'bootstrap should stay compact');
});

test('UserPromptSubmit applies the intent gate without brittle keyword routing', () => {
  for (const prompt of ['Wat moet ik doen met dit conflict?', 'Rename this variable.']) {
    const r = run(runtime, ['prompt-submit'], { input: JSON.stringify({ prompt }) });
    assert.equal(r.status, 0, r.stderr);
    const context = JSON.parse(r.stdout).hookSpecificOutput;
    assert.equal(context.hookEventName, 'UserPromptSubmit');
    assert.match(context.additionalContext, /goal, deliverable, scope, constraints/);
    assert.match(context.additionalContext, /explicit current authorization/);
    assert.match(context.additionalContext, /ask exactly one focused question/);
  }
  const empty = run(runtime, ['prompt-submit'], { input: JSON.stringify({ prompt: '   ' }) });
  assert.equal(empty.status, 0);
  assert.equal(empty.stdout, '');
});

test('intent evaluation corpus covers languages, dispositions, and consequential actions', () => {
  const cases = JSON.parse(fs.readFileSync(path.join(root, 'evals', 'intent-cases.json'), 'utf8'));
  assert.ok(cases.length >= 18);
  assert.deepEqual(new Set(cases.map((c) => c.language)), new Set(['nl', 'en']));
  for (const disposition of ['proceed', 'proceed_with_assumption', 'clarify', 'confirm', 'refuse_or_bound']) {
    assert.ok(cases.some((c) => c.expectedDisposition === disposition), `missing ${disposition}`);
  }
  for (const c of cases) {
    assert.equal(typeof c.id, 'string');
    assert.equal(typeof c.prompt, 'string');
    assert.ok(c.reason || c.bestQuestion, `${c.id} needs an oracle rationale`);
  }
});

test('installer is explicit, idempotent, host-correct, and preserves foreign hooks', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'euraika-pa-'));
  const env = { HOME: home };
  fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(home, '.claude', 'settings.json'), JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: 'command', command: '/foreign' }] }] }, theme: 'dark' }));

  for (let i = 0; i < 2; i += 1) {
    const r = run(cli, ['install', '--host', 'both', '--scope', 'user', '--hooks', '--yes'], { env });
    assert.equal(r.status, 0, r.stderr);
  }
  // A later skill-only reinstall must not forget ownership of already-installed hooks.
  const skillOnly = run(cli, ['install', '--host', 'both', '--scope', 'user'], { env });
  assert.equal(skillOnly.status, 0, skillOnly.stderr);
  assert.ok(fs.existsSync(path.join(home, '.claude', 'skills', 'personal-assistant', 'SKILL.md')));
  assert.ok(fs.existsSync(path.join(home, '.agents', 'skills', 'personal-assistant', 'SKILL.md')));
  const claude = JSON.parse(fs.readFileSync(path.join(home, '.claude', 'settings.json')));
  const codex = JSON.parse(fs.readFileSync(path.join(home, '.codex', 'hooks.json')));
  assert.equal(claude.theme, 'dark');
  assert.equal(claude.hooks.Stop[0].hooks[0].command, '/foreign');
  assert.equal(claude.hooks.SessionStart.length, 1);
  assert.equal(codex.hooks.SessionStart.length, 1);
  assert.match(codex.hooks.SessionStart[0].matcher, /startup/);
  const installedRuntime = path.join(home, '.local', 'share', 'euraika-personal-assistant', 'runtime', packageVersion);
  assert.ok(fs.existsSync(path.join(installedRuntime, 'prompt.xml')));
  assert.ok(fs.existsSync(path.join(installedRuntime, 'intent-gate.xml')));

  const uninstall = run(cli, ['uninstall', '--host', 'both', '--scope', 'user', '--yes'], { env });
  assert.equal(uninstall.status, 0, uninstall.stderr);
  const after = JSON.parse(fs.readFileSync(path.join(home, '.claude', 'settings.json')));
  assert.equal(after.theme, 'dark');
  assert.equal(after.hooks.Stop[0].hooks[0].command, '/foreign');
  assert.equal(after.hooks.SessionStart, undefined);
  assert.equal(fs.existsSync(installedRuntime), false, 'shared runtime should be removed after the last host uninstall');
});

test('--force backs up and restores an unowned skill directory', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'euraika-pa-force-'));
  const env = { HOME: home };
  const skillDir = path.join(home, '.claude', 'skills', 'personal-assistant');
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(path.join(skillDir, 'user-note.txt'), 'keep me');

  const install = run(cli, ['install', '--host', 'claude', '--scope', 'user', '--force'], { env });
  assert.equal(install.status, 0, install.stderr);
  assert.equal(fs.existsSync(path.join(skillDir, 'user-note.txt')), false);
  assert.ok(fs.existsSync(path.join(skillDir, '.euraika-pa-install.json')));

  const uninstall = run(cli, ['uninstall', '--host', 'claude', '--scope', 'user', '--yes'], { env });
  assert.equal(uninstall.status, 0, uninstall.stderr);
  assert.equal(fs.readFileSync(path.join(skillDir, 'user-note.txt'), 'utf8'), 'keep me');
  assert.equal(fs.existsSync(path.join(skillDir, '.euraika-pa-install.json')), false);
});

test('uninstall rejects manifest path and symlink escapes before changing files', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'euraika-pa-home-'));
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'euraika-pa-project-'));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'euraika-pa-outside-'));
  const env = { HOME: home };
  const install = run(cli, ['install', '--host', 'claude', '--scope', 'project', '--project', project], { env });
  assert.equal(install.status, 0, install.stderr);

  const installations = path.join(project, '.euraika-personal-assistant', 'installations');
  const manifestPath = path.join(installations, fs.readdirSync(installations)[0]);
  const original = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const victim = path.join(outside, 'victim');
  fs.mkdirSync(victim);
  fs.writeFileSync(path.join(victim, 'keep.txt'), 'safe');
  const runtimeRoot = path.join(project, '.euraika-personal-assistant', 'runtime');
  fs.symlinkSync(outside, path.join(runtimeRoot, 'escape'));
  fs.writeFileSync(manifestPath, JSON.stringify({ ...original, runtimeDirs: [path.join(runtimeRoot, 'escape', 'victim')] }));

  const escaped = run(cli, ['uninstall', '--host', 'claude', '--scope', 'project', '--project', project, '--yes'], { env });
  assert.notEqual(escaped.status, 0);
  assert.match(escaped.stderr, /Unsafe runtime path|symlinked runtime/);
  assert.equal(fs.readFileSync(path.join(victim, 'keep.txt'), 'utf8'), 'safe');
  assert.ok(fs.existsSync(path.join(project, '.claude', 'skills', 'personal-assistant', 'SKILL.md')));

  fs.writeFileSync(manifestPath, JSON.stringify({ ...original, skillBackup: path.join(outside, 'stolen') }));
  const backupEscape = run(cli, ['uninstall', '--host', 'claude', '--scope', 'project', '--project', project, '--yes'], { env });
  assert.notEqual(backupEscape.status, 0);
  assert.match(backupEscape.stderr, /Unsafe skill backup path/);
  assert.ok(fs.existsSync(manifestPath));
});

test('package manifest ships documentation linked by the README', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.ok(pkg.files.includes('docs/'));
  assert.ok(pkg.files.includes('THREAT-MODEL.md'));
  assert.ok(pkg.files.includes('evals/'));
});

test('dry-run has no side effects and hooks require consent', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'euraika-pa-dry-'));
  const env = { HOME: home };
  const dry = run(cli, ['install', '--host', 'both', '--hooks', '--yes', '--dry-run'], { env });
  assert.equal(dry.status, 0, dry.stderr);
  assert.equal(fs.existsSync(path.join(home, '.claude')), false);
  const denied = run(cli, ['install', '--host', 'claude', '--hooks'], { env });
  assert.notEqual(denied.status, 0);
  assert.match(denied.stderr, /requires --yes/);
});
