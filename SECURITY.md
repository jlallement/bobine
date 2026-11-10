# Security policy

## Reporting a vulnerability

Please do **not** open a public issue for a security problem.

Report it privately through GitHub: on the repository, **Security › Report a vulnerability**
(« private vulnerability reporting »). You will get an answer there; a fix is published as a new
release and the report is credited in the changelog unless you prefer otherwise.

Please include what you can of: the version of Bobine (Settings › About) and of macOS, the agent
involved (Bob, OpenCode, or none), steps to reproduce, and what an attacker could do with it.

## Supported versions

Only the latest release gets fixes. During the public beta (1.0.0-beta.x, until 1.0.0), that is
the latest beta, published as a GitHub prerelease: older betas and 0.x versions are not
patched. Bobine is distributed as source and as an ad hoc signed `.dmg` built by GitHub Actions
at each tag.

## What Bobine does with your data

- Nothing is sent to a model by the app itself: only the agent you installed (Bob, OpenCode)
  talks to its models, with your own account or API key.
- API keys entered in the app are encrypted with macOS `safeStorage` (the Keychain) and never
  sent back to the interface.
- The built-in browser keeps its cookies and cache in the app's data folder; Settings › General
  clears them.
- Logs (`~/Library/Logs/Bobine/`) contain exchanges with the agent only at the « Detailed » and
  « Trace » levels you choose in Settings › Diagnostics; check them before attaching one to a
  report.
- All windows run with `contextIsolation`, `sandbox` and without `nodeIntegration`; only the main
  process starts processes and reads files, through a typed IPC.
