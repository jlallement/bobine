/**
 * `pnpm pilote attendre` : quand faut-il rendre la main à l'humain ? Pur, testé
 * (`raison.test.ts`) : on lui passe les lectures successives de l'écran, il dit la raison de
 * s'arrêter, ou rien.
 *
 * Codes stables (premier mot de la sortie, et code de sortie) :
 * - `tour-fini` (0) : plus rien ne tourne depuis `settle` (le tour est fini, ou rien n'a commencé) ;
 * - `carte` (10) : une carte attend une décision (autorisation, plan, propositions), ici ou dans une
 *   autre conversation (barre latérale) ;
 * - `question` (11) : l'agent pose une question (choix, formulaire) ;
 * - `blocage` (12) : connexion, dossier, licence à régler, agent qui demande une action, commande
 *   sans sortie, agent silencieux, plafond de coût atteint, limite d'étapes de l'agent ;
 * - `erreur` (13) : nouvelle erreur ou nouveau bandeau, agent planté ;
 * - `accueil` (14) : l'accueil du premier lancement attend l'utilisateur ;
 * - `calme` (15) : un tour tourne mais rien ne bouge à l'écran depuis `calme` ;
 * - `delai` (16) : `max` atteint.
 */

export const EXIT_CODES = {
  'tour-fini': 0,
  carte: 10,
  question: 11,
  blocage: 12,
  erreur: 13,
  accueil: 14,
  calme: 15,
  delai: 16
}

/** Avis qui demandent une décision plutôt qu'ils ne signalent une erreur. */
const BLOCKING_ALERTS = new Set(['silence', 'bloque', 'plafond', 'relance', 'limite'])

/** Quelque chose tourne : tour en cours, agent qui démarre, message en file, accueil qui attend. */
export const busy = (shot) =>
  !!shot.working ||
  ['busy', 'starting'].includes(shot.agent?.dot) ||
  (shot.queued ?? 0) > 0 ||
  !!shot.onboarding?.waiting

/**
 * Ce qui bouge à l'écran pendant un tour, sans l'horloge du tour (elle avance toute seule) : texte
 * de l'agent, outils et leurs états, activité, cartes, messages, panneau, conversations.
 */
export function progressKey(shot) {
  return JSON.stringify([
    shot.messages,
    shot.lastAgent?.length ?? 0,
    (shot.tools?.items ?? []).map((t) => t.status),
    shot.tools?.grouped ?? 0,
    shot.working?.label ?? '',
    shot.working?.activity ?? '',
    (shot.cards ?? []).length,
    shot.panel?.running ?? '',
    (shot.sidebar ?? []).map((c) => c.code),
    shot.onboarding?.title ?? '',
    shot.onboarding?.text?.length ?? 0
  ])
}

const alertKeys = (shot) => new Set((shot.alerts ?? []).map((a) => `${a.kind}:${a.text}`))

/**
 * Raison immédiate, d'après l'écran seul et l'écran du départ : ce qui attend l'humain maintenant.
 * Priorité : erreur, blocage, question, carte, accueil.
 */
export function pendingReason(shot, start) {
  const known = alertKeys(start ?? {})
  const fresh = (shot.alerts ?? []).filter((a) => !known.has(`${a.kind}:${a.text}`))
  if (shot.agent?.dot === 'error' || fresh.some((a) => !BLOCKING_ALERTS.has(a.kind))) {
    const alert = fresh.find((a) => !BLOCKING_ALERTS.has(a.kind))
    return { code: 'erreur', detail: alert ? `${alert.kind} : ${alert.text}` : shot.agent?.status }
  }
  const blocking = (shot.alerts ?? []).find((a) => BLOCKING_ALERTS.has(a.kind))
  if (shot.blockers?.length) return { code: 'blocage', detail: shot.blockers[0].id }
  if (blocking) return { code: 'blocage', detail: `${blocking.kind} : ${blocking.text}` }
  const question = (shot.cards ?? []).find((c) => c.type === 'question')
  if (question || shot.questions) {
    return { code: 'question', detail: question?.question || question?.title || '' }
  }
  const card = (shot.cards ?? [])[0]
  if (card) return { code: 'carte', detail: card.title }
  // Une autre conversation attend une réponse (fille, conversation à côté).
  const elsewhere = (shot.sidebar ?? []).find((c) => !c.active && c.code === 'waiting')
  const before = new Set(
    (start?.sidebar ?? []).filter((c) => c.code === 'waiting').map((c) => c.title)
  )
  if (elsewhere && !before.has(elsewhere.title)) {
    return { code: 'carte', detail: `dans « ${elsewhere.title} » (${elsewhere.state})` }
  }
  if (shot.agent?.dot === 'needs-action' && !shot.onboarding) {
    return { code: 'blocage', detail: shot.agent.status }
  }
  return undefined
}

/**
 * Suit les lectures d'une attente. `observe(shot, now)` renvoie `{ code, detail }` quand il faut
 * s'arrêter. `settle` : durée d'écran calme et rien en cours avant de dire `tour-fini` (le temps
 * qu'un message envoyé par computer use démarre son tour).
 */
export class Watcher {
  constructor({ max, calme, settle = 3000, now = Date.now() }) {
    Object.assign(this, { max, calme, settle, startedAt: now })
    this.start = undefined
    this.key = undefined
    this.changedAt = now
    this.idleSince = undefined
    this.sawBusy = false
    this.busySince = undefined
  }

  observe(shot, now = Date.now()) {
    this.start ??= shot
    const key = progressKey(shot)
    if (key !== this.key) {
      this.key = key
      this.changedAt = now
    }
    const pending = pendingReason(shot, this.start)
    if (pending) return pending
    if (shot.onboarding) {
      const was = this.start.onboarding
      if (!was || was.title !== shot.onboarding.title || was.step !== shot.onboarding.step) {
        return { code: 'accueil', detail: shot.onboarding.title }
      }
    }
    if (busy(shot)) {
      this.sawBusy = true
      this.busySince ??= now
      this.idleSince = undefined
      if (this.calme && now - this.changedAt >= this.calme) {
        return { code: 'calme', detail: shot.working?.label ?? '' }
      }
    } else {
      this.idleSince ??= now
      if (now - this.idleSince >= this.settle) {
        if (shot.onboarding) return { code: 'accueil', detail: shot.onboarding.title }
        return { code: 'tour-fini', detail: shot.turnSummary ?? '' }
      }
    }
    if (this.max && now - this.startedAt >= this.max) return { code: 'delai', detail: '' }
    return undefined
  }
}

/** Durée affichée par Bobine (« 44 s », « 2 min 05 s », « 1 h 02 min », « 3m 5s ») en ms. */
export function parseShownDuration(text) {
  if (!text) return null
  const units = { h: 3_600_000, min: 60_000, m: 60_000, s: 1000 }
  let total = 0
  let found = false
  for (const [, n, unit] of String(text).matchAll(/(\d+(?:[.,]\d+)?)\s*(h|min|m|s)\b/g)) {
    total += Number(n.replace(',', '.')) * units[unit]
    found = true
  }
  return found ? Math.round(total) : null
}
