# What’s new

What changes for you, version by version. Shown in Settings › About.

## Next version

### Fixed

- **Request a review…**: the suggested model is the reviewed conversation’s, which has just
  answered; no longer another model the agent lists but your account doesn’t have. You can still
  pick another model in the dialog.
- **Annotate the page**: the bubbles of placed notes stay closed; a pin’s bubble opens when you
  hover it. They no longer hide the page, and a click for a new note no longer reopens a note
  already placed (whose text could be replaced without you noticing).
- **Roundtable**: the cost of “Ask to apply it” (and of any message that follows) is no longer
  added to the roundtable’s total; a zero cost from free models reads “free”, no longer “cost
  unknown”; an opinion without a readable short answer shows its start on its row; if the
  conversation’s agent runs a command during the synthesis or the decision, the card says so.
- **Roundtable**: after “Ask participants to respond”, the roundtable card keeps its “Total used”
  line (tokens, and “cost unknown” when the agent gives no cost), folded or not.
- **Merging a child task**: the merge commit reads “Merge branch '<task branch>' into <working
  branch>” and follows the working branch’s history, like a merge made by hand (before: “Merge
  branch 'master' into bobine/…”, the wrong way round).
- **OpenCode with a ChatGPT account**: a model the account doesn’t allow (“… is not supported when
  using Codex with a ChatGPT account”) shows the “The … model didn’t answer” card with “Choose
  another model”, no longer the raw error.
- **Cleaning up an open child task** brings you back to its original conversation, instead of
  opening an empty one.
- **Recent models**: a model no longer enters them just by being picked or when it was refused,
  only after it answered (roundtable participants menu, “Continue with another agent”).
- **First launch with `bobine <folder>`**: the welcome’s “Where to work?” step offers that folder
  first (“Use this folder”).

## 1.2.0-beta.1 — November 25, 2026

### New

- **Roundtable** (`/roundtable`, or the composer bar button): the same question goes to two to
  five models, none seeing the others, then the conversation compares the opinions and gives a
  synthesis that decides. Participants are checked in a menu (the last choice is kept), read-only;
  the conversation’s model, which writes the synthesis, is not one of them. A line says before
  sending the minimum tokens used (“at least 4× the tokens of a plain question”). A card follows
  each opinion, with each one’s letter; the synthesis is read-only too, and the card says so if the
  agent writes anyway; it shows the real name behind “Participant A, B…”; “Ask to apply it” and,
  once, “Ask participants to respond”. See the help: Roundtable.

## 1.1.0-rc.2 — November 24, 2026

### Fixes

- After clicking a link to a file that no longer exists, “File not found” no longer shows twice
  (the bubble plus a tooltip on top of it) when the mouse stays put.

## 1.1.0-rc.1 — November 23, 2026

### New

- **Files tab**, on demand in the right panel (“+” menu, **⌘P** puts the cursor in the filter,
  **⇧⌘Y** for the tree): the tree of the conversation’s folder and its other folders, hidden and
  ignored files included (dimmed), a dot on those the conversation changed; a filter by name or
  path (`path:42` goes to the line). A file opens **read-only**, highlighted and numbered:
  Markdown rendered or as source, images; ⌘F searches it, ⌃G goes to a line. A **comment on a line** or a range
  goes to the agent with the diff comments. Each file’s menu: open in your editor or the default
  app, Finder, mention in the message box (or drag the row onto it), copy the path, show the diff.
  Maximized (⇧⌘J), the file and the tree side by side. A `file:line` link in a reply opens the
  tab at that line (⌘-click: your editor); “Browse files” on delegated work.
- iOS Simulator: AXe, shipped with the app, moves to 2.0.4; taps and screen reading are
  faster (per AXe, a tap ≈ 0.1 s instead of about 1 s).
- A link to a file that no longer exists says so itself: when clicked, it turns into struck-through
  code, a “File not found” bubble shows under it for a few seconds (hovering says it again), with
  no red notice in the conversation; if the file comes back, so does the link.
- iOS Simulator: the agent also sees empty, unnamed text fields and can tap them to type.

## 1.0.1 — November 24, 2026

### Fixes

- The “Delete” dialog of a child conversation whose branch is already merged no longer reports
  lost commits; only commits that no other branch keeps are counted. Same fix in Settings › Data ›
  Orphan worktrees.
- The title the agent gives a conversation no longer comes from what Bobine adds to your first
  message (“Summarize the bobine_capabilities project”): the conversation then keeps the title
  taken from your message.
- IBM Bob: the Bobcoin quota shows at the bottom left from launch — the month’s last reading,
  with its reading time in the details — then updates a few seconds after Bob is ready. It only
  appeared once its reading was done.
- My activity › IBM Bob on this Mac: the help for “Spend on this Mac” explains why this total can
  be lower than the page’s: sessions Bobine deletes from Bob (drafted commit messages, asides…)
  are no longer there.

## 1.0.0 — November 24, 2026

### Fixes

- Linux and Windows: the ☰ menu reopened with Alt right after closing it stays open; it closed
  again at once, or stayed on screen after the next Alt press.

## 1.0.0-rc.5 — November 24, 2026

### Fixes

- Settings › Data › Orphan worktrees: the worktree of a conversation restored from the trash (or
  still in the trash) is no longer listed, and “Clean up” can no longer delete it along with its
  uncommitted work. Only a conversation erased for good from the trash leaves its worktree
  orphaned; the list now updates by itself.
- Windows: a scheduled task in a folder such as `C:\Users\…\project` is saved and runs; it was
  refused, or dropped when the list was read back.
- Built-in browser: a new tab that never finishes opening no longer blocks the agent forever;
  after 20 seconds, the agent is told the page did not finish loading and carries on, and the tab
  can still be used and reloaded.
- Built-in browser: a click or keystroke from the agent right after a page opens, or in a tab the
  panel is not showing, is no longer silently lost; the agent waits for the page to be displayed.
- Several pieces of work proposed at once: the card always lists them in the order the agent
  proposed them, the same every time, and a line already shown no longer changes place.
- Outline of a long conversation: at the very bottom of the thread, the last message is the one
  highlighted, even when the last exchanges are short.
- **Stop** on a child conversation that was just started (its agent still starting) now stops
  it: the turn no longer runs to the end.
- Worktree setup awaiting approval: the card no longer moves under the pointer while the reply
  is written below it, so “Allow” is no longer missed.
- An existing empty file rewritten by the agent: Changes › Conversation no longer marks it
  “created” (its tool card already said it was edited), and **Revert this change** or **Branch from
  this message** now leave it empty instead of deleting it.
- Image annotation: **Esc** while typing a text now discards only that text; the annotation stays
  open (it used to close entirely). Outside text entry, Esc closes it as before.

## 1.0.0-rc.4 — November 23, 2026

### New

- **New version notice**: at launch, at most once a day, Bobine looks at the releases published
  on GitHub. If a newer one exists, a discreet line at the bottom of the sidebar says so; **View**
  opens its page in the browser, ✕ hides it, and that version won’t be announced again. Nothing is
  downloaded or installed, and nothing shows when offline. Settings › What’s new: **Check for new
  versions** (on by default) and **Check now**.

### Fixes

- Proxy changed in Settings while an agent can’t reach its model: the banner says so (“Network
  settings changed since … started”) and **Restart the agent** applies it; the current message
  comes back into the composer, without being sent.
- “The agent hasn’t sent anything for…” banner: the buttons move under the text, which keeps the
  full width; the proxy address is no longer split in two. During that silence, the indicator
  says “Response in progress” instead of “Writing…”.
- Less truncated text: in a narrow header, the temporary-profile chip keeps only its icon before
  the title gets cut; Session › Changes wraps instead of cutting “uncommitted”; in a narrow
  composer, the session settings join the 📎 menu before the model name gets cut.
- Right-click on a conversation in the sidebar: the conversation menu (like ⋯), no longer a
  selected word and “Copy”.
- Scheduled tasks › New task: the open conversation’s folder is suggested, and **Change…** lists
  the recent folders, then “Other folder…”.
- Chat: the Changes panel talks about the chat’s documents, no more “last commit”.
- A conversation restored from the trash picks up like any other: its agent starts again and the
  message is sent. It used to stay “Stopped”, the message left in the composer, with no
  explanation. Restoring a conversation deleted with its tasks restores them with it; in the
  trash, its row says so (“with its 2 tasks”). A task deleted on its own before stays there.
- Task card: the header no longer says “replied” for a task whose conversation was deleted
  (“1 deleted”), nor for a merged task (“1 merged”).
- An agent that can’t reach its model (unreachable proxy, network down) no longer leaves the
  reply on “Thinking…” without a word. OpenCode: a banner says so from its second attempt, with
  the countdown to the next one, its message, and a hint: the proxy that is set (without its
  credentials), or the connection (Wi-Fi, VPN); **Network settings** opens the proxy field. Any
  agent: after 5 min with nothing, the “The agent hasn’t sent anything for…” banner shows, and
  cites the proxy when one is set.
- Settings › Agents › Advanced, Corporate network: the proxy is no longer lost when you move
  straight on to the next field (“No proxy”) and leave it too.
- Composer: when the window narrows, the bar folds in the same frame; the send button no longer
  briefly sticks out of the composer on a busy machine.
- A click in the thread is no longer lost when a turn ends at that very moment: the thread no
  longer shifts under the pointer between press and release (for example on a row of a work card,
  which did not expand). Likewise when the thread was almost at the bottom, or a reply arrived
  during the press: it now only scrolls down on release (for example on **Allow once**, which had
  no effect).
- A row of a work card no longer slides under the pointer when the turn ends just as you aim at it:
  the click on its arrow is no longer lost.
- “Remember this?” card: while the agent writes below it, it no longer slides up under the
  pointer; the click on **Remember** or **No** is no longer lost.
- The buttons of a work that writes in its branch appear all at once, in place, when it finishes:
  **Merge into main** no longer pops in at the front a moment after the others, and no longer
  pushes **View changes** or **Open its conversation** out from under the pointer.
- Narrow composer: during a response, the “Add a follow-up…” placeholder no longer runs under the
  “↑ Previous messages” hint. The first line keeps room for it; in a narrow window, the hint
  shrinks to the ↑ key (its name in a tooltip) and the placeholder wraps if it doesn’t fit.
- Work card: a task that finished while the agent is still responding now reads “replied” (and
  counts in “1 replied”, even while other tasks remain proposed), as in the sidebar and the panel,
  instead of “working”; its tooltip says its response will show when the agent’s response ends.
  What it does is written without its folder’s path (“Edit README.md”), the full path in a
  tooltip.
- Merge stopped on a remaining conflict: **Retry**, **Abort** and **Show the conflict** no longer
  flash in and vanish at once; they wait until the branch has been read again after the stop, then
  stay.
- With the pointer resting on a work card, the thread stays still, but nothing signalled what
  arrived below, out of view (a permission request, for example): the **Scroll to bottom** arrow
  now appears, with the count of new items, without moving the card.
- After **Move to Trash**, focus goes to the composer: it is no longer lost in the page along with
  the deleted row.
- The keyboard is no longer lost in the page when the button you used disappears or is disabled
  (**Allow once**, **Deny**, **Remember**, a banner’s **Wait** or **Stop**, the Stop button,
  **Commit**, Settings closed with Esc or ✕): it goes to the composer, or to the next element of
  the window still open (**Check now** while “Checking…”). **Edit** on a memory puts the cursor in
  its first field; opening the Terminal or Browser tab gives them the keyboard.
- **Start all**: the tasks of a card keep the proposed order, instead of reordering (and changing
  the row under the pointer) depending on which one starts first.
- While pressing a task row, what arrives below, out of view, shows the **Scroll to bottom** arrow
  at once, not only on release.
- Screen readers: the Language, Quick window and Editor lists (and those of the other settings)
  have a name; new themes are announced “Aurora, new” instead of “AuroraNew”.

## 1.0.0-rc.3 — November 21, 2026

### Fixes

- Side panel: the empty Changes view has its margin and no longer touches the edges; My activity
  no longer shows a clipped month name; in What’s new (French), quotes and “: ; ? !” no longer
  break away from their word at the end of a line.
- A message sent right after **New conversation** or **New discussion**, while the agent is still
  starting, is no longer ignored: it stays in the input and is sent on its own as soon as the agent
  is ready. If the agent first asks you to log in, it simply stays in the input.
- A file the agent **rewrites** without sending its content (OpenCode, `write`) now counts in the
  turn summary and in Changes › Conversation, marked “modified”, “no line counts” rather than
  “+0 −0”; the Git view shows its actual state.
