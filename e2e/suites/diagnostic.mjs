import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  L,
  Lpart,
  MAIN_PORT,
  check,
  mainProcess,
  processesUsing,
  root,
  sleep,
  withApp,
  M
} from '../lib.mjs'

const VERSION = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version

const BASE_PATH = '/usr/bin:/bin:/usr/sbin:/sbin'

/**
 * Diagnostic (fiche 061) : Réglages › Diagnostic et Aide › Diagnostic…, l'agent factice essayé
 * hors conversation (sans rien laisser chez lui), un blocage avec sa marche à suivre, le rapport.
 * Jamais de vrai agent : PATH sans Bob ni OpenCode, et un shell de connexion qui le garde.
 */
export async function diagnosticSuite(scheme) {
  console.log(`\n— Diagnostic (${scheme})`)
  const bin = mkdtempSync(join(tmpdir(), 'bob-e2e-diag-'))
  const shell = join(bin, 'zsh')
  // Appelé comme `zsh -ilc '<commande>'` : la commande, avec le PATH réduit.
  writeFileSync(shell, `#!/bin/sh\nPATH=${BASE_PATH}\nexport PATH\nexec /bin/sh -c "$2"\n`)
  chmodSync(shell, 0o755)
  const env = { PATH: BASE_PATH, SHELL: shell }
  const done = (ui) =>
    ui.waitFor(
      `!!${ui.$('diagnostics')} && !document.querySelector('[data-testid=diag-check][data-level=pending]')`,
      30_000
    )
  const row = (group, id) =>
    `document.querySelector('[data-testid="diag-group-${group}"] [data-testid=diag-check][data-id="${id}"]')`
  const rowState = (ui, group, id) =>
    ui.ev(
      `(() => { const r = ${row(group, id)}; return r ? r.dataset.level + ' | ' + r.innerText.replace(/\\s+/g, ' ') : 'absente' })()`
    )
  try {
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        await ui.click(ui.$('open-settings'))
        await ui.click(ui.$('settings-diagnostics'))
        await done(ui)
        const groups = await ui.ev(
          `[...document.querySelectorAll('[data-testid^=diag-group-]')].map((g) => g.dataset.testid.slice(11)).join(' ')`
        )
        check(
          groups ===
            'app environment agent:bob agent:opencode agent:mock mcp providers ios android',
          `groupes : l’app, l’environnement, chaque agent, MCP, fournisseurs, simulateurs (${groups})`
        )
        const mock = await rowState(ui, 'agent:mock', 'session')
        const start = await rowState(ui, 'agent:mock', 'start')
        check(
          start.startsWith('ok') &&
            start.includes(`${M('Agent factice')} 0.1.0`) &&
            mock.startsWith('ok') &&
            mock.includes(Lpart('diagnostics.agent.sessionReady')),
          `agent factice : démarré, session d’essai prête (${start} ; ${mock})`
        )
        const bob = await rowState(ui, 'agent:bob', 'command')
        check(
          bob.startsWith('optional') &&
            // Texte lu les blancs ramenés à une espace : insécables comprises (fiche 126).
            bob.includes(
              L('diagnostics.agent.commandMissing', { command: 'bob' }).replace(/\s+/g, ' ')
            ) &&
            bob.includes(L('diagnostics.action.reload-shell-env')),
          `Bob absent du PATH : facultatif, avec l’installation et « Relire le PATH » (${bob})`
        )
        check(
          (await rowState(ui, 'environment', 'shell-path')).startsWith('ok'),
          'PATH du shell de connexion lu'
        )
        check(
          (await rowState(ui, 'ios', 'axe')).startsWith('optional') &&
            (await rowState(ui, 'mcp', 'none')).startsWith('optional'),
          'facultatifs : AXe absent, aucun serveur MCP'
        )
        await ui.shot('k0-diagnostic')

        // Le journal en tête (fiche 133) : juste après le résumé, une ligne par fichier, puis le
        // niveau ; le chemin du dossier n'est plus répété dans « Bobine ».
        check(
          await ui.ev(
            `document.querySelector('[data-testid=diagnostics] > :nth-child(2)')?.dataset.testid === 'log-settings'`
          ),
          'diagnostic : la carte Journal suit le résumé'
        )
        check(
          (await ui.ev(
            `[...document.querySelectorAll('[data-testid=log-settings] .log-file-name')].map((e) => e.innerText).join(' ')`
          )) === 'main.log agents.log' &&
            !(await ui.ev(`!!document.querySelector('[data-testid=log-reveal-main]:disabled')`)) &&
            (await ui.ev(`!!${ui.$('log-level')}`)),
          'diagnostic : main.log et agents.log, « Afficher dans le Finder », puis le niveau'
        )
        check(
          (await rowState(ui, 'app', 'log')) === 'absente',
          'diagnostic : plus de chemin des journaux dans « Bobine »'
        )
        const journalMain = await mainProcess()
        await journalMain.evaluate(
          `(globalThis.__revealed = [], require('electron').shell.showItemInFolder = (p) => { globalThis.__revealed.push(p) }, true)`
        )
        await ui.click(ui.$('log-reveal-main'))
        await sleep(300)
        const revealed = await journalMain.evaluate(`globalThis.__revealed`)
        check(
          revealed.length === 1 && revealed[0].endsWith('main.log'),
          'diagnostic : l’icône du Finder montre main.log'
        )
        await ui.shot('k0-journal')

        // Rapport copié (le presse-papiers du Mac est remis après).
        const main = await mainProcess()
        try {
          const saved = await main.evaluate(`require('electron').clipboard.readText()`)
          await ui.click(ui.$('diagnostics-copy'))
          await ui.waitFor(
            `${ui.$('diagnostics-copy')}.getAttribute('aria-label') === ${JSON.stringify(L('copy.done'))}`
          )
          const report = await main.evaluate(`require('electron').clipboard.readText()`)
          await main.evaluate(
            `require('electron').clipboard.writeText(${JSON.stringify(saved ?? '')}), true`
          )
          check(
            report.startsWith(Lpart('diagnostics.report.title')) &&
              report.includes(
                `\n${L('profiles.mock.label')}\n  ✓ ${Lpart('diagnostics.report.check', { label: L('diagnostics.agent.command') })}`
              ) &&
              report.includes(
                `  – ${L('diagnostics.report.check', { label: L('diagnostics.agent.command'), detail: L('diagnostics.agent.commandMissing', { command: 'bob' }) })}`
              ),
            'rapport copié : une ligne par vérification'
          )

          // « Signaler un problème » (fiche 105) : issue GitHub préremplie (gabarit, version,
          // rapport), ouverte dans le navigateur système — remplacé ici pour ne pas l'ouvrir.
          const link = ui.$('diagnostics-report-issue')
          const href = await ui.ev(`${link}.getAttribute('href')`)
          const url = new URL(href)
          check(
            href.startsWith('https://github.com/jlallement/bobine/issues/new?template=bug.yml&') &&
              url.searchParams.get('version') === VERSION &&
              url.searchParams.get('report').startsWith(Lpart('diagnostics.report.title')) &&
              url.searchParams.get('report').includes(`\n${L('profiles.mock.label')}\n`) &&
              href.length <= 8_000,
            `« Signaler un problème » : issue préremplie, version ${VERSION}, rapport (${href.length} caractères)`
          )
          await main.evaluate(
            `(globalThis.__opened = [], require('electron').shell.openExternal = async (u) => { globalThis.__opened.push(u) }, true)`
          )
          await ui.click(link)
          await new Promise((r) => setTimeout(r, 500))
          const opened = await main.evaluate(`globalThis.__opened`)
          check(
            opened.length === 1 && opened[0] === href,
            `clic : ouvert dans le navigateur système, pas dans l'app (${opened.length} ouverture)`
          )

          // Rien laissé : ni conversation, ni session chez l'agent.
          await ui.key('Escape')
          await ui.waitFor(`!${ui.$('settings')}`)
          check(
            (await ui.ev(`document.querySelectorAll('.history-item').length`)) === 0,
            'aucune conversation dans l’historique'
          )
          await main.evaluate(
            `(require('electron').Menu.getApplicationMenu().getMenuItemById('resume-session').click(), true)`
          )
          await ui.waitFor(`!!${ui.$('resume-none')}`)
          check(true, 'session d’essai supprimée chez l’agent')
          await ui.key('Escape')
          await ui.waitFor(`!${ui.$('resume-dialog')}`)

          // Aide › Diagnostic… ; « Relancer ».
          await main.evaluate(
            `(require('electron').Menu.getApplicationMenu().getMenuItemById('diagnostics').click(), true)`
          )
        } finally {
          main.close()
        }
        await done(ui)
        check(true, 'Aide › Diagnostic… ouvre la page')
        await ui.click(ui.$('diagnostics-rerun'))
        await ui.waitFor(`!!document.querySelector('[data-testid=diag-check][data-level=pending]')`)
        await done(ui)
        check(true, '« Relancer » refait les vérifications')
      },
      undefined,
      'streaming-texte',
      env,
      // Presse-papiers et menu macOS depuis le process principal.
      [`--inspect=${MAIN_PORT}`]
    )

    // Connexion requise : le blocage, avec la marche à suivre.
    await withApp(
      scheme,
      async (ui) => {
        // La conversation attend elle aussi la connexion.
        await ui.waitFor(`!!${ui.$('blocker-auth')}`, 15_000)
        await ui.click(ui.$('open-settings'))
        await ui.click(ui.$('settings-diagnostics'))
        await done(ui)
        const auth = await rowState(ui, 'agent:mock', 'auth')
        check(
          auth.startsWith('error') &&
            auth.includes(L('diagnostics.agent.notSignedIn')) &&
            auth.includes(L('profiles.authMethod.sso')) &&
            auth.includes(L('diagnostics.agent.authApiKey')),
          `connexion requise : en erreur, avec les façons de se connecter (${auth})`
        )
        check(
          (await ui.ev(`${ui.$('diagnostics-summary')}.innerText`)).includes(
            L('diagnostics.summary.errors', { count: 1 })
          ),
          'résumé : 1 problème'
        )
        await ui.ev(`${row('agent:mock', 'auth')}.scrollIntoView({ block: 'center' })`)
        await ui.shot('k1-diagnostic-connexion')
        await ui.click(
          `${row('agent:mock', 'auth')}.querySelector('[data-testid=diag-action-open-agents-settings]')`
        )
        await ui.waitFor(
          `${ui.$('settings-agents')}.classList.contains('active') && ${ui.$('settings-agent-page')}?.dataset.agent === 'mock' && !!${ui.$('settings-api-keys')}`
        )
        check(true, '« Réglages › Agents » : la page de l’agent, avec ses clés d’API')
      },
      undefined,
      'bob-auth-requise',
      env
    )

    await quitDuringCheck(scheme, env)

    // Journal réglable (fiche 080) : Normal, Détaillé, Trace, à chaud ; agents.log ; Trace non
    // enregistré ; BOBINE_LOG impose le niveau.
    await journalChecks(scheme, env)
  } finally {
    rmSync(bin, { recursive: true, force: true })
  }
}

