/**
 * Consommation d'une conversation, telle que l'agent la rapporte (rien n'est estimé) :
 * - `usage_update` : remplissage du contexte et, parfois, coût cumulé de la session ;
 * - `usage` de la réponse à `session/prompt` : jetons du tour, cumulés ici ;
 * - coût lu hors protocole par la source du profil (Bob : sa base locale, `usage-report`).
 * Chaque tour garde ses jetons et son coût (fiche 109).
 */
import type { Usage, UsageUpdate } from './acp-sdk.mts'
import { numberFormat } from './i18n/format'

export interface TokenCounts {
  input: number
  output: number
  cachedRead: number
  cachedWrite: number
  thought: number
  total: number
}

export interface ConversationUsage {
  /** Jetons actuellement dans le contexte, et taille de la fenêtre. */
  context?: { used: number; size: number }
  /** Coût cumulé de la session, tel qu'annoncé par l'agent. */
  cost?: { amount: number; currency: string }
  /** Jetons cumulés sur les tours de la conversation. */
  tokens?: TokenCounts & { turns: number }
  /** Jetons du dernier tour. */
  lastTurn?: TokenCounts
  /** Les derniers tours, du plus ancien au plus récent (fiche 109). */
  turns?: TurnUsage[]
  /** Tour en cours : coût cumulé de la session et modèle à son envoi. */
  pending?: { costStart?: number; model?: TurnModel }
  /**
   * Coût des sessions précédentes de la conversation, par devise (fiche 164) : gardé quand elle
   * change de session (session perdue, autre agent), pour que son total reste juste.
   */
  earlier?: Record<string, number>
  /**
   * Premier élément du fil encore dans le contexte (fiche 166) : posé quand `used` baisse
   * nettement entre deux `usage_update` (compaction que l'app n'a pas demandée). Les éléments
   * d'avant ne comptent plus dans l'estimation des messages.
   */
  contextSince?: number
}

/** Coût d'une conversation, toutes sessions confondues (fiche 164). */
export interface ConversationCost {
  /** Total dans la devise de la session actuelle (ou la seule connue). */
  total?: { amount: number; currency: string }
  /** Coût de la session actuelle, quand des sessions précédentes s'y ajoutent. */
  session?: { amount: number; currency: string }
  /** Sessions précédentes dans d'autres devises (autre agent), jamais additionnées. */
  others: { amount: number; currency: string }[]
}

export function conversationCost(usage: ConversationUsage | undefined): ConversationCost {
  const earlier = Object.entries(usage?.earlier ?? {}).filter(([, n]) => n > 0)
  const current = usage?.cost
  // Sans coût dans cette session, la devise est celle des sessions précédentes (la première).
  const currency = current?.currency ?? earlier[0]?.[0]
  if (currency === undefined) return { others: [] }
  const before = earlier.find(([c]) => c === currency)?.[1] ?? 0
  const total = { amount: round6((current?.amount ?? 0) + before), currency }
  return {
    total,
    ...(before > 0 && current ? { session: current } : {}),
    others: earlier
      .filter(([c]) => c !== currency)
      .map(([c, amount]) => ({ amount: round6(amount), currency: c }))
  }
}

/**
 * Consommation d'une session neuve de la conversation (fiche 108) : contexte et coût repartent de
 * zéro, le coût des sessions précédentes est gardé (fiche 164). `undefined` s'il n'y en a pas.
 */
export function nextSession(usage: ConversationUsage | undefined): ConversationUsage | undefined {
  const earlier = carryCost(usage)
  return earlier ? { earlier } : undefined
}

/**
 * Coût d'un aparté (fiche 180) : une session à part de la conversation, compté comme une session
 * précédente (fiche 164) pour que total, plafond et résumé de l'index le voient.
 */
