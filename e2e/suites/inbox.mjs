import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  FEATURES,
  L,
  LANG,
  dockBadgeIs,
  MAIN_PORT,
  check,
  mainProcess,
  sleep,
  withApp
} from '../lib.mjs'

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
  const badgeIs = (expected) => dockBadgeIs(main, expected)
  const inboxRow = (id) => `document.querySelector('[data-testid=history-item][data-id="${id}"]')`
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
    // « Lancer » n'est armé qu'une fois le dossier de la mère lu (fiches 240, 262) : un clic plus
    // tôt est ignoré (`ChildDialog.test.tsx`), et la fenêtre restait ouverte sous charge. On
    // attend le bouton actif, comme un humain.
    await ui.waitFor(`!${ui.$('child-launch')}.disabled`, 30000)
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
  const colors = await ui.ev(
    `${JSON.stringify([access, auth, ...children])}.map((id) => getComputedStyle(document.querySelector('[data-id="' + id + '"] .child-state')).color)`
  )
  check(
    colors[0] === colors[1] && colors[2] === colors[3] && colors[0] !== colors[2],
    'couleurs communes pour demandes et réponses non lues'
  )
  await grid(ui)
  check(await badgeIs('4'), `compteur du Dock : 4, posé par le main (${await badge()})`)

  // Une seule bannière pour les deux filles (fenêtre élargie dans l'essai).
  for (let i = 0; i < 150 && (await notes()).length < 1; i++) await sleep(100)
  await sleep(500)
  await ui.shot('inbox-1-etats-sur-place')

  // Réglage « Compteur sur l'icône du Dock », trouvé par la recherche des réglages ; seulement là
  // où la plateforme a ce compteur (fiche 145), absent ailleurs.
  await main.evaluate(
    `(require('electron').Menu.getApplicationMenu().getMenuItemById('settings').click(), true)`
  )
  await ui.waitFor(`!!${ui.$('settings')}`)
  await ui.ev(`${ui.$('settings-search')}.focus(); true`)
  if (FEATURES.dockBadge) {
    await ui.type(LANG === 'en' ? 'dock icon count' : 'compteur')
    await ui.waitFor(
      `[...document.querySelectorAll('[data-testid=settings-result]')].some((r) => r.innerText.includes(${JSON.stringify(L('settings.notifications.dockBadge.label'))}))`
    )
    await ui.enter()
    await ui.waitFor(`!!${ui.$('settings-dock-badge')}`)
    await ui.click(ui.$('settings-dock-badge'))
    await ui.waitFor(`!${ui.$('settings-dock-badge')}.checked`)
    for (let i = 0; i < 30 && !(await badgeIs('')); i++) await sleep(100)
    await ui.ev(`${ui.$('settings-dock-badge')}.scrollIntoView({ block: 'center' }), true`)
    await ui.shot('inbox-2-reglage-compteur')
    await ui.click(ui.$('settings-dock-badge'))
    await ui.waitFor(`${ui.$('settings-dock-badge')}.checked`)
    for (let i = 0; i < 30 && !(await badgeIs('4')); i++) await sleep(100)
  } else {
    // « dock » mène aussi au rebond, proposé partout : la recherche a répondu sans le compteur.
    await ui.type('dock')
    const results = `[...document.querySelectorAll('[data-testid=settings-result]')].map((r) => r.innerText).join('\\n')`
    await ui.waitFor(
      `${results}.includes(${JSON.stringify(L('settings.notifications.dockBounce.label'))})`
    )
    await ui.click(
      `[...document.querySelectorAll('[data-testid=settings-result]')].find((r) => r.innerText.includes(${JSON.stringify(L('settings.notifications.dockBounce.label'))}))`
    )
    await ui.waitFor(`!!${ui.$('settings-dock-bounce')}`)
  }
  await ui.key('Escape')
  await ui.waitFor(`!${ui.$('settings')}`)

  // Tout traiter, fenêtre au premier plan : la section se vide, le compteur s'efface. On quitte la
  // mère avant de revenir dans la fenêtre : affichée sous les yeux, elle ferait lire les comptes
  // rendus de ses filles (fiche 258, D35), essayé plus bas. La demande d'accord affichée, le main
  // a changé de conversation.
  await ui.click(`${inboxRow(access)}.querySelector('.history-open')`)
  const allow = `document.querySelector('[data-testid=permission] button[data-kind=allow_once]')`
  await ui.waitFor(`!!${allow}`, 30000)
  await focus(true)
  await ui.click(allow)
  await ui.ready()
  await away()
  await ui.waitFor(`!${inboxRow(access)}?.classList.contains('unread')`)
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
  // Une fille ouverte : lue (fiche 024).
  await ui.click(`${inboxRow(children[0])}.querySelector('.history-open')`)
  await ui.waitFor(
    `document.querySelector('.history-item.active')?.dataset.id === ${JSON.stringify(children[0])}`
  )
  await away()
  await ui.waitFor(`!${inboxRow(children[0])}?.classList.contains('unread')`)
  // La mère ouverte : le compte rendu de l'autre fille, posé dans son fil, est lu (fiche 258, D35).
  await ui.click(`${inboxRow(mother)}.querySelector('.history-open')`)
  await ui.waitFor(
    `document.querySelector('.history-item.active')?.dataset.id === ${JSON.stringify(mother)}`
  )
  await away()
  await ui.waitFor(`!${inboxRow(children[1])}?.classList.contains('unread')`)
  await ui.waitFor(`document.querySelectorAll('.history-item.unread').length === 0`)
  for (let i = 0; i < 30 && !(await badgeIs('')); i++) await sleep(100)
  await grid(ui)
  await ui.shot('inbox-3-traite')

  // Titres bruts comme Bob (fiche 125) : chemin absolu, `cd` vers le dossier, liste de tâches. La
  // raison en infobulle dit la même chose que la carte, chemins relatifs.
  const bob = await fresh('Titres de Bob')
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
