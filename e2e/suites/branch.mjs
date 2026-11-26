import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { check, L, withApp } from '../lib.mjs'

/**
 * Modifier un message et repartir de là (fiche 023) : branche avec l'échange repris, fichiers
 * remis dans leur état d'alors, originale intacte, « Réessayer ». L'agent titre sa session avec le
 * début du texte reçu, contexte de la branche compris, comme Bob (`MOCK_AGENT_TITLES=prompt`) : ni
 * la liste ni la carte de branche ne le montrent (fiche 125). Le dossier est un dépôt git : un
 * fichier commité depuis le message laisse la remise en état décochée, compte à l'appui (fiche 286).
 */
export async function branchSuite(scheme) {
  console.log(`\n— Repartir d’un message (${scheme})`)
  const workspace = mkdtempSync(join(tmpdir(), 'bob-e2e-branch-'))
  const readme = join(workspace, 'README.md')
  const initial = '# Démo\n\nVersion 1\n\n## Utilisation\n'
  writeFileSync(readme, initial)
  const git = (...args) =>
    execFileSync(
      'git',
      [
        '-c',
        'user.name=e2e',
        '-c',
        'user.email=e2e@example.invalid',
        '-c',
        'commit.gpgsign=false',
        ...args
      ],
      { cwd: workspace, stdio: 'pipe' }
    )
  git('init', '-q', '-b', 'main')
  git('add', '.')
  git('commit', '-q', '-m', 'init')
  try {
    await withApp(
      scheme,
      async (ui) => {
        const users = `[...document.querySelectorAll('[data-testid=user-message]')]`
        await ui.send('/scenario streaming-texte')
        await ui.ready()
        await ui.send('/scenario modifications')
        await ui.ready()

        // Modifier le second message.
        await ui.ev(`${users}[1].scrollIntoView({ block: 'center' })`)
        await ui.click(`${users}[1].querySelector('[data-testid=message-edit]')`)
        await ui.waitFor(`!!${ui.$('message-edit-input')}`)
        await ui.ev(`${ui.$('message-edit-input')}.select()`)
        await ui.type('/scenario echo')
        await ui.shot('a0-message-modifie')
        await ui.enter()
        await ui.waitFor(`!!${ui.$('branch-dialog')}`)
        await ui.shot('a1-repartir-dialogue')
        // Rien de commité depuis le message : la remise en état reste cochée (fiche 286).
        check(
          (await ui.ev(`${ui.$('branch-restore')}?.checked === true`)) &&
            !(await ui.ev(`!!${ui.$('branch-committed')}`)),
          'rien de commité depuis : « Remettre … dans leur état d’alors » coché'
        )
        await ui.click(ui.$('branch-confirm'))
        await ui.waitFor(`!!${ui.$('branch-banner')}`)
        await ui.waitFor(
          `[...document.querySelectorAll('.msg-agent')].at(-1)?.innerText.includes('earlier_conversation')`
        )
        await ui.ready()
        check(
          (await ui.lastAgentText()).includes('User: /scenario streaming-texte'),
          'l’agent a reçu l’échange repris en contexte'
        )
        await ui.waitFor(`(${ui.$('title-menu')}?.innerText ?? '').length > 0`)
        await ui.shot('a2-branche')

        // Retour à l'original : intact.
        await ui.ev(`${ui.$('branch-original')}.scrollIntoView({ block: 'center' })`)
        await ui.shot('a3-bandeau-branche')
        await ui.click(ui.$('branch-original'))
        await ui.waitFor(`!document.querySelector('[data-testid=branch-banner]')`)
        await ui.ready()
        check(
          (await ui.ev(`${users}.map((m) => m.querySelector('.msg-user').innerText.trim())`)).join(
            '|'
          ) === '/scenario streaming-texte|/scenario modifications',
          '« Voir l’original » : la conversation d’origine est intacte'
        )

        // Réessayer le dernier message : rien n'a changé depuis sur le disque → pas de dialogue.
        await ui.ev(`${users}.at(-1).scrollIntoView({ block: 'center' })`)
        await ui.click(`${users}.at(-1).querySelector('[data-testid=message-retry]')`)
        await ui.waitFor(`!!${ui.$('branch-banner')}`)
        // La branche s'affiche avant que son message parte (`manager.branch` n'attend pas le tour),
        // et son agent, à peine démarré, est « prêt » le temps de préparer ce message
        // (`AgentHost.prompt`) : `ready()` seul passait avant même le tour, le README pas encore
        // réécrit (Linux, issue #16). On attend le message rejoué dans la branche, comme `ui.send` :
        // il n'apparaît qu'avec l'agent « répond… », et le `ready()` suivant attend bien sa fin.
        await ui.waitFor(
          `!!${ui.$('branch-banner')} && ${users}.length === 2 && ${users}.at(-1).querySelector('.msg-user').innerText.trim() === '/scenario modifications'`
        )
        await ui.ready()
        await ui.waitFor(`document.querySelectorAll('[data-testid=history-item]').length === 3`)
        check(
          readFileSync(readme, 'utf8').includes('Version 2') &&
            !(await ui.ev(`!!${ui.$('branch-dialog')}`)),
          '« Réessayer » : nouvelle branche avec le même message, rejoué par l’agent'
        )
        await ui.shot('a4-branches-a-plat')

        // Le cas réel de l'évaluation (fiche 286) : le fichier modifié par l'agent est commité
        // depuis ; « Repartir » de ce message ne le remet plus en état d'office.
        git('commit', '-q', '-am', 'docs: version 2')
        await ui.ev(`${users}.at(-1).scrollIntoView({ block: 'center' })`)
        await ui.click(`${users}.at(-1).querySelector('[data-testid=message-edit]')`)
        await ui.waitFor(`!!${ui.$('message-edit-input')}`)
        await ui.ev(`${ui.$('message-edit-input')}.select()`)
        await ui.type('/scenario echo')
        await ui.enter()
        // L'aperçu (git compris) est calculé avant que le dialogue s'ouvre.
        await ui.waitFor(`!!${ui.$('branch-dialog')}`)
        await ui.shot('a5-repartir-commite-depuis')
        check(
          (await ui.ev(`${ui.$('branch-restore')}?.checked === false`)) &&
            (await ui.ev(`${ui.$('branch-committed')}.innerText`)) ===
              L('branchDialog.committedSince', { count: 1 }),
          'fichier commité depuis : case décochée, « 1 de ces fichiers a été commité depuis »'
        )
        await ui.click(`${ui.$('branch-dialog')}.querySelector('.btn.ghost')`)
        await ui.waitFor(`!${ui.$('branch-dialog')}`)
        check(
          readFileSync(readme, 'utf8').includes('Version 2') &&
            git('status', '--porcelain', '--', 'README.md').toString() === '',
          'annulé : le fichier commité n’est pas touché (rien à committer)'
        )
      },
      undefined,
      'demo',
      { BOBINE_WORKSPACE: workspace, MOCK_AGENT_TITLES: 'prompt' }
    )
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
}
