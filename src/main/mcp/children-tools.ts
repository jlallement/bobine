/**
 * Outils des conversations filles (fiche 097, étape 2, ADR-0019) : l'agent d'une conversation
 * lance des filles, leur écrit et suit leur état ; l'agent d'une fille écrit à sa mère.
 *
 * - Une mère possible (dossier dans un dépôt git) reçoit `start_child`, `message_child`,
 *   `child_status` et `recommend_merge` ; une fille, seulement `message_parent` (un seul niveau) ;
 *   un relecteur (fiche 177), seulement `report_findings` (`review-tools.ts`).
 *   Le rôle se lit au début de la session.
 * - La mère est un tech lead (fiche 160) : elle choisit agent et modèle de chaque fille (validés
 *   ici, présélectionnés sur la carte), lit des comptes rendus courts, vérifie elle-même, renvoie
 *   des corrections et recommande la fusion. Aucun outil ne fusionne : c'est l'utilisateur.
 * - Autorisés d'office : ils n'agissent que dans l'app, et `start_child` demande lui-même l'accord
 *   de l'utilisateur pour chaque fille (carte « Tâches proposées », fiche 112 : Lancer, Faire ici,
 *   Refuser ; agent et modèle au choix).
 * - Les descriptions sont en anglais (ADR-0014) : un modèle ne s'en sert bien que si elles disent
 *   quand s'en servir, et quand ne pas s'en servir.
 */
import type { ConversationSummary } from '@shared/agent'
import {
  clip,
  REPORT_CHARS,
  type ChildDecision,
  type ChildProposal,
  type ChildState
} from '@shared/children'
import { messageOf } from '@shared/errors'
import type { ChildChoices, ChildConversations, ChildStatus } from '../conversations/children'
import { log } from '../log'
import {
  roleSnapshot,
  rolesForAgent,
  rolesParagraph,
  type RoleSnapshot,
  type RoleView
} from '@shared/roles'
import { roleDefaults } from '../roles/choice'
import { reportFindingsTool, type ReviewTools } from './review-tools'
import { argsOf, textResult, type AppTool, type AppToolModule, type ToolArgs } from './tools'
import type { ToolContext, ToolResult } from './tools'

/** Ce que les outils demandent au module des filles. */
export type ChildTools = Pick<
  ChildConversations,
  | 'role'
  | 'summary'
  | 'capacity'
  | 'start'
  | 'children'
  | 'status'
  | 'messageChild'
  | 'messageParent'
  | 'choices'
  | 'recommend'
  | 'rolesFor'
  | 'findRole'
> & { reviews: ReviewTools }

const START_CHILD =
  'Start a child conversation: another agent that works in parallel, in its own git worktree ' +
  "(a new branch from this folder's last commit), on an instruction you write. The user sees it " +
  'under this conversation, can open it, talk to it and stop it. Proposing one is cheap: nothing ' +
  'starts until the user decides on a card (start it, do it here, or refuse), so propose rather ' +
  'than guess. Use it, one call per piece of work, when the user asks for several independent ' +
  'tasks (one child each, in parallel), for a long task the user will want to follow separately, ' +
  'or for a review or an audit by a fresh pair of eyes (security, performance, a second opinion ' +
  'on a module). Do it yourself for a question, reading or searching code, a small fix, or tasks ' +
  'that depend on one another or change the same files. After starting children, end your turn ' +
  'unless you have other work: you will be woken up once, with all their reports, when every ' +
  'child you started has finished its turn. You are their tech lead: you may suggest the agent ' +
  'and model that fit each task (`agent`, `model`, `why`; omit them to keep yours), the user ' +
  'confirms or changes them. A report is a short note, never the diff, and not proof: check the ' +
  'branch yourself (git, risky files, project checks) or with a sub-agent, send fixes with ' +
  'message_child, then call recommend_merge. Never merge a branch yourself: the user merges. ' +
  'A child cannot start children. Your own sub-agents are not child conversations: never call ' +
  'them that.'

