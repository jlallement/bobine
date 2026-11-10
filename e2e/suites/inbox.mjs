import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { L, LANG, MAIN_PORT, check, mainProcess, sleep, withApp, M } from '../lib.mjs'
import { conversationTooltip } from '../sidebar-tooltip.mjs'

/**
 * Attention sur place (fiche 149, ancien parcours « À traiter » de la fiche 119) : autorisation,
 * question et filles non lues, compteur du Dock et bannière groupée. Après lecture, les lignes
 * gardent leur place. Dépôt git jetable et worktrees ; grille mesurée : titres alignés et états
 * sur la marge droite du ⌘K et du filtre de « Récents ».
 */
export async function inboxSuite(scheme) {
  console.log(`\n— Attention sur place et Dock (${scheme})`)
  const workspace = mkdtempSync(join(tmpdir(), 'bob-e2e-a-traiter-'))
  const git = (...args) =>
    execFileSync('git', ['-c', 'user.name=e2e', '-c', 'user.email=e2e@example.invalid', ...args], {
      cwd: workspace
    })
  writeFileSync(join(workspace, 'README.md'), '# Carnet\n')
  git('init', '-q', '-b', 'main')
  git('add', '.')
  git('commit', '-q', '-m', 'init')
  try {
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        const main = await mainProcess()
        try {
          await inbox(ui, main)
        } finally {
          main.close()
        }
      },
      undefined,
      'echo',
      // Fenêtre des bannières groupées élargie : les deux filles finissent à quelques secondes
      // d'écart, selon la charge de la machine.
      // L'agent titre sa session avec le début du texte reçu, contexte de l'app compris, comme Bob.
      {
        BOBINE_WORKSPACE: workspace,
        BOBINE_NOTICE_GROUP_MS: '12000',
        MOCK_AGENT_TITLES: 'prompt'
      },
      [`--inspect=${MAIN_PORT}`]
    )
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
}

