import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import {
  L,
  LANG,
  MAIN_PORT,
  NEUTRAL_AGENT_ENV,
  check,
  mainProcess,
  sleep,
  withApp
} from '../lib.mjs'

/**
 * Accueil du premier lancement (fiche 188) : Agent → Connexion → Dossier → Essai, avec l'agent
 * factice. Parcours complet (jamais remontré au redémarrage), aucun agent installé, connexion à
 * faire dans le terminal (900 px, terminal ouvert), connexion expirée à l'essai, annulation (agent
 * arrêté), plantage. Chaque app tourne sur un dossier de données neuf, avec `BOBINE_ONBOARDING=1`
 * (les autres suites ne voient pas l'accueil) et un dossier d'essai jetable.
 */
export async function onboardingSuite(scheme) {
  console.log(`\n— Accueil du premier lancement (${scheme})`)
  await fullJourney(scheme)
  await noAgent(scheme)
  await terminalLogin(scheme)
  await ssoStuck(scheme)
  await expiredAtTrial(scheme)
  await cancelAndCrash(scheme)
  await bobCost(scheme)
}

/**
 * Coût de l'essai pour un agent qui ne le donne pas par ACP mais l'écrit dans sa base, comme Bob
 * (recette 0.10, D10) : montré sur l'écran de succès et gardé dans le journal de consommation,
 * bien que la suppression de la session d'essai efface sa ligne dans la base de l'agent.
 */
async function bobCost(scheme) {
  const { userData, trial } = fresh()
  const home = mkdtempSync(join(tmpdir(), 'bob-e2e-accueil-home-'))
  const shown = new Intl.NumberFormat(LANG === 'en' ? 'en-US' : 'fr-FR', {
    maximumFractionDigits: 4
  }).format(0.0125)
  await withApp(
    scheme,
    async (ui) => {
      await toTrial(ui, mkdtempSync(join(tmpdir(), 'bob-e2e-accueil-bob-')))
      await ui.click(ui.$('onboarding-send'))
      await ui.waitFor(`!!${ui.$('onboarding-replied')}`, 30000)
      const text = await ui.ev(`${ui.$('onboarding-replied')}.innerText`)
      check(
        text.includes(shown),
        `essai « comme Bob » : coût lu dans la base de l’agent (${text.split('\n').at(-1)})`
      )
      await ui.shot('188-12-cout-comme-bob')
      await ui.click(ui.$('onboarding-start'))
      await ui.waitFor(`!${ui.$('onboarding')}`)
    },
    userData,
    'premier-essai',
    env(trial, {
      BOBINE_CONFIG_HOME: home,
      MOCK_AGENT_USAGE: 'bob',
      MOCK_AGENT_CURRENCY: 'bobcoins',
      MOCK_AGENT_COST_SOURCE: 'bob-db'
    }),
    [`--inspect=${MAIN_PORT}`]
  )
  const db = new DatabaseSync(join(userData, 'usage.sqlite'), { readOnly: true })
  try {
    const rows = db.prepare('SELECT cost_amount, cost_currency, stop_reason FROM turns').all()
    check(
      rows.some((r) => r.cost_amount === 0.0125 && r.cost_currency === 'bobcoins'),
      `« Mon activité » : le tour d’essai et son coût gardés (${JSON.stringify(rows)})`
    )
  } finally {
    db.close()
  }
  const bobDb = new DatabaseSync(join(home, '.bob', 'db', 'bob.db'), { readOnly: true })
  try {
    const tasks = bobDb.prepare('SELECT id FROM tasks').all()
    check(
      tasks.length === 0,
      `session d’essai supprimée de la base de l’agent (${tasks.length} tâche)`
    )
  } finally {
    bobDb.close()
  }
}

const fresh = () => ({
  userData: mkdtempSync(join(tmpdir(), 'bob-e2e-accueil-')),
  trial: mkdtempSync(join(tmpdir(), 'bob-e2e-accueil-essai-'))
})

/** Environnement d'un premier lancement réel : pas de dossier imposé, l'accueil demandé. */
const env = (trial, extra = {}, agentless = true) => ({
  BOBINE_DEFAULT_WORKSPACE: '',
  BOBINE_ONBOARDING: '1',
  BOBINE_TRIAL_DIR: trial,
  // Aucun vrai agent découvert, même s'il est installé sur la machine des essais. Son shell ne
  // lance rien : les essais qui passent par le terminal gardent le vrai, et choisissent l'agent
  // factice eux-mêmes.
  ...(agentless ? NEUTRAL_AGENT_ENV : {}),
  ...extra
})

