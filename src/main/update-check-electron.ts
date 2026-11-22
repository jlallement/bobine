/**
 * Branchement Electron de l'avis de nouvelle version (fiche 274, ADR-0066) : `net.fetch` (proxy du
 * système), délai de 10 s, réponse bornée à 1 Mio, aucun cookie ni redirection, `User-Agent`
 * générique ; état dans `update-check.json` du profil ; page ouverte dans le navigateur du Mac.
 */
import { join } from 'node:path'
import { RELEASES_API_URL, type UpdateView } from '@shared/update-check'
import { readJson, writeFileAtomic } from './storage'
import {
  createUpdateChecker,
  sanitizeState,
  type FetchOutcome,
  type UpdateChecker
} from './update-check'

export const UPDATE_TIMEOUT_MS = 10_000
export const UPDATE_MAX_BYTES = 1024 * 1024
/** Attente après l'ouverture de la fenêtre : le lancement d'abord. */
export const UPDATE_LAUNCH_DELAY_MS = 5_000

type Fetch = (url: string, init: RequestInit) => Promise<Response>

/**
 * Adresse lue : celle de GitHub, sauf pour les essais (`BOBINE_RELEASES_URL`), seulement hors app
 * packagée et seulement vers la machine elle-même.
 */
export function releasesUrl(env: NodeJS.ProcessEnv, packaged: boolean): string {
  const override = env['BOBINE_RELEASES_URL']
  if (!override || packaged) return RELEASES_API_URL
  try {
    const url = new URL(override)
    const local = url.hostname === '127.0.0.1' || url.hostname === 'localhost'
    return url.protocol === 'http:' && local ? url.toString() : RELEASES_API_URL
  } catch {
    return RELEASES_API_URL
  }
}

/** Corps lu par morceaux, jamais au-delà de `max` octets (`undefined` sinon). */
async function readCapped(response: Response, max: number): Promise<string | undefined> {
  const declared = Number(response.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > max) return undefined
  if (!response.body) return ''
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > max) {
      await reader.cancel().catch(() => {})
      return undefined
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks).toString('utf8')
}

/** Une requête : JSON lu, ou la raison courte de l'échec. */
export async function fetchReleases(
  fetch: Fetch,
  url: string,
  version: string,
  { timeoutMs = UPDATE_TIMEOUT_MS, maxBytes = UPDATE_MAX_BYTES } = {}
): Promise<FetchOutcome> {
  let response: Response
  const signal = AbortSignal.timeout(timeoutMs)
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
        // Générique : pas la langue de l'utilisateur (Chromium mettrait la sienne).
        'Accept-Language': 'en',
        'User-Agent': `Bobine/${version}`,
        'X-GitHub-Api-Version': '2022-11-28'
      },
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'error',
      signal
    })
  } catch {
    return { ok: false, failure: 'offline' }
  }
  if (response.status === 403 || response.status === 429) {
    void response.body?.cancel().catch(() => {})
    return { ok: false, failure: 'limit' }
  }
  if (!response.ok) {
    void response.body?.cancel().catch(() => {})
    return { ok: false, failure: response.status >= 500 ? 'offline' : 'unreadable' }
  }
  let text: string | undefined
  try {
    text = await readCapped(response, maxBytes)
  } catch {
    return { ok: false, failure: 'offline' }
  }
  if (text === undefined) return { ok: false, failure: 'unreadable' }
  try {
    return { ok: true, json: JSON.parse(text) as unknown }
  } catch {
    return { ok: false, failure: 'unreadable' }
  }
}

export interface UpdateCheckSetup {
  userData: string
  version: string
  packaged: boolean
  env: NodeJS.ProcessEnv
  fetch: Fetch
  enabled: () => boolean
  readOnly: () => boolean
  openExternal: (url: string) => void
  log: (message: string) => void
  changed: (view: UpdateView) => void
}

export function setupUpdateCheck(setup: UpdateCheckSetup): UpdateChecker {
  const file = join(setup.userData, 'update-check.json')
  const url = releasesUrl(setup.env, setup.packaged)
  return createUpdateChecker({
    version: setup.version,
    fetchReleases: () => fetchReleases(setup.fetch, url, setup.version),
    load: () => {
      const read = readJson(file)
      return read.ok ? sanitizeState(read.value, setup.version) : {}
    },
    save: (state) => {
      try {
        writeFileAtomic(file, `${JSON.stringify(state, null, 2)}\n`)
      } catch (error) {
        setup.log(`[update-check] état non écrit : ${String(error)}`)
      }
    },
    enabled: setup.enabled,
    autoOff: setup.env['BOBINE_UPDATE_CHECK'] === 'off',
    readOnly: setup.readOnly,
    openExternal: setup.openExternal,
    now: () => Date.now(),
    log: setup.log,
    changed: setup.changed
  })
}
