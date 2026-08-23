# Optional memory-bank format

Memory storage is disabled by default. When the user explicitly asks to save a durable preference or fact:

1. Propose one minimal candidate under 20 words.
2. Show the destination and whether it is sensitive.
3. Wait for explicit confirmation.
4. Deduplicate before writing.
5. Store a summary, not an exact quote, unless the user explicitly requests the quote.

Suggested portable block:

```markdown
- **Date:** YYYY-MM-DD
- **Learning:** <single line, maximum 20 words>
- **Source:** user-confirmed summary
```

Never store credentials, tokens, private keys, payment data, identity numbers, exact addresses, sensitive health details, or third-party personal data by default.
