import { execFileSync } from 'node:child_process'
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { L, check, root, sleep, withApp } from '../lib.mjs'
import { FILES } from '../pr-repo.mjs'

const HOST = 'gitlab.e2e.test'
const MR_URL = `https://${HOST}/demo/app/-/merge_requests/1`
/** Texte d’une clé à lien (`<anchor>…</anchor>`) tel qu'affiché, espaces ramenés à un. */
const shown = (key, params) =>
  L(key, params)
    .replace(/<\/?anchor>/g, '')
    .replace(/\s+/g, ' ')
/** Issues affichées sous les boutons (erreur, note) : jamais plus d'une (fiche 189, verdict UX). */
const ISSUES = `document.querySelectorAll('[data-testid=worktree-error], [data-testid=worktree-note]').length`
const noteText = (ui) => ui.ev(`${ui.$('worktree-note')}.innerText.replace(/\\s+/g, ' ')`)

/**
 * « Ouvrir une MR » sur un GitLab auto-hébergé (fiche 189) avec un faux `glab` (`BOBINE_GLAB`,
 * jamais GitLab) : le dépôt distant a une URL GitLab, et ses poussées vont dans un dépôt nu local
 * (`remote.origin.pushurl`). `glab` pas connecté (bouton désactivé, la commande à lancer dite),
 * puis connecté : « Ouvrir une MR », lien de la MR, commit fait dans un terminal, « Pousser vers la
 * MR » (MR existante retrouvée), hôte injoignable (message clair), puis forge inconnue.
 */
