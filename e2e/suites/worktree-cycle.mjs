import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { L, Lpart, check, sleep, withApp } from '../lib.mjs'

/**
 * Cycle complet d'un worktree (fiche 110) : départ explicite dans le fil, commit des fichiers
 * cochés avec message proposé, « Ouvrir une PR » bloqué avec la raison, fusion dans `main` avec
 * conflit résolu par l'agent (scénario `conflits`) puis arrêtée à relire et reprise au clic
 * (fiche 289), nettoyage, puis worktree orphelin dans les
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
  /** Profil gardé d'un lancement à l'autre (fiche 289 : redémarrage avec une résolution à relire). */
  const userData = mkdtempSync(join(tmpdir(), 'bob-e2e-cycle-data-'))
  /** Verrou de démarrage de l'agent factice (`MOCK_AGENT_START_LOCK`) : son agent « démarre ». */
  const startLock = join(userData, 'verrou-demarrage')
  /** Ce qu'écrit le scénario `conflits` quand on lui demande de résoudre. */
  const resolvedReadme = '# Démo\n\nVersion 2 et 3\n\n## Utilisation\n\nLancer `node src/app.js`.\n'
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
        // Grisé avec sa raison : `aria-disabled`, pas `disabled` (fiche 287).
        await ui.waitFor(
          `!${ui.$('worktree-merge')}.disabled && !${ui.$('worktree-merge')}.hasAttribute('aria-disabled')`
        )
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
        // Fiche 289 : la résolution de l'agent reste dans la branche, la barre demande une relecture ;
        // rien n'entre dans main avant le clic suivant. Contrôles qui ne lèvent pas : sur une version
        // sans le correctif, la fusion part d'elle-même et ils le disent.
        const toReview = JSON.stringify(
          L('worktreeCycle.merge.resolved', { files: 'README.md', base: 'main' })
        )
        const stopped = await ui
          .waitFor(
            `${ui.$('worktree-note')}?.innerText === ${toReview} || ${ui.$('worktree-state')}?.innerText === ${JSON.stringify(L('worktreeCycle.state.merged', { base: 'main' }))}`,
            60000
          )
          .then(
            () => true,
            () => false
          )
        const branchReadme = git(
          'show',
          `${git('worktree', 'list', '--porcelain')
            .split('\n')
            .find((l) => l.startsWith('branch refs/heads/bobine/'))
            ?.slice('branch refs/heads/'.length)}:README.md`
        )
        check(
          stopped &&
            (await ui.ev(`${ui.$('worktree-note')}?.innerText ?? ''`)) === JSON.parse(toReview),
          'fiche 289 : « Laisser l’agent résoudre » s’arrête, résolution à relire dans la branche'
        )
        check(
          git('log', '-1', '--format=%s', 'main') === 'v3' &&
            branchReadme === resolvedReadme.trimEnd() &&
            readFileSync(join(workspace, 'notes.txt'), 'utf8') === 'à faire\n' &&
            git('stash', 'list') === '',
          'fiche 289 : main n’a pas bougé ; la résolution est commitée dans la branche'
        )
        await ui.shot('289-worktree-a-relire')
      },
      userData,
      'conflits',
      { BOBINE_WORKSPACE: workspace }
    )

    // Fiche 289, limite assumée : une conversation en worktree sans mère perd la note « à relire » au
    // redémarrage ; rien n'est fusionné pour autant, « Fusionner dans main » reste le seul chemin.
    // rc.2, Mac de GitHub : l'agent qui démarre encore (verrou de démarrage de l'agent factice, ce
    // qu'une machine lente fait d'elle-même) n'est pas un tour ; « Fusionner » n'est pas grisé.
    writeFileSync(startLock, '')
    await withApp(
      scheme,
      async (ui) => {
        await ui.waitFor(
          `document.querySelectorAll('[data-testid=history-item]').length > 0`,
          20000
        )
        if (!(await ui.ev(`!!document.querySelector('.history-item.active')`))) {
          const item = `document.querySelector('[data-testid=history-item]')`
          await ui.click(`${item}.querySelector('.history-open') ?? ${item}`)
        }
        await ui.waitFor(`!!${ui.$('changes-toggle')}`, 20000)
        if (!(await ui.ev(`!!${ui.$('changes-tab')}`))) await ui.click(ui.$('changes-toggle'))
        await ui.waitFor(`!!${ui.$('changes-view-git')}`, 20000)
        await ui.click(ui.$('changes-view-git'))
        await ui.waitFor(`!!${ui.$('worktree-merge')}`, 20000)
        const starting = await ui.ev(
          `window.api.conversations.get().then((s) => s.conversations.find((c) => c.id === document.querySelector('.history-item.active')?.dataset.id)?.status)`
        )
        const usable = await ui
          .waitFor(`!${ui.$('worktree-merge')}.hasAttribute('aria-disabled')`, 5000)
          .then(
            () => true,
            () => false
          )
        check(
          starting === 'starting' && usable,
          `après redémarrage, l’agent encore au démarrage (${starting}) : « Fusionner dans main » n’est pas grisé`
        )
        check(
          git('log', '-1', '--format=%s', 'main') === 'v3' &&
            readFileSync(join(workspace, 'README.md'), 'utf8') !== resolvedReadme &&
            git('stash', 'list') === '' &&
            !(await ui.ev(`!!${ui.$('worktree-conflicts')}`)) &&
            !(await ui.ev(`${ui.$('worktree-merge')}.hasAttribute('aria-disabled')`)),
          'après redémarrage (sans mère) : rien n’est fusionné ; « Fusionner dans main » reste le seul chemin'
        )
        // La fusion part sur un clic, par ses refus habituels : notes.txt est encore là.
        await ui.click(ui.$('worktree-merge'))
        await ui.waitFor(`!!${ui.$('main-dirty')}`)
        await ui.click(ui.$('main-dirty-stash'))
        // L'agent peut finir de démarrer : la suite (nettoyage, réglages) n'a plus besoin du verrou.
        rmSync(startLock, { force: true })
        // Fiche 289 : le commit de fusion est déjà dans la branche (fait à la résolution) ; main y
        // avance en fast-forward, et l'historique est celui d'avant (le sujet « Merge branch… »).
        await ui.waitFor(
          `${ui.$('worktree-note')}?.innerText === ${JSON.stringify(`${L('worktreeCycle.merge.fastForward', { base: 'main' })} ${L('worktreeCycle.mainDirty.stashRestored', { count: 1 })}`)}`,
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
          `l’agent a résolu le conflit, la fusion est partie au clic : main a le README fusionné (${JSON.stringify(merged)})`
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
      userData,
      'conflits',
      { BOBINE_WORKSPACE: workspace, MOCK_AGENT_START_LOCK: startLock }
    )
  } finally {
    rmSync(workspace, { recursive: true, force: true })
    rmSync(userData, { recursive: true, force: true })
  }
}
