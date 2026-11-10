import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { L, check, sleep, withApp } from '../lib.mjs'

const KEY = 'cle-e2e-0123456789' // gitleaks:allow — fake value for tests
const rows = `(document.querySelector('.terminal-host .xterm-rows')?.innerText ?? '')`

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
        // L'agent l'annonce en anglais (« Log in with SSO », comme Bob 2.0.9) : libellé du profil,
        // dans la langue de l'app (fiche 205).
        const sso = await ui.ev(`${ui.$('auth-mock-sso')}.innerText.trim()`)
        check(
          sso === L('profiles.authMethod.sso'),
          `SSO : libellé traduit « ${sso} » (attendu « ${L('profiles.authMethod.sso')} »)`
        )
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
        const file = join(userData, 'api-keys.json')
        check(
          existsSync(file) && !readFileSync(file, 'utf8').includes(KEY),
          'clé enregistrée chiffrée (jamais en clair sur le disque)'
        )
        const settings = await ui.ev(`window.api.settings.get().then((s) => JSON.stringify(s))`)
        check(
          !settings.includes(KEY) && !(await ui.ev(`document.body.innerHTML.includes('${KEY}')`)),
          'la clé ne revient jamais à l’interface'
        )
        await ui.click(ui.$('open-settings'))
        await ui.waitFor(`!!${ui.$('settings')}`)
        await ui.click(ui.$('settings-agents'))
        await ui.click(
          `document.querySelector('[data-testid="settings-agent"][data-agent="mock"]')`
        )
        const state = `(${ui.$('api-key-MOCK_AGENT_API_KEY')}?.querySelector('[data-testid=api-key-state]')?.innerText ?? '')`
        await ui.waitFor(`${state}.includes(${JSON.stringify(L('settings.apiKeys.state.stored'))})`)
        check(true, 'Réglages › Agents › page de l’agent : clé enregistrée')
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
        check(true, 'Réglages › Agents › page de l’agent : clé supprimée')
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
        // Seule la cause : ni le préfixe d'Electron ni « Error: » (fiche 087).
        const keyError = await ui.ev(`document.querySelector('.api-key-error').innerText`)
        check(!/Error/.test(keyError), `clé invalide refusée, avec un message (${keyError})`)
        await ui.key('Escape')
      },
      userData,
      'bob-auth-requise',
      { BOBINE_WORKSPACE: workspace }
    )

    // Clé chiffrée par une autre entrée du trousseau (ancien nom de l'app, fiche 069) : dite
    // illisible, pas « Enregistrée », et ressaisie.
    writeFileSync(
      join(userData, 'api-keys.json'),
      JSON.stringify({ version: 1, keys: { mock: { MOCK_AGENT_API_KEY: 'aWxsaXNpYmxl' } } })
    )
    await withApp(
      scheme,
      async (ui) => {
        await ui.waitFor(`!!${ui.$('blocker-auth')}`)
        check(true, 'clé illisible : l’agent démarre sans, connexion demandée')
        await ui.click(ui.$('open-settings'))
        await ui.waitFor(`!!${ui.$('settings')}`)
        await ui.click(ui.$('settings-agents'))
        await ui.click(
          `document.querySelector('[data-testid="settings-agent"][data-agent="mock"]')`
        )
        const row = ui.$('api-key-MOCK_AGENT_API_KEY')
        const state = `(${row}?.querySelector('[data-testid=api-key-state]')?.innerText ?? '')`
        await ui.waitFor(
          `${state}.includes(${JSON.stringify(L('settings.apiKeys.state.unreadable'))})`
        )
        check(true, 'Réglages › Agents › page de l’agent : clé illisible signalée')
        await ui.ev(`${ui.$('settings-api-keys')}.scrollIntoView({ block: 'center' })`)
        await ui.shot('f1b-cle-illisible')
        await ui.click(`${row}.querySelector('[data-testid=api-key-edit]')`)
        await ui.waitFor(`!!${ui.$('api-key-value')}`)
        await ui.ev(`${ui.$('api-key-value')}.focus()`)
        await ui.type(KEY)
        await ui.enter()
        await ui.waitFor(`${state}.includes(${JSON.stringify(L('settings.apiKeys.state.stored'))})`)
        check(true, 'clé ressaisie : de nouveau enregistrée')
        await ui.key('Escape')
      },
      userData,
      'bob-auth-requise',
      { BOBINE_WORKSPACE: workspace }
    )

    // Connexion dans un terminal (comme `opencode auth login`) : la commande du profil, puis Réessayer.
    await withApp(
      scheme,
      async (ui) => {
        await ui.waitFor(`!!${ui.$('blocker-auth')}`)
        await ui.click(ui.$('auth-mock-login'))
        await ui.waitFor(`${rows}.includes('touch .mock-agent-logged-in')`)
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
        await ui.waitFor(`${rows}.includes('licence-factice')`)
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
      check(!(await ui.ev(`!!${ui.$('auth-stuck')}`)), 'carte de connexion : pas de question')
      await ui.click(ui.$('auth-mock-sso'))
      await ui.waitFor(`!!${ui.$('auth-stuck')}`)
      const card = await ui.ev(`${ui.$('blocker-auth')}.innerText`)
      check(
        card.includes(L('blocker.auth.waitBrowser')) && card.includes(L('blocker.auth.stuck')),
        'attente du navigateur : la question « rien ne se passe ici ? » et « Réessayer »'
      )
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
  const settingsData = mkdtempSync(join(tmpdir(), 'bob-e2e-auth-trousseau-'))
  try {
    await withApp(
      scheme,
      async (ui) => {
        await ui.waitFor(`!!${ui.$('blocker-auth')}`)
        await ui.click(ui.$('open-settings'))
        await ui.waitFor(`!!${ui.$('settings')}`)
        await ui.click(ui.$('settings-agents'))
        await ui.click(
          `document.querySelector('[data-testid="settings-agent"][data-agent="mock"]')`
        )
        const row = ui.$('api-key-MOCK_AGENT_API_KEY')
        await ui.waitFor(`!!${row}`)
        await ui.click(`${row}.querySelector('[data-testid=api-key-edit]')`)
        await ui.waitFor(`!!${ui.$('api-key-value')}`)
        await ui.ev(`${ui.$('api-key-value')}.focus()`)
        await ui.type(KEY)
        await ui.enter()
        await ui.waitFor(`!!${row}.querySelector('[data-testid=keychain-wait]')`)
        check(
          (await ui.ev(`${ui.$('api-key-value')}.disabled`)) &&
            (await ui.ev(`${ui.$('api-key-submit')}.innerText`)).includes(
              L('settings.apiKeys.saving')
            ),
          'enregistrement en cours : champ et bouton désactivés, « Enregistrement… », trousseau attendu'
        )
        await ui.ev(`${row}.scrollIntoView({ block: 'center' }), true`)
        await still(ui)
        await ui.shot('207-2-cle-trousseau-attente')
        await ui.waitFor(`!!${row}.querySelector('[data-testid=api-key-error]')`, 10000)
        const error = await ui.ev(`${row}.querySelector('[data-testid=api-key-error]').innerText`)
        check(
          error === L('apiKeys.keychainTimeout', { seconds: 3 }) &&
            (await ui.ev(`${ui.$('api-key-value')}.value`)) === KEY &&
            !existsSync(join(settingsData, 'api-keys.json')),
          `délai dépassé : dit, valeur gardée, rien d’enregistré (${error})`
        )
        check(
          (await ui.ev(`${ui.$('api-key-submit')}.innerText`)).includes(
            L('settings.apiKeys.retry')
          ),
          'délai dépassé : « Réessayer »'
        )
        await still(ui)
        await ui.shot('207-3-cle-trousseau-delai')
        await ui.click(ui.$('api-key-submit'))
        const state = `(${row}?.querySelector('[data-testid=api-key-state]')?.innerText ?? '')`
        await ui.waitFor(
          `${state}.includes(${JSON.stringify(L('settings.apiKeys.state.stored'))})`,
          10000
        )
        check(
          existsSync(join(settingsData, 'api-keys.json')),
          `« Réessayer » : la même question au trousseau, puis la clé enregistrée`
        )
        await ui.key('Escape')
      },
      settingsData,
      'bob-auth-requise',
      { BOBINE_WORKSPACE: workspace, ...slow }
    )
  } finally {
    rmSync(settingsData, { recursive: true, force: true })
  }
  // Même traitement dans la carte « Connexion requise ».
  await withApp(
    scheme,
    async (ui) => {
      await ui.waitFor(`!!${ui.$('blocker-auth')}`)
      await ui.click(ui.$('auth-api-key'))
      await ui.waitFor(`document.activeElement === ${ui.$('api-key-input')}`)
      await ui.type(KEY)
      await ui.click(ui.$('api-key-save'))
      await ui.waitFor(`!!${ui.$('blocker-auth')}.querySelector('[data-testid=keychain-wait]')`)
      check(true, 'carte « Connexion requise » : le trousseau attendu est dit')
      await still(ui)
      await ui.shot('207-5-carte-cle-trousseau-attente')
      await ui.waitFor(`!!${ui.$('blocker-auth')}.querySelector('[data-testid=api-key-error]')`)
      check(
        (await ui.ev(`${ui.$('api-key-input')}.value`)) === KEY &&
          (await ui.ev(`${ui.$('api-key-save')}.innerText`)).includes(L('settings.apiKeys.retry')),
        'carte : délai dépassé, valeur gardée, « Réessayer »'
      )
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
