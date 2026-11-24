import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MAIN_PORT, check, mainProcess, root, sleep, withApp } from '../lib.mjs'
import { releasesFor, startFakeReleases } from '../fixtures/faux-versions.mjs'

const VERSION = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version
/** Attente de la vérification automatique (5 s après le lancement), avec de la marge. */
const LAUNCH_CHECK_MS = 20_000

/**
 * Avis de nouvelle version (fiche 274, ADR-0066) contre un faux serveur local, jamais GitHub :
 * ligne de la barre latérale (version de la même ligne, pièges ignorés), « Plus tard » et « Voir »
 * (page vérifiée, ouverture observée en remplaçant `shell.openExternal`), une fois par version et
 * une fois par 24 h d'un lancement à l'autre, Réglages › Nouveautés (nouvelle version, à jour,
 * échec à la main), silence d'un échec automatique, réglage coupé : aucune requête.
 */
export async function nouvelleVersionSuite(scheme) {
  console.log(`\n— Avis de nouvelle version (${scheme})`)
  const server = await startFakeReleases()
  const { list } = releasesFor(VERSION)
  // L'adresse du faux serveur, et la vérification automatique remise (coupée par défaut en essai).
  const env = { BOBINE_RELEASES_URL: server.url, BOBINE_UPDATE_CHECK: '' }
  const args = [`--inspect=${MAIN_PORT}`]
  const line = (ui) => ui.$('update-line')
  const userData = mkdtempSync(join(tmpdir(), 'bob-e2e-maj-'))
  try {
    server.respond(() => ({ status: 200, body: list }))
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        const main = await mainProcess()
        await main.evaluate(
          `(globalThis.__opened = [], require('electron').shell.openExternal = async (u) => { globalThis.__opened.push(u) }, true)`
        )
        await ui.waitFor(`!!${line(ui)}`, LAUNCH_CHECK_MS)
        const [request, ...more] = server.seen
        check(
          more.length === 0 &&
            request.path === '/repos/jlallement/bobine/releases' &&
            request.headers['user-agent'] === `Bobine/${VERSION}` &&
            request.headers.accept === 'application/vnd.github+json' &&
            !request.headers.cookie &&
            request.headers['accept-language'] === 'en' &&
            !request.headers.authorization,
          `une requête au lancement, User-Agent « Bobine/${VERSION} », sans cookie, jeton ni langue de l’utilisateur (${JSON.stringify(server.seen)})`
        )
        await ui.shot('nouvelle-version-ligne')

        // « Plus tard » : la ligne part, le focus va à la zone de saisie (recette rc.4 : il tombait
        // sur la page) ; les Réglages gardent l'information.
        await ui.click(ui.$('update-line-later'))
        await ui.waitFor(`!${line(ui)}`)
        await sleep(200)
        await ui.click(ui.$('open-settings'))
        await ui.click(ui.$('settings-about'))
        await ui.waitFor(`!!${ui.$('settings-update-available')}`)
        // Texte et bouton « Voir la version » centrés l'un sur l'autre (recette rc.4).
        const offset = await ui.ev(`(() => {
          const note = ${ui.$('settings-update-available')}
          const mid = (el) => { const r = el.getBoundingClientRect(); return r.top + r.height / 2 }
          return Math.abs(mid(note.querySelector('.update-note-text')) - mid(note.querySelector('.btn')))
        })()`)
        check(
          offset <= 1.5,
          `encart « est disponible » : texte et bouton centrés (écart ${offset} px)`
        )
        await ui.shot('nouvelle-version-reglages')
        await ui.click(ui.$('settings-update-open'))
        await sleep(300)

        // Version déjà connue, « Vérifier maintenant » en échec : dit, la version reste (recette rc.4).
        server.respond(() => ({ status: 429, body: { message: 'API rate limit exceeded' } }))
        await ui.click(ui.$('settings-update-now'))
        await ui.waitFor(`!!${ui.$('settings-update-failed')}`)
        await ui.shot('nouvelle-version-connue-echec')

        // À la main : à jour, puis la limite de GitHub.
        server.respond(() => ({ status: 200, body: [] }))
        await ui.click(ui.$('settings-update-now'))
        await ui.waitFor(`!!${ui.$('settings-update-current')}`)
        await ui.shot('nouvelle-version-a-jour')
        server.respond(() => ({ status: 429, body: { message: 'API rate limit exceeded' } }))
        await ui.click(ui.$('settings-update-now'))
        await ui.waitFor(`!!${ui.$('settings-update-failed')}`)
        await ui.shot('nouvelle-version-echec')
        main.close()
      },
      userData,
      'demo',
      env,
      args
    )
  } finally {
    rmSync(userData, { recursive: true, force: true })
    await server.close()
  }
}
