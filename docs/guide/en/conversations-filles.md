# Delegated tasks and merging

A **task** is a request handed to a role from the Team, or to another agent, which does it on its
own, in its own conversation, then sends back a **response**. You start one with `@role` in the
message box, from the **…** menu (“Run in parallel…”), or the agent proposes it when your request
contains several independent pieces of work. A task that writes code works in its own
[worktree](worktrees.md), on a new branch; when it is ready, you merge it from its card.

A task has its own real conversation: you can open it, write to it, stop it. It is not a subagent
(the ones the agent starts itself stay in the stream of its tools).

You need a folder in a git repository. There is only one level: a task can’t start another task.

Here you can:

- [start a task](#lancer);
- [answer the tasks the agent proposes](#taches-proposees);
- [follow the tasks](#suivre);
- [merge their changes](#fusionner);
- [set what the agent proposes](#reglages).

<a id="lancer"></a>

## Start a task

**With a role.** Type `@` in the message box and pick a role (see [Agents](agents.md)), then write
your request. The line under the message box says where it will go: an advisory role reads this
folder without changing anything; a role that writes starts from the last commit, on its own branch
(**Choose…** offers other options). Return always sends.

**Without a role.** In the conversation’s **…** menu (in its header, or on its row in the sidebar),
choose **Run in parallel…**, write the **Instruction**, choose the **Agent** and, when the agent
allows it, the **Model**, then **Start** (or ⌘↩). With IBM Bob, the agent picks its own model.

The task appears under its source conversation, in the sidebar; the conversation on screen
doesn’t change. Its header says where it comes from and takes you back there in one click.

“Run in parallel…” is greyed out outside a git repository, or when the number of running tasks
reaches the limit (see [Settings](#reglages)). It doesn’t exist in a task, a draft or an archived
conversation.

A task’s worktree is prepared like any other, but doesn’t wait for your approval: see
[Prepare each new worktree](worktrees.md#accord).

<a id="taches-proposees"></a>

## Answer the tasks the agent proposes

When the agent decides part of the work can go on its own, it proposes it on an **N tasks proposed**
card. Nothing starts without you. For each row:

- **Start**: the task starts;
- **Do it here**: the agent does it itself, in the conversation;
- **Refuse**: the agent won’t propose it again;
- the **Agent and model** icon: change the agent or the model before starting.

**Start all** starts every row still proposed. With the keyboard: ↑ ↓ to pick a row, ↩ to start it.

The agent can suggest each task’s agent, and its model with OpenCode (never with IBM Bob), with its
reason: “Suggested by the agent, to confirm”. Keep the suggestion or change it.

**Expired**: the agent restarted before you answered. **Start** still works.

**Ask for a split.** Start your message with `/split`: the agent proposes one task per independent
piece of work. For example:
`/split Three pieces: the import, the export, the help page.`

<a id="suivre"></a>

## Follow the tasks

**In the conversation**, each task has **a single card**, in the same place for good: under your
`@Role …` bubble, or where the tasks were proposed (a **group card** for several tasks started
together). The card shows the live activity, then the full **response**, in Markdown, then its
actions: **Ask <agent> to apply this response**, **Reply to <role>**, **Open its conversation**.
The footer of each response gives its time, its duration and its cost.

How a task ended shows on its card: **replied** (with the number of files for a task that writes),
**stopped** or **failed**. When a task replies out of view, a marker at the bottom of the
conversation says so (“↑ 2 tasks replied · Show”); **Show** scrolls to its card.

**The cost**, once per card: an amount; **free** when the agent reports a zero cost for a model that
says it is free (“free” at the end of its name); **cost unknown** when it reports a zero cost for
another model (a subscription sign-in, for example), or when some tasks have no cost (“≈ $0.05 + cost
unknown”). Bobine never presents a paid model as free. With an unknown cost, the cost cap can’t
trigger.

**In the sidebar**, each task sits under its source conversation, with its state:
**Running**, **Waiting for approval**, **Replied, unread**, **Replied**, **Stopped**, **Failed**.
It appears as soon as it starts.

**What the agent receives.** The card says so: “Not yet passed to <agent> — it will be with your
next message”, then “Passed”. Tasks the agent started: it is woken once, when all of them have
replied.

**Messages between conversations.** The agent can write to its tasks, and a task can write to the
source conversation. These messages go through the queue and say where they come from
(“From the source conversation…”, “From the task…”); one click opens the other
conversation.

**The Tasks view.** In the **Changes** tab, the **Tasks** view lists the tasks’ worktrees: state,
branch, changed files, the agent’s recommendation. For each one:
<!-- si: finder -->
show it in Finder,
<!-- si: !finder !explorer
show it in the file manager,
-->
<!-- si: explorer
show it in File Explorer,
-->
open it in your editor, [get a review](faire-relire.md) or **Open** its conversation.

**With IBM Bob in Agent mode**, each write or command of a task asks for your approval in its
conversation: it stays on “Waiting for approval” until you answer.

<a id="avis-de-la-mere"></a>

## The agent’s recommendation

The agent reads the responses, checks the work, sends its fixes back, then says whether the branch
is ready. On the task’s row:

- **Recommended**: ready to merge;
- **Not recommended yet**;
- **To review**: the task worked again since this recommendation.

Hover to see the reason. You always do the merging.

<a id="fusionner"></a>

## Merge the changes

A task that writes is merged **from its card**: **Merge into main**, after **View changes** and,
if you like, **Get a review** (see [Request review](faire-relire.md)). A group card offers
**Merge the N ready into main**; with a recommendation from the agent, **Merge the N recommended
into main**, and **Include the M others…** for the others, after confirmation.

**Then clean up (archive, delete the branches)**: a checkbox, before the button. It archives the
conversation of each merged task and deletes its worktree and branch.

The branches go in one after the other, in the order they were started, with each row’s state
live. **Stop** stops after the current merge.

**A conflict.** The task concerned resolves it itself, then the merge resumes. If conflicts
remain: **Retry**, **Abort** or **Show the conflict** (its Git view).

**The main folder has uncommitted changes**: the merge doesn’t start. As with a worktree:
**Commit first** or **Set aside**. See [Merge into `main`](worktrees.md#fusionner).

Nothing is pushed, and no PR is opened: for a PR, use the [task’s Git view](worktrees.md#pr).

**Archive or delete their source conversation**: its tasks become ordinary conversations.
Unarchived, it gets them back.

<a id="reglages"></a>

## Set what the agent proposes

Settings › Conversations, **Delegated tasks** section:

- **Propose tasks**: **Never**, **When it fits** (default) or **Always ask**. This setting tells the
  agent whether to propose tasks; in every case, each proposal goes through the proposed tasks card
  and waits for your approval.
- **Max running tasks**: 1 to 10 per conversation (5 by default). Beyond that, “Run in parallel…” is
  greyed out. Reviews count toward this number.

Turn off the tasks’ tools in Settings › MCP servers › Bobine tools, **Delegated tasks** family.
