import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { sleep, check, withApp } from '../lib.mjs'
import { conversationTooltip } from '../sidebar-tooltip.mjs'

/** Conversations en parallèle : réponse qui continue ailleurs, worktree git, côte à côte (fiche 036). */
export async function parallelSuite(scheme) {
  console.log(`\n— Conversations en parallèle (${scheme})`)
  const workspace = mkdtempSync(join(tmpdir(), 'bob-e2e-parallele-'))
  const git = (...args) =>
    execFileSync('git', ['-c', 'user.name=e2e', '-c', 'user.email=e2e@example.invalid', ...args], {
      cwd: workspace,
      encoding: 'utf8'
    }).trim()
  writeFileSync(join(workspace, 'README.md'), '# Démo\n')
  git('init', '-q', '-b', 'main')
  git('add', '.')
  git('commit', '-q', '-m', 'init')
  try {
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        const items = `[...document.querySelectorAll('[data-testid=history-item]')]`
        const itemNamed = (title) =>
          `${items}.find((i) => i.querySelector('.label')?.innerText.startsWith(${JSON.stringify(title)}))`

        // Réponse longue dans la première conversation, pendant qu'on en ouvre une autre.
        await ui.send('/scenario lent')
        await ui.waitFor(`!!${ui.$('stop')}`)
        await ui.click(ui.$('new-conversation'))
        await ui.waitFor(`!document.querySelector('.history-item.active')`)
        await ui.ready()
        await ui.waitFor(`!!${itemNamed('/scenario lent')}?.querySelector('.spin')`)
        check(
          true,
          'la première conversation continue de répondre (indicateur dans la barre latérale)'
        )

        // Nouvelle conversation dans un worktree.
        await ui.click(ui.$('workspace-menu'))
        await ui.waitFor(`!!${ui.$('workspace-worktree')}`)
        await ui.click(ui.$('workspace-worktree'))
        await ui.waitFor(`${ui.$('workspace-menu')}?.innerText.startsWith('bobine/')`)
        await ui.ready()
        await ui.send('Travail dans le worktree')
        await ui.ready()
        const branch = await ui.ev(`${ui.$('workspace-menu')}.innerText.trim()`)
        check(
          git('branch', '--list', 'bobine/*').includes(branch) &&
            (await ui.ev(
              `${itemNamed('Travail dans le worktree')}?.dataset.branch === ${JSON.stringify(branch)}`
            )) &&
            (
              await conversationTooltip(
                ui,
                `${itemNamed('Travail dans le worktree')}.querySelector('.history-open')`
              )
            ).includes(branch) &&
            git('status', '--porcelain') === '',
          'worktree : branche créée, dans l’infobulle de la barre latérale, dépôt principal intact'
        )
        await ui.shot('95-worktree')

        // Côte à côte : la première conversation à côté de celle du worktree.
        await ui.click(`${itemNamed('/scenario lent')}.querySelector('[data-testid=history-more]')`)
        await ui.waitFor(`!!${ui.$('history-open-beside')}`)
        await ui.click(ui.$('history-open-beside'))
        await ui.waitFor(`!!${ui.$('beside')}`)
        // Sa longue réponse finie (sinon le message irait dans la file d'attente).
        await ui.waitFor(`!${ui.$('beside')}.querySelector('[data-testid=stop]')`, 30000)
        await ui.ev(`${ui.$('beside')}.querySelector('[data-testid=composer-input]').focus()`)
        await ui.type('Message à côté')
        await ui.enter()
        await ui.waitFor(
          `[...${ui.$('beside')}.querySelectorAll('.msg-user')].some((m) => m.innerText === 'Message à côté')`,
          60000
        )
        check(
          (await ui.ev(`document.querySelector('.history-item.active .label')?.innerText`)) ===
            'Travail dans le worktree',
          'côte à côte : message envoyé à la conversation d’à côté, l’active ne change pas'
        )
        await ui.shot('96-cote-a-cote')
        await ui.click(ui.$('beside-close'))
        await ui.waitFor(`!${ui.$('beside')}`)

        // Suppression : worktree et branche supprimés avec la conversation.
        writeFileSync(join(workspace, 'non-suivi.txt'), 'x\n')
        await ui.click(
          `${itemNamed('Travail dans le worktree')}.querySelector('[data-testid=history-more]')`
        )
        await ui.waitFor(`!!${ui.$('history-delete')}`)
        await ui.click(ui.$('history-delete'))
        await ui.waitFor(`${ui.$('delete-worktree')}?.checked === true`)
        await ui.shot('97-suppression-worktree')
        await ui.click(ui.$('delete-confirm'))
        await ui.waitFor(`!${itemNamed('Travail dans le worktree')}`)
        await sleep(500)
        check(
          git('branch', '--list', 'bobine/*') === '' &&
            git('worktree', 'list').split('\n').length === 1,
          'suppression : worktree et branche supprimés (rien à perdre)'
        )
      },
      undefined,
      'streaming-texte',
      { BOBINE_WORKSPACE: workspace }
    )
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
}
