/**
 * Suivi de la PR et de la CI (fiche 176) : relève `gh pr view` de la branche d'une conversation en
 * worktree, à une cadence qui s'espace quand rien ne bouge, s'arrête quand la PR est fusionnée ou
 * fermée, et se met en veille quand l'app reste en arrière-plan. L'état est poussé au renderer par
 * `emit`. « Corriger les contrôles en échec » envoie à l'agent la consigne de `shared/pr-tracking`
 * avec un extrait des journaux ; d'office seulement si l'utilisateur l'a coché, comme la fusion.
 */
import { t } from 'i18next'
import { messageOf } from '@shared/errors'
import {
  BACKGROUND_MS,
  BACKGROUND_STOP_MS,
  CHECKS_GRACE_MS,
  FAST_WINDOW_MS,
  PR_VIEW_FIELDS,
  RULES_UNAVAILABLE,
  branchRequiredChecks,
  checksKey,
  mergeNowBlocker,
  noCiDetected,
  rulesRequiredChecks,
  fixChecksPrompt,
  logExcerpt,
  nextDelay,
  pickMergeMethod,
  parsePrView,
  prFingerprint,
  readyToMerge,
  type CiState,
  type MergeMethod,
  type PrCheck,
  type PrEvent,
  type PrOptions,
  type PrTrack,
  type PrView
} from '@shared/pr-tracking'
import type { Run } from '../simulator/run'
import { gitErrorLine } from './git-errors'

/** Ce que le suivi sait d'une conversation : où lancer `gh`, et la branche de la PR. */
export interface PrWatchTarget {
  id: string
  cwd: string
  branch: string
}

export interface PrWatcherOptions {
  run: Run
  /** Conversation en worktree, ou `undefined` (supprimée, nettoyée, hors worktree). */
  targetOf: (id: string) => PrWatchTarget | undefined
  /** Chemin de `gh` s'il est installé, connecté, et qu'il y a un dépôt distant ; sinon rien. */
  ghFor: (id: string) => Promise<string | undefined>
  emit: (id: string, track: PrTrack) => void
  /** Message à l'agent de la conversation (`ConversationManager.prompt`). */
  prompt: (id: string, text: string) => Promise<void>
  /**
   * Indice local : la branche a-t-elle un workflow GitHub (`.github/workflows`) ? Lu seulement
   * quand la PR n'a aucun contrôle. Absent : un workflow est supposé (jamais « pas de CI »).
   */
  workflows?: (id: string) => Promise<boolean>
  /**
   * Date d'un commit du worktree (ms), pour un commit en tête vu sans push de l'app ; `undefined`
   * si inconnu ici. Absent : le commit est daté de sa première relève.
   */
  commitDate?: (id: string, commit: string) => Promise<number | undefined>
  log?: (id: string | undefined, line: string) => void
}

/** Corrections d'office au plus, par conversation (une par commit en tête de la PR). */
export const AUTO_FIX_MAX = 3
/** Journaux lus au plus pour une correction (un appel à GitHub chacun). */
const LOGS_MAX = 5
/** Sans PR, `status` relit au plus toutes les minutes (l'agent a pu en ouvrir une). */
const NONE_TTL_MS = 60_000
/** Règles de la base illisibles (réseau, quota, 5xx) : relues au plus toutes les 2 minutes. */
export const RULES_RETRY_MS = 2 * 60_000
/** `UNKNOWN` depuis ce délai : GitHub ne dit pas si la PR est fusionnable, et la carte le dit. */
export const MERGEABILITY_GRACE_MS = 10 * 60_000

