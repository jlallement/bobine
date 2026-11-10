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
2. In **Environment**, under “Folder”, click **Add a folder…**.
3. Choose the folder, then **Add**.

The folder appears in **Other folders**. The agent’s session restarts right away with the new
list; the conversation is kept. With your next message, Bobine tells the agent which extra folders
it has.

The “Other folders” line only appears once the agent has started, and only if it supports multiple
folders. While the agent is responding, adding and removing wait for its response to end.

Click a folder’s name to show it in the Finder.

<a id="retirer"></a>

## Remove a folder

Click the cross to the right of the folder. The session restarts without it, and the agent learns
about it with your next message.

<a id="limites"></a>

## Limits

- `@` mentions and attachments only offer files from the working folder.
- The Changes tab only follows the working folder.
- Other folders are not carried over to branches (“Branch from this message”) or to child
  conversations.
- If you hand the conversation over to an agent that doesn’t support multiple folders, the list
  stays visible, greyed out, with “Not sent: …”.