/**
 * Quitter pendant l'essai d'un agent (fiche 208) : l'agent lancé pour le diagnostic ne survit pas à
 * l'app, même s'il ignore SIGTERM et la fin de sa connexion, et n'écrit plus dans ses données.
 * Démarrage lent : l'essai est encore en cours quand l'app quitte.
 */
async function quitDuringCheck(scheme, env) {
  const userData = mkdtempSync(join(tmpdir(), 'bob-e2e-diag-quitter-'))
  const agents = () =>
    processesUsing(userData).filter((line) => line.includes('mock-agent/main.mts'))
  try {
    let during = []
    await withApp(
      scheme,
      async (ui) => {
        await ui.click(ui.$('open-settings'))
        await ui.click(ui.$('settings-diagnostics'))
        for (let i = 0; i < 100 && agents().length < 2; i++) await sleep(50)
        during = agents()
        check(
          during.length === 2 &&
            (await ui.ev(
              `!!document.querySelector('[data-testid="diag-group-agent:mock"] [data-level=pending]')`
            )),
          `essai de l’agent en cours (${during.length} agents : la conversation et l’essai)`
        )
      },
      userData,
      'streaming-texte',
      { ...env, MOCK_AGENT_SLOW_START_MS: '2500', MOCK_AGENT_TENACE: '1' }
    )
    const left = agents()
    check(
      left.length === 0,
      `quitter pendant l’essai : aucun agent ne survit à l’app (${left.join(' | ')})`
    )
    for (const line of left) process.kill(Number(line.split(/\s+/)[0]), 'SIGKILL')
  } finally {
    rmSync(userData, { recursive: true, force: true })
  }
}