interface Watch {
  track?: PrTrack
  options: PrOptions
  delay?: number
  fingerprint?: string
  timer?: ReturnType<typeof setTimeout>
  /** En veille : arrière-plan depuis plus de 30 min ; repris au premier plan. */
  paused?: boolean
  inflight?: Promise<PrTrack>
  /** Commits en tête pour lesquels une correction est partie (clic ou d'office). */
  fixedHeads: Set<string>
  autoFixes: number
  /** Commit en tête pour lequel la fusion d'office a été tentée, et l'état de ses contrôles. */
  mergeTried?: string
  mergeTriedKey?: string
  /** Fusion d'office ratée : une seule nouvelle tentative quand les contrôles changent. */
  mergeRetried?: boolean
  /** Depuis quand GitHub dit `UNKNOWN` pour la fusion de cette PR (sans interruption). */
  unknownSince?: number
  /** Suivi oublié (conversation nettoyée, supprimée) : plus de minuteur ni d'évènement. */
  disposed?: boolean
  /** Méthode de fusion permise par le dépôt ; `null` : aucune ; absente : pas encore lue. */
  mergeMethod?: MergeMethod | null
  /**
   * Commit en tête et depuis quand il est là : les contrôles sont attendus à partir de là. Vu
   * pour la première fois sans push de l'app (redémarrage), `at` vient de la date du commit.
   */
  headSeen?: { head: string; at: number; dated?: boolean }
  /** Relève rapprochée jusqu'à cette heure (après un push). */
  fastUntil?: number
  /** `checksKey` de la PR quand la note de la carte a été posée (0.9.1, D17). */
  eventKey?: string
  /** Contrôles requis par les règles de la base, lus une fois (une lecture réussie). */
  required?: { base: string; names: string[] }
  /** Dernière lecture ratée des règles : relue après {@link RULES_RETRY_MS}, ou sur « Actualiser ». */
  requiredFailedAt?: number
}

const DEFAULT_OPTIONS: PrOptions = { autoFix: false, autoMerge: false }

export class PrWatcher {
  private readonly watches = new Map<string, Watch>()
  private readonly deps: PrWatcherOptions
  private focused = true
  private blurredAt: number | undefined

  constructor(deps: PrWatcherOptions) {
    this.deps = deps
  }

  private watch(id: string): Watch {
    let found = this.watches.get(id)
    if (!found) {
      found = { options: { ...DEFAULT_OPTIONS }, fixedHeads: new Set(), autoFixes: 0 }
      this.watches.set(id, found)
    }
    return found
  }

  /** État connu ; relu s'il n'y en a pas, ou s'il n'y avait pas de PR il y a plus d'une minute. */
  async status(id: string): Promise<PrTrack> {
    const known = this.watches.get(id)?.track
    if (known && known.status !== 'unavailable') {
      if (known.status !== 'none' || Date.now() - known.checkedAt < NONE_TTL_MS) return known
    }
    return this.refresh(id)
  }

  /** « Actualiser » : relit tout, y compris des règles de la base qui n'avaient pu être lues. */
  refreshNow(id: string): Promise<PrTrack> {
    delete this.watch(id).requiredFailedAt
    return this.refresh(id)
  }

  /** Relit tout de suite (après « Ouvrir une PR », minuteur) et replanifie. */
  refresh(id: string): Promise<PrTrack> {
    const watch = this.watch(id)
    if (watch.inflight) return watch.inflight
    if (watch.timer) clearTimeout(watch.timer)
    delete watch.timer
    watch.paused = false
    const done = this.fetch(id, watch).finally(() => delete watch.inflight)
    watch.inflight = done
    return done
  }

  /**
   * La branche vient d'être poussée (« Ouvrir une PR », « Pousser vers la PR ») : relève toutes
   * les 10 s pendant deux minutes, le temps que GitHub inscrive les contrôles (0.9.1, D16).
   */
  pushed(id: string): Promise<PrTrack> {
    this.watch(id).fastUntil = Date.now() + FAST_WINDOW_MS
    return this.refresh(id)
  }

  /**
   * PR de la conversation fusionnée : son dernier commit, que la branche distante doit encore
   * porter pour être supprimée par « Nettoyer » (0.9.1, D19) ; sinon `undefined`.
   */
  mergedHead(id: string): string | undefined {
    const track = this.watches.get(id)?.track
    return track?.status === 'found' && track.pr.state === 'merged' && track.pr.head
      ? track.pr.head
      : undefined
  }

  /**
   * « Fusionner maintenant » : seulement sans CI détectée, sur un clic ; refusé avec la raison
   * sinon (brouillon, conflit, règles de la branche…). GitHub garde le dernier mot.
   */
  async mergeNow(id: string): Promise<PrTrack> {
    const watch = this.watch(id)
    // Relue d'abord : la carte a pu être relevée il y a 10 min, et l'agent a pu pousser depuis (un
    // commit jamais vu, peut-être avec une CI). La fusion est ensuite épinglée sur ce commit.
    const track = await this.refresh(id)
    // Relecture ratée (réseau, `gh`) : son erreur, pas une raison de fusion inventée.
    if (track.status === 'error') throw new Error(track.message)
    if (track.status !== 'found') throw new Error(t('prTrack.wait.mergeability'))
    if (track.pr.state === 'merged') return track
    const blocker = mergeNowBlocker(track.pr, track.ci)
    if (blocker) throw new Error(t(`prTrack.wait.${blocker}`, { base: track.pr.base }))
    await this.merge(id, watch, track.pr, true)
    return watch.track ?? track
  }

