/**
 * Avis de nouvelle version (fiche 274, ADR-0066) : quand vérifier, ce qu'on garde dans le profil,
 * ce qu'on montre. Sans Electron : la requête, le fichier, l'heure et le navigateur sont injectés
 * (`update-check-electron.ts` les branche). Rien ne s'installe ; une vérification automatique qui
 * échoue ne montre rien (une ligne au journal).
 */
import {
  CHECK_INTERVAL_MS,
  compareStrict,
  isReleasePageUrl,
  parseStrictVersion,
  pickUpdate,
  type UpdateFailure,
  type UpdateRelease,
  type UpdateView
} from '@shared/update-check'

/** Réponse de la requête : le JSON lu, ou la raison de l'échec. */
export type FetchOutcome = { ok: true; json: unknown } | { ok: false; failure: UpdateFailure }

/** Ce qui est gardé dans `update-check.json` du profil. */
export interface UpdateState {
  lastCheckedAt?: string
  available?: UpdateRelease
  dismissed?: string
}

export interface UpdateCheckerDeps {
  /** Version installée (`app.getVersion()`). */
  version: string
  fetchReleases: () => Promise<FetchOutcome>
  load: () => UpdateState
  /** Écrit l'état ; sans effet (et sans erreur) en lecture seule. */
  save: (state: UpdateState) => void
  /** Réglage « Vérifier les nouvelles versions ». */
  enabled: () => boolean
  /** Vérification automatique coupée pour les essais (`BOBINE_UPDATE_CHECK=off`). */
  autoOff: boolean
  /** Profil en lecture seule (fiche 196) : pas de vérification automatique, rien d'écrit. */
  readOnly: () => boolean
  openExternal: (url: string) => void
  now: () => number
  log: (message: string) => void
  /** L'état affiché a changé (renvoyé aux fenêtres). */
  changed: (view: UpdateView) => void
}

export interface UpdateChecker {
  view: () => UpdateView
  /** Au lancement : vérifie si c'est permis et si la dernière réussite date de plus de 24 h. */
  checkOnLaunch: () => Promise<void>
  /** « Vérifier maintenant » : toujours, même réglage coupé. */
  checkNow: () => Promise<UpdateView>
  /** « Plus tard » ou ✕ : plus d'avis pour cette version. */
  dismiss: (version: string) => void
  /** « Voir » : ouvre la page vérifiée de la version connue, et masque l'avis. */
  open: (version: string) => void
  /** Le réglage a pu changer : l'état affiché est renvoyé. */
  settingsChanged: () => void
}

/** État relu du profil : ce qui ne tient pas est ignoré (jamais d'erreur). */
export function sanitizeState(raw: unknown, installed: string): UpdateState {
  if (typeof raw !== 'object' || raw === null) return {}
  const r = raw as Record<string, unknown>
  const state: UpdateState = {}
  if (typeof r['lastCheckedAt'] === 'string' && !Number.isNaN(Date.parse(r['lastCheckedAt']))) {
    state.lastCheckedAt = r['lastCheckedAt']
  }
  if (typeof r['dismissed'] === 'string' && parseStrictVersion(r['dismissed'])) {
    state.dismissed = r['dismissed']
  }
  const available = r['available'] as Record<string, unknown> | undefined
  const version = parseStrictVersion(available?.['version'])
  const current = parseStrictVersion(installed)
  if (
    available &&
    version &&
    current &&
    compareStrict(version, current) > 0 &&
    typeof available['prerelease'] === 'boolean' &&
    // L'adresse gardée est revérifiée : seule une page d'une Release du dépôt s'ouvre.
    isReleasePageUrl(available['url'], tagOf(available['url']))
  ) {
    state.available = {
      version: available['version'] as string,
      prerelease: available['prerelease'],
      url: available['url'] as string
    }
  }
  return state
}

/** Étiquette en fin d'adresse de page (`…/releases/tag/v1.0.1` → `v1.0.1`). */
function tagOf(url: unknown): string {
  if (typeof url !== 'string') return ''
  try {
    return decodeURIComponent(url.slice(url.lastIndexOf('/') + 1))
  } catch {
    return ''
  }
}

export function createUpdateChecker(deps: UpdateCheckerDeps): UpdateChecker {
  let state = deps.load()
  let checking: Promise<FetchOutcome> | undefined
  let manual: UpdateView['manual'] = null

  const view = (): UpdateView => ({
    current: deps.version,
    enabled: deps.enabled() && !deps.autoOff,
    lastCheckedAt: state.lastCheckedAt ?? null,
    checking: checking !== undefined,
    available: state.available ?? null,
    dismissed: !!state.available && state.dismissed === state.available.version,
    manual
  })
  const update = (next: UpdateState): void => {
    state = next
    if (!deps.readOnly()) deps.save(state)
  }
  const notify = (): void => deps.changed(view())

  /** Une requête à la fois : un second appel attend la première. */
  const run = async (): Promise<FetchOutcome> => {
    if (!checking) {
      checking = deps.fetchReleases().catch((): FetchOutcome => ({ ok: false, failure: 'offline' }))
      notify()
      void checking.finally(() => {
        checking = undefined
      })
    }
    return checking
  }

  /** Applique une réponse ; rend l'échec, ou `undefined` si la réponse a été lue. */
  const apply = (outcome: FetchOutcome): UpdateFailure | undefined => {
    if (!outcome.ok) {
      deps.log(`[update-check] échec : ${outcome.failure}`)
      return outcome.failure
    }
    const found = pickUpdate(outcome.json, deps.version, (tag) =>
      deps.log(`[update-check] Release ${tag} écartée : page inattendue`)
    )
    if (found === undefined) {
      deps.log('[update-check] échec : réponse illisible')
      return 'unreadable'
    }
    update({
      ...(state.dismissed ? { dismissed: state.dismissed } : {}),
      lastCheckedAt: new Date(deps.now()).toISOString(),
      ...(found ? { available: found } : {})
    })
    deps.log(`[update-check] ${found ? `version ${found.version} disponible` : 'à jour'}`)
    return undefined
  }

  const due = (): boolean => {
    const last = state.lastCheckedAt ? Date.parse(state.lastCheckedAt) : Number.NaN
    // Une date dans le futur (horloge changée) ne bloque pas la vérification.
    return Number.isNaN(last) || deps.now() - last >= CHECK_INTERVAL_MS || last > deps.now()
  }

  return {
    view,
    checkOnLaunch: async () => {
      if (!deps.enabled() || deps.autoOff || deps.readOnly() || !due()) return
      apply(await run())
      notify()
    },
    checkNow: async () => {
      const failure = apply(await run())
      manual = failure ? { result: 'failed', failure } : { result: 'up-to-date' }
      notify()
      return view()
    },
    dismiss: (version) => {
      if (!state.available || state.available.version !== version) return
      update({ ...state, dismissed: version })
      notify()
    },
    open: (version) => {
      const available = state.available
      if (!available || available.version !== version) throw new Error('Version inconnue')
      // Revérifiée juste avant l'ouverture : seule une page d'une Release du dépôt.
      if (!isReleasePageUrl(available.url, tagOf(available.url))) throw new Error('Page refusée')
      deps.openExternal(available.url)
      update({ ...state, dismissed: version })
      notify()
    },
    settingsChanged: notify
  }
}
