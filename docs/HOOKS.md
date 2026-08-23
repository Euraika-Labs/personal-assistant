# Hook architecture

The full bounded instruction layer is injected on `SessionStart`. `UserPromptSubmit` emits only a short routing reminder when a local keyword check indicates personal advice, decisions, conflict, writing, research, or health self-care.

Both hooks:

- accept at most 1 MiB of JSON stdin;
- never execute event content;
- never read the transcript path;
- never access the network;
- return host-compatible `hookSpecificOutput.additionalContext` JSON;
- fail open when input is invalid.

Claude and Codex use separate config targets and source matchers. Codex hooks still require user trust through `/hooks`.
