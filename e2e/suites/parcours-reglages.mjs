import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { L, LANG, MAIN_PORT, check, mainProcess, withApp } from '../lib.mjs'
import {
  ROWS,
  choose,
  closeSettings,
  day,
  newConversation,
  open,
  openSettings,
  project,
  row,
  userCount
} from '../parcours.mjs'

const FIRST = '/scenario echo Prépare la démo'
const BUSY = '/scenario attend-stop'
/** Proxy injoignable (port fermé), sans identifiants : cité tel quel. */
const PROXY = 'http://127.0.0.1:9'
const memoryEntry = `document.querySelector('[data-testid=memory-entry][data-name=tests-e2e]')`
const memoryCards = `[...document.querySelectorAll('[data-testid=memory-card]')]`
const navItem = (key) =>
  `[...document.querySelectorAll('.settings-nav-item')].find((b) => b.innerText.trim() === ${JSON.stringify(L(key))})`

/** Champ du proxy (Réglages › Agents › Avancé) rempli puis enregistré (Entrée). */
async function setProxy(ui, value) {
  await openSettings(ui, 'settings-agents')
  await ui.waitFor(`!!${ui.$('settings-agents-advanced')}`)
  if (!(await ui.ev(`${ui.$('settings-agents-advanced')}.open`))) {
    await ui.click(`${ui.$('settings-agents-advanced')}.querySelector('summary')`)
    await ui.waitFor(`${ui.$('settings-agents-advanced')}.open === true`)
  }
  // Champ vidé (comme tout sélectionner puis effacer), puis la valeur tapée.
  await ui.ev(`(() => {
    const i = ${ui.$('network-proxy')}
    i.focus()
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, '')
    i.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  })()`)
  if (value) await ui.type(value)
  await ui.key('Enter')
  await ui.waitFor(`${ui.$('network-proxy')}.value === ${JSON.stringify(value)}`)
  await ui.waitFor(`!!${ui.$('network-note')}`)
  await closeSettings(ui)
}

/**
 * « Réglages en cours de route » (fiche 277) : avec deux conversations ouvertes, dont une qui
 * travaille, on change de langue (et l'on revient), de thème, de proxy (agent injoignable, puis
 * revenu), d'agent par défaut ; la mémoire (retenir, voir, modifier, oublier) ; un `@rôle`.
 * Rien ne doit se perdre en route : fils, états, réglages des conversations déjà ouvertes.
 */
