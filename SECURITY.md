# Security Policy

## Supported versions

The latest minor release receives security fixes. Critical fixes may be backported when practical.

## Reporting

Use GitHub private vulnerability reporting for this repository. Do not disclose exploitable details in a public issue.

## Design boundaries

Hooks run with the user's permissions and are not a sandbox. They inject bounded local context only, never bypass host trust, and perform no network calls. A normal npm installation has no lifecycle side effects.