/** Étape Agent : l'agent factice, quels que soient les vrais agents de la machine. */
async function chooseMock(ui) {
  await ui.waitFor(`!!${ui.$('onboarding-agent-mock')}`)
  await ui.click(`${ui.$('onboarding-agent-mock')}.querySelector('input')`)
  await ui.click(ui.$('onboarding-continue'))
}

const settingsOf = (userData) => JSON.parse(readFileSync(join(userData, 'settings.json'), 'utf8'))

/** Dialogue natif simulé : il rend ce dossier. */
async function stubFolderDialog(folder) {
  const main = await mainProcess()
  try {
    await main.evaluate(
      `(() => { require('electron').dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [${JSON.stringify(folder)}] }); return true })()`
    )
  } finally {
    main.close()
  }
}

/**
 * Processus de l'agent factice d'une app d'essai (essais et conversation) : reconnus à son dossier
 * de données (`--store`), jamais ceux des autres suites qui tournent en même temps.
 */
function mockAgentsIn(userData) {
  try {
    const out = execFileSync(
      '/bin/sh',
      ['-c', 'ps -axo pid=,command= | grep "mock-agent/main.mts" | grep -v grep || true'],
      {
        encoding: 'utf8'
      }
    )
    return out.split('\n').filter((line) => line.includes(userData)).length
  } catch {
    return 0
  }
}

async function toTrial(ui, project) {
  await ui.waitFor(`!!${ui.$('onboarding')}`)
  await ui.click(ui.$('onboarding-continue'))
  await ui.waitFor(`!!${ui.$('onboarding-ready')}`)
  await ui.click(ui.$('onboarding-continue'))
  await stubFolderDialog(project)
  await ui.click(ui.$('onboarding-choose-folder'))
  await ui.waitFor(`!!${ui.$('onboarding-send')}`)
}

async function fullJourney(scheme) {
  const { userData, trial } = fresh()
  const project = mkdtempSync(join(tmpdir(), 'bob-e2e-accueil-projet-'))
  writeFileSync(join(project, 'package.json'), JSON.stringify({ scripts: { test: 'vitest' } }))
  writeFileSync(join(project, 'pnpm-lock.yaml'), '')
  const args = [`--inspect=${MAIN_PORT}`]
  await withApp(
    scheme,
    async (ui) => {
      await ui.waitFor(`!!${ui.$('onboarding')}`)
      const text = await ui.ev(`${ui.$('onboarding')}.innerText`)
      check(
        text.includes(L('onboarding.agent.title')) &&
          (await ui.ev(`${ui.$('onboarding-agent-mock')}.querySelector('input').checked`)),
        'accueil : bienvenue, l’agent trouvé présélectionné'
      )
      check(
        (await ui.ev(`${ui.$('onboarding-agent-opencode')}.querySelector('input').disabled`)) &&
          (await ui.ev(`${ui.$('onboarding-agent-opencode')}.innerText`)).includes(
            L('onboarding.agent.missing')
          ),
        'agent introuvable : grisé, avec le conseil de son profil'
      )
      check(
        !(await ui.ev(`!!${ui.$('onboarding-skip-step')}`)),
        'étape Agent : pas de « Passer cette étape »'
      )
      await ui.shot('188-1-agent')

      await ui.click(ui.$('onboarding-continue'))
      await ui.waitFor(`!!${ui.$('onboarding-ready')}`)
      check(
        (await ui.ev(`${ui.$('onboarding-ready')}.innerText`)).includes(
          L('onboarding.connect.readyTitle', { agent: L('profiles.mock.label') })
        ),
        'connexion : « {agent} est prêt », sans message au modèle'
      )
      check(
        (await ui.ev(`document.activeElement?.dataset.testid`)) === 'onboarding-continue',
        'focus sur le bouton principal du nouvel état'
      )
      check(
        (await ui.ev(`document.querySelector('.sidebar-footer .name')?.innerText ?? ''`)) ===
          L('profiles.mock.label'),
        'barre latérale : l’agent choisi'
      )
      await ui.shot('188-2-connecte')

      await ui.click(ui.$('onboarding-continue'))
      await ui.waitFor(`!!${ui.$('onboarding-choose-folder')}`)
      await ui.shot('188-3-dossier')
      await stubFolderDialog(project)
      await ui.click(ui.$('onboarding-choose-folder'))
      await ui.waitFor(`!!${ui.$('onboarding-send')}`)
      check(
        (await ui.ev(`${ui.$('onboarding')}.innerText`)).includes('Answer with the single word OK'),
        'essai : le message à envoyer montré tel quel'
      )
      await ui.shot('188-4-essai')

      await ui.click(ui.$('onboarding-send'))
      await ui.waitFor(`!!${ui.$('onboarding-replied')}`, 30000)
      const replied = await ui.ev(`${ui.$('onboarding-replied')}.innerText`)
      check(replied.includes('OK'), `essai : la réponse de l’agent (${replied.split('\n')[1]})`)
      check(
        (await ui.ev(`document.activeElement?.dataset.testid`)) === 'onboarding-start',
        'essai réussi : « Commencer » a le focus'
      )
      await ui.shot('188-5-repondu')

      await ui.click(ui.$('onboarding-start'))
      await ui.waitFor(`!${ui.$('onboarding')} && !!${ui.$('welcome')}`)
      await ui.waitFor(`!!${ui.$('suggestion-run-tests')}`)
      check(
        (await ui.ev(`${ui.$('suggestion-run-tests')}.innerText`)).includes('pnpm test'),
        'première conversation : « Lance les tests » avec la commande du dossier (pnpm)'
      )
      check(
        (await ui.ev(`${ui.$('welcome-help')}.innerText`)).includes(
          L('onboarding.home.gettingStarted')
        ),
        'première conversation : liens vers l’aide (Premiers pas, Autorisations)'
      )
      await ui.click(ui.$('suggestion-run-tests'))
      check(
        (await ui.ev(`${ui.$('composer-input')}.value`)).includes('pnpm test') &&
          (await ui.ev(`document.querySelectorAll('.msg-user').length`)) === 0,
        'la suggestion remplit la saisie sans l’envoyer'
      )
      await ui.shot('188-6-premiere-conversation')
      check(settingsOf(userData).onboarding?.outcome === 'finished', 'marque « fini » enregistrée')
    },
    userData,
    'premier-essai',
    env(trial),
    args
  )
  // Relancée : plus jamais l'accueil.
  await withApp(
    scheme,
    async (ui) => {
      await ui.waitFor(`!!${ui.$('welcome')} || !!document.querySelector('.msg-user')`)
      await sleep(800)
      check(!(await ui.ev(`!!${ui.$('onboarding')}`)), 'relancée : l’accueil ne revient pas')
    },
    userData,
    'premier-essai',
    env(trial)
  )
}

