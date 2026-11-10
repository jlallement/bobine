# Settings: privacy and data

What Bobine remembers on this Mac, and how to review, back up or erase it. Bobine sends nothing
anywhere except to the agent you use: it has no telemetry.

Settings (⌘,) come in three groups: General, Appearance, Notifications, Keyboard shortcuts;
Conversations, Agents, MCP servers, Commands; Privacy, Data, Diagnostics, What’s new. The search
field at the top finds any setting (⌘F).

Here you can:

- [review and revoke what you’ve allowed](#autorisations);
- [manage the built-in browser’s data](#navigateur);
- [back up your history, and restore it](#sauvegarde);
- [recover a deleted conversation](#corbeille);
- [forget a recent folder](#dossiers-recents) and [clean up orphan worktrees](#orphelins);
- [reset usage](#consommation);
- [try Bobine as new, or reset it](#recommencer).

<a id="autorisations"></a>

## Review and revoke what you’ve allowed

Settings › Privacy › **Allowed without asking** lists everything you’ve allowed once and for all:

- **Tools**: the agent’s tools you answered “always” for;
- **Sites**: the ones the built-in browser opens without asking;
- **Commands · folder**: commands and builds set to “Always in this project”;
- **Worktree setup · folder**: the `.bobine/worktree.json` commands you’ve allowed (see
  [Worktrees](worktrees.md#accord)).

✕ (**Revoke**), then confirm: next time, the agent (or Bobine) will ask again.

<a id="navigateur"></a>

## Built-in browser data

Settings › Privacy › **Built-in browser**:

- **Keep sign-ins** (on by default): cookies and sign-ins in the built-in browser, from one
  launch to the next;
- **Browser data** › **Clear**: cookies, sign-ins, site storage and cache. You’ll have to sign in
  to sites again.

<a id="sauvegarde"></a>

## Back up your history

Settings › Data › **History backup** › **Back up…**: a dated copy of your whole profile
(conversations, settings, permissions, scheduled tasks, usage, memory), without the API keys, in
the folder of your choice. A backup also contains the trash. Restored on another Mac, the memory
comes back, but its memories must be approved again.

**Restore…** puts a backup in place of the current profile, after confirmation; what was there
before is kept aside and can be restored the same way. Restoring brings back Bobine’s
conversations, not the agent’s own internal history: a reply may reappear when the agent resumes
its session. API keys entered for declared agents (Settings › Agents) aren’t in a backup: enter
them again after a restore.

For a single conversation: its **…** menu › **Export as Markdown…** or **Export as JSON…**.

<a id="corbeille"></a>

## Recover a deleted conversation

A deleted conversation (**…** menu › **Delete** › **Move to Trash**) goes to the **Trash**:
Settings › Data › **Trash** shows it, with the number of days it has left. **Restore** puts it back
in the conversation list; **Erase permanently** erases it right away. Otherwise, it is erased on
its own after 30 days.

**Also delete in** *the agent*, unchecked by default and offered only when the agent can do it,
also deletes its session in the agent; that is permanent. Once restored, the conversation then
goes on in a new session, which receives the earlier exchange as text.

Shared memory has its own settings: see [Shared memory](memoire.md).

<a id="dossiers-recents"></a>

## Forget a recent folder

Settings › Data › **Recent folders**: ✕ removes a folder from the list. The folder itself isn’t
touched.

<a id="orphelins"></a>

## Clean up orphan worktrees

Settings › Data › **Orphan worktrees**: worktrees whose conversation was deleted. **Clean up**
erases them with their contents, after confirmation. See [Worktrees](worktrees.md#orphelins).

<a id="consommation"></a>

## Reset usage

Bobine records each exchange with an agent (agent, model, project, tokens, cost, duration) for the
**My activity** page (⇧⌘U). Settings › Data › **Reset…** erases it all, after confirmation. This
can’t be undone: export first (My activity › **Export…** › Entire history) to keep it. Agent
quotas, such as IBM Bob’s, aren’t affected.

<a id="recommencer"></a>

## Try Bobine as new, or reset it

Settings › Data › **Start fresh**:

- **Try Bobine as new** › **Open**: a second Bobine opens on an empty profile, erased when it
  closes. Yours isn’t touched. With **Agents as on a new Mac**, the agents in this second Bobine
  ask again for sign-in and folder trust; your real sign-ins stay.
- **Reset Bobine** › **Reset…**: everything Bobine keeps on this Mac goes into a dated folder in
  the Trash, with a README (conversations, settings, API keys, allowed sites, usage, browser data,
  logs). Then Bobine restarts as on first launch. Check **Also move the app to the Trash
  (uninstall)** to uninstall it.

Your projects, their worktrees and your agents (their sign-ins, settings and sessions) are never
touched.

From a terminal, with the app installed:

```bash
open -n -a Bobine --args --profil-temporaire
```
