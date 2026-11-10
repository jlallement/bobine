import { useCallback, useEffect, useState, type RefObject } from 'react'
import type { ConversationSummary } from '@shared/agent'

/**
 * Ordre de la liste des conversations (fiche 095) : figé tant que l'utilisateur vise un élément
 * (sinon la conversation mise à jour remonte sous le pointeur et le clic ouvre la mauvaise), filles
 * rangées sous leur mère et regroupement par projet (fiche 131).
 */

/**
 * Conversations remises dans l'ordre figé `order` ; celles qui n'y sont pas (nouvelles) vont à la
 * fin, dans leur ordre d'arrivée, pour ne rien décaler sous le pointeur. `null` : ordre reçu.
 */
export function heldOrder<T extends { id: string }>(
  items: readonly T[],
  order: readonly string[] | null
): T[] {
  if (!order) return [...items]
  const rank = new Map(order.map((id, i) => [id, i]))
  return items
    .map((item, i) => ({ item, rank: rank.get(item.id) ?? order.length + i }))
    .sort((a, b) => a.rank - b.rank)
    .map(({ item }) => item)
}

/**
 * Ordre figé tant que `held` est vrai : celui des identifiants au moment où il le devient (l'ordre
 * alors affiché). `null` quand rien ne le retient.
 */
export function useHeldOrder(ids: readonly string[], held: boolean): readonly string[] | null {
  const [order, setOrder] = useState<readonly string[] | null>(null)
  // Ajustement pendant le rendu (état dérivé d'une transition de `held`), comme le recommande React.
  if (held && order === null) setOrder(ids)
  if (!held && order !== null) setOrder(null)
  return held ? (order ?? ids) : null
}

/**
 * Le pointeur est-il sur l'élément ? Écouteurs natifs sur le document, pas `onPointerEnter` de
 * React : celui-ci suit l'arbre React, portails compris. Un menu de la liste (dans un portail, à
 * côté) refermé sous le pointeur ne signalait alors jamais la sortie, et la liste restait figée.
 * `pointerover` arrive à chaque élément survolé, même après la disparition du précédent.
 */
export function usePointerInside(ref: RefObject<HTMLElement | null>): boolean {
  const [inside, setInside] = useState(false)
  useEffect(() => {
    const over = (event: PointerEvent) =>
      setInside(event.target instanceof Node && !!ref.current?.contains(event.target))
    // Sortie de la fenêtre : rien n'est plus survolé.
    const out = (event: PointerEvent) => {
      if (!event.relatedTarget) setInside(false)
    }
    document.addEventListener('pointerover', over)
    document.addEventListener('pointerout', out)
    return () => {
      document.removeEventListener('pointerover', over)
      document.removeEventListener('pointerout', out)
    }
  }, [ref])
  return inside
}

/**
 * Raisons de figer la liste (menu ouvert, titre en cours de modification) : `hold()` en ajoute
 * une et rend de quoi la retirer, à appeler au démontage même si le menu ne s'est pas refermé.
 */
export function useHolds(): { held: boolean; hold: () => () => void } {
  const [count, setCount] = useState(0)
  const hold = useCallback(() => {
    setCount((n) => n + 1)
    return () => setCount((n) => n - 1)
  }, [])
  return { held: count > 0, hold }
}

export interface HistoryRow {
  conversation: ConversationSummary
  /** Fille affichée juste sous sa mère : dans la colonne du lien (fiche 131). */
  nested: boolean
  /** Première et dernière fille sous leur mère : le lien part sous la mère, s'arrête au coude. */
  first?: boolean
  last?: boolean
}

/**
 * Lignes d'une section : une conversation fille (fiche 097) suit sa mère quand celle-ci est dans
 * la même section, sur un seul niveau (la fille d'une fille suit aussi la mère). Sinon (mère
 * épinglée, archivée, dans un autre dossier ou supprimée), elle garde sa place. Les branches
 * (fiche 023) ne sont plus rangées sous leur origine (fiche 131) : ce sont des conversations à part
 * entière.
 */
