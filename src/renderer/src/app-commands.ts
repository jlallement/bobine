/**
 * Commandes « / » de l'app (fiche 039) et pas d'une conversation à l'autre du menu (fiche 027), en
 * fonctions pures : elles disent quoi faire, `App` le fait. Seul `send` va à l'agent.
 */
import i18next from 'i18next'
import type {
  AgentConfigureRequest,
  AgentSnapshot,
  PromptRequest,
  ControlValue,
  ConversationSummary
} from '@shared/agent'
import {
  AGENT_PROMPTS,
  contextReport,
  costReport,
  mergeCommands,
  pickOption,
  withCompactCommand,
  type AppCommandName
} from '@shared/app-commands'
import type { ConversationUsage } from '@shared/usage'
import type { PromptAttachment } from '@shared/attachments'

/** Ce que fait une commande de l'app, dans l'ordre. */
export type AppCommandAction =
  /** Avis dans le fil, rien n'est envoyé à l'agent ; `title` : encadré titré (fiche 126). */
  | { type: 'info'; message: string; title?: string }
  /** `askChildren` : `/split`, demande de découpage en conversations filles (fiche 118). */
  | { type: 'send'; text: string; askChildren?: true }
  | { type: 'create'; request: AgentConfigureRequest }
  | { type: 'setControl'; controlId: string; value: ControlValue }
  /** `/btw` (fiche 180) : aparté, la question tapée (vide : la carte s'ouvre sur son champ). */
  | { type: 'aside'; question: string }

/** Ce que la commande lit de la conversation active. */
export interface AppCommandContext {
  summary: ConversationSummary | null
  snapshot: AgentSnapshot | null
  usage: ConversationUsage | undefined
}

/** Ce qui fait les actions (la conversation active : `useConversations`). */
export interface AppCommandTarget {
  info: (message: string, title?: string) => void
  send: (text: string, attachments?: PromptAttachment[], options?: PromptRequest) => void
  create: (request: AgentConfigureRequest) => void
  setControl: (controlId: string, value: ControlValue) => void
  aside?: (question: string) => void
}

const info = (message: string): AppCommandAction[] => [{ type: 'info', message }]

/** `/model` et `/mode` : les choix sans argument, sinon l'option désignée par son nom. */
function choose(
  category: 'model' | 'mode',
  args: string,
  snapshot: AgentSnapshot | null,
  agent: string
): AppCommandAction[] {
  const control = snapshot?.controls.find(
    (ctl) => ctl.category === category && ctl.type === 'select'
  )
  if (!control) return info(i18next.t(`appCommands.${category}.none`, { agent }))
  if (!args) {
    const list = control.options
      .map((o) => `${o.value === control.currentValue ? '•' : '◦'} ${o.name}`)
      .join('\n')
    return info(i18next.t('appCommands.choices', { name: control.name, list }))
  }
  const option = pickOption(control, args)
  if (!option) return info(i18next.t(`appCommands.${category}.noMatch`, { args }))
  return [
    { type: 'setControl', controlId: control.id, value: option.value },
    ...info(i18next.t('appCommands.chosen', { name: control.name, value: option.name }))
  ]
}

/** Ce que fait la commande `/name args` dans la conversation active. */
export function appCommandActions(
  name: AppCommandName,
  args: string,
  { summary, snapshot, usage }: AppCommandContext
): AppCommandAction[] {
  const agent = snapshot?.info.agentName ?? snapshot?.info.profileLabel ?? i18next.t('app.theAgent')
  switch (name) {
    case 'clear':
      return [
        {
          type: 'create',
          request: summary ? { profileId: summary.profileId, workspace: summary.workspace } : {}
        }
      ]
    case 'compact':
      return snapshot?.compactCommand
        ? [{ type: 'send', text: snapshot.compactCommand }]
        : info(i18next.t('appCommands.cannotCompact', { agent }))
    case 'context':
      return [
        {
          type: 'info',
          title: i18next.t('appCommands.report.context'),
          message: contextReport(usage, agent, snapshot?.compactCommand)
        }
      ]
    case 'cost':
      return [
        {
          type: 'info',
          title: i18next.t('appCommands.report.cost'),
          message: costReport(usage, agent)
        }
      ]
    case 'model':
    case 'mode':
      return choose(name, args, snapshot, agent)
    case 'init':
    case 'review':
      return [{ type: 'send', text: AGENT_PROMPTS[name] ?? '' }]
    case 'split':
      return args
        ? [{ type: 'send', text: args, askChildren: true }]
        : info(i18next.t('appCommands.splitEmpty'))
    case 'btw':
      return [{ type: 'aside', question: args }]
    case 'help':
      return info(
        mergeCommands(
          withCompactCommand(snapshot?.commands ?? [], snapshot?.compactCommand, agent),
          [],
          snapshot?.compactCommand
        )
          .map((cmd) => `/${cmd.name}${cmd.hint ? ` ${cmd.hint}` : ''} — ${cmd.description}`)
          .join('\n')
      )
  }
}

export function applyAppCommand(
  actions: readonly AppCommandAction[],
  target: AppCommandTarget
): void {
  for (const action of actions) {
    if (action.type === 'info') target.info(action.message, action.title)
    else if (action.type === 'send') {
      target.send(action.text, [], action.askChildren ? { askChildren: true } : {})
    } else if (action.type === 'create') target.create(action.request)
    else if (action.type === 'aside') target.aside?.(action.question)
    else target.setControl(action.controlId, action.value)
  }
}

/**
 * Conversation précédente (`delta` -1) ou suivante (+1) de l'historique, en boucle ; les
 * brouillons n'en font pas partie. Sans conversation active dans l'historique : la première.
 */
export function stepConversation(
  list: readonly ConversationSummary[],
  activeId: string | null,
  delta: number
): string | undefined {
  const history = list.filter((conv) => !conv.draft)
  if (history.length === 0) return undefined
  const i = history.findIndex((conv) => conv.id === activeId)
  return history[i < 0 ? 0 : (i + delta + history.length) % history.length]?.id
}
