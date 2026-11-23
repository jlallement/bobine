import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { L, MAIN_PORT, check, mainProcess, root, sleep, withApp } from '../lib.mjs'
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
  const { next, list } = releasesFor(VERSION)
  const page = `https://github.com/jlallement/bobine/releases/tag/v${next}`
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
        const shown = await ui.ev(`${line(ui)}.innerText`)
        check(
          shown.includes(next) &&
            !shown.includes('beta.1') &&
            !(await ui.ev(`document.title === 'piege'`)),
          `ligne de la barre latérale : « ${shown.replace(/\n/g, ' · ')} » (${next}, pièges ignorés)`
        )
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
        const viewName = await ui.ev(`${ui.$('update-line-open')}.getAttribute('aria-label')`)
        check(
          viewName === L('updates.line.viewLabel', { version: next }),
          `« Voir » : nom accessible avec la version (« ${viewName} »)`
        )

        // « Plus tard » : la ligne part, le focus va à la zone de saisie (recette rc.4 : il tombait
        // sur la page) ; les Réglages gardent l'information.
        await ui.click(ui.$('update-line-later'))
        await ui.waitFor(`!${line(ui)}`)
        await sleep(200)
        const focused = await ui.ev(
          `document.activeElement?.dataset?.testid ?? document.activeElement?.tagName`
        )
        check(
          focused === 'composer-input',
          `« Plus tard » : le focus va à la zone de saisie (${focused})`
        )
        await ui.click(ui.$('open-settings'))
        await ui.click(ui.$('settings-about'))
        await ui.waitFor(`!!${ui.$('settings-update-available')}`)
        const note = await ui.ev(`${ui.$('settings-update-available')}.innerText`)
        check(
          note.includes(next) && note.includes(VERSION),
          `Réglages › Nouveautés après « Plus tard » : « ${note.replace(/\n/g, ' · ')} »`
        )
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
        const opened = await main.evaluate(`globalThis.__opened.splice(0)`)
        check(
          opened.length === 1 && opened[0] === page,
          `« Voir la version » : la page vérifiée seulement (${JSON.stringify(opened)})`
        )

        // Version déjà connue, « Vérifier maintenant » en échec : dit, la version reste (recette rc.4).
        server.respond(() => ({ status: 429, body: { message: 'API rate limit exceeded' } }))
        await ui.click(ui.$('settings-update-now'))
        await ui.waitFor(`!!${ui.$('settings-update-failed')}`)
        check(
          (await ui.ev(`${ui.$('settings-update-failed')}.innerText`)) ===
            L('updates.settings.failed.limit') &&
            (await ui.ev(`${ui.$('settings-update-available')}?.innerText ?? ''`)).includes(next),
          'version connue, « Vérifier maintenant » en échec : l’échec est dit, la version reste'
        )
        await ui.shot('nouvelle-version-connue-echec')

        // À la main : à jour, puis la limite de GitHub.
        server.respond(() => ({ status: 200, body: [] }))
        await ui.click(ui.$('settings-update-now'))
        await ui.waitFor(`!!${ui.$('settings-update-current')}`)
        await ui.shot('nouvelle-version-a-jour')
        server.respond(() => ({ status: 429, body: { message: 'API rate limit exceeded' } }))
        await ui.click(ui.$('settings-update-now'))
        await ui.waitFor(`!!${ui.$('settings-update-failed')}`)
        const failed = await ui.ev(`${ui.$('settings-update-failed')}.innerText`)
        check(
          failed === L('updates.settings.failed.limit'),
          `« Vérifier maintenant » en échec : « ${failed} »`
        )
        await ui.shot('nouvelle-version-echec')
        main.close()
      },
      userData,
      'demo',
      env,
      args
    )

    // Relance, même profil, moins de 24 h après : aucune requête, aucun avis (déjà vu).
    server.respond(() => ({ status: 200, body: list }))
    const before = server.seen.length
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        await sleep(8000)
        check(
          server.seen.length === before && !(await ui.ev(`!!${line(ui)}`)),
          `relance avant 24 h : aucune requête (${server.seen.length - before}), aucun avis`
        )
      },
      userData,
      'demo',
      env
    )
  } finally {
    rmSync(userData, { recursive: true, force: true })
  }

  // Échec automatique (serveur en panne) : la requête part, rien ne s'affiche.
  try {
    server.respond(() => ({ status: 500, body: 'oops' }))
    const before = server.seen.length
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        for (let i = 0; i < 40 && server.seen.length === before; i++) await sleep(500)
        await sleep(1000)
        await ui.click(ui.$('open-settings'))
        await ui.click(ui.$('settings-about'))
        await ui.waitFor(`!!${ui.$('settings-update')}`)
        check(
          server.seen.length === before + 1 &&
            !(await ui.ev(`!!${line(ui)}`)) &&
            !(await ui.ev(`!!${ui.$('settings-update-failed')}`)),
          `vérification automatique en échec : silencieuse (${server.seen.length - before} requête)`
        )
      },
      undefined,
      'demo',
      env
    )

    // Réglage coupé : aucune requête, aucun avis.
    const off = mkdtempSync(join(tmpdir(), 'bob-e2e-maj-off-'))
    writeFileSync(join(off, 'settings.json'), JSON.stringify({ updateCheck: false }))
    server.respond(() => ({ status: 200, body: list }))
    const quiet = server.seen.length
    try {
      await withApp(
        scheme,
        async (ui) => {
          await ui.ready()
          await sleep(8000)
          check(
            server.seen.length === quiet && !(await ui.ev(`!!${line(ui)}`)),
            `réglage coupé : aucune requête (${server.seen.length - quiet}), aucun avis`
          )
        },
        off,
        'demo',
        env
      )
    } finally {
      rmSync(off, { recursive: true, force: true })
    }
  } finally {
    await server.close()
  }
}
