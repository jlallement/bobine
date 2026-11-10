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
  const hash = git('rev-parse', 'HEAD').slice(0, 7)
  // Une modification non commitée du dossier d'origine : pas dans le worktree, et dit.
  writeFileSync(join(workspace, 'notes.txt'), 'à faire\n')
  const worktreeDir = () => {
    const out = git('worktree', 'list', '--porcelain')
    const entry = out.split('\n\n').find((e) => e.includes('refs/heads/bobine/'))
    return entry?.split('\n')[0].slice('worktree '.length)
  }
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
        check(
          seen.codes.join(' ') === `main ${hash}` &&
            seen.subject === L('worktrees.start.subject', { subject: 'premier commit' }) &&
            seen.dirty === L('worktrees.start.dirty', { count: 1 }) &&
            seen.notices === 0 &&
            seen.first === 'worktree-origin',
          'départ explicite : une carte en tête du fil (branche, commit, sujet, modification non commitée)'
        )
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
        const start = await ui.ev(`${ui.$('worktree-start')}.innerText`)
        check(
          start.includes('main') &&
            start.includes(hash) &&
            (await ui.ev(`${ui.$('worktree-dirty-at-start')}.innerText`)) ===
              L('worktreeCycle.start.dirty', { count: 1 }) &&
            (await ui.ev(`document.querySelectorAll('[data-testid=changes-check]').length`)) === 2,
          'vue « Git » du worktree : départ rappelé, avertissement, une case par fichier'
        )
        // Fiche 189 (verdict UX) : sans dépôt distant, ni « Ouvrir une PR » ni raison.
        check(
          !(await ui.ev(`!!${ui.$('worktree-pr')}`)) &&
            !(await ui.ev(`!!${ui.$('worktree-pr-blocker')}`)),
          'dépôt sans dépôt distant : ni bouton « Ouvrir une PR » ni raison'
        )
        check(
          (await ui.ev(`${ui.$('worktree-merge')}.disabled`)) &&
            (await ui.ev(`${ui.$('worktree-merge')}.title`)) ===
              L('worktreeCycle.merge.dirty', { count: 2 }),
          '« Fusionner » bloqué tant qu’il reste des modifications non commitées'
        )
        await ui.shot('111-worktree-git')

        // Commit des fichiers cochés seulement : src/app.js décoché.
        const appJs = `${files}.find((f) => f.querySelector('.changes-toggle').title === 'src/app.js')`
        await ui.click(`${appJs}.querySelector('[data-testid=changes-check]')`)
        await ui.waitFor(`${ui.$('worktree-commit')}.innerText.includes('(1)')`)
        await ui.click(ui.$('worktree-commit'))
        await ui.waitFor(`!!${ui.$('worktree-commit-form')}`)
        const proposed = await ui.ev(`${ui.$('worktree-commit-message')}.value`)
        check(
          // Seul README.md est coché : un commit de documentation.
          proposed.startsWith('docs: fais les modifications') &&
            proposed.includes('- README.md') &&
            !proposed.includes('src/app.js'),
          'message proposé : Conventional Commits depuis le titre et les fichiers cochés'
        )
        await ui.shot('112-worktree-commit')
        await ui.click(ui.$('worktree-commit-confirm'))
        await ui.waitFor(
          `${ui.$('worktree-note')}?.innerText.includes(${JSON.stringify(Lpart('worktreeCycle.commit.done'))})`
        )
        const dir = worktreeDir()
        const inWorktree = (...args) =>
          execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim()
        const committed = {
          subject: inWorktree('log', '-1', '--format=%s'),
          files: inWorktree('show', '--name-only', '--format=', 'HEAD'),
          status: inWorktree('status', '--porcelain', '-uall')
        }
        check(
          committed.subject === 'docs: fais les modifications' &&
            committed.files === 'README.md' &&
            committed.status.includes('?? src/app.js'),
          `commit fait dans le worktree : README seul, src/app.js reste à committer (${JSON.stringify(committed)})`
        )

        // Défaire le commit, puis tout committer.
        await ui.click(ui.$('worktree-commit-undo'))
        await ui.waitFor(
          `${ui.$('worktree-note')}?.innerText.includes(${JSON.stringify(L('worktreeCycle.commit.undone'))})`
        )
        check(
          git('rev-list', '--count', 'main..' + inWorktree('branch', '--show-current')) === '0',
          'commit défait : la branche est revenue au départ, les modifications restent'
        )
        // src/app.js, décoché avant, le reste : on le recoche pour tout committer.
        await ui.waitFor(`${files}.length === 2`)
        await ui.click(`${appJs}.querySelector('[data-testid=changes-check]')`)
        await ui.waitFor(`${ui.$('worktree-commit')}.innerText.includes('(2)')`)
        await ui.click(ui.$('worktree-commit'))
        await ui.waitFor(`!!${ui.$('worktree-commit-form')}`)
        await ui.click(ui.$('worktree-commit-confirm'))
        await ui.waitFor(
          `${ui.$('worktree-note')}?.innerText.includes(${JSON.stringify(Lpart('worktreeCycle.commit.done'))})`
        )
        await ui.waitFor(`${files}.length === 0`)
        check(
          inWorktree('show', '--name-only', '--format=', 'HEAD').split('\n').sort().join(',') ===
            'README.md,src/app.js',
          'second commit : les deux fichiers'
        )

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
        check(
          (await ui.ev(`${ui.$('main-dirty-title')}.innerText`)) ===
            L('worktreeCycle.mainDirty.title', { count: 1 }) &&
            (await ui.ev(
              `[...document.querySelectorAll('[data-testid=main-dirty-file]')].map((f) => f.innerText).join(',')`
            )) === 'notes.txt' &&
            !(await ui.ev(`!!${ui.$('worktree-conflicts')}`)),
          'fusion refusée d’avance : notes.txt non commité dans le dossier principal, rien n’a bougé'
        )
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
        check(
          JSON.stringify(
            await ui.ev(
              `[...document.querySelectorAll('[data-testid=worktree-conflict-file]')].map((f) => f.innerText)`
            )
          ) === JSON.stringify(['README.md']) &&
            (await ui.ev(`${ui.$('worktree-state')}.innerText`)) ===
              L('worktreeCycle.state.merging', { count: 1 }),
          'fusion arrêtée : README.md en conflit, listé'
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

        // Nettoyage : conversation archivée, worktree et branche supprimés.
        await ui.click(ui.$('worktree-cleanup'))
        await ui.waitFor(`!!${ui.$('worktree-cleanup-ask')}`)
        await ui.shot('115-worktree-nettoyer')
        await ui.click(ui.$('worktree-cleanup-confirm'))
        await ui.waitFor(`!!${ui.$('history-archived')}`)
        await sleep(500)
        check(
          !existsSync(dir) &&
            git('branch', '--list', 'bobine/*') === '' &&
            git('worktree', 'list').split('\n').length === 1,
          'nettoyage : conversation archivée, worktree et branche supprimés'
        )

        // Orphelin : un worktree de Bobine sans conversation, nettoyé depuis les réglages.
        const orphan = join(workspace, '.worktrees', '20261001-1200-dead')
        git('worktree', 'add', '-q', '-b', 'bobine/20261001-1200-dead', orphan, 'HEAD')
        await ui.click(ui.$('open-settings'))
        await ui.waitFor(`!!${ui.$('settings')}`)
        await ui.click(ui.$('settings-data'))
        await ui.waitFor(`${ui.$('orphans')}?.querySelectorAll('li').length === 1`)
        check(
          (await ui.ev(`${ui.$('orphans')}.innerText`)).includes('bobine/20261001-1200-dead'),
          'Réglages › Données : le worktree orphelin est listé'
        )
        await ui.ev(`${ui.$('orphans')}.scrollIntoView({ block: 'center' })`)
        await ui.shot('116-worktrees-orphelins')
        await ui.click(ui.$('orphans-clean'))
        await ui.waitFor(`!!${ui.$('confirm-row')}`)
        check(
          existsSync(orphan),
          '« Nettoyer » : rien de supprimé avant la confirmation (fiche 126)'
        )
        await ui.shot('117-orphelin-confirmer')
        await ui.click(ui.$('confirm-row-confirm'))
        await ui.waitFor(`!!${ui.$('orphans-none')}`)
        check(
          !existsSync(orphan) && git('branch', '--list', 'bobine/*') === '',
          '« Nettoyer » : worktree orphelin et branche supprimés'
        )
      },
      undefined,
      'conflits',
      { BOBINE_WORKSPACE: workspace }
    )
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
}