const MESSAGE_CHILD =
  'Send a message to one of your child conversations (ids from start_child or child_status), to ' +
  'answer its question, adjust its task, or send the fixes you found when checking its work (it ' +
  "keeps its context: say what to change, not the whole task again). It is queued and read when the child's current reply " +
  'ends (at once if it is idle), marked as coming from you. You are woken up again when it has ' +
  'finished its turn.'

const RECOMMEND_MERGE =
  "Give your verdict on a child conversation's branch, shown to the user on the child's row: " +
  'ready to merge (`ready: true`, with what you checked) or not yet (`ready: false`, with what is ' +
  'missing). Only call it after checking the work yourself or with a sub-agent: the report is ' +
  'not proof. This does not merge anything: the user merges, from the Subtasks card. Never merge ' +
  'the branch yourself. A new turn of the child makes your verdict outdated: check again.'

const CHILD_STATUS =
  'List the child conversations started from this conversation: id, title, state (working, ' +
  'waiting for the user, finished, error), branch, files changed and the end of their last ' +
  'reply. Use it when the user asks how they are doing. No need to poll: you are woken up when ' +
  'the children you started have all finished.'

const MESSAGE_PARENT =
  'Send a message to your parent conversation, the one that started you (you are a child ' +
  'conversation, working in your own git worktree). Use it to ask a question you cannot settle ' +
  'yourself, or to tell it something it needs now (briefly: never paste a diff, it is cut). Do ' +
  'not use it for your final summary: the end ' +
  'of each of your turns already reaches it as a report. After asking a question, end your turn: ' +
  'the answer will arrive as a message.'

const PENDING =
  'The user has not answered yet: the proposal card is still displayed. End your turn now with a ' +
  'short sentence saying the child conversation is waiting for approval. If the user approves, it ' +
  'starts and you will be woken up with its report; if they want you to do it yourself, or not ' +
  'at all, you will be told.'

/** « Faire ici » : la consigne revient à l'agent, qui la fait dans cette conversation. */
const doHere = (title: string, prompt: string, late: boolean) =>
  `${late ? 'About the child conversation' : 'The user did not start the child conversation'} "${title}": ` +
  `${late ? 'the user wants' : 'they want'} you to do this task yourself, now, in this conversation ` +
  `(no child conversation, no worktree: work in this folder). The task:\n${prompt}`

export function childrenToolsModule(children: () => ChildTools | undefined): AppToolModule {
  /** Accords demandés et pas encore répondus, par mère : des places prises sous le plafond. */
  const asking = new Map<string, number>()
  return {
    id: 'children',
    about: {
      title: 'appToolFamilies.children.title',
      summary: 'appToolFamilies.children.summary',
      // Mère : dossier dans un dépôt git (`role`) ; une fille n'a que `message_parent`.
      condition: 'appToolFamilies.children.condition',
      // `start_child` : carte « Tâches proposées » (Lancer, Faire ici, Refuser) pour chaque fille.
      approval: 'appToolFamilies.children.approval'
    },
    // Réglages (fiche 099) : les outils d'une mère, puis celui d'une fille.
    catalog: (context) => {
      const host = children()
      return host
        ? [
            ...motherTools(context, host, asking),
            messageParent(context, host),
            reportFindingsTool(context.conversationId, host.reviews)
          ]
        : []
    },
    tools: (context) => {
      const host = children()
      if (!host) return []
      let role: ReturnType<ChildTools['role']>
      try {
        role = host.role(context.conversationId)
      } catch {
        // Conversation inconnue (agent hors conversation) : pas de filles.
        return []
      }
      if (role === 'child') return [messageParent(context, host)]
      // Relecteur (fiche 177) : rendre ses remarques, rien d'autre (ni mère, ni `message_parent`).
      if (role === 'reviewer') return [reportFindingsTool(context.conversationId, host.reviews)]
      return role === 'mother' ? motherTools(context, host, asking) : []
    }
  }
}

