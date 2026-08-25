# Changelog

All notable changes follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and Semantic Versioning.

## [0.2.0] - 2026-08-24

### Added

- High-confidence intent gate covering goal, deliverable, scope, constraints, authorization, destination, success criteria, alternatives, and error impact.
- One-question clarification loop with safe defaults after two rounds and no lowered threshold for consequential actions.
- Bilingual intent evaluation corpus and intent-analysis documentation.

### Changed

- Replace brittle personal-keyword routing with a compact domain-neutral gate on every non-empty prompt.
- Replace always-on full persona injection with a compact SessionStart bootstrap and progressive skill disclosure.
- Treat “95% clear” as an operational completeness standard rather than an uncalibrated numeric confidence claim.
- Preserve current-task authorization across clarification while preventing transfer to changed actions or targets.

### Fixed

- Preserve owned hook metadata when a skill-only reinstall follows hook installation.
- Clean versioned runtime assets after the final referencing host is uninstalled.
- Back up and restore pre-existing skill content when `--force` is explicitly used.
- Ship documentation referenced by the packaged README.
- Reject symlink and manifest path escapes before runtime cleanup or skill-backup restoration.

## [0.1.2] - 2026-08-24

### Changed

- Publish the first registry-visible release after npm reserved but did not expose versions 0.1.0 and 0.1.1.
- No runtime behavior changes from 0.1.1.

## [0.1.1] - 2026-08-24

### Changed

- Publish the first registry-visible release after npm reserved but did not expose version 0.1.0.
- No runtime behavior changes from 0.1.0.

## [0.1.0] - 2026-08-23

### Added

- Safety-reviewed personal-assistant Agent Skill inspired by Mistral Medium 3.5 community instructions.
- Explicit installer for Claude Code and Codex user/project scopes.
- Opt-in `SessionStart` and `UserPromptSubmit` hooks.
- Idempotent configuration merge, backups, atomic writes, status, doctor, dry-run, and conservative uninstall.
- Privacy, threat-model, security, and origin documentation.
