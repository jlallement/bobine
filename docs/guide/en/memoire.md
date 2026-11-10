# Shared memory

An agent can offer to remember what you teach it: a preference, a correction, a project’s
context. The memories you accept are given to the agents at the start of each conversation,
**whatever the agent**: what IBM Bob learned still holds with OpenCode. Nothing is kept without
your approval.

Here you can:

- [accept or decline a proposal](#proposition);
- [read, edit, move or delete your memories](#reglages);
- [turn memory off](#desactiver).

<a id="proposition"></a>

## Accept or decline a proposal

When the agent wants to remember something, a **Remember this?** card appears in the
conversation, with the full text. The conversation goes on while it waits for your answer.

- **Remember**: the memory is kept, and the agent learns it with your next message.
- **No**: nothing is kept.

A memory applies to **You · all projects** (your preferences) or to **This project** only. A
worktree and the repository it comes from share the same memory.

The agent can also offer to forget a memory that is no longer true (**Forget this?**), or to
replace one: the card then shows the old text.

Pay attention to flagged cards: a proposal made right after reading a web page or an attached
file may come from that content rather than from you, and a proposal that contains a command to
run highlights it. Read them carefully: a memory comes back in every conversation of the project.
Text that looks like a secret (key, token, password) is refused.

<a id="reglages"></a>

## Read and tidy your memories

Settings › **Memory** › **Memories**: choose **You · all projects** or a project, then expand a
memory to see who proposed it and when. You can:

- **Edit** its description, type or text;
- **Move to You** (or to this project);
- **Delete**; **Clear all…** empties the memory shown;
- **Export…** the memory shown as Markdown;
- **Attach to a folder…** the memories of a project whose folder was moved.

Memories are Markdown files, in plain text on this Mac (**Show in Finder**). A file changed
outside Bobine, by an editor or by an agent with its own tools, is no longer given to the agents
until you have read it again: **Keep these changes** approves it.

Memory is part of a [backup](reglages.md#sauvegarde).

<a id="desactiver"></a>

## Turn memory off

Settings › Memory › **Memory on**: when it is off, the agents receive neither memories nor a way
to propose them. Your memories stay where they are, and come back when you turn it on again.