export function withAsideCost(
  usage: ConversationUsage | undefined,
  cost: { amount: number; currency: string }
): ConversationUsage {
  const earlier = { ...(usage?.earlier ?? {}) }
  if (cost.amount > 0) earlier[cost.currency] = round6((earlier[cost.currency] ?? 0) + cost.amount)
  return { ...usage, earlier }
}

/** Sessions précédentes plus celle qui se termine (changement de session, fiche 164). */
function carryCost(usage: ConversationUsage | undefined): Record<string, number> | undefined {
  const earlier = { ...(usage?.earlier ?? {}) }
  const cost = usage?.cost
  if (cost && cost.amount > 0) {
    earlier[cost.currency] = round6((earlier[cost.currency] ?? 0) + cost.amount)
  }
  return Object.keys(earlier).length ? earlier : undefined
}

/** Modèle d'un tour : identifiant et nom tels que le réglage de l'agent les donne (fiche 130). */
export interface TurnModel {
  id: string
  name: string
}

/**
 * Un tour : ses jetons si l'agent les donne, le coût cumulé de la session avant et après, et le
 * modèle à l'envoi (fiche 130).
 */
export interface TurnUsage {
  /** Fin du tour (ms). */
  at?: number
  model?: TurnModel
  input?: number
  output?: number
  /** Cache lu et écrit, réflexion : seulement si l'agent les donne (fiche 130). */
  cachedRead?: number
  cachedWrite?: number
  thought?: number
  total?: number
  costStart?: number
  /** Coût cumulé à la fin du tour, ou annoncé juste après (Bob l'écrit après sa réponse). */
  costEnd?: number
}

/** Tours gardés dans le fil. */
export const MAX_TURNS = 100

const finite = (n: unknown): number => (typeof n === 'number' && Number.isFinite(n) ? n : 0)

/**
 * Baisse de `used` vue comme une compaction (fiche 166) : au moins un quart du contexte et 1 000
 * jetons. En dessous, c'est le va-et-vient ordinaire d'un agent qui recompte son contexte.
 */
export const CONTEXT_DROP = { ratio: 0.25, tokens: 1000 }

export function contextDropped(before: number, after: number): boolean {
  const drop = before - after
  return drop >= CONTEXT_DROP.tokens && drop >= before * CONTEXT_DROP.ratio
}

/**
 * `usage_update` reçu. `nextItemId` : identifiant du prochain élément du fil, retenu comme début
 * du contexte si `used` a nettement baissé (`contextSince`, fiche 166).
 */
export function withContext(
  usage: ConversationUsage,
  update: UsageUpdate,
  nextItemId?: number
): ConversationUsage {
  const next: ConversationUsage = { ...usage }
  if (finite(update.size) > 0) next.context = { used: finite(update.used), size: update.size }
  const before = usage.context?.used
  if (
    nextItemId !== undefined &&
    before !== undefined &&
    next.context &&
    contextDropped(before, next.context.used)
  ) {
    next.contextSince = nextItemId
  }
  if (update.cost && typeof update.cost.currency === 'string') {
    return withCost(next, { amount: finite(update.cost.amount), currency: update.cost.currency })
  }
  return next
}

/**
 * Coût cumulé annoncé (par ACP ou par la source du profil). Hors d'un tour, il revient aussi au
 * dernier tour terminé : Bob écrit son coût juste après sa réponse, l'app le relit ensuite.
 */
export function withCost(
  usage: ConversationUsage,
  cost: { amount: number; currency: string }
): ConversationUsage {
  const next: ConversationUsage = { ...usage, cost }
  const last = usage.turns?.at(-1)
  if (usage.pending || !last || !usage.turns) return next
  return { ...next, turns: [...usage.turns.slice(0, -1), { ...last, costEnd: cost.amount }] }
}

/** Message envoyé : un tour commence, au coût cumulé connu à cet instant, avec ce modèle. */
export function startTurn(usage: ConversationUsage, model?: TurnModel): ConversationUsage {
  return {
    ...usage,
    pending: {
      ...(usage.cost ? { costStart: usage.cost.amount } : {}),
      ...(model ? { model: { id: model.id, name: model.name } } : {})
    }
  }
}