/** Outil de l'app sans onglet de panneau, autorisé d'office (voir l'en-tête). */
function tool(
  name: string,
  description: string,
  properties: ToolArgs,
  required: string[],
  call: (args: ToolArgs) => Promise<ToolResult>
): AppTool {
  return {
    definition: {
      name,
      description,
      inputSchema: { type: 'object', properties, required }
    },
    autoAllow: true,
    call: async (raw) => call(argsOf(raw))
  }
}

function text(args: ToolArgs, key: string): string {
  const value = args[key]
  if (typeof value !== 'string' || !value.trim()) throw new Error(`\`${key}\`: text expected`)
  return value.trim()
}

function motherTools(
  context: ToolContext,
  host: ChildTools,
  asking: Map<string, number>
): AppTool[] {
  const id = context.conversationId
  return [
    tool(
      'start_child',
      startChildDescription(host, id),
      {
        title: {
          type: 'string',
          description: 'Short title of the child conversation, shown to the user (a few words).'
        },
        prompt: {
          type: 'string',
          description:
            "Complete instructions for the child, which knows nothing of this conversation and starts from the folder's last commit (uncommitted changes are not in its worktree): what to do, what not to touch, how to check the work, to commit on its branch when done, and to start its final reply with a short summary (what was done, what is left)."
        },
        agent: { type: 'string', description: agentHelp(host, id) },
        // Profil sans choix de modèle (Bob) : pas d'argument `model`, que l'agent essaierait
        // (vrai Bob 2.0.6 : un premier appel refusé, affiché « échec », avant le bon).
        ...(modelChoosable(host, id)
          ? {
              model: {
                type: 'string',
                description:
                  'Optional: a model of your own agent (its model setting) to suggest for this child. It is a suggestion: the user confirms or changes it before the child starts. Omit it to keep your current model. An unknown model is refused.'
              }
            }
          : {}),
        why: {
          type: 'string',
          description:
            'Optional, a few words shown to the user: why you suggest this agent or model.'
        },
        ...roleProperty(host, id)
      },
      ['title', 'prompt'],
      async (args) => {
        // Rôle (fiche 223) : inconnu, refusé avec la liste ; son agent et son modèle repris quand
        // le profil le permet, sauf `agent` / `model` passés par la mère.
        const role = roleOf(host, id, optional(args, 'role'))
        if (typeof role === 'string') return textResult(role, true)
        const defaults = role ? roleDefaults(host.choices(id), role) : { notes: [] }
        const agent = optional(args, 'agent') ?? defaults.agent
        const wantedModel =
          optional(args, 'model') ?? (optional(args, 'agent') ? undefined : defaults.model)
        // Profil sans choix de modèle : `model` passé quand même (vrai Bob, même absent du
        // schéma) est ignoré et l'agent en est averti, plutôt qu'un appel refusé (« échec »).
        const ignored = !agent && !!wantedModel && !modelChoosable(host, id)
        const choice = resolveChoice(host.choices(id), agent, ignored ? undefined : wantedModel)
        if (typeof choice === 'string') return textResult(choice, true)
        const prompt = text(args, 'prompt')
        const command = leadingCommand(prompt, 'prompt')
        if (command) return textResult(command, true)
        const why = optional(args, 'why')
        const result = await startChild(context, host, asking, {
          title: text(args, 'title'),
          prompt,
          ...choice,
          ...(why ? { why: clip(why, WHY_CHARS) } : {}),
          // Rôle figé à la carte : la fille lancée est celle que l'utilisateur a vue (relecture).
          ...(role ? { role: roleSnapshot(role) } : {})
        })
        const notes = [...(ignored ? [MODEL_IGNORED] : []), ...defaults.notes]
        return notes.length && !result.isError
          ? {
              ...result,
              content: [
                ...notes.map((n) => ({ type: 'text' as const, text: n })),
                ...result.content
              ]
            }
          : result
      }
    ),
    tool(
      'message_child',
      MESSAGE_CHILD,
      {
        child: { type: 'string', description: 'Id (or exact title) of the child conversation.' },
        message: { type: 'string', description: 'The message, as you would write it to the child.' }
      },
      ['child', 'message'],
      async (args) => {
        const child = findChild(host, id, text(args, 'child'))
        if (typeof child === 'string') return textResult(child, true)
        const message = text(args, 'message')
        const command = leadingCommand(message, 'message')
        if (command) return textResult(command, true)
        const delivery = host.messageChild(id, child, message)
        return textResult(
          delivery === 'queued'
            ? `Message queued for the child conversation "${child.title}": it will read it when its current reply ends. You will be woken up when it has finished its turn.`
            : `Message sent to the child conversation "${child.title}", which starts working on it. You will be woken up when it has finished its turn.`
        )
      }
    ),
    tool('child_status', CHILD_STATUS, {}, [], async () => {
      const list = host.status(id)
      if (list.length === 0) return textResult('This conversation has no child conversation.')
      return textResult(list.map(statusLine).join('\n'))
    }),
    tool(
      'recommend_merge',
      RECOMMEND_MERGE,
      {
        child: { type: 'string', description: 'Id (or exact title) of the child conversation.' },
        ready: {
          type: 'boolean',
          description: 'true: ready to merge; false: not yet (say what is missing in `note`).'
        },
        note: {
          type: 'string',
          description: 'One or two sentences for the user: what you checked, or what is missing.'
        }
      },
      ['child', 'ready', 'note'],
      async (args) => {
        const found = findChild(host, id, text(args, 'child'))
        if (typeof found === 'string') return textResult(found, true)
        const ready = args['ready']
        if (typeof ready !== 'boolean') throw new Error('`ready`: true or false expected')
        host.recommend(id, found, ready, text(args, 'note'))
        return textResult(
          ready
            ? `Recorded: "${found.title}" is recommended for merging, on its row for the user. The user merges it; do not merge it yourself. Tell the user in your reply.`
            : `Recorded: "${found.title}" is not ready to merge, on its row for the user. Send the fixes with message_child if you have not already.`
        )
      }
    )
  ]
}

