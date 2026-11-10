# Request review

Before merging, have another agent review the work. The reviewer reads the changes without
changing anything: errors first, then what can be simpler. Its comments land on the lines of the
diff, with their severity. Keep the useful ones and send them to the reviewed conversation, just
like your own comments.

You need a folder in a git repository, with changes.

Here you can:

- [start a review](#lancer);
- [read its comments](#remarques);
- [send the comments to the agent](#envoyer);
- learn [what the reviewer does](#relecteur).

<a id="lancer"></a>

## Start a review

1. Open the **Changes** tab (⇧⌘D).
2. Click the **Request review…** icon (a magnifying glass over a frame, in the view bar).
   To review a child from its parent: **Children** view, the same icon on its row.
3. The dialog says what will be reviewed:
   - in a worktree, all the work of the branch (commits and uncommitted changes);
   - otherwise, the folder’s uncommitted changes.
4. If you like, fill in **What to look at** (for example “network error handling”).
5. Choose the **Agent** and, when it allows it, the **Model**: those of the reviewed conversation
   are suggested. Another agent, or another model, gives a fresh pair of eyes.
6. Click **Start review** (or ⌘↩).

The review is one more conversation, “Review: …”, filed like a child: it costs like one, and counts
toward the child conversation limit. Its cost shows on its card and on its row.

You can’t request a review of a conversation that is still responding, of a review, of a draft or
of an archived conversation.

<a id="remarques"></a>

## Read the comments

In the reviewed conversation, a **Review** card follows the reviewer: “Review in progress by …”,
then the number of comments (with how many are high severity), its overall verdict and its cost.

- **Show on the diff** opens the Git view: each comment sits on its lines, with its severity
  **High**, **Medium** or **Low**.
- The **Review comments** list, above the files, shows them all, even those on a file already
  committed. Click one to see the comment on its diff; ✕ removes it.
- **Open review** opens the reviewer’s conversation, with its full response.

You can edit or delete a comment just like your own.

A review started from the parent’s **Children** view puts its card and comments in the reviewed
**child**: open the child to read them.

<a id="envoyer"></a>

## Send the comments to the agent

Remove the comments you don’t need, then click **Send to the agent** in the comments bar. They go
in one message to the reviewed conversation, each with its file, lines, severity and the quoted
code. The agent keeps its context and fixes them.

**Clear comments** removes them all without sending anything.

<a id="relecteur"></a>

## What the reviewer does

- It works in the reviewed conversation’s folder, with no worktree or branch.
- Its instruction is to modify, create, delete or commit nothing, and to run only read commands.
- Bobine checks that the folder didn’t change during the review. If it did (because of the
  reviewer, the reviewed conversation or you), the card says so: check the Git view, the quoted
  lines may have moved. Bobine doesn’t undo anything.
- If it finishes without structured comments, the card says so, and its response is in its
  conversation.

**Agents:** both. With IBM Bob, no choice of model. Depending on its settings, OpenCode may write
without asking for permission: the instruction and Bobine’s check are then the only safeguards.
