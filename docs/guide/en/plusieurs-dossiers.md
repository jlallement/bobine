# Multiple folders

A conversation works in one folder, its working folder. You can give the agent other folders as
well: a library your app uses, the server for a mobile app, a documentation repository.

**Agents:** only those that support it. OpenCode (2.0.31 and later) does; IBM Bob doesn’t for now.
See [Agents](agents.md).

Here, you can:

- [add a folder](#ajouter);
- [remove a folder](#retirer);
- know [the limits](#limites).

<a id="ajouter"></a>

## Add a folder

1. Open the **Session** tab of the side panel (⌘J if the panel is closed).
2. In **Environment**, on the **Other folders** line, either:
   - type or paste the folder’s path in the **Folder path…** field, then ↩ (or **Add this
     folder**); a path starts from the root, or from `~` for your home folder;
   - drop a folder onto the field (“Drop to add”);
   - or click **Choose a folder…**: the picker opens in the folder that contains the
     conversation’s folder; choose the folder, then **Add**.

One folder at a time. A link to a folder is followed: the real folder is added and shown. Bobine
refuses, saying why below the field, a folder that is too broad (your home folder, any folder
that contains it, the root of a disk), the working folder or a folder inside it (the agent can
already reach it), a folder already in the list, and a path that leads to no folder.

The folder appears in **Other folders**. The agent’s session restarts right away with the new
list; the conversation is kept. With your next message, Bobine tells the agent which extra folders
it has.

The “Other folders” line only appears once the agent has started, and only if it supports multiple
folders. While the agent is responding (or starting), the field is read-only and its buttons, like
the cross, wait until its turn ends; hovering them, or focusing them with the keyboard, says why.

<!-- si: finder -->
Click a folder’s name to show it in the Finder.
<!-- si: !finder !explorer
Click a folder’s name to show it in the file manager.
-->
<!-- si: explorer
Click a folder’s name to show it in File Explorer.
-->

<a id="retirer"></a>

## Remove a folder

Click the cross to the right of the folder. The session restarts without it, and the agent learns
about it with your next message.

<a id="limites"></a>

## Limits

- `@` mentions and attachments only offer files from the working folder.
- The Changes tab only follows the working folder. The [Files](panneaux.md#fichiers) tab, however,
  also shows the other folders.
- Other folders are not carried over to branches (“Branch from this message”) or to delegated
  tasks.
- If you hand the conversation over to an agent that doesn’t support multiple folders, the list
  stays visible, greyed out, with “Not sent: …”.