  /** Choix de la carte ; appliqués tout de suite (une PR déjà verte est fusionnée). */
  async setOptions(id: string, options: Partial<PrOptions>): Promise<PrTrack> {
    const watch = this.watch(id)
    watch.options = { ...watch.options, ...options }
    if (options.autoFix) watch.autoFixes = 0
    // La carte dit d'avance comment la PR sera fusionnée : la méthode est lue une fois.
    if (options.autoMerge) await this.mergeMethod(id, watch)
    const track = watch.track
    if (!track || track.status === 'none' || track.status === 'unavailable') return this.refresh(id)
    const next = { ...track, options: { ...watch.options }, ...this.methodOf(watch) }
    this.publish(id, watch, next)
    if (next.status === 'found') await this.automatic(id, watch, next.pr)
    return watch.track ?? next
  }

  /** Arrêt du suivi d'une conversation (supprimée, nettoyée). */
  forget(id: string): void {
    const watch = this.watches.get(id)
    if (watch) {
      watch.disposed = true
      if (watch.timer) clearTimeout(watch.timer)
      delete watch.timer
    }
    this.watches.delete(id)
  }

  /** Une fenêtre de l'app passe au premier plan, ou aucune ne l'est plus. */
  setFocused(focused: boolean): void {
    if (focused === this.focused) return
    this.focused = focused
    if (!focused) {
      this.blurredAt = Date.now()
      return
    }
    delete this.blurredAt
    // Retour au premier plan : ce qui dormait est relu à sa cadence normale, pas à celle du fond.
    for (const [id, watch] of this.watches) {
      const track = watch.track
      if (!track || track.status !== 'found' || track.pr.state !== 'open') continue
      const due = Math.max(0, (watch.delay ?? 0) - (Date.now() - track.checkedAt))
      if (watch.paused || due === 0) void this.refresh(id)
      else this.schedule(id, watch, due)
    }
  }

  private schedule(id: string, watch: Watch, delay: number): void {
    if (watch.timer) clearTimeout(watch.timer)
    if (watch.disposed) return
    let wait = delay
    if (!this.focused) {
      const away = Date.now() - (this.blurredAt ?? Date.now())
      if (away >= BACKGROUND_STOP_MS) {
        watch.paused = true
        delete watch.timer
        return
      }
      wait = Math.max(wait, BACKGROUND_MS)
    }
    watch.timer = setTimeout(() => void this.refresh(id), wait)
    watch.timer.unref?.()
  }

