# Panels

The side panel shows what the agent is doing, and lets you take over: the session, changes, the
built-in browser, the terminal, the iOS Simulator, the Android Emulator, the task list.

Here you can:

- [open, close and maximize the panel](#panneau);
- read the [Session tab](#session);
- review and comment on [changes](#modifications);
- use the [built-in browser](#navigateur), and [annotate a page](#annoter);
- use the [terminal](#terminal);
- see the [iOS Simulator](#simulateur-ios) and the [Android Emulator](#android);
- follow the [task list](#taches) and the [ACP messages](#echanges-acp).

<a id="panneau"></a>

## Open, close and maximize the panel

- ⌘J opens or closes the panel (View › Side Panel). It opens on its own on the Session tab when
  the window has room.
- Tabs only appear for the tools used in the conversation; the others are in the **+** menu
  (“Open a tool”). A new tab is added on the right.
- ✕ (or a middle click) closes a tab without stopping the tool; it comes back when the agent uses
  it again.
- **Maximize Panel** (⇧⌘J, or double-click its edge) gives it the conversation’s space. Its
  header then tells you whether the agent is responding or waiting for your answer; a click takes
  you back to the conversation.
- Drag its edge to change its width.

<a id="session"></a>

## The Session tab

The conversation at a glance:

- **Environment**: agent, model and mode (one click to change), folder,
  [other folders](plusieurs-dossiers.md), branch or worktree;
- **Context**: how much of the agent’s context is used, by category (Messages, Bobine tools,
  Other MCP servers, Agent, Free). It’s an estimate, at no cost;
- **Changes**: the changed files (a click opens the Git view);
- **Pull request**, when there is one: see [PR and CI tracking](suivi-pr-ci.md);
- **Running**: terminals, dev servers, subagents, child conversations, with how long they’ve been
  running and a button to stop them.

<a id="modifications"></a>

## Changes

The **Changes** tab (⇧⌘D) has two or three views:

- **Conversation**: what the agent changed in this conversation, file by file, with their diff.
  Each change can be reverted file by file.
- **Git**: the repository status, to [commit](worktrees.md#committer) and, in a worktree,
  [open a PR or merge](worktrees.md#vue-git);
- **Children**, in a parent conversation: see
  [Child conversations](conversations-filles.md#suivre).

**Comments on the diff.** Hover over a line of the diff and click **+** to add a comment
(⇧-click for a range of lines; ⌘↩ to add it). **Send to the agent** sends them all in one message
that quotes the file, the lines and the code. They’re kept until you send them.

The **Request review…** icon in the view bar starts a review by another agent: see
[Request review](faire-relire.md).

A file from a tool card, a diff or a link opens at the right line in your editor (VS Code,
Cursor, Zed, JetBrains IDEs), chosen in Settings › General.

<a id="navigateur"></a>

## The built-in browser

Pages the agent opens show up in the **Browser** tab; you can also type an address
(`localhost:3000`…). The agent can read the page, click, fill in fields and take a screenshot.
Before opening a site, it asks for your approval (see
[Permissions](conversations.md#autorisations)).

- **Links.** In the conversation, a link to an address on your Mac (`http://localhost:3000`…)
  opens in the built-in browser; ⌥-click opens it in your Mac’s browser. Other links open in your
  Mac’s browser.
- **Zoom.** With the page focused: ⌘+, ⌘− and ⌘0. A “110%” chip in the address bar resets the
  page to 100% in one click. Other shortcuts: [Keyboard shortcuts](raccourcis.md#navigateur).
- **Screen size.** When the agent sets a size (mobile…), a chip in the address bar says so; a
  click cancels it. It’s also cancelled at the end of the agent’s turn.
- **Attach this page to the message**: this toolbar icon attaches a screenshot of the page to
  your next message.
- **Downloads.** Each file asks “Save As”, even when the agent is the one clicking: nothing is
  saved without your approval.
- **Dev servers.** The ones the agent starts get their own bar in the tab, with their log and
  **Stop server**.
- **Sign-ins.** Cookies and sign-ins in the built-in browser are kept from one launch to the
  next; see [Settings](reglages.md#navigateur).

<a id="annoter"></a>

### Annotate a page

1. Click the **Annotate the page** icon (a speech bubble with a +) in the toolbar.
2. Click where you want to leave a comment, write it, then **Add** (or ⌘↩). The page scrolls and
   zooms as usual; you can annotate several screens.
3. **Send to the agent**: the comments go in one message, with a screenshot of each annotated
   screen and the elements they point to.

Esc exits annotation mode; comments are kept until you send them.

<a id="terminal"></a>

## The terminal

The **Terminal** tab (⌃`) is a real terminal, in the conversation’s folder. **+** opens a new
terminal.

- The agent runs its commands there in its own tabs, without a pager (`git log` doesn’t hang),
  and never touches yours. It asks for your approval before running a command.
- Select some text, then **Add to message** to attach it to your message.
- The `@terminal` mention attaches the last lines of the terminal.
- **Open a terminal here**, in the folder menu below the message box, opens this terminal in the
  conversation’s folder.

The terminal font is set in Settings › Appearance.

<a id="simulateur-ios"></a>

## The iOS Simulator

The **iOS** tab shows the simulator live: the agent can boot it, install and run the app, tap the
screen, take screenshots and record a gesture. You can also tap and scroll the app yourself.

You need the full Xcode (not just the command line tools), an iOS runtime and a simulator
(Xcode › Window › Devices and Simulators). Touch input and video go through AXe, which comes with
Bobine. Settings › Diagnostics checks all of this.

- At the top: **Zoom out**, **Fit to panel** (the default), **Actual size** (1:1), **Zoom in**.
  When zoomed in, the scroll wheel moves the view.
- Below the device: **Home**, **Lock** and **Attach this screen to the message**.

Before building, the agent asks for your approval (**Build**, **Always in this project** or
**Deny**).

<a id="android"></a>

## The Android Emulator

The **Android** tab does the same with the Android Emulator (you need the Android SDK): live
device, gestures, Back, Home and Recent apps buttons, and **Attach this screen to the message**.

<a id="taches"></a>

## The task list

When the agent keeps a task list, the **Tasks** tab shows it, with “done / total” in its name.
While the agent works, the list also sits just above the message box; a click collapses it to one
line.

<a id="echanges-acp"></a>

## ACP messages

To understand what the agent is doing: **+** menu › **ACP messages**. The messages exchanged
between Bobine and the agent show up live, in both directions; a click expands the raw JSON.
Filter, pause, and copy as NDJSON. Keys and tokens are masked; only the conversation’s last 2,000
messages are kept, in memory only.
