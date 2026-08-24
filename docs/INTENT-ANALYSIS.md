# Intent analysis and clarification

Version 0.2 introduces a high-confidence intent gate. Its purpose is to reduce two common failures: confidently producing the wrong deliverable, and treating a request for information or approval as authorization for an external action.

## Why there is no literal 95% score

Language-model self-reported probabilities are not reliably calibrated. PAMR therefore treats “95% clear” as an operational standard: every field material to the proposed answer or action must be clear enough that no supported alternative interpretation would materially change the result.

The gate considers goal, deliverable, scope, constraints, answer-versus-action intent, current authorization, destination, success criterion, plausible alternatives, and the impact of being wrong.

## Outcomes

| Disposition | Use |
|---|---|
| `proceed` | The material intent is clear. |
| `proceed_with_assumption` | One minor gap affects only safe, reversible conversational output. |
| `clarify` | Plausible interpretations produce materially different answers. |
| `confirm` | Consequential action lacks explicit current authorization or material details. |
| `refuse_or_bound` | Policy, safety, authority, or capability prevents the request. |

The dispositions are a reasoning contract for the model, not a deterministic classifier exported by the Node runtime.

## One-question loop

When clarification is required, the assistant asks one focused question per turn—the question that removes the largest consequential ambiguity. It reassesses after every answer.

After two rounds it offers concrete options and recommends the safest useful default. It may proceed only with conversational output that is easy to reverse. Clarification fatigue never lowers the authorization threshold for consequential action.

## Progressive disclosure

`SessionStart` now injects only a compact bootstrap. The detailed persona, intent protocol, and optional memory-bank instructions remain in separate skill references and are loaded when relevant.

`UserPromptSubmit` supplies a compact intent gate for every non-empty prompt. This replaces the old keyword regex. The gate is deliberately domain-neutral because an ambiguous coding or repository request can be just as consequential as an ambiguous personal request.

## Evaluation

[`evals/intent-cases.json`](../evals/intent-cases.json) contains bilingual oracle cases covering:

- clear requests;
- safe assumptions;
- material ambiguity;
- guidance versus execution;
- approval versus authorization;
- publishing, financial, destructive, and privacy-sensitive actions;
- corrections and multi-act turns;
- urgent health guidance;
- memory that attempts to grant authority;
- behavior after repeated clarification.

The package test validates corpus structure and coverage. Model-level adherence still requires running these cases against each supported host/model and recording actual outputs; static package tests cannot prove an LLM will follow every instruction.