/** Compteurs facultatifs d'un tour : ceux que l'agent donne, nombres finis seulement. */
function optionalCounts(turn: Usage): Pick<TurnUsage, 'cachedRead' | 'cachedWrite' | 'thought'> {
  const counts: Pick<TurnUsage, 'cachedRead' | 'cachedWrite' | 'thought'> = {}
  const set = (key: keyof typeof counts, value: unknown) => {
    if (typeof value === 'number' && Number.isFinite(value)) counts[key] = value
  }
  set('cachedRead', turn.cachedReadTokens)
  set('cachedWrite', turn.cachedWriteTokens)
  set('thought', turn.thoughtTokens)
  return counts
}

/** Fin d'un tour (réponse ou erreur) : ses jetons s'il y en a, et le coût cumulé à cet instant. */
export function endTurn(usage: ConversationUsage, turn?: Usage, at?: number): ConversationUsage {
  const { pending, ...counted } = turn ? addTurn(usage, turn) : usage
  const costStart = pending ? pending.costStart : usage.turns?.at(-1)?.costEnd
  const entry: TurnUsage = {
    ...(at ? { at } : {}),
    ...(pending?.model ? { model: pending.model } : {}),
    ...(turn
      ? {
          input: finite(turn.inputTokens),
          output: finite(turn.outputTokens),
          ...optionalCounts(turn),
          total: finite(turn.totalTokens)
        }
      : {}),
    ...(costStart !== undefined ? { costStart } : {}),
    ...(usage.cost ? { costEnd: usage.cost.amount } : {})
  }
  return { ...counted, turns: [...(usage.turns ?? []), entry].slice(-MAX_TURNS) }
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6

/** Coût d'un tour, si l'agent a annoncé un coût cumulé (jamais négatif). */
export function turnCost(turn: TurnUsage): number | undefined {
  if (turn.costEnd === undefined) return undefined
  const cost = turn.costEnd - (turn.costStart ?? 0)
  return cost >= 0 ? round6(cost) : undefined
}

/** Moyennes par tour (jetons, coût) sur les tours qui les donnent. */
export function turnAverages(turns: readonly TurnUsage[]): { tokens?: number; cost?: number } {
  const mean = (values: number[]) =>
    values.length ? values.reduce((a, b) => a + b, 0) / values.length : undefined
  const tokens = mean(turns.flatMap((t) => (t.total ? [t.total] : [])))
  const cost = mean(turns.flatMap((t) => (turnCost(t) === undefined ? [] : [turnCost(t) ?? 0])))
  return {
    ...(tokens !== undefined ? { tokens: Math.round(tokens) } : {}),
    ...(cost !== undefined ? { cost: round6(cost) } : {})
  }
}

/**
 * Résumé gardé dans l'index des conversations (fiche 109). Affiché sur les cartes des conversations
 * filles (fiche 117) : leur coût, ou leurs jetons.
 */
export interface UsageDigest {
  input?: number
  output?: number
  total?: number
  turns?: number
  cost?: { amount: number; currency: string }
}

export function usageDigest(usage: ConversationUsage | undefined): UsageDigest | undefined {
  const cost = conversationCost(usage).total
  if (!usage?.tokens && !cost) return undefined
  const turns = usage?.tokens?.turns ?? usage?.turns?.length
  return {
    ...(usage?.tokens
      ? { input: usage.tokens.input, output: usage.tokens.output, total: usage.tokens.total }
      : {}),
    ...(turns ? { turns } : {}),
    // Toute la conversation (fiche 164), pas seulement sa session actuelle.
    ...(cost ? { cost } : {})
  }
}

/**
 * Total des coûts de plusieurs résumés (filles d'une carte, fiche 117), s'ils sont tous dans la même
 * unité. `undefined` si aucun n'a de coût, ou si un résumé n'a que des jetons ou une autre unité :
 * un total partiel tromperait.
 */
export function digestsTotal(
  digests: readonly (UsageDigest | undefined)[]
): { amount: number; currency: string } | undefined {
  const used = digests.filter((d): d is UsageDigest => !!d)
  const currency = used[0]?.cost?.currency
  if (currency === undefined || !used.every((d) => d.cost?.currency === currency)) return undefined
  return { amount: round6(used.reduce((n, d) => n + (d.cost?.amount ?? 0), 0)), currency }
}

export const sameDigest = (a: UsageDigest | undefined, b: UsageDigest | undefined): boolean =>
  JSON.stringify(a) === JSON.stringify(b)

/** Un résumé lu du disque, vérifié champ par champ ; `undefined` s'il ne ressemble à rien. */
export function parseUsageDigest(raw: unknown): UsageDigest | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const r = raw as Record<string, unknown>
  const count = (key: keyof UsageDigest) => {
    const value = r[key]
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? { [key]: value } : {}
  }
  const cost = r['cost'] as { amount?: unknown; currency?: unknown } | undefined
  const digest: UsageDigest = {
    ...count('input'),
    ...count('output'),
    ...count('total'),
    ...count('turns'),
    ...(typeof cost?.amount === 'number' &&
    Number.isFinite(cost.amount) &&
    typeof cost.currency === 'string'
      ? { cost: { amount: cost.amount, currency: cost.currency } }
      : {})
  }
  return Object.keys(digest).length ? digest : undefined
}

