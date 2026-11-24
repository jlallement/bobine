import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { KEYRING, L, TERMINAL_TEXT, check, sleep, withApp } from '../lib.mjs'

const KEY = 'cle-e2e-0123456789' // gitleaks:allow — fake value for tests

/** Connexion aux agents (fiche 022) : clé d'API, connexion dans un terminal, licence. */
export async function authSuite(scheme) {
  console.log(`\n— Connexion aux agents (${scheme})`)
  const userData = mkdtempSync(join(tmpdir(), 'bob-e2e-auth-'))
  const workspace = mkdtempSync(join(tmpdir(), 'bob-e2e-auth-ws-'))
  try {
    // Clé d'API à la place du SSO : enregistrée chiffrée, agent relancé avec, jamais renvoyée.
    await withApp(
      scheme,
      async (ui) => {
        await ui.waitFor(`!!${ui.$('blocker-auth')}`)
        check(!!(await ui.ev(`!!${ui.$('auth-mock-sso')}`)), 'SSO proposé')
        await ui.shot('f0-connexion-requise')
        await ui.click(ui.$('auth-api-key'))
        await ui.waitFor(`document.activeElement === ${ui.$('api-key-input')}`)
        await ui.type(KEY)
        await ui.shot('f0-cle-api')
        await ui.click(ui.$('api-key-save'))
        await ui.waitFor(`!${ui.$('blocker-auth')}`)
        await ui.ready()
        check(true, 'clé d’API : l’agent est relancé avec, plus de connexion demandée')
        await ui.send('Bonjour')
        await ui.waitFor(`document.body.innerText.includes('Authentifié, je peux travailler.')`)
        check(true, 'clé d’API : la conversation fonctionne')
        if (KEYRING) {
        } else {
        }
        await ui.click(ui.$('open-settings'))
        await ui.waitFor(`!!${ui.$('settings')}`)
        await ui.click(ui.$('settings-agents'))
        await ui.click(
          `document.querySelector('[data-testid="settings-agent"][data-agent="mock"]')`
        )
        const row = ui.$('api-key-MOCK_AGENT_API_KEY')
        const state = `(${row}?.querySelector('[data-testid=api-key-state]')?.innerText ?? '')`
        // Avec un trousseau : « Enregistrée » ; sans (D4) : « Enregistrée en clair » et l'avis qui
        // dit pourquoi et comment la chiffrer.
        const stored = L(
          KEYRING ? 'settings.apiKeys.state.stored' : 'settings.apiKeys.plaintextState'
        )
        await ui.waitFor(`${state} === ${JSON.stringify(stored)}`)
        await ui.ev(`${ui.$('settings-api-keys')}.scrollIntoView({ block: 'center' })`)
        await ui.shot('f1-reglages-cles')
        await ui.click(
          `${ui.$('api-key-MOCK_AGENT_API_KEY')}.querySelector('[data-testid=api-key-remove]')`
        )
        await ui.waitFor(
          `!!${ui.$('api-key-MOCK_AGENT_API_KEY')}.querySelector('[data-testid=confirm-row-confirm]')`
        )
        await ui.click(
          `${ui.$('api-key-MOCK_AGENT_API_KEY')}.querySelector('[data-testid=confirm-row-confirm]')`
        )
        await ui.waitFor(`${state}.includes(${JSON.stringify(L('settings.apiKeys.state.none'))})`)
        // La ligne se redessine (« Remplacer » → « Définir ») : cliquer une fois qu'elle est stable.
        await ui.waitFor(
          `${ui.$('api-key-MOCK_AGENT_API_KEY')}.querySelector('[data-testid=api-key-edit]')?.innerText === ${JSON.stringify(L('settings.apiKeys.set'))}`
        )
        await ui.click(
          `${ui.$('api-key-MOCK_AGENT_API_KEY')}.querySelector('[data-testid=api-key-edit]')`
        )
        await ui.waitFor(`!!${ui.$('api-key-value')}`)
        await ui.ev(`${ui.$('api-key-value')}.focus()`)
        await ui.type('deux mots')
        await ui.enter()
        await ui.waitFor(
          `document.querySelector('.api-key-error')?.innerText.includes(${JSON.stringify(L('apiKeys.invalid'))})`
        )
        await ui.key('Escape')
      },
      userData,
      'bob-auth-requise',
      { BOBINE_WORKSPACE: workspace }
    )

    // Relance sans agent ni dossier imposés : la conversation « Bonjour » est rouverte (fiche
    // 243). Clé illisible : comme Bob déconnecté (docs/acp.md, fiche 200), la réouverture
    // (session/load) demande la connexion ; la carte s'affiche dans le fil rouvert, sans attendre
    // de message, puis la clé ressaisie fait continuer la même conversation.
    writeFileSync(
      join(userData, 'api-keys.json'),
      JSON.stringify({ version: 1, keys: { mock: { MOCK_AGENT_API_KEY: 'aWxsaXNpYmxl' } } })
    )
    await withApp(
      scheme,
      async (ui) => {
        await ui.waitFor(`!!${ui.$('blocker-auth')}`)
        check(
          (await ui.ev(`document.querySelector('.history-item.active')?.innerText ?? ''`)).includes(
            'Bonjour'
          ) && (await ui.ev(`document.querySelectorAll('.msg-user').length`)) === 1,
          'rouverte, clé illisible : la conversation d’avant, connexion demandée dès la réouverture'
        )
        await ui.shot('f0b-rouverte-connexion')
        await ui.click(ui.$('auth-api-key'))
        await ui.waitFor(`document.activeElement === ${ui.$('api-key-input')}`)
        await ui.type(KEY)
        await ui.click(ui.$('api-key-save'))
        await ui.waitFor(`!${ui.$('blocker-auth')}`)
        await ui.ready()
        await ui.send('Encore')
        await ui.waitFor(`document.querySelectorAll('.msg-agent').length === 2`)
        check(
          (await ui.ev(`document.querySelectorAll('.msg-user').length`)) === 2,
          'rouverte : clé ressaisie, la même conversation continue'
        )
      },
      userData,
      'bob-auth-requise-rouverture',
      // Agent factice proposé, pas imposé (`BOBINE_MOCK_AGENT`, profiles.ts).
      { BOBINE_WORKSPACE: '', BOBINE_AGENT_PROFILE: '', BOBINE_MOCK_AGENT: '1' }
    )

    // Connexion dans un terminal (comme `opencode auth login`) : la commande du profil, puis Réessayer.
    await withApp(
      scheme,
      async (ui) => {
        await ui.waitFor(`!!${ui.$('blocker-auth')}`)
        await ui.click(ui.$('auth-mock-login'))
        await ui.waitFor(`${TERMINAL_TEXT}.includes('touch .mock-agent-logged-in')`)
        await ui.waitFor(`!!${ui.$('retry')}`)
        check(true, 'connexion dans un terminal : commande lancée dans le terminal de l’app')
        await ui.shot('f2-connexion-terminal')
        for (let i = 0; i < 50 && !existsSync(join(workspace, '.mock-agent-logged-in')); i++) {
          await new Promise((r) => setTimeout(r, 100))
        }
        await ui.click(ui.$('retry'))
        await ui.waitFor(`!${ui.$('blocker-auth')}`)
        await ui.ready()
        check(true, 'connexion dans un terminal : Réessayer relance l’agent, connecté')
      },
      undefined,
      'connexion-terminal',
      { BOBINE_WORKSPACE: workspace }
    )

    await stuckSignIn(scheme, workspace)
    await slowKeychain(scheme, workspace)

    // Licence à accepter (Bob) : message, lecture dans le terminal, jamais acceptée par l'app.
    await withApp(
      scheme,
      async (ui) => {
        await ui.waitFor(`!!${ui.$('blocker-license')}`)
        check(
          (await ui.ev(`${ui.$('license-message')}.innerText`)).includes('--accept-license'),
          'licence : panneau dédié, avec le message de l’agent'
        )
        await ui.click(ui.$('step-show-license'))
        await ui.waitFor(`${TERMINAL_TEXT}.includes('licence-factice')`)
        check(true, 'licence : « Lire la licence » lance la commande dans le terminal')
        await ui.shot('f3-licence')
        check(
          !existsSync(join(workspace, '.mock-agent-license')),
          'licence : jamais acceptée par l’app'
        )
        // L'utilisateur l'accepte lui-même (simulé), puis réessaie.
        writeFileSync(join(workspace, '.mock-agent-license'), '')
        await ui.click(ui.$('retry'))
        await ui.waitFor(`!${ui.$('blocker-license')}`)
        await ui.ready()
        check(true, 'licence acceptée : Réessayer relance l’agent')
      },
      undefined,
      'bob-licence-requise',
      { BOBINE_WORKSPACE: workspace }
    )
  } finally {
    rmSync(userData, { recursive: true, force: true })
    rmSync(workspace, { recursive: true, force: true })
  }
}

