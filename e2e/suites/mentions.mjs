import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { check, withApp } from '../lib.mjs'

/** Mentions `@git-changes` et `@terminal` (fiche 057) : contenu joint au message à l'envoi. */
export async function mentionsSuite(scheme) {
  console.log(`\n— Mentions @git-changes et @terminal (${scheme})`)
  const userData = mkdtempSync(join(tmpdir(), 'bob-e2e-'))
  const workspace = join(userData, 'workspace')
  mkdirSync(workspace, { recursive: true })
  const git = (...args) =>
    execFileSync('git', ['-c', 'user.name=Essai', '-c', 'user.email=essai@exemple.org', ...args], {
      cwd: workspace
    })
  git('init', '-q', '-b', 'main')
  writeFileSync(join(workspace, 'notes.txt'), 'un\n')
  writeFileSync(join(workspace, 'secret.txt'), 'clé\n')
  git('add', '.')
  git('commit', '-q', '-m', 'départ')
  writeFileSync(join(workspace, 'notes.txt'), 'un\ndeux-modifie\n')
  // Exclu pour l'agent factice, qui lit les fichiers d'exclusion comme Bob (fiche 155).
  writeFileSync(join(workspace, 'secret.txt'), 'clé-modifiee\n')
  writeFileSync(join(workspace, '.bobignore'), 'secret.txt\n')
  try {
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        // Une commande dans le terminal de la conversation.
        const rows = `(document.querySelector('.terminal-host .xterm-rows')?.innerText ?? '')`
        await ui.press('`', 2)
        await ui.waitFor(
          `document.activeElement?.classList.contains('xterm-helper-textarea') && ${rows}.trim() !== ''`
        )
        await ui.type('echo trace-terminal-$((40+2))')
        await ui.enter()
        await ui.waitFor(`${rows}.includes('trace-terminal-42')`)
        await ui.press('`', 2)
        await ui.waitFor(`!${ui.$('terminal-tab')}`)

        // `@sec` : le fichier exclu par l'agent n'est pas proposé (fiche 155), `notes` l'est.
        const fileItems = `[...document.querySelectorAll('[data-testid=file-item]')]`
        await ui.ev(`${ui.$('composer-input')}.focus()`)
        await ui.type('@note')
        await ui.waitFor(`${fileItems}.some((i) => i.innerText.includes('notes.txt'))`)
        await ui.type('s @secr')
        await new Promise((resolve) => setTimeout(resolve, 600))
        check(
          !(await ui.ev(`${fileItems}.some((i) => i.innerText.includes('secret.txt'))`)),
          'menu « @ » : le fichier exclu par l’agent (.bobignore) n’est pas proposé'
        )
        await ui.press('Escape')
        await ui.ev(`(() => {
          const input = ${ui.$('composer-input')}
          Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(input, '')
          input.dispatchEvent(new Event('input', { bubbles: true }))
          return true
        })()`)
        await ui.waitFor(`${ui.$('composer-input')}.value === ''`)

        // `@git` puis `@term` : proposés en tête du menu, joints au message.
        const contextItems = `[...document.querySelectorAll('[data-testid=context-item]')]`
        await ui.ev(`${ui.$('composer-input')}.focus()`)
        await ui.type('Relis @git')
        await ui.waitFor(`${contextItems}.length === 1`)
        await ui.shot('j0-mention-git')
        await ui.enter()
        await ui.type('et @te')
        await ui.waitFor(`${contextItems}[0]?.innerText.includes('@terminal')`)
        await ui.enter()
        const chips = await ui.ev(
          `[...document.querySelectorAll('[data-testid=attachment]')].map((a) => a.innerText.trim())`
        )
        check(
          chips.join() === '@git-changes,@terminal',
          `menu « @ » : @git-changes et @terminal en pièces jointes (${chips.join(', ')})`
        )
        await ui.enter()
        // Le message apparaît une fois le diff et le terminal lus ; puis l'agent répond.
        await ui.waitFor(`document.querySelectorAll('.msg-user').length === 1`)
        await ui.waitFor(`document.body.innerText.includes('trace-terminal-42')`)
        await ui.ready()
        const reply = await ui.lastAgentText()
        check(
          reply.includes('Contenu de @git-changes') &&
            reply.includes('notes.txt') &&
            reply.includes('+deux-modifie'),
          'à l’envoi : état et diff git du dossier joints au message'
        )
        check(
          !reply.includes('clé-modifiee') &&
            reply.includes('Fichiers sautés, exclus pour l’agent par') &&
            reply.includes('secret.txt'),
          '@git-changes : le fichier exclu par l’agent est sauté, et c’est dit (fiche 155)'
        )
        check(
          reply.includes('Contenu de @terminal') && reply.includes('trace-terminal-42'),
          'à l’envoi : dernières lignes du terminal jointes au message'
        )
        const shown = await ui.ev(
          `[...document.querySelectorAll('[data-testid=msg-attachments] .attachment')].map((a) => a.innerText.trim()).join()`
        )
        check(shown === 'git-changes,terminal', `fil : pièces jointes montrées (${shown})`)
        await ui.shot('j1-mentions-envoyees')
      },
      userData,
      // L'agent décrit ce qu'il reçoit.
      'echo'
    )
  } finally {
    rmSync(userData, { recursive: true, force: true })
  }
}
