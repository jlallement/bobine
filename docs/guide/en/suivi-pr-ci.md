# PR and CI tracking

Once a worktree’s pull request is open, Bobine follows it for you: CI checks, comments, review
status, conflicts with the base. It can send failed checks to the agent, and merge the PR when
everything is green.

You need the `gh` command (GitHub CLI), installed and signed in to GitHub. Without it, none of this
appears: see [Troubleshooting](depannage.md#gh).

Here, you can:

- [follow the PR](#suivre);
- [have failed checks fixed](#corriger);
- [merge when everything is green](#fusion-auto);
- [push new commits](#pousser).

<a id="suivre"></a>

## Follow the PR

Open a PR from the worktree’s Git view ([Open a pull request](worktrees.md#pr)), or let the agent
open it: Bobine also finds a PR opened elsewhere for the same branch.

In the **Changes** tab, **Git** view, a card shows:

- the PR’s number and title (a click opens it on GitHub), and its state: **Open**, **Draft**,
  **Merged** or **Closed**;
- its checks: failed, running, passed, each with its link;
- the number of comments, the review status (**Approved**, **Changes requested**,
  **Review required**) and **Can be merged** or **Conflicts with the base**.

The **Session** tab also has a **Pull request** line; a click takes you to the Git view.

**How often.** Every 30 seconds while a check is running, then less and less often (up to
10 minutes). With the window in the background: at most every 10 minutes, and not at all after
30 minutes, until you come back. Tracking stops when the PR is merged or closed. **Refresh**
checks again right away.

<a id="corriger"></a>

## Have failed checks fixed

When a check fails, click **Fix failed checks**: Bobine sends the agent the list of failed checks,
with their links and an excerpt of their logs, and asks it to fix them, verify, commit and push to
the same branch.

To make this automatic, check **Fix automatically**: Bobine sends the failures on its own, once
per new commit on the PR, and three times at most. Unchecked by default.

<a id="fusion-auto"></a>

## Merge when everything is green

Check **Merge when everything is green**: Bobine merges the PR as soon as it’s ready, with the
method the repository allows (merge commit, squash or rebase, shown in parentheses). Unchecked by
default.

“Ready” means: the PR is open, not a draft, has no conflicts, all checks passed, and no review is
pending or requesting changes.

Bobine does the merge, not GitHub: Bobine must be open. Neither checkbox is kept when you restart
Bobine.

Once the PR is merged, **Clean up** appears in the Git view: see
[Clean up](worktrees.md#nettoyer).

<a id="pousser"></a>

## Push new commits

While the PR is open, **Open a PR** becomes **Push to the PR**: a click pushes the branch’s new
commits. The button disappears once everything is pushed.
