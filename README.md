# @euraika-labs/personal-assistant

[![CI](https://github.com/Euraika-Labs/personal-assistant/actions/workflows/ci.yml/badge.svg)](https://github.com/Euraika-Labs/personal-assistant/actions/workflows/ci.yml)
[![CodeQL](https://github.com/Euraika-Labs/personal-assistant/actions/workflows/codeql.yml/badge.svg)](https://github.com/Euraika-Labs/personal-assistant/actions/workflows/codeql.yml)
[![npm](https://img.shields.io/npm/v/@euraika-labs/personal-assistant)](https://www.npmjs.com/package/@euraika-labs/personal-assistant)

A safety-reviewed, Mistral-inspired personal-assistant Agent Skill for **Claude Code** and **Codex**, with optional hooks that apply a high-confidence intent gate and progressively load the relevant instruction layer.

## What it does

- Installs one portable `personal-assistant` skill for Claude Code and/or Codex.
- Uses a compact `SessionStart` bootstrap instead of always injecting the full persona.
- Applies a domain-neutral intent gate on every non-empty `UserPromptSubmit` event.
- Separates goal, deliverable, scope, constraints, authorization, destination, and success criteria.
- Asks one focused clarification question when plausible interpretations materially differ.
- Requires explicit current authorization for consequential external actions.
- Encourages concrete answers, respectful pushback, careful inference, and task-sensitive formatting.
- Works without memory; optionally complements [`@euraika-labs/personal-assistant-memory-routing`](https://github.com/Euraika-Labs/personal-assistant-memory-routing).

## What it does not do

- A normal `npm install` does **not** change Claude or Codex configuration.
- It does not log prompts, read transcripts, call a network service, or add telemetry.
- It does not write memory automatically.
- It is not medical, legal, financial, or crisis care.
- It cannot guarantee that every host/model follows the instructions; the included corpus is an oracle suite, not a model-certification result.
- Hooks are guardrails and context injection, not a security boundary.

## Quick start

```bash
npx @euraika-labs/personal-assistant doctor

# Preview only
npx @euraika-labs/personal-assistant install \
  --host both --scope user --hooks --yes --dry-run

# Install skill only
npx @euraika-labs/personal-assistant install --host both --scope user

# Install skill and opt-in hooks
npx @euraika-labs/personal-assistant install \
  --host both --scope user --hooks --yes
```

After installing Codex hooks, review and trust them through Codex's `/hooks` interface. The installer never bypasses host trust controls.

## Installed paths

| Host | Skill | Hook config |
|---|---|---|
| Claude Code, user | `~/.claude/skills/personal-assistant/` | `~/.claude/settings.json` |
| Claude Code, project | `.claude/skills/personal-assistant/` | `.claude/settings.local.json` |
| Codex, user | `~/.agents/skills/personal-assistant/` | `~/.codex/hooks.json` |
| Codex, project | `.agents/skills/personal-assistant/` | `.codex/hooks.json` |

Runtime assets are copied to a stable managed directory under `~/.local/share/euraika-personal-assistant/` for user installs, or `.euraika-personal-assistant/` for project installs.

## Commands

```bash
personal-assistant doctor
personal-assistant status --host both --scope user
personal-assistant install --host both --scope user [--hooks --yes] [--dry-run]
personal-assistant uninstall --host both --scope user --yes
```

The installer preserves unrelated configuration, creates backups before JSON changes, rejects symlinked config files, writes atomically, preserves hook ownership across skill-only reinstalls, and removes only exact owned hook entries. `--force` moves an unowned skill directory to a restorable backup rather than claiming its contents.

## Prompt design

The skill was inspired by the article **“Vibe Instructions for better emotional intelligence, work mode memory and less verbose outputs”** for Mistral Medium 3.5. It is an adaptation rather than a verbatim copy. See [`skill/personal-assistant/references/ORIGIN.md`](skill/personal-assistant/references/ORIGIN.md).

Key changes include consent-based memory, no invented citations, no anthropomorphic claims, qualified interpretation of sarcasm, and explicit precedence for platform policy and safety.

## Intent analysis

Version 0.2 replaces keyword routing and always-on full-prompt injection with a compact bootstrap that instructs the host to use progressive disclosure, plus a strict high-confidence intent gate. “High confidence” is an operational check, not a fabricated numeric score: all details material to the answer or action must be clear.

When ambiguity materially changes the result, the assistant asks one focused question and reassesses. For safe, reversible drafts it may state a minimal assumption and proceed. External, persistent, public, destructive, financial, privileged, credential, privacy-sensitive, or otherwise consequential actions require explicit current authorization and complete material scope.

See [Intent analysis and clarification](docs/INTENT-ANALYSIS.md) and the bilingual [evaluation corpus](evals/intent-cases.json).

## Memory

Memory is optional and separate from this package. For Nowledge Mem, claude-mem, Claude native memory, Markdown files, or custom adapters, use:

```bash
npm install --global @euraika-labs/personal-assistant-memory-routing
pamr install --host both --scope user --hooks --yes
```

Retrieved memory remains untrusted data and may not grant permission or override instructions.

## Security and privacy

See [SECURITY.md](SECURITY.md), [PRIVACY.md](PRIVACY.md), and [THREAT-MODEL.md](THREAT-MODEL.md). Report vulnerabilities privately through GitHub's private vulnerability reporting.

## Releases

A version bump merged to protected `main` runs CI. After successful CI, the release workflow publishes the exact package to npm through trusted publishing and creates a GitHub Release containing the `.tgz`, `SHA256SUMS.txt`, and provenance attestation. Existing versions are never republished.

## License

MIT © Euraika Labs.
