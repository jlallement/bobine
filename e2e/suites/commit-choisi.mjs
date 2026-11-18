import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { L, Lpart, check, withApp } from '../lib.mjs'

/**
 * « Committer d'abord » avec les fichiers à cocher (fiche 244), sur la carte « Fusion refusée » de
 * la barre d'un worktree, dans un dépôt git jetable. Le dossier principal a 40 fichiers non
 * commités, dont un `.env` non suivi et non ignoré vers la fin : la liste est complète, défile,
 * toutes les cases sont cochées ; tout décoché, le bouton est désactivé avec la raison ; le `.env`
 * décoché ne part pas : il reste non suivi, hors de l'historique, mis de côté le temps de la
 * fusion puis remis. Le lancement d'une fille est joué par `filles-non-commite`.
 */
export async function commitChoisiSuite(scheme) {
  console.log(`\n— « Committer d’abord » : fichiers à cocher (${scheme})`)
  const workspace = realpathSync(mkdtempSync(join(tmpdir(), 'bob-e2e-commit-choisi-')))
  const git = (...args) =>
    execFileSync('git', ['-c', 'user.name=e2e', '-c', 'user.email=e2e@example.invalid', ...args], {
      cwd: workspace,
      encoding: 'utf8'
    }).trim()
  writeFileSync(join(workspace, 'README.md'), '# Démo\n\nVersion 1\n\n## Utilisation\n')
  git('init', '-q', '-b', 'main')
  git('add', '.')
  git('commit', '-q', '-m', 'premier commit')
  git('config', 'user.name', 'e2e')
  git('config', 'user.email', 'e2e@example.invalid')
  // 40 fichiers de la mère, le `.env` 36e (après le 20e : hors du corps du message proposé).
  const DIRTY = Array.from({ length: 40 }, (_, i) =>
    i === 35 ? '.env' : `notes/n${String(i).padStart(2, '0')}.md`
  )
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
        await ui.send('Fais les modifications')
        await ui.ready()
        await ui.waitFor(`!!${ui.$('changes-toggle')}`)
        await ui.click(ui.$('changes-toggle'))
        await ui.waitFor(`!!${ui.$('changes-view-git')}`)
        await ui.click(ui.$('changes-view-git'))
        await ui.waitFor(`!!${ui.$('worktree-bar')}`)
        await ui.waitFor(`document.querySelectorAll('[data-testid=changes-file]').length === 2`)
        await ui.click(ui.$('worktree-commit'))
        await ui.waitFor(`!!${ui.$('worktree-commit-form')}`)
        await ui.click(ui.$('worktree-commit-confirm'))
        await ui.waitFor(
          `${ui.$('worktree-note')}?.innerText.includes(${JSON.stringify(Lpart('worktreeCycle.commit.done'))})`
        )

        // La mère a travaillé dans le dossier principal : 40 fichiers, dont un `.env`.
        for (const path of DIRTY) {
          mkdirSync(dirname(join(workspace, path)), { recursive: true })
          writeFileSync(join(workspace, path), path === '.env' ? 'SECRET=1\n' : `# ${path}\n`)
        }
        await ui.click(
          `document.querySelector('.changes-bar [aria-label="${L('changes.refresh')}"]')`
        )
        await ui.waitFor(`!${ui.$('worktree-merge')}.disabled`)
        await ui.click(ui.$('worktree-merge'))
        await ui.waitFor(`!!${ui.$('main-dirty')}`, 20000)
        await ui.click(ui.$('main-dirty-commit'))
        await ui.waitFor(`!!${ui.$('main-dirty-commit-chooser')}`)
        const rows = `[...document.querySelectorAll('[data-testid=main-dirty-commit-file]')]`
        const shown = await ui.ev(`({
          paths: ${rows}.map((li) => li.dataset.path),
          checked: ${rows}.filter((li) => li.querySelector('input').checked).length,
          scroll: document.querySelector('.commit-chooser-list').classList.contains('scroll'),
          secret: [...document.querySelectorAll('[data-testid=main-dirty-commit-secret]')].map((t) => t.closest('li').dataset.path),
          summary: !!${ui.$('main-dirty-file')}
        })`)
        check(
          JSON.stringify([...shown.paths].sort()) === JSON.stringify([...DIRTY].sort()) &&
            shown.checked === 40 &&
            shown.scroll &&
            !shown.summary,
          `liste complète, 40 cases cochées, cadre défilant (${shown.paths.length} lignes, ${shown.checked} cochées)`
        )
        check(
          JSON.stringify(shown.secret) === JSON.stringify(['.env']),
          '« secret ? » sur le .env seulement, coché quand même'
        )
        await ui.ev(
          `${rows}.find((li) => li.dataset.path === '.env').scrollIntoView({ block: 'center' }), true`
        )
        await ui.shot('244-fusion-40-fichiers')

        // Tout décoché : rien ne part, la raison est écrite.
        await ui.click(ui.$('main-dirty-commit-check-all'))
        await ui.waitFor(`${ui.$('main-dirty-commit-confirm')}.disabled`)
        check(
          (await ui.ev(`${ui.$('main-dirty-commit-blocked')}.innerText`)) ===
            L('worktreeCycle.choose.none'),
          'tout décoché : bouton désactivé, raison écrite'
        )
        await ui.ev(`${ui.$('main-dirty')}.scrollIntoView({ block: 'end' }), true`)
        await ui.shot('244-fusion-tout-decoche')
        await ui.click(ui.$('main-dirty-commit-check-all'))
        await ui.waitFor(`!${ui.$('main-dirty-commit-confirm')}.disabled`)

        // Le `.env` décoché : le message ne le cite pas, la ligne dit ce qu'il devient.
        await ui.click(`${rows}.find((li) => li.dataset.path === '.env').querySelector('input')`)
        await ui.waitFor(`!!${ui.$('main-dirty-commit-left')}`)
        const message = await ui.ev(`${ui.$('main-dirty-commit-message')}.value`)
        check(
          !message.includes('.env') &&
            (await ui.ev(`${ui.$('main-dirty-commit-left')}.innerText`)) ===
              L('worktreeCycle.mainDirty.left', { count: 1 }) &&
            (await ui.ev(`${ui.$('main-dirty-commit-check-all')}.indeterminate`)),
          'le .env décoché : hors du message, ligne « reste non commité… », case de tête intermédiaire'
        )
        await ui.ev(
          `${rows}.find((li) => li.dataset.path === '.env').scrollIntoView({ block: 'center' }), true`
        )
        await ui.shot('244-fusion-env-decoche')
        await ui.click(ui.$('main-dirty-commit-confirm'))
        await ui.waitFor(
          `${ui.$('worktree-note')}?.innerText === ${JSON.stringify(`${L('worktreeCycle.merge.merge', { base: 'main' })} ${L('worktreeCycle.mainDirty.stashRestored', { count: 1 })}`)}`,
          30000
        )
        const after = {
          status: git('status', '--porcelain', '-uall'),
          env: readFileSync(join(workspace, '.env'), 'utf8'),
          history: git('log', '--all', '--name-only', '--format='),
          stash: git('stash', 'list'),
          tracked: git('ls-files', 'notes').split('\n').filter(Boolean).length
        }
        check(
          after.status === '?? .env' &&
            after.env === 'SECRET=1\n' &&
            !after.history.split('\n').includes('.env') &&
            after.stash === '',
          `le .env n’est pas parti : non suivi, intact, hors de l’historique, git stash vide (${JSON.stringify({ status: after.status, stash: after.stash })})`
        )
        check(
          after.tracked === 39,
          `les 39 fichiers cochés sont commités, puis la fusion a suivi (${after.tracked})`
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