/** Rôles actifs de la mère ; aucun si la conversation est inconnue. */
function activeRoles(host: ChildTools, motherId: string): RoleView[] {
  try {
    return host.rolesFor(motherId)
  } catch {
    return []
  }
}

/** Description de `start_child`, suivie des rôles de la mère (fiche 223). */
function startChildDescription(host: ChildTools, motherId: string): string {
  const roles = rolesParagraph(activeRoles(host, motherId))
  return roles.length ? `${START_CHILD}\n\n${roles.join('\n')}` : START_CHILD
}

/** Argument `role`, seulement s'il y a des rôles actifs. */
function roleProperty(host: ChildTools, motherId: string): ToolArgs {
  const roles = activeRoles(host, motherId)
  if (roles.length === 0) return {}
  return {
    role: {
      type: 'string',
      description: `Optional: the name of a role to start the child with (its instructions, agent, mode and tools come with it). Roles: ${rolesForAgent(
        roles
      )
        .shown.map((r) => r.name)
        .join(', ')}.`
    }
  }
}

/** Rôle demandé : actif, sinon l'erreur pour l'agent avec les rôles connus ; rien sans `role`. */
function roleOf(
  host: ChildTools,
  motherId: string,
  name: string | undefined
): RoleView | string | undefined {
  if (!name) return undefined
  try {
    return host.findRole(motherId, name)
  } catch {
    const known = rolesForAgent(activeRoles(host, motherId)).shown.map((r) => r.name)
    return `Unknown role "${name}". ${known.length ? `Roles: ${known.join(', ')}.` : 'No role is defined.'} Omit \`role\` to start a child without a role.`
  }
}

