import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { L, check, sleep, withApp } from '../lib.mjs'

const MCP_FIXTURE = fileURLToPath(new URL('../fixtures/mcp-serveur.mjs', import.meta.url))

/**
 * Dossier personnel jetable avec un serveur MCP de l'agent (au format de Bob, que le profil
 * factice lit) ; chaque lancement du serveur est noté dans `mark`.
 */
function mcpHome() {
  const home = mkdtempSync(join(tmpdir(), 'bob-e2e-session-home-'))
  const mark = join(home, 'lancements.txt')
  mkdirSync(join(home, '.bob', 'settings'), { recursive: true })
  writeFileSync(
    join(home, '.bob', 'settings', 'mcp.json'),
    JSON.stringify({
      mcpServers: {
        essai: { command: process.execPath, args: [MCP_FIXTURE], env: { MCP_FIXTURE_MARK: mark } }
      }
    })
  )
  const launches = () => (existsSync(mark) ? readFileSync(mark, 'utf8').split('\n').length - 1 : 0)
  return { home, launches }
}

/**
 * Dépôt git jetable : un fichier modifié (ligne « +N −M »), un fichier de lancement (serveur de
 * dev, fiche 030).
 */
async function project() {
  const workspace = mkdtempSync(join(tmpdir(), 'bob-e2e-session-'))
  const git = (...args) =>
    execFileSync('git', ['-c', 'user.name=e2e', '-c', 'user.email=e2e@example.invalid', ...args], {
      cwd: workspace,
      encoding: 'utf8'
    }).trim()
  writeFileSync(join(workspace, 'README.md'), '# Carnet\n\nVersion 1\n')
  const probe = createServer()
  await new Promise((r) => probe.listen(0, '127.0.0.1', r))
  const port = probe.address().port
  await new Promise((r) => probe.close(r))
  mkdirSync(join(workspace, '.bob'))
  writeFileSync(
    join(workspace, '.bob/launch.json'),
    JSON.stringify({
      version: '0.0.1',
      configurations: [
        { name: 'web', runtimeExecutable: process.execPath, runtimeArgs: ['server.js'], port }
      ]
    })
  )
  writeFileSync(
    join(workspace, 'server.js'),
    `require('node:http').createServer((q, r) => r.end('<title>Mon app</title><h1>Mon app</h1>'))
      .listen(Number(process.env.PORT), '127.0.0.1', () => console.log('prêt'))`
  )
  git('init', '-q', '-b', 'main')
  git('add', '.')
  git('commit', '-q', '-m', 'init')
  // Modifié depuis le dernier commit : 3 lignes ajoutées, 1 retirée.
  writeFileSync(join(workspace, 'README.md'), '# Carnet\n\nVersion 2\n\nNouvelle ligne\n')
  return workspace
}

/** Outils communs aux deux lancements de l'app. */
function helpers(ui) {
  const tab = ui.$('session-tab')
  const lines = () =>
    ui.ev(
      `[...${tab}.querySelectorAll('[data-testid=session-line]')].map((l) => l.dataset.line).join()`
    )
  const value = (line) =>
    ui.ev(
      `${tab}.querySelector('[data-line=${line}] [data-testid=session-line-value]')?.innerText ?? ''`
    )
  /**
   * Jetons exacts d'une ligne (`data-tokens`), pas le texte affiché : « ≈ 1,4k » réduit à ses
   * chiffres donnait 14, plus petit que « ≈ 29 ».
   */
  const tokens = (line) =>
    ui.ev(`Number(${tab}.querySelector('[data-line=${line}]')?.dataset.tokens ?? NaN)`)
  const entries = (kind) =>
    ui.ev(
      `[...${ui.$('session-running')}.querySelectorAll('ul:not(.finished) [data-testid=session-entry]')].filter((e) => e.dataset.kind === '${kind}').length`
    )
  const showSession = async () => {
    await ui.click(`document.querySelector('.side-panel-tab[data-tab=session] [role=tab]')`)
    await ui.waitFor(`!!${tab}`)
  }
  return { tab, lines, value, tokens, entries, showSession }
}

/**
 * Onglet « Session » du panneau (fiche 166) : ouvert d'office, environnement, contexte avec le
 * total de l'agent, modifications, ce qui tourne et son arrêt, compaction, fenêtre étroite ; puis
 * un agent sans `usage_update`, comme Bob.
 */
