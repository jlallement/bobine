import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs'
import { request } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { HtmlPreviewServer } from './html-preview'

const workspace = mkdtempSync(join(tmpdir(), 'apercu-html-'))
const site = join(workspace, 'site')
mkdirSync(join(site, 'css'), { recursive: true })
mkdirSync(join(site, 'docs'), { recursive: true })
mkdirSync(join(site, '.git'), { recursive: true })
writeFileSync(join(site, 'index.html'), '<h1>Accueil</h1>')
writeFileSync(join(site, 'css', 'style.css'), 'h1 { color: red }')
writeFileSync(join(site, 'data.json'), '{"ok":true}')
writeFileSync(join(site, 'docs', 'index.html'), '<h1>Docs</h1>')
writeFileSync(join(site, 'mon fichier.html'), '<p>espace</p>')
writeFileSync(join(site, '.env'), 'SECRET=1')
writeFileSync(join(site, '.git', 'config'), '[core]')
writeFileSync(join(site, '.git', 'index.html'), '<h1>Caché</h1>')
writeFileSync(join(workspace, 'voisin.txt'), 'hors de la page')
symlinkSync(join(workspace, 'voisin.txt'), join(site, 'lien.txt'))
// Liens symboliques dans le dossier : vers un fichier ordinaire, vers un fichier ou dossier caché.
symlinkSync(join(site, 'data.json'), join(site, 'lien.json'))
symlinkSync(join(site, '.env'), join(site, 'config.txt'))
symlinkSync(join(site, '.git'), join(site, 'pub'))
const other = join(workspace, 'autre')
mkdirSync(other)
writeFileSync(join(other, 'index.html'), '<h1>Autre</h1>')

const server = new HtmlPreviewServer()
afterAll(() => server.stop())

/** Requête brute (Host choisi, méthode choisie). */
function get(url: string, options: { host?: string; method?: string } = {}) {
  const u = new URL(url)
  return new Promise<{ status: number; type: string; body: string; cache: string }>(
    (resolve, reject) => {
      const req = request(
        {
          host: u.hostname,
          port: u.port,
          path: u.pathname,
          method: options.method ?? 'GET',
          headers: { host: options.host ?? u.host },
          // Une connexion par requête : après `stop()`, la connexion est refusée.
          agent: false
        },
        (res) => {
          let body = ''
          res.on('data', (d) => (body += d))
          res.on('end', () =>
            resolve({
              status: res.statusCode ?? 0,
              type: String(res.headers['content-type'] ?? ''),
              body,
              cache: String(res.headers['cache-control'] ?? '')
            })
          )
        }
      )
      req.on('error', reject)
      req.end()
    }
  )
}

describe('aperçu des pages HTML (fiche 064)', () => {
  it('sert la page et ses voisines, sans cache', async () => {
    const page = await server.urlFor(site, join(site, 'index.html'))
    expect(page).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/[\w-]{24}\/index\.html$/)
    expect(await get(page)).toMatchObject({
      status: 200,
      type: 'text/html; charset=utf-8',
      body: '<h1>Accueil</h1>',
      cache: 'no-store'
    })
    const base = page.replace(/index\.html$/, '')
    expect((await get(`${base}css/style.css`)).type).toBe('text/css; charset=utf-8')
    expect((await get(`${base}data.json`)).body).toBe('{"ok":true}')
    expect((await get(`${base}docs/`)).body).toBe('<h1>Docs</h1>')
    expect((await get(await server.urlFor(site, join(site, 'mon fichier.html')))).status).toBe(200)
    // Un lien symbolique vers un fichier ordinaire du dossier est servi.
    expect((await get(`${base}lien.json`)).body).toBe('{"ok":true}')
  })

  it('refuse un lien symbolique vers un fichier ou un dossier caché (fiche 114)', async () => {
    const page = await server.urlFor(site, join(site, 'index.html'))
    const base = page.replace(/index\.html$/, '')
    expect((await get(`${base}config.txt`)).status).toBe(404)
    expect((await get(`${base}pub/`)).status).toBe(404)
    expect((await get(`${base}pub/config`)).status).toBe(404)
  })

  it('cloisonne chaque dossier derrière son propre serveur (fiche 114)', async () => {
    const page = await server.urlFor(site, join(site, 'index.html'))
    const otherPage = await server.urlFor(other, join(other, 'index.html'))
    const a = new URL(page)
    const b = new URL(otherPage)
    expect(a.port).not.toBe(b.port)
    expect(a.pathname.split('/')[1]).not.toBe(b.pathname.split('/')[1])
    expect((await get(otherPage)).body).toBe('<h1>Autre</h1>')
    // Le jeton d'un dossier ne vaut rien sur le serveur de l'autre.
    expect((await get(`http://127.0.0.1:${b.port}${a.pathname}`)).status).toBe(404)
    expect((await get(`http://127.0.0.1:${a.port}${b.pathname}`)).status).toBe(404)
    // Même page redemandée : même serveur.
    expect(await server.urlFor(site, join(site, 'index.html'))).toBe(page)
  })

  it('refuse : fichier caché, hors du dossier, lien qui en sort, jeton, Host, méthode', async () => {
    const page = await server.urlFor(site, join(site, 'index.html'))
    const base = page.replace(/index\.html$/, '')
    expect((await get(`${base}.env`)).status).toBe(404)
    expect((await get(`${base}.git/config`)).status).toBe(404)
    expect((await get(`${base}..%2Fvoisin.txt`)).status).toBe(404)
    expect((await get(`${base}%2E%2E/voisin.txt`)).status).toBe(404)
    expect((await get(`${base}lien.txt`)).status).toBe(404)
    expect((await get(page.replace(/\/[\w-]{24}\//, '/mauvais-jeton/'))).status).toBe(404)
    expect((await get(page, { host: 'attaquant.example:80' })).status).toBe(403)
    expect((await get(page, { method: 'POST' })).status).toBe(405)
    await expect(server.urlFor(site, join(workspace, 'voisin.txt'))).rejects.toThrow(
      'Hors du dossier'
    )
  })

  it('stop() ferme tous les serveurs (fiche 114)', async () => {
    const page = await server.urlFor(site, join(site, 'index.html'))
    const otherPage = await server.urlFor(other, join(other, 'index.html'))
    server.stop()
    await expect(get(page)).rejects.toThrow(/ECONNREFUSED/)
    await expect(get(otherPage)).rejects.toThrow(/ECONNREFUSED/)
    // Après l'arrêt, un nouvel aperçu repart sur un nouveau serveur.
    const again = await server.urlFor(site, join(site, 'index.html'))
    expect(again).not.toBe(page)
    expect((await get(again)).status).toBe(200)
  })
})