async function noAgent(scheme) {
  const { userData, trial } = fresh()
  await withApp(
    scheme,
    async (ui) => {
      await ui.waitFor(`!!${ui.$('onboarding-no-agent')}`)
      const text = await ui.ev(`${ui.$('onboarding')}.innerText`)
      check(
        text.includes(L('onboarding.agent.noneSubtitle')) &&
          text.includes(L('profiles.commandMissing', { command: 'opencode' })),
        'aucun agent : sous-titre et conseils des profils, pas d’alerte'
      )
      await ui.shot('188-7-aucun-agent')
      await ui.click(ui.$('onboarding-search'))
      await ui.waitFor(
        `${ui.$('onboarding-still-none')}.innerText === ${JSON.stringify(L('onboarding.agent.stillNone'))}`
      )
      check(true, '« Chercher à nouveau » sans résultat : « Toujours aucun agent trouvé. »')
      await ui.click(ui.$('onboarding-explore'))
      await ui.waitFor(`!${ui.$('onboarding')}`)
      check(
        settingsOf(userData).onboarding?.outcome === 'skipped',
        'explorer sans agent : marqué passé'
      )
    },
    userData,
    'premier-essai',
    // Pas d'agent factice : seuls les vrais profils, introuvables dans ce PATH.
    env(trial, { BOBINE_AGENT_PROFILE: '' })
  )
}

async function terminalLogin(scheme) {
  const { userData, trial } = fresh()
  await withApp(
    scheme,
    async (ui) => {
      await chooseMock(ui)
      await ui.waitFor(`!!${ui.$('blocker-auth')}`)
      check(
        (await ui.ev(`${ui.$('auth-mock-login')}.title`)).includes('touch .mock-agent-logged-in'),
        'connexion à faire : la carte de connexion, avec la commande du profil'
      )
      await ui.click(ui.$('auth-mock-login'))
      await ui.waitFor(`!!document.querySelector('.terminal-host')`)
      await ui.viewport(900, 760)
      check(
        (await ui.ev(
          `${ui.$('onboarding-back-agent')}.querySelector('.label').getBoundingClientRect().width`
        )) <= 1 && (await ui.ev(`${ui.$('blocker-auth')}.getBoundingClientRect().width`)) >= 360,
        '900 px, terminal ouvert : étapes en numéros, carte lisible (≥ 360 px)'
      )
      await ui.shot('188-8-connexion-terminal-900')
      await ui.viewport()
      await ui.click(ui.$('retry'))
      await ui.waitFor(`!!${ui.$('onboarding-ready')}`, 20000)
      check(true, 'connecté depuis le terminal : « Réessayer », puis prêt')
    },
    userData,
    'connexion-terminal',
    env(trial, {}, false)
  )
}

