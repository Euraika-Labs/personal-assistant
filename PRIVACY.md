# Privacy

- No telemetry, analytics, tracking, or package-owned network calls.
- Hooks read only the JSON event supplied on stdin.
- Hooks do not open transcripts or write prompt content to disk.
- The package stores only install manifests, package version, owned paths, and exact hook entries.
- Memory is optional and handled by a separate provider/package.
- Durable memory writes require preview and explicit confirmation.
- Do not store secrets, payment data, identity numbers, sensitive health details, exact addresses, or third-party personal data by default.
