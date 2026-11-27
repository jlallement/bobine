import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { L, NEUTRAL_ENV, check, withApp } from '../lib.mjs'

/** Fausse commande de connexion (jamais le vrai OpenCode, jamais Figma, aucun réseau). */
const FAKE = fileURLToPath(new URL('../fake-opencode-mcp.mjs', import.meta.url))
/** Durée d'une tentative, raccourcie pour l'essai du délai (10 min dans l'app). */
const ATTEMPT_MS = 12_000
const FIGMA = 'https://mcp.figma.com/mcp'
/** Ce qui ne doit jamais sortir du main : paramètres de la page de connexion. */
const SECRETS = ['E2E_STATE', 'E2E_CHALLENGE', 'E2E_CLIENT', 'code_challenge', 'client_id']

/**
 * Figma en un clic (fiche 293, lot 2) : Réglages › Serveurs MCP › OpenCode, contre une fausse
 * commande imposée par `BOBINE_FAKE_MCP_AUTH` (gardée hors de l'app installée). La page de
 * connexion n'est jamais ouverte dans un navigateur : `BOBINE_OPEN_LOG` note l'ouverture, que
 * l'essai vérifie. Parcours : ajout et connexion, rouvrir, fermer et rouvrir les Réglages,
 * déconnexion, annulation, page inattendue, délai, « Dans un terminal », pas de page, expirée,
 * une connexion à la fois, serveur désactivé, retrait, onglet IBM Bob, agent absent.
 */
