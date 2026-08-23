#!/usr/bin/env node
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
const SKILL = 'personal-assistant';
const MARKER = 'euraika-personal-assistant';

function usage(code = 0) {
  console.log(`personal-assistant ${pkg.version}

Usage:
  personal-assistant doctor
  personal-assistant status --host claude|codex|both [--scope user|project] [--project PATH]
  personal-assistant install --host claude|codex|both [--scope user|project] [--project PATH] [--hooks --yes] [--dry-run] [--force]
  personal-assistant uninstall --host claude|codex|both [--scope user|project] [--project PATH] [--yes] [--dry-run]

A normal npm install changes no Claude or Codex configuration.
Hooks are opt-in and require --hooks --yes.`);
  process.exit(code);
}

function parse(argv) {
  const o = { scope: 'user', project: process.cwd(), hooks: false, yes: false, dryRun: false, force: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--host') o.host = argv[++i];
    else if (a === '--scope') o.scope = argv[++i];
    else if (a === '--project') o.project = path.resolve(argv[++i]);
    else if (a === '--hooks') o.hooks = true;
    else if (a === '--yes') o.yes = true;
    else if (a === '--dry-run') o.dryRun = true;
    else if (a === '--force') o.force = true;
    else if (a === '--help' || a === '-h') usage();
    else throw new Error(`Unknown option: ${a}`);
  }
  if (!['claude', 'codex', 'both'].includes(o.host)) throw new Error('--host must be claude, codex, or both');
  if (!['user', 'project'].includes(o.scope)) throw new Error('--scope must be user or project');
  return o;
}

const hash = (v) => createHash('sha256').update(v).digest('hex');
const hosts = (h) => h === 'both' ? ['claude', 'codex'] : [h];
const quote = (v) => `'${v.replaceAll("'", "'\\''")}'`;
const stamp = () => new Date().toISOString().replaceAll(':', '-');

function target(host, o) {
  const base = o.scope === 'user' ? os.homedir() : o.project;
  const skillRoot = host === 'claude'
    ? path.join(base, '.claude', 'skills')
    : path.join(base, '.agents', 'skills');
  const config = host === 'claude'
    ? path.join(base, '.claude', o.scope === 'user' ? 'settings.json' : 'settings.local.json')
    : path.join(base, '.codex', 'hooks.json');
  const data = o.scope === 'user'
    ? path.join(os.homedir(), '.local', 'share', 'euraika-personal-assistant')
    : path.join(o.project, '.euraika-personal-assistant');
  return {
    host, base, config,
    skillDir: path.join(skillRoot, SKILL),
    runtimeDir: path.join(data, 'runtime', pkg.version),
    manifest: path.join(data, 'installations', `${host}-${o.scope}-${hash(base).slice(0, 12)}.json`),
  };
}

function readJson(file, fallback = {}) {
  if (!fs.existsSync(file)) return structuredClone(fallback);
  if (fs.lstatSync(file).isSymbolicLink()) throw new Error(`Refusing symlinked JSON file: ${file}`);
  try {
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('root must be an object');
    return value;
  } catch (e) { throw new Error(`Invalid JSON in ${file}: ${e.message}`); }
}

function atomicWrite(file, content, expected = null) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  if (expected !== null && fs.existsSync(file) && hash(fs.readFileSync(file)) !== expected) throw new Error(`Concurrent modification detected: ${file}`);
  const temp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.tmp`);
  const fd = fs.openSync(temp, 'wx', 0o600);
  try { fs.writeFileSync(fd, content); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(temp, file);
}

function backup(file) {
  if (!fs.existsSync(file)) return null;
  const body = fs.readFileSync(file);
  const out = `${file}.euraika-pa-backup-${stamp()}-${hash(body).slice(0, 10)}`;
  fs.copyFileSync(file, out, fs.constants.COPYFILE_EXCL);
  return out;
}

function command(t, action) {
  return `${quote(process.execPath)} ${quote(path.join(t.runtimeDir, 'personal-assistant-hook.mjs'))} ${action} # ${MARKER}`;
}