- **Run the plan** is disabled once the plan has run successfully (“Plan already run”): no more
  double runs; a question in Ask or a stopped run leave it available.
- Panel tabs: a tab’s **✕** no longer appears under the pointer that just activated it, and a
  double click never closes a tab.
- Reviewer comments in the diff wrap within the panel’s visible width.
- A task whose conversation was **deleted** says so on its card (“conversation deleted”) and
  explains why its buttons are gone; its response is no longer sent to the agent nor wakes it.
- `/compact` no longer carries pending task responses: they go with your next real message.
- A conversation whose folder was **moved or deleted**: Bobine says so before sending, and nothing
  is sent; the log no longer claims git is missing.
- The thread follows the response after “Ask … to fix”, even with the pointer still on the card.
- A local link (`http://localhost…`) switches the panel to the Browser right away, without waiting
  for the page to load.
- Texts: model and mode menus titled in the interface language; readable task activity (“Read
  liste.js” rather than “read”); the line under the input and its hint address the chosen role;
  curly apostrophes everywhere; “Bobcoin” capitalized.
- macOS menus (Close All, Full Screen, Dictation…) follow the app’s language; the built-in browser
  asks for pages in macOS’s languages.
- Conversation search no longer shows a role’s hidden instruction.
- Narrow window: the Code / Discussion switch no longer overflows.
- No more “View changes” on a card whose tasks are all read-only.
- Bobine’s internal fallback folder no longer appears among recent folders.
- Agent stopped: “The agent stopped” said once, and a forced stop explained.
- The browser address hint is never cut; Discussion: no browser without its tab; the sidebar toggle
  is named for VoiceOver.
- `file:line` written as code in a response opens with a click.
- A link to a file without a folder followed by a line (`list.js:9`), as a link or as code, opens on
  click: it no longer stays underlined with no effect.
- A path written as code is underlined as a link only if the file exists in the conversation’s
  folder: no more links to a file yet to be created (`tests/list.test.js`), relative to another
  file (`../list.js`) or outside the conversation’s folder. A file the agent creates later becomes
  a link as soon as the tool writing it finishes.
- Clicking a link to a missing file no longer stacks one notice per click, and the turn’s foot
  (time, duration, files) stays visible.
- The plan card keeps its foot (time, duration); the Session tab’s “uncommitted files” line stays on
  one line; `@git-changes` and `@terminal` sit under “Context” in the `@` menu.
- `/` menu: Bobine’s commands show the conversation’s agent only.
- Launching with `bobine <folder>`: the previously shown conversation’s agent no longer starts for
  nothing.
- Several roles for one message: each task is named after its role; in English, built-in roles keep
  their English names in the thread.
- On Windows, a git installed under “Program Files” is now recognised when it’s missing or when the
  project folder is gone: a clear message instead of the raw “spawn … ENOENT” error.

## 1.0.0-rc.2 — November 20, 2026

### New

- **Built-in browser and self-signed certificates** (HTTPS dev server: Vite, Webpack…): instead of
  a red `ERR_CERT_AUTHORITY_INVALID` line, a Chrome-like warning with the certificate’s
  fingerprint; for a local or private address, **Advanced** then **Continue to … (not secure)**,
  for that certificate only, for the session or remembered if you ask. “Not secure” shows in the
  address bar; revoke it in Settings › Privacy. No admin rights needed, nothing installed in the
  keychain; the agent can never accept a certificate.
- **One vocabulary** for delegated work, everywhere (thread, sidebar, Session › Running, Changes,
  Settings, notifications, export, guide): what you hand to a role or another agent is a **task**,
  which sends back a **response** and comes from its **source conversation**; it has “replied”, is
  “stopped” or “failed”. No more “child
  conversation”, “subtasks” or “report”; Changes › Children becomes **Tasks**, the Settings section
  **Delegated tasks**. The agent’s own subagents keep their name.
- **Honest cost**, everywhere (cards, usage details, `/cost`, My activity, scheduled tasks, asides,
  subagents): a zero cost shows as “free” only for a model that says it is free; otherwise (OpenCode
  signed in with a subscription, for example) “cost unknown”, never “≈ $0.00”. The cost cap then
  says it can’t trigger. One cost per card; a card where some tasks have no cost says “≈ $0.05 + cost
  unknown”.
- The agent’s task list is now called **To-dos**; “Tasks” is kept for delegated tasks.
- Model menu: after a refusal for lack of sign-in, the other models from the same provider are
  marked “likely” (sign-in likely needed, said in the tooltip).
- A saved model the agent no longer offers: the notice says so in one plain sentence (“OpenCode no
  longer offers the model “GPT-6.2 Sol”: this conversation uses …”), without a raw identifier, once
  per conversation, and says where to change the default model. A setting the agent applies after
  the timeout says so too.
- Unfolding a row at the bottom of the conversation (tasks card, “Read more”) no longer scrolls the
  conversation under the pointer: it catches up with the bottom once the pointer leaves the card.
- After the agent is woken up, the tasks card says “Responses passed to …”.
- Durations: “< 1 s” under a second, never “0 s”, timeouts included.
- “Request review” starts the **Code reviewer** role: one way to get a review, from Changes, the
  “Tasks” view or a task’s card. The request shows in the thread (“@Code reviewer Review the
  branch …”) with its card, which shows **every comment**: its severity, `file:line` (a click opens
  the diff on that file), one sentence, then its verdict, or “Nothing to report”. “Ask <agent> to
  fix” sends its comments to the conversation’s agent; “Show on the diff”, “Reply to Code reviewer”
  and “Open its conversation” follow. A task’s review shows inside that task’s card. A model other
  than the reviewed task’s is suggested by default. In the reviewer’s conversation, its instructions
  are folded (“Role instructions”). Typing `@code-reviewer` runs the same review: uncommitted
  changes, otherwise the current branch, otherwise the last commit, with your text as what to look
  at. A click on `file:line` shows that line in the diff.
- The agent’s merge recommendation is no longer a line in the thread: it sits on the task’s row
  (“Recommended”, “Not ready yet”), with its note in the tooltip. Merging a task never deletes a
  branch that changed since the merge, nor the folder of a task still working or with changes: it
  says so, and everything stays.
- The tasks the agent proposes in a turn form **a single card**, where it proposed them, that
  changes in place: proposed (Start, Do it here, Decline, “Start all”), then “3 tasks · 1 working,
  2 finished”; each row unfolds on the task’s whole response. The card’s footer merges its ready
  tasks into main (“Merge the 2 ready into main”, with the agent’s recommendation), and the
  progress and outcome show in the card. Several `@roles` in one message form the same card. No
  more “Subtasks” card jumping down the thread, nor separate “The agent started…” lines or reports.
- A task that writes code (a coding `@role`, or “Start in parallel…”) merges from its own card:
  “View changes”, “Get a review”, “Merge into main”; the card shows the merge steps, then “Merged
  into main · branch deleted”.
- A request to a role (`@UX/UI expert …`) stays in the thread, like a message, with the role’s
  chip. Right below it, a single card that no longer moves: what the role is doing and for how
  long, then **its whole response** (collapsed after about ten lines, “Read more”), its duration
  and cost. “Ask <agent> to apply this response” sends the response to the conversation’s agent; “Reply to
  <role>” continues the same task, in the same card. A line says whether the conversation’s agent
  already knows this response. No more separate launch card, “Subtasks” row or report for these
  tasks.
- A turn’s summary is now the footer of the reply that ends it: “21:17 · 2m 29s · 9 files +346
  −0”, with the cost, without repeating the duration. It stays under its reply, and whatever
  arrives later shows below it. When the agent is still working after the turn ends (a
  background subagent, for example), this footer says “Still working… · 32s”, only once. The file
  count opens the Changes tab.
- When work handed to a role replies while its card is off screen, a thin line above the message
  box says so (“↑ UX/UI expert replied · Show”); “Show” scrolls to the card and briefly outlines
  it. The line goes away once the card has been seen.

### Fixes

- The top of a message no longer slides under the title bar fade when you jump to it from the
  outline, a card or the keyboard; and the window no longer stays shifted up with the title bar cut
  off (conversation, My activity, Scheduled tasks, Settings in a short window).
- **A new role no longer hides an existing one.** Creating a role whose identifier is already
  taken (by a built-in role such as `@code-reviewer`, a personal role or a project role) is refused
  at the first step, naming the role that has it, with “Use @…-2” to take a free one; renaming a
  role follows the same rule. Two roles with the same icon or colour have always been two separate
  roles. “Save as personal role” on a built-in role still replaces it.
- A task blocked by a refused model (free quota used up…) says so everywhere: “quota used up” or
  “model refused” in its card, the sidebar and Session › Running, instead of “waiting for you”.
- The Code reviewer’s card says where its review starts (“this conversation’s 4 commits”, “since
  the last review”, “the last 5 commits”); a shallow clone and unreviewed submodules are flagged.
- **“@Code reviewer Review what was done” reviews what was done**: on the main branch, the
  conversation’s commits (since the last review, else since it started), never a lone merge
  commit; with uncommitted changes, those and the commits. The card always says what was reviewed
  (“Reviewed: 4 commits, 12 files (a3f2c1e..9b8e7d0)”), even when there is nothing to report.
- Clicking a finding’s `file:line` opens the diff that was reviewed, even if the file was fixed
  since (the view says so), instead of “No changes”.
- **Free quota used up** (OpenCode: “Free usage limit reached”): the “The … model didn’t answer”
  card with “Choose another model”, instead of the raw error; in a task’s card too, where you can
  change the task’s model.
- A task’s live activity holds on one line: a long command is cut, shown whole in a tooltip.
- Text typed while a task is being prepared is no longer erased.
- “Retry” on a task no longer repeats its request in the card.
- A role’s reply starts with a two-line summary, without a “Report” heading.
- The hint under the composer with a role is grey, no longer in the warning colour.
- “Reply to <role>” puts the cursor in the right composer, even with two conversations side by
  side.
- A failed reply seen in its card is no longer “to read”.
- The working indicator shows the turn’s duration, the step’s in smaller type.
- Tasks keep their launch order under their conversation.
- My activity: the cost tile counts unknown-cost exchanges like the table (its number goes up if
  your model comes with a subscription), and the first month label is no longer cut.
- Changes tab: the top bar wraps when the panel is narrow; “Refresh” no longer sticks out of the
  panel.
