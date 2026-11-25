import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { L, Lpart, check, sleep, withApp } from '../lib.mjs'

/**
 * Cycle complet d'un worktree (fiche 110) : départ explicite dans le fil, commit des fichiers
 * cochés avec message proposé, « Ouvrir une PR » bloqué avec la raison, fusion dans `main` avec
 * conflit résolu par l'agent (scénario `conflits`), nettoyage, puis worktree orphelin dans les
 * réglages. Vrai dépôt git local.
 */
export async function worktreeCycleSuite(scheme) {
  console.log(`\n— Cycle d’un worktree (${scheme})`)
  const workspace = realpathSync(mkdtempSync(join(tmpdir(), 'bob-e2e-cycle-')))
  const git = (...args) =>
    execFileSync('git', ['-c', 'user.name=e2e', '-c', 'user.email=e2e@example.invalid', ...args], {
      cwd: workspace,
      encoding: 'utf8'
    }).trim()
  const README_1 = '# Démo\n\nVersion 1\n\n## Utilisation\n'
  writeFileSync(join(workspace, 'README.md'), README_1)
  git('init', '-q', '-b', 'main')
  git('add', '.')
  git('commit', '-q', '-m', 'premier commit')
  // Les tests committent : identité posée dans le dépôt, partagée par ses worktrees.
  git('config', 'user.name', 'e2e')
  git('config', 'user.email', 'e2e@example.invalid')
  // Une modification non commitée du dossier d'origine : pas dans le worktree, et dit.
  writeFileSync(join(workspace, 'notes.txt'), 'à faire\n')
  try {
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        await ui.click(ui.$('workspace-menu'))
        await ui.waitFor(`!!${ui.$('workspace-worktree')}`)
        await ui.click(ui.$('workspace-worktree'))
        await ui.waitFor(`${ui.$('workspace-menu')}?.innerText.startsWith('bobine/')`)
        await ui.ready()
        // Départ explicite (fiches 110, 117) : une seule carte en tête du fil, plus d'avis.
        await ui.waitFor(`!!${ui.$('worktree-origin')}`)
        const seen = await ui.ev(`({
          codes: [...${ui.$('worktree-origin-from')}.querySelectorAll('code')].map((c) => c.innerText),
          subject: ${ui.$('worktree-origin-subject')}?.innerText,
          dirty: ${ui.$('worktree-origin-dirty')}?.innerText,
          notices: document.querySelectorAll('.notice').length,
          first: document.querySelector('[data-testid=thread]').firstElementChild?.dataset.testid,
          top: Math.round(${ui.$('worktree-origin')}.getBoundingClientRect().top - document.querySelector('.main-header').getBoundingClientRect().bottom)
        })`)
        // Le premier élément du fil commence sous le fondu de l'en-tête (28 px).
        check(
          seen.top >= 28,
          `le haut du fil n’est pas dans le fondu de l’en-tête (${seen.top} px)`
        )
        await ui.shot('110-worktree-depart')
        // « Vue Git » : l'onglet Modifications, vue Git du worktree.
        await ui.click(ui.$('worktree-origin-git'))
        await ui.waitFor(`!!${ui.$('worktree-bar')}`)
        check(true, '« Vue Git » ouvre l’onglet Modifications en vue Git')
        await ui.click(ui.$('panel-toggle'))
        await ui.waitFor(`!${ui.$('changes-tab')}`)

        await ui.send('Fais les modifications')
        await ui.ready()
        await ui.waitFor(`!!${ui.$('changes-toggle')}`)
        await ui.click(ui.$('changes-toggle'))
        await ui.waitFor(`!!${ui.$('changes-tab')}`)
        // L'onglet « Git » apparaît une fois l'état du dépôt lu.
        await ui.waitFor(`!!${ui.$('changes-view-git')}`)
        await ui.click(ui.$('changes-view-git'))
        await ui.waitFor(`!!${ui.$('worktree-bar')}`)
        const files = `[...document.querySelectorAll('[data-testid=changes-file]')]`
        await ui.waitFor(`${files}.length === 2`)
        await ui.shot('111-worktree-git')

        // Commit des fichiers cochés seulement : src/app.js décoché.
        const appJs = `${files}.find((f) => f.querySelector('.changes-toggle').title === 'src/app.js')`
        await ui.click(`${appJs}.querySelector('[data-testid=changes-check]')`)
        await ui.waitFor(`${ui.$('worktree-commit')}.innerText.includes('(1)')`)
        await ui.click(ui.$('worktree-commit'))
        await ui.waitFor(`!!${ui.$('worktree-commit-form')}`)
        // Fiche 246 : rédigé par l'agent (factice) d'après le seul fichier coché.
        await ui.waitFor(`${ui.$('worktree-commit-draft')}?.dataset.state === 'agent'`, 15000)
        await ui.shot('112-worktree-commit')
        await ui.click(ui.$('worktree-commit-confirm'))
        await ui.waitFor(
          `${ui.$('worktree-note')}?.innerText.includes(${JSON.stringify(Lpart('worktreeCycle.commit.done'))})`
        )

        // Défaire le commit, puis tout committer.
        await ui.click(ui.$('worktree-commit-undo'))
        await ui.waitFor(
          `${ui.$('worktree-note')}?.innerText.includes(${JSON.stringify(L('worktreeCycle.commit.undone'))})`
        )
        // src/app.js, décoché avant, le reste : on le recoche pour tout committer.
        await ui.waitFor(`${files}.length === 2`)
        await ui.click(`${appJs}.querySelector('[data-testid=changes-check]')`)
        await ui.waitFor(`${ui.$('worktree-commit')}.innerText.includes('(2)')`)
        await ui.click(ui.$('worktree-commit'))
        await ui.waitFor(`!!${ui.$('worktree-commit-form')}`)
        await ui.waitFor(`!${ui.$('worktree-commit-confirm')}.disabled`, 15000)
        await ui.click(ui.$('worktree-commit-confirm'))
        await ui.waitFor(
          `${ui.$('worktree-note')}?.innerText.includes(${JSON.stringify(Lpart('worktreeCycle.commit.done'))})`
        )
        await ui.waitFor(`${files}.length === 0`)

        // Conflit : main a changé le README entre-temps.
        writeFileSync(join(workspace, 'README.md'), '# Démo\n\nVersion 3\n\n## Utilisation\n')
        git('commit', '-q', '-am', 'v3')
        await ui.click(
          `document.querySelector('.changes-bar [aria-label="${L('changes.refresh')}"]')`
        )
        await ui.waitFor(`!${ui.$('worktree-merge')}.disabled`)
        await ui.click(ui.$('worktree-merge'))
        // Le dossier principal a encore notes.txt (fiche 123) : la fusion ne part pas et le dit.
        await ui.waitFor(`!!${ui.$('main-dirty')}`)
        await ui.shot('123-worktree-fusion-refusee')
        // « Mettre de côté » : retenu aussi pour la reprise après le conflit.
        await ui.click(ui.$('main-dirty-stash'))
        await ui.waitFor(`!!${ui.$('worktree-conflicts')}`)
        check(
          readFileSync(join(workspace, 'notes.txt'), 'utf8') === 'à faire\n',
          'conflit dans le worktree : notes.txt est déjà revenu dans le dossier principal'
        )
        await ui.waitFor(
          `${ui.$('worktree-state')}.innerText === ${JSON.stringify(L('worktreeCycle.state.merging', { count: 1 }))}`
        )
        await ui.shot('113-worktree-conflit')
        await ui.click(ui.$('worktree-merge-resolve'))
        await ui.waitFor(
          `${ui.$('worktree-note')}?.innerText === ${JSON.stringify(`${L('worktreeCycle.merge.merge', { base: 'main' })} ${L('worktreeCycle.mainDirty.stashRestored', { count: 1 })}`)}`,
          60000
        )
        const resolved = '# Démo\n\nVersion 2 et 3\n\n## Utilisation\n\nLancer `node src/app.js`.\n'
        await ui.waitFor(
          `${ui.$('worktree-state')}.innerText === ${JSON.stringify(L('worktreeCycle.state.merged', { base: 'main' }))}`
        )
        const merged = {
          asked: await ui.ev(
            `[...document.querySelectorAll('.msg-user')].some((m) => m.innerText.includes('left conflicts'))`
          ),
          readme: readFileSync(join(workspace, 'README.md'), 'utf8'),
          status: git('status', '--porcelain', '--untracked-files=no'),
          subject: git('log', '-1', '--format=%s'),
          notes: readFileSync(join(workspace, 'notes.txt'), 'utf8'),
          stashes: git('stash', 'list')
        }
        check(
          merged.asked &&
            merged.readme === resolved &&
            merged.status === '' &&
            merged.notes === 'à faire\n' &&
            merged.stashes === '' &&
            merged.subject.startsWith('Merge branch'),
          `l’agent a résolu le conflit, la fusion a repris : main a le README fusionné (${JSON.stringify(merged)})`
        )
        await ui.shot('114-worktree-fusionne')

        // « Nettoyer » qui perdrait un fichier non commité (recette du 2026-11-25, N1) : la question
        // le dit et « Garder » est le bouton par défaut ; rien n'est supprimé.
        const refresh = `document.querySelector('.changes-bar [aria-label="${L('changes.refresh')}"]')`
        const worktreePath = git('worktree', 'list', '--porcelain')
          .split('\n')
          .filter((line) => line.startsWith('worktree ') && line.includes('.worktrees'))
          .map((line) => line.slice('worktree '.length))[0]
        writeFileSync(join(worktreePath, 'brouillon.txt'), 'à garder\n')
        await ui.click(refresh)
        await ui.click(ui.$('worktree-cleanup'))
        await ui.waitFor(`!!${ui.$('worktree-cleanup-ask')}`)
        const lossSaid = await ui.waitFor(`!!${ui.$('worktree-cleanup-loss')}`, 10000).then(
          () => true,
          () => false
        )
        await ui.shot('115b-worktree-nettoyer-non-commite')
        check(lossSaid, '« Nettoyer » avec un fichier non commité : la perte est dite')
        check(
          await ui.ev(`document.activeElement === ${ui.$('worktree-cleanup-keep')}`),
          '« Nettoyer » avec un fichier non commité : « Garder » par défaut'
        )
        await ui.click(ui.$('worktree-cleanup-keep'))
        check(existsSync(join(worktreePath, 'brouillon.txt')), 'Garder : le fichier est là')
        rmSync(join(worktreePath, 'brouillon.txt'))
        await ui.click(refresh)

        // Nettoyage : conversation archivée, worktree et branche supprimés.
        await ui.click(ui.$('worktree-cleanup'))
        await ui.waitFor(`!!${ui.$('worktree-cleanup-ask')}`)
        await ui.shot('115-worktree-nettoyer')
        await ui.click(ui.$('worktree-cleanup-confirm'))
        await ui.waitFor(`!!${ui.$('history-archived')}`)
        await sleep(500)

        // Orphelin : un worktree de Bobine sans conversation, nettoyé depuis les réglages.
        const orphan = join(workspace, '.worktrees', '20261001-1200-dead')
        git('worktree', 'add', '-q', '-b', 'bobine/20261001-1200-dead', orphan, 'HEAD')
        await ui.click(ui.$('open-settings'))
        await ui.waitFor(`!!${ui.$('settings')}`)
        await ui.click(ui.$('settings-data'))
        await ui.waitFor(`${ui.$('orphans')}?.querySelectorAll('li').length === 1`)
        await ui.ev(`${ui.$('orphans')}.scrollIntoView({ block: 'center' })`)
        await ui.shot('116-worktrees-orphelins')
        await ui.click(ui.$('orphans-clean'))
        await ui.waitFor(`!!${ui.$('confirm-row')}`)
        await ui.shot('117-orphelin-confirmer')
        await ui.click(ui.$('confirm-row-confirm'))
        await ui.waitFor(`!!${ui.$('orphans-none')}`)
      },
      undefined,
      'conflits',
      { BOBINE_WORKSPACE: workspace }
    )
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
}
