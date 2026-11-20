import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { L, MAIN_PORT, check, mainProcess, withApp } from '../lib.mjs'

/** Petite image PNG (2 × 2), pour l'aperçu d'une image du dossier. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVQI12P4z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==',
  'base64'
)

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
 * Markdown rendu et source, image, lien `fichier:ligne` du fil, remarque sur une ligne envoyée à
 * l'agent, agrandi avec l'arbre de côté. Aucune vraie app ne s'ouvre (`BOBINE_OPEN_LOG`).
 */
export async function filesSuite(scheme) {
  console.log(`\n— Vue des fichiers (${scheme})`)
  const workspace = realpathSync(mkdtempSync(join(tmpdir(), 'bob-e2e-fichiers-')))
  mkdirSync(join(workspace, 'src'))
  mkdirSync(join(workspace, 'docs'))
  mkdirSync(join(workspace, 'assets'))
  writeFileSync(join(workspace, 'src', 'app.ts'), 'export const a = 1\n')
  writeFileSync(
    join(workspace, 'docs', 'guide.md'),
    '# Guide\n\nUn **document** du projet, voir [le code](../src/app.ts).\n'
  )
  writeFileSync(join(workspace, 'README.md'), '# Projet\n')
  writeFileSync(join(workspace, '.gitignore'), 'build/\n')
  writeFileSync(join(workspace, 'assets', 'logo.png'), PNG)
  execFileSync('git', ['init', '-q'], { cwd: workspace })
  const log = join(workspace, '..', `ouvertures-fichiers-${scheme}-${Date.now()}.log`)
  writeFileSync(log, '')
  const opened = () => readFileSync(log, 'utf8').trim().split('\n').filter(Boolean)
  const row = (path) => `document.querySelector('[data-testid=file-row][data-path="${path}"]')`
  const fileView = `document.querySelector('[data-testid=file-view]')`
  try {
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        await ui.send('Ajoute une fonction somme')
        await ui.ready()
        await ui.waitFor(`document.querySelectorAll('[data-testid=file-link]').length === 1`)
        check(
          !(await ui.ev(`!!document.querySelector('.side-panel-tab[data-tab=files]')`)),
          'jamais ouvert d’office : pas d’onglet Fichiers sans le demander'
        )

        // ⌘P : l'onglet s'ouvre, le curseur dans le filtre.
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
            .then((order) => order.startsWith('assets,build,docs,src,.env,.gitignore,README.md')),
          'tri : dossiers d’abord, noms à point en tête'
        )
        await ui.shot('271-arbre')

        // Filtre : liste plate, ↵ ouvre le premier.
        await ui.ev(`${ui.$('files-filter')}.focus()`)
        await ui.cdp('Input.insertText', { text: 'guide' })
        await ui.waitFor(
          `document.querySelector('[data-testid=files-hit]')?.dataset.path === 'docs/guide.md'`
        )
        await ui.press('Enter')
        await ui.waitFor(
          `${fileView}?.dataset.path === 'docs/guide.md' && !!${ui.$('file-markdown')}`
        )
        check(
          await ui.ev(`${ui.$('file-markdown')}.innerText.includes('document')`),
          'filtre → Markdown rendu dans l’onglet'
        )
        check(
          (await ui.ev(
            `document.querySelector('.side-panel-tab[data-tab=files] [role=tab]').getAttribute('aria-label')`
          )) === 'guide.md',
          'l’onglet prend le nom du fichier ouvert'
        )
        await ui.click(ui.$('file-source'))
        await ui.waitFor(
          `!!${ui.$('file-code')} && !!${ui.$('file-code')}.querySelector('.hljs-section')`
        )
        check(true, 'Markdown en source : coloré, numéroté')
        await ui.shot('271-markdown-source')

        // Lien du fil : src/app.ts à la ligne 3, coloré.
        await ui.click(`document.querySelector('[data-testid=file-link]')`)
        await ui.waitFor(
          `${fileView}?.dataset.path === 'src/app.ts' && !!document.querySelector('.file-line.target[data-line="3"]')`
        )
        check(
          await ui.ev(`!!${ui.$('file-code')}.querySelector('.hljs-keyword')`),
          'lien src/app.ts:3 du fil : le fichier dans l’onglet, à la ligne, coloré'
        )
        check(opened().length === 0, 'rien d’ouvert dans une autre app')
        check(
          await ui.ev(`!!${ui.$('file-previous')} && !${ui.$('file-previous')}.disabled`),
          'fichier précédent disponible (historique)'
        )

        // Remarque sur les lignes 3 à 4, envoyée à l'agent.
        const add = (n) =>
          `document.querySelector('.file-line[data-line="${n}"] [data-testid=file-note-add]')`
        await ui.click(add(3))
        await ui.ev(
          `${add(4)}.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }))`
        )
        await ui.waitFor(`!!${ui.$('file-note-input')}`)
        await ui.ev(`${ui.$('file-note-input')}.focus()`)
        await ui.cdp('Input.insertText', { text: 'Ajoute un test' })
        await ui.click(ui.$('file-note-save'))
        await ui.waitFor(`!!${ui.$('file-note')} && !!${ui.$('diff-notes-bar')}`)
        await ui.shot('271-remarque')
        const users = await ui.ev(`document.querySelectorAll('.msg-user').length`)
        await ui.click(ui.$('diff-notes-send'))
        await ui.waitFor(`document.querySelectorAll('.msg-user').length > ${users}`)
        const sent = await ui.ev(`[...document.querySelectorAll('.msg-user')].at(-1).innerText`)
        check(
          sent.includes('Remarques sur le code') &&
            sent.includes('src/app.ts, lignes 3 à 4') &&
            sent.includes('Ajoute un test'),
          'remarque sur deux lignes : message à l’agent avec le fichier, les lignes et le code'
        )
        await ui.ready()

        // Image du dossier.
        await ui.click(ui.$('file-close'))
        await ui.waitFor(`!!${row('assets')}`)
        await ui.click(row('assets'))
        await ui.waitFor(`!!${row('assets/logo.png')}`)
        await ui.click(row('assets/logo.png'))
        await ui.waitFor(`!!document.querySelector('[data-testid=file-image] img')?.naturalWidth`)
        check(true, 'image : affichée dans l’onglet')

        // Secret (Q8) : affiché comme un autre fichier.
        await ui.click(ui.$('file-close'))
        await ui.click(row('.env'))
        await ui.waitFor(
          `${fileView}?.dataset.path === '.env' && ${ui.$('file-code')}.innerText.includes('factice-0000')`
        )
        check(true, '.env : affiché comme un autre fichier (valeurs factices)')

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

        // Actions : Finder, app par défaut (journal, rien d'ouvert pour de vrai).
        await ui.click(ui.$('file-view-actions'))
        await ui.click(`document.querySelector('[data-testid=file-action-reveal]')`)
        check(
          await (async () => {
            for (let i = 0; i < 50; i++) {
              if (opened().includes(`reveal ${join(workspace, '.env')}`)) return true
              await new Promise((r) => setTimeout(r, 100))
            }
            return false
          })(),
          'Afficher dans le Finder : le fichier, vérifié par le main'
        )
        await ui.click(
          `document.querySelector('.side-panel-tab[data-tab=files] [data-testid=panel-tab-close]')`
        )
        await ui.waitFor(`!${ui.$('files-tab')}`)
        check(true, `onglet fermé (${L('files.tab')})`)
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