- Handing work to a role that writes no longer shows a warning before you even type: a discreet
  line under the input says where it will work ("from the last commit, without your N uncommitted
  changes"), Enter always sends, and "Choose…" lets you commit first, ask for just a read-only
  opinion (for this message), or see the changes. In a repository with no commit yet, the role
  works directly in the folder: no more "last commit ()", and no empty commit.
- The UX/UI expert role now proposes a direction without changing anything (read-only), like the
  security expert or the tech lead: the main agent or an architect applies it. A copy you changed
  in Settings › Roles keeps its own setting.
- Each conversation keeps its own mode and model: changing the mode or model in one conversation
  no longer changes those of another conversation reopened later (after a restart or after it was
  put to sleep). A conversation left in Plan reopens in Plan. Your last choice is still the
  starting point for new conversations.
- Context gauge after the conversation is summarized (`/compact`): it no longer stays at the old
  level until the next message. When the agent does not give the new figure (OpenCode), Bobine
  estimates it, marked with “≈” and explained, until the agent gives it. In Session › Context,
  “Agent (not itemized)” no longer swells with the freed space, and messages exchanged after the
  summary still count.
- A model the agent says is unavailable (OpenCode: “Model unavailable”): the “The … model didn’t
  answer” card shows, with “Choose another model”, instead of a raw red error. The “… isn’t
  signed in to its provider” notice goes away as soon as the agent answers otherwise, for example
  after signing in.
- First launch with a folder (`bobine <folder>`): no agent starts before you choose one in the
  welcome; the conversation for that folder opens afterwards, with the chosen agent.
- Welcome, “Where to work?” step: for an agent that edits files without asking, the text no
  longer promises “with your approval”.
- Settings › Diagnostics: a session that wasn’t tried says the real reason (test profile, or an
  agent that can’t delete it), without contradicting the footer.
- Log: the harmless “ResizeObserver loop …” warning on resize is no longer recorded as an error.
- Delegated tasks: a task stopped with ■ is shown as “Stopped” (sidebar, tasks card, role card,
  Changes › Tasks), no longer “finished” with a green check. Changes › Tasks shows “merged” like the
  tasks card. A task’s response counts as read as soon as you see it in the conversation that
  started it. The agent’s tools name the task by its title, no longer by its id.
- Background subagents (OpenCode): while a subagent keeps working after the turn ends, then while
  the agent answers its report, the conversation stays “in progress” (indicator under the thread,
  “Still working…” at the bottom of the sidebar, the conversation’s row). “Done in …” only shows
  at the real end, including the time spent answering the report.
- Each turn keeps its own “Done in …” summary, under its own reply: with a queued message, the
  previous turn no longer loses its summary, and the summary no longer sticks under cards that
  arrived later.
- The summary’s duration no longer counts the time spent waiting for your answer (approval,
  question, proposals): it is shown separately, “40 s waiting for you”.

## 1.0.0-rc.1 — November 19, 2026

### Fixes

- Electron 45.4.1: Chromium and V8 security fixes; a right-clicked element is no longer kept in
  memory after it is removed.
- Commit message drafted by the agent: its cost now counts in the conversation, its cap and My
  activity, even with IBM Bob, which writes it after its reply. Aside costs also show in My
  activity.
- Question cards (including “Website” and commands to approve): no option looks chosen until you
  point at one, and “Send” stays greyed out with no choice; an empty answer is no longer sent (it
  counted as a refusal). To not answer: “Skip”.
- Settings: every switch (per-conversation cap, notifications, memory…) has its name for screen
  readers.
- Built-in browser: site approval can no longer be bypassed. Before reading or acting on a page
  (screenshot, click, typing, JavaScript…), the agent needs approval for the site shown; otherwise
  the “Website” card asks for it. During an agent action, the page can no longer go to an
  unapproved site (link, `location = …`, redirect): the navigation is stopped and the agent told.
  Your own browsing is not affected.
- `main.log` now masks secrets, like `agents.log`: a key passed as an argument to a custom agent
  (`--api-key …`) or a saved key no longer appears in clear.
- A configuration file written by Bobine (`mcp.json`, `opencode.json`…) keeps its permissions: a
  file only you can read (0600) no longer becomes readable by other accounts, and a file Bobine
  creates is 0600.
- “Commit first” also flags as “secret?” `.npmrc`, `.netrc`, `.pypirc`, SSH keys (`id_ed25519`,
  `id_ecdsa`…), `*.pfx`, `*.jks`, `*.keystore`, `credentials.json` and `service-account*.json`.
- Built-in browser cookies are encrypted on disk (keychain key). You stay signed in.
- “Always allow” is no longer remembered for future conversations when the agent does not say what
  kind of tool it is.
- An agent that doesn’t answer a mode or model change no longer blocks the conversation at
  startup or the picker: after 30 s, the conversation starts without that setting and says so
  (“Setting … not applied”), and the picker shows the error.
- Reading the PATH at launch: a shell startup file that waits for input no longer causes a 10 s
  wait, and a shell that doesn’t lend itself to it (tcsh, nushell…) no longer prevents finding the
  agents: Bobine then reads the PATH with zsh (macOS) or sh.
- Conversation opened side by side: the file search after `@` completes even while that
  conversation is writing its answer.
- Quitting Bobine is faster: only the conversations that changed are written to disk again.
### New

- macOS 15 Sequoia or later is now required: it is the oldest macOS each release is tried on
  before it is published. On macOS 13 or 14, Bobine refuses to open.
- The `.dmg` now ships with its SHA-256 checksum (`SHA256SUMS-macos-arm64.txt`), like the Linux
  and Windows packages, and every file of a release with a GitHub provenance attestation:
  `gh attestation verify <file> --repo jlallement/bobine` tells you it was built by this
  repository, from that tag. Details in `docs/installation.md` (French).
- Bobine declares macOS 13 as its minimum, as the README says: an older Mac tells you so when
  opening it, instead of running a version never tried on it.

## 1.0.0-beta.9 — November 19, 2026

### Fixes

- The “Always in this project” choice for commands is now called “Always this command here”: it
  only ever remembered the exact command, in this folder, and now says so.
- A child conversation whose report (or a message to its parent) is cut no longer forces the
  parent to ask for it again: the cut line tells the agent how to read the whole text.
- Queue: an edited message keeps its place instead of moving to the end.
- Export: a name typed with its extension (“notes.md”) no longer gives “notes.md.md”.
- “Tokens processed” counts the same thing everywhere: the input and output reported by the
  agent, in `/cost`, the usage details and My activity. Before, `/cost` added the cache reads
  (4,051,903 instead of 242,370 in a run with OpenCode). Cache and thinking show up separately
  (“Also: … read from cache”). The token cap still counts everything, and now says so (“tokens,
  cache included”).
- A dollar cost reported by the agent is an estimate (its own prices, without your subscription or
  discounts): it now shows with “≈” everywhere, and “estimate” in the usage details, `/cost` and
  My activity (“Estimated cost”). Bob’s bobcoins, its own count, keep no “≈”.
- The welcome trial sends its message with the conversation’s model (the one on its chip), not
  the model the agent picks for a new session. If the agent doesn’t offer it, the result says
  which model answered.
- “All my activity…”, at the bottom of the usage details, finally looks like a link.
- A stopped tool group shows all its states: “✕ 1 failed · ⊘ 1 interrupted” instead of the
  failure alone.
### New

- The commit message proposed by “Commit” (Git view, “Commit first”) is written by the
  conversation’s agent, from the checked files, their diff and the project memory (for example
  “Conventional Commits in English”), in a separate session: nothing shows up in the
  conversation, even while the agent works there. “Stop” while it writes; the message stays
  editable. With no answer within 45 s, or if the agent can’t answer, the proposed message is in
  English, based on the files, with no word cut, and a line says why. A “secret?” file only sends
  its name. Settings › General › “Commit message written by the agent” to do without it.

### Fixes

- After “Commit, then merge” or another commit made by Bobine outside the Changes panel, the Git
  view updates on its own; it kept showing “Commit (23)” until “Refresh”.

## 1.0.0-beta.8 — November 18, 2026

### Fixes

- “Commit first” (merge refused, child conversation launch) shows the full list of files before
  you confirm, one checkbox per file, all checked at first. Before, every modified or new file was
  committed, even those not shown (an `.env` that is not ignored, for example). Only checked files
  are committed, and the proposed message lists only them. A name that looks like a secrets file
  gets a “secret?” tag. Unchecked files stay uncommitted: the merge sets them aside then puts them
  back, and a child conversation leaves without them.
- Bobine no longer calls on an agent you don’t use: if Bob is not the agent you use, its quota no
  longer shows up at launch; it appears when a conversation with Bob is ready, then is read again
  with “Refresh”; each reading creates then deletes a session in Bob. A disposable profile (“Try
  Bobine as new”, a test data folder) no longer reads this quota at all, and diagnostics no longer
  opens a trial session there on its own: nothing is written to your real `~/.bob` unless you
  asked for it.
- iOS or Android project created during a conversation: the agent gets Bobine’s tools to build
  it and run it in the simulator or emulator as soon as its reply ends, if it can reload its tool
  list (OpenCode); otherwise, a notice in the thread says so, with “Restart the agent”.
- Change: Bobine no longer opens on a new conversation at every launch; it reopens the
  conversation that was on screen when you quit (quit mid-turn, the one that was working, ready
  to carry on). A new conversation is still one click away (⌘N); it also opens at launch if the
  last one shown was empty, or has been archived or deleted since.
- A message sent just before quitting Bobine no longer comes back in the input at the next
  launch.
- Child conversations: a child that would start in its worktree without this folder’s
  uncommitted work no longer starts silently. Bobine says so beforehand (`@role`, “Proposed
  tasks” card, “Run in parallel…”) with the number of changes, and offers “Commit first” or
  “Start anyway”; for roles mentioned with `@`, “Ask for a read-only opinion”: they read this
  folder as it is, uncommitted changes included. A child that started anyway is flagged on its
  card and on each of its reports, and the agent that starts children is warned.

## 1.0.0-beta.7 — November 17, 2026

### Fixes

- Child conversations: a child that has just started stays “Running” (“working” for a role)
  until it answers; it no longer shows “Finished” with a check mark for a moment before it has
  even received its brief.
- Cost cap (Bob): when the cost read at the end of a reply goes over the cap, the card no
  longer says the reply was interrupted, and “Continue” no longer restarts the agent for nothing.
- Session settings: the menu no longer grows under the pointer when its rules and tools arrive
  late: clicking “Model” no longer lands on the row below.
- OpenCode 2.3.0: its subagents, which now always run in the background, stay “running” until
  they report, then show their answer and all of their work; the reply the agent then gives on its
  own appears as a separate message instead of being stuck to the previous one.
- Electron 45.3.3: Chromium and V8 security fixes; a cookie set by a site in the built-in
  browser just before you quit Bobine is now kept.

## 1.0.0-beta.6 — November 16, 2026

### New

- Bobine for Linux and Windows, in preview, to download with each version: a `.deb` package for
  Ubuntu 24.04 or later and Debian, an installer for Windows 11, for x64 and arm64. The Windows
  installer is not signed: SmartScreen warns on first launch (“More info › Run anyway”).

### Improved

- Linux and Windows (previews): the app no longer talks about the Mac, the Finder, the Dock or the
  macOS Keychain; it says “this computer”, the file manager (File Explorer on Windows), the
  session keyring or DPAPI, help included.
- Linux without a session keyring (no GNOME Keyring or KWallet): an API key is kept in plain text
  in a file only you can read, and Settings › Agents says so, with how to encrypt it; it is
  encrypted as soon as a keyring answers.
- Settings › Appearance: “Code ligatures”, off by default (`!=` stays `!=`); when on, a code font
  that has them draws `!=` as ≠ and `=>` as an arrow.
- New fonts, the same on Mac, Linux and Windows: Inter for the interface, JetBrains Mono for code
  and diffs, bundled with Bobine. The system fonts (SF Pro, SF Mono on the Mac) remain available
  in Settings › Appearance; the terminal is unchanged.
- Deleting a parent conversation offers to delete its child conversations too (checked by
  default); unchecked, they carry on alone as ordinary conversations.

### Fixes

- Bob’s cost: a cost that Bob records a little late after its reply is still shown, without
  waiting for the next turn.
- Linux and Windows: the browser’s “File saved” banner no longer squeezes its text to one
  letter per line; the “Show in the file manager” (or “Show in File Explorer”) button wraps instead.
- Linux: agents and commands started by Bobine no longer receive its open files and
  connections; an agent left behind after Bobine was force-quit no longer stops it from
  starting again.
- Chat space: a file that also has another name elsewhere on your Mac (hard link) is no longer
  changed without asking you; the permission request says why. Bobine no longer lists it among
  the documents, and neither opens nor copies it.
- Archiving a parent conversation also archives its children; a child whose parent was deleted
  becomes an ordinary conversation instead of staying tied to one that no longer exists.

## 1.0.0-beta.5 — November 15, 2026

### Fixes

- Chat space: a chat’s folder no longer shows up under its identifier (“3973c57d-…”). The
  Session tab says “Documents: This chat” (a click shows it in Finder), the agent’s tools and
  commands say “Documents”, and search, the trash, the sidebar tooltip and the export no longer
  show its path; in My activity, chats count on a single “Chats” row. The quick entry window,
  opened from a chat, targets your project folder rather than the chat’s.
- Header of a child conversation in a narrow window: the title shortens first, then the
  “read-only” pill shrinks to its icon (the text in a tooltip), instead of being cut mid-word.
- Long thread: jumping to an early message from the outline, or searching the thread, no longer
  freezes the app (17 s on a 1,250-exchange thread, just over a second now); scrolling up the
  thread is smoother too.

## 1.0.0-beta.4 — November 14, 2026

### New

- New Aurora theme, light (“Aurora”) and dark (“Aurora Night”), replacing Sepia: a calm base with
  a few aurora touches (a glow at the top of the sidebar, your message bubble in a soft gradient, a
  colored ring around the message box while you type, the main button in a gradient, a tinted
  shadow under permission requests, frosted glass on menus and Settings). With macOS “Reduce
  transparency” or “Increase contrast”, the glass turns opaque and the gradients solid. If you used
  Sepia, Bobine switches to Light.
- The right panel opens at 320 px instead of 380, leaving more room for the conversation. The width
  you set by dragging its edge is kept; double-clicking the edge goes back to the default width (it
  used to maximize the panel: the ⤢ button still does). In a narrow panel, a changed file’s
  actions appear on hover, so its name stays whole.
- Chat space: Bobine is also a chat, next to the code. The Code | Chat switcher at the top of the
  sidebar (⌘1 / ⌘2) opens a space with no project, to ask a question, write an email or work on
  documents. Drop PDF, Word, Excel or image files there: they are copied into the chat (your
  originals are not touched) and stay with it. Documents the agent creates or changes show up as
  cards in the thread and in the “Documents” panel (preview, Open, Save a copy…). There the agent
  has none of Bobine’s tools (browser, terminal, child conversations); its writes are allowed in
  the chat’s documents and refused elsewhere, and each answer is shown. “Continue in a project…”
  (title menu) picks up the chat in a Code-space conversation, with the documents copied if you
  want.
- Composer: ↑ in an empty composer brings back the last message you sent in this conversation, ↑
  again the earlier ones, ↓ goes forward (then back to an empty composer). The message comes back
  as typed, with its `@role` tokens; in a multi-line message the arrows move through the lines
  first. A “9/10” pill shows where you are, Esc clears the composer, and any edit turns it into a
  regular draft. Each conversation has its own history, kept with it.

## 1.0.0-beta.3 — November 14, 2026

### New

- Roles: “Install in…” on a role’s page adds it as an IBM Bob mode (Bob Shell, Bob IDE) or as an
  OpenCode agent, for you or for the project. The sheet says where and what, shows the exact text,
  backs up the file before writing, and never touches a mode or agent Bobine did not write; the
  page then says whether it is up to date, offers “Update” when the role has changed, and
  “Remove”. In Bobine, the role can then run in that mode: its read-only is held by the agent
  itself.

### Improved

- Roles: `@role` can be the very first message of a new conversation; it enters the history and
  the child conversation is attached to it. A role’s child answers in the interface language,
  named to the agent.
- Built-in roles: their description (“When to call on it?”) and their instructions now come in
  English or French, following the interface language; a personal role made from a built-in role
  keeps the language shown.

## 1.0.0-beta.2 — November 14, 2026

### New

- Roles: specialists to hand work to, each in a child conversation that carries its icon and
  color. Seven roles are built in (UX/UI expert, Flutter expert, front-end architect, back-end
  architect, security expert, tech lead, code reviewer); create your own in three steps (who, how,
  with what), from a built-in role, a blank page or a successful child conversation (“Save as
  role…” on its report), just for you or for the project (`.bobine/roles/`, shared through git).
  To call on a role, type `@` in the message box (roles come first) or click it in the “Team”
  section of the sidebar: it becomes a token, the “Will go to…” line says where the message goes,
  and sending starts one child conversation per role mentioned, in parallel. The agent also knows
  your roles and can propose to hand them work. Read-only roles work in your folder without
  writing to it: Bobine refuses their writes and reports any change to the folder (for an agent
  that writes without asking, read-only is only requested, and you are told). Edit, turn off or
  delete them in Settings › Roles, which also flags a project role that replaces another one and
  the files left out.

### Improved

- Child conversations: the agent proposes them on its own when they help — several independent
  tasks, long work to follow separately, a review or audit by a fresh pair of eyes — without you
  having to insist; a short reminder repeats this after the conversation is summarized and when a
  conversation is resumed (unless set to “Never”).

## 1.0.0-beta.1 — November 10, 2026

The first public beta of Bobine: expect rough edges, and please report them on GitHub. The app
is not notarized by Apple yet, so macOS needs one extra step to open it (see the README).

### New

- IBM Bob: on a command card, “For all projects” (folded at the bottom of the card) adds the
  command — or, for a chained command, the parts you pick — to the commands allowed or denied
  everywhere, as in Bob IDE; the current card also gets your answer. These are Bob IDE’s and Bob
  Shell’s own rules: a deny applies right away, even in an open conversation; an allow too if
  “Listed commands” was already on, otherwise from the next conversation, like groups. The first allow also turns on “Listed commands”, and says
  so; a one-word prefix is flagged, and must be confirmed in Settings. A command denied
  everywhere isn’t run by Bobine’s own tools either (terminal, servers, builds).
- Settings › Agents › IBM Bob › Approvals: the groups approved for every conversation, access
  outside the folder, the allowed and denied commands (add, edit, remove). An unreadable Bob
  settings file is never rewritten; Bobine keeps a copy (`settings.json.bobine.bak`) before each
  change.

### Improved

- Permission cards: with Bob, “Always in this conversation” states the scope of the choice (a
  command and each of its parts, every file change); with another agent, the card promises nothing
  beyond “the agent decides”. The conversation folder in a command is shown as a chip (full path on
  hover). The task list shows its tasks (done, in progress, to do) and their count; an MCP tool shows
  its arguments; a flagged card says why “Always” isn’t offered.
- About Bobine: a discreet line says that Bobine is an independent project, not affiliated with
  IBM.
- License texts now ship with the app (the `licenses` folder of its resources): Bobine’s,
  Electron’s and Chromium’s, the terminal font’s, and the full notices of every bundled
  third-party component.

### Fixes

- When the agent withdraws its own permission request (Bob does this for the other requests already
  allowed by an “Always”), the card disappears quietly and so does the waiting badge in the
  conversation list, instead of waiting for a useless answer.
- Settings › Privacy › Allowed without asking: “Updating todo list” now reads “Task list update”.
- In card labels, your home folder is shortened to `~` (the command block you approve stays in
  full).

## 0.11.2 — November 9, 2026

### Improved

- Permission cards: a command or edit that writes outside the conversation folder, into a hidden
  file of your home folder (`~/.zshrc`…) or into a system folder, or that asks for administrator
  rights (`sudo`), is flagged by an amber banner, and “Always allow” is no longer offered on it.
  It is a warning, not a guarantee. On other cards, a note reminds you that the agent decides what
  “always” covers.
- When the agent reaches its maximum number of steps, a card says so and offers “Continue”. If it
  then refuses every message without doing anything (Bob counts its limit over the whole session),
  the card offers “Reopen the session and continue” or “New session with the summary” instead of
  leaving you stuck; a queued message is no longer sent on its own only to be refused.
- Session tab, “Changes”: two lines that no longer get mixed up. “Conversation” shows what the
  conversation changed (“None” for a new one), “Folder” what is uncommitted in the folder; each
  opens its view of the Changes tab.

### Fixes

- A model whose provider isn’t signed in: the card says “The … model didn’t answer” instead of
  “Sign-in expired”, and offers “Choose another model” (your message is sent again right away with
  it, once) or “Sign in”. The refused model is marked “sign-in needed” in the model list; the
  conversation shows “Model refused”.
- Under a sign-in card, the message’s “Try again” icon is no longer shown: it opened a new branch
  that failed the same way. It is now named “Try again in a new branch”.
- Quitting Bobine during Diagnostics (an agent check in progress) or while the quota is being
  read no longer leaves an agent or `bob chat` running after the app.
- SSO sign-in (welcome and “Sign-in required” card): if nothing happens after signing in in the
  browser, “Try again” checks again instead of waiting forever.
- API key: saving is no longer silent when the macOS Keychain is waiting for permission. Bobine
  says it is waiting for the Keychain window; with no answer within 60 s, the key isn’t saved, what
  you typed is kept and “Try again” is offered.
- The composer’s Stop button now has a name (“Stop Response”) for screen readers and
  accessibility tools; it only had its icon.
- Bobcoin cap: when the quota read had failed (Bob not yet signed in at launch), the cap never
  showed up for the rest of the session, even after signing in with SSO. It is now read again as
  soon as Bob is ready (conversation opened, successful sign-in check).
- “Sign-in required” and “Sign-in expired” cards, welcome, Diagnostics: Bob’s sign-in button now
  follows the app’s language (“Se connecter par SSO” in French instead of Bob’s English “Log in
  with SSO”).

## 0.11.1 — November 8, 2026

### Improved

- Session tab, “Running”: a terminal no longer shows up as soon as it opens, only while a command
  runs in it (`npm run dev`, `sleep 30`…), under the command’s name and with its duration since
  it started. Stop interrupts the command without closing the terminal.
- Clearer authorization cards: the file is named relative to the conversation folder
  (“notes.md”, “src/…/notes.md”, outside the folder with “~”), a path too long is cut from the
  start, never the file name, and the whole path shows on hover. A new file is announced as such:
  “Create notes.md”, “Allow creating this file?”. For a command, the folder is no longer repeated
  under the command; the conversation folder reads “In project” (“In project/src” for a
  subfolder), a folder outside it is still shown in full with its warning, and “Copy” stays at
  the top right. On the tool line and in Changes too, the folder is cut before the file name: its
  extension stays visible.

### Fixes

- Bob’s sign-in expiring mid-conversation: instead of the raw “Request Failed — Invalid or
  expired API key” error, the “Sign-in expired” card shows (sign in again with SSO or use an API
  key), then your message is sent again once, in the same conversation.
- Terminal: prompt icons (powerlevel10k, starship, oh-my-posh…) show instead of empty boxes,
  with nothing to install: Bobine brings a Nerd Font (MesloLGS Nerd Font). Letters keep
  the font chosen in Settings › Appearance.
- OpenCode: files it creates now count in Changes › Conversation and in the changes summary
  at the top of the conversation (only edits to existing files showed), live
  and after reopening.

## 0.11.0 — November 7, 2026

### New

- Memory shared by all agents: an agent can propose to remember what you teach it (a preference,
  a correction, a project’s context). Nothing is kept without your approval: each proposal comes as
  a “Remember this?” card in the conversation, with the full text, and the conversation goes on
  meanwhile. Kept memories are given to agents at the start of every conversation of the project,
  whatever the agent. A proposal made right after reading a page, or that contains a command to
  run, is flagged. Settings › Memory: read, edit, move, delete, export; turning memory off erases
  nothing.
- **Bobine Help** (Help menu, ⌘?): the user guide in its own window, placed beside the
  conversation, in the interface language and without a network. A table of contents, a search
  that answers as you type and shows the chosen result’s page right away (↑↓, ↩, Esc), found
  words highlighted, and the keyboard
  shortcuts page taken from the real menu. Small “?” buttons open Help at the right section:
  worktree setup, “Request review”, scheduled tasks, aside, and several Settings sections
  (Memory and the Trash among them). The guide also covers shared memory, the trash, backups, an
  agent’s version notice and the “agent hasn’t sent anything” banner.
- **Bobine tips**: at most one a day, at the right moment, on the top edge of the input box (a
  side question while the agent works, a nearly full context, the same message on a third day, to
  schedule in one click) or at the foot of the Git view (a big change worth a review before
  merging). × closes it for today, “Don’t show again” for good;
  a feature you have already used gets no tip. Settings › General › Bobine tips turns them all
  off, and “Show all again” brings back the ones you hid.
- GitLab, self-hosted included: on a GitLab repository, the Git view offers “Open an MR” instead
  of “Open a PR” (with `glab`, the GitLab CLI, logged in to the host): the branch is pushed, the
  merge request opened against the base branch and its link shown (short: “demo/app!1”); an MR that is already open is
  found again, and “Push to the MR” shows up after new commits. When it fails, the message says
  what to do: `glab` missing or not logged in to the host, host unreachable (VPN), certificate
  rejected, no push rights, protected branch. Pipeline tracking is not there yet (GitHub only). A
  repository that is neither GitHub nor GitLab keeps the GitHub button, as before, until
  “Refresh”: the Git view then says why there is no PR, and the button goes away. Nothing is sent
  to an unknown host.
- Trash: a deleted conversation stays there for 30 days (Settings › Data), where it can be
  restored, or erased right away. “Also delete in the agent” is no longer checked by default, and
  is only offered when the agent can do it.
- Full backup: conversations, settings, permissions, scheduled tasks, usage and memory (not the API
  keys).
  “Restore a backup…” puts it back after confirmation; what was there before is kept aside and can
  be restored the same way.

### Improved

- Worktree Git view: one outcome at a time under the buttons (the last action; “Refresh” clears
  it); the link of an open PR or MR is short and clickable (`owner/repo#12`, `group/project!1`); a
  greyed-out “Open a PR” looks greyed out, with its reason below; on a repository without a
  remote, no more “Open a PR” button.
- First launch: a short welcome takes you to a first reply — pick an agent among those found on
  this Mac (or learn how to install one), connect it, choose a folder (or create a trial one),
  then check that it replies with a very short message, its cost shown and kept in “My
  activity”. Each step says clearly
  what is wrong (missing agent, expired sign-in, network, crash); you can skip the welcome at any
  time, and it never comes back once done.
- When your agent (IBM Bob, OpenCode) is newer than the versions tried with Bobine, a quiet
  notice says so once in the conversation, with a link to Diagnostics; an older version gives a
  warning, once as well. Nothing is blocked. An agent that speaks an ACP protocol version Bobine
  doesn’t know doesn’t start, and the app says what to update.

### Fixes

- Security: “Allow this command?” now shows the whole command, exactly as the agent will run it,
  with its folder and “Copy”, its invisible characters made visible; a long command scrolls inside the card, and hovering the tool row
  shows the whole command. Before, with IBM Bob, the card stayed empty and the end of the command
  was hidden.
- Proposed commit message: it only mentions the checked files and follows the boxes you check or
  uncheck until you edit it; the cursor is at the end; a conversation title that is too long gives
  way to a summary of the files (“update app.js”) rather than a cut subject.
- More accurate labels: a Bobine tool called by OpenCode says what it does (“Proposes to remember:
  …”, “Reads 2 memories”) instead of “execute”; an agent’s permission options (“Allow once”,
  “Reject”…) are shown in Bobine’s language; the agent has the same name everywhere, the one in
  Settings › Agents (“IBM Bob”, no longer “Bob” here and “IBM Bob” there); in Settings › Data, a
  recent folder with a long path keeps its full name, the start of the path is cut in the middle.
- Reading the IBM Bob budget: a single working folder per Mac, owned by Bobine (in
  `~/Library/Caches/Bobine`), instead of one per profile; otherwise each temporary profile added
  one more folder to those Bob remembers as trusted. When Bob isn’t signed in, the reading gives up
  after 20 s instead of 60, then isn’t retried at launch for 12 hours, and never with fresh agents
  (`--agents-neufs`).
- A very large diff from the agent (a rewritten `package-lock.json`, thousands of lines) no longer
  freezes Bobine: the conversation opens right away, and the diff is only computed when you unfold
  its card. Beyond a certain number of changes, it shows the old text then the new one, in full.
- Long conversations open much faster: the end shows first, older messages appear as you scroll
  up. Find in conversation, the outline and “Scroll to bottom” still see the whole conversation.
- A reply writing a long code block no longer stutters while it appears.
- Very large diffs and very long command outputs, once unfolded: Bobine shows the start of the diff
  (the old version then the new one when the file changed too much) or the end of the output, with
  “Show all” and, for an output, “Copy all”; beyond 50,000 lines, “Open in editor”. Line counts
  read “20,000”.
- When the agent hasn’t sent anything for 5 minutes during a reply, a banner says so without
  cutting anything off: “Wait” or “Stop”. A message, an agent action or changes that can’t be
  displayed are replaced by a line saying so; the rest of the conversation, the panel and the
  settings stay usable (“Try Again” for a panel or a page). An internal problem in Bobine is shown
  at the top of the window instead of going unnoticed. After an unexpected quit, Bobine says so at
  the next launch and saves a report on the Mac, sending nothing. If the interface stops three
  times in a minute, Bobine offers to restart on the home screen instead of staying on a blank
  window.
- Quitting Bobine stops everything it started, even an agent that no longer responds, a build or a
  simulator video stream, and the commands the agent put in the background with it (a process the agent detaches itself, such as a server, keeps running). An agent that crashes no longer leaves behind the command it had started. An agent whose connection drops is stopped with a clear explanation. If
  git isn’t installed, Bobine says so and gives the command to copy. Coloured notices in the
  conversation are easier to read.


- A profile opened by an older version of Bobine no longer loses the settings it doesn’t know. A
  profile written by a newer version opens read-only: conversations can be read, nothing is saved
  or sent, and Bobine offers to update.
- Unreadable conversation list: it’s rebuilt from the conversations on disk instead of starting
  empty.
- Unreadable settings or permissions: set aside and reported, instead of being silently replaced.
- Disk full: Bobine says so plainly, no longer leaves temporary files that took back the freed
  space, and saves as soon as space comes back. When quitting, it warns instead of losing the
  latest messages (or says so at the next launch after the Mac shut down).

## 0.9.1 — November 7, 2026

### Fixes

- Narrow window with the panel open: the panel tabs switch to icons instead of being cut at the
  edge, the open tab keeps its ✕, and those that no longer fit go into the “+” menu (“+ 3”), under
  “Open tabs”; in the input bar, the agent picker shows its full name or its
  icon, never a lone chevron or a truncated name.
- “Reset Bobine” works in the installed app: it used to close and open another Bobine without
  moving anything to the Trash. If the data cannot go to the Trash, nothing is deleted and Bobine
  says so at the next launch. Closing a Bobine on a temporary profile no longer opens another
  Bobine. A Bobine opened on another data folder (`--user-data-dir`) reopens on that folder after
  a reset, no longer on the usual profile.
- A conversation thread saved in a format Bobine does not recognise (for example written by a
  newer version) is set aside, like a damaged file, instead of being replaced by an empty thread.
- Pull request tracking: a commit made by the agent or in a terminal is seen as soon as the turn ends, when you come back to the window or on “Refresh” (“Push to the PR” shows up). After `gh auth login`, the card appears right away. Right after a push, the card follows the CI closely: “Checks pending” until GitHub reports them, then “running”. When ticked, “Merge when everything is green” says what it is waiting for (checks, conflict, review, draft, branch rules on GitHub). With no CI detected, the card says so and offers “Merge now”. The “sent to the agent” note clears once the checks change, and the log excerpt sent to the agent has no colour codes any more. After a merged PR, “Clean up” also deletes the branch on GitHub (not if it got commits since).
- After “Clean up” on a worktree, the conversation shown and the next ones start from the original repository, no longer from the deleted folder. More generally, a new conversation never starts in a folder that no longer exists: it starts from the repository or the last known folder, and says so. “New worktree” from a missing folder says so right away.
- “Commit” also works when a file was deleted with `git rm` (the deletion was already staged): git used to refuse the commit. After “Merge now” on a PR without CI, the note says “no CI detected” instead of “everything was green”.
- Right panel tabs: a tab shows its full name or its icon alone (name in the tooltip), never part
  of a word; the active tab’s ✕ is no longer clipped.
- Changes: “Conversation · Git” stays on one line, the branch name shortens instead; the chosen
  “Git” view comes back after the window was narrowed and widened again.
- The Scheduled tasks page no longer shows the last conversation’s panel; on its cards,
  frequency, agent and folder form a single line.
- Settings › Appearance: theme thumbnails wrap in a narrow or zoomed window instead of spilling
  out of the card.
- Settings: the hovered section no longer looks like the open one.
- My activity: with no exchange in the period, cost and tokens show “—” instead of “not reported”.
- A tooltip no longer stays visible after a click: the “More tools” one covered the browser’s
  address field.

- Settings: the notes under a setting (macOS language, the `bobine` command…) now belong to their
  row, with no divider stuck above them, on a background in the theme’s tint; warnings keep their
  warning tint, and the Quick Entry warning shows under Quick Entry (no longer under
  “Editor”).
- An agent’s sign-in expiring mid-conversation (OpenCode: `opencode auth login`): instead of a raw
  error and an agent shown as “Ready”, the thread says the sign-in expired, the agent shows “Sign-in
  expired” and a card gives the command to run in Bobine’s terminal. “Try again” then resends the
  refused message, once, in the same conversation; if the agent had already started tools, the card
  says so.
- Model menu: search also finds a model by its id (`gpt-6.1-sol`), not just by its name.

### Improved

- The right panel slides in, cards waiting for an answer (permission, question, aside, worktree
  setup) arrive smoothly, thread blocks expand without a jump and the send button responds to the
  click. Nothing moves when macOS asks to reduce motion.
- Under the last answer, a summary line: “Done in 42 s · 2 files +6 −1 · ≈ $0.12”.
- The “Scroll to bottom” button says how many blocks arrived while you were reading further up.
- “Copy”: the same feedback everywhere, a green check and “Copied”.
- Tooltips of buttons that have a shortcut show it (“Show panel ⌘J”).
- Polished empty screens: My activity before the first exchange, Scheduled tasks with no task,
  settings search with no result.
- A new conversation opens with its input bar in place, without a shift.

## 0.9.0 — November 6, 2026

### New

- After “Open a PR”, the worktree’s Git view follows the pull request: CI checks (running,
  passed, failed, each with its link), comments, review decision and conflicts with the base; a
  “Pull request” line in the “Session” tab. “Fix failed checks” sends the agent the failed checks
  and an excerpt of their log. Two boxes, unchecked by default: “Fix automatically” and “Merge
  when everything is green” (with the method the repository allows: merge commit, squash or
  rebase). Once a PR is open, “Open a PR” becomes “Push to the PR”. It needs the `gh` command signed in to GitHub; without it, nothing
  changes.
- Scheduled tasks: a “Scheduled tasks” page (sidebar, under “My activity”) saves an instruction, a
  folder, an agent and a frequency (once, every day, weekdays, every N hours). When it is due,
  Bobine opens a new conversation (in a new worktree if you like) and sends the instruction; it
  carries a small clock in the sidebar. Each task shows its cost per run (and per day when it runs
  several times a day) and can have its own cap; a run never starts while the previous one is still
  going, and missed runs (Mac asleep, Bobine closed) are not replayed: at most one catch-up. Tasks
  only run while Bobine is open, and a permission request always waits for your answer.
- “Request review…” in the Changes tab (and on each child of the “Children” view): another agent —
  the conversation’s own by default, to confirm or change, with its cost shown — reviews the work
  without modifying anything, errors first, then what can be simpler. Its findings land on the
  lines of the diff, with their severity; you remove the ones you don’t need and send the others
  to the reviewed conversation, like your own comments. Bobine checks that the folder did not
  change during the review.
- A new worktree (a conversation “in a worktree” or a child conversation) can be ready to use:
  the git-ignored files listed in `.worktreeinclude` (such as `.env`) are copied from the
  original folder, and the `setup` command of `.bobine/worktree.json` (such as `pnpm install`)
  runs in it, with its state and output in the thread; its `archive` command runs before the
  worktree is removed. The card shows both commands (“On creation”, “On removal”) and Bobine asks
  for your approval once per repository (“Allow and run”), and again if a command changes, even
  between when it is shown and your click. A message sent during the setup is shown on the card
  and goes out when it ends; “Stop” and “Continue without waiting” while the command runs,
  “Continue without setup” before approval. A scheduled task does not wait for approval: it runs
  without the setup, and its history says so. The list of copied files can be expanded.
  Approvals can be revoked in Settings › Privacy.
- A conversation can see several folders: in the “Session” tab, “Add a folder…” gives the agent
  another folder besides the working folder (a library, an app’s server…), and the cross removes
  it. Offered only with an agent that supports it (OpenCode, not IBM Bob for now); its session
  restarts right away with the new list, without losing the thread, and the next message tells
  the agent which extra folders it has.
- Aside: `/btw` followed by a question (or ⇧⌘A, Conversation › Aside…) asks a side question, even
  while the agent is working or before the first message. The same agent answers it in a separate, read-only session, in a card
  above the message box: nothing is added to the conversation or to what the agent keeps from it.
  By default the aside gets nothing from the conversation; a checkbox includes the recent exchange,
  with its estimated cost in tokens. Its cost counts in the conversation’s cost, and “Add to
  conversation” copies the question and answer into the message box, without sending them.

### Improved

- Bobine talks to agents with the latest version of the ACP protocol (SDK 2.4), with no change to
  what you see with IBM Bob and OpenCode.

## 0.8.0 — November 6, 2026

Available for macOS (Apple Silicon). The Linux preview will be released later.

### New

- A “Session” tab at the front of the right panel sums up the conversation at a glance: agent,
  model, mode, folder and branch (model and mode change in one click); the room taken in the
  context, by category (messages, Bobine tools, other MCP servers, agent, free), as an estimate
  and without any cost; the repository’s changes; what is running (terminals, dev servers,
  background subagents, child conversations) with its duration and a Stop button. The panel opens
  on this tab by itself when the window has room, and stays closed in a conversation where you
  closed it.
- Token counts use the short format from 1,000 on (“1.2k”, “122.9k”, “1.2M”), in the usage chip,
  My activity and the “Session” tab.
- Compatible with IBM Bob 2.0.9: when Bob asks you to accept its license on your first message, the
  form appears in the conversation; if you decline it, Bobine explains what to do instead of showing
  the raw error. A new conversation set to Plan mode starts straight in that mode with Bob.
- A conversation’s cost now counts all its sessions: after a lost session (IBM Bob deletes its
  tasks after 30 days) or a switch to another agent, the composer meter and the cost cap no longer
  forget what was spent before; the details show “This session” and, in another currency, what the
  other agent cost.
- New Fjord theme in Settings › Appearance: calm blue-grays, in light (“Fjord”) and dark
  (“Fjord Night”), with the same six accent colors.
- One color to act: the main action button (Allow, Merge, Save…) now takes the accent color
  everywhere, secondary actions keep an outline, and Deny or Cancel are plain text. During a reply,
  the Stop button is a quiet square instead of a white one in dark mode; Send stays gray while
  there is nothing to send. Rounded corners follow one scale across the app.
- Child conversation reports are lighter in the parent’s thread: collapsed to two lines (title and
  cost, then the first sentence), they expand to show the reply, branch, changed files and number of
  exchanges. “no files changed” becomes “no changes”, and a short excerpt no longer fades out (no
  more empty band).

### Fixes

- Electron 45.2.3 (Chromium 156.0.8078.80): Chromium security fixes.
- Message box in a narrow conversation: the placeholder and the typed text are no longer cut in half when they wrap onto an extra line.
- The conversation no longer scrolls sideways: a very long link, path or word wraps, and only code, diffs, tables and terminals scroll within their own frame; in a long conversation the outline stays short (one mark for several messages) and its list opens on the message you are reading.
- Shrinking the window with the right panel open: the panel narrows to leave 500 px to the conversation, folds away if it no longer fits and comes back when the window widens; the conversation is no longer squeezed.

## 0.7.0 — October 30, 2026

Available for macOS (Apple Silicon). The Linux preview will be released later.

### New

- In a parent conversation, the Changes tab has a “Children” view: the worktrees of its child
  conversations, with their state, branch, what they changed and the parent’s verdict; one click
  opens them in Finder, in your editor or in their conversation.
- Right-click opens a menu kept to the essentials: in the composer, spelling corrections then Cut,
  Copy, Paste and Select All; on selected text, a link or an image, Copy.
- A link to an address on your Mac (`http://localhost:3000`…) opens in the panel’s built-in
  browser (⌥-click: in the Mac’s browser); other web links open in the Mac’s browser.
- Compact density (Settings › Appearance): less space between messages, in tool cards and between
  sidebar rows.
- Presentation mode, for a demo or screen sharing (View menu or Settings › Appearance): larger
  conversation text, home folder shown as `~`, costs and quota hidden, banners and sounds off. A
  pill reminds you it is on; it is not kept for the next launch.
- The folder under the input box now has a real menu: “Show in Finder” (“Show in file manager” on
  Linux), “Copy path” and “Open a terminal here”, which opens Bobine’s terminal in that folder.
- The `bobine` command: in a terminal, `bobine .` opens a new conversation in the current folder,
  and `bobine . "first message"` also puts that message in the input box (it is never sent on its
  own). Settings › General › “bobine command” installs and uninstalls it.
- Long pasted text (more than 40 lines or 4,000 characters) becomes a “Pasted text · N lines”
  attachment: click it to read it, and “Put back in the message” to return it to your message.
- Drafts keep their attachments when you switch conversations, and after a restart (files,
  pasted text, and images as long as they stay small).
- Bobine respects the agent’s ignore files (for IBM Bob: `.bobignore`, `.gitignore` and `.env`):
  `@` mentions no longer offer these files, `@git-changes` skips them and says so, and attaching
  one asks for confirmation.
- The conversation thread shows how long each turn took under the agent’s reply (“2m 14s”), and
  your sent messages can be copied like replies.
- Clicking an image in a message or a tool screenshot shows it larger (Esc closes); you can drag it
  straight to the Finder.
- “Open in VS Code” (or Cursor, Zed, IntelliJ IDEA and JetBrains IDEs) on a file in a tool card, a
  diff or a link opens it at the right line. Pick the editor in Settings › General, among those
  installed on your Mac.
- Reopening a conversation left for more than a day shows a “Where were we?” card: your last
  request, tasks done and in progress, and files changed but not committed. Bobine builds it on
  its own: nothing is sent to the agent.
- While the agent works: a command that has printed nothing for a few minutes is flagged on its
  card (“No output for 3 min”), with “Interrupt”; the delay is set in Settings › Conversations.
  When the context is almost full, “Compact” appears next to the orange usage chip. And a cost cap
  for new conversations (Settings › Conversations, off by default; changeable in each
  conversation’s usage details) stops the response once the current tool finishes after the cap
  is passed, then asks “Continue” or “Stop”; past it, a new message waits for your approval. In
  bobcoins for Bob, in dollars otherwise, in tokens for an agent that doesn’t report its cost.
- The parent conversation leads its child conversations like a tech lead: it can suggest each
  child’s agent, and its model when the agent allows it (OpenCode; never with Bob), with its
  reason: the suggestion waits for your confirmation on the “Proposed tasks” card, where you keep
  it or change it. It reads a short report at the end of each turn, checks the work itself, sends
  fixes back to the child, then says whether the branch is ready to merge: “Recommended” or “Not
  ready yet” on the child’s row. You always do the merging: “Merge” first takes only the
  recommended children, the others after a confirmation.

### Fixes

- Building the DMG no longer downloads an additional helper: it uses the tools included with
  macOS. The simpler installation window keeps drag-and-drop to Applications and Bobine’s
  built-in installation option.
- Clicking a conversation in the history right after “New conversation” no longer shows a
  “unknown conversation” error.
- Panel tabs stay where they are: a new tab is added on the right instead of slipping in and
  shifting the others.

## 0.6.0 — October 27, 2026

Available for macOS (Apple Silicon). The Linux preview will be released later.

### New

- Instructions sent to child conversations can be read in the parent thread: expand a launch or
  “Instruction for…” to see the full text, including follow-up corrections. They stay collapsed
  by default and are saved in history.
- The sidebar keeps conversations in place: child conversations stay under their parent, with
  the same rounded links, and states use icons with tooltips. The “Waiting on you” section is
  removed; notifications and the Dock count remain available. A new child appears while its
  worktree is being prepared, even when its folder was collapsed. The “Subtasks” card aligns its
  state icons and buttons; forks use an icon instead of the “branch” label.
  Hovering over a conversation shows a single tooltip, also available from the keyboard.
- Settings › Data › “Start fresh”: “Try Bobine as new” opens a second Bobine on an empty profile,
  erased when it closes (and, if you like, agents as on a new Mac, which ask again for their
  sign-in); “Reset Bobine” moves everything it keeps on this Mac to a dated folder in the Trash,
  with a README, then restarts it like the first launch — or uninstalls it. Your projects and your
  agents are never touched.
- A hovered red button (Reset, Delete…) stays red and readable.
- My activity compares what can be compared: the chart gains “Time” (working time per agent), and
  exchanges and working time lead the figures. A measure an agent doesn’t report says so (“Tokens:
  OpenCode only. IBM Bob does not report its tokens.”), as does the “Tokens processed · OpenCode”
  figure. Filtered on one agent, the page only shows that agent’s accounts (“IBM Bob on this Mac”
  only for Bob).
- Annotating a browser page no longer freezes it: in Annotate mode, the page scrolls and zooms as
  usual (wheel, trackpad, pinch, ⌘+) and a click places the comment without reaching the page. The
  element you point at is outlined; pins and their bubbles stay attached to their element and keep
  their size when the page is zoomed. You can annotate several screens: the agent gets one
  screenshot per annotated screen, and the message says which comment is on which.
  “Send to the agent” groups the comments into one message, with the screenshots and targeted
  elements. Esc exits Annotate mode; comments stay until you send them.
- While the agent prepares a tool without saying what on yet (OpenCode writes a patch for nearly
  40 s), the card and the activity indicator say “Preparing an edit…” (or a command, a read, a
  search) instead of the raw word “patch”; the agent’s title stays in the tooltip. Such a tool,
  interrupted or failed, keeps the name of its kind: “Edit · interrupted”.
- The activity indicator’s time is that of the current step (the tool, text or thinking of the
  moment) and starts over at every step; the turn’s duration is in its tooltip (“Turn started
  2 min 10 ago”).
- Usage is now kept: every exchange with an agent is recorded on this Mac (agent, model, project,
  tokens, cost with its unit, duration), even if the conversation is later deleted or continued with
  another agent.
- “My activity” (in the sidebar, under “New conversation”, or ⇧⌘U) shows all usage, across
  conversations, in place of the conversation: an activity grid over the last 12 months (or a past
  year), like GitHub’s, then the week, month or year, or the day clicked in the grid; the agent;
  exchanges, tokens processed, working time and cost in each unit (dollars and Bobcoins are never
  added up), with the change from the previous period; a chart per hour, day or month, by agent or
  by model; tables by model, by project and of the conversations that used the most (click one to
  open it). “All my activity…”, in a conversation’s usage details, leads there. Earlier exchanges
  are imported once from the history. “Export…” saves a CSV (one row per exchange or per day, or
  the entire history). IBM Bob’s monthly quota and spend on this Mac are now there. The page stays
  readable in a narrow window, side panel open included.
- “Reset…” the recorded usage is in Settings › Data.
- “Search” becomes a magnifying glass at the top of the sidebar (⌘K is unchanged).
- In charts, IBM Bob is blue and OpenCode teal; Bob’s unit is written “Bobcoins”.
- Settings › Diagnostics warns when an agent reports a version Bobine has not checked (for
  example IBM Bob 2.0.7, checked with 2.0.6): its specific features may not work. Each agent’s page
  in Settings › Agents lists the checked versions.
- Settings › Agents › “Add an ACP agent…”: any agent that speaks ACP can be declared without
  touching code (name, command with its arguments, environment variables, and if needed its API key
  variable, entered afterwards on its page and encrypted in the Keychain). It gets its page like the
  others, with “Edit…” and “Remove this agent”.
- An agent that can’t resume a conversation (or lost its session) no longer leaves it read-only
  after a restart or a crash: the conversation continues in a new session, marked “New session
  with …” in the thread, and the earlier exchange is passed on with your next message.
- The sidebar is organized into Pinned, Recent (or Folders) and Archived, always last and
  collapsed by default. Each section and folder collapses with a click, and Bobine remembers it.
  The new-conversation and search buttons stay available at the top. In Folders mode, the folder
  is the project: child conversations started in a worktree stay under their parent. A fork
  (“Branch from this message”) names its original conversation in its header and tooltip and is
  listed as an independent conversation. Hovering looks different from the open conversation.
- The built-in browser behaves like Claude Code’s: the page scrolls with the mouse wheel, the
  trackpad and the keyboard, and reflows when you widen the column or maximize the panel. ⌘+, ⌘−
  and ⌘0 zoom the page when it has focus (a “110%” chip in the address resets it to 100% in one
  click), without shifting the view even when the interface is zoomed; ⌘L, ⌘R, ⌘[ and ⌘] work in
  the page. A screen size set by the agent (mobile…) is scaled down to fit whole in the panel,
  shows in the address (one click cancels it) and is reset at the end of its turn.
- A new side panel tool, “ACP messages” (“+” menu), shows the messages exchanged between Bobine
  and the agent live, both ways: time to the millisecond, method, detail, response time and size.
  A click unfolds the raw JSON; text chunks of the same message are grouped; filter, pause and copy
  as NDJSON. Keys and tokens are masked, and the last 2,000 messages of the conversation stay in
  memory only, whatever the log level.
- Settings › Diagnostics opens on a “Log” card: `main.log` and `agents.log` with their size and
  what they contain, “Open” and “Show in Finder”, then the log level. The logs folder path is no
  longer written in the “Bobine” section.
- Settings are arranged in three groups of four tabs: General, Appearance, Notifications,
  Shortcuts; Conversations, Agents, MCP servers, Commands; Privacy, Data, Diagnostics, What’s new.
  Each page shows its settings in cards under a title; what you rarely need is folded into
  “Advanced”. Search still finds every setting and unfolds it.
  What’s new shows Bobine (icon, version), then one line per version, the latest one open.
- New Appearance page, with a preview that changes as you adjust: the theme in one click among five
  (System, which follows the Mac in Light and Dark, Light, Sepia, Dark, Black), six accent colors,
  response font from those installed on the Mac, code font and
  size, terminal font and size, each picked from the installed monospaced fonts.
- Each agent has its own page in Settings › Agents: status, version, command, “Restart”, its API
  keys, its model providers, what it reports and what is specific to it. The corporate network
  moves to “Advanced”, with a summary of what is set.
- When the connection drops during a reply (network down, proxy, rate limit reached), Bobine tries
  again on its own: a banner in the thread says “Connection lost” and “Trying again in 8 s (3 of
  5)”, your message stays waiting and goes again without resending it. Five attempts, further and
  further apart (2 s to 32 s), and at once when the network comes back or the Mac wakes up; “Try
  again now” doesn’t wait, Escape or Stop ends it. After the fifth, “Can’t connect” and “Try
  again”. A message written while waiting goes right after.
- Electron 45 (Chromium 156, Node 24.22): Chromium security fixes. API keys go through Electron’s
  non-blocking access to the macOS keychain; keys already saved stay readable.

### Fixes

- Merge progress stays visible while a child conversation resolves a conflict.
- When the agent’s connection drops mid-turn, the tool it had just announced no longer stays
  “in progress” next to the error notice: it is interrupted, and stays so when reopened. A turn cut
  short by the agent stopping now counts in the conversation’s usage.
- An agent that does not stop when asked is forcibly stopped after 3 s, and those left running by a
  Bobine crash are stopped at the next launch (the log says which). Commits, merges and a
  conversation’s git status no longer get in each other’s way (“index.lock”); a lock left by another
  program is retried once, then git’s error is shown in full.
- Colors follow the whole theme: code blocks, command output and the terminal take the colors
  of Light, Dark, Sepia or Black (no more always-dark code), the terminal changes colors with the
  theme and the accent without reopening the tab, and the window opens straight on the chosen
  theme’s background. Sepia and Black have their own accents.
- More readable text: muted text, accent links, text on the accent and the terminal’s colors
  (yellow on a light background) all reach the recommended contrast (AA).
- A command’s output that is JSON is shown indented, with real line breaks inside strings.
- The proposed commit message takes the conversation title cut at a whole word, never ending on a
  dangling “to a”, with “…”.
- Settings: no more duplicates. “Reload PATH” now lives only in Diagnostics (a link leads there
  from Agents when an agent is missing), and About no longer repeats the version, Electron and the
  system, already in the “About” window and in Diagnostics. Help texts fit in one sentence, the
  texts about notifications and the Dock counter no longer contradict each other, and “Same as
  now” is no longer cut off in the new-conversation list.

### Known limitations

- Automatically forwarding feedback to a child conversation depends on the agent and is not
  guaranteed; instructions actually sent can be read in the parent thread.

## 0.5.0 — October 23, 2026

### New

- Finished child conversations can all be merged at once from the parent’s Subtasks card: a
  sentence says which ones are ready, which are still working, which touch the same files and which
  have uncommitted changes; “Merge the N into main” merges them one after the other, in launch
  order, with each row’s state live and “Stop”. At the first conflict, that child conversation
  resolves it, then the merge resumes. “Then clean up” archives the merged child conversations and
  deletes their worktrees and branches.
- When the main folder has uncommitted changes, merging (from the Subtasks card or a worktree’s Git
  view) does not start and says why, listing the files, with “Commit first” (proposed message, then
  the merge starts) and “Set aside” (the changes are put away for the duration of the merge, then
  put back, and the thread says so). Git errors are shown in full, no longer just “Aborting”.
- “Commit” is also available in the Git view of an ordinary conversation, outside a worktree:
  checked files, editable proposed message, “Undo” while it is the last commit and not pushed.
- The agent’s subagents have their own “Subagents” card in the thread, set apart from tools: those
  started together share the card, one row each (state, type, instructions, live duration and
  cost), with how many are running and done and their total cost; “Response” unfolds the
  instructions, the response and their work.
- Each child conversation shows what it costs: a badge on its “Subtasks” row (bobcoins, dollars, or
  its tokens), the children’s total in the card header, and on its report the cost and number of
  exchanges at that point.
- A worktree conversation’s start fits in one card at the top of the thread: starting branch and
  commit, date, commit subject, and a warning when the original folder still has uncommitted
  changes; “Git view” opens the Changes tab. A child conversation’s header says which conversation
  it comes from (“↳ from “…””) and takes you back there in one click.
- The top of the thread no longer slides under the header fade: the first message stays readable
  when the thread scrolls.
- Bobine › “About Bobine” opens a clean window: the version and its date, “What’s new” (Settings
  › About), “Report an issue” (prefilled GitHub issue), links to GitHub and the license, and
  “Copy technical info” (version, commit, Electron, macOS, installed agents) to paste into a bug
  report.
- The agent proposes child conversations on its own when your message holds several independent
  tasks: from the start of the session, it knows it can hand them to child conversations, each in
  its own worktree, and that nothing starts without your approval on the “Proposed tasks” card.
  Settings › Conversation › “Propose child conversations”: Never, When it fits (default) or
  Always ask. The `/split` command explicitly asks for this split for the message that follows
  it.
- A “Waiting on you” section at the top of the sidebar gathers the conversations that need you:
  permission or question (first), error, unread response or child conversation report, with the
  reason and how long ago. The same number shows on the Dock icon (Settings › General › “Count on
  the Dock icon”). Several conversations that finish or wait at the same time (child conversations
  started together) now make a single notification, sound and bounce.
- The sidebar follows a single grid: every title starts at the same place, with or without an
  icon. In “Waiting on you”, a bold title marks what is unread, the icon says why (in color when the
  agent is blocked, grey when there is something to read, red for an error), the time sits to the
  right of the title and the count reads “Waiting on you · 2”. A branch carries a “branch” tag
  that stays visible when its title is cut, and its full title as a tooltip.

### Fixes

- The agent’s tool titles no longer show absolute paths or “cd /path/to/project && …”:
  “Permission: Edit src/books.js” instead of “Applying diff to /Users/…”, and “Update the task
  list (8)” (the list as a tooltip) instead of “Updating todo list”, in cards, “Waiting on you” and
  notifications.
- The text Bobine attaches to your message (app context, `/split` request, exchange carried over
  from a branch or another agent) is now sent after it: it no longer becomes the task title in
  IBM Bob, no longer shows in the “New branch of …” card, and no longer replaces a conversation’s
  title after “Continue with…” or a branch.

### Fixes

- After the agent crashes, the message that restarts it no longer mixes the history replayed by the
  agent into its new response: the thread stays as it was before the crash (bubbles, plan cards,
  change counters), followed by the new exchange, as after quitting and reopening Bobine. The
  message is sent once that history has arrived, at most 2 seconds later.
- A refused tool no longer gets a green check: “refused” is a state of its own for a thread card
  (and for a tool group, or a subagent), whether the refusal comes from an agent permission or a
  Bobine command (terminal, server, build). A Bobine tool that errors is “failed”, even when the
  agent says it finished.
- Android: a Flutter build that succeeds is no longer reported as “Build failed”; the APK is also
  looked for where Flutter writes it (`build/app/outputs/flutter-apk`), and if it is nowhere, the
  build stays successful and the agent learns where it was looked for. An install error
  (`adb install`) comes through in full, with its reason, and the “Launches …” card names the APK
  even when its path is long.
- With OpenCode, a Bobine tool called from code (`execute`) that fails marks the card failed,
  instead of a green check.
- A subagent that OpenCode starts in the background is no longer shown as “done, < 1 s”: its row in
  the “Subagents” card stays running, even after the response ends, until it has really finished;
  it then shows its duration and final answer. “See its work” shows the current state while it is
  still working.
- Screenshot without macOS’s Screen Recording permission: instead of letting you select an area
  and then attaching nothing, the quick entry window and the message box say the screenshot is
  unavailable and why, with an “Open System Settings” button. A screenshot that macOS refuses after
  the selection says so too; Esc stays silent.
- Plan card: “Send my comments” and “Run the plan” stay on the right, in the same place, when the
  hint changes (“1 comment”): “Run the plan” no longer ends up under the pointer after “Add
  comment”.
- “Proposed tasks” card: when the agent adds proposals during its turn, they arrive below and the
  thread no longer scrolls while the pointer is on the card: the row you are about to start no
  longer moves under the pointer.

### Fixes

- `/context` and `/cost` each give a titled box (“Conversation context”, “Conversation cost”); when
  the agent doesn’t report how full its context is (IBM Bob), `/context` says so. IBM Bob’s
  `/compress` is in the “/” list, and its reply shows as a “Conversation summarized” card, with the
  summary formatted.
- A tool stopped with Esc or ■ is marked “interrupted”, no longer “failed”.
- Commands the agent runs in the terminal run without a pager: `git log` no longer waits on
  “(END)”. They open in a tab of the agent’s own; your tabs keep your pager.
- `@` mentions first suggest files whose name or folder starts with what you type: `@books` no longer
  suggests Xcode files that merely contain those letters in order.
- A tooltip closes when the hovered element scrolls away or disappears (tab switch, thread scrolled
  with the wheel).
- Deleting a provider, an MCP server, a command or an API key, revoking an approval or cleaning up an
  orphan worktree is confirmed in the row, right under what you clicked (“Delete · Keep”): no more
  second click on a trash icon that looked unchanged.
- Removing the last MCP server (or provider) from a file no longer leaves an empty `opencode.json`:
  the file is deleted when nothing else is in it.
- The suggested commit message no longer cuts a word: conversation titles end on a whole word.
- French text: “d’OpenCode”, “d’IBM Bob”; non-breaking spaces before colons and inside quotes; a
  single Full Screen item in the View menu, which turns into Exit Full Screen in full screen; singular
  agreement in “Restore 1 file”.
- Settings › MCP servers › Bobine: tool family switches work with the keyboard and accessibility
  tools; Questions says “Always on” instead of showing a dimmed switch. Settings search
  also finds what Bobine does with each agent (“quota” leads to IBM Bob).
- A subagent that OpenCode runs in the background finishes in its card (duration, final answer)
  even if you sent other messages in the meantime; it used to stay “running” forever.
- Sending a message while the thread is scrolled up brings it back to the bottom: the sent bubble
  and the reply are in view, so the message no longer looks lost. The ↓ arrow still takes you down
  while reading.
- Plan card: when the note form folds, the “Send my comments · Run the plan” bar no longer moves up
  under the pointer; the space is kept until the pointer leaves the card.

### Known limitations

- In the thread, an `http://localhost…` link written by the agent does not open in the built-in
  browser yet; a page’s `prompt()` is not supported there; "Open a PR" does nothing when the
  repository has no remote.
- The report of a child conversation run by Bob does not show its cost; the badge on the
  "Subtasks" card does.
- After switching the language, the answer line of a question already asked keeps the previous
  language.
- Corporate proxy: only the upper-case `HTTPS_PROXY`, `HTTP_PROXY` and `NO_PROXY` variables are
  taken from the login shell.

## 0.4.0 — October 22, 2026

### New

- A worktree conversation comes back into `main` without a terminal. When it is created, the
  thread says which branch and commit it starts from, and warns when the original folder has
  uncommitted changes (they are not in the worktree). In the Changes tab, “Git” view: “Commit”
  the checked files with a proposed message (editable, undoable while it is the last one), “Open a
  PR” when `gh` is installed and logged in (otherwise the reason is given), “Merge into main”
  listing conflicts file by file with “Let the agent resolve”, then “Clean up” (conversation
  archived, worktree and branch deleted). Settings › Agents and folders lists orphan worktrees
  with “Clean up”.
- The conversation’s cost (bobcoins, dollars or tokens depending on the agent) lives in one place:
  the usage chip under the input area, whose details give the total, the average per exchange
  and one line per exchange.
- The sidebar can be resized with the mouse (from 220 to 440 px, 300 by default); double-click
  its handle to bring it back to the default width. In a narrow window it gives the conversation
  the room it needs and takes it back afterwards.
- Settings › MCP servers › Bobine: the estimated weight of each tool family in the agent’s context,
  and a switch to stop offering it. The conversation’s ⚙ menu says when the change applies and
  offers to restart the agent.
- Continue a conversation with the other agent: in the agent menu, “Continue with” offers OpenCode
  (with its recently used models or those of your providers) from Bob, or the other way round.
  Before you confirm, Bobine says where your messages will go (agent, model, provider and
  address). The conversation stays the same: the thread is kept, a “Continued with …” line marks
  the switch, and the earlier exchange goes as text with your next message, not before.
- When the agent proposes child conversations, they come on a single “Proposed tasks” card: for
  each one, Start, Do it here (the agent handles it in the conversation) or Refuse, with the agent
  and model of your choice. The card keeps what you decided.
- A conversation put to sleep or reopened after a restart keeps its whole thread: Bobine tool
  cards, child conversation reports, notes, “Response interrupted”. If the session went on
  elsewhere in the meantime (`bob chat`, Bob IDE, `opencode`), the missing exchanges are added at
  the end, with a notice.
- Settings › Diagnostics: « Report an issue » opens a GitHub issue in the browser, prefilled with
  the version and the diagnostic report (cut when too long for the address: paste the rest from
  « Copy report »). Nothing is sent until you submit it on GitHub.
- Bobine is released under the Apache 2.0 license; the repository has a README in English and
  French, a contributing guide and a security policy.
- Agent tool cards say what the tool did and on what, even collapsed inside a group: “Read
  src/books.js”, “Edit README.md”, “Search “TODO””, “Page example.com/doc”, instead of the bare tool
  name (“read”, twenty times). Paths are relative to the conversation folder and shortened in the
  middle when long; the full path and the agent’s title stay on hover. A command keeps its text.
- Settings › Agents and folders › Model providers: OpenCode’s OpenAI-compatible endpoints (the
  company’s internal models) are declared in the app, without editing `opencode.json` by hand:
  name, address, models, "Only these providers". The key is encrypted in the macOS keychain, never
  written to the file. "Test" says whether the endpoint answers, how many models it lists, or why
  not (connection refused, proxy, unrecognised certificate, rejected key) and what to do; Settings ›
  Diagnostics has one line per provider.
- Settings › Agents and folders › Corporate network: proxy, no-proxy hosts and the company’s
  certificate file, taken from the login shell or set here, passed to every agent at launch.
- When a reply is done or an agent is waiting while the window is in the background, Bobine’s icon
  bounces in the Dock, even when macOS blocks notifications (Settings › General › Bounce the Dock
  icon).
- Settings › Conversation: choose how many conversations stay active (6 by default, from 2 to 12).
  Beyond that, the oldest ones are put to sleep and reloaded when you go back to them; each one
  keeps its agent in memory, about 300 MB.
- Settings › MCP servers opens on a “Bobine” tab: the tools Bobine gives every agent (questions,
  built-in browser, run the app, terminal, iOS Simulator, Android Emulator, child conversations),
  one card per family with its number of tools, when it is offered and when it asks for your
  approval; expanded, it lists the tools, with their description on hover. The conversation’s ⚙
  menu starts with “bobine · built-in” and the number of tools it actually receives, which leads to
  that tab.
- In Plan mode, the message box takes the mode’s color (border, glow, tinted background), the mode
  chip becomes a “Plan” pill, and a line reminds you that the agent reads and proposes without
  changing anything, and how to leave the mode.
- “Run in parallel…”, in a conversation’s menu, opens a child conversation. It works in its own
  worktree and appears under its parent with its state. At the end of each turn, the parent gets its
  report (“Subtasks” card), which goes to its agent with your next message.
- The agent can start child conversations itself for long, independent tasks: each one asks for
  your approval on a card (Start / Deny). It follows them and writes to them, and they can write
  back; these messages go through the queue, with where they come from (“From the parent
  conversation”). When all have finished, it is woken up once with their reports. The number of
  running child conversations is set in Settings › Conversation (5 by default); beyond that,
  “Run in parallel…” is greyed out.
- On first launch, Bobine asks for your project folder first: no agent starts before you choose
  it, and the app’s own “workspace” folder no longer shows up in recent folders.
- The folder and branch move below the message box. When space runs out, the bar folds step by
  step (screenshot in the 📎 menu, usage ring only, mode icon only) instead of truncating every
  chip; plan mode has its own icon.
- The model menu opens on the selected model, fits in the window and offers a search beyond 10
  models (OpenCode); the provider is dimmed on the right.
- The built-in browser now allows downloads: every file asks “Save As”, even when the agent
  clicks, and nothing is saved without your consent; a banner confirms, with “Show in Finder”.
- A branch now shows right under its original conversation, indented, with an arrow.
- The window reopens where you left it, at the same size, maximized or full screen if it was; if
  its display was unplugged, it comes back on the main display.
- Bob’s bobcoin quota shows under its name at the bottom of the sidebar: share used and a bar
  (orange at 80%, red at 95%); click it for usage, limit, what’s left and “Refresh”. Figures come
  from Bob’s server, across all your computers, read at startup.
- The model in use shows in the message box, next to the agent picker (OpenCode): click it to
  open the list of models.
- Zoom in the iOS and Android tabs: at the top of the tab, zoom out, fit to panel, actual size
  and zoom in, with the zoom level shown. When zoomed, the device scrolls and the wheel moves the
  view; drag on the screen to scroll the app.
- The message box asks “What do you want to do?” on the home screen, offers “Reply to …” (with the
  agent’s name) in a conversation, and “Add a follow-up…” while the agent responds.
- Comments on changes: in the Changes tab, the “+” that appears over a diff line adds a comment
  (Shift-click for a range); “Send to the agent” sends them all in one message quoting the file,
  lines and code. They are kept until sent.
- ⌘F finds text in the open conversation (Edit › Find…), ignoring case and accents: matches are
  highlighted, with a counter and ⌘G / ⇧⌘G to move between them. A conversation found by its
  content with ⌘K opens right on the searched words.

### Fixes

- Without a saved API key, Bobine no longer asks for your macOS Keychain password at launch. With a
  key, it’s only asked for when the agent that uses it starts, once per launch.
- A confirmation box from a page in the built-in browser no longer blocks the agent: its tools
  return, it knows the page is waiting for your answer, then what you answered.
- “Save As” says which conversation the download comes from. While this window or a page’s box is
  open, the conversation is marked “Waiting for your answer” in the list.
- Text typed after picking from a menu in the message box (mode, model…) is no longer lost: the
  cursor returns to the message box, and tooltips no longer block clicks.
- The home screen fits a narrow window.
- “Trust this folder” is now the main button of the “Folder not trusted” card.
- The Window menu follows the app language (Minimize, Zoom, Bring All to Front).
- A conversation branch (“Branch from this message”) keeps the page open in the browser.
- Maximized panel: “Attach this page to the message” now shows “Page attached to the message” in
  the panel header.
- Image annotation: long text wraps instead of running off the image; Shift+Return for a new line.
- The conversation list no longer moves under the mouse: it reorders once the pointer leaves it.
- The turn timer no longer picks up the previous turn’s duration.
- The annotated plan now shows in full: its notes no longer hide its end.
- After a restart, the Changes tab of an OpenCode conversation lists every changed file again,
  even files that have changed since.
- A conversation in a worktree works on a `bobine/…` branch (no longer `bob/…`).
- Settings › Agents and folders: “Same as current conversation” is no longer cut off.
- Error messages without technical prefixes: just the cause, without “Error invoking remote
  method…” or “Error:” in front (Simulator, Android, Browser, Changes and Preview tabs, Settings,
  resuming a session, installing).

### Security

- The HTML preview isolates each previewed folder (a page can no longer read the files of another
  folder opened in the same session) and no longer follows a symbolic link to a hidden file or
  folder (`.env`, `.git`…).

### Known limitations

- Corporate proxy: Bobine picks up the upper-case `HTTPS_PROXY`, `HTTP_PROXY` and `NO_PROXY`
  variables from the login shell; their lower-case equivalents are not read yet, and `localhost`
  is only excluded from the proxy automatically for the one set in Settings › Agents. A local
  proxy (PreProxy) declared in upper case is picked up.

## 0.3.0 — October 19, 2026

### New

- The interface is available in English: Settings › General › Language (System, Français,
  English). It changes right away, without restarting; you can write to agents in any language
  you like.
- The `.dmg` window is in French and English.
- Adjustable log (Settings › Diagnostics): Normal, Detailed (every exchange with the agents, in
  `agents.log`) or Trace (with excerpts, secrets masked, until the next launch), to understand an
  issue without a separate tool.
- Contact sheet: the agent can film the browser page, the iOS Simulator or the Android Emulator
  during a gesture (scroll, transition, animation) and see the whole sequence in a single image.
- OpenCode 2: a subagent’s work (its tools, its answer) shows live in its “Subagent” card instead
  of being mixed into the agent’s answer. Its questions show as a questionnaire, and deleting a
  session is offered.
- OpenCode 2: active rules and MCP servers follow its files (`AGENTS.md` up to the home folder, no
  more `CLAUDE.md`; servers in the `mcp.servers` format). OpenCode 1 is still supported.
- The agent’s task list stays just above the message box while it works, instead of scrolling
  away with the thread; one click collapses it to a single line. Completed tasks are checked and
  greyed out, no longer struck through.
- The Android tab shows the emulator inside a real phone or tablet, in your accent color
  (Settings › General), turned like the device in landscape. Drag to swipe, scroll with the wheel,
  long-press to hold a tap, and click the side buttons (power, volume). Its frame rate (frames per
  second) shows as on iOS.
- iOS and Android tabs: the controls (Home, Back, lock, attach the screen to the message) sit in
  a bar below the device.
- The side panel can be maximized over the conversation (⤢ button, double-click its edge, or
  View › Maximize Panel, ⇧⌘J) to see a page, a device or changes in full. It shows whether the
  agent is working or waiting for your answer; one click brings you back to the conversation.
- Its tabs show their names (“Browser”, “Changes 2”, “Tasks 3/5”) and only the tools used in the
  conversation; the others are in the “+” menu. A ✕ (or a middle-click) removes a tab without
  stopping the tool; it comes back when the agent uses it again.

### Fixes

- The “Scroll to bottom” arrow no longer shows on a conversation that fits on the page (for
  example after scrolling up a long thread and then opening another conversation).
- OpenCode 2: Bobine tools it calls from code (“execute”) show again what they do and their
  screenshots, instead of “execute”.
- The thread follows the end of the response again when an image arrives in a tool card
  (screenshot, contact sheet): the end is no longer hidden below the message box.
- Android Emulator in landscape: the screen is no longer squashed, and taps (yours and the
  agent’s) land in the right place.
- The iPhone in the iOS tab fits entirely in the panel again (it was cut off at the bottom).
- The “Session settings” menu opens in its final place right away: it no longer jumps to the
  other side of the message box when its rules arrive, and the click that opens it no longer
  sometimes picks one of its lines (a rule opened in preview without being asked).

## 0.2.0 — October 16, 2026

### New

- Bob Desktop is now called **Bobine**, with a new icon. History and settings from the former name
  carry over on first launch.
- The `.dmg` opens on an illustrated window. Double-click Bobine: it offers to install itself, for
  all users of the Mac or just for you (in the Applications folder of your home folder, no
  administrator rights needed).
- Quick Entry (⌥⌘B): write to the agent from any app, screenshot included.
- Attach the built-in browser’s page or a simulator’s screen to the message, and annotate an image
  before sending it.
- Mermaid diagrams drawn in the conversation.
- Preview of the project’s HTML pages in the built-in browser.
- Built-in browser: sign-in windows (Google…) open when you click yourself; “Clear browser data”
  and “Keep browser cookies” in Settings › General.
- “Always allow” a site, “Always in this project” for a command or a build: remembered, listed and
  revocable in Settings › Agents.
- Built-in diagnostics (Settings › Diagnostics, or Help › Diagnostics…).
- MCP servers: “Test” button and status dot in Settings.
- A sound when an agent is waiting for an action and the window is in the background.
- Installation without Internet access, with Electron and AXe obtained elsewhere.
- These release notes, in Settings › About.

### Security

- Bobine’s tools are allowed automatically only when the agent names them exactly.
- “Open” in the Changes tab no longer launches an executable file written by the agent: it is only
  shown in Finder.
- Electron 44.7.2 (Chromium security fixes).

### Fixes

- The agent’s responses use the app’s font, with plain headings and rules.
- Dialogs and menus no longer lose clicks under the title bar; the app stays clickable after a
  menu.
- An abandoned empty conversation no longer leaves a session in the agent.
- Settings: fixed header and a larger window.
- “/” menu: you can see which agents a command works with.
- App about 55 MB lighter.

## 0.1.1 — October 14, 2026

First published version (`.dmg` on GitHub), under the name Bob Desktop.

- Conversations with IBM Bob and OpenCode over the ACP protocol: live responses, thinking, tools,
  permissions, multiple-choice questions, session modes and options, usage.
- History: content search, pinning, grouping by folder, archives, resuming sessions started
  elsewhere, export as Markdown or JSON, backup.
- Edit a message and branch from there, with files restored; summary of changes, revertible file
  by file.
- Annotated plan: comments on passages, compared versions, running it.
- Parallel conversations in git worktrees, side by side.
- Panels driven by the agent: built-in browser, iOS Simulator, Android Emulator, terminal, dev
  servers, task list.
- Slash commands from the agent, the app, personal and project ones; `@` file mentions.
- Bob’s and OpenCode’s MCP servers managed from Settings; API keys encrypted in the Keychain.
- Notifications, themes (including Sepia and Black), fonts, keyboard shortcuts.
