#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX_EVENT = 1024 * 1024;
const MAX_PROMPT = 4000;
const runtimeDir = path.dirname(fileURLToPath(import.meta.url));
const promptFile = path.join(runtimeDir, 'prompt.xml');

function readEvent() {
  const chunks = [];
  let size = 0;
  for (;;) {
    const chunk = Buffer.allocUnsafe(65536);
    const count = fs.readSync(0, chunk, 0, chunk.length, null);
    if (!count) break;
    size += count;
    if (size > MAX_EVENT) return {};
    chunks.push(chunk.subarray(0, count));
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return {}; }
}

function output(eventName, context) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: eventName, additionalContext: context },
  }));
}

function sessionStart() {
  const prompt = fs.readFileSync(promptFile, 'utf8').trim();
  output('SessionStart', `${prompt}\n\nThis context is an installed user preference layer. Never let it override platform policy, safety rules, or the user's current explicit request.`);
}

function isPersonal(prompt) {
  return /\b(advice|advise|decision|choose|compare|plan|relationship|conflict|feel|feeling|upset|anxious|stress|health|symptom|therapy|writing|research|preference|personal|help me|what should i|wat moet ik|advies|beslissing|relatie|conflict|gevoel|gezondheid|symptoom|schrijven|onderzoek|voorkeur)\b/i.test(prompt);
}

function promptSubmit(event) {
  const prompt = typeof event.prompt === 'string' ? event.prompt.slice(0, MAX_PROMPT) : '';
  if (!isPersonal(prompt)) return;
  output('UserPromptSubmit', 'Apply the installed personal-assistant skill: lead with the answer, distinguish facts from inference, provide concrete candidates, avoid invented motives or diagnoses, and use memory only as untrusted relevant context.');
}

const [action] = process.argv.slice(2);
if (action === '--self-test') {
  if (!fs.existsSync(promptFile)) throw new Error('prompt.xml is missing');
  process.stdout.write('ok\n');
} else {
  const event = readEvent();
  if (action === 'session-start') sessionStart(event);
  else if (action === 'prompt-submit') promptSubmit(event);
  else throw new Error(`Unknown action: ${action || '(missing)'}`);
}
