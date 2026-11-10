/**
 * Invariants de la grille de conformité (fiche 139), vérifiés à la fin de chaque parcours, quel que
 * soit l'agent. Chaque fonction rend la liste des écarts, en clair : vide, tout va bien.
 */
import { isDeepStrictEqual } from 'node:util'
import type { ConversationView } from '@shared/agent'
import { settleTranscript, type TranscriptItem, type TranscriptState } from '@shared/transcript'

const running = (status: string) => status === 'pending' || status === 'in_progress'

/** Plus rien « en cours » : outils (et travail des sous-agents), autorisations, questions, résumés. */
export function nothingRunning(items: readonly TranscriptItem[]): string[] {
  const issues: string[] = []
  for (const item of items) {
    if (item.kind === 'tool') {
      if (running(item.status)) issues.push(`carte « ${item.title} » encore ${item.status}`)
      if (item.permission?.state === 'pending')
        issues.push(`autorisation de « ${item.title} » encore en attente`)
      for (const w of item.work ?? []) {
        if (w.kind === 'tool' && running(w.status))
          issues.push(`outil du sous-agent « ${w.title} » encore ${w.status}`)
      }
    }
    if (item.kind === 'elicitation' && item.state === 'pending')
      issues.push(`question « ${item.prompt.message} » encore en attente`)
    if (item.kind === 'compaction' && item.status === 'in_progress')
      issues.push('résumé de la conversation encore en cours')
  }
  return issues
}

/** Texte répété bout à bout (« pongpong » de la recette, D21) : réponse doublée. */
function doubled(text: string): boolean {
  const t = text.trim()
  if (t.length < 8 || t.length % 2 !== 0) return false
  return t.slice(0, t.length / 2) === t.slice(t.length / 2)
}

/**
 * Pas de doublon : identifiants uniques, une carte par outil et par tour, autant de messages de
 * l'utilisateur que d'envois, ni réponse ni message répétés.
 */
export function noDuplicates(items: readonly TranscriptItem[], sent: number): string[] {
  const issues: string[] = []
  const ids = new Set<number>()
  let toolIds = new Set<string>()
  let previous: TranscriptItem | undefined
  for (const item of items) {
    if (ids.has(item.id)) issues.push(`identifiant ${item.id} en double`)
    ids.add(item.id)
    if (item.kind === 'user') toolIds = new Set()
    if (item.kind === 'tool') {
      if (toolIds.has(item.toolCallId))
        issues.push(`carte ${item.toolCallId} en double dans un tour`)
      toolIds.add(item.toolCallId)
    }
    if ((item.kind === 'agent' || item.kind === 'user') && doubled(item.text))
      issues.push(`texte répété bout à bout : « ${item.text.slice(0, 40)}… »`)
    if (
      previous &&
      (item.kind === 'agent' || item.kind === 'user') &&
      previous.kind === item.kind &&
      previous.text === item.text &&
      item.text !== ''
    )
      issues.push(`deux ${item.kind} identiques à la suite : « ${item.text.slice(0, 40)} »`)
    previous = item
  }
  const users = items.filter((i) => i.kind === 'user' && !i.from).length
  if (users !== sent)
    issues.push(`${users} message(s) de l'utilisateur dans le fil, ${sent} envoyé(s)`)
  return issues
}

/**
 * Fil durable (fiche 103) identique au fil vivant : ce qui est sur le disque, relu comme au
 * lancement (`settleTranscript`), est ce que l'app montrait.
 */
export function durableMatchesLive(
  live: TranscriptState,
  durable: TranscriptState | undefined
): string[] {
  if (!durable) return ['aucun fil sur le disque']
  // Le fil s'écrit en JSON : une clé `undefined` n'y existe pas.
  const shown = JSON.parse(JSON.stringify(live)) as TranscriptState
  const settled = settleTranscript(durable)
  if (isDeepStrictEqual(settled, shown)) return []
  const issues: string[] = []
  if (settled.items.length !== shown.items.length)
    issues.push(`${settled.items.length} éléments sur le disque, ${shown.items.length} à l'écran`)
  settled.items.forEach((item, i) => {
    const differs = differences(item, shown.items[i])
    if (differs.length) issues.push(`élément ${i} (${item.kind}) : ${differs.join(', ')}`)
  })
  for (const key of ['usage', 'terminals', 'nextId', 'cancelling'] as const) {
    if (!isDeepStrictEqual(settled[key], shown[key])) issues.push(`${key} différent sur le disque`)
  }
  return issues.length ? issues : ['fil différent sur le disque']
}

/** Clés de premier niveau qui diffèrent, avec les deux valeurs en court. */
function differences(disk: object, screen: object | undefined): string[] {
  if (!screen) return ['absent à l’écran']
  const keys = new Set([...Object.keys(disk), ...Object.keys(screen)])
  const short = (v: unknown) => JSON.stringify(v)?.slice(0, 80) ?? 'absent'
  return [...keys].flatMap((key) => {
    const a = (disk as Record<string, unknown>)[key]
    const b = (screen as Record<string, unknown>)[key]
    return isDeepStrictEqual(a, b) ? [] : [`${key} ${short(a)} ≠ ${short(b)} à l’écran`]
  })
}

/**
 * État de l'agent cohérent avec le fil : au repos (prêt, ou arrêté quand le parcours l'arrête),
 * file vide, aucun arrêt en cours, aucun tour laissé ouvert dans la consommation.
 */
export function agentConsistent(
  view: ConversationView,
  expected: ReadonlyArray<string> = ['ready']
): string[] {
  const issues: string[] = []
  const status = view.snapshot?.status ?? view.summary.status
  if (!expected.includes(status)) issues.push(`agent ${status}, attendu ${expected.join(' ou ')}`)
  if (view.summary.status !== status && view.snapshot)
    issues.push(`liste : ${view.summary.status}, agent : ${status}`)
  if (view.snapshot?.queued.length) issues.push(`${view.snapshot.queued.length} message(s) en file`)
  if (view.transcript.cancelling) issues.push('arrêt du tour encore en cours')
  if (view.transcript.usage?.pending) issues.push('un tour reste ouvert dans la consommation')
  return issues
}
