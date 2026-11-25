import { execFileSync } from 'node:child_process'
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { L, MAIN_PORT, check, mainProcess, withApp } from '../lib.mjs'

/** Petite image PNG (2 × 2), pour l'aperçu d'une image du dossier. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVQI12P4z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==',
  'base64'
)

/** Chemin profond, pour le fil d'Ariane d'un panneau étroit (point 16). */
const DEEP = 'src/composants/formulaires/champs/dates/ChampDateAvecUnNomVraimentTresLong.tsx'

/** Une ligne indentée bien plus longue que le panneau, pour le retrait suspendu (point 5). */
const LONG = [
  'export function rapport(lignes: string[]) {',
  '    const resume = lignes.filter((ligne) => ligne.trim().length > 0).map((ligne, rang) => `${rang + 1}. ${ligne}`).join(" ; ")',
  '    return resume',
  '}',
  ''
].join('\n')

/** Commande d'un menu de l'app (le protocole DevTools ne passe pas par les accélérateurs). */
async function menu(id) {
  const main = await mainProcess()
  try {
    await main.evaluate(
      `require('electron').Menu.getApplicationMenu().getMenuItemById('${id}').click()`
    )
  } finally {
    main.close()
  }
}

/**
 * Vue des fichiers (fiche 271) : onglet « Fichiers » à la demande (menu « + », ⌘P, ⇧⌘Y), arbre
 * (ignorés atténués, point des fichiers modifiés, `.env` affiché), filtre, fichier ouvert coloré,
 * Markdown rendu et source, image, binaire, fichier disparu, lien `fichier:ligne` du fil,
 * remarque sur une ligne envoyée à l'agent, recherche, retour à la ligne, menus, clavier, agrandi
 * avec l'arbre de côté, panneau étroit. Aucune vraie app ne s'ouvre (`BOBINE_OPEN_LOG`).
 */