export async function parcoursReglagesSuite(scheme) {
  console.log(`\n— Parcours : réglages en cours de route (${scheme})`)
  const workspace = project('bob-e2e-reglages-')
  const userData = mkdtempSync(join(tmpdir(), 'bob-e2e-reglages-data-'))
  // Langue décidée par le réglage, pas par l'environnement des essais (comme la suite `language`).
  writeFileSync(join(userData, 'settings.json'), JSON.stringify({ language: LANG }))
  const other = LANG === 'fr' ? 'en' : 'fr'
  const journee = day('réglages')
  try {
    await withApp(
      scheme,
      async (ui) => {
        await journee.attach(ui)
        const main = await mainProcess()
        try {
          await journee.step('deux conversations, l’une au travail', async () => {
            await ui.ready()
            await ui.send(FIRST)
            await ui.ready()
            await newConversation(ui)
            await ui.send(BUSY)
            await ui.waitFor(`!!${ui.$('stop')}`)
            check(
              (await ui.ev(`${ROWS}.length`)) === 2,
              'deux conversations dans la barre latérale'
            )
          })

          await journee.step('changer de langue pendant le tour, puis revenir', async () => {
            const placeholder = await ui.ev(`${ui.$('composer-input')}.placeholder`)
            await openSettings(ui)
            await ui.waitFor(`!!${ui.$('settings-language')}`)
            await choose(ui, 'settings-language', other)
            await ui.waitFor(`document.documentElement.lang === '${other}'`)
            await closeSettings(ui)
            const switched = {
              rows: await ui.ev(`${ROWS}.length`),
              busy: await ui.ev(`!!${ui.$('stop')}`),
              placeholder: await ui.ev(`${ui.$('composer-input')}.placeholder`)
            }
            await ui.shot('276-reglages-autre-langue')
            await openSettings(ui)
            await ui.waitFor(`!!${ui.$('settings-language')}`)
            await choose(ui, 'settings-language', LANG)
            await ui.waitFor(`document.documentElement.lang === '${LANG}'`)
            await closeSettings(ui)
            check(
              switched.rows === 2 &&
                switched.busy &&
                switched.placeholder !== placeholder &&
                (await ui.ev(`${ui.$('composer-input')}.placeholder`)) === placeholder &&
                (await ui.ev(`!!${ui.$('stop')}`)),
              `langue changée deux fois : interface traduite, le tour continue, rien de perdu (${JSON.stringify(switched)})`
            )
          })

          await journee.step('arrêter le tour, rouvrir l’autre conversation', async () => {
            await ui.click(ui.$('stop'))
            await ui.ready()
            await open(ui, FIRST)
            check(
              (await userCount(ui)) === 1 && (await ui.lastAgentText()).includes('Prépare la démo'),
              'l’autre conversation a gardé son fil'
            )
          })

          await journee.step('passer en thème sombre puis revenir au système', async () => {
            await openSettings(ui, 'settings-appearance')
            await ui.waitFor(`!!${ui.$('theme-dark')}`)
            await ui.click(ui.$('theme-dark'))
            await ui.waitFor(`${ui.$('theme-dark')}.getAttribute('aria-checked') === 'true'`)
            const dark = await main.evaluate(`require('electron').nativeTheme.themeSource`)
            await ui.click(ui.$('theme-system'))
            await ui.waitFor(`${ui.$('theme-system')}.getAttribute('aria-checked') === 'true'`)
            await closeSettings(ui)
            check(
              dark === 'dark' &&
                (await main.evaluate(`require('electron').nativeTheme.themeSource`)) === 'system',
              'thème sombre appliqué à l’app, puis retour au thème du système'
            )
          })

          await journee.step('proxy injoignable : une nouvelle conversation le dit', async () => {
            // « Pris en compte au prochain lancement d'un agent » : celui d'une nouvelle
            // conversation, qui démarre avec ce proxy.
            await setProxy(ui, PROXY)
            await newConversation(ui)
            await ui.send('/scenario reseau-injoignable-2-3')
            await ui.waitFor(`!!${ui.$('agent-unreachable')}`, 15000)
            const hint = await ui.ev(`${ui.$('agent-unreachable-hint')}.innerText`)
            check(
              hint === L('agentRetry.proxy', { proxy: PROXY }),
              `modèle injoignable : le proxy réglé est cité (${hint})`
            )
            await ui.shot('276-reglages-proxy')
            await ui.click(ui.$('agent-unreachable-stop'))
            await ui.ready()
          })

          await journee.step('proxy retiré : l’agent revient', async () => {
            await setProxy(ui, '')
            await newConversation(ui)
            await ui.send('/scenario reseau-revenu-2-3')
            await ui.waitFor(`!!${ui.$('agent-unreachable')}`, 15000)
            const hint = await ui.ev(`${ui.$('agent-unreachable-hint')}.innerText`)
            await ui.waitFor(`!${ui.$('agent-unreachable')}`, 30000)
            await ui.ready()
            check(
              hint === L('agentRetry.noProxy') && (await ui.lastAgentText()).length > 0,
              `sans proxy : la piste Wi-Fi / VPN, puis la réponse arrive et le bandeau part (${hint})`
            )
          })

          await journee.step('changer d’agent par défaut', async () => {
            await openSettings(ui, 'settings-conversation')
            await ui.waitFor(`!!${ui.$('new-conversation-agent')}`)
            await choose(ui, 'new-conversation-agent', 'mock-peer')
            await closeSettings(ui)
            await newConversation(ui)
            await ui.waitFor(
              `${ui.$('agent-menu')}?.innerText.includes(${JSON.stringify(L('profiles.mockPeer.label'))})`
            )
            await ui.send('/scenario echo Bonjour l’autre agent')
            await ui.ready()
            await open(ui, FIRST)
            check(
              (await ui.ev(`${ui.$('agent-menu')}.innerText`)).includes(L('profiles.mock.label')),
              'nouvelle conversation avec l’agent choisi ; celles d’avant gardent le leur'
            )
          })

          await journee.step('la mémoire : retenir, puis la retrouver ailleurs', async () => {
            await ui.send('/scenario memoire-retient')
            await ui.ready()
            await ui.waitFor(`${memoryCards}.length === 1`)
            await ui.click(`${memoryCards}.at(-1).querySelector('[data-testid=memory-accept]')`)
            await ui.waitFor(
              `[...document.querySelectorAll('[data-testid=memory-decided]')].some((d) => d.classList.contains('memory-decided-kept'))`
            )
            await newConversation(ui)
            await ui.send('/scenario memoire-index')
            await ui.ready()
            check(
              (await ui.lastAgentText()).includes('tests-e2e'),
              'retenu : la conversation suivante (autre agent) le reçoit'
            )
          })

          await journee.step('la mémoire : voir, modifier, oublier', async () => {
            await openSettings(ui)
            await ui.click(navItem('settings.section.memory'))
            await ui.waitFor(`!!${memoryEntry}`)
            await ui.click(`${memoryEntry}.querySelector('.memory-entry-head')`)
            await ui.waitFor(`!!${ui.$('memory-edit')}`)
            await ui.click(ui.$('memory-edit'))
            await ui.waitFor(`!!${ui.$('memory-editor-body')}`)
            await ui.ev(`(() => {
              const area = ${ui.$('memory-editor-body')}
              const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set
              set.call(area, 'Lancer les e2e touchées avant chaque push, en clair et en sombre.')
              area.dispatchEvent(new Event('input', { bubbles: true }))
              return true
            })()`)
            await ui.click(ui.$('memory-editor-save'))
            await ui.waitFor(`!${ui.$('memory-editor')}`)
            await ui.waitFor(`${memoryEntry}?.innerText.includes('en clair et en sombre')`)
            check(true, 'souvenir modifié dans Réglages › Mémoire')
            await ui.click(ui.$('memory-delete'))
            await ui.click(ui.$('confirm-row-confirm'))
            await ui.waitFor(`!${memoryEntry}`)
            await closeSettings(ui)
            check(true, 'souvenir oublié')
          })

          await journee.step('confier une question à un rôle (@ux-ui-expert)', async () => {
            await open(ui, FIRST)
            await ui.ev(`${ui.$('composer-input')}.focus()`)
            await ui.type('@ux-ui-expert Compare deux variantes de palette.')
            await ui.press('Escape')
            await ui.waitFor(`!!${ui.$('role-destination')}`)
            await ui.enter()
            const card = `document.querySelector('[data-testid=work-card][data-role=ux-ui-expert]')`
            await ui.waitFor(`${card}?.dataset.state === 'replied'`, 30000)
            check(
              (await ui.ev(`${ui.$('composer-input')}.value`)) === '' &&
                (await ui.ev(`${row(FIRST)}?.classList.contains('active')`)),
              'le rôle répond dans sa carte, la conversation reste affichée'
            )
            await ui.shot('276-reglages-role')
          })
        } finally {
          main.close()
        }
      },
      userData,
      'echo',
      { BOBINE_WORKSPACE: workspace, BOBINE_LANG: '', BOBINE_MOCK_PEER: '1' },
      [`--inspect=${MAIN_PORT}`]
    )
  } finally {
    rmSync(workspace, { recursive: true, force: true })
    rmSync(userData, { recursive: true, force: true })
  }
}