/** Souris écartée, focus retiré : ni infobulle ni anneau de focus sur les captures. */
async function still(ui) {
  await ui.hover({ x: 5, y: 600 })
  await ui.ev(`document.activeElement?.blur(), true`)
}

/**
 * SSO fini dans le navigateur, mais l'agent ne répond jamais (fiche 207) : la carte le dit, et
 * « Réessayer » relance l'agent, qui relit sa connexion.
 */
async function stuckSignIn(scheme, workspace) {
  // Connexion faite dans le terminal à l'étape d'avant : oubliée, la carte revient.
  rmSync(join(workspace, '.mock-agent-logged-in'), { force: true })
  await withApp(
    scheme,
    async (ui) => {
      await ui.waitFor(`!!${ui.$('blocker-auth')}`)
      await ui.click(ui.$('auth-mock-sso'))
      await ui.waitFor(`!!${ui.$('auth-stuck')}`)
      await sleep(1000)
      await still(ui)
      await ui.shot('207-4-carte-sso-attente')
      await ui.click(ui.$('retry'))
      await ui.waitFor(`!${ui.$('blocker-auth')}`, 20000)
      await ui.ready()
      check(true, '« Réessayer » : agent relancé, connecté, plus de carte')
    },
    undefined,
    'sso-sans-retour',
    { BOBINE_WORKSPACE: workspace }
  )
  rmSync(join(workspace, '.mock-agent-logged-in'), { force: true })
}

