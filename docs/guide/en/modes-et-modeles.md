# Modes and models

The mode tells the agent how to work: act, or only read and propose a plan. The model is the AI
that answers. Both depend on what the agent offers.

Here, you can:

- [change the mode](#changer-de-mode);
- [plan before acting](#mode-plan);
- [change the model](#modele);
- [see all the session settings](#reglages-de-session);
- [choose the starting mode](#mode-de-depart);
- [continue with another agent](#continuer-avec).

<a id="changer-de-mode"></a>

## Change the mode

Click the mode chip below the message box and pick one. Or press ⇧⇥ in the message box to switch
to the next mode, or type `/mode` followed by the mode’s name.

The modes come from the agent:

| Agent | Modes |
|---|---|
| IBM Bob | Agent, Plan, Ask, and your personal modes |
| OpenCode | “Session Mode” setting: `build`, `plan`, and your personal agents |

<a id="mode-plan"></a>

## Plan before acting: plan mode

In plan mode, the agent reads and proposes without changing anything. The message box takes on the
mode’s color, the chip becomes a **Plan** badge, and a line reminds you how to leave it.

The plan appears as a document in the conversation: annotate it, then **Send my comments** or
**Run the plan**. See [Review and annotate a plan](conversations.md#plan).

To leave plan mode: **Run the plan**, the mode chip, or ⇧⇥.

<a id="modele"></a>

## Change the model

**Agents:** OpenCode. IBM Bob doesn’t offer a choice of model.

Click the model chip, next to the agent picker: the list opens on the current model, with a search
field beyond 10 models. The provider is shown on the right. Or type `/model` followed by the name.

With some models, OpenCode also offers an **Effort** setting.

<a id="reglages-de-session"></a>

## See all the session settings

The **Session settings** icon, in the message box, lists everything the agent lets you set (mode,
model, effort…), along with its MCP servers and active rules. Bobine remembers your choices for
each agent.

<a id="mode-de-depart"></a>

## Choose the starting mode

Settings › Conversations › New conversation › **Mode**: **Same as last time** (the default),
**Act** or **Plan**. A new conversation starts in this mode.

In the same section: the agent and folder for new conversations.

<a id="continuer-avec"></a>

## Continue with another agent

A conversation started with IBM Bob can continue with OpenCode, and the other way around.

1. Click the agent, on the right of the message box.
2. Under **Continue with**, choose the agent (and, for OpenCode, a model).
3. Before you confirm, Bobine shows where your messages will go (agent, model, provider). Click
   **Continue with …**.

It stays the same conversation: the history is kept, a “Continued with …” line marks the switch,
and the earlier exchange is sent as text with your next message, not before. The previous agent
receives nothing more; its session stays on its side.

Under **New conversation with**, the same menu opens a new conversation instead.