export async function gitlabSuite(scheme) {
  console.log(`\n— GitLab : ouvrir une MR (${scheme})`)
  const workspace = realpathSync(mkdtempSync(join(tmpdir(), 'bob-e2e-gl-')))
  const remote = realpathSync(mkdtempSync(join(tmpdir(), 'bob-e2e-gl-remote-')))
  const fake = realpathSync(mkdtempSync(join(tmpdir(), 'bob-e2e-glab-')))
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
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main'], { cwd: remote })
  git('remote', 'add', 'origin', `https://${HOST}/demo/app.git`)
  git('config', 'remote.origin.pushurl', remote)
  git('push', '-q', 'origin', 'main')

  const stateFile = join(fake, 'state.json')
  const state = () => JSON.parse(readFileSync(stateFile, 'utf8'))
  const setState = (change) => writeFileSync(stateFile, JSON.stringify({ ...state(), ...change }))
  writeFileSync(stateFile, JSON.stringify({ host: HOST, auth: 'no', url: MR_URL, mr: null }))
  // Configuration de glab (jamais celle de l'utilisateur) : l'hôte y est déclaré, comme après
  // `glab auth login --hostname` ; c'est ce qui fait de lui un GitLab (ADR-0041). gh : vide.
  mkdirSync(join(fake, 'glab-config'))
  writeFileSync(
    join(fake, 'glab-config', 'config.yml'),
    `hosts:\n    ${HOST}:\n        api_protocol: https\n`
  )
  mkdirSync(join(fake, 'gh-config'))
  const glab = join(fake, 'glab')
  writeFileSync(
    glab,
    `#!/bin/sh\nexec "${process.execPath}" "${join(root, 'e2e', 'fake-glab.mjs')}" "${stateFile}" "$@"\n`
  )
  chmodSync(glab, 0o755)
  const remoteHead = (branch) =>
    execFileSync('git', ['for-each-ref', '--format=%(objectname)', `refs/heads/${branch}`], {
      cwd: remote,
      encoding: 'utf8'
    }).trim()
  const button = (ui) => ui.$('worktree-pr')
  const refresh = (ui) =>
    ui.click(
      `document.querySelector('.changes-tab button[aria-label=${JSON.stringify(L('changes.refresh'))}]')`
    )

  try {
    await withApp(
      scheme,
      async (ui) => {
        // `glab` n'est pas connecté à cet hôte : le bouton dit « MR » et pourquoi il attend.
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
        await ui.waitFor(`!!${button(ui)}`)
        await ui.waitFor(
          `${button(ui)}.innerText === ${JSON.stringify(L('worktreeCycle.pr.open_mr'))}`
        )
        const notLogged = L('worktreeCycle.pr.notLogged_mr', { host: HOST })
        await ui.waitFor(
          `${ui.$('worktree-pr-blocker')}?.innerText === ${JSON.stringify(notLogged)}`
        )
        check(
          await ui.ev(`${button(ui)}.disabled`),
          '« Ouvrir une MR » désactivé : glab pas connecté à l’hôte, la commande à lancer dite'
        )
        await ui.shot('189-mr-glab-non-connecte')
        check(
          (await ui.ev(ISSUES)) <= 1,
          'une seule issue sous les boutons (189-mr-glab-non-connecte)'
        )

        // Connecté (`glab auth login`), puis « Actualiser » : le parcours de la MR.
        setState({ auth: 'ok' })
        await refresh(ui)
        await ui.waitFor(`${FILES}.length === 2`)
        await ui.click(ui.$('worktree-commit'))
        await ui.waitFor(`!!${ui.$('worktree-commit-form')}`)
        await ui.click(ui.$('worktree-commit-confirm'))
        await ui.waitFor(`${FILES}.length === 0`)
        await ui.waitFor(`!${button(ui)}.disabled`, 30000)
        await ui.click(button(ui))
        await ui.waitFor(`!!${ui.$('worktree-pr-form')}`)
        check(
          (await ui.ev(`${ui.$('worktree-pr-confirm')}.innerText`)) ===
            L('worktreeCycle.pr.confirm_mr'),
          'formulaire : « Pousser et ouvrir la MR »'
        )
        await ui.shot('189-mr-formulaire')
        check((await ui.ev(ISSUES)) <= 1, 'une seule issue sous les boutons (189-mr-formulaire)')
        await ui.click(ui.$('worktree-pr-confirm'))
        await ui.waitFor(`!!${ui.$('worktree-pr-link')}`, 30000)
        const branch = state().mr?.source_branch
        const created = state().calls.find((c) => c[1] === 'create') ?? []
        check(
          (await ui.ev(`${ui.$('worktree-pr-link')}.href`)) === MR_URL &&
            (await noteText(ui)).includes(
              shown('worktreeCycle.pr.created_mr', { name: 'demo/app!1' })
            ) &&
            !!branch &&
            remoteHead(branch) === git('rev-parse', branch) &&
            created.includes(`--source-branch=${branch}`) &&
            created.includes('--target-branch=main') &&
            created.includes('--yes') &&
            !(await ui.ev(`!!${ui.$('pr-card')}`)),
          'MR ouverte : branche poussée, MR vers main, lien affiché, pas de carte de suivi'
        )
        await ui.waitFor(`!${button(ui)}`)
        await ui.shot('189-mr-ouverte')
        check((await ui.ev(ISSUES)) <= 1, 'une seule issue sous les boutons (189-mr-ouverte)')

        // Un commit fait dans un terminal, « Actualiser » : « Pousser vers la MR ».
        const worktreePath = git('worktree', 'list', '--porcelain')
          .split('\n')
          .find((l) => l.startsWith('worktree ') && l.includes('.worktrees'))
          .slice('worktree '.length)
        const inWorktree = (...args) =>
          execFileSync('git', args, { cwd: worktreePath, encoding: 'utf8' }).trim()
        writeFileSync(join(worktreePath, 'NOTES.md'), 'Commit fait dans un terminal\n')
        inWorktree('add', 'NOTES.md')
        inWorktree('commit', '-q', '-m', 'docs: notes (terminal)')
        await refresh(ui)
        await ui.waitFor(
          `${button(ui)}?.innerText === ${JSON.stringify(L('worktreeCycle.pr.pushToPr_mr'))}`,
          30000
        )
        await ui.shot('189-mr-pousser')
        check((await ui.ev(ISSUES)) <= 1, 'une seule issue sous les boutons (189-mr-pousser)')
        await ui.click(button(ui))
        await ui.waitFor(`!${button(ui)}`, 30000)
        check(
          remoteHead(branch) === inWorktree('rev-parse', 'HEAD') &&
            (await noteText(ui)).includes(
              shown('worktreeCycle.pr.existed_mr', { name: 'demo/app!1' })
            ),
          '« Pousser vers la MR » : branche poussée, MR existante retrouvée'
        )

        // VPN coupé : GitLab ne répond plus ; le message dit quoi faire, sans erreur brute.
        writeFileSync(join(worktreePath, 'NOTES.md'), 'Deuxième commit\n')
        inWorktree('commit', '-q', '-am', 'docs: encore')
        await refresh(ui)
        await ui.waitFor(
          `${button(ui)}?.innerText === ${JSON.stringify(L('worktreeCycle.pr.pushToPr_mr'))}`,
          30000
        )
        setState({ down: true })
        await ui.click(button(ui))
        await ui.waitFor(`!!${ui.$('worktree-error')}`, 30000)
        check(
          (await ui.ev(`${ui.$('worktree-error')}.innerText`)).includes(
            L('worktreeCycle.mr.error.unreachable', { host: HOST })
          ) && !(await ui.ev(`${ui.$('worktree-error')}.innerText`)).includes('dial tcp'),
          'hôte injoignable : message clair (réseau, VPN), pas la sortie brute de glab'
        )
        await ui.shot('189-mr-injoignable')
        check((await ui.ev(ISSUES)) <= 1, 'une seule issue sous les boutons (189-mr-injoignable)')

        // Forge inconnue (ni GitHub ni GitLab) : pas de bouton, la raison dite sous les boutons.
        setState({ down: false })
        git('remote', 'set-url', 'origin', 'https://git.e2e.test/demo/app.git')
        await refresh(ui)
        const unknown = shown('worktreeCycle.pr.unknownForge', { host: 'git.e2e.test' }).replace(
          /<\/?code>/g,
          ''
        )
        await ui.waitFor(
          `${ui.$('worktree-pr-blocker')}?.innerText.replace(/\\s+/g, ' ') === ${JSON.stringify(unknown)}`,
          30000
        )
        check(
          !(await ui.ev(`!!${button(ui)}`)),
          'forge inconnue : pas de bouton, la raison et l’hôte dits sous les boutons'
        )
        await ui.shot('189-forge-inconnue')
        check(
          (await ui.ev(ISSUES)) === 0,
          'forge inconnue après « Actualiser » : plus d’erreur ni de note d’avant (autre hôte)'
        )
        await sleep(100)
      },
      undefined,
      'conflits',
      // `gh` absent : la forge vient de `glab` seul.
      {
        BOBINE_WORKSPACE: workspace,
        BOBINE_GLAB: glab,
        BOBINE_GH: '',
        GLAB_CONFIG_DIR: join(fake, 'glab-config'),
        GH_CONFIG_DIR: join(fake, 'gh-config')
      }
    )
  } finally {
    for (const dir of [workspace, remote, fake]) rmSync(dir, { recursive: true, force: true })
  }
}
