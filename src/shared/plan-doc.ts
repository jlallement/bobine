/**
 * Plan annoté (fiche 040) : reconnaître le plan de chaque tour fait en mode plan, numéroter ses
 * versions, composer le message de remarques et choisir le mode d'exécution. Générique : Bob écrit
 * son plan dans un fichier Markdown (contenu complet du diff), OpenCode le met dans sa réponse.
 */
import type { TranscriptItem } from './transcript'

export interface ModeRef {
  id: string
  name: string
}

/** Un mode « plan » (Bob, OpenCode, Claude Code : `plan`). */
export const isPlanMode = (mode: ModeRef | undefined): boolean =>
  !!mode && (/\bplan\b/i.test(mode.id) || /\bplan\b/i.test(mode.name))

/** En dessous, une réponse en mode plan n'est pas un plan (question, remarque…). */
const MIN_PLAN_LENGTH = 200

export interface PlanVersion {
  /** Clé stable : fichier du plan, ou « réponse ». */
  series: string
  source: 'file' | 'reply'
  /** Fichier du plan (Bob). */
  path?: string
  text: string
  /** 1, 2… dans sa série. */
  version: number
  /** Texte de la version précédente de la même série (pour « Voir ce qui a changé »). */
  previous?: string
  /** Élément du fil après lequel afficher la carte (fin du tour, ou la réponse remplacée). */
  anchorId: number
  /** Réponses de l'agent remplacées par la carte (plan dans la réponse). */
  replyIds: number[]
  /** Dernier plan de la conversation : on peut l'annoter, l'envoyer, l'exécuter. */
  latest: boolean
}

type Item = TranscriptItem

const isPlanFile = (path: string) => /\.(md|markdown)$/i.test(path)

/** Plans des tours faits en mode plan, dans l'ordre du fil. */
export function planVersions(items: readonly Item[]): PlanVersion[] {
  const plans: Omit<PlanVersion, 'version' | 'previous' | 'latest'>[] = []
  let turn: Item[] = []
  let planTurn = false
  const close = () => {
    if (planTurn && turn.length > 0) {
      const plan = planOfTurn(turn)
      if (plan) plans.push(plan)
    }
    turn = []
  }
  for (const item of items) {
    if (item.kind === 'user') {
      close()
      planTurn = isPlanMode(item.mode)
      continue
    }
    turn.push(item)
  }
  close()

  const counts = new Map<string, { n: number; text: string }>()
  return plans.map((plan, i) => {
    const before = counts.get(plan.series)
    counts.set(plan.series, { n: (before?.n ?? 0) + 1, text: plan.text })
    return {
      ...plan,
      version: (before?.n ?? 0) + 1,
      ...(before ? { previous: before.text } : {}),
      latest: i === plans.length - 1
    }
  })
}

function planOfTurn(turn: Item[]): Omit<PlanVersion, 'version' | 'previous' | 'latest'> | null {
  const last = turn.at(-1)
  if (!last) return null
  // Fichier Markdown écrit pendant le tour (Bob) : son contenu complet est le plan.
  for (let i = turn.length - 1; i >= 0; i--) {
    const item = turn[i]
    if (item?.kind !== 'tool' || item.status !== 'completed') continue
    const diff = [...item.content].reverse().find((c) => c.type === 'diff' && isPlanFile(c.path))
    if (diff?.type === 'diff' && diff.newText.trim()) {
      return {
        series: diff.path,
        source: 'file',
        path: diff.path,
        text: diff.newText,
        anchorId: last.id,
        replyIds: []
      }
    }
  }
  // Sinon, la réponse de l'agent après son dernier outil (OpenCode).
  const lastTool = turn.findLastIndex((i) => i.kind === 'tool')
  const replies = turn.slice(lastTool + 1).filter((i) => i.kind === 'agent')
  const text = replies
    .map((r) => (r.kind === 'agent' ? r.text : ''))
    .join('\n\n')
    .trim()
  const first = replies[0]
  if (!first || text.length < MIN_PLAN_LENGTH) return null
  return {
    series: 'réponse',
    source: 'reply',
    text,
    anchorId: first.id,
    replyIds: replies.map((r) => r.id)
  }
}

export interface PlanNote {
  /** Passage du plan sélectionné. */
  quote: string
  comment: string
}

/** Message de remarques : chaque passage cité avec sa remarque, puis la demande de mise à jour. */
export function planFeedback(notes: readonly PlanNote[], path?: string): string {
  const where = path ? ` (${basenameOf(path)})` : ''
  const lines = notes.map((note, i) => {
    const quote = note.quote.replace(/\s+/g, ' ').trim()
    return `${i + 1}. Passage : « ${quote} »\n   Remarque : ${note.comment.trim()}`
  })
  const update = path
    ? `Mets à jour le plan dans ${basenameOf(path)} en tenant compte de ces remarques, et renvoie-le aussi en entier dans ta réponse.`
    : 'Mets à jour le plan en tenant compte de ces remarques, et renvoie-le en entier.'
  return `Remarques sur le plan${where} :\n\n${lines.join('\n\n')}\n\n${update} Reste en mode plan : ne modifie rien d’autre que le plan.`
}

/** Demande d'exécution, une fois de retour dans le mode d'exécution. */
export function planExecution(path?: string): string {
  return path ? `Exécute le plan de ${basenameOf(path)}.` : 'Exécute ce plan.'
}

/**
 * Mode pour exécuter le plan : celui du dernier message envoyé hors mode plan, sinon le premier mode
 * proposé qui n'est ni « plan » ni « ask » (`agent` pour Bob, `build` pour OpenCode).
 */
export function executionMode(
  items: readonly Item[],
  options: readonly { value: string; name: string }[]
): string | undefined {
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i]
    if (item?.kind === 'user' && item.mode && !isPlanMode(item.mode)) {
      if (options.some((o) => o.value === item.mode?.id)) return item.mode.id
    }
  }
  return options.find(
    (o) => !isPlanMode({ id: o.value, name: o.name }) && !/\bask\b/i.test(`${o.value} ${o.name}`)
  )?.value
}

const basenameOf = (path: string) => path.split('/').filter(Boolean).at(-1) ?? path