  private async fetch(id: string, watch: Watch): Promise<PrTrack> {
    const target = this.deps.targetOf(id)
    const gh = target ? await this.deps.ghFor(id) : undefined
    if (!target || !gh) {
      // Pas de worktree, pas de `gh` ou pas de dépôt distant : rien à suivre, aucun appel.
      this.forget(id)
      return { status: 'unavailable' }
    }
    const result = await this.deps.run(
      gh,
      ['pr', 'view', target.branch, '--json', PR_VIEW_FIELDS],
      { cwd: target.cwd, timeoutMs: 30_000 }
    )
    this.deps.log?.(id, `gh pr view ${target.branch} → ${result.code}`)
    // Oublié pendant la lecture (conversation nettoyée) : rien à publier, rien à replanifier.
    if (watch.disposed) return { status: 'unavailable' }
    const checkedAt = Date.now()
    const options = { ...watch.options }
    let track: PrTrack
    if (result.code !== 0) {
      if (/no (open )?pull requests? found/i.test(result.stderr)) {
        track = { status: 'none', checkedAt }
      } else {
        track = {
          status: 'error',
          message: gitErrorLine(result.stderr) || `gh exited with ${result.code}`,
          checkedAt,
          options
        }
        watch.delay = nextDelay(watch.delay, false, false)
        this.schedule(id, watch, watch.delay)
      }
      return this.publish(id, watch, track)
    }
    let pr: PrView
    try {
      pr = parsePrView(result.stdout.toString('utf8'))
    } catch (error) {
      watch.delay = nextDelay(watch.delay, false, false)
      this.schedule(id, watch, watch.delay)
      return this.publish(id, watch, {
        status: 'error',
        message: messageOf(error),
        checkedAt,
        options
      })
    }
    const fingerprint = prFingerprint(pr)
    const changed = watch.fingerprint !== undefined && watch.fingerprint !== fingerprint
    watch.fingerprint = fingerprint
    if (watch.headSeen?.head !== pr.head) {
      // Nouveau commit en tête (poussé par l'agent ou ailleurs) : les contrôles vont arriver.
      // Vu pour la première fois hors d'un push de l'app (redémarrage) : daté par son commit.
      const pushedHere = (watch.fastUntil ?? 0) > checkedAt
      if (watch.headSeen) watch.fastUntil = checkedAt + FAST_WINDOW_MS
      watch.headSeen = {
        head: pr.head,
        at: checkedAt,
        ...(watch.headSeen || pushedHere ? { dated: true } : {})
      }
    }
    const noChecks =
      pr.checks.length === 0 ? await this.ciState(id, watch, pr, gh, target, checkedAt) : undefined
    if (watch.disposed) return { status: 'unavailable' }
    const ci = noChecks?.ci
    // GitHub qui ne dit jamais si la PR est fusionnable (vieux GHES, calcul sans fin) : la fusion
    // d'office reste refusée, mais la carte finit par le dire.
    if (pr.state === 'open' && pr.mergeState === 'unknown') watch.unknownSince ??= checkedAt
    else delete watch.unknownSince
    const unreported =
      watch.unknownSince !== undefined && checkedAt - watch.unknownSince >= MERGEABILITY_GRACE_MS
    const previous = watch.track
    const event =
      previous?.status === 'found' ? this.keptEvent(watch, previous.event, pr) : undefined
    track = {
      status: 'found',
      pr,
      checkedAt,
      options,
      ...(event ? { event } : {}),
      ...this.methodOf(watch),
      ...(ci ? { ci } : {}),
      ...(noChecks?.rulesUnreadable ? { rulesUnreadable: true as const } : {}),
      ...(unreported ? { mergeabilityUnreported: true as const } : {})
    }
    if (pr.state === 'open') {
      const fast = (watch.fastUntil ?? 0) > checkedAt
      const waiting = pr.summary === 'pending' || ci === 'awaited'
      watch.delay = nextDelay(watch.delay, waiting, changed, fast)
      this.schedule(id, watch, watch.delay)
    }
    this.publish(id, watch, track)
    await this.automatic(id, watch, pr)
    return watch.track ?? track
  }

  /**
   * Une note (correction envoyée, fusion ratée) vaut pour un état des contrôles ; la fusion faite
   * reste dite (0.9.1, D17). Une fusion d'office ratée reste dite tant que le commit en tête est
   * celui qu'elle visait : la case cochée ne reste jamais muette (remarque 3).
   */
  private keptEvent(watch: Watch, event: PrEvent | undefined, pr: PrView): PrEvent | undefined {
    if (!event) return undefined
    if (event.kind === 'merged') return event
    if (event.kind === 'merge-failed' && watch.mergeTried === pr.head) return event
    return watch.eventKey === checksKey(pr) ? event : undefined
  }

  /** Aucun contrôle : pas de CI détectée, contrôles attendus, ou toujours rien après 5 min. */
  private async ciState(
    id: string,
    watch: Watch,
    pr: PrView,
    gh: string,
    target: PrWatchTarget,
    now: number
  ): Promise<{ ci: CiState; rulesUnreadable?: true }> {
    const workflows = this.deps.workflows ? await this.deps.workflows(id) : true
    const required = workflows ? [] : await this.requiredChecks(id, watch, pr.base, gh, target)
    if (noCiDetected(pr, { workflows, required })) return { ci: 'none' }
    const since = await this.headSince(id, watch, now)
    return {
      ci: now - since < CHECKS_GRACE_MS ? 'awaited' : 'silent',
      ...(required === undefined ? { rulesUnreadable: true as const } : {})
    }
  }

  /**
   * Depuis quand le commit en tête attend ses contrôles. Vu pour la première fois sans push de
   * l'app (redémarrage, PR ancienne) : la date du commit (`git show`), pas l'heure de la relève,
   * sinon une vieille PR sans contrôle passerait 5 min pour « en attente » (remarque 6).
   */
  private async headSince(id: string, watch: Watch, now: number): Promise<number> {
    const seen = watch.headSeen
    if (!seen) return now
    if (seen.dated || !this.deps.commitDate) return seen.at
    const date = await this.deps.commitDate(id, seen.head)
    // Commit inconnu ici : tenu pour ancien (rien n'est « en attente » sans raison de l'être).
    seen.at = date !== undefined ? Math.min(seen.at, date) : 0
    seen.dated = true
    return seen.at
  }

