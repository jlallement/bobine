import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { L, LANG, TERMINAL_TEXT, check, withApp } from '../lib.mjs'

/** Réponse de l'agent factice une fois reconnecté (il parle la langue des essais, fiche 167). */
const REPLY = LANG === 'en' ? 'Signed in again, I can answer.' : 'Reconnecté, je peux répondre.'
/** Sans réglages de session (comme Bob) : la carte « Connexion expirée » sans modèle. */
const NO_MODEL = { MOCK_AGENT_OPTIONS: 'none' }
/** Une seule conversation dans la liste, sans branche (fiche 210). */
const conversations = `document.querySelectorAll('[data-testid=history-item]').length`

/**
 * Connexion expirée en pleine conversation (recette 0.9, D10) : l'agent refuse le message avec
 * `authRequired` (comme OpenCode 2.2.5). Avis court dans le fil, carte « Connexion expirée » (un
 * seul bouton principal), statut dédié ; connexion dans le terminal, puis « Réessayer » renvoie le
 * message une fois, dans la même conversation. Puis le refus exact de Bob 2.0.9 (`-32603`
 * « Invalid or expired API key », fiche 200), reconnecté par SSO. Enfin, le modèle d'un
 * fournisseur non connecté (fiche 210) : la carte le nomme, un autre modèle renvoie le message, une
 * seule conversation, pas d'icône « Réessayer » en branche sous la carte.
 */
export async function connexionExpireeSuite(scheme) {
  console.log(`\n— Connexion expirée en pleine conversation (${scheme})`)
  const workspace = mkdtempSync(join(tmpdir(), 'bob-e2e-expiree-'))
  const primaries = (ui) =>
    ui.ev(
      `[...${ui.$('blocker-auth')}.querySelectorAll('button.primary')].map((b) => b.innerText.trim()).join('|')`
    )
  try {
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        await ui.send('Ajoute un test pour la fonction de calcul')
        await ui.waitFor(`!!${ui.$('blocker-auth')}`)
        await ui.hover({ x: 5, y: 400 })
        await ui.shot('expiree-1-carte')

        await ui.click(ui.$('auth-mock-login'))
        await ui.waitFor(`${TERMINAL_TEXT}.includes('touch .mock-agent-logged-in')`)
        for (let i = 0; i < 50 && !existsSync(join(workspace, '.mock-agent-logged-in')); i++) {
          await new Promise((r) => setTimeout(r, 100))
        }
        check(
          (await primaries(ui)) === L('blocker.retry'),
          'étape lancée : « Réessayer » devient le bouton principal'
        )
        await ui.click(ui.$('retry'))
        await ui.waitFor(`!${ui.$('blocker-auth')}`)
        await ui.ready()
        await ui.waitFor(`document.body.innerText.includes(${JSON.stringify(REPLY)})`)
        check(
          (await ui.ev(`document.querySelectorAll('.msg-user').length`)) === 1 &&
            (await ui.ev(`${ui.$('agent-status')}.innerText`)) === L('sidebar.status.ready'),
          'Réessayer : le message est renvoyé une fois, l’agent répond et redevient prêt'
        )
        check(
          (await ui.ev(conversations)) === 1 && !(await ui.ev(`!!${ui.$('branch-banner')}`)),
          'Réessayer : toujours une seule conversation, pas de branche'
        )
        await ui.hover({ x: 5, y: 400 })
        await ui.shot('expiree-2-reconnecte')
      },
      undefined,
      'connexion-expiree',
      { BOBINE_WORKSPACE: workspace, ...NO_MODEL }
    )
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
}
