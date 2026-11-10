# Troubleshooting

When something doesn’t work: start with diagnostics, then look for your case below.

Here you can:

- [run diagnostics](#diagnostic);
- [read the log](#journal);
- [report an issue](#signaler);
- fix common cases: [agent not found](#agent-introuvable),
  [OpenCode sign-in expired](#opencode-connexion), [IBM Bob stuck at startup](#bob-bloque),
  [`gh` missing or not logged in](#gh), [connection lost](#connexion-perdue),
  [screenshot unavailable](#capture), [unchecked agent version](#version),
  [the agent has gone quiet](#silence), [after an unexpected stop](#plantage).

<a id="diagnostic"></a>

## Run diagnostics

Settings › Diagnostics (or Help › Diagnostics…) checks everything at once: the agents found and
their version, a trial session in the current folder (folder trusted, sign-in, license), MCP
servers, model providers, Xcode, simulators and AXe, the Android SDK. Each problem comes with the
steps to fix it.

- **Run again** runs the checks again.
- **Copy report** copies it all as text.

Nothing is sent to a model: the trial session is deleted afterwards.

<a id="journal"></a>

## Read the log

Settings › Diagnostics › **Log** shows the two files, with **Open** and **Show in Finder**:

- `main.log`: startup, errors, agents started and stopped, turn durations;
- `agents.log`: the exchanges with the agents, at the Detailed and Trace levels.

They’re in `~/Library/Logs/Bobine/`. Help › Show Log opens `main.log`.

**Log level**:

- **Normal**: only `main.log` is written;
- **Detailed**: also each exchange with the agents (messages, app tools, error output), without
  their content;
- **Trace**: also excerpts of the content, secrets masked, until the next launch.

To understand a problem with an agent: switch to **Detailed**, do the operation again, then read
`agents.log`. The [ACP messages](panneaux.md#echanges-acp) tab also shows the messages live.

<a id="signaler"></a>

## Report an issue

Settings › Diagnostics › **Report an issue** opens a GitHub issue in your browser, pre-filled with
the version and the report. Nothing is sent until you submit it on GitHub.

The Bobine › About Bobine window also has **Copy technical info** (version, commit, macOS,
installed agents), to paste into a report.

<a id="agent-introuvable"></a>

## The agent doesn’t show up, or “command not found”

Bobine only offers installed agents. After installing `bob` or `opencode` (especially in your home
folder): Settings › Diagnostics › **Reload PATH**. Bobine reads the `PATH` of your login shell
again.

Same for “git not found”: install the command line tools (`xcode-select --install`), then
**Reload PATH**.

<a id="opencode-connexion"></a>

## OpenCode’s sign-in has expired

Symptom: an error in English in the conversation, for example
`Integration.Authorization: Request failed: 400`, while the agent is still “Ready”.

Bobine doesn’t detect this case yet. To sign in again, in a terminal (Bobine’s, ⌃`, works):

```bash
opencode auth login
```

Then send your message again.

<a id="bob-bloque"></a>

## IBM Bob is stuck at startup

- **Folder not trusted**: **Trust this folder** (Bob remembers it), or **Trust for this session**
  for a throwaway folder.
- **Sign-in required**: Bob’s sign-in button opens your browser; or **Use an API key**. See
  [Agents](agents.md#cle-bob).
- **License to accept**: read it, accept it yourself with `bob --accept-license` in a terminal,
  then **Try again**. If Bob asks for it at the first message, send your message again and accept
  it in the form that appears.

Bob stops at the first refusal: diagnostics check the rest once the folder is trusted.

**Quota used up**: an exceeded budget or quota isn’t retried; the error shows in the
conversation. The monthly quota is under Bob’s name, at the bottom of the sidebar.

<a id="gh"></a>

## `gh` missing or not logged in to GitHub

“Open a PR” and [PR tracking](suivi-pr-ci.md) go through the `gh` command (GitHub CLI). The
worktree’s Git view tells you what’s missing:

- **`gh` not found**: install it (`brew install gh`), then Settings › Diagnostics › **Reload
  PATH**;
- **`gh` not logged in**: in a terminal, `gh auth login`.

After you log in, Bobine can take up to 5 minutes to notice.

- **No remote**: add one (`git remote add origin …`) so you can push the branch.

<a id="connexion-perdue"></a>

## The connection is lost during a response

Network down, proxy, rate limit: Bobine retries on its own. A banner shows “Connection lost” and
“Trying again in 8 s (3 of 5)”; your message stays queued and goes out again without you having to
resend it. Five attempts, further and further apart, and right away if the network comes back or
the Mac wakes from sleep.

**Try again now** doesn’t wait; Esc or Stop gives up. After the fifth: “Can’t connect” and
**Try again**.

Behind a corporate proxy: see [Corporate network](agents.md#reseau).

<a id="capture"></a>

## Screenshot is unavailable

Capturing an area of the screen (message box, Quick Entry) needs macOS’s “Screen & System Audio
Recording” permission. Turn on Bobine in System Settings › Privacy & Security › Screen & System
Audio Recording, then restart the app. The **Open System Settings** button takes you there.

Attaching the built-in browser’s page or the simulator’s screen doesn’t need it.

After a Bobine update, macOS may ask for this permission again, as well as for keychain access
(“Bobine Safe Storage”): answer **Always Allow**.

<a id="version"></a>

## “Bobine was checked with …”

When your agent has a **newer** version than those tried with Bobine, a discreet notice says so
once in the conversation, with a link to Diagnostics. An **older** version gives a warning, once
too. Nothing is blocked: the notice doesn’t come back, in another conversation or after a restart,
as long as the version doesn’t change. Only an agent that speaks a version of the ACP protocol
Bobine doesn’t know won’t start; the message says what to update, the agent or Bobine.

Diagnostics warn you when an agent reports a version Bobine hasn’t checked. The essentials work,
but features specific to that agent may not. If something is off, [report it](#signaler) with the
log set to **Detailed**. The checked versions are on the [agent’s page](agents.md#page-agent).

<a id="silence"></a>

## The agent has gone quiet

When the agent hasn’t sent anything for 5 minutes during a reply, a banner says so at the bottom of
the conversation. That’s normal during a long command or a long think: nothing is cut off.
**Wait** hides it; **Stop** stops the reply, and the conversation is kept. The banner goes away as
soon as the agent speaks again.

<a id="plantage"></a>

## After an unexpected stop

If Bobine stopped without quitting (crash, Mac shut down), it says so at the next launch and saves
a report on this Mac, **without sending anything**. **Show Report** reveals it in the Finder; read
it before attaching it to a [report](#signaler): it may contain excerpts of your conversations.
Your conversations are kept.

If the interface stops three times in a minute, Bobine offers to restart on the home screen. A
message or a panel that can’t be displayed is replaced by a line that says so (**Try again**), and
the rest of the window stays usable.