export async function filesSuite(scheme) {
  console.log(`\n— Vue des fichiers (${scheme})`)
  const workspace = realpathSync(mkdtempSync(join(tmpdir(), 'bob-e2e-fichiers-')))
  for (const dir of ['src', 'docs', 'assets', 'scripts', DEEP.split('/').slice(0, -1).join('/')]) {
    mkdirSync(join(workspace, dir), { recursive: true })
  }
  writeFileSync(join(workspace, 'src', 'app.ts'), 'export const a = 1\n')
  writeFileSync(join(workspace, 'src', 'rapport.ts'), LONG)
  writeFileSync(join(workspace, DEEP), 'export const champ = 1\n')
  writeFileSync(
    join(workspace, 'docs', 'guide.md'),
    '# Guide\n\nUn **document** du projet, voir [le code](../src/app.ts).\n'
  )
  writeFileSync(join(workspace, 'README.md'), '# Projet\n')
  writeFileSync(join(workspace, '.gitignore'), 'build/\n')
  writeFileSync(join(workspace, 'assets', 'logo.png'), PNG)
  writeFileSync(join(workspace, 'assets', 'donnees.bin'), Buffer.from([1, 2, 0, 3, 4]))
  writeFileSync(join(workspace, 'scripts', 'outil.sh'), '#!/bin/sh\necho bonjour\n')
  chmodSync(join(workspace, 'scripts', 'outil.sh'), 0o755)
  writeFileSync(join(workspace, 'docs', 'temporaire.txt'), 'à effacer\n')
  // Un FIFO (B1) : listé grisé, jamais ouvert. Windows n'en a pas dans un dossier.
  const fifo = process.platform !== 'win32'
  if (fifo) execFileSync('mkfifo', [join(workspace, 'tuyau')])
  execFileSync('git', ['init', '-q'], { cwd: workspace })
  const log = join(workspace, '..', `ouvertures-fichiers-${scheme}-${Date.now()}.log`)
  writeFileSync(log, '')
  const opened = () => readFileSync(log, 'utf8').trim().split('\n').filter(Boolean)
  const row = (path) => `document.querySelector('[data-testid=file-row][data-path="${path}"]')`
  const fileView = `document.querySelector('[data-testid=file-view]')`
  const filesTab = `document.querySelector('.side-panel-tab[data-tab=files]')`
  const tabClose = `${filesTab}?.querySelector('[data-testid=panel-tab-close]')`
  const showing = (path) => `${fileView}?.dataset.path === ${JSON.stringify(path)}`
  const openFromTree = async (ui, path) => {
    await ui.click(row(path))
    await ui.waitFor(showing(path))
  }
  try {
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        await ui.send('Ajoute une fonction somme')
        await ui.ready()
        // Un lien Markdown (`src/app.ts:3`) et un chemin en code (`liste.js:2`).
        await ui.waitFor(`document.querySelectorAll('[data-testid=file-link]').length === 2`)
        check(!(await ui.ev(`!!${filesTab}`)), 'jamais ouvert d’office')

        // ⌘P : l'onglet s'ouvre, le curseur dans le filtre ; icône dossier.
        await menu('files')
        await ui.waitFor(
          `!!${ui.$('files-tab')} && document.activeElement === ${ui.$('files-filter')}`
        )
        check(true, '⌘P : onglet Fichiers ouvert, curseur dans le filtre')
        await ui.waitFor(`!!${row('src')} && !!${row('build')} && !!${row('.env')}`)
        check(
          await ui.ev(
            `${row('build')}.classList.contains('ignored') && !${row('src')}.classList.contains('ignored')`
          ),
          'build/ ignoré par git : visible, atténué'
        )
        check(
          await ui.ev(`!!${row('src')}.querySelector('[data-testid=file-row-modified]')`),
          'dossier replié qui contient un fichier modifié : un point'
        )
        check(
          await ui
            .ev(
              `[...document.querySelectorAll('[data-testid=file-row]')].map((r) => r.dataset.path).join(',')`
            )
            .then((order) => order.startsWith('assets,build,docs,scripts,src,.env,.gitignore')),
          'tri : dossiers d’abord, noms à point en tête'
        )
        check(
          await ui.ev(
            `![...document.querySelectorAll('[data-testid=file-row]')].some((r) => r.title)`
          ),
          'pas d’infobulle native sur les lignes'
        )
        await ui.shot('271-arbre')

        // FIFO (B1) : grisé, dit « spécial », un clic n'ouvre rien et rien ne fige l'app.
        if (fifo) {
          await ui.waitFor(`!!${row('tuyau')}`)
          check(
            await ui.ev(
              `${row('tuyau')}.classList.contains('special') && !!${row('tuyau')}.querySelector('[data-testid=file-row-special]') && ${row('tuyau')}.getAttribute('draggable') === 'false'`
            ),
            'FIFO : grisé, marqué spécial, pas de glisser'
          )
          await ui.click(row('tuyau'))
          await ui.ev(`new Promise((r) => setTimeout(r, 300))`)
          check(!(await ui.ev(`!!${fileView}`)), 'FIFO : un clic n’ouvre rien')
          await ui.ev(
            `${row('tuyau')}.querySelector('[data-testid=file-row-special]').dispatchEvent(new PointerEvent('pointermove', { bubbles: true }))`
          )
          await ui.shot('271-special')
        }

        // Une lettre tapée dans l'arbre part au filtre.
        await ui.ev(`${row('docs')}.focus()`)
        await ui.press('g')
        await ui.waitFor(
          `document.activeElement === ${ui.$('files-filter')} && ${ui.$('files-filter')}.value === 'g'`
        )
        check(true, 'une lettre tapée dans l’arbre part au filtre')
        // Fichier exclu pour l'agent : marqué dans le filtre comme dans l'arbre (M6).
        await ui.ev(`${ui.$('files-filter')}.select()`)
        await ui.cdp('Input.insertText', { text: '.env' })
        await ui.waitFor(
          `[...document.querySelectorAll('[data-testid=files-hit]')].some((h) => h.dataset.path === '.env' && !!h.querySelector('[data-testid=files-hit-excluded]'))`
        )
        check(true, 'filtre : .env exclu pour l’agent, marqué')
        await ui.shot('271-filtre-exclu')
        await ui.ev(`${ui.$('files-filter')}.select()`)
        await ui.cdp('Input.insertText', { text: 'guide' })
        await ui.waitFor(
          `document.querySelector('[data-testid=files-hit]')?.dataset.path === 'docs/guide.md'`
        )
        check(
          await ui.ev(
            `document.querySelector('[data-testid=files-hit]').getAttribute('aria-selected') === 'true'`
          ),
          'filtre : premier résultat présélectionné (aria-selected)'
        )
        await ui.shot('271-filtre')
        await ui.press('Enter')
        await ui.waitFor(`${showing('docs/guide.md')} && !!${ui.$('file-markdown')}`)
        check(true, 'filtre → Markdown rendu dans l’onglet')
        check(
          (await ui.ev(`${filesTab}.querySelector('[role=tab]').getAttribute('aria-label')`)) ===
            'guide.md',
          'l’onglet prend le nom du fichier ouvert'
        )

        // ⌘F, le focus dans un Markdown rendu : la recherche du fil, pas avalée (point 2).
        await ui.ev(`${ui.$('file-previous')}.closest('[data-testid=file-view]').focus?.()`)
        await ui.ev(`document.querySelector('[data-testid=file-markdown] a')?.focus()`)
        await menu('find')
        await ui.waitFor(`!!${ui.$('find-bar')}`)
        check(
          !(await ui.ev(`!!${ui.$('file-find')}`)),
          '⌘F sur un Markdown rendu : la recherche du fil'
        )
        await ui.key('Escape')
        await ui.waitFor(`!${ui.$('find-bar')}`)

        await ui.click(ui.$('file-source'))
        await ui.waitFor(
          `!!${ui.$('file-code')} && !!${ui.$('file-code')}.querySelector('.hljs-section')`
        )
        check(true, 'Markdown en source : coloré, numéroté')
        await ui.shot('271-markdown-source')

        // Lien du fil : src/app.ts à la ligne 3, coloré, éclairé un instant seulement.
        await ui.click(`document.querySelector('[data-testid=file-link]')`)
        await ui.waitFor(`${showing('src/app.ts')} && ${ui.$('file-code')}?.dataset.asked === '3'`)
        check(
          await ui.ev(`!!${ui.$('file-code')}.querySelector('.hljs-keyword')`),
          'lien src/app.ts:3 du fil : le fichier dans l’onglet, à la ligne, coloré'
        )
        await ui.waitFor(`!document.querySelector('.file-line.flash')`, 5000)
        check(true, 'la ligne demandée n’est éclairée que le temps d’un éclair')
        check(opened().length === 0, 'rien d’ouvert dans une autre app')

        // Chemin sans dossier écrit en code dans la réponse (`liste.js:2`) : le même lien, le même
        // chemin (avant, `liste.js:` passait pour un schéma et le lien était vidé).
        const codeLink = `[...document.querySelectorAll('[data-testid=file-link]')].find((a) => a.textContent === 'liste.js:2')`
        await ui.click(codeLink)
        await ui.waitFor(`${showing('liste.js')} && ${ui.$('file-code')}?.dataset.asked === '2'`)
        check(
          opened().length === 0,
          'lien en code `liste.js:2` : le fichier dans l’onglet, à la ligne, rien d’ouvert ailleurs'
        )
        // Retour à src/app.ts (la suite cherche dedans) par son lien du fil.
        await ui.click(`document.querySelector('[data-testid=file-link]')`)
        // Le chemin de la vue change avant que le code du fichier soit lu et rendu : attendre le
        // code lui-même (ligne demandée par le lien), sinon `focus()` part sur un élément absent.
        await ui.waitFor(`${showing('src/app.ts')} && ${ui.$('file-code')}?.dataset.asked === '3'`)

        // ⌘F dans le code : premier résultat dès la frappe, « 1 sur N ».
        await ui.ev(`${ui.$('file-code')}.focus()`)
        await menu('find')
        await ui.waitFor(`document.activeElement === ${ui.$('file-find')}`)
        await ui.cdp('Input.insertText', { text: 'export' })
        await ui.waitFor(
          `${ui.$('file-find-count')}.innerText === ${JSON.stringify(L('files.findCount', { at: 1, count: 2 }))}`
        )
        check(!(await ui.ev(`!!${ui.$('find-bar')}`)), '⌘F dans le code : cherche dans le fichier')
        check(
          await ui.ev(
            `${ui.$('file-find-bar')}.getBoundingClientRect().bottom <= ${ui.$('file-code')}.getBoundingClientRect().top + 1`
          ),
          'la barre de recherche ne recouvre pas le code'
        )
        await ui.shot('271-recherche')
        await ui.click(ui.$('file-find-next'))
        await ui.waitFor(
          `${ui.$('file-find-count')}.innerText === ${JSON.stringify(L('files.findCount', { at: 2, count: 2 }))}`
        )
        await ui.click(ui.$('file-find-close'))
        await ui.waitFor(`!${ui.$('file-find-bar')}`)

        // Remarque au clavier : une étape de tabulation, ↓ puis + (point 17).
        await ui.ev(
          `document.querySelector('.file-line[data-line="1"] [data-testid=file-note-add]').focus()`
        )
        check(
          await ui.ev(
            `document.querySelectorAll('[data-testid=file-note-add][tabindex="0"]').length === 1`
          ),
          'gouttière : un seul arrêt de tabulation'
        )
        await ui.press('ArrowDown')
        await ui.press('ArrowDown')
        await ui.press('+')
        await ui.waitFor(`!!${ui.$('file-note-input')}`)
        await ui.ev(`${ui.$('file-note-input')}.focus()`)
        await ui.cdp('Input.insertText', { text: 'Ajoute un test' })
        await ui.click(ui.$('file-note-save'))
        await ui.waitFor(
          `!!${ui.$('file-note')} && !!document.querySelector('.file-line.noted[data-line="3"]')`
        )
        check(true, 'remarque posée au clavier, ligne commentée marquée (noted)')
        check(
          (await ui.ev(`${ui.$('files-notes-count')}.innerText`)).includes(
            L('files.notesHere', { count: 1, n: '1' })
          ),
          'barre : « 1 remarque · 1 sur ce fichier »'
        )
        // Capture sans l'éclair passager d'une ligne parcourue au clavier.
        await ui.waitFor(`!document.querySelector('.file-line.flash')`, 5000)
        await ui.shot('271-remarque')
        // Corbeille : effacées, puis rendues par « Annuler ».
        await ui.click(ui.$('diff-notes-clear'))
        await ui.waitFor(`!!${ui.$('files-notes-cleared')}`)
        await ui.click(ui.$('files-notes-undo'))
        await ui.waitFor(`!!${ui.$('diff-notes-bar')} && !!${ui.$('file-note')}`)
        check(true, 'corbeille : « Annuler » rend les remarques')
        const users = await ui.ev(`document.querySelectorAll('.msg-user').length`)
        await ui.click(ui.$('diff-notes-send'))
        await ui.waitFor(`document.querySelectorAll('.msg-user').length > ${users}`)
        const sent = await ui.ev(`[...document.querySelectorAll('.msg-user')].at(-1).innerText`)
        check(
          sent.includes('Remarques sur le code') &&
            sent.includes('src/app.ts, ligne 3') &&
            sent.includes('Ajoute un test'),
          'remarque envoyée à l’agent avec le fichier, la ligne et le code'
        )
        await ui.ready()

        // Un seul ✕ (point 3) : celui de l'onglet ramène d'abord à l'arbre.
        check(!(await ui.ev(`!!${ui.$('file-close')}`)), 'pas de ✕ dans l’en-tête du fichier')
        await ui.click(tabClose)
        await ui.waitFor(`!${fileView} && !!${ui.$('file-tree')} && !!${filesTab}`)
        check(true, '✕ de l’onglet, un fichier ouvert : retour à l’arbre, l’onglet reste')

        // Menu de vue (un seul) et menu contextuel (pointeur, Maj+F10).
        await ui.click(ui.$('files-menu'))
        await ui.waitFor(`!!${ui.$('files-menu-content')}`)
        await ui.shot('271-menu')
        await ui.key('Escape')
        await ui.waitFor(`!${ui.$('files-menu-content')}`)
        await ui.click(row('scripts'))
        await ui.waitFor(`!!${row('scripts/outil.sh')}`)
        await ui.ev(`${row('scripts/outil.sh')}.focus()`)
        await ui.press('F10', 8)
        await ui.waitFor(`!!${ui.$('file-context-menu')}`)
        check(
          !(await ui.ev(`!!document.querySelector('[data-testid=file-action-default]')`)) &&
            (await ui.ev(`!!document.querySelector('[data-testid=file-action-reveal]')`)),
          'exécutable : pas d’« Ouvrir avec l’app par défaut » (Maj+F10)'
        )
        await ui.key('Escape')
        await ui.waitFor(`!${ui.$('file-context-menu')}`)
        await ui.ev(`(() => {
          const r = ${row('README.md')}.getBoundingClientRect()
          ${row('README.md')}.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left + 40, clientY: r.top + 8 }))
        })()`)
        await ui.waitFor(`!!${ui.$('file-context-menu')}`)
        check(
          await ui.ev(`(() => {
            const menu = ${ui.$('file-context-menu')}.getBoundingClientRect()
            const r = ${row('README.md')}.getBoundingClientRect()
            return Math.abs(menu.left - (r.left + 40)) < 30
          })()`),
          'clic droit : le menu s’ouvre au pointeur'
        )
        check(
          await ui.ev(`${row('README.md')}.classList.contains('menu-open')`),
          'clic droit : la ligne visée reste marquée tant que son menu est ouvert'
        )
        await ui.shot('271-actions')
        await ui.key('Escape')
        await ui.waitFor(`!${ui.$('file-context-menu')}`)

        // Image, binaire.
        await ui.click(row('assets'))
        await ui.waitFor(`!!${row('assets/logo.png')}`)
        await openFromTree(ui, 'assets/logo.png')
        await ui.waitFor(`!!document.querySelector('[data-testid=file-image] img')?.naturalWidth`)
        check(true, 'image : affichée dans l’onglet')
        await ui.shot('271-image')
        await ui.click(tabClose)
        await openFromTree(ui, 'assets/donnees.bin')
        await ui.waitFor(`!!${ui.$('file-binary')}`)
        check(true, 'binaire : une fiche, Ouvrir et Finder')
        await ui.shot('271-binaire')
        await ui.click(tabClose)

        // Secret (Q8) : affiché comme un autre fichier.
        await openFromTree(ui, '.env')
        await ui.waitFor(`${ui.$('file-code')}?.innerText.includes('factice-0000')`)
        check(true, '.env : affiché comme un autre fichier (valeurs factices)')
        await ui.click(tabClose)

        // Fichier disparu : relu, il le dit.
        await ui.waitFor(`!!${row('docs/temporaire.txt')}`)
        await openFromTree(ui, 'docs/temporaire.txt')
        rmSync(join(workspace, 'docs', 'temporaire.txt'))
        await ui.click(ui.$('files-menu'))
        await ui.click(ui.$('files-menu-reload'))
        await ui.waitFor(`!!${ui.$('file-error')}`)
        check(
          (await ui.ev(`${ui.$('file-error')}.innerText`)) === L('files.missing'),
          'fichier effacé puis relu : « Ce fichier n’existe plus. »'
        )
        await ui.shot('271-disparu')
        await ui.click(tabClose)

        // Retour à la ligne : la suite s'aligne sur l'indentation (retrait suspendu).
        await ui.waitFor(`!!${row('src')}`)
        if (!(await ui.ev(`!!${row('src/rapport.ts')}`))) await ui.click(row('src'))
        await ui.waitFor(`!!${row('src/rapport.ts')}`)
        await openFromTree(ui, 'src/rapport.ts')
        await ui.waitFor(`!!document.querySelector('.file-line[data-line="2"]')`)
        check(
          await ui.ev(
            `getComputedStyle(document.querySelector('.file-line[data-line="2"] .file-text')).paddingLeft !== '0px'`
          ),
          'retour à la ligne : retrait suspendu sur l’indentation'
        )
        await ui.shot('271-retour-ligne')
        await ui.click(tabClose)

        // Panneau étroit (360 px) et chemin profond : le nom du fichier passe en priorité.
        await ui.click(row('src/composants'))
        for (const dir of ['formulaires', 'formulaires/champs', 'formulaires/champs/dates']) {
          await ui.waitFor(`!!${row(`src/composants/${dir}`)}`)
          await ui.click(row(`src/composants/${dir}`))
        }
        await ui.waitFor(`!!${row(DEEP)}`)
        await openFromTree(ui, DEEP)
        const handle = await ui.ev(
          `(() => { const b = document.querySelector('.side-panel-resize').getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + 200 } })()`
        )
        const panelLeft = await ui.ev(`innerWidth - 360`)
        await ui.drag(handle, { x: panelLeft, y: handle.y })
        await ui.waitFor(`Math.abs(${ui.$('side-panel')}.getBoundingClientRect().width - 360) < 6`)
        check(
          await ui.ev(`(() => {
            const name = document.querySelector('.crumb.current')
            return name.scrollWidth <= name.clientWidth + 1 && !!${ui.$('file-crumb-more')}
          })()`),
          'panneau à 360 px : nom du fichier entier, dossiers du milieu en « … »'
        )
        check(
          await ui.ev(
            `!!document.querySelector('[data-testid=file-breadcrumb] .crumb-dirs.clipped')`
          ),
          'panneau à 360 px : dossiers coupés, un « … » en tête (pas de « / » orphelin)'
        )
        await ui.shot('271-chemin-long')
        await ui.ev(
          `document.querySelector('.side-panel-resize').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))`
        )

        // Agrandi : le fichier et l'arbre côte à côte (arbre à droite).
        await ui.viewport(1400, 900)
        await menu('maximize-panel')
        await ui.waitFor(`!!document.querySelector('.files-tab.side-by-side.tree-right')`)
        check(
          await ui.ev(
            `${ui.$('files-tree-pane')}.getBoundingClientRect().left > ${fileView}.getBoundingClientRect().left`
          ),
          'agrandi : le fichier à gauche, l’arbre à droite'
        )
        await ui.shot('271-agrandi')
        await menu('files-tree')
        await ui.waitFor(
          `!document.querySelector('.files-tab.side-by-side') && !${ui.$('files-tree-pane')}`
        )
        check(true, '⇧⌘Y : l’arbre se cache, le fichier prend la place')
        await menu('files-tree')
        await ui.waitFor(`!!document.querySelector('.files-tab.side-by-side')`)
        await menu('maximize-panel')
        await ui.viewport(0)

        // Actions : Finder (journal, rien d'ouvert pour de vrai).
        await ui.click(ui.$('file-view-actions'))
        await ui.click(`document.querySelector('[data-testid=file-action-reveal]')`)
        check(
          await (async () => {
            for (let i = 0; i < 50; i++) {
              if (opened().includes(`reveal ${join(workspace, DEEP)}`)) return true
              await new Promise((r) => setTimeout(r, 100))
            }
            return false
          })(),
          'Afficher dans le Finder : le fichier, vérifié par le main'
        )

        // ✕ deux fois : l'arbre, puis l'onglet fermé ; Échap sur un filtre vide : la saisie.
        await ui.click(tabClose)
        await ui.waitFor(`!${fileView}`)
        await ui.ev(`${ui.$('files-filter')}.focus()`)
        await ui.key('Escape')
        await ui.waitFor(`document.activeElement === ${ui.$('composer-input')}`)
        check(true, 'Échap sur un filtre vide : le clavier revient à la zone de saisie')
        await ui.click(tabClose)
        await ui.waitFor(`!${ui.$('files-tab')} && !${filesTab}`)
        check(true, `second ✕ : onglet fermé (${L('files.tab')})`)
      },
      undefined,
      'fichiers',
      { BOBINE_WORKSPACE: workspace, BOBINE_OPEN_LOG: log },
      [`--inspect=${MAIN_PORT}`]
    )
  } finally {
    rmSync(workspace, { recursive: true, force: true })
    rmSync(log, { force: true })
  }
}
