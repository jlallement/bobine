<!-- See CONTRIBUTING.md and AGENTS.md. Security problems: SECURITY.md, not a pull request. -->

## What and why

<!-- One sheet or one fix. Link the feature sheet (docs/features/NNN-*.md) or the issue. -->

## Checks

- [ ] `./scripts/verify` passes
- [ ] Behaviour tested against the mock agent (never a real model in tests)
- [ ] Interface changed: e2e suites run (`pnpm build && pnpm e2e --changed`), light and dark — list them:
- [ ] Feature sheet updated; `CHANGELOG.md` and `CHANGELOG.en.md` if users see the difference
