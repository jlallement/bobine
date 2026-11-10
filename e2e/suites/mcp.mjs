import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { L, NEUTRAL_ENV, check, withApp } from '../lib.mjs'

/** Serveur MCP d'essai (stdio) : trois outils, un prompt ; `--plante` s'arrête en erreur. */
const FIXTURE = fileURLToPath(new URL('../fixtures/mcp-serveur.mjs', import.meta.url))

/** Nombre d'un texte (« 19 outils » → 19). */
const countOf = (text) => Number(/\d+/.exec(text)?.[0] ?? NaN)

/**
 * Serveurs MCP dans les réglages : les outils de Bobine (fiche 099), puis ceux des agents
 * (fiche 025), lus et écrits dans les fichiers de Bob et d'OpenCode — ceux d'un dossier personnel
 * jetable, jamais les vrais.
 */
export async function mcpSuite(scheme) {
  console.log(`\n— Serveurs MCP (${scheme})`)
  const home = mkdtempSync(join(tmpdir(), 'bob-e2e-mcp-home-'))
  const workspace = mkdtempSync(join(tmpdir(), 'bob-e2e-mcp-ws-'))
  const bobFile = join(home, '.bob', 'settings', 'mcp.json')
  const openFile = join(home, '.config', 'opencode', 'opencode.jsonc')
  mkdirSync(join(home, '.bob', 'settings'), { recursive: true })
  mkdirSync(join(home, '.config', 'opencode'), { recursive: true })
  writeFileSync(
    bobFile,
    JSON.stringify({ mcpServers: { existant: { command: 'node', args: ['serveur.js'] } } }, null, 2)
  )
  writeFileSync(openFile, '{\n  // réglage écrit à la main\n  "model": "zen/x"\n}\n')
  const bob = () => JSON.parse(readFileSync(bobFile, 'utf8')).mcpServers
  try {
    await withApp(
      scheme,
      async (ui) => {
        const servers = `[...document.querySelectorAll('[data-testid=mcp-server]')]`
        const server = (name) =>
          `${servers}.find((s) => s.dataset.name === ${JSON.stringify(name)})`
        const fill = async (testId, text) => {
          await ui.ev(`${ui.$(testId)}.focus()`)
          await ui.ev(`${ui.$(testId)}.select()`)
          await ui.type(text)
        }
        await ui.click(ui.$('open-settings'))
        await ui.waitFor(`!!${ui.$('settings')}`)
        await ui.click(ui.$('settings-mcp'))
        await ui.waitFor(`!!${ui.$('mcp-settings')}`)

        // Onglet « Bobine » (fiche 099) : le premier, ouvert par défaut, une carte par famille.
        await ui.waitFor(`!!${ui.$('app-tool-families')} && !!${ui.$('mcp-agent-bob')}`)
        const tabs = await ui.ev(
          `[...document.querySelectorAll('.mcp-settings [role=tab]')].map((t) => t.dataset.testid + ':' + t.getAttribute('aria-selected')).join()`
        )
        check(
          tabs.startsWith('mcp-tab-bobine:true,mcp-agent-'),
          `onglet « Bobine » en premier, choisi par défaut, avant les agents (${tabs})`
        )
        const families =
          await ui.ev(`[...document.querySelectorAll('[data-testid=app-tool-family]')].map((f) => ({
          id: f.dataset.id,
          count: f.querySelector('[data-testid=app-tool-family-count]').innerText,
          condition: f.querySelector('[data-testid=app-tool-condition]')?.innerText ?? '',
          approval: f.querySelector('[data-testid=app-tool-approval]')?.innerText ?? ''
        }))`)
        const ids = families.map((f) => f.id)
        check(
          [
            'ask-user',
            'terminal',
            'browser',
            'preview',
            'ios-simulator',
            'children',
            'memory'
          ].every((id) => ids.includes(id)),
          `toutes les familles d’outils de Bobine (${ids.join(', ')})`
        )
        const total = families.reduce((sum, f) => sum + countOf(f.count), 0)
        check(
          countOf(await ui.ev(`${ui.$('mcp-tab-bobine')}.innerText`)) === total && total > 40,
          `nombre d’outils de l’onglet = somme des cartes (${total})`
        )
        const family = (id) => families.find((f) => f.id === id)
        check(
          family('ask-user')?.condition === L('appToolFamilies.always') &&
            family('ask-user')?.approval === '' &&
            family('ios-simulator')?.condition === L('appToolFamilies.ios-simulator.condition') &&
            family('children')?.condition === L('appToolFamilies.children.condition') &&
            family('terminal')?.approval === L('appToolFamilies.terminal.approval') &&
            families.filter((f) => f.approval).length === families.length - 1,
          'conditions et accords : pastille neutre, pastille orange sauf pour les questions'
        )
        check(
          (await ui.ev(
            `getComputedStyle(document.querySelector('[data-testid=app-tool-approval]')).backgroundColor`
          )) !==
            (await ui.ev(
              `getComputedStyle(document.querySelector('[data-testid=app-tool-condition]')).backgroundColor`
            )),
          'pastille d’accord d’une autre couleur que celle de la condition'
        )
        check(!(await ui.ev(`!!${ui.$('app-tool-names')}`)), 'cartes repliées par défaut')
        const card = (id) =>
          `document.querySelector('[data-testid=app-tool-family][data-id=${id}]')`
        await ui.click(`${card('browser')}.querySelector('[data-testid=app-tool-family-toggle]')`)
        await ui.waitFor(`!!${card('browser')}.querySelector('[data-testid=app-tool-names]')`)
        const browserTools = await ui.ev(
          `[...${card('browser')}.querySelectorAll('[data-testid=app-tool-name]')].map((n) => ({ name: n.innerText, tip: n.title }))`
        )
        check(
          browserTools.length === countOf(family('browser').count) &&
            browserTools.some((t) => t.name === 'browser_navigate') &&
            browserTools.every((t) => /^[a-z_]+$/.test(t.name) && t.tip.length > 10) &&
            (
              await ui.ev(
                `getComputedStyle(${card('browser')}.querySelector('[data-testid=app-tool-name]')).fontFamily`
              )
            ).includes('mono'),
          `carte dépliée : noms des outils en chasse fixe, description au survol (${browserTools.length})`
        )
        await ui.shot('a9-mcp-bobine')
        await ui.click(`${card('browser')}.querySelector('[data-testid=app-tool-family-toggle]')`)

        // Serveurs de Bob : son onglet.
        await ui.click(ui.$('mcp-agent-bob'))
        await ui.waitFor(`!!${ui.$('mcp-list')}`)
        check(
          (await ui.ev(`${servers}.map((s) => s.dataset.name).join()`)) === 'existant',
          'serveur déjà déclaré dans le fichier de Bob : listé'
        )

        await ui.click(`${server('existant')}.querySelector('[data-testid=mcp-enabled]')`)
        await ui.waitFor(
          `!${server('existant')}.querySelector('[data-testid=mcp-enabled]').checked`
        )
        check(bob().existant?.disabled === true, 'désactivé : « disabled: true » chez Bob')

        // Nouveau serveur : commande avec guillemets, une variable, tous les dossiers.
        await ui.click(ui.$('mcp-add'))
        await ui.waitFor(`!!${ui.$('mcp-form')}`)
        await fill('mcp-name', 'mauvais nom')
        await fill('mcp-command', 'npx')
        await ui.click(ui.$('mcp-save'))
        await ui.waitFor(`!!${ui.$('mcp-error')}`)
        check(
          (await ui.ev(`${ui.$('mcp-error')}.innerText`)).includes(L('mcp.check.name')),
          'nom invalide : refusé avec un message'
        )
        await fill('mcp-name', 'recherche')
        await fill('mcp-command', 'npx -y "@acme/recherche web"')
        await fill('mcp-pairs', 'API_KEY=abc')
        await ui.shot('b0-mcp-formulaire')
        // En-tête fixe : seul le contenu dessous défile (sa barre de défilement aussi) ; titre et
        // croix restent visibles en bas du défilement. Les chemins des fichiers sont repliés
        // (fiche 136) : le formulaire tient sans défiler, la fenêtre est donc réduite pour l'essai.
        await ui.ev(`document.querySelector('.settings-dialog').style.height = '480px'; true`)
        await ui.ev(`document.querySelector('.settings-body').scrollTop = 1e6`)
        check(
          await ui.ev(`(() => {
            const body = document.querySelector('.settings-body')
            const header = document.querySelector('.settings-header')
            const visible = (el) => {
              const b = el.getBoundingClientRect()
              const hit = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2)
              return !!hit && (hit === el || el.contains(hit))
            }
            return body.scrollHeight > body.clientHeight && body.scrollTop > 0 &&
              body.getBoundingClientRect().top >= header.getBoundingClientRect().bottom - 1 &&
              visible(document.querySelector('.settings-heading')) &&
              visible(document.querySelector('.settings-close'))
          })()`),
          'réglages longs : en-tête fixe (titre, croix), seul le contenu défile'
        )
        await ui.shot('b0-mcp-formulaire-bas')
        await ui.ev(`document.querySelector('.settings-dialog').style.height = ''; true`)
        await ui.click(ui.$('mcp-save'))
        await ui.waitFor(`!!${server('recherche')}`)
        check(
          JSON.stringify(bob().recherche) ===
            JSON.stringify({
              command: 'npx',
              args: ['-y', '@acme/recherche web'],
              env: { API_KEY: 'abc' }
            }),
          'ajouté dans ~/.bob/settings/mcp.json, au format de Bob'
        )
        await ui.shot('b1-mcp-bob')

        // Copie vers OpenCode : son fichier .jsonc garde son commentaire.
        await ui.click(`${server('recherche')}.querySelector('[data-testid=mcp-copy]')`)
        await ui.waitFor(`${ui.$('mcp-agent-opencode')}.innerText.includes('1')`)
        const text = readFileSync(openFile, 'utf8')
        check(
          text.includes('// réglage écrit à la main') &&
            /"recherche": \{\s*"type": "local",\s*"command": \[\s*"npx",\s*"-y",\s*"@acme\/recherche web"\s*\],\s*"environment": \{\s*"API_KEY": "abc"\s*\}/.test(
              text
            ),
          'copié vers OpenCode, à son format, commentaires gardés'
        )

        // Chez OpenCode : passé à « ce dossier » → déplacé dans opencode.json du projet.
        await ui.click(ui.$('mcp-agent-opencode'))
        await ui.waitFor(`!!${server('recherche')}`)
        await ui.click(`${server('recherche')}.querySelector('[data-testid=mcp-edit]')`)
        await ui.waitFor(`!!${ui.$('mcp-form')}`)
        await ui.click(ui.$('mcp-scope-project'))
        await ui.click(ui.$('mcp-save'))
        await ui.waitFor(`!${ui.$('mcp-form')}`)
        const project = join(workspace, 'opencode.json')
        check(
          existsSync(project) &&
            JSON.parse(readFileSync(project, 'utf8')).mcp?.recherche?.type === 'local' &&
            !readFileSync(openFile, 'utf8').includes('"recherche"'),
          'portée changée : déplacé dans opencode.json du dossier'
        )
        await ui.shot('b2-mcp-opencode')

        // Suppression chez Bob : confirmée dans la ligne (fiche 126).
        await ui.click(ui.$('mcp-agent-bob'))
        await ui.waitFor(`!!${server('recherche')}`)
        await ui.click(`${server('recherche')}.querySelector('[data-testid=mcp-remove]')`)
        await ui.waitFor(`!!${server('recherche')}?.querySelector('[data-testid=confirm-row]')`)
        check(
          !!bob().recherche &&
            (
              await ui.ev(
                `${server('recherche')}.querySelector('[data-testid=confirm-row]').innerText`
              )
            ).includes(L('mcp.server.removeAsk', { name: 'recherche' })),
          'premier clic : la confirmation s’ouvre dans la ligne, rien de supprimé'
        )
        await ui.shot('b3-mcp-confirmer-suppression')
        await ui.click(`${server('recherche')}.querySelector('[data-testid=confirm-row-confirm]')`)
        await ui.waitFor(`!${server('recherche')}`)
        check(!bob().recherche && !!bob().existant, 'supprimé du fichier de Bob (confirmé)')
        // Le seul serveur du projet retiré : pas de `opencode.json` vide laissé (fiche 126, D2).
        await ui.click(ui.$('mcp-agent-opencode'))
        await ui.waitFor(`!!${server('recherche')}`)
        await ui.click(`${server('recherche')}.querySelector('[data-testid=mcp-remove]')`)
        await ui.waitFor(`!!${server('recherche')}?.querySelector('[data-testid=confirm-row]')`)
        await ui.click(`${server('recherche')}.querySelector('[data-testid=confirm-row-confirm]')`)
        await ui.waitFor(`!${server('recherche')}`)
        check(
          !existsSync(join(workspace, 'opencode.json')) &&
            readFileSync(openFile, 'utf8').includes('réglage écrit à la main'),
          'dernier serveur du projet retiré : opencode.json supprimé, le fichier global intact'
        )
        await ui.click(ui.$('mcp-agent-bob'))
        await ui.waitFor(`!!${server('existant')}`)

        // « Tester » (fiche 060) : l'app se connecte au serveur et liste ses outils.
        for (const [name, extra] of [
          ['essai', ''],
          ['panne', ' --plante']
        ]) {
          await ui.click(ui.$('mcp-add'))
          await ui.waitFor(`!!${ui.$('mcp-form')}`)
          await fill('mcp-name', name)
          await fill('mcp-command', `node "${FIXTURE}"${extra}`)
          await ui.click(ui.$('mcp-save'))
          await ui.waitFor(`!${ui.$('mcp-form')} && !!${server(name)}`)
        }
        const result = (name) => `${server(name)}?.querySelector('[data-testid=mcp-test-result]')`
        await ui.click(`${server('essai')}.querySelector('[data-testid=mcp-test]')`)
        await ui.waitFor(`${result('essai')}?.dataset.state === 'ok'`, 30_000)
        const ok = await ui.ev(`${result('essai')}.innerText.replace(/\\s+/g, ' ')`)
        check(
          ok.includes(L('mcp.test.reachable', { details: '' }).trim()) &&
            ok.includes('essai-bobine 1.2.3') &&
            ok.includes(L('mcp.test.tools', { count: 3 })) &&
            ok.includes(L('mcp.test.prompts', { count: 1 })),
          `Tester : joignable, serveur, outils et prompts (${ok})`
        )
        check(
          (await ui.ev(`${result('essai')}.title`)) ===
            L('mcp.test.toolsTip', { tools: 'echo, additionner, lire_note' }),
          'Tester : noms des outils au survol'
        )
        await ui.click(ui.$('mcp-test-all'))
        await ui.waitFor(`${result('panne')}?.dataset.state === 'error'`, 30_000)
        await ui.waitFor(`${result('existant')}?.dataset.state === 'error'`, 30_000)
        check(
          (await ui.ev(`${result('existant')}.innerText`)).includes('Cannot find module'),
          'Tout tester : la cause utile de la sortie d’erreur sur la ligne (module introuvable)'
        )
        const failed = await ui.ev(`${result('panne')}.title`)
        check(
          failed.includes('code 3') && failed.includes('SERVICE_TOKEN manquante'),
          'Tout tester : un serveur qui plante donne son erreur et sa sortie'
        )
        check(
          (await ui.ev(
            `${server('essai')}.querySelector('[data-testid=mcp-dot]').dataset.state`
          )) === 'ok' &&
            (await ui.ev(
              `${server('panne')}.querySelector('[data-testid=mcp-dot]').dataset.state`
            )) === 'error' &&
            (await ui.ev(
              `${server('existant')}.querySelector('[data-testid=mcp-dot]').dataset.state`
            )) === 'off',
          'pastilles : joignable, en erreur, désactivé'
        )
        await ui.shot('b3-mcp-tester')

        // « Réglages de la session » : les serveurs de l'agent de la conversation, avec leur état
        // (l'agent factice lit les fichiers de Bob).
        await ui.key('Escape')
        await ui.waitFor(`!${ui.$('settings')}`)
        await ui.click(ui.$('session-settings'))
        const sessionMcp = `[...document.querySelectorAll('[data-testid=session-mcp]')]`
        await ui.waitFor(
          `${sessionMcp}.length === 3 && ${sessionMcp}.every((i) => i.dataset.state !== 'testing')`,
          30_000
        )
        const states = await ui.ev(
          `${sessionMcp}.map((i) => i.innerText.split('\\n')[0] + ':' + i.dataset.state).join()`
        )
        check(
          states === 'existant:off,essai:ok,panne:error',
          `réglages de la session : serveurs MCP et leur état (${states})`
        )
        // Première ligne : les outils de Bobine que la conversation reçoit vraiment (fiche 099) :
        // dossier jetable, ni projet Xcode ni dépôt git, donc ni iOS ni filles.
        const appTools = ui.$('session-app-tools')
        // Mémoire (fiche 182) : activée par défaut, reçue partout.
        const received = ['ask-user', 'terminal', 'browser', 'preview', 'memory'].reduce(
          (sum, id) => sum + countOf(family(id).count),
          0
        )
        const appToolsText = await ui.ev(`${appTools}.innerText.replace(/\\s+/g, ' ')`)
        const names = (await ui.ev(`${appTools}.title`)).split(', ')
        check(
          (await ui.ev(
            `document.querySelector('[data-testid=session-app-tools], [data-testid=session-mcp]').dataset.testid`
          )) === 'session-app-tools' &&
            appToolsText.includes(`bobine · ${L('sessionSettings.mcp.builtIn')}`) &&
            appToolsText.includes(L('sessionSettings.mcp.appTools', { count: received })) &&
            appToolsText.includes(L('sessionSettings.mcp.appToolsShow')),
          `menu ⚙ : « bobine · intégré », ${received} outils reçus par la conversation (${appToolsText})`
        )
        check(
          names.length === received &&
            names.includes('ask_user') &&
            names.includes('browser_navigate') &&
            !names.some((n) => n.startsWith('ios_') || n.startsWith('android_')) &&
            !names.includes('start_child'),
          'outils reçus au survol : pas d’iOS hors projet Xcode, pas de filles hors dépôt git'
        )
        check(
          /≈ [\d\s\u202f\u00a0,]+ \S+ ·/.test(appToolsText),
          `menu ⚙ : poids estimé des outils de la conversation (fiche 109, ${appToolsText})`
        )
        await ui.shot('b4-mcp-session')
        // Clic : Réglages › Serveurs MCP, sur l'onglet « Bobine ».
        await ui.click(appTools)
        await ui.waitFor(`!!${ui.$('app-tool-families')}`)
        check(
          (await ui.ev(`${ui.$('mcp-tab-bobine')}.getAttribute('aria-selected')`)) === 'true',
          'menu ⚙ › « Voir les outils » : onglet « Bobine » des Réglages'
        )
        await ui.key('Escape')
        await ui.waitFor(`!${ui.$('settings')}`)
        await ui.click(ui.$('session-settings'))
        await ui.waitFor(`${sessionMcp}.length === 3`)
        // Clic sur un serveur : Réglages › Serveurs MCP, sur l'onglet de l'agent ; refermés, l'app
        // répond toujours (un menu modal qui ouvre une fenêtre laissait la page sans clic possible).
        await ui.click(`${sessionMcp}[0]`)
        await ui.waitFor(`!!${ui.$('mcp-list')}`)
        check(
          (await ui.ev(`${ui.$('mcp-tab-bobine')}.getAttribute('aria-selected')`)) === 'false',
          'menu ⚙ › un serveur de l’agent : l’onglet de l’agent, pas celui de Bobine'
        )
        await ui.key('Escape')
        await ui.waitFor(`!${ui.$('settings')}`)
        await ui.ev(`new Promise((r) => setTimeout(r, 300))`)
        const blocked = await ui.ev(`getComputedStyle(document.body).pointerEvents`)
        await ui.click(ui.$('session-settings'))
        const reopened = await ui
          .waitFor(`!!document.querySelector('[data-testid=session-mcp]')`, 3000)
          .then(() => true)
          .catch(() => false)
        check(
          blocked !== 'none' && reopened,
          `réglages refermés : l’app répond encore (pointer-events : ${blocked})`
        )
        await ui.key('Escape')
        await familiesOff(ui, { received, browser: countOf(family('browser').count) })
      },
      undefined,
      'demo',
      { ...NEUTRAL_ENV, BOBINE_CONFIG_HOME: home, BOBINE_WORKSPACE: workspace }
    )
  } finally {
    rmSync(home, { recursive: true, force: true })
    rmSync(workspace, { recursive: true, force: true })
  }
}

/**
 * Familles d'outils de Bobine coupées (fiche 109) : poids estimés dans Réglages › Serveurs MCP ›
 * Bobine, navigateur coupé, avis ; la session ouverte garde ses outils, le menu ⚙ annonce la
 * suivante, et après « Redémarrer l'agent » le serveur MCP ne déclare plus le navigateur.
 */
async function familiesOff(ui, { received, browser }) {
  const lastReply = `[...document.querySelectorAll('.msg-agent')].at(-1)?.innerText ?? ''`
  const listed = async () => {
    const before = await ui.ev(`document.querySelectorAll('.msg-agent').length`)
    await ui.send('/scenario outils-mcp')
    await ui.waitFor(`document.querySelectorAll('.msg-agent').length > ${before}`)
    await ui.ready()
    return ui.ev(lastReply)
  }
  const declared = await listed()
  check(
    declared.includes('browser_navigate') && declared.includes('ask_user'),
    'avant : le serveur MCP déclare les outils du navigateur (tools/list)'
  )

  await ui.click(ui.$('open-settings'))
  await ui.waitFor(`!!${ui.$('settings')}`)
  await ui.click(ui.$('settings-mcp'))
  await ui.waitFor(`!!${ui.$('app-tool-families')}`)
  const card = (id) => `document.querySelector('[data-testid=app-tool-family][data-id=${id}]')`
  const tokens = await ui.ev(
    `[...document.querySelectorAll('[data-testid=app-tool-family-tokens]')].map((t) => Number(t.dataset.tokens))`
  )
  const browserTokens = await ui.ev(
    `Number(${card('browser')}.querySelector('[data-testid=app-tool-family-tokens]').dataset.tokens)`
  )
  check(
    tokens.every((n) => n > 0) && browserTokens > 1000 && browserTokens < 3000,
    `poids estimé de chaque famille (navigateur : ≈ ${browserTokens} jetons)`
  )
  const weight = () => ui.ev(`${ui.$('app-tools-weight')}.innerText`)
  const weightBefore = await weight()
  check(
    (await ui.ev(
      `${card('ask-user')}.querySelector('[data-testid=app-tool-required]')?.innerText`
    )) === L('mcp.bobine.always') &&
      (await ui.ev(`!${card('ask-user')}.querySelector('[data-testid=app-tool-enabled]')`)),
    'questions : « Toujours fournie » en clair, pas d’interrupteur grisé (fiche 126)'
  )
  // Interrupteur atteignable au clavier (Tab depuis la carte) et de la taille de son dessin.
  await ui.ev(`${card('browser')}.querySelector('[data-testid=app-tool-family-toggle]').focus()`)
  await ui.press('Tab')
  const focused = await ui.ev(
    `(() => { const s = document.activeElement; const r = s.getBoundingClientRect(); return { ok: s === ${card('browser')}.querySelector('[data-testid=app-tool-enabled]'), w: r.width, h: r.height } })()`
  )
  check(
    focused.ok && focused.w >= 30 && focused.h >= 18,
    `interrupteur de famille : Tab y mène, zone de ${Math.round(focused.w)}×${Math.round(focused.h)} px (fiche 126)`
  )
  await ui.click(`${card('browser')}.querySelector('[data-testid=app-tool-enabled]')`)
  await ui.waitFor(`${card('browser')}.dataset.enabled === 'false'`)
  check(
    (await ui.ev(`${ui.$('app-tools-applies')}.innerText`)) === L('mcp.bobine.applies') &&
      (await ui.ev(
        `${card('browser')}.querySelector('[data-testid=app-tool-condition]').innerText`
      )) === L('mcp.bobine.off') &&
      (await weight()) !== weightBefore,
    `navigateur coupé : avis « prochaines sessions », total recalculé (${await weight()})`
  )
  await ui.shot('b5-mcp-familles')
  await ui.key('Escape')
  await ui.waitFor(`!${ui.$('settings')}`)

  // Session ouverte : elle garde ses outils ; le menu ⚙ annonce la prochaine et la propose.
  await ui.click(ui.$('session-settings'))
  await ui.waitFor(`!!${ui.$('session-app-tools-next')}`)
  const nextText = await ui.ev(`${ui.$('session-app-tools-next')}.innerText`)
  check(
    nextText.includes(L('sessionSettings.mcp.appToolsNext', { count: received - browser })) &&
      Number(await ui.ev(`${ui.$('session-app-tools')}.dataset.count`)) === received,
    `menu ⚙ : ${received} outils maintenant, ${received - browser} au prochain démarrage (${nextText.replace(/\s+/g, ' ')})`
  )
  await ui.shot('b6-mcp-prochaine-session')
  await ui.click(ui.$('session-app-tools-next'))
  await ui.ready()
  const after = await listed()
  check(
    !after.includes('browser_') && after.includes('ask_user') && after.includes('preview_'),
    `après redémarrage : plus aucun outil du navigateur déclaré (tools/list : ${after.slice(0, 80)}…)`
  )
  await ui.click(ui.$('session-settings'))
  await ui.waitFor(`!!${ui.$('session-app-tools')}?.dataset.count`)
  check(
    Number(await ui.ev(`${ui.$('session-app-tools')}.dataset.count`)) === received - browser &&
      !(await ui.ev(`!!${ui.$('session-app-tools-next')}`)),
    'menu ⚙ après redémarrage : les outils de la session suivent les réglages'
  )
  await ui.key('Escape')
}
