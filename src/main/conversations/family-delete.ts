/**
 * Supprimer une mère (fiche 228) : ses filles, et les leurs, sont supprimées avec elle (arrêtées
 * proprement si elles travaillent), ou deviennent des conversations ordinaires — lien coupé, note
 * dans leur fil. Jamais de fille reliée à une conversation qui n'existe plus.
 */
import { log } from '../log'
import type { ConversationsState, DeleteOptions } from '@shared/agent'
import { childState, type FamilyMember } from '@shared/children'
import type { ConversationManager } from './manager'

/** Attente bornée de la fin du tour d'une fille arrêtée, avant de la supprimer. */
export const CHILD_STOP_TIMEOUT_MS = 3000
const STOP_POLL_MS = 50

export type FamilyHost = Pick<
  ConversationManager,
  'state' | 'delete' | 'cancel' | 'post' | 'updateRecord' | 'family'
>

/**
 * Descendance de `id` pour la confirmation de suppression : qui est « en cours » en ce moment,
 * comme la barre latérale le montre (`childState`). Une fille qui démarre (worktree, agent, consigne
 * pas encore partie, fiche 223) l'est aussi : elle va travailler, la supprimer l'arrête (fiche 250).
 */
export function familyOf(host: FamilyHost, id: string): FamilyMember[] {
  const summaries = new Map(host.state().conversations.map((c) => [c.id, c]))
  return host.family(id).map((m) => {
    const summary = summaries.get(m.id)
    return {
      ...m,
      ...(summary && childState(summary) === 'running' ? { busy: true } : {}),
      ...(summary ? { profileLabel: summary.profileLabel } : {}),
      ...(summary?.agentDeletes ? { agentDeletes: true } : {})
    }
  })
}

/** Supprime `id` et décide du sort de ses filles. */
export async function deleteConversation(
  host: FamilyHost,
  id: string,
  options: DeleteOptions = {}
): Promise<ConversationsState> {
  const { children = 'keep', childWorktrees = false, ...rest } = options
  const family = host.family(id)
  const mother = host.state().conversations.find((c) => c.id === id)
  // « Supprimer aussi chez… » peut venir de l'agent d'une fille : la mère n'est supprimée chez le
  // sien que s'il sait le faire (sans résumé, l'appel décide, comme avant la fiche 228).
  const own = mother && !mother.agentDeletes ? { ...rest, fromAgent: false } : rest
  if (children === 'delete') {
    // Des plus profondes aux plus proches : aucune ne perd sa mère avant son tour. Chacune chez son
    // propre agent, seulement s'il sait supprimer une session (une fille peut avoir un autre agent).
    const deletes = new Set(
      familyOf(host, id)
        .filter((m) => m.agentDeletes)
        .map((m) => m.id)
    )
    for (const member of family) {
      await stopWork(host, member.id)
      const fromAgent = rest.fromAgent !== false && deletes.has(member.id)
      await host.delete(member.id, { fromAgent, removeWorktree: childWorktrees })
    }
    return host.delete(id, own)
  }
  const title = mother?.title ?? ''
  const state = await host.delete(id, own)
  for (const member of family) if (member.motherId === id) detachChild(host, member.id, title)
  return family.length ? host.state() : state
}

/**
 * Coupe le lien d'une fille à sa mère supprimée et le dit dans son fil. Ses filles à elle la
 * gardent pour mère.
 */
export function detachChild(
  host: Pick<ConversationManager, 'updateRecord' | 'post'>,
  childId: string,
  motherTitle: string
): void {
  try {
    host.updateRecord(childId, (record) => {
      delete record.startedFrom
      delete record.archivedWith
    })
  } catch (error) {
    log.warn(`Fille ${childId.slice(0, 8)} introuvable pour couper son lien :`, error)
    return
  }
  host.post(childId, {
    type: 'notice',
    level: 'info',
    message: { key: 'children.notice.motherDeleted', params: { title: motherTitle } }
  })
}

/** Une fille qui répond : arrêtée (`session/cancel`), et sa fin de tour attendue un temps borné. */
async function stopWork(host: FamilyHost, id: string): Promise<void> {
  const busy = () => host.state().conversations.find((c) => c.id === id)?.status === 'busy'
  if (!busy()) return
  await host.cancel(id).catch((error: unknown) => log.warn('Fille non arrêtée :', error))
  const until = Date.now() + CHILD_STOP_TIMEOUT_MS
  while (busy() && Date.now() < until) {
    await new Promise((resolve) => setTimeout(resolve, STOP_POLL_MS))
  }
  if (busy()) log.warn(`Fille ${id.slice(0, 8)} toujours au travail : supprimée quand même`)
}