async function inbox(ui, main) {
  const focus = (focused) =>
    main.evaluate(`(() => {
      const win = require('electron').BrowserWindow.getAllWindows().find((w) => !w.getURL().includes('#'))
      win.isFocused = () => ${focused}
      win.emit(${focused} ? 'focus' : 'blur')
      return true
    })()`)
  await main.evaluate(`(() => {
    const { Notification } = require('electron')
    globalThis.__notes = []
    Notification.prototype.show = function () { globalThis.__notes.push(this) }
    return true
  })()`)
  const notes = () =>
    main.evaluate(`globalThis.__notes.map((n) => ({ title: n.title, body: n.body }))`)
  const badge = () => main.evaluate(`require('electron').app.dock?.getBadge() ?? null`)
  const count = async () =>
    String(await ui.ev(`document.querySelectorAll('.history-item.unread').length`))
  const inboxRow = (id) => `document.querySelector('[data-testid=history-item][data-id="${id}"]')`
  const reason = (id) =>
    ui.ev(`${inboxRow(id)}?.querySelector('.child-state')?.getAttribute('aria-label')`)
  const ids = () =>
    ui.ev(`[...document.querySelectorAll('.history-item.unread')].map((r) => r.dataset.id)`)
  const activeId = () => ui.ev(`document.querySelector('.history-item.active')?.dataset.id`)
  const fresh = async (title) => {
    await ui.click(ui.$('new-conversation'))
    await ui.waitFor(`!!${ui.$('welcome')}`)
    await ui.ready()
    await ui.send(title)
    await ui.ready()
    return activeId()
  }
  // Le pointeur ne doit pas rester sur la liste (ordre figé, fiche 095).
  const away = async () => ui.hover(await ui.center(ui.$('composer-input')))

  // Une autorisation en attente.
  const access = await fresh('Configurer l’accès')
  await ui.send('/scenario permission')
  await ui.waitFor(`!!document.querySelector('[data-testid=permission]')`, 30000)
  // Une question.
  const auth = await fresh('Choisir le langage')
  await ui.send('/scenario questions')
  await ui.waitFor(`!!${ui.$('questions')}`, 30000)
  check(
    (await ids()).sort().join(' ') === [access, auth].sort().join(' ') && (await count()) === '2',
    'autorisation et question : deux lignes signalées à leur place'
  )

  // Deux filles lancées ensemble, fenêtre en arrière-plan : elles finissent sans être vues.
  const mother = await fresh('Organise le carnet')
  await focus(false)
  const children = []
  for (const title of ['Import CSV', 'Page d’aide']) {
    await ui.click(ui.$('title-menu'))
    const item = ui.$('title-launch-child')
    await ui.waitFor(`!!${item} && !${item}.hasAttribute('data-disabled')`)
    await ui.click(item)
    await ui.waitFor(`!!${ui.$('child-dialog')}`)
    await ui.ev(`${ui.$('child-prompt')}.focus()`)
    await ui.type('/scenario streaming-texte')
    await ui.click(ui.$('child-launch'))
    await ui.waitFor(`!${ui.$('child-dialog')}`, 30000)
    const id = await ui.ev(
      `[...document.querySelectorAll('[data-testid=history-item]')].map((r) => r.dataset.id).find((id) => id !== ${JSON.stringify(mother)} && !${JSON.stringify(children)}.includes(id) && ![${JSON.stringify(access)}, ${JSON.stringify(auth)}].includes(id) && document.querySelector('[data-testid=history-item][data-id="' + id + '"]').classList.contains('nested'))`
    )
    await ui.ev(
      `window.api.conversations.rename(${JSON.stringify(id)}, ${JSON.stringify(title)}).then(() => true)`
    )
    children.push(id)
  }
  await away()
  await ui.waitFor(`document.querySelectorAll('.history-item.unread').length === 4`, 60000)
  check(
    (await ids()).sort().join(' ') === [access, auth, ...children].sort().join(' '),
    'quatre conversations signalées, filles toujours sous leur mère'
  )
  const shown = await Promise.all([access, auth, ...children].map(reason))
  check(
    shown[0] === L('inbox.reason.permission', { detail: M('Modification de config.json') }) &&
      shown[1] === L('inbox.reason.question', { detail: 'Quel style pour la page d’accueil ?' }) &&
      shown[2] === L('inbox.reason.report') &&
      (
        await conversationTooltip(ui, `${inboxRow(children[0])}.querySelector('.history-open')`)
      ).includes('Organise le carnet'),
    `raisons accessibles : outil, question et comptes rendus (${shown.join(' | ')})`
  )
  check(
    !(await ui.ev(`!!document.querySelector('[data-testid=inbox]')`)) &&
      (await ui.ev(`document.querySelectorAll('[data-testid=inbox-line]').length`)) === 0,
    'aucune section « À traiter » ni libellé d’état en seconde ligne'
  )
  const iconStates = await ui.ev(`${JSON.stringify([access, auth, ...children])}.map((id) => {
    const i = document.querySelector('[data-id="' + id + '"] .child-state')
    return i.dataset.reason + ':' + i.dataset.state
  }).join(' ')`)
  check(
    iconStates === 'permission:waiting question:waiting done:unread done:unread' &&
      (await ui.ev(
        `[...document.querySelectorAll('.history-item.unread')].every((r) => getComputedStyle(r.querySelector('.label')).fontWeight === '600')`
      )),
    'icônes de demande et de non-lu ; titres non lus en gras'
  )
  const colors = await ui.ev(
    `${JSON.stringify([access, auth, ...children])}.map((id) => getComputedStyle(document.querySelector('[data-id="' + id + '"] .child-state')).color)`
  )
  check(
    colors[0] === colors[1] && colors[2] === colors[3] && colors[0] !== colors[2],
    'couleurs communes pour demandes et réponses non lues'
  )
  check(
    await ui.ev(
      `${JSON.stringify(children)}.every((id) => document.querySelector('[data-id="' + id + '"]').classList.contains('nested'))`
    ),
    'les deux filles non lues gardent leurs liens sous leur mère'
  )
  await grid(ui)
  check(
    (await ui.ev(`document.querySelectorAll('[data-id="${access}"]').length`)) === 1,
    'une conversation qui attend n’apparaît qu’une fois'
  )
  check((await badge()) === '4', `compteur du Dock : 4, posé par le main (${await badge()})`)

  // Une seule bannière pour les deux filles (fenêtre élargie dans l'essai).
  for (let i = 0; i < 150 && (await notes()).length < 1; i++) await sleep(100)
  await sleep(500)
  const banners = await notes()
  check(
    banners.length === 1 &&
      banners[0].title === L('notifications.group.childrenDone', { count: 2 }) &&
      banners[0].body.includes('Import CSV') &&
      banners[0].body.includes('Page d’aide'),
    `bannière groupée : « ${banners[0]?.title} » (${banners.length} bannière·s)`
  )
  await ui.shot('inbox-1-etats-sur-place')

  // Réglage « Compteur sur l'icône du Dock », trouvé par la recherche des réglages.
  await main.evaluate(
    `(require('electron').Menu.getApplicationMenu().getMenuItemById('settings').click(), true)`
  )
  await ui.waitFor(`!!${ui.$('settings')}`)
  await ui.ev(`${ui.$('settings-search')}.focus(); true`)
  await ui.type(LANG === 'en' ? 'dock icon count' : 'compteur')
  await ui.waitFor(
    `[...document.querySelectorAll('[data-testid=settings-result]')].some((r) => r.innerText.includes(${JSON.stringify(L('settings.notifications.dockBadge.label'))}))`
  )
  await ui.enter()
  await ui.waitFor(`!!${ui.$('settings-dock-badge')}`)
  check(
    await ui.ev(`${ui.$('settings-dock-badge')}.checked`),
    'Réglages › Général : « Compteur sur l’icône du Dock », activé par défaut'
  )
  await ui.click(ui.$('settings-dock-badge'))
  await ui.waitFor(`!${ui.$('settings-dock-badge')}.checked`)
  for (let i = 0; i < 30 && (await badge()) !== ''; i++) await sleep(100)
  check((await badge()) === '', 'réglage coupé : plus de compteur sur l’icône')
  await ui.ev(`${ui.$('settings-dock-badge')}.scrollIntoView({ block: 'center' }), true`)
  await ui.shot('inbox-2-reglage-compteur')
  await ui.click(ui.$('settings-dock-badge'))
  await ui.waitFor(`${ui.$('settings-dock-badge')}.checked`)
  for (let i = 0; i < 30 && (await badge()) !== '4'; i++) await sleep(100)
  check((await badge()) === '4', 'réglage rétabli : le compteur revient')
  await ui.key('Escape')
  await ui.waitFor(`!${ui.$('settings')}`)

  // Tout traiter, fenêtre au premier plan : la section se vide, le compteur s'efface.
  await focus(true)
  await ui.click(`${inboxRow(access)}.querySelector('.history-open')`)
  const allow = `document.querySelector('[data-testid=permission] button[data-kind=allow_once]')`
  await ui.waitFor(`!!${allow}`, 30000)
  await ui.click(allow)
  await ui.ready()
  await away()
  await ui.waitFor(`!${inboxRow(access)}?.classList.contains('unread')`)
  check(
    (await count()) === '3' && (await badge()) === '3',
    'autorisation donnée : ligne conservée, compteur à 3'
  )
  await ui.click(`${inboxRow(auth)}.querySelector('.history-open')`)
  await ui.waitFor(`!!${ui.$('questions')}`, 30000)
  // Deux questions : « Coloré », puis les pages (un choix suffit).
  await ui.click(
    `[...document.querySelectorAll('[data-testid=choice]')].find((c) => c.innerText.includes('Coloré'))`
  )
  await ui.waitFor(`${ui.$('question-text')}.innerText.includes('pages')`)
  await ui.click(
    `[...document.querySelectorAll('[data-testid=choice]')].find((c) => c.innerText.includes('Accueil'))`
  )
  await ui.click(ui.$('questions-next'))
  await ui.waitFor(`!!${ui.$('elicitation-answer')}`)
  await ui.ready()
  await away()
  await ui.waitFor(`!${inboxRow(auth)}?.classList.contains('unread')`)
  for (const id of children) {
    await ui.click(`${inboxRow(id)}.querySelector('.history-open')`)
    await ui.waitFor(
      `document.querySelector('.history-item.active')?.dataset.id === ${JSON.stringify(id)}`
    )
    await away()
    await ui.waitFor(`!${inboxRow(id)}?.classList.contains('unread')`)
  }
  await ui.waitFor(`document.querySelectorAll('.history-item.unread').length === 0`)
  for (let i = 0; i < 30 && (await badge()) !== ''; i++) await sleep(100)
  check(
    (await badge()) === '' &&
      (await ui.ev(`document.querySelectorAll('[data-testid=history-item].nested').length`)) === 2,
    'tout traité : compteur effacé, conversations conservées et filles sous leur mère'
  )
  await grid(ui)
  await ui.shot('inbox-3-traite')

  // Titres bruts comme Bob (fiche 125) : chemin absolu, `cd` vers le dossier, liste de tâches. La
  // raison en infobulle dit la même chose que la carte, chemins relatifs.
  const bob = await fresh('Titres de Bob')
  // Dans un dépôt git, le premier message emporte le contexte de session (fiche 118) après lui ;
  // l'agent titre sa session avec les deux : le titre reste celui de l'utilisateur (fiche 125).
  check(
    (await ui.lastAgentText()).includes('<bobine_capabilities>') &&
      (await ui.ev(`document.querySelector('[data-id="${bob}"] .label').innerText`)) ===
        'Titres de Bob',
    'titre de l’agent avec le contexte de session : coupé au contexte'
  )
  await ui.send('/scenario titres-bob')
  const expected = [
    L('toolCall.label.edit', { target: 'src/books.js' }),
    'npm test 2>&1',
    L('toolCall.label.todos', { count: 3 })
  ]
  for (const [index, label] of expected.entries()) {
    await ui.waitFor(`!!${allow}`, 30000)
    await away()
    await ui.waitFor(
      `${inboxRow(bob)}?.querySelector('.child-state')?.getAttribute('aria-label') === ${JSON.stringify(L('inbox.reason.permission', { detail: label }))}`,
      15000
    )
    const card = await ui.ev(
      // `textContent` : le libellé d'un fichier est en morceaux (fiche 203).
      `[...document.querySelectorAll('[data-testid=tool]')].at(-1).querySelector('.tool-title').textContent`
    )
    check(
      card === label && !card.includes('/bob-e2e-a-traiter-'),
      `titre brut n° ${index + 1} : « ${label} » dans l’infobulle et sur la carte (${card})`
    )
    if (index === 0) await ui.shot('inbox-4-titres-bob')
    await ui.click(allow)
  }
  await ui.ready()
  check(
    !(await ui.ev(`document.body.innerText.includes('/bob-e2e-a-traiter-')`)),
    'plus aucun chemin absolu du dossier dans la page'
  )
}

