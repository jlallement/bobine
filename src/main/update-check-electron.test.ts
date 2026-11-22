import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { RELEASES_API_URL, releasePageUrl } from '@shared/update-check'
import { fetchReleases, releasesUrl, setupUpdateCheck } from './update-check-electron'

type Init = RequestInit & { headers: Record<string, string> }

describe('requête des Releases (fiche 274, ADR-0066)', () => {
  it('en-têtes génériques, sans cookie ni redirection, délai posé', async () => {
    const fetch = vi.fn(async (_url: string, _init: RequestInit) => Response.json([]))
    expect(await fetchReleases(fetch, RELEASES_API_URL, '1.0.0')).toEqual({ ok: true, json: [] })
    const [url, init] = fetch.mock.calls[0] as [string, Init]
    expect(url).toBe('https://api.github.com/repos/jlallement/bobine/releases?per_page=30')
    expect(init.headers).toEqual({
      Accept: 'application/vnd.github+json',
      'Accept-Language': 'en',
      'User-Agent': 'Bobine/1.0.0',
      'X-GitHub-Api-Version': '2022-11-28'
    })
    expect(init).toMatchObject({ method: 'GET', credentials: 'omit', redirect: 'error' })
    expect(init.signal).toBeInstanceOf(AbortSignal)
    expect(init.body).toBeUndefined()
  })

  it('hors ligne, délai dépassé, limite, erreur du serveur : la raison courte', async () => {
    const offline = vi.fn(async () => {
      throw new TypeError('net::ERR_INTERNET_DISCONNECTED')
    })
    expect(await fetchReleases(offline, RELEASES_API_URL, '1.0.0')).toEqual({
      ok: false,
      failure: 'offline'
    })
    // Jamais de réponse : le délai coupe.
    const hanging = (_url: string, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) =>
        init.signal?.addEventListener('abort', () => reject(new Error('aborted')))
      )
    expect(await fetchReleases(hanging, RELEASES_API_URL, '1.0.0', { timeoutMs: 20 })).toEqual({
      ok: false,
      failure: 'offline'
    })
    for (const [status, failure] of [
      [403, 'limit'],
      [429, 'limit'],
      [404, 'unreadable'],
      [502, 'offline']
    ] as const) {
      const fetch = async () => new Response('{}', { status })
      expect(await fetchReleases(fetch, RELEASES_API_URL, '1.0.0'), String(status)).toEqual({
        ok: false,
        failure
      })
    }
  })

  it('réponse trop grosse (annoncée ou réelle) ou illisible : illisible', async () => {
    const big = 'x'.repeat(2048)
    const declared = async () =>
      new Response('[]', { headers: { 'content-length': String(10 * 1024 * 1024) } })
    expect(await fetchReleases(declared, RELEASES_API_URL, '1.0.0')).toEqual({
      ok: false,
      failure: 'unreadable'
    })
    const streamed = async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            for (let i = 0; i < 4; i++) controller.enqueue(new TextEncoder().encode(big))
            controller.close()
          }
        })
      )
    expect(await fetchReleases(streamed, RELEASES_API_URL, '1.0.0', { maxBytes: 4096 })).toEqual({
      ok: false,
      failure: 'unreadable'
    })
    const html = async () => new Response('<html>oops</html>')
    expect(await fetchReleases(html, RELEASES_API_URL, '1.0.0')).toEqual({
      ok: false,
      failure: 'unreadable'
    })
  })
})

describe('adresse des essais (fiche 274)', () => {
  it('BOBINE_RELEASES_URL : hors app packagée, vers la machine seulement', () => {
    const local = 'http://127.0.0.1:4567/repos/jlallement/bobine/releases'
    expect(releasesUrl({ BOBINE_RELEASES_URL: local }, false)).toBe(local)
    expect(releasesUrl({ BOBINE_RELEASES_URL: 'http://localhost:9/x' }, false)).toBe(
      'http://localhost:9/x'
    )
    expect(releasesUrl({ BOBINE_RELEASES_URL: local }, true)).toBe(RELEASES_API_URL)
    for (const other of [
      'https://evil.example/x',
      'http://10.0.0.2/x',
      'file:///etc/passwd',
      '::'
    ]) {
      expect(releasesUrl({ BOBINE_RELEASES_URL: other }, false), other).toBe(RELEASES_API_URL)
    }
    expect(releasesUrl({}, false)).toBe(RELEASES_API_URL)
  })
})

describe('branchement : état dans le profil (fiche 274)', () => {
  it('écrit update-check.json, le relit, et coupe la vérification pour les essais', async () => {
    const userData = mkdtempSync(join(tmpdir(), 'update-check-'))
    const fetch = vi.fn(async () =>
      Response.json([
        { tag_name: 'v1.0.1', html_url: releasePageUrl('v1.0.1'), draft: false, prerelease: false }
      ])
    )
    const setup = {
      userData,
      version: '1.0.0',
      packaged: false,
      env: {},
      fetch,
      enabled: () => true,
      readOnly: () => false,
      openExternal: () => {},
      log: () => {},
      changed: () => {}
    }
    const first = setupUpdateCheck(setup)
    await first.checkOnLaunch()
    first.dismiss('1.0.1')
    const saved = JSON.parse(readFileSync(join(userData, 'update-check.json'), 'utf8')) as Record<
      string,
      unknown
    >
    expect(saved).toMatchObject({ dismissed: '1.0.1', available: { version: '1.0.1' } })
    expect(setupUpdateCheck(setup).view()).toMatchObject({ dismissed: true })

    // Fichier abîmé : ignoré, pas d'erreur.
    writeFileSync(join(userData, 'update-check.json'), '{oops')
    expect(setupUpdateCheck(setup).view().available).toBeNull()

    const off = setupUpdateCheck({ ...setup, env: { BOBINE_UPDATE_CHECK: 'off' } })
    fetch.mockClear()
    await off.checkOnLaunch()
    expect(fetch).not.toHaveBeenCalled()
    expect(off.view().enabled).toBe(false)
  })
})
