import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { NEUTRAL_ENV, check, withApp } from '../lib.mjs'

/**
 * Outils iOS apparus avec un projet Xcode créé pendant la conversation (fiche 241). Session ouverte
 * dans un dossier sans projet, puis l'agent factice écrit `ios/Essai.xcodeproj` (`cree-projet-xcode`).
 * Agent qui ne suit pas la liste d'outils (l'agent factice par défaut, comme Bob dont on ne sait
 * rien) : avis « à redémarrer » dans le fil, redonné sous la réponse suivante, puis « Redémarrer
 * l'agent » et `ios_build` déclaré. Agent qui la suit (`MOCK_AGENT_SUIT_OUTILS`, comme OpenCode
 * 2.3.0) : outils ajoutés sans redémarrer.
 */
export async function outilsProjetSuite(scheme) {
  console.log(`\n— Outils apparus avec un projet (${scheme})`)
  await withWorkspace(scheme, {}, withoutFollowing)
  await withWorkspace(scheme, { MOCK_AGENT_SUIT_OUTILS: '1' }, following)
}

async function withWorkspace(scheme, env, fn) {
  const workspace = mkdtempSync(join(tmpdir(), 'bob-e2e-outils-projet-'))
  try {
    await withApp(scheme, fn, undefined, 'demo', {
      ...NEUTRAL_ENV,
      BOBINE_WORKSPACE: workspace,
      ...env
    })
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
}

const NOTICE = `[data-testid=notice-app-tools][data-family=ios-simulator]`
const notices = `[...document.querySelectorAll('${NOTICE}')]`
const lastReply = `[...document.querySelectorAll('.msg-agent')].at(-1)?.innerText ?? ''`

/** Envoie un message et attend la réponse de l'agent ; rend son texte. */
async function exchange(ui, text) {
  const before = await ui.ev(`document.querySelectorAll('.msg-agent').length`)
  await ui.send(text)
  await ui.waitFor(`document.querySelectorAll('.msg-agent').length > ${before}`)
  await ui.ready()
  return ui.ev(lastReply)
}

async function withoutFollowing(ui) {
  await exchange(ui, '/scenario outils-mcp')
  await exchange(ui, '/scenario cree-projet-xcode')
  await ui.waitFor(`${notices}.length === 1`)
  await ui.shot('outils-projet-avis')

  // Tour suivant, en texte seul (comme l'agent qui répond qu'il n'a pas l'outil) : l'avis est
  // redonné sous la nouvelle réponse, seul.
  await exchange(ui, '/scenario echo')
  await ui.waitFor(
    `${notices}.length === 1 && (() => { const r = [...document.querySelectorAll('.msg-agent')].at(-1); return !!(r.compareDocumentPosition(${notices}[0]) & Node.DOCUMENT_POSITION_FOLLOWING) })()`
  )
  await ui.shot('outils-projet-avis-redonne')

  await ui.click(`document.querySelector('${NOTICE} [data-testid=notice-restart-agent]')`)
  await ui.waitFor(
    `${notices}.length === 1 && !document.querySelector('${NOTICE} [data-testid=notice-restart-agent]')`
  )
  await ui.ready()
  const after = await exchange(ui, '/scenario outils-mcp')
  check(after.includes('ios_build'), 'après redémarrage : ios_build déclaré (tools/list)')
  await ui.shot('outils-projet-redemarre')
}

async function following(ui) {
  await exchange(ui, '/scenario outils-mcp')
  await exchange(ui, '/scenario cree-projet-xcode')
  await ui.waitFor(`${notices}.length === 1`)
  await ui.click(ui.$('session-settings'))
  await ui.waitFor(`!!${ui.$('session-app-tools')}?.dataset.count`)
  check(
    !(await ui.ev(`!!${ui.$('session-app-tools-next')}`)),
    'menu ⚙ : rien « au prochain démarrage », la session a déjà les outils iOS'
  )
  await ui.key('Escape')
  await ui.shot('outils-projet-ajoutes')
}