/**
 * Commande « / » en tête d'une consigne ou d'un message de la mère (fiche 160) : elle partirait à
 * la fille comme une commande de son agent (`/model …`), sans l'accord de l'utilisateur. Rend
 * l'erreur pour l'agent, ou `undefined`.
 */
export function leadingCommand(text: string, key: string): string | undefined {
  const command = /^\/\S+/.exec(text.trimStart())?.[0]
  if (!command) return undefined
  return `\`${key}\` starts with a command (${command}): commands are never sent to a child conversation. Write the instruction as plain text; to change its agent or model, use start_child's \`agent\` and \`model\`, which the user confirms.`
}

/** Message d'une fille à sa mère gardé (fiche 160) : au-delà, coupé, comme un compte rendu. */
export const PARENT_MESSAGE_CHARS = 2 * REPORT_CHARS

/** Message de la fille borné, pour ne pas remplir le contexte de la mère (un diff collé…). */
export function bounded(text: string): string {
  if (text.length <= PARENT_MESSAGE_CHARS) return text
  return `${clip(text, PARENT_MESSAGE_CHARS)} (cut: ${text.length} characters in all)`
}

/** Fille d'une mère par son id ou son titre exact ; sinon le message d'erreur pour l'agent. */
function findChild(host: ChildTools, motherId: string, ref: string): ConversationSummary | string {
  const list = host.children(motherId)
  const child =
    list.find((c) => c.id === ref) ?? list.find((c) => c.title.toLowerCase() === ref.toLowerCase())
  if (child) return child
  const known = list.map((c) => `"${c.title}" (id: ${c.id})`).join(', ')
  return `No child conversation "${ref}". ${known ? `Child conversations: ${known}.` : 'This conversation has no child conversation.'}`
}

/** Raison d'un choix d'agent ou de modèle, montrée sur la carte : au-delà, coupée. */
const WHY_CHARS = 160
/** Modèles cités dans une erreur : au-delà, comptés. */
const LISTED_MODELS = 40

function optional(args: ToolArgs, key: string): string | undefined {
  const value = args[key]
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string') throw new Error(`\`${key}\`: text expected`)
  return value.trim() || undefined
}

const agentName = (p: ChildChoices['profiles'][number]) => `${p.id} (${p.label})`

const MODEL_IGNORED =
  "`model` was ignored: your agent's profile does not allow choosing the model of a child conversation, which takes your own model. Do not pass `model` again."

/** Le profil de la mère permet de suggérer le modèle d'une fille (`childModelChoice`). */
function modelChoosable(host: ChildTools, motherId: string): boolean {
  try {
    return host.choices(motherId).model !== undefined
  } catch {
    return false
  }
}

/** Aide de l'argument `agent`, avec les agents disponibles à l'ouverture de la session. */
function agentHelp(host: ChildTools, motherId: string): string {
  const base =
    'Optional: the agent of this child (id or name), when another agent fits the task better. Omit it to keep yours.'
  try {
    const { profileId, profiles } = host.choices(motherId)
    const available = profiles.filter((p) => p.available)
    if (available.length === 0) return base
    const yours = profiles.find((p) => p.id === profileId)
    return `${base} Available: ${available.map(agentName).join(', ')}.${yours ? ` Yours: ${yours.id}.` : ''}`
  } catch {
    return base
  }
}

/**
 * Agent et modèle demandés par `start_child` (fiche 160), validés contre ce que l'app connaît :
 * les profils disponibles, les options du réglage `model` de l'agent de la mère. Rend ce qui part
 * sur la carte (rien pour l'agent de la mère), ou le message d'erreur pour l'agent.
 */