async function journalChecks(scheme, env) {
  const server = createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end(
      '<title>Anime</title><body style="margin:0;height:100vh"><div id="c" style="position:absolute;left:0;top:40px;width:80px;height:80px;background:#c63;transition:left .6s"></div><script>addEventListener("click", () => { c.style.left = "200px" })</script>'
    )
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const userData = mkdtempSync(join(tmpdir(), 'bob-e2e-journal-'))
  const agentsLog = join(userData, 'logs', 'agents.log')
  const read = (file) => (existsSync(file) ? readFileSync(file, 'utf8') : '')
  const journalEnv = { ...env, MOCK_BROWSER_URL: `http://127.0.0.1:${server.address().port}/` }
  const openJournal = async (ui) => {
    await ui.click(ui.$('open-settings'))
    await ui.click(ui.$('settings-diagnostics'))
    await ui.waitFor(`!!${ui.$('log-level')}`)
    await ui.ev(`${ui.$('log-settings')}.scrollIntoView({ block: 'end' }); true`)
  }
  const choose = (ui, level) =>
    ui.ev(`(() => {
      const select = ${ui.$('log-level')}
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, '${level}')
      select.dispatchEvent(new Event('change', { bubbles: true }))
      return true
    })()`)
  const hint = (ui, level) =>
    ui.waitFor(
      `${ui.$('log-level-hint')}?.innerText.startsWith(${JSON.stringify(L(`diagnostics.log.hint.${level}`).slice(0, 40))})`
    )
  try {
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        await openJournal(ui)
        check(
          (await ui.ev(`${ui.$('log-level')}.value`)) === 'normal',
          'journal : Normal par défaut, réglable dans Réglages › Diagnostic'
        )
        await choose(ui, 'detailed')
        await hint(ui, 'detailed')
        await ui.key('Escape')
        await ui.waitFor(`!${ui.$('settings')}`)
        await ui.send('/scenario planche-contact')
        await ui.ready()
        const detailed = read(agentsLog)
        check(
          /→ session\/prompt #\d+ s /.test(detailed) &&
            /← réponse #\d+ session\/prompt end_turn en /.test(detailed) &&
            /MCP → browser_filmstrip$/m.test(detailed) &&
            /MCP ← browser_filmstrip en .*1 image\(s\)/.test(detailed) &&
            !detailed.includes('/scenario planche-contact'),
          'Détaillé, à chaud : échanges ACP et appels des outils de l’app dans agents.log, sans contenu'
        )
        await openJournal(ui)
        await choose(ui, 'trace')
        await hint(ui, 'trace')
        await ui.ev(`${ui.$('log-settings')}.scrollIntoView({ block: 'center' }); true`)
        await ui.shot('k2-journal')
        await ui.key('Escape')
        await ui.waitFor(`!${ui.$('settings')}`)
        await ui.send('/scenario planche-contact')
        await ui.ready()
        const traced = read(agentsLog)
        check(
          traced.includes('/scenario planche-contact') &&
            /MCP → browser_filmstrip : \{/.test(traced),
          'Trace : extraits du contenu (message, arguments des outils)'
        )
        const main = read(join(userData, 'logs', 'main.log'))
        check(
          /Agent lancé \(mock/.test(main) &&
            /Tour fini \(mock.*: end_turn en /.test(main) &&
            main.includes('Niveau du journal : trace'),
          'main.log : agent lancé, tours, niveau changé'
        )
        const settings = JSON.parse(read(join(userData, 'settings.json')))
        check(settings.logLevel === 'detailed', 'Trace n’est pas enregistré (Détaillé l’est)')
      },
      userData,
      'navigateur',
      journalEnv
    )
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        await openJournal(ui)
        check(
          (await ui.ev(`${ui.$('log-level')}.value`)) === 'detailed',
          'relancée : de nouveau Détaillé, pas Trace'
        )
      },
      userData,
      'navigateur',
      journalEnv
    )
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        await openJournal(ui)
        check(
          (await ui.ev(`${ui.$('log-level')}.value`)) === 'trace' &&
            (await ui.ev(`${ui.$('log-level')}.disabled`)) &&
            (await ui.ev(`${ui.$('log-level-hint')}.innerText`)).includes(
              L('diagnostics.log.imposed')
            ),
          'BOBINE_LOG impose le niveau : réglage grisé, et dit pourquoi'
        )
      },
      undefined,
      'navigateur',
      { ...journalEnv, BOBINE_LOG: 'trace' }
    )
  } finally {
    server.close()
    rmSync(userData, { recursive: true, force: true })
  }
}