/**
 * Trousseau macOS qui tarde (fiche 207 ; faux trousseau, réglages d'essai) : enregistrement en
 * cours, « En attente du trousseau macOS… », délai dépassé (valeur gardée, rien d'écrit), puis
 * « Réessayer » qui attend la même question au trousseau. Dans Réglages › Agents, puis dans la
 * carte « Connexion requise ».
 */
async function slowKeychain(scheme, workspace) {
  const slow = { BOBINE_KEYCHAIN_DELAY_MS: '4500', BOBINE_KEYCHAIN_TIMEOUT_MS: '2500' }
  // Dans la carte « Connexion requise ».
  await withApp(
    scheme,
    async (ui) => {
      await ui.waitFor(`!!${ui.$('blocker-auth')}`)
      await ui.click(ui.$('auth-api-key'))
      await ui.waitFor(`document.activeElement === ${ui.$('api-key-input')}`)
      await ui.type(KEY)
      await ui.click(ui.$('api-key-save'))
      await ui.waitFor(`!!${ui.$('blocker-auth')}.querySelector('[data-testid=keychain-wait]')`)
      await still(ui)
      await ui.shot('207-5-carte-cle-trousseau-attente')
      await ui.waitFor(`!!${ui.$('blocker-auth')}.querySelector('[data-testid=api-key-error]')`)
      await still(ui)
      await ui.shot('207-6-carte-cle-trousseau-delai')
      await ui.click(ui.$('api-key-save'))
      await ui.waitFor(`!${ui.$('blocker-auth')}`, 15000)
      await ui.ready()
      check(true, 'carte : « Réessayer », clé enregistrée, agent relancé avec')
    },
    undefined,
    'bob-auth-requise',
    { BOBINE_WORKSPACE: workspace, ...slow }
  )
}
