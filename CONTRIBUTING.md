# Contributing to Bobine

Thanks for taking a look. Bobine is a small project, developed largely by coding agents under
human review, and that shapes how contributions work.

## Before you start

- **Read [`AGENTS.md`](AGENTS.md).** It is the single source of rules for anyone, human or agent,
  working on this repository: architecture rules, commands, what « done » means. This page only
  points to it.
- **Documentation is in French**, in [`docs/`](docs/README.md). Feature sheets
  (`docs/features/`) and architecture decisions (`docs/adr/`) are the project's working memory.
  The entry pages (this one, `README.md`, `SECURITY.md`, the issue templates) are in English.
- **Languages**: code, identifiers and commit messages in English; documentation and comments
  that explain the product in French. Interface texts are never hard-coded: a key in
  `src/shared/i18n/locales/fr.json` and `en.json`, displayed with `t()`.
- **Check an existing decision** before proposing to change it: `docs/adr/`. An accepted ADR is
  never edited; a new one replaces it.

## Quick start

```bash
pnpm install
pnpm dev            # run the app (macOS; Electron is downloaded on first run)
./scripts/verify    # lint + typecheck + unit tests: must pass before you call it done
pnpm mock-agent --list   # the scripted agent that tests run against
```

Bobine is in public beta: the most useful contributions right now are bug reports with the
diagnostic report, and small, well-tested fixes.

## Reporting a bug or proposing a feature

Use the [issue templates](https://github.com/jlallement/bobine/issues/new/choose). For a bug,
Settings › Diagnostics › « Report an issue » opens the template with your version and the
diagnostic report already filled in; « Copy report » gives the same text to paste.

Security problems: see [SECURITY.md](SECURITY.md), not a public issue.

## The cycle of a change

1. **Sheet**: a feature or a non-trivial fix starts with a sheet in `docs/features/` (template:
   `docs/features/_modele.md`): why, acceptance criteria. Open an issue first if you want to
   discuss the idea before writing it.
2. **Plan**: written in the sheet before coding when the change touches more than a few files.
3. **Implement** in small increments, running `./scripts/verify` (lint, typecheck, unit tests)
   between each.
4. **End-to-end**: if the interface changes, the affected suites pass in both themes
   (`pnpm build && pnpm e2e --changed` picks them from the files changed since `main`, or name
   them: `pnpm e2e <suite>`, `pnpm e2e --list`) and you have looked at their captures in
   `e2e/captures/`; that is also what runs before a push. The whole suite runs before a version
   tag, or when the batch calls for it (a rework, a file shared by many suites): `pnpm e2e
   --if-needed` (three suites in parallel, about four minutes, macOS only; nothing to do if it is
   already green for the same sources and build).
5. **Close**: the sheet is up to date (status, journal, deviations from the plan), the index
   `docs/features/README.md` too, and a line in `CHANGELOG.md` (« Prochaine version », in French,
   from the user's point of view) and `CHANGELOG.en.md` (« Next version ») when the user can
   see the difference.

A change is done only when all of this holds; if a step could not be done, say so in the pull
request rather than claiming it is green.

## Pull requests

- One pull request per sheet or fix, from a branch of your fork.
- Commits follow [Conventional Commits](https://www.conventionalcommits.org): `feat:`, `fix:`,
  `docs:`, `refactor:`, `test:`, `chore:`.
- `verify` runs on every pull request on GitHub (Linux). The end-to-end suites need a Mac: run
  them locally, and say in the description which ones you ran.
- No new dependency without a word about it in the sheet (and an ADR when it is structural).
  When the app ships a new or updated package, refresh the license notices:
  `pnpm build && pnpm third-party-notices` (`verify`, `pnpm e2e` and `pnpm package` check them).
- Never disable a check (lint, test) to make `verify` pass; never commit a secret.

## Testing with agents

Automated tests never call a real model: they run against the **mock agent**
(`pnpm mock-agent --list`, [`docs/mock-agent.md`](docs/mock-agent.md)). Anything that touches
ACP must stay generic (modes **and** configuration options), be checked against the « Bob
compatibility » section of [`docs/acp.md`](docs/acp.md), and come with a mock-agent scenario for
each documented behaviour. Bob is not available in development: assume nothing about it that is
not documented there.