/**
 * SSO fini dans le navigateur, mais l'agent ne répond jamais (fiche 207) : l'attente dit ce
 * qu'elle attend, et « Réessayer » vérifie de nouveau sans la connexion — l'agent de l'attente
 * est arrêté, le nouveau est connecté.
 */
async function ssoStuck(scheme) {
  const { userData, trial } = fresh()
  await withApp(
    scheme,
    async (ui) => {
      await chooseMock(ui)
      await ui.waitFor(`!!${ui.$('blocker-auth')}`)
      check(
        !(await ui.ev(`!!${ui.$('onboarding-stuck')}`)),
        'vérification simple : pas de « rien ne se passe ici ? »'
      )
      await ui.click(ui.$('auth-mock-sso'))
      await ui.waitFor(`!!${ui.$('onboarding-stuck')}`)
      const line = await ui.ev(`${ui.$('onboarding-waiting')}.innerText`)
      check(
        line.includes(L('blocker.auth.waitBrowser')) &&
          !line.includes(L('onboarding.connect.checking')),
        `attente du navigateur : « ${L('blocker.auth.waitBrowser')} »`
      )
      await sleep(2500)
      await ui.hover({ x: 5, y: 600 })
      await ui.ev(`document.activeElement?.blur(), true`)
      await ui.shot('207-1-accueil-sso-attente')
      await ui.click(ui.$('onboarding-stuck-retry'))
      await ui.waitFor(`!!${ui.$('onboarding-ready')}`, 20000)
      check(true, '« Réessayer » : nouvelle vérification sans la connexion, prêt')
      check(
        (await waitCount(userData, 0)) === 0,
        'l’agent resté en attente du navigateur est arrêté'
      )
    },
    userData,
    'sso-sans-retour',
    env(trial, {}, false)
  )
}

async function expiredAtTrial(scheme) {
  const { userData, trial } = fresh()
  await withApp(
    scheme,
    async (ui) => {
      await chooseMock(ui)
      await ui.waitFor(`!!${ui.$('onboarding-ready')}`)
      await ui.click(ui.$('onboarding-continue'))
      // Dossier d'essai vide, créé par Bobine (jamais dans un dossier non vide).
      await ui.click(ui.$('onboarding-trial-folder'))
      await ui.waitFor(`!!${ui.$('onboarding-send')}`)
      check(
        existsSync(join(trial, L('onboarding.trialFolderName'))),
        'dossier d’essai créé dans le dossier prévu'
      )
      await ui.click(ui.$('onboarding-send'))
      await ui.waitFor(`!!${ui.$('blocker-auth')}`, 20000)
      const card = await ui.ev(`${ui.$('blocker-auth')}.innerText`)
      check(
        card.includes(L('blocker.auth.expiredTitle')) && !card.includes('Authentication required'),
        'connexion expirée à l’essai : la carte « Connexion expirée », pas l’erreur brute'
      )
      await ui.shot('188-9-connexion-expiree')
      await ui.click(ui.$('auth-mock-login'))
      // La commande tourne dans le dossier réservé de l'app, jamais dans le projet.
      const marker = join(userData, 'workspace', '.mock-agent-logged-in')
      for (let i = 0; i < 50 && !existsSync(marker); i++) await sleep(100)
      check(
        existsSync(marker) &&
          !existsSync(join(trial, L('onboarding.trialFolderName'), '.mock-agent-logged-in')),
        'la commande du profil tourne dans le dossier réservé de l’app, pas dans le projet'
      )
      await ui.click(ui.$('retry'))
      await ui.waitFor(`!!${ui.$('onboarding-replied')}`, 30000)
      check(true, 'reconnecté : « Réessayer » relance l’essai, l’agent répond')
    },
    userData,
    'connexion-expiree',
    env(trial, {}, false)
  )
}

/** Attend que l'app ait `count` agents factices (5 s au plus) ; rend le dernier compte. */
async function waitCount(userData, count) {
  let n = mockAgentsIn(userData)
  for (let i = 0; i < 50 && n !== count; i++) {
    await sleep(100)
    n = mockAgentsIn(userData)
  }
  return n
}