/** Une devise ISO 4217 (« USD »), que `Intl` sait écrire ; sinon une unité libre (« bobcoins »). */
export const isCurrencyCode = (currency: string): boolean => /^[A-Z]{3}$/.test(currency)

/**
 * Jetons estimés d'un texte envoyé au modèle (définitions d'outils, fiche 109) : environ 4
 * caractères par jeton pour de l'anglais et du JSON. Une estimation, affichée comme telle.
 */
export const estimateTokens = (text: string): number => Math.round(text.length / 4)

export function addTurn(usage: ConversationUsage, turn: Usage): ConversationUsage {
  const counts: TokenCounts = {
    input: finite(turn.inputTokens),
    output: finite(turn.outputTokens),
    cachedRead: finite(turn.cachedReadTokens),
    cachedWrite: finite(turn.cachedWriteTokens),
    thought: finite(turn.thoughtTokens),
    total: finite(turn.totalTokens)
  }
  const sum = usage.tokens ?? {
    input: 0,
    output: 0,
    cachedRead: 0,
    cachedWrite: 0,
    thought: 0,
    total: 0,
    turns: 0
  }
  return {
    ...usage,
    lastTurn: counts,
    tokens: {
      input: sum.input + counts.input,
      output: sum.output + counts.output,
      cachedRead: sum.cachedRead + counts.cachedRead,
      cachedWrite: sum.cachedWrite + counts.cachedWrite,
      thought: sum.thought + counts.thought,
      total: sum.total + counts.total,
      turns: sum.turns + 1
    }
  }
}

export const hasUsage = (u: ConversationUsage | undefined): u is ConversationUsage =>
  !!u && (!!u.context || !!u.cost || !!u.tokens || !!conversationCost(u).total)

/**
 * La consommation sans aucun montant (mode présentation, fiche 159) : ni coût de la session (ni
 * des précédentes, fiche 164) ni coût des tours ; les tours qui ne disent que leur coût disparaissent. Jetons et contexte restent.
 */
export function withoutCost(usage: ConversationUsage): ConversationUsage {
  const { cost: _cost, pending: _pending, earlier: _earlier, turns, ...rest } = usage
  const kept = (turns ?? []).flatMap((turn) => {
    if (turn.total === undefined) return []
    const { costStart: _start, costEnd: _end, ...tokens } = turn
    return [tokens]
  })
  return { ...rest, ...(kept.length ? { turns: kept } : {}) }
}