function hooks(t) {
  const cmd = (action) => ({ type: 'command', command: command(t, action), timeout: 3 });
  return {
    SessionStart: [{ matcher: t.host === 'claude' ? 'startup|resume|clear|compact|fork' : 'startup|resume|clear|compact', hooks: [{ ...cmd('session-start'), statusMessage: 'Loading personal assistant preferences', additionalContextLimit: 6000 }] }],
    UserPromptSubmit: [{ hooks: [{ ...cmd('prompt-submit'), statusMessage: 'Routing personal assistant response', additionalContextLimit: 1000 }] }],
  };
}

function owned(group) {
  return Array.isArray(group?.hooks) && group.hooks.some((h) => typeof h?.command === 'string' && h.command.includes(`# ${MARKER}`));
}
function equal(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function merge(config, wanted) {
  const next = structuredClone(config);
  if (next.hooks !== undefined && (!next.hooks || typeof next.hooks !== 'object' || Array.isArray(next.hooks))) throw new Error('Existing hooks must be an object');
  next.hooks ||= {};
  for (const [event, groups] of Object.entries(wanted)) {
    if (next.hooks[event] !== undefined && !Array.isArray(next.hooks[event])) throw new Error(`Existing hooks.${event} must be an array`);
    next.hooks[event] = [...(next.hooks[event] || []).filter((g) => !owned(g)), ...groups];
  }
  return next;
}
function remove(config, recorded) {
  const next = structuredClone(config);
  const conflicts = [];
  for (const [event, groups] of Object.entries(recorded || {})) {
    if (!Array.isArray(next.hooks?.[event])) continue;
    for (const expected of groups) {
      const i = next.hooks[event].findIndex((actual) => equal(actual, expected));
      if (i >= 0) next.hooks[event].splice(i, 1);
      else if (next.hooks[event].some(owned)) conflicts.push(event);
    }
    if (!next.hooks[event].length) delete next.hooks[event];
  }
  if (next.hooks && !Object.keys(next.hooks).length) delete next.hooks;
  return { next, conflicts };
}

function plan(action, targets, o) {
  console.log(`${action} plan (${o.dryRun ? 'dry run' : 'live'}):`);
  for (const t of targets) {
    console.log(`- ${t.host}: skill=${t.skillDir}`);
    console.log(`  runtime=${t.runtimeDir}`);
    console.log(`  config=${t.config}${o.hooks ? ' (hooks requested)' : ' (unchanged)'}`);
  }
}

function install(t, o) {
  const marker = path.join(t.skillDir, '.euraika-pa-install.json');
  if (fs.existsSync(t.skillDir) && !fs.existsSync(marker) && !o.force) throw new Error(`Unowned skill exists: ${t.skillDir}`);
  const wanted = o.hooks ? hooks(t) : {};
  const current = o.hooks ? readJson(t.config) : null;
  const originalHash = o.hooks && fs.existsSync(t.config) ? hash(fs.readFileSync(t.config)) : null;
  const merged = o.hooks ? merge(current, wanted) : null;
  if (o.dryRun) return;

  fs.mkdirSync(path.dirname(t.skillDir), { recursive: true });
  fs.cpSync(path.join(packageRoot, 'skill', SKILL), t.skillDir, { recursive: true, force: true });
  atomicWrite(marker, JSON.stringify({ package: pkg.name, version: pkg.version }, null, 2) + '\n');
  fs.mkdirSync(t.runtimeDir, { recursive: true, mode: 0o700 });
  for (const file of ['personal-assistant-hook.mjs', 'prompt.xml']) fs.copyFileSync(path.join(packageRoot, 'runtime', file), path.join(t.runtimeDir, file));
  fs.chmodSync(path.join(t.runtimeDir, 'personal-assistant-hook.mjs'), 0o755);
  let configBackup = null;
  if (o.hooks && !equal(current, merged)) {
    configBackup = backup(t.config);
    atomicWrite(t.config, JSON.stringify(merged, null, 2) + '\n', originalHash);
  }
  atomicWrite(t.manifest, JSON.stringify({ package: pkg.name, version: pkg.version, host: t.host, skillDir: t.skillDir, runtimeDir: t.runtimeDir, config: t.config, hooks: wanted, backup: configBackup }, null, 2) + '\n');
  console.log(`Installed ${t.host} skill${o.hooks ? ' and opt-in hooks' : ''}.`);
}

function uninstall(t, o) {
  if (!fs.existsSync(t.manifest)) return console.log(`No owned ${t.host} installation; skipped.`);
  const manifest = readJson(t.manifest);
  const current = readJson(t.config);
  const originalHash = fs.existsSync(t.config) ? hash(fs.readFileSync(t.config)) : null;
  const { next, conflicts } = remove(current, manifest.hooks);
  if (conflicts.length) throw new Error(`Owned hooks were edited; refusing removal (${conflicts.join(', ')})`);
  if (o.dryRun) return console.log(`Would remove exact owned ${t.host} entries.`);
  if (!equal(current, next)) { backup(t.config); atomicWrite(t.config, JSON.stringify(next, null, 2) + '\n', originalHash); }
  const marker = path.join(t.skillDir, '.euraika-pa-install.json');
  if (fs.existsSync(marker) && readJson(marker).package === pkg.name) fs.rmSync(t.skillDir, { recursive: true, force: true });
  fs.rmSync(t.manifest, { force: true });
  console.log(`Uninstalled owned ${t.host} files.`);
}

function status(t) {
  const skill = fs.existsSync(path.join(t.skillDir, '.euraika-pa-install.json'));
  const cfg = fs.existsSync(t.config) ? readJson(t.config) : {};
  const hasHooks = Object.values(cfg.hooks || {}).some((g) => Array.isArray(g) && g.some(owned));
  console.log(`${t.host}: skill=${skill ? 'installed' : 'absent'}, hooks=${hasHooks ? 'installed' : 'absent'}`);
}

function doctor() {
  console.log(`personal-assistant ${pkg.version}`);
  console.log(`Node: ${process.version}`);
  console.log(`Platform: ${process.platform}${process.platform === 'win32' ? ' (installer unsupported)' : ''}`);
  const source = path.join(packageRoot, 'runtime', 'personal-assistant-hook.mjs');
  const prompt = path.join(packageRoot, 'runtime', 'prompt.xml');
  console.log(`Runtime: ${fs.existsSync(source) && fs.existsSync(prompt) ? 'ok' : 'missing files'}`);
  console.log('Memory: optional; use @euraika-labs/personal-assistant-memory-routing for multi-provider recall');
}

const [action, ...argv] = process.argv.slice(2);
try {
  if (!action || ['-h', '--help'].includes(action)) usage();
  if (action === 'doctor') doctor();
  else {
    if (!['install', 'uninstall', 'status'].includes(action)) usage(64);
    if (process.platform === 'win32') throw new Error('The installer currently supports macOS/Linux only');
    const o = parse(argv);
    const targets = hosts(o.host).map((h) => target(h, o));
    if (action !== 'status') plan(action, targets, o);
    if (action === 'install' && o.hooks && !o.yes && !o.dryRun) throw new Error('Hook activation requires --yes after review');
    if (action === 'uninstall' && !o.yes && !o.dryRun) throw new Error('Uninstall requires --yes');
    for (const t of targets) action === 'install' ? install(t, o) : action === 'uninstall' ? uninstall(t, o) : status(t);
  }
} catch (e) {
  console.error(`personal-assistant: ${e.message}`);
  process.exitCode = 1;
}
