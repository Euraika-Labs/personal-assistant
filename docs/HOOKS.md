# Hook architecture

The hooks use progressive disclosure instead of injecting the full persona on every session.

## `SessionStart`

Injects only a bounded bootstrap that:

- explains when the installed skill is relevant;
- points the host to the per-prompt intent gate;
- states precedence and memory trust boundaries;
- preserves a compact default response contract.

Detailed persona, health, conflict, formatting, and memory-bank instructions remain in skill reference files and are loaded only when relevant.

## `UserPromptSubmit`

Injects a compact, domain-neutral high-confidence intent gate for every non-empty prompt. This intentionally replaces the v0.1 keyword regex: keywords could both miss indirect requests and misroute unrelated coding prompts.

The gate tells the model to distinguish goal, deliverable, scope, constraints, answer-versus-action, authorization, destination, success criterion, alternative interpretations, and error impact. It contains no user prompt text and performs no model or network call itself.

See [INTENT-ANALYSIS.md](INTENT-ANALYSIS.md) for the clarification and authorization policy.

## Shared properties

Both hooks:

- accept at most 1 MiB of JSON stdin;
- never execute event content;
- never read the transcript path;
- never access the network;
- return host-compatible `hookSpecificOutput.additionalContext` JSON;
- fail open when input is invalid.

Claude and Codex use separate config targets and source matchers. Codex hooks still require user trust through `/hooks`.