export async function sessionSuite(scheme) {
  console.log(`\n— Onglet « Session » (${scheme})`)
  const workspace = await project()
  const mcp = mcpHome()
  try {
    await withApp(
      scheme,
      async (ui) => {
        const h = helpers(ui)
        await ui.ready()
        await ui.send('Bonjour')
        await ui.ready()
        await ui.waitFor(`!!${h.tab}`)

        // Environnement : agent, modèle, mode, dossier, branche.
        const env = ui.$('session-environment')
        await ui.click(`${env}.querySelector('[data-testid=model-chip]')`)
        await ui.waitFor(`!!${ui.$('model-menu-content')}`)
        await ui.key('Escape')
        await ui.waitFor(`!${ui.$('model-menu-content')}`)
        // Radix rend le focus à la puce un peu après la fermeture (`setTimeout`) ; l'infobulle s'ouvre
        // alors (focus au clavier) et ne se ferme qu'en voyant le pointeur quitter la puce. Écarté
        // avant (runner macOS chargé, fiche 250), le pointeur ne la quittait plus : infobulle restée.
        await ui.waitFor(
          `document.activeElement === ${env}.querySelector('[data-testid=model-chip]')`
        )
        // Souris écartée : l'infobulle du modèle ne masque pas la capture.
        await ui.hover({ x: 5, y: 400 })
        await ui.waitFor(`!document.querySelector('[role=tooltip]')`)
        // Focus rendu à la puce par Échap (clavier) : rien ne doit rester entouré sur la capture.
        await ui.ev(`document.activeElement?.blur(), true`)

        // Une seule colonne de valeurs : icônes au même x, lignes de même hauteur.
        const layout = await ui.ev(`(() => {
          const rows = [...${env}.querySelectorAll('.session-row')]
          return rows.map((row) => {
            const icon = row.querySelector('.session-row-value svg').getBoundingClientRect()
            const label = row.querySelector('.session-row-label').getBoundingClientRect()
            return {
              icon: Math.round(icon.left),
              width: Math.round(icon.width),
              height: Math.round(row.getBoundingClientRect().height),
              label: Math.round(label.left)
            }
          })
        })()`)
        const spread = (key) =>
          Math.max(...layout.map((r) => r[key])) - Math.min(...layout.map((r) => r[key]))
        check(
          layout.length === 5 &&
            spread('icon') <= 1 &&
            spread('label') <= 1 &&
            spread('height') === 0 &&
            layout.every((r) => r.width === 16 && r.height === 32),
          `environnement : cinq icônes de 16 px au même x, lignes de 32 px (${JSON.stringify(layout)})`
        )

        // Contexte avec le total de l'agent (`usage_update`).
        await ui.waitFor(
          `${h.tab}.querySelector('[data-line=free]') !== null && ${h.tab}.querySelector('[data-line=mcp]') !== null`
        )
        const approx = L('sessionTab.approx', { tokens: '' }).trim()

        // Autres MCP : jamais mesurés de l'onglet lui-même (décision de l'utilisateur, fiche 166).
        await ui.waitFor(`!!${h.tab}.querySelector('[data-line=mcp]')`)
        await sleep(1000)
        await ui.shot('session-1b-mesurer')
        await ui.click(ui.$('session-measure-mcp'))
        await ui.waitFor(`${h.tab}.querySelector('[data-line=mcp]')?.dataset.tokens > 0`, 30_000)
        check(
          mcp.launches() === 1 && (await h.value('mcp')).startsWith(approx),
          `« Mesurer » lance le serveur une fois, la valeur s’affiche (${await h.value('mcp')})`
        )

        // Modifications (fiche 207) : la conversation (rien), le dossier (non commité), chacune
        // ouvrant sa vue de l'onglet Modifications.
        await ui.waitFor(`!!${ui.$('session-changes-line')}`)
        await ui.shot('session-1-total')
        await ui.click(ui.$('session-changes-line'))
        await ui.waitFor(`!!${ui.$('changes-tab')}`)
        await h.showSession()

        // En cours : un terminal du panneau (⌃`) n'y est que pendant qu'une commande y tourne.
        const prompt = `[...document.querySelectorAll('.terminal-host .xterm-rows')].some((r) => !r.closest('[hidden]') && r.innerText.trim() !== '')`
        await ui.press('`', 2)
        await ui.waitFor(`!!document.querySelector('.side-panel-tab.active[data-tab=terminal]')`)
        await ui.waitFor(prompt)
        await h.showSession()
        // Au-delà de la seconde de démarrage du shell, et d'une relecture après sa sortie.
        await sleep(1500)
        await ui.shot('session-2a-terminal-invite')
        await ui.click(`document.querySelector('.side-panel-tab[data-tab=terminal] [role=tab]')`)
        const input = `[...document.querySelectorAll('.terminal-host .xterm-helper-textarea')].find((e) => !e.closest('[hidden]'))`
        await ui.waitFor(`!!${input}`)
        await ui.ev(`${input}.focus()`)
        await ui.type('sleep 30')
        await ui.enter()
        await h.showSession()
        const terminalLabel = `${ui.$('session-running')}.querySelector('ul:not(.finished) [data-kind=terminal] .session-entry-label')?.innerText`
        await ui.waitFor(`${terminalLabel} === 'sleep'`, 5000)
        check(
          (await h.entries('terminal')) === 1,
          '`sleep 30` : en cours sous le nom de la commande, avec sa durée'
        )
        // Un sous-agent en arrière-plan (12 s) : en cours, sans bouton Arrêter.
        await ui.send('/scenario sous-agent-arriere-plan-lent')
        await ui.ready()
        await ui.waitFor(
          `!!${ui.$('session-running')}.querySelector('[data-kind=subagent]')`,
          10000
        )
        // Un serveur de dev lancé par l'agent.
        await ui.send('/scenario lancer-app')
        await ui.waitFor(`!!${ui.$('questions')}`)
        await ui.press('1')
        await ui.ready()
        await h.showSession()
        await ui.waitFor(`!!${ui.$('session-running')}.querySelector('[data-kind=server]')`)
        // Une fille au travail jusqu'à ce qu'on l'arrête.
        await ui.click(ui.$('title-menu'))
        await ui.waitFor(
          `${ui.$('title-launch-child')} && !${ui.$('title-launch-child')}.hasAttribute('data-disabled')`
        )
        await ui.click(ui.$('title-launch-child'))
        await ui.waitFor(`!!${ui.$('child-dialog')}`)
        await ui.ev(`${ui.$('child-prompt')}.focus()`)
        await ui.type('/scenario attend-stop')
        // README.md modifié depuis le dernier commit (voir plus haut) : une ligne le dit (fiches
        // 240, 262) ; « Lancer » part sans lui, choix porté par la requête.
        await ui.waitFor(`!!${ui.$('launch-line')}`, 10000)
        await ui.click(ui.$('child-launch'))
        await ui.waitFor(`!${ui.$('child-dialog')}`, 30000)
        await ui.waitFor(`!!${ui.$('session-running')}.querySelector('[data-kind=child]')`, 30000)
        await ui.shot('session-2-en-cours')

        // Arrêter : la commande du terminal (pas l'onglet), le serveur, le tour de la fille.
        const stop = (kind) =>
          ui.click(
            `${ui.$('session-running')}.querySelector('ul:not(.finished) [data-kind=${kind}] [data-testid=session-stop]')`
          )
        for (const kind of ['terminal', 'server', 'child']) {
          await stop(kind)
          await ui.waitFor(
            `![...${ui.$('session-running')}.querySelectorAll('ul:not(.finished) [data-testid=session-entry]')].some((e) => e.dataset.kind === '${kind}')`,
            15000
          )
        }
        check(
          await ui.ev(`!!document.querySelector('.side-panel-tab[data-tab=terminal]')`),
          'Arrêter coupe la commande du terminal (son onglet reste), le serveur et le tour de la fille'
        )
        // Le sous-agent finit de lui-même (sa session finit 12 s après, l'app le voit ensuite).
        await ui.waitFor(
          `!${ui.$('session-running')}.querySelector('ul:not(.finished) [data-kind=subagent]')`,
          40_000
        )
        await ui.waitFor(`!!${ui.$('session-finished-toggle')}`)
        check(
          (await ui.ev(`${ui.$('session-finished-toggle')}.innerText`)).includes(
            L('sessionTab.finished', { count: 3 })
          ),
          'Terminées : 3 (une commande du terminal n’y va pas)'
        )
        await ui.click(ui.$('session-finished-toggle'))
        await ui.waitFor(`!!${ui.$('session-finished')}`)
        await ui.shot('session-3-terminees')
        await ui.send('/compact')
        await ui.ready()

        // Fermé par l'utilisateur : ne se rouvre plus pour cette conversation.
        const close = `${ui.$('side-panel')}.querySelector('[aria-label="${L('sidePanel.close')}"]')`
        await ui.click(close)
        await ui.waitFor(`!${ui.$('side-panel')}`)
        const first = await ui.ev(`document.querySelector('.history-item.active')?.dataset.id`)
        await ui.click(ui.$('new-conversation'))
        await ui.waitFor(`!!${ui.$('welcome')}`)
        await ui.send('Deuxième')
        await ui.ready()
        await ui.waitFor(`!!${h.tab}`)
        await ui.click(close)
        await ui.waitFor(`!${ui.$('side-panel')}`)
        await ui.click(
          `document.querySelector('[data-testid=history-item][data-id="${first}"] .history-open')`
        )
        await ui.waitFor(
          `document.querySelector('.history-item.active')?.dataset.id === ${JSON.stringify(first)}`
        )
        await ui.ready()

        // Fenêtre étroite : la conversation garderait moins de 500 px, rien ne s'ouvre.
        await ui.viewport(900)
        await ui.click(ui.$('new-conversation'))
        await ui.waitFor(`!!${ui.$('welcome')}`)
        await ui.send('Fenêtre étroite')
        await ui.ready()
        await ui.shot('session-4-etroite')
        await ui.viewport()
      },
      undefined,
      'echo',
      { BOBINE_WORKSPACE: workspace, BOBINE_CONFIG_HOME: mcp.home }
    )
  } finally {
    rmSync(workspace, { recursive: true, force: true })
    rmSync(mcp.home, { recursive: true, force: true })
  }
}