  /**
   * Contrôles requis par la base : protection classique et rulesets (`gh api`, lecture seule),
   * lus une fois par base. `undefined` si l'une des deux lectures rate : une CI est alors supposée.
   */
  private async requiredChecks(
    id: string,
    watch: Watch,
    base: string,
    gh: string,
    target: PrWatchTarget
  ): Promise<string[] | undefined> {
    if (watch.required?.base === base) return watch.required.names
    // Lecture ratée il y a peu : une CI est supposée, sans relancer GitHub à chaque relève.
    if (
      watch.requiredFailedAt !== undefined &&
      Date.now() - watch.requiredFailedAt < RULES_RETRY_MS
    ) {
      return undefined
    }
    const branch = encodeURIComponent(base)
    const api = async (path: string) => {
      const result = await this.deps.run(gh, ['api', path], { cwd: target.cwd, timeoutMs: 30_000 })
      this.deps.log?.(id, `gh api ${path} → ${result.code}`)
      return result
    }
    let names: string[] | undefined
    if (base) {
      const protection = await api(`repos/{owner}/{repo}/branches/${branch}`)
      const rules = await api(`repos/{owner}/{repo}/rules/branches/${branch}`)
      const fromBranch =
        protection.code === 0 ? branchRequiredChecks(protection.stdout.toString('utf8')) : undefined
      const fromRules =
        rules.code === 0
          ? rulesRequiredChecks(rules.stdout.toString('utf8'))
          : RULES_UNAVAILABLE.test(`${rules.stderr}${rules.stdout.toString('utf8')}`)
            ? []
            : undefined
      names = fromBranch && fromRules ? [...new Set([...fromBranch, ...fromRules])] : undefined
    }
    // Seule une lecture réussie est gardée ; un échec (délai, quota, 5xx, GHES) est relu plus tard.
    if (names) {
      watch.required = { base, names }
      delete watch.requiredFailedAt
    } else watch.requiredFailedAt = Date.now()
    return names
  }

  private publish(id: string, watch: Watch, track: PrTrack): PrTrack {
    if (watch.disposed) return track
    watch.track = track
    this.deps.emit(id, track)
    return track
  }

  /** Correction et fusion d'office, seulement si l'utilisateur les a cochées. */
  private async automatic(id: string, watch: Watch, pr: PrView): Promise<void> {
    if (pr.state !== 'open') return
    const { autoFix, autoMerge } = watch.options
    if (
      autoFix &&
      pr.summary === 'failed' &&
      !watch.fixedHeads.has(pr.head) &&
      watch.autoFixes < AUTO_FIX_MAX
    ) {
      watch.autoFixes++
      await this.sendFix(id, watch, pr, true)
      return
    }
    if (!autoMerge || !readyToMerge(pr)) return
    const key = checksKey(pr)
    if (watch.mergeTried !== pr.head) {
      watch.mergeTried = pr.head
      watch.mergeTriedKey = key
      watch.mergeRetried = false
      await this.merge(id, watch, pr)
      return
    }
    // Même commit, fusion ratée, contrôles changés depuis (relance d'un contrôle instable) :
    // une seule nouvelle tentative (remarque 3).
    const failed = watch.track?.status === 'found' && watch.track.event?.kind === 'merge-failed'
    if (failed && !watch.mergeRetried && watch.mergeTriedKey !== key) {
      watch.mergeRetried = true
      watch.mergeTriedKey = key
      await this.merge(id, watch, pr)
    }
  }

  /** « Corriger les contrôles en échec » : consigne et extraits des journaux, à l'agent. */
  async fixChecks(id: string): Promise<PrTrack> {
    const watch = this.watch(id)
    const track = watch.track
    if (track?.status !== 'found' || track.pr.summary !== 'failed') {
      throw new Error('no failed check to fix')
    }
    await this.sendFix(id, watch, track.pr, false)
    return watch.track ?? track
  }

