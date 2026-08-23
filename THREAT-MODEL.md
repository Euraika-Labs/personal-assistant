# Threat model

## Protected assets

User configuration, prompts, personal context, local files, host trust decisions, and npm/GitHub supply-chain integrity.

## Main threats and controls

- **Malicious package lifecycle scripts:** none are defined.
- **Unexpected host mutation:** explicit CLI command, dry-run, hook opt-in, backups, atomic writes.
- **Configuration clobbering:** structural JSON merge; unrelated fields and hooks are retained.
- **Symlink/path attacks:** symlinked JSON config is rejected; managed paths are fixed.
- **Prompt injection:** the skill states that retrieved memory and content are untrusted data.
- **Sensitive memory capture:** writes are out of scope and require explicit confirmation in companion tooling.
- **Hook abuse:** no transcript reads, environment dumps, shell interpolation of event content, telemetry, or network calls.
- **Supply chain:** protected main, CI, CodeQL, Dependabot, SHA-pinned actions, npm OIDC, provenance, release checksums.

## Non-goals

Hooks do not provide complete policy enforcement. Host permissions and sandboxing remain the security boundary.