/** Part du contexte utilisée, entre 0 et 1. */
export const contextRatio = (u: ConversationUsage): number | undefined =>
  u.context ? Math.min(1, Math.max(0, u.context.used / u.context.size)) : undefined

/**
 * « 16 748 » ; compact (fiche 166, comme Claude Desktop) : « 733 », « 1k », « 1,2k », « 122,9k »,
 * « 1,2M » — dès 1 000, au plus une décimale (zéro final retiré), séparateur de la langue, sans
 * espace avant l'unité.
 */
export function formatTokens(n: number, compact = false): string {
  if (!compact || Math.abs(n) < 1000) return numberFormat().format(n)
  const short = (value: number, unit: string) =>
    `${numberFormat({ maximumFractionDigits: 1 }).format(value)}${unit}`
  // Arrondi à une décimale : 999 960 s'écrit « 1M », pas « 1 000k ».
  const thousands = Math.round(n / 100) / 10
  if (Math.abs(thousands) < 1000) return short(thousands, 'k')
  return short(Math.round(n / 100_000) / 10, 'M')
}

/**
 * Nom affiché d'une unité libre (fiche 144) : avec une majuscule, comme un nom de monnaie
 * (« Bobcoins ») ; la valeur (`bobcoins`) reste telle quelle dans les données, le journal et le
 * CSV. Une devise ISO 4217 reste son code.
 */
export const unitLabel = (currency: string): string =>
  isCurrencyCode(currency) ? currency : currency.charAt(0).toUpperCase() + currency.slice(1)

/** Coût dans sa devise : ISO 4217 via `Intl` (« 0,13 $US »), sinon « 12,5 Bobcoins ». */
export function formatCost(cost: { amount: number; currency: string }): string {
  if (isCurrencyCode(cost.currency)) {
    try {
      return numberFormat({
        style: 'currency',
        currency: cost.currency,
        maximumFractionDigits: cost.amount !== 0 && Math.abs(cost.amount) < 1 ? 4 : 2
      }).format(cost.amount)
    } catch {
      // Code de devise inconnu d'Intl : affichage brut ci-dessous.
    }
  }
  const amount = numberFormat({ maximumFractionDigits: 4 }).format(cost.amount)
  return `${amount} ${unitLabel(cost.currency)}`
}

/**
 * Dépense récente avec un agent sur ce Mac, toutes conversations confondues, pour les agents dont le
 * profil sait la lire (Bob : sa base locale, en bobcoins). Une conversation utilisée dans la période
 * compte en entier.
 */
export interface AgentSpend {
  currency: string
  today: number
  week: number
  month: number
}

/**
 * Quota d'un agent (fiche 091) : plafond et consommation selon son serveur, toutes machines
 * confondues, pour les agents dont le profil sait le lire (Bob : sa commande `/status`).
 */
export interface AgentQuota {
  profileId: string
  profileLabel: string
  currency: string
  /** Plafond ; `null` : illimité. */
  limit: number | null
  used: number
  /** Heure de la lecture (ms). */
  readAt: number
}

/** Seuils des jauges (contexte, quota), comme l'alerte de contexte de Claude Code. */
export const USAGE_WARN = 0.8
export const USAGE_FULL = 0.95

/** Niveau d'une jauge remplie à `ratio` : classe CSS `warn` ou `full`, sinon rien. */
export function usageLevel(ratio: number): 'warn' | 'full' | undefined {
  return ratio >= USAGE_FULL ? 'full' : ratio >= USAGE_WARN ? 'warn' : undefined
}

/** Part consommée du quota (0 à 1, au-delà si dépassé) ; `undefined` sans plafond. */
export function quotaRatio(quota: Pick<AgentQuota, 'limit' | 'used'>): number | undefined {
  if (quota.limit === null || quota.limit <= 0) return undefined
  return quota.used / quota.limit
}
