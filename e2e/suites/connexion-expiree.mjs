import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { L, LANG, check, withApp } from '../lib.mjs'

const rows = `(document.querySelector('.terminal-host .xterm-rows')?.innerText ?? '')`
/** Réponse de l'agent factice une fois reconnecté (il parle la langue des essais, fiche 167). */
const REPLY = LANG === 'en' ? 'Signed in again, I can answer.' : 'Reconnecté, je peux répondre.'
/** Réponse du modèle connecté (fiche 210). */
const MODEL_REPLY =
  LANG === 'en'
    ? 'This model is signed in, I can answer.'
    : 'Ce modèle est connecté, je peux répondre.'
/** Modèle par défaut de l'agent factice, refusé dans `connexion-expiree-modele`. */
const REFUSED_MODEL = LANG === 'en' ? 'Mock fast' : 'Factice rapide'
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
        const text = await ui.ev('document.body.innerText')
        check(
          text.includes(L('agentHost.authExpired', { agent: L('profiles.mock.label') })) &&
            !text.includes('Authentication required'),
          'fil : avis court et traduit, pas l’erreur brute'
        )
        check(
          (await ui.ev(`${ui.$('agent-status')}.innerText`)) === L('sidebar.status.authExpired') &&
            (await ui.ev(`${ui.$('composer-input')}.placeholder`)) ===
              L('composer.placeholder.authExpired'),
          'statut « Connexion expirée », pas « Prêt » ; invite de la zone de saisie'
        )
        check(
          (await ui.ev(`${ui.$('blocker-auth')}.innerText`)).includes(
            'touch .mock-agent-logged-in'
          ) && !(await ui.ev(`!!${ui.$('auth-api-key')}`)),
          'carte : la commande du profil, pas de clé d’API'
        )
        check(
          (await primaries(ui)) === L('profiles.step.login'),
          'un seul bouton principal : se connecter'
        )
        check(
          !(await ui.ev(`!!${ui.$('message-retry')}`)) &&
            (await ui.ev(
              `document.querySelectorAll('[aria-label=${JSON.stringify(L('blocker.retry'))}]').length`
            )) === 0,
          'sous la carte : pas d’icône « Réessayer » en branche (fiche 210)'
        )
        await ui.hover({ x: 5, y: 400 })
        await ui.shot('expiree-1-carte')

        await ui.click(ui.$('auth-mock-login'))
        await ui.waitFor(`${rows}.includes('touch .mock-agent-logged-in')`)
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
        check(
          (await ui.ev(`${ui.$('message-retry')}?.getAttribute('aria-label')`)) ===
            L('transcript.retryBranch'),
          'prêt : l’icône du message revient, nommée « Réessayer dans une nouvelle branche »'
        )
        await ui.hover({ x: 5, y: 400 })
        await ui.shot('expiree-2-reconnecte')
      },
      undefined,
      'connexion-expiree',
      { BOBINE_WORKSPACE: workspace, ...NO_MODEL }
    )

    // Refus après un outil déjà lancé : la carte le dit, « Réessayer » demande confirmation.
    rmSync(join(workspace, '.mock-agent-logged-in'), { force: true })
    writeFileSync(join(workspace, 'README.md'), '# Exemple\n')
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        await ui.send('Lis le README')
        await ui.waitFor(`!!${ui.$('auth-tools-ran')}`)
        writeFileSync(join(workspace, '.mock-agent-logged-in'), '')
        await ui.click(ui.$('retry'))
        await ui.waitFor(`!!${ui.$('retry-confirm')}`)
        check(
          (await ui.ev(`${ui.$('blocker-auth')}.innerText`)).includes(
            L('blocker.auth.confirmToolsRan')
          ) && (await primaries(ui)) === L('blocker.auth.rerun'),
          'outils déjà lancés : « Réessayer » demande confirmation (seul bouton principal)'
        )
        await ui.hover({ x: 5, y: 400 })
        await ui.shot('expiree-3-outils')
        await ui.click(ui.$('retry-confirm'))
        await ui.waitFor(`!${ui.$('blocker-auth')}`)
        await ui.ready()
        await ui.waitFor(`document.body.innerText.includes(${JSON.stringify(REPLY)})`)
        check(
          (await ui.ev(`document.querySelectorAll('.msg-user').length`)) === 1,
          'confirmé : le message est renvoyé une fois'
        )
      },
      undefined,
      'connexion-expiree-outil',
      { BOBINE_WORKSPACE: workspace }
    )

    // Refus exact de Bob 2.0.9 (fiche 200) : `-32603` « Invalid or expired API key », pas
    // `authRequired`. Même carte ; connexion par SSO (`authenticate`), puis le message renvoyé.
    // Marqueur du bloc précédent retiré : l'agent factice se croirait déjà connecté.
    rmSync(join(workspace, '.mock-agent-logged-in'), { force: true })
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        await ui.send('Ajoute un test pour la fonction de calcul')
        await ui.waitFor(`!!${ui.$('blocker-auth')}`)
        const text = await ui.ev('document.body.innerText')
        check(
          text.includes(L('agentHost.authExpired', { agent: L('profiles.mock.label') })) &&
            text.includes(L('blocker.auth.expiredTitle')) &&
            !text.includes('Invalid or expired API key'),
          'Bob : carte « Connexion expirée » et avis court, pas l’erreur brute'
        )
        check(
          (await ui.ev(`${ui.$('agent-status')}.innerText`)) === L('sidebar.status.authExpired') &&
            (await ui.ev(`!!${ui.$('auth-mock-sso')}`)),
          'Bob : statut « Connexion expirée », connexion SSO proposée'
        )
        await ui.hover({ x: 5, y: 400 })
        await ui.shot('expiree-4-bob')
        await ui.click(ui.$('auth-mock-sso'))
        await ui.waitFor(`!${ui.$('blocker-auth')}`)
        await ui.ready()
        await ui.waitFor(`document.body.innerText.includes(${JSON.stringify(REPLY)})`)
        check(
          (await ui.ev(`document.querySelectorAll('.msg-user').length`)) === 1 &&
            (await ui.ev(`${ui.$('agent-status')}.innerText`)) === L('sidebar.status.ready'),
          'Bob : reconnecté par SSO, le message est renvoyé une fois, l’agent répond'
        )
      },
      undefined,
      'connexion-expiree-bob',
      { BOBINE_WORKSPACE: workspace, ...NO_MODEL }
    )

    // Modèle d'un fournisseur non connecté (fiche 210) : la carte nomme le modèle ; un autre modèle
    // choisi renvoie le message une fois, dans la même conversation ; l'ancien est marqué.
    rmSync(join(workspace, '.mock-agent-logged-in'), { force: true })
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        await ui.send('Ajoute un test pour la fonction de calcul')
        await ui.waitFor(`!!${ui.$('blocker-auth')}`)
        const card = await ui.ev(`${ui.$('blocker-auth')}.innerText`)
        check(
          card.includes(L('blocker.auth.modelTitle', { model: REFUSED_MODEL })) &&
            card.includes(L('blocker.auth.modelSubtitle')) &&
            !card.includes(L('blocker.auth.expiredTitle')),
          'modèle refusé : la carte nomme le modèle'
        )
        check(
          (await primaries(ui)) === L('blocker.auth.chooseModel') &&
            (await ui.ev(`!!${ui.$('auth-mock-login')}`)) &&
            !(await ui.ev(`!!${ui.$('retry')}`)),
          'deux actions : « Choisir un autre modèle » (principal) et « Se connecter »'
        )
        check(
          (await ui.ev(`document.body.innerText`)).includes(
            L('agentHost.modelAuthRefused', {
              agent: L('profiles.mock.label'),
              model: REFUSED_MODEL
            })
          ),
          'fil : l’avis nomme le modèle'
        )
        check(
          !(await ui.ev(`!!${ui.$('message-retry')}`)) && (await ui.ev(conversations)) === 1,
          'sous la carte : pas d’icône « Réessayer » en branche, une seule conversation'
        )
        check(
          (await ui.ev(`${ui.$('agent-status')}.innerText`)) === L('sidebar.status.modelRefused') &&
            (await ui.ev(`${ui.$('composer-input')}.placeholder`)) ===
              L('composer.placeholder.modelRefused'),
          'statut « Modèle refusé » et invite « Choisissez un autre modèle… », pas « Connexion expirée »'
        )
        await ui.hover({ x: 5, y: 400 })
        await ui.shot('expiree-5-modele')

        await ui.click(ui.$('auth-choose-model'))
        await ui.waitFor(`!!${ui.$('model-menu-content')}`)
        check(
          (await ui.ev(
            `${ui.$('control-model-factice-rapide')}?.querySelector('[data-testid=model-auth-required]')?.innerText`
          )) === L('modelMenu.authRequired') &&
            !(await ui.ev(
              `!!${ui.$('control-model-factice-precis')}?.querySelector('[data-testid=model-auth-required]')`
            )),
          'sélecteur : le modèle refusé marqué « connexion à faire », l’autre non'
        )
        await ui.shot('expiree-6-choix-modele')
        await ui.click(ui.$('control-model-factice-precis'))
        await ui.waitFor(`!${ui.$('blocker-auth')}`)
        await ui.ready()
        await ui.waitFor(`document.body.innerText.includes(${JSON.stringify(MODEL_REPLY)})`)
        check(
          (await ui.ev(`document.querySelectorAll('.msg-user').length`)) === 1 &&
            (await ui.ev(conversations)) === 1 &&
            !(await ui.ev(`!!${ui.$('branch-banner')}`)) &&
            (await ui.ev(`${ui.$('agent-status')}.innerText`)) === L('sidebar.status.ready'),
          'autre modèle : le message est renvoyé une fois, même conversation, l’agent répond'
        )
        // Liste de la zone de saisie (la carte et sa liste sont parties) : la marque est toujours là.
        await ui.waitFor(`!${ui.$('model-menu-content')}`)
        await ui.click(`document.querySelector('.composer [data-testid=model-chip]')`)
        await ui.waitFor(
          `!!${ui.$('control-model-factice-rapide')}?.querySelector('[data-testid=model-auth-required]')`
        )
        check(true, 'le modèle refusé reste marqué dans le sélecteur de la zone de saisie')
        await ui.shot('expiree-7-modele-marque')
      },
      undefined,
      'connexion-expiree-modele',
      { BOBINE_WORKSPACE: workspace }
    )
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
}
