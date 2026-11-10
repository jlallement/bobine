/**
 * Question posée avant qu'un outil de l'app lance une commande (terminal, serveur de dev,
 * compilation iOS ou Android — fiches 030, 034, 008, 032), comme Claude Code (fiche 072) :
 * « Lancer » pour cette conversation, « Toujours dans ce projet » (retenu pour ce dossier,
 * révocable dans les Réglages), « Refuser ». L'utilisateur voit toujours la commande exacte.
 */
import type { CommandMemory } from '../approvals'
import { refusedResult, textResult, type ToolContext, type ToolResult } from './tools'
import { t } from 'i18next'

export interface CommandApproval {
  /** Dossier où l'accord « toujours » est retenu. */
  workspace: string
  /** Commande telle que montrée et retenue. */
  command: string
  question: string
  header: string
  /** Libellé de l'accord : « Lancer », « Compiler »… */
  allow: string
  allowDescription: string
  /** Accords de cette conversation (ou de cette session de l'app), par clé. */
  session: Set<string>
  key: string
  /** Accords retenus d'un lancement à l'autre ; absent : pas de choix « toujours ». */
  always?: CommandMemory
  /** Textes pour l'agent. */
  texts: { retry: string; refusedByUser: string; pending: string; refused: string }
}

/** Choix « Toujours dans ce projet », dans la langue courante. */
export const alwaysInProject = () => t('approvals.alwaysInProject')

/** `undefined` : la commande peut partir ; sinon le résultat à rendre à l'agent. */
export async function approveCommand(
  context: ToolContext,
  approval: CommandApproval
): Promise<ToolResult | undefined> {
  const { session, key, always, workspace, command } = approval
  // Refusée partout par les règles de l'agent : jamais lancée, même déjà autorisée ici (fiche 215).
  const denied = context.deniedCommand?.(command)
  if (denied !== undefined) {
    return refusedResult(
      `"${denied}" is denied everywhere in the agent's own approval rules: the app will not run ` +
        'it either. Do not try another way; tell the user it is denied and how to change the rule.'
    )
  }
  if (session.has(key) || always?.has(workspace, command)) return undefined
  const alwaysLabel = alwaysInProject()
  const accept = (choices: string[] | null) => {
    if (choices?.includes(alwaysLabel)) always?.add(workspace, command)
    else if (choices?.includes(approval.allow)) session.add(key)
    else return false
    return true
  }
  const answer = await context.ask(
    {
      question: approval.question,
      header: approval.header,
      options: [
        { label: approval.allow, description: approval.allowDescription },
        ...(always
          ? [
              {
                label: alwaysLabel,
                description: t('approvals.alwaysInProjectDescription')
              }
            ]
          : []),
        { label: t('approvals.refuse') }
      ],
      multiSelect: false,
      allowOther: false
    },
    (late) => {
      if (accept(late)) context.tellAgent(approval.texts.retry)
      else context.tellAgent(approval.texts.refusedByUser)
    }
  )
  if (answer === 'late') return textResult(approval.texts.pending)
  if (accept(answer)) return undefined
  return refusedResult(approval.texts.refused)
}
