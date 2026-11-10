# Agents

Bobine drives **IBM Bob** and **OpenCode**, and any agent that speaks the ACP protocol. The
essentials work the same way with all of them; some features depend on what the agent offers.

Here you can:

- [compare IBM Bob and OpenCode](#comparer);
- read an [agent’s page](#page-agent) in Settings;
- [give IBM Bob an API key](#cle-bob);
- [add a model provider for OpenCode](#fournisseurs);
- [add another ACP agent](#autre-agent);
- [set up the corporate network](#reseau).

<a id="comparer"></a>

## IBM Bob and OpenCode: what’s different

| | IBM Bob | OpenCode |
|---|---|---|
| Sign-in | SSO or API key, in Bobine | `opencode auth login`, in a terminal |
| Before you start | folder to trust, license to accept | nothing |
| Modes | Agent, Plan, Ask | `build`, `plan` (“Session Mode” setting) |
| Model choice | no | yes, and “Effort” depending on the model |
| Permissions | before writing and running a command | none by default |
| Cost | in Bobcoins, monthly quota shown | in dollars (0 with a free model), with tokens |
| Context usage | not reported | shown |
| [Multiple folders](plusieurs-dossiers.md) | not yet | yes (2.0.31 and later) |
| Child conversation’s model | the agent chooses | yours to choose, or suggested by the parent |
| Excluded files | `.gitignore`, `.bobignore` and `.env`: not offered with `@` | none |
| Instruction files | `AGENTS.md`, `.bob/rules/` | `AGENTS.md` (up to the home folder) |
| MCP servers | `.bob/mcp.json`, `~/.bob/settings/mcp.json` | `opencode.json` |
| Slash commands and skills | `.bob/commands`, `.bob/skills` | `.opencode/commands`, `.opencode/skills`, `.claude/skills`… |

<a id="autorisations"></a>

**OpenCode and permissions.** By default, OpenCode asks for nothing, even to write outside the
folder. To make it ask before touching another folder, add this rule to `permissions` in
`opencode.json`:

```json
{ "action": "external_directory", "resource": "*", "effect": "ask" }
```

**IBM Bob’s quota** shows under its name, at the bottom of the sidebar: the share of the month
used (orange at 80%, red at 95%). A click shows the details and **Refresh**. The figures come from
Bob’s server, across all your machines.

<a id="page-agent"></a>

## An agent’s page

Settings › Agents, then click an agent:

- its status, version, command, and **Restart** (restarts the current conversation’s agent);
- **Sign-in**: its API keys, when it has any;
- **Model providers** (OpenCode);
- **What it reports**: what the agent says it can do (resume a conversation, images, attached
  files, app tools, other folders…), read at its last start;
- **Specific to …**: what Bobine does on top with this agent, including the **Checked versions**.

When an agent reports a version Bobine hasn’t checked, Settings › Diagnostics says so: its
specific features may not work.

<a id="cle-bob"></a>

## Give IBM Bob an API key

Instead of SSO sign-in: Settings › Agents › IBM Bob › **Sign-in** › **Bob Shell API key** ›
**Set**. You need a personal key. It’s encrypted in the macOS Keychain. You can also enter it on
the “Sign-in required” card (**Use an API key**).

<a id="fournisseurs"></a>

## Add a model provider for OpenCode

To use an OpenAI-compatible endpoint (your company’s internal models):

1. Settings › Agents › OpenCode › **Model providers** › **Add a provider**.
2. Enter its ID, name, base URL, models and key.
3. **Test** tells you whether it responds, how many models it lists, or why not (connection
   refused, proxy, certificate, key rejected).

**Only these providers** hides the others. The key is encrypted in the macOS Keychain, never
written to `opencode.json`.

<a id="autre-agent"></a>

## Add another ACP agent

Settings › Agents › **Add an ACP agent…**: name, command with its arguments, environment
variables, and if needed the variable for its API key and its compaction command. It then gets its
own page like the others, with **Edit…** and **Remove this agent**.

Such an agent gets everything the ACP protocol allows: conversation, tools and permissions, plan,
modes, slash commands, usage, resuming, Bobine’s tools.

<a id="reseau"></a>

## Set up the corporate network

Settings › Agents › **Corporate network**: proxy, hosts that bypass the proxy, and corporate
certificates, taken from your login shell or entered here. They’re passed to every agent the next
time it starts.