export function nestChildren(items: readonly ConversationSummary[]): HistoryRow[] {
  const ids = new Set(items.map((c) => c.id))
  const children = new Map<string, ConversationSummary[]>()
  const roots: ConversationSummary[] = []
  for (const conversation of items) {
    const mother = conversation.startedFrom?.id
    if (mother && mother !== conversation.id && ids.has(mother)) {
      children.set(mother, [...(children.get(mother) ?? []), conversation])
    } else {
      roots.push(conversation)
    }
  }
  const rows: HistoryRow[] = []
  const seen = new Set<string>()
  // Toute la descendance d'une ligne, à plat, dans l'ordre de la liste.
  const descendants = (conversation: ConversationSummary): ConversationSummary[] =>
    (children.get(conversation.id) ?? []).flatMap((child) => {
      if (seen.has(child.id)) return []
      seen.add(child.id)
      return [child, ...descendants(child)]
    })
  const visit = (conversation: ConversationSummary) => {
    if (seen.has(conversation.id)) return
    seen.add(conversation.id)
    rows.push({ conversation, nested: false })
    const kids = descendants(conversation)
    kids.forEach((child, i) =>
      rows.push({ conversation: child, nested: true, first: i === 0, last: i === kids.length - 1 })
    )
  }
  for (const root of roots) visit(root)
  // Filles qui se citent en boucle (données abîmées) : aucune ne doit disparaître.
  for (const conversation of items) visit(conversation)
  return rows
}

/** Projet d'une conversation (fiche 131) : racine du dépôt, ou son dossier de travail. */
export const projectOf = (c: ConversationSummary) => c.project ?? c.workspace

/** Racine de la famille pour son affichage ; les préférences enregistrées restent inchangées. */
export function familyRoot(
  conversation: ConversationSummary,
  items: readonly ConversationSummary[]
): ConversationSummary {
  return rootOf(conversation, new Map(items.map((c) => [c.id, c])))
}

function rootOf(
  conversation: ConversationSummary,
  byId: ReadonlyMap<string, ConversationSummary>
): ConversationSummary {
  const seen = new Set<string>()
  let root = conversation
  while (root.startedFrom && !seen.has(root.id)) {
    seen.add(root.id)
    const mother = byId.get(root.startedFrom.id)
    if (!mother || mother.archived || seen.has(mother.id)) break
    root = mother
  }
  return root
}

/** Une mère épinglée garde ses filles actives sous elle, sans réécrire leur épinglage. */
export function sidebarFamilies(items: readonly ConversationSummary[]) {
  const archived = items.filter((c) => c.archived)
  const history = items.filter((c) => !c.archived)
  const byId = new Map(history.map((c) => [c.id, c]))
  const pinned: ConversationSummary[] = []
  const others: ConversationSummary[] = []
  for (const conversation of history) {
    const section = rootOf(conversation, byId).pinned ? pinned : others
    section.push(conversation)
  }
  return { archived, pinned, others }
}

/**
 * Conversations regroupées par projet (fiche 131), du plus récemment utilisé au plus ancien. Une
 * fille va dans le groupe de sa mère quand celle-ci est dans la liste : elle reste sous elle, même
 * si son dossier diffère (mère dans un sous-dossier du dépôt).
 */
export function byProject(
  items: readonly ConversationSummary[]
): { project: string; items: ConversationSummary[] }[] {
  const byId = new Map(items.map((c) => [c.id, c]))
  const keyOf = (c: ConversationSummary, depth = 0): string => {
    const mother = c.startedFrom && byId.get(c.startedFrom.id)
    return mother && mother.id !== c.id && depth < 8 ? keyOf(mother, depth + 1) : projectOf(c)
  }
  const groups = new Map<string, ConversationSummary[]>()
  for (const c of items) {
    const key = keyOf(c)
    groups.set(key, [...(groups.get(key) ?? []), c])
  }
  return [...groups].map(([project, grouped]) => ({ project, items: grouped }))
}