export function resolveChoice(
  choices: ChildChoices,
  agent: string | undefined,
  model: string | undefined
): Pick<ChildProposal, 'profileId' | 'model'> | string {
  const available = choices.profiles.filter((p) => p.available)
  const list = `Available agents: ${available.map(agentName).join(', ') || 'none'}.`
  let profileId = choices.profileId
  if (agent) {
    const wanted = agent.toLowerCase()
    const found =
      choices.profiles.find((p) => p.id.toLowerCase() === wanted) ??
      choices.profiles.find((p) => p.label.toLowerCase() === wanted)
    if (!found) return `Unknown agent "${agent}". ${list} Omit \`agent\` to keep yours.`
    if (!found.available) {
      return `The agent "${found.label}" is not available${found.reason ? ` (${found.reason})` : ''}. ${list}`
    }
    profileId = found.id
  }
  const other = profileId !== choices.profileId ? { profileId } : {}
  if (!model) return other
  if (profileId !== choices.profileId) {
    return `A model can only be chosen for your own agent (${choices.profileId}): the agent "${profileId}" takes its last chosen model. Omit \`model\`, or \`agent\`.`
  }
  const control = choices.model
  if (!control) {
    return "Your agent's profile does not allow choosing the model of a child conversation: omit `model`, the child takes the agent's own model."
  }
  const wanted = model.toLowerCase()
  const option =
    control.options.find((o) => o.value.toLowerCase() === wanted) ??
    control.options.find((o) => o.name.toLowerCase() === wanted)
  if (!option) {
    const names = control.options.slice(0, LISTED_MODELS).map((o) => o.value)
    const more = control.options.length - names.length
    return `Unknown model "${model}". Models of your agent: ${names.join(', ')}${more > 0 ? `, and ${more} more` : ''}.`
  }
  return { model: { controlId: control.id, value: option.value } }
}

/**
 * `start_child` : plafond, carte de propositions, puis la fille. Le plafond se vérifie avant la
 * carte, et une proposition en attente prend une place (l'agent peut appeler l'outil plusieurs
 * fois à la fois). Une réponse tardive (l'agent a déjà fini son tour) : lancée, la fille démarre
 * et l'agent l'apprendra au réveil ; « Faire ici » ou refusée, il en est informé par un message.
 */
async function startChild(
  context: ToolContext,
  host: ChildTools,
  asking: Map<string, number>,
  proposal: ChildProposal
): Promise<ToolResult> {
  const { title, prompt } = proposal
  const id = context.conversationId
  const blocked = cannotStart(host, id, title, asking.get(id) ?? 0)
  if (blocked) return blocked
  asking.set(id, (asking.get(id) ?? 0) + 1)
  let answered = false
  const release = () => {
    if (answered) return
    answered = true
    asking.set(id, Math.max(0, (asking.get(id) ?? 1) - 1))
  }
  const start = (decision: ChildDecision) =>
    launch(
      host,
      id,
      { title, prompt, ...decision, ...(proposal.role ? { role: proposal.role } : {}) },
      asking.get(id) ?? 0
    )
  const decision = await context.proposeChild(proposal, (late) => {
    release()
    switch (late.action) {
      case 'start':
        void start(late).then((result) => {
          if (result.isError) context.tellAgent(resultText(result))
        })
        return
      case 'here':
        context.tellAgent(doHere(title, prompt, true))
        return
      case 'refuse':
        context.tellAgent(
          `I refused to start the child conversation "${title}". Do not start it again; tell me how you will handle this task instead.`
        )
    }
  })
  if (decision === 'late') return textResult(PENDING)
  release()
  switch (decision.action) {
    case 'start':
      return start(decision)
    case 'here':
      return textResult(doHere(title, prompt, false))
    case 'refuse':
      return textResult(
        `The user refused to start the child conversation "${title}". Do not start it again unless the user asks: do this task yourself, or ask the user how to handle it.`
      )
  }
}

/**
 * Pas de fille possible : hors dépôt git, ou plafond atteint (le réglage est cité). `asking` :
 * cartes d'accord encore sans réponse, qui prennent une place.
 */
