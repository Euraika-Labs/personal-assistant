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

test('SessionStart emits bounded structured context', () => {
  const r = run(runtime, ['session-start'], { input: JSON.stringify({ hook_event_name: 'SessionStart' }) });
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.equal(out.hookSpecificOutput.hookEventName, 'SessionStart');
  assert.match(out.hookSpecificOutput.additionalContext, /personal_assistant_instructions/);
  assert.match(out.hookSpecificOutput.additionalContext, /Never let it override platform policy/);
});

test('UserPromptSubmit routes personal prompts only', () => {
  const personal = run(runtime, ['prompt-submit'], { input: JSON.stringify({ prompt: 'Wat moet ik doen met dit conflict?' }) });
  assert.equal(personal.status, 0);
  assert.equal(JSON.parse(personal.stdout).hookSpecificOutput.hookEventName, 'UserPromptSubmit');
  const code = run(runtime, ['prompt-submit'], { input: JSON.stringify({ prompt: 'Rename this variable.' }) });
  assert.equal(code.status, 0);
  assert.equal(code.stdout, '');
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
  assert.ok(fs.existsSync(path.join(home, '.claude', 'skills', 'personal-assistant', 'SKILL.md')));
  assert.ok(fs.existsSync(path.join(home, '.agents', 'skills', 'personal-assistant', 'SKILL.md')));
  const claude = JSON.parse(fs.readFileSync(path.join(home, '.claude', 'settings.json')));
  const codex = JSON.parse(fs.readFileSync(path.join(home, '.codex', 'hooks.json')));
  assert.equal(claude.theme, 'dark');
  assert.equal(claude.hooks.Stop[0].hooks[0].command, '/foreign');
  assert.equal(claude.hooks.SessionStart.length, 1);
  assert.equal(codex.hooks.SessionStart.length, 1);
  assert.match(codex.hooks.SessionStart[0].matcher, /startup/);
  assert.ok(fs.existsSync(path.join(home, '.local', 'share', 'euraika-personal-assistant', 'runtime', packageVersion, 'prompt.xml')));

  const uninstall = run(cli, ['uninstall', '--host', 'both', '--scope', 'user', '--yes'], { env });
  assert.equal(uninstall.status, 0, uninstall.stderr);
  const after = JSON.parse(fs.readFileSync(path.join(home, '.claude', 'settings.json')));
  assert.equal(after.theme, 'dark');
  assert.equal(after.hooks.Stop[0].hooks[0].command, '/foreign');
  assert.equal(after.hooks.SessionStart, undefined);
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
