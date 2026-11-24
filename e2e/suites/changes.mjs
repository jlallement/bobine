import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { L, Lpart, check, withApp } from '../lib.mjs'

/** Récapitulatif des modifications (fiche 021) : vue « Conversation » et vue « Git ». */
export async function changesSuite(scheme) {
  console.log(`\n— Modifications (${scheme})`)
  const workspace = mkdtempSync(join(tmpdir(), 'bob-e2e-changes-'))
  const openLog = join(mkdtempSync(join(tmpdir(), 'bob-e2e-ouvertures-')), 'ouvertures.log')
  const git = (...args) =>
    execFileSync('git', ['-c', 'user.name=e2e', '-c', 'user.email=e2e@example.invalid', ...args], {
      cwd: workspace
    })
  writeFileSync(join(workspace, 'README.md'), '# Démo\n\nVersion 1\n\n## Utilisation\n')
  git('init', '-q', '-b', 'main')
  git('add', '.')
  git('commit', '-q', '-m', 'init')
  // Modifié par l'utilisateur lui-même : seulement dans la vue « Git ».
  writeFileSync(join(workspace, 'notes.txt'), 'à faire\n')
  try {
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        await ui.send('Fais les modifications')
        await ui.ready()
        await ui.waitFor(`!!${ui.$('changes-toggle')}`)
        await ui.click(ui.$('changes-toggle'))
        await ui.waitFor(`!!${ui.$('changes-tab')}`)
        const files = `[...document.querySelectorAll('[data-testid=changes-file]')]`
        const names = () =>
          ui.ev(
            `${files}.map((f) => f.querySelector('.changes-toggle').innerText.replace(/\\s+/g, ' ').trim())`
          )
        await ui.click(`${files}[0].querySelector('.changes-toggle')`)
        await ui.waitFor(`!!document.querySelector('[data-testid=changes-diff]')`)
        await ui.shot('70-modifications')

        await ui.click(ui.$('changes-view-git'))
        await ui.waitFor(`${files}.length === 3`)
        await ui.click(`${files}[1].querySelector('.changes-toggle')`)
        await ui.waitFor(
          `document.querySelector('[data-testid=changes-diff]')?.innerText.includes('à faire')`
        )
        await ui.shot('71-modifications-git')

        // Annuler une modification (fiche 043) : confirmation en place, fichier remis en état.
        await ui.click(ui.$('changes-view-conversation'))
        await ui.waitFor(`${files}.length === 2`)
        await ui.click(`${files}[0].querySelector('[data-testid=changes-revert]')`)
        await ui.waitFor(`!!document.querySelector('[data-testid=changes-revert-confirm]')`)
        await ui.shot('72-annuler-modification')
        await ui.click(`document.querySelector('[data-testid=changes-revert-confirm]')`)
        await ui.waitFor(`!!document.querySelector('[data-testid=changes-reverted]')`)
        await ui.waitFor(
          `document.body.innerText.includes(${JSON.stringify(L('conversations.notice.reverted', { file: 'README.md' }))})`
        )
        check(
          readFileSync(join(workspace, 'README.md'), 'utf8') ===
            '# Démo\n\nVersion 1\n\n## Utilisation\n',
          'annuler une modification : README remis dans son état d’avant la conversation, dit dans le fil'
        )
        await ui.click(ui.$('changes-view-git'))
        await ui.waitFor(`${files}.length === 2`)
        check(
          JSON.stringify(await names()) === JSON.stringify(['U notes.txt', 'U app.js src/']),
          'vue « Git » à jour : README n’est plus modifié'
        )

        // « Ouvrir » (fiche 071) : un fichier ordinaire s'ouvre dans son app ; un fichier qui peut
        // s'exécuter (ici un .command apparu dans le dossier) n'est que montré dans le Finder.
        writeFileSync(join(workspace, 'lancer.command'), 'echo non\n')
        await ui.click(
          `document.querySelector('.changes-bar [aria-label="${L('changes.refresh')}"]')`
        )
        await ui.waitFor(`${files}.length === 3`)
        const row = (name) => `${files}.find((f) => f.innerText.includes('${name}'))`
        await ui.click(`${row('notes.txt')}.querySelector('[data-testid=changes-open]')`)
        await ui.click(`${row('lancer.command')}.querySelector('[data-testid=changes-open]')`)
        await ui.waitFor(
          `${ui.$('changes-note')}?.innerText.includes(${JSON.stringify(Lpart('fileLink.executable'))})`
        )
        await ui.shot('73-ouvrir-executable')

        // Remarques sur les lignes (fiche 085) : « + » sur une ligne, Maj-clic pour une plage,
        // gardées pour la conversation, puis envoyées à l'agent en un seul message.
        await ui.click(ui.$('changes-view-conversation'))
        await ui.waitFor(`${files}.length === 2`)
        // Par son chemin : le diff du README, déplié, cite aussi « app.js ».
        const appJs = `${files}.find((f) => f.querySelector('.changes-toggle').title === 'src/app.js')`
        await ui.click(`${appJs}.querySelector('.changes-toggle')`)
        const line = (n) =>
          `${appJs}.querySelector('tr[data-side=new][data-line="${n}"] [data-testid=diff-note-add]')`
        const notes = `document.querySelectorAll('[data-testid=diff-note]')`
        await ui.waitFor(`!!${line(3)}`)
        await ui.click(line(1))
        await ui.waitFor(`!!${ui.$('diff-note-input')}`)
        await ui.type('Nommer la fonction')
        await ui.click(ui.$('diff-note-save'))
        await ui.waitFor(`${notes}.length === 1`)
        await ui.click(line(2))
        await ui.ev(
          `${line(3)}.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }))`
        )
        await ui.waitFor(`${appJs}.querySelectorAll('tr.diff-selected').length === 2`)
        await ui.type('Ajouter un test')
        await ui.press('Enter', 4)
        await ui.waitFor(`${notes}.length === 2`)
        await ui.shot('74-remarques-diff')
        // Supprimer la première, modifier la seconde.
        await ui.click(`${notes}[0].querySelector('[data-testid=diff-note-delete]')`)
        await ui.waitFor(`${notes}.length === 1`)
        await ui.click(`${notes}[0].querySelector('[data-testid=diff-note-edit]')`)
        await ui.waitFor(`${ui.$('diff-note-input')}?.value === 'Ajouter un test'`)
        await ui.ev(`${ui.$('diff-note-input')}.select()`)
        await ui.type('Ajouter deux tests')
        await ui.click(ui.$('diff-note-save'))
        await ui.waitFor(
          `${notes}.length === 1 && ${notes}[0].innerText.includes('Ajouter deux tests')`
        )

        // Remarque sur un fichier (onglet Fichiers, fiche 271) : comptée dans Modifications, donc
        // listée ici, sous son titre (4e revue, G3) ; un clic ramène au fichier, à la ligne.
        const panelTab = (id) => `document.querySelector('.side-panel-tab[data-tab=${id}]')`
        await ui.click(ui.$('panel-more'))
        await ui.waitFor(`!!${ui.$('panel-more-menu')}`)
        await ui.click(`${ui.$('panel-more-menu')}.querySelector('[data-tab=files]')`)
        // Un fichier de code (un Markdown s'ouvre rendu, sans gouttière).
        const fileRow = (path) =>
          `document.querySelector('[data-testid=file-row][data-path="${path}"]')`
        await ui.waitFor(`!!${fileRow('src')}`)
        await ui.click(fileRow('src'))
        await ui.waitFor(`!!${fileRow('src/app.js')}`)
        await ui.click(fileRow('src/app.js'))
        const fileLine = `document.querySelector('.file-line[data-line="2"] [data-testid=file-note-add]')`
        await ui.waitFor(`!!${fileLine}`)
        await ui.click(fileLine)
        await ui.waitFor(`!!${ui.$('file-note-input')}`)
        await ui.ev(`${ui.$('file-note-input')}.focus()`)
        await ui.type('Dater la version')
        await ui.click(ui.$('file-note-save'))
        await ui.waitFor(`!!${ui.$('file-note')}`)
        await ui.click(panelTab('changes'))
        const fileNotes = ui.$('changes-file-notes')
        await ui.waitFor(`!!${fileNotes}?.querySelector('[data-testid=files-note-elsewhere-open]')`)
        check(
          (await ui.ev(`${fileNotes}.querySelector('.review-notes-title').innerText`)).includes(
            L('files.notesOnFiles')
          ) &&
            (await ui.ev(`${fileNotes}.innerText`)).includes('Dater la version') &&
            (await ui.ev(`${ui.$('diff-notes-bar')}.innerText`)).includes(
              L('diffNotes.count', { count: 2 })
            ),
          'remarque sur un fichier : comptée et listée dans Modifications, sous son titre'
        )
        await ui.shot('75-remarques-fichiers')
        await ui.click(`${fileNotes}.querySelector('[data-testid=files-note-elsewhere-open]')`)
        await ui.waitFor(
          `document.querySelector('[data-testid=file-view]')?.dataset.path === 'src/app.js'`
        )
        check(true, 'un clic sur la remarque ouvre le fichier dans l’onglet Fichiers')
        await ui.click(panelTab('changes'))
        await ui.waitFor(`!!${ui.$('diff-notes-send')}`)
        const lastUser = `[...document.querySelectorAll('.msg-user')].at(-1)?.innerText ?? ''`
        await ui.click(ui.$('diff-notes-send'))
        // Une remarque posée sur un fichier : le message parle du code, pas seulement des modifications.
        await ui.waitFor(`(${lastUser}).includes('Remarques sur le code')`)
        check(
          (await ui.ev(lastUser)).includes('src/app.js, ligne 2 :'),
          'Envoyer : la remarque sur un fichier part avec son fichier et sa ligne'
        )
      },
      undefined,
      'modifications',
      { BOBINE_WORKSPACE: workspace, BOBINE_OPEN_LOG: openLog }
    )
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
}