function cannotStart(
  host: ChildTools,
  id: string,
  title: string,
  asking: number
): ToolResult | undefined {
  const { inRepo, active, max } = host.capacity(id)
  if (!inRepo) {
    return textResult(
      `Cannot start the child conversation "${title}": this folder is not in a git repository, and a child conversation needs its own git worktree.`,
      true
    )
  }
  if (active + asking < max) return undefined
  const waiting = asking ? ` and ${asking} more wait(s) for the user's approval` : ''
  return textResult(
    `Cannot start the child conversation "${title}": ${active} child conversation(s) are already running${waiting}, which is the limit set by the user (Settings › Conversation › Running child conversations, ${max}). Wait until one has finished (you are woken up when all the children you started have finished), group tasks, or do this one yourself.`,
    true
  )
}

async function launch(
  host: ChildTools,
  id: string,
  {
    title,
    prompt,
    profileId,
    model,
    role
  }: { title: string; prompt: string; role?: RoleSnapshot } & ChildDecision,
  asking: number
): Promise<ToolResult> {
  // Le temps de répondre à la carte, d'autres filles ont pu partir.
  const blocked = cannotStart(host, id, title, asking)
  if (blocked) return blocked
  try {
    const child = await host.start(
      id,
      {
        text: prompt,
        title,
        ...(profileId ? { profileId } : {}),
        ...(model ? { model } : {}),
        ...(role ? { roleSnapshot: role } : {})
      },
      'agent'
    )
    const where = role?.readOnly
      ? `It works in parallel as the read-only role "${role.name}", in this folder (no worktree, no branch).`
      : `It works in parallel${role ? ` as the role "${role.name}"` : ''} in its own worktree.`
    return textResult(
      `Child conversation "${child.title}" started (id: ${child.id}${child.branch ? `, branch: ${child.branch}` : ''}). ${where} End your turn when you have nothing else to do: you will be woken up with the reports when all the child conversations you started have finished their turn.`
    )
  } catch (error) {
    log.warn('Conversation fille non lancée :', error)
    return textResult(
      `Could not start the child conversation "${title}": ${messageOf(error)}`,
      true
    )
  }
}

function messageParent(context: ToolContext, host: ChildTools): AppTool {
  return tool(
    'message_parent',
    MESSAGE_PARENT,
    {
      message: {
        type: 'string',
        description: 'The message, as you would write it to the parent conversation.'
      }
    },
    ['message'],
    async (args) => {
      const child = host.summary(context.conversationId)
      const mother: ConversationSummary | undefined =
        child.startedFrom && host.summary(child.startedFrom.id)
      if (!mother) {
        return textResult(
          'You no longer have a parent conversation (it was archived or deleted). Tell the user instead.',
          true
        )
      }
      const delivery = host.messageParent(child, mother, bounded(text(args, 'message')))
      return textResult(
        `Message ${delivery === 'queued' ? 'queued for' : 'sent to'} your parent conversation "${mother.title}". If you asked a question, end your turn now: the answer will arrive as a message.`
      )
    }
  )
}

const STATE_TEXT: Record<ChildState, string> = {
  running: 'working',
  waiting: 'waiting for the user (approval or answer)',
  unread: 'finished its turn',
  done: 'finished its turn',
  error: 'ended with an error'
}

/** Une ligne de `child_status`, en anglais pour l'agent. */
function statusLine(child: ChildStatus): string {
  const files =
    child.fileCount === 0
      ? 'no files changed'
      : `${child.fileCount} file(s) changed (+${child.added} −${child.removed}): ${child.files
          .map((f) => f.path)
          .join(', ')}${child.fileCount > child.files.length ? ', …' : ''}`
  const branch = child.branch ? `; branch ${child.branch}` : ''
  const excerpt = child.excerpt
    ? `\n  Start of its last reply:\n${child.excerpt
        .split('\n')
        .map((line) => `  > ${line}`)
        .join('\n')}`
    : ''
  return `- "${child.title}" (id: ${child.id}): ${STATE_TEXT[child.state]}${branch}; ${files}.${excerpt}`
}

const resultText = (result: ToolResult) =>
  result.content.flatMap((c) => (c.type === 'text' ? [c.text] : [])).join('\n')