/** Cmd+Q pendant l'essai : plus aucun agent de l'app, celui de l'essai compris. */
async function quitDuringTrial(scheme) {
  const { userData, trial } = fresh()
  await withApp(
    scheme,
    async (ui) => {
      await toTrial(ui, mkdtempSync(join(tmpdir(), 'bob-e2e-accueil-quitte-')))
      await sleep(1000)
      const before = mockAgentsIn(userData)
      await ui.click(ui.$('onboarding-send'))
      await ui.waitFor(`!!${ui.$('onboarding-waiting')}`)
      check((await waitCount(userData, before + 1)) === before + 1, 'essai en cours : son agent')
      const main = await mainProcess()
      try {
        await main.evaluate(
          `(() => { const { app } = require('electron'); setTimeout(() => app.quit(), 50); return true })()`
        )
      } catch {
        // La connexion au main se ferme avec l'app.
      } finally {
        main.close()
      }
      // Avant de quitter, l'app supprime les sessions des brouillons (3 s au plus).
      let left = await waitCount(userData, 0)
      for (let i = 0; i < 2 && left > 0; i++) left = await waitCount(userData, 0)
      if (left) {
        console.log(
          execFileSync(
            '/bin/sh',
            [
              '-c',
              `ps -axo pid,ppid,command= | grep ${JSON.stringify(userData)} | grep -v grep || true`
            ],
            { encoding: 'utf8' }
          )
        )
      }
      check(left === 0, `Cmd+Q pendant l’essai : aucun agent restant (${left})`)
    },
    userData,
    'attend-stop',
    env(trial),
    [`--inspect=${MAIN_PORT}`]
  )
}

async function cancelAndCrash(scheme) {
  const { userData, trial } = fresh()
  const project = mkdtempSync(join(tmpdir(), 'bob-e2e-accueil-annule-'))
  await withApp(
    scheme,
    async (ui) => {
      await toTrial(ui, project)
      // L'agent de la conversation tourne déjà dans le dossier : on compte ceux de l'essai.
      await sleep(1500)
      const before = mockAgentsIn(userData)
      await ui.click(ui.$('onboarding-send'))
      await ui.waitFor(`!!${ui.$('onboarding-waiting')}`)
      await sleep(600)
      const during = mockAgentsIn(userData)
      check(during === before + 1, `pendant l’essai : un agent de plus (${during} pour ${before})`)
      await ui.press('Escape')
      await ui.waitFor(`!!${ui.$('onboarding-cancelled')}`)
      check(true, 'Échap pendant l’essai : annulé')
      await ui.shot('188-10-annule')
      let left = mockAgentsIn(userData)
      // SIGTERM, puis SIGKILL au bout de 3 s (fiche 138) : 5 s au plus.
      for (let i = 0; i < 50 && left > before; i++) {
        await sleep(100)
        left = mockAgentsIn(userData)
      }
      check(left <= before, `aucun agent d’essai laissé derrière (${left} pour ${before} avant)`)
      check(readdirSync(project).length === 0, 'rien écrit dans le dossier pendant l’essai')

      // Fenêtre fermée pendant l'essai : l'agent de l'essai s'arrête avec elle.
      await ui.click(ui.$('onboarding-retry'))
      await ui.waitFor(`!!${ui.$('onboarding-waiting')}`)
      await waitCount(userData, before + 1)
      const main = await mainProcess()
      try {
        await main.evaluate(
          `(() => { require('electron').BrowserWindow.getAllWindows().filter((w) => !w.webContents.getURL().includes('#quick')).forEach((w) => w.close()); return true })()`
        )
      } finally {
        main.close()
      }
      check(
        (await waitCount(userData, before)) === before,
        'fenêtre fermée pendant l’essai : son agent arrêté'
      )
    },
    userData,
    'attend-stop',
    env(trial),
    [`--inspect=${MAIN_PORT}`]
  )
  await quitDuringTrial(scheme)
  const crash = fresh()
  await withApp(
    scheme,
    async (ui) => {
      await toTrial(ui, mkdtempSync(join(tmpdir(), 'bob-e2e-accueil-plante-')))
      await ui.click(ui.$('onboarding-send'))
      await ui.waitFor(`!!${ui.$('onboarding-error-crashed')}`, 30000)
      check(
        !(await ui.ev(`${ui.$('onboarding-error-crashed')}.querySelector('details').open`)) &&
          (await ui.ev(`document.activeElement?.dataset.testid`)) === 'onboarding-retry',
        'plantage : détails repliés, « Réessayer » a le focus'
      )
      await ui.shot('188-11-plantage')
    },
    crash.userData,
    'plantage',
    env(crash.trial),
    [`--inspect=${MAIN_PORT}`]
  )
}