/**
 * Grille de la barre latérale (fiches 125, 131), mesurée dans la page : les titres des lignes et les
 * en-têtes de section partent du même bord ; une fille sous sa mère, 30 px plus loin (sa colonne et
 * son lien) ; le temps écoulé, les états, le ⌘K et l'icône du filtre sur une même marge droite ; les
 * en-têtes en petites capitales, 11 px, 600.
 */
async function grid(ui) {
  const geometry = await ui.ev(`(() => {
    const box = (el) => el?.getBoundingClientRect()
    const textLeft = (el) => {
      const range = document.createRange()
      range.selectNodeContents(el)
      return Math.round(range.getClientRects()[0]?.left ?? box(el).left)
    }
    const rows = [...document.querySelectorAll('[data-testid=history-item]')]
    const filter = document.querySelector('[data-testid=history-grouping] svg')
    const heads = [...document.querySelectorAll('.sidebar-section')]
    return {
      lefts: [
        ...rows.filter((r) => !r.classList.contains('nested')).map((r) => textLeft(r.querySelector('.label'))),
        ...heads.map((h) => textLeft(h.querySelector('.section-label')))
      ],
      nested: rows.filter((r) => r.classList.contains('nested')).map((r) => textLeft(r.querySelector('.label'))),
      links: document.querySelectorAll('.nested [data-testid=child-link]').length,
      rights: [
        ...[...document.querySelectorAll('[data-testid=history-item] .row-meta > *, [data-testid=history-day]')].map((m) => Math.round(box(m).right)),
        Math.round(box(document.querySelector('.sidebar-kbd')).right),
        ...(filter ? [Math.round(box(filter).right)] : [])
      ],
      heads: heads.map((h) => [getComputedStyle(h).fontSize, getComputedStyle(h).fontWeight, getComputedStyle(h).textTransform].join(' '))
    }
  })()`)
  const lefts = new Set(geometry.lefts)
  const edge = geometry.lefts[0]
  check(
    lefts.size === 1 && geometry.lefts.length >= 3,
    `titres au bord : ${geometry.lefts.length} titres et en-têtes sur une même verticale (${[...lefts].join(', ')} px)`
  )
  check(
    geometry.nested.every((left) => left === edge + 30) &&
      geometry.links === geometry.nested.length,
    `filles : 30 px plus loin que leur mère, chacune avec son lien (${geometry.nested.join(', ') || 'aucune'})`
  )
  // Le glyphe du filtre a une marge interne d'un pixel environ : tolérance de 2 px.
  check(
    Math.max(...geometry.rights) - Math.min(...geometry.rights) <= 2,
    `marge droite commune : temps écoulé, états, ⌘K, filtre (${geometry.rights.join(', ')} px)`
  )
  check(
    geometry.heads.every((h) => h === '11px 600 uppercase'),
    `en-têtes de section : petites capitales, 11 px, 600 (${geometry.heads.join(' | ')})`
  )
}
