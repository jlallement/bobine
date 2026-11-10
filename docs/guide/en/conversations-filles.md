# Child conversations and merging

A child conversation works on its own, in its own [worktree](worktrees.md), on a new branch. You
start it from a “parent” conversation, or the agent proposes it when your request contains several
independent tasks. At the end of each turn, the child reports to its parent. When the work is
ready, you merge the branches in one go.

A child conversation is a real conversation: you can open it, write to it, stop it. It is not a
subagent (the ones the agent starts itself have their own “Subagents” card).

You need a folder in a git repository. There is only one level: a child can’t start a child.

Here you can:

- [start a child conversation](#lancer);
- [answer the tasks the agent proposes](#taches-proposees);
- [follow the children](#suivre) from the parent;
- [merge their work](#fusionner);
- [set what the agent proposes](#reglages).

<a id="lancer"></a>

## Start a child conversation

1. In the conversation’s **…** menu (in its header, or on its row in the sidebar), choose
   **Run in parallel…**.
2. Write the **Instruction**: what the child should do.
3. Choose the **Agent** (by default, the parent’s) and, when the agent allows it, the **Model**.
   With IBM Bob, the agent picks its own model.
4. Click **Start** (or ⌘↩).

The child appears under its parent in the sidebar; the conversation on screen doesn’t change. Its
header says where it comes from (↳ from “…”) and takes you back there in one click.

“Run in parallel…” is greyed out outside a git repository, or when the number of running children
reaches the limit (see [Settings](#reglages)). It doesn’t exist in a child, a draft or an archived
conversation.

A child’s worktree is prepared like any other, but doesn’t wait for your approval: see
[Prepare each new worktree](worktrees.md#accord).

<a id="taches-proposees"></a>

## Answer the tasks the agent proposes

When the agent decides part of the work can go to a child, it proposes it on a **Proposed tasks**
card. Nothing starts without you. For each row:

- **Start**: the child starts;
- **Do it here**: the agent does it itself, in the conversation;
- **Refuse**: the agent won’t propose it again;
- the **Agent and model** icon: change the agent or the model before starting.

With the keyboard: ↑ ↓ to pick a row, ↩ to start it. Click a row’s title to read the full
instruction.

The parent can suggest each child’s agent, and its model with OpenCode (never with IBM Bob), with
its reason: “Suggested by the parent, to confirm”. Keep the suggestion or change it.

**Expired**: the agent restarted before you answered. **Start** still works.

**Ask for a split.** Start your message with `/split`: the agent proposes one child per
independent task. For example:
`/split Three tasks: the import, the export, the help page.`

<a id="suivre"></a>

## Follow the children from the parent

**In the sidebar**, each child sits under its parent, with its state: **Running**,
**Waiting for approval**, **Finished, unread**, **Error**, **Finished**. It appears as soon as its
worktree is created.

**In the parent conversation**:

- one line per start (“Child conversation started: …”), which expands to the exact instruction;
  the same for each “Instruction for…” sent later;
- the **Subtasks** card: one row per child, with its branch, its changed files, its cost, its
  state and **Open**; the total cost at the top;
- a **report** at the end of each child turn, collapsed to two lines (title and cost, then the
  first sentence); expand it for the response, the branch, the files and the number of exchanges.

**What the parent’s agent receives.** A child you started: its report goes with your next message.
Children the agent started: it is woken once, when all of them have finished.

**Messages between parent and children.** The parent’s agent can write to its children, and they
can write to it. These messages go through the queue and say where they come from (“From the
parent conversation…”, “From the child conversation…”); one click opens the other conversation.

**The Children view.** In the parent’s **Changes** tab, the **Children** view lists the children’s
worktrees: state, branch, changed files, the parent’s recommendation. For each one: show it in
Finder, open it in your editor, [request review](faire-relire.md) or **Open** its conversation.

**With IBM Bob in Agent mode**, each write or command of a child asks for your approval in the
child: it stays on “Waiting for approval” until you answer.

<a id="avis-de-la-mere"></a>

## The parent’s recommendation

The parent reads the reports, checks the work, sends its fixes back to the child, then says whether
the branch is ready. On the child’s row:

- **Recommended**: ready to merge;
- **Not ready yet**;
- **To review**: the child worked again since this recommendation.

Hover to see the reason. You always do the merging.

<a id="fusionner"></a>

## Merge the children’s work

At the bottom of the **Subtasks** card, as soon as a finished child has commits to merge, a
sentence says which ones are ready, which are still working, which touch the same files and which
have uncommitted changes (commit them from their Git view: they are left out).

To merge:

1. Turn on **Then clean up** if you then want to archive each merged child and delete its worktree
   and branch (off by default).
2. Click the merge button:
   - without a recommendation from the parent: **Merge the N into main**;
   - with a recommendation: **Merge the N recommended into main**. To take the others too:
     **Include the M others…**, then confirm.

The branches go in one after the other, in the order they were started, with each row’s state
live. **Stop** stops after the current merge.

**A conflict.** The child concerned resolves it itself, then the merge resumes. If conflicts
remain: **Retry**, **Abort** or **Show the conflict** (its Git view).

**The main folder has uncommitted changes**: the merge doesn’t start. As with a worktree:
**Commit first** or **Set aside**. See [Merge into `main`](worktrees.md#fusionner).

Nothing is pushed, and no PR is opened: for a PR, use the
[child’s Git view](worktrees.md#pr).

**Archive or delete the parent**: its children become ordinary conversations. Unarchived, it gets
them back.

<a id="reglages"></a>

## Set what the agent proposes

Settings › Conversations, **Subtasks** section:

- **Propose child conversations**: **Never**, **When it fits** (default) or **Always ask**. This
  setting tells the agent whether to propose children; in every case, each proposal goes through
  the “Proposed tasks” card and waits for your approval.
- **Running child conversations**: 1 to 10 per conversation (5 by default). Beyond that,
  “Run in parallel…” is greyed out. Reviews count toward this number.

Turn off the children’s tools in Settings › MCP servers › Bobine tools, **Child conversations**
family.
