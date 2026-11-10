import { execFileSync } from 'node:child_process'
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { L, check, withApp } from '../lib.mjs'

/**
 * Fiche 149 : préparation visible avant la fin du worktree, puis fille visible avant sa première
 * réponse ; la création révèle Récents ou le dossier repliés, sans quitter la mère.
 */
export async function fillesVisibilitySuite(scheme) {
  const workspace = mkdtempSync(join(tmpdir(), 'bob-e2e-visibilite-'))
  const git = (...args) =>
    execFileSync('git', ['-c', 'user.name=e2e', '-c', 'user.email=e2e@example.invalid', ...args], {
      cwd: workspace
    })
  writeFileSync(join(workspace, 'README.md'), '# Carnet\n')
  git('init', '-q', '-b', 'main')
  git('add', '.')
  git('commit', '-q', '-m', 'init')
  // Un worktree volontairement lent : la préparation doit apparaître avant la vraie conversation.
  const hook = join(workspace, '.git', 'hooks', 'post-checkout')
  writeFileSync(hook, '#!/bin/sh\nsleep 1\n')
  chmodSync(hook, 0o755)
  try {
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        await ui.send('Organise le carnet')
        await ui.ready()
        const mother = await ui.ev(`window.api.conversations.get().then((s) => s.activeId)`)
        const row = (id) => `document.querySelector('[data-testid=history-item][data-id="${id}"]')`
        const away = async () => ui.hover(await ui.center(ui.$('composer-input')))
        const launch = async () => {
          const before = await ui.ev(
            `window.api.conversations.get().then((s) => s.conversations.map((c) => c.id))`
          )
          await ui.click(ui.$('title-menu'))
          await ui.waitFor(
            `!!${ui.$('title-launch-child')} && !${ui.$('title-launch-child')}.hasAttribute('data-disabled')`
          )
          await ui.click(ui.$('title-launch-child'))
          await ui.waitFor(`!!${ui.$('child-prompt')}`)
          await ui.ev(`${ui.$('child-prompt')}.focus()`)
          await ui.type('/scenario attend-stop')
          const start = Date.now()
          await ui.click(ui.$('child-launch'))
          await ui.waitFor(`!!document.querySelector('[data-preparing]')`, 30000)
          check(
            (await ui.ev(
              `document.querySelector('[data-preparing] .child-state')?.getAttribute('aria-label')`
            )) === L('children.preparing'),
            'préparation visible pendant la création du worktree, sans attendre la première réponse'
          )
          await ui.waitFor(`!${ui.$('child-dialog')}`, 30000)
          const child = await ui.ev(
            `window.api.conversations.get().then((s) => s.conversations.find((c) => c.startedFrom?.id === ${JSON.stringify(mother)} && !${JSON.stringify(before)}.includes(c.id)))`
          )
          if (!child) throw new Error('Fille absente de la liste publiée')
          await ui.waitFor(`!!${row(child.id)} && !document.querySelector('[data-preparing]')`)
          check(!child.draft, `fille publiée à la fermeture du dialogue (${Date.now() - start} ms)`)
          await ui.waitFor(
            `window.api.conversations.get().then((s) => s.conversations.some((c) => c.id === ${JSON.stringify(child.id)} && c.status === 'busy'))`,
            30000
          )
          return child.id
        }

        const first = await launch()
        await ui.waitFor(`!!${row(first)}`)
        check(
          await ui.ev(`${row(first)}.classList.contains('nested')`),
          'section ouverte : fille visible sous sa mère pendant son premier tour, avant sa fin'
        )
        await ui.shot('filles-visibilite-1-ouverte')

        await ui.click(ui.$('section-toggle-history'))
        await away()
        const second = await launch()
        check(
          (await ui.ev(`${ui.$('section-toggle-history')}.getAttribute('aria-expanded')`)) ===
            'true' && (await ui.ev(`!!${row(second)}`)),
          'Récents replié : le lancement révèle immédiatement la fille'
        )
        await ui.shot('filles-visibilite-2-recents-reveles')
        await away()
        await ui.waitFor(`!!${row(second)}`)
        check(
          await ui.ev(`${row(second)}.classList.contains('nested')`),
          'la nouvelle fille reste sous sa mère dans Récents'
        )

        await ui.click(ui.$('history-grouping'))
        await ui.waitFor(`!!${ui.$('grouping-folder')}`)
        await ui.click(ui.$('grouping-folder'))
        await away()
        await ui.waitFor(`!!${ui.$('folder-head')}`)
        await ui.click(ui.$('folder-head'))
        await away()
        const third = await launch()
        check(
          (await ui.ev(`${ui.$('folder-head')}.getAttribute('aria-expanded')`)) === 'true' &&
            (await ui.ev(`!!${row(third)}`)),
          'dossier replié : le lancement révèle immédiatement la fille'
        )
        await ui.shot('filles-visibilite-3-dossier-revele')
        await away()
        await ui.waitFor(`!!${row(third)}`)
        check(
          await ui.ev(
            `[...document.querySelectorAll('[data-testid=history-item][data-mother]')].filter((r) => r.classList.contains('nested')).length === 3`
          ),
          'les trois filles en cours restent sous leur mère'
        )
        await ui.shot('filles-visibilite-4-dossier-ouvert')
      },
      undefined,
      'echo',
      { BOBINE_WORKSPACE: workspace, MOCK_AGENT_DELAY_MS: '10' }
    )
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
}
