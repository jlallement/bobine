# Security policy

## Reporting a vulnerability

Please do **not** open a public issue for a security problem.

Report it privately through GitHub: on the repository, **Security › Report a vulnerability**
(« private vulnerability reporting »). You will get an answer there; a fix is published as a new
release and the report is credited in the changelog unless you prefer otherwise.

Please include what you can of: the version of Bobine (Settings › About) and of your system (macOS, Linux or Windows), the agent
involved (Bob, OpenCode, or none), steps to reproduce, and what an attacker could do with it.

## Supported versions

| Version | Fixes |
|---|---|
| 1.x, latest release | ✅ |
| 1.0.0 release candidates (1.0.0-rc.N) | the latest one only, until 1.0.0 is out |
| older 1.x releases, 1.0.0-beta.x, 0.x | ❌ |

Only the latest release gets fixes: a fix ships as a new release, there is no backport to an
older 1.x. Release candidates and betas are published as GitHub prereleases. Bobine is
distributed as source and, at each tag, as files built by GitHub Actions: an ad hoc signed,
not notarized `.dmg` for macOS (Apple Silicon), and **previews** for Linux (`.deb`) and Windows
(unsigned installer). Security fixes apply to the three platforms alike; the Linux and Windows
builds remain previews for 1.0.

## What Bobine does with your data

- Nothing is sent to a model by the app itself: only the agent you installed (Bob, OpenCode)
  talks to its models, with your own account or API key.
- API keys entered in the app are encrypted with Electron `safeStorage` (the Keychain on macOS,
  the session keyring on Linux, DPAPI on Windows) and never sent back to the interface. On Linux
  without a session keyring (neither GNOME Keyring nor KWallet), a key is kept in plain text in a
  file only you can read, Settings › Agents says so, and it is encrypted as soon as a keyring
  answers.
- The built-in browser keeps its cookies and cache in the app's data folder; Settings › General
  clears them.
- Logs (`~/Library/Logs/Bobine/` on macOS, `~/.config/bobine/logs/` on Linux,
  `%APPDATA%\bobine\logs\` on Windows) contain exchanges with the agent only at the « Detailed » and
  « Trace » levels you choose in Settings › Diagnostics; check them before attaching one to a
  report.
- All windows run with `contextIsolation`, `sandbox` and without `nodeIntegration`; only the main
  process starts processes and reads files, through a typed IPC.