  private async sendFix(id: string, watch: Watch, pr: PrView, auto: boolean): Promise<void> {
    const target = this.deps.targetOf(id)
    const gh = target ? await this.deps.ghFor(id) : undefined
    if (!target || !gh) return
    const failed = pr.checks.filter((c) => c.state === 'failed')
    const withLogs: (PrCheck & { log?: string })[] = []
    for (const [index, check] of failed.entries()) {
      if (!check.jobId || index >= LOGS_MAX) {
        withLogs.push(check)
        continue
      }
      const log = await this.deps.run(gh, ['run', 'view', '--job', check.jobId, '--log-failed'], {
        cwd: target.cwd,
        timeoutMs: 60_000
      })
      this.deps.log?.(id, `gh run view --job ${check.jobId} --log-failed → ${log.code}`)
      const excerpt = log.code === 0 ? logExcerpt(log.stdout.toString('utf8')) : ''
      withLogs.push(excerpt ? { ...check, log: excerpt } : check)
    }
    watch.fixedHeads.add(pr.head)
    // Le tour de l'agent n'est pas attendu : la carte dit tout de suite que la consigne est partie,
    // puis l'échec de l'envoi s'il arrive (agent arrêté, refus…).
    this.event(id, watch, { kind: 'fix-sent', auto, count: failed.length })
    this.deps.prompt(id, fixChecksPrompt(pr, target.branch, withLogs)).catch((error: unknown) => {
      this.deps.log?.(id, `fix checks prompt failed: ${messageOf(error)}`)
      this.event(id, watch, { kind: 'fix-failed', message: messageOf(error) })
    })
  }

  /** Méthode de fusion pour la carte, si elle est connue. */
  private methodOf(watch: Watch): { mergeMethod?: MergeMethod } {
    return watch.mergeMethod ? { mergeMethod: watch.mergeMethod } : {}
  }

  /**
   * Méthode de fusion permise par le dépôt (`gh repo view`), lue une fois par conversation :
   * commit de fusion, sinon squash, sinon rebase (un dépôt peut n'en permettre qu'une).
   */
  private async mergeMethod(id: string, watch: Watch): Promise<MergeMethod | undefined> {
    if (watch.mergeMethod !== undefined) return watch.mergeMethod ?? undefined
    const target = this.deps.targetOf(id)
    const gh = target ? await this.deps.ghFor(id) : undefined
    if (!target || !gh) return undefined
    const result = await this.deps.run(
      gh,
      ['repo', 'view', '--json', 'mergeCommitAllowed,squashMergeAllowed,rebaseMergeAllowed'],
      { cwd: target.cwd, timeoutMs: 30_000 }
    )
    this.deps.log?.(id, `gh repo view (merge methods) → ${result.code}`)
    // Lecture ratée (réseau) : relue la prochaine fois.
    if (result.code !== 0) return undefined
    watch.mergeMethod = pickMergeMethod(result.stdout.toString('utf8')) ?? null
    return watch.mergeMethod ?? undefined
  }

  /** `noCi` : « Fusionner maintenant », sans CI détectée ; la note ne dit pas « tout était vert ». */
  private async merge(id: string, watch: Watch, pr: PrView, noCi = false): Promise<void> {
    const target = this.deps.targetOf(id)
    const gh = target ? await this.deps.ghFor(id) : undefined
    if (!target || !gh) return
    const method = await this.mergeMethod(id, watch)
    if (!method) {
      this.event(id, watch, { kind: 'merge-failed', message: t('prTrack.event.noMergeMethod') })
      return
    }
    // Épinglée sur le commit vu : si la branche a bougé depuis, GitHub refuse (remarque 1).
    const result = await this.deps.run(
      gh,
      ['pr', 'merge', String(pr.number), `--${method}`, '--match-head-commit', pr.head],
      { cwd: target.cwd, timeoutMs: 60_000 }
    )
    this.deps.log?.(id, `gh pr merge ${pr.number} --${method} → ${result.code}`)
    if (result.code !== 0) {
      this.event(id, watch, {
        kind: 'merge-failed',
        message: gitErrorLine(result.stderr) || `gh exited with ${result.code}`
      })
      return
    }
    this.event(id, watch, { kind: 'merged', method, ...(noCi ? { noCi: true as const } : {}) })
    // Relue hors de la relève en cours : l'état « fusionnée » arrête le suivi.
    setTimeout(() => void this.refresh(id), 0).unref?.()
  }

  private event(id: string, watch: Watch, event: PrEvent): void {
    const track = watch.track
    if (track?.status !== 'found') return
    watch.eventKey = checksKey(track.pr)
    this.publish(id, watch, { ...track, event, ...this.methodOf(watch) })
  }
}
