# Bobine guide

Bobine is a macOS desktop app that drives a coding agent: **IBM Bob** or **OpenCode**, or any
other agent that speaks the ACP protocol. You write to the agent as you would in a messaging app;
it reads your project, proposes changes and runs commands, and Bobine shows you everything it
does, asks for your approval when needed, and lets you take back control at any time.

This guide is for developers who use Bobine. Each page starts with what you can do there, then
walks you through it.

<!-- hors-app -->
*Version française : [../fr/README.md](../fr/README.md).*
<!-- /hors-app -->

## Getting started

1. [Getting started](premiers-pas.md): install Bobine, choose a folder and an agent, send a first
   message.
2. [Conversations and permissions](conversations.md): write to the agent, answer its requests,
   stop it, find a conversation.
3. [Modes and models](modes-et-modeles.md): plan mode, switching models, continuing with another
   agent.

## Working

4. [Worktrees](worktrees.md): a conversation on its own branch, its setup (`.worktreeinclude`,
   `.bobine/worktree.json`), merging back into `main`.
5. [Child conversations and merging](conversations-filles.md): hand tasks to other conversations,
   then merge their work.
6. [Request review](faire-relire.md): ask another agent to review the work.
7. [PR and CI tracking](suivi-pr-ci.md): open a pull request and follow its checks.
8. [Scheduled tasks](taches-planifiees.md): run a prompt at a set time.
9. [Aside](aparte.md): ask a question on the side, without touching the conversation.
10. [Multiple folders](plusieurs-dossiers.md): give the agent another folder as well.
11. [Shared memory](memoire.md): what the agents remember about you, with your approval.

## Reference

12. [Panels](panneaux.md): the session, changes, the built-in browser, the terminal, the iOS
    simulator.
13. [Settings: privacy and data](reglages.md): what Bobine remembers and how to
    erase it; the trash, backups.
14. [Agents](agents.md): IBM Bob, OpenCode, and what each one can do.
15. [Troubleshooting](depannage.md): diagnostics, the log, common problems (quiet agent,
    crash, agent version).
16. [Keyboard shortcuts](raccourcis.md).

## See also

- This guide is also in the app: Help › **Bobine Help** (⌘?), with a search, offline. The
  small “?” buttons in the interface open it at the right section.
- **Bobine tips** (at most one a day, on the edge of the message box) are turned off in
  Settings › General › **Bobine tips**; “Show all again” brings back the hidden ones.
- What’s new in each version: Settings › What’s new, or the
  [CHANGELOG](../../../CHANGELOG.en.md).
- Installing from source, behind a proxy or offline:
  [docs/installation.md](../../installation.md).