export async function mcpFigmaSuite(scheme) {
  console.log(`\n— Figma en un clic (${scheme})`)
  const root = mkdtempSync(join(tmpdir(), 'bob-e2e-figma-'))
  const home = join(root, 'home')
  const workspace = join(root, 'ws')
  const userData = join(root, 'data')
  const stateFile = join(root, 'fake-opencode.json')
  const openLog = join(root, 'open.log')
  for (const dir of [join(home, '.config', 'opencode'), workspace, userData]) {
    mkdirSync(dir, { recursive: true })
  }
  const configFile = join(home, '.config', 'opencode', 'opencode.json')
  writeFileSync(configFile, '{}\n')
  // Le dernier serveur retiré, le fichier n'est pas laissé vide (fiche 126, D2).
  const declared = () =>
    existsSync(configFile) && !!JSON.parse(readFileSync(configFile, 'utf8')).mcp?.figma
  const state = () => JSON.parse(readFileSync(stateFile, 'utf8'))
  const setState = (patch) => writeFileSync(stateFile, JSON.stringify({ ...state(), ...patch }))
  writeFileSync(stateFile, JSON.stringify({ mode: 'success', logout: 'ok', connected: {} }))
  const calls = () =>
    existsSync(`${stateFile}.calls`)
      ? readFileSync(`${stateFile}.calls`, 'utf8').split('\n').filter(Boolean).map(JSON.parse)
      : []
  const opened = () =>
    existsSync(openLog)
      ? readFileSync(openLog, 'utf8')
          .split('\n')
          .filter((l) => l.startsWith('external '))
          .map((l) => l.slice('external '.length))
      : []
  const env = {
    ...NEUTRAL_ENV,
    BOBINE_CONFIG_HOME: home,
    BOBINE_WORKSPACE: workspace,
    BOBINE_OPEN_LOG: openLog,
    BOBINE_FAKE_MCP_AUTH: FAKE,
    BOBINE_FAKE_MCP_AUTH_MS: String(ATTEMPT_MS),
    FAKE_OPENCODE_MCP_STATE: stateFile
  }
  try {
    await withApp(
      scheme,
      async (ui) => {
        const h = helpers(ui)
        await h.openTab('opencode')

        // 1. Figma à ajouter : carte pleine, logo officiel chargé, « Connecter Figma ».
        await ui.waitFor(`!!${ui.$('mcp-preset')}`)
        await ui.waitFor(
          `${ui.$('mcp-preset')}.querySelector('[data-testid=mcp-preset-logo]')?.complete === true`
        )
        const card = await ui.ev(`(() => {
          const card = ${ui.$('mcp-preset')}
          const logo = card.querySelector('[data-testid=mcp-preset-logo]')
          const button = card.querySelector('[data-testid=mcp-preset-connect]')
          return { alt: logo?.getAttribute('alt'), loaded: logo?.naturalWidth > 0, h: logo?.getBoundingClientRect().height, text: card.innerText, button: button?.innerText, disabled: button?.getAttribute('aria-disabled') }
        })()`)
        check(
          card.alt === '' &&
            card.loaded &&
            Math.round(card.h) === 56 &&
            card.button === L('mcp.preset.connect', { name: 'Figma' }) &&
            card.disabled === null &&
            card.text.includes(L('mcp.preset.figma.summary', { agent: 'OpenCode' })),
          `carte « Figma » : logo de 56 px chargé (alt vide), phrase, « Connecter Figma » (${JSON.stringify(card)})`
        )
        // Le fichier livré est l'officiel, octet pour octet (ni réécrit ni recoloré par le build).
        const digest = await ui.ev(`(async () => {
          const logo = ${ui.$('mcp-preset')}.querySelector('[data-testid=mcp-preset-logo]')
          const bytes = await (await fetch(logo.src)).arrayBuffer()
          const hash = await crypto.subtle.digest('SHA-256', bytes)
          return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('')
        })()`)
        check(
          digest === '9798b710e015c7f3fa6101779e323568d6a5a022651d427021262ce850467b07',
          `logo livré : sha256 du fichier officiel (${digest.slice(0, 12)}…)`
        )
        await h.contrast(
          'phrase de la carte',
          `${ui.$('mcp-preset')}.querySelector('.mcp-preset-summary')`
        )
        await h.contrast('bouton « Connecter Figma »', ui.$('mcp-preset-connect'))
        await h.shots('c0-figma-a-ajouter')

        // 2. Connecter : serveur ajouté pour tous les dossiers, commande lancée, page ouverte une fois.
        await ui.click(ui.$('mcp-preset-connect'))
        await h.waitStatus('connecting')
        await ui.waitFor(`!${ui.$('mcp-preset')}`)
        const config = JSON.parse(readFileSync(configFile, 'utf8'))
        check(
          config.mcp?.figma?.type === 'remote' && config.mcp.figma.url === FIGMA,
          `« Connecter Figma » : serveur « figma » ajouté pour tous les dossiers (${JSON.stringify(config.mcp)})`
        )
        await waitUntil(() => opened().length >= 1)
        const page = opened()[0]
        check(
          page.startsWith('https://www.figma.com/oauth/mcp?') &&
            page.includes('redirect_uri=http%3A%2F%2F127.0.0.1%3A54321%2Fcallback'),
          'page de connexion vérifiée puis ouverte une fois (interceptée : jamais un vrai navigateur)'
        )
        check(
          calls().some((c) => c.join(' ') === 'mcp auth figma --standalone'),
          'commande lancée : `mcp auth figma --standalone` (fausse commande)'
        )
        check(
          (await h.text()) === L('mcp.auth.pending', { host: 'www.figma.com' }) &&
            (await h.links()).join('|') === [L('mcp.auth.reopen'), L('common.cancel')].join('|') &&
            (await h.dot()) === 'testing' &&
            !(await ui.ev(`!!${h.row()}.querySelector('[data-testid=mcp-test]')`)),
          'en cours : hôte visible, « Rouvrir la page · Annuler », pastille qui pulse, pas de « Tester »'
        )
        await h.noSecretInDom()
        await h.oneLine()
        await h.contrast('état neutre (en cours)', `${h.row()}.querySelector('.st')`)
        await h.contrast('lien d’action', h.link('reopen'))
        await h.contrast('séparateur « · »', `${h.row()}.querySelector('.sep')`)
        await h.shots('c1-figma-en-cours')
        await ui.click(h.link('reopen'))
        await waitUntil(() => opened().length >= 2)
        check(opened()[1] === page, '« Rouvrir la page » : la même adresse vérifiée, rouverte')

        // Réglages fermés puis rouverts pendant la connexion : toujours « en cours ».
        await ui.key('Escape')
        await ui.waitFor(`!${ui.$('settings')}`)
        await h.openTab('opencode')
        await h.waitStatus('connecting')
        check(true, 'Réglages fermés puis rouverts : la connexion est retrouvée « en cours »')

        // 3. Accord sur la page (simulé) : « Connecté par OpenCode ».
        setState({ approve: true })
        await h.waitStatus('connected')
        check(
          (await h.text()) === L('mcp.auth.connected', { agent: 'OpenCode' }) &&
            (await h.links()).join() === L('mcp.auth.disconnect') &&
            (await h.dot()) === 'ok',
          'connecté : « Connecté par OpenCode · Se déconnecter », pastille verte'
        )
        await h.oneLine()
        await h.contrast('état connecté (vert)', `${h.row()}.querySelector('.st')`)
        await h.shots('c2-figma-connecte')

        // 4. Se déconnecter : confirmation dans la ligne (fiche 126), puis état relu.
        await ui.click(h.link('disconnect'))
        await ui.waitFor(`!!${h.row()}.querySelector('[data-testid=confirm-row]')`)
        check(
          (await ui.ev(`${h.row()}.querySelector('[data-testid=confirm-row]').innerText`)).includes(
            L('mcp.auth.disconnectAsk', { name: 'Figma', agent: 'OpenCode' })
          ) && (await ui.ev(`${h.link('disconnect')}.getAttribute('aria-expanded')`)) === 'true',
          'se déconnecter : confirmation dans la ligne, rien de lancé au premier clic'
        )
        await h.shots('c3-figma-deconnexion')
        await ui.click(`${h.row()}.querySelector('[data-testid=confirm-row-confirm]')`)
        await h.waitStatus('to-connect')
        check(
          !state().connected.figma &&
            calls().some((c) => c.join(' ') === 'mcp logout figma --standalone') &&
            (await h.text()) === L('mcp.auth.toConnect'),
          'déconnecté : `mcp logout figma --standalone`, état relu « À connecter », serveur gardé'
        )
        await h.shots('c4-figma-a-connecter')

        // 4 bis. Connexion expirée, relue à l'ouverture de l'onglet (avant toute tentative en échec :
        // la fin d'une tentative reste montrée jusqu'à une connexion relue, lot 1).
        setState({ connected: { figma: 'expired' } })
        await h.openTab('bob')
        await h.openTab('opencode')
        await h.waitStatus('expired')
        check(
          (await h.text()) === L('mcp.auth.expired') &&
            (await h.links()).join() === L('mcp.auth.reconnect') &&
            (await h.dot()) === 'warn',
          'expirée (relue chez l’agent) : « Connexion expirée · Se reconnecter », pastille ambre'
        )
        await h.contrast('état expiré (ambre)', `${h.row()}.querySelector('.st')`)
        await h.shots('c9-figma-expire')

        setState({ connected: {} })

        // 5. Annuler une connexion en cours.
        setState({ mode: 'hang' })
        await ui.click(h.link('reconnect'))
        await h.waitStatus('connecting')
        await ui.click(h.link('cancel'))
        await h.waitStatus('to-connect')
        check(true, '« Annuler » : commande arrêtée, état relu « À connecter »')

        // 6. Page inattendue : rien d'ouvert, erreur avec l'hôte.
        const before = opened().length
        setState({ mode: 'unexpected' })
        await ui.click(h.link('connect'))
        await h.waitStatus('error')
        const [before0, after0] = L('mcp.auth.reason.unexpectedPage', { host: '|' })
          .replace(/<\/?host>/g, '')
          .split('|')
        // Texte montré : le texte lu par un lecteur d'écran (hôte entier, masqué) en moins.
        const shown = (
          await ui.ev(`${h.row()}.querySelector('[data-testid=mcp-auth-text]').textContent`)
        ).replace('www.figma.com.evil.test', '')
        check(
          shown === `${before0}…com.evil.test${after0}` &&
            (await ui.ev(
              `${h.row()}.querySelector('[data-testid=mcp-auth-host] [aria-hidden=true]').innerText`
            )) === '…com.evil.test' &&
            (await ui.ev(`${h.row()}.querySelector('[data-testid=mcp-auth-host]').title`)) ===
              'www.figma.com.evil.test' &&
            opened().length === before &&
            (await h.links()).join('|') ===
              [L('mcp.auth.retry'), L('mcp.auth.inTerminal')].join('|') &&
            (await h.dot()) === 'error',
          `page inattendue : rien d’ouvert, « ${shown} · Réessayer · Dans un terminal », hôte entier au survol`
        )
        await h.oneLine()
        await h.contrast('état en erreur (rouge)', `${h.row()}.querySelector('.st')`)
        await h.shots('c5-figma-erreur-page')

        // 7. Délai (raccourci) : la commande est arrêtée, « Pas de réponse en 10 min ».
        setState({ mode: 'hang' })
        await ui.click(h.link('retry'))
        await h.waitStatus('connecting')
        await ui.waitFor(
          `${h.row()}?.querySelector('[data-testid=mcp-auth]')?.dataset.status === 'error'`,
          ATTEMPT_MS + 20_000
        )
        check(
          (await h.text()) === L('mcp.auth.reason.timeout', { minutes: 10 }),
          'délai dépassé (raccourci en essai) : « Pas de réponse en 10 min »'
        )
        await h.shots('c6-figma-erreur-delai')

        // 8. « Dans un terminal » : la commande copiée, montrée ; « Réessayer ici ».
        await ui.click(h.link('terminal'))
        await ui.waitFor(`!!${h.row()}.querySelector('[data-testid=mcp-auth] code')`)
        check(
          (await ui.ev(`${h.row()}.querySelector('[data-testid=mcp-auth] code').innerText`)) ===
            'opencode mcp auth figma' && (await h.links()).join() === L('mcp.auth.retryHere'),
          '« Dans un terminal » : « Copiée : opencode mcp auth figma · Réessayer ici »'
        )
        await h.oneLine()
        await h.shots('c7-figma-commande-copiee')

        // 9. Pas de page de connexion (commande inconnue : OpenCode trop ancien).
        setState({ mode: 'unknown-command' })
        await ui.click(h.link('retryHere'))
        await h.waitStatus('no-page')
        check(
          (await h.text()) === L('mcp.auth.noPage') &&
            (await h.links()).join('|') ===
              [L('mcp.auth.inTerminal'), L('mcp.auth.retry')].join('|'),
          'commande non reconnue : « Pas de page de connexion · Dans un terminal · Réessayer »'
        )
        await h.oneLine()
        await h.shots('c8-figma-pas-de-page')

        // 10. Une connexion à la fois : l'autre « Se connecter » grisé, avec sa raison (fiche 287).
        setState({ mode: 'hang', connected: {} })
        const project = join(workspace, 'opencode.json')
        writeFileSync(
          project,
          JSON.stringify({ mcp: { maquettes: { type: 'remote', url: FIGMA } } })
        )
        // Fichier changé hors de l'app : les Réglages rouverts le relisent.
        await h.reopen()
        await h.waitStatus('to-connect', 'maquettes')
        // La fin de la dernière tentative reste montrée (« Pas de page de connexion »).
        await h.waitStatus('no-page')
        await ui.click(h.link('retry'))
        await h.waitStatus('connecting')
        const other = await ui.ev(`(() => {
          const b = ${h.link('connect', 'maquettes')}
          return { disabled: b.getAttribute('aria-disabled'), reason: b.dataset.reason }
        })()`)
        check(
          other.disabled === 'true' && other.reason === L('mcp.auth.busy'),
          `une connexion à la fois : l’autre « Se connecter » grisé, raison « ${other.reason} »`
        )
        // Au clavier : le lien grisé reste atteignable (Tab), sa raison au focus.
        await ui.ev(`${h.link('cancel')}.focus()`)
        const focus = await ui.ev(`(() => {
          const s = document.activeElement
          const o = getComputedStyle(s)
          return { id: s.dataset.testid, outline: o.outlineStyle }
        })()`)
        check(
          focus.id === 'mcp-auth-cancel',
          'actions atteignables au clavier (focus sur « Annuler »)'
        )
        await h.contrast('lien grisé (raison au survol)', h.link('connect', 'maquettes'))
        await h.shots('c10-figma-une-a-la-fois')
        await ui.click(h.link('cancel'))
        await h.waitStatus('to-connect')
        rmSync(project)

        // 11. Serveur désactivé : dit, rien à lancer.
        // Fichier changé hors de l'app : les Réglages rouverts le relisent.
        await h.reopen()
        await ui.waitFor(`!${h.row('maquettes')}`)
        await ui.click(`${h.row()}.querySelector('[data-testid=mcp-enabled]')`)
        await ui.waitFor(
          `(${h.row()}?.querySelector('[data-testid=mcp-auth-text]')?.innerText ?? '') === ${JSON.stringify(L('mcp.auth.disabled'))}`
        )
        check(
          (await h.links()).length === 0,
          'serveur désactivé : dit dans la ligne, aucune action'
        )
        await ui.click(`${h.row()}.querySelector('[data-testid=mcp-enabled]')`)
        await h.waitStatus('to-connect')

        // 12. Retrait d'un serveur connecté : la confirmation le dit ; la carte revient.
        setState({ mode: 'success' })
        await ui.click(h.link('connect'))
        await h.waitStatus('connecting')
        setState({ approve: true })
        await h.waitStatus('connected')
        await ui.click(`${h.row()}.querySelector('[data-testid=mcp-remove]')`)
        await ui.waitFor(`!!${h.row()}.querySelector('[data-testid=confirm-row]')`)
        check(
          (await ui.ev(`${h.row()}.querySelector('[data-testid=confirm-row]').innerText`)).includes(
            L('mcp.auth.removeAskConnected', { name: 'figma', agent: 'OpenCode' })
          ),
          'supprimer un serveur connecté : « OpenCode garde l’accès tant que vous ne vous déconnectez pas »'
        )
        await ui.click(`${h.row()}.querySelector('[data-testid=confirm-row-confirm]')`)
        await ui.waitFor(`!${h.row()} && !!${ui.$('mcp-preset')}`)
        check(!declared(), 'retiré : déclaration enlevée, la carte « Figma » revient')

        // 13. Onglet IBM Bob : une ligne d'aide, le lien ouvre la liste de Figma (par le main).
        await h.openTab('bob')
        await ui.waitFor(`!!${ui.$('mcp-preset-help')}`)
        check(
          (await ui.ev(`${ui.$('mcp-preset-help')}.innerText`)).includes(
            L('mcp.preset.notOffered', { name: 'Figma', agent: 'IBM Bob', agents: 'OpenCode' })
          ) && !(await ui.ev(`!!${ui.$('mcp-preset')}`)),
          'onglet IBM Bob : ligne d’aide d’après les profils, ni carte ni bouton'
        )
        await h.contrast('ligne d’aide (IBM Bob)', ui.$('mcp-preset-help'))
        await h.contrast('lien « Liste de Figma »', ui.$('mcp-preset-list'))
        await h.shots('c11-figma-onglet-bob')
        await ui.click(ui.$('mcp-preset-list'))
        await waitUntil(() =>
          opened().includes('https://developers.figma.com/docs/figma-mcp-server/')
        )
        check(true, '« Liste de Figma » : adresse du préréglage ouverte par le main')

        // Jamais l'adresse de la page hors du main : ni DOM, ni sortie, ni journaux.
        await h.noSecretInDom()
        const logs = readdirSync(join(userData, 'logs'), { withFileTypes: true })
          .filter((f) => f.isFile())
          .map((f) => readFileSync(join(userData, 'logs', f.name), 'utf8'))
          .join('\n')
        const leaks = SECRETS.filter((s) => logs.includes(s) || ui.output().includes(s))
        check(
          leaks.length === 0 && /MCP : connexion de « figma »/.test(logs + ui.output()),
          `journaux et sortie de l’app : connexion notée, aucune adresse de page (${leaks.join(', ') || 'rien'})`
        )
        await ui.key('Escape')
      },
      userData,
      'demo',
      env
    )

    const low = Object.entries(ratios).filter(([, r]) => r < 4.5)
    check(
      low.length === 0,
      `contrastes (${scheme}) : ${Object.entries(ratios)
        .map(([k, r]) => `${k} ${r}`)
        .join(' ; ')}`
    )

    // 14. Agent absent : la carte, bouton grisé, raison en clair dessous.
    await withApp(
      scheme,
      async (ui) => {
        const h = helpers(ui)
        await h.openTab('opencode')
        await ui.waitFor(`!!${ui.$('mcp-preset-reason')}`)
        const absent = await ui.ev(`(() => {
          const b = ${ui.$('mcp-preset-connect')}
          return { disabled: b.getAttribute('aria-disabled'), reason: ${ui.$('mcp-preset-reason')}.innerText }
        })()`)
        check(
          absent.disabled === 'true' &&
            absent.reason === L('mcp.auth.agentMissing', { agent: 'OpenCode' }),
          `agent absent : « Connecter Figma » grisé, « ${absent.reason} » dessous`
        )
        await h.shots('c12-figma-agent-absent')
        await ui.click(ui.$('mcp-preset-connect'))
        check(!declared(), 'agent absent : le clic ne fait rien (rien d’écrit, rien de lancé)')
      },
      undefined,
      'demo',
      { ...env, BOBINE_FAKE_MCP_AUTH: '' }
    )

    // 15. Menu « Réglages de la session » (lecture seule) : l'état de connexion, jamais « pas encore
    // testé ». L'agent factice y lit et connecte ses serveurs comme OpenCode (`MOCK_AGENT_MCP_OAUTH`).
    writeFileSync(configFile, JSON.stringify({ mcp: { figma: { type: 'remote', url: FIGMA } } }))
    setState({ mode: 'hang', connected: { figma: 'ok' } })
    const callsBefore = calls().length
    await withApp(
      scheme,
      async (ui) => {
        const row = `[...document.querySelectorAll('[data-testid=session-mcp]')].find((r) => r.innerText.startsWith('figma'))`
        const menu = async () => {
          await ui.click(ui.$('session-settings'))
          await ui.waitFor(`!!${row}`)
          return ui.ev(
            `({ auth: ${row}.dataset.auth, state: ${row}.dataset.state, text: ${row}.innerText.replace(/\\s+/g, ' ') })`
          )
        }
        const connected = await menu()
        check(
          connected.auth === 'connected' &&
            connected.state === 'ok' &&
            connected.text.includes(L('mcp.state.connected')) &&
            !connected.text.includes(L('sessionSettings.mcp.testing')),
          `menu ⚙ : « ${connected.text} » (état de connexion, jamais « test… »)`
        )
        await ui.shot('c13-figma-menu-session')
        await ui.key('Escape')
        setState({ connected: { figma: 'expired' } })
        const expired = await menu()
        check(
          expired.auth === 'expired' && expired.text.includes(L('mcp.state.expired')),
          `menu ⚙ rouvert : l’état relu (« ${expired.text} »)`
        )
        await ui.shot('c14-figma-menu-session-expire')
        await ui.key('Escape')
        check(
          !calls()
            .slice(callsBefore)
            .some((c) => c[0] === 'mcp' && c[1] === 'auth'),
          'menu ⚙ : lecture seule, aucune connexion lancée'
        )
      },
      undefined,
      'demo',
      { ...env, MOCK_AGENT_MCP_OAUTH: 'opencode' }
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

async function waitUntil(test, ms = 10_000) {
  const end = Date.now() + ms
  while (!test()) {
    if (Date.now() > end) throw new Error('attente dépassée')
    await new Promise((r) => setTimeout(r, 100))
  }
}

/** Raccourcis de la suite : ligne d'un serveur, son état, ses liens, captures à deux largeurs. */
/** Contrastes relevés pendant la suite (libellé → rapport), vérifiés et dits à la fin. */
const ratios = {}

function helpers(ui) {
  const row = (name = 'figma') =>
    `[...document.querySelectorAll('[data-testid=mcp-server]')].find((s) => s.dataset.name === ${JSON.stringify(name)})`
  const line = (name = 'figma') => `${row(name)}?.querySelector('[data-testid=mcp-auth]')`
  const openTab = async (profileId) => {
    if (!(await ui.ev(`!!${ui.$('settings')}`))) {
      await ui.click(ui.$('open-settings'))
      await ui.waitFor(`!!${ui.$('settings')}`)
      await ui.click(ui.$('settings-mcp'))
      await ui.waitFor(`!!${ui.$('mcp-settings')}`)
    }
    await ui.waitFor(`!!${ui.$(`mcp-agent-${profileId}`)}`)
    await ui.click(ui.$(`mcp-agent-${profileId}`))
    await ui.waitFor(`${ui.$(`mcp-agent-${profileId}`)}.getAttribute('aria-selected') === 'true'`)
  }
  return {
    row,
    link: (id, name = 'figma') => `${row(name)}?.querySelector('[data-testid=mcp-auth-${id}]')`,
    openTab,
    reopen: async () => {
      await ui.key('Escape')
      await ui.waitFor(`!${ui.$('settings')}`)
      await openTab('opencode')
    },
    waitStatus: (status, name = 'figma') =>
      ui.waitFor(`${line(name)}?.dataset.status === ${JSON.stringify(status)}`, 20_000),
    text: (name = 'figma') =>
      ui.ev(`${line(name)}.querySelector('[data-testid=mcp-auth-text]').innerText`),
    links: (name = 'figma') =>
      ui.ev(`[...${line(name)}.querySelectorAll('button')].map((b) => b.innerText)`),
    dot: (name = 'figma') =>
      ui.ev(`${row(name)}.querySelector('[data-testid=mcp-dot]').dataset.state`),
    /**
     * Contrastes mesurés (WCAG, texte de 11,5 à 12,5 px : 4,5 au moins) : couleur calculée de chaque
     * élément contre le fond calculé le plus proche, notés dans `ratios` pour le relevé de fin.
     */
    contrast: async (label, selector) => {
      const ratio = await ui.ev(`(() => {
        const el = ${selector}
        const rgb = (c) => (c.match(/[\\d.]+/g) || []).slice(0, 4).map(Number)
        let node = el, bg = [0, 0, 0, 0]
        while (node && (bg = rgb(getComputedStyle(node).backgroundColor))[3] === 0) node = node.parentElement
        const lum = ([r, g, b]) => [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0)
        const a = lum(rgb(getComputedStyle(el).color)), b = lum(bg)
        return Math.round(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 100) / 100
      })()`)
      ratios[label] = ratio
    },
    noSecretInDom: async () => {
      const html = await ui.ev('document.documentElement.outerHTML')
      const found = SECRETS.filter((s) => html.includes(s))
      check(
        found.length === 0,
        `aucune adresse de page dans le DOM (${found.join(', ') || 'rien'})`
      )
    },
    /**
     * Un état = une ligne à 940 px ; deux au plus à 736 px, jamais un « · » en début de ligne, rien
     * qui déborde (fiche 293).
     */
    oneLine: async (name = 'figma') => {
      // Dans l'app installée, une ligne d'OpenCode a une copie (vers IBM Bob) ; l'essai a en plus
      // l'agent factice, et sa copie (36 px) rétrécit la colonne : masquée le temps de la mesure,
      // pour mesurer la largeur réelle (dite dans la fiche).
      const mock = JSON.stringify(L('mcp.server.copy', { agent: L('profiles.mock.label') }))
      const hideMock = (shown) =>
        ui.ev(
          `[...${row(name)}.querySelectorAll('[data-testid=mcp-copy]')].filter((b) => b.title === ${mock}).forEach((b) => (b.style.display = ${shown ? "''" : "'none'"}))`
        )
      await hideMock(false)
      const measure = () =>
        ui.ev(`(() => {
          const line = ${line(name)}
          const lh = parseFloat(getComputedStyle(line).lineHeight)
          const lines = Math.round(line.getBoundingClientRect().height / lh)
          const left = line.getBoundingClientRect().left
          const sepFirst = [...line.querySelectorAll('.sep')].some((s) => s.getBoundingClientRect().left <= left + 1)
          return { lines, sepFirst, overflow: line.scrollWidth > line.clientWidth + 1, width: Math.round(document.querySelector('.settings-dialog').getBoundingClientRect().width) }
        })()`)
      const wide = await measure()
      await ui.viewport(800)
      const narrow = await measure()
      await ui.viewport()
      await hideMock(true)
      check(
        wide.lines === 1 &&
          narrow.lines <= 2 &&
          !wide.sepFirst &&
          !narrow.sepFirst &&
          !wide.overflow &&
          !narrow.overflow,
        `un état = une ligne à ${wide.width} px (${wide.lines}), ${narrow.lines} à ${narrow.width} px, jamais « · » en tête, rien ne déborde`
      )
    },
    shots: async (name) => {
      await ui.shot(`${name}-940`)
      await ui.viewport(800)
      await ui.shot(`${name}-736`)
      await ui.viewport()
    }
  }
}
