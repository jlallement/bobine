import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { L, NEUTRAL_ENV, check, withApp } from '../lib.mjs'

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

/** Avis des outils iOS du fil : texte, bouton, et s'il est le dernier élément du fil. */
const noticeState = (ui) =>
  ui.ev(`${notices}.map((n) => ({
    text: n.innerText.trim(),
    restart: !!n.querySelector('[data-testid=notice-restart-agent]'),
    afterLastReply: (() => {
      const replies = [...document.querySelectorAll('.msg-agent')]
      const reply = replies.at(-1)
      return !!reply && !!(reply.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING)
    })()
  }))`)

async function withoutFollowing(ui) {
  const before = await exchange(ui, '/scenario outils-mcp')
  check(
    before.includes('ask_user') && !before.includes('ios_build'),
    'dossier sans projet : pas d’outil iOS déclaré (tools/list)'
  )
  await exchange(ui, '/scenario cree-projet-xcode')
  await ui.waitFor(`${notices}.length === 1`)
  const [created] = await noticeState(ui)
  check(
    created?.text.startsWith(L('transcript.notice.appTools.iosPending')) &&
      created.restart &&
      created.afterLastReply,
    `projet Xcode créé pendant le tour : avis sous la réponse, avec « Redémarrer l’agent » (${created?.text})`
  )
  await ui.shot('outils-projet-avis')

  // L'agent répond sans l'outil : l'avis est redonné sous la nouvelle réponse, seul.
  await exchange(ui, 'Compile et lance l’app avec ios_build de Bobine.')
  await ui.waitFor(
    `${notices}.length === 1 && (() => { const r = [...document.querySelectorAll('.msg-agent')].at(-1); return !!(r.compareDocumentPosition(${notices}[0]) & Node.DOCUMENT_POSITION_FOLLOWING) })()`
  )
  check(
    (await noticeState(ui)).length === 1,
    'tour suivant : un seul avis, sous la dernière réponse'
  )
  await ui.shot('outils-projet-avis-redonne')

  await ui.click(`document.querySelector('${NOTICE} [data-testid=notice-restart-agent]')`)
  await ui.waitFor(
    `${notices}.length === 1 && !document.querySelector('${NOTICE} [data-testid=notice-restart-agent]')`
  )
  await ui.ready()
  const [restarted] = await noticeState(ui)
  check(
    restarted?.text === L('transcript.notice.appTools.iosSession'),
    `après « Redémarrer l’agent » : ligne discrète, plus de bouton (${restarted?.text})`
  )
  const after = await exchange(ui, '/scenario outils-mcp')
  check(after.includes('ios_build'), 'après redémarrage : ios_build déclaré (tools/list)')
  await ui.shot('outils-projet-redemarre')
}

async function following(ui) {
  const before = await exchange(ui, '/scenario outils-mcp')
  check(!before.includes('ios_build'), 'agent qui suit la liste : pas d’outil iOS au départ')
  await exchange(ui, '/scenario cree-projet-xcode')
  await ui.waitFor(`${notices}.length === 1`)
  const [added] = await noticeState(ui)
  check(
    added?.text === L('transcript.notice.appTools.iosLive') && !added.restart,
    `agent qui relit la liste : outils ajoutés sans redémarrer, ligne discrète (${added?.text})`
  )
  await ui.click(ui.$('session-settings'))
  await ui.waitFor(`!!${ui.$('session-app-tools')}?.dataset.count`)
  check(
    !(await ui.ev(`!!${ui.$('session-app-tools-next')}`)),
    'menu ⚙ : rien « au prochain démarrage », la session a déjà les outils iOS'
  )
  await ui.key('Escape')
  await ui.shot('outils-projet-ajoutes')
}
