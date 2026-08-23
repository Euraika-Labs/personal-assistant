# Releasing

1. Update `package.json` and `package-lock.json` with a new SemVer version.
2. Add `## [x.y.z]` to `CHANGELOG.md`.
3. Merge the reviewed pull request to protected `main`.
4. CI runs the full Node/macOS/Linux matrix.
5. After successful current-main CI, `release.yml` checks whether the exact version already exists.
6. For a new version it packs and smoke-tests the tarball, publishes with npm OIDC/provenance, attests it, creates `vX.Y.Z`, and publishes a GitHub Release containing the tarball and SHA-256 checksum.

The release job is idempotent: an existing npm version is a no-op. Never delete or reuse a published version.
