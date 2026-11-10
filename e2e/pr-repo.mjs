/**
 * Dépôt et faux `gh` des suites de suivi de PR (fiche 176) : un dépôt git avec un dépôt distant
 * nu, et un `gh` simulé (`fake-gh.mjs`, jamais GitHub) dont l'état est un fichier JSON que l'essai
 * fait avancer. `openWorktreeAndCommit` : worktree, tour de l'agent factice, commit par la barre.
 */
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
import { root } from './lib.mjs'

export const PR_URL = 'https://github.com/demo/app/pull/7'
export const JOB_URL = 'https://github.com/demo/app/actions/runs/11/job/42'

/** PR telle que `gh pr view --json` la rend, avec ces contrôles. */
export const prJson = (checks, over = {}) => ({
  number: 7,
  url: PR_URL,
  title: 'Fais les modifications',
  state: 'OPEN',
  isDraft: false,
  headRefOid: 'h1',
  mergeable: 'MERGEABLE',
  reviewDecision: '',
  mergeStateStatus: 'CLEAN',
  baseRefName: 'main',
  comments: [],
  reviews: [],
  statusCheckRollup: checks,
  ...over
})

export const checkRun = (name, status, conclusion = '', url = '') => ({
  __typename: 'CheckRun',
  name,
  workflowName: 'CI',
  status,
  conclusion,
  detailsUrl: url
})

/**
 * Dépôt neuf (un commit poussé sur `main`), avec un workflow GitHub si `workflows`, et le faux
 * `gh` dans l'état `fakeState`. `dispose()` efface tout.
 */
export function prRepo({ workflows, fakeState }) {
  const workspace = realpathSync(mkdtempSync(join(tmpdir(), 'bob-e2e-pr-')))
  const remote = realpathSync(mkdtempSync(join(tmpdir(), 'bob-e2e-pr-remote-')))
  const fake = realpathSync(mkdtempSync(join(tmpdir(), 'bob-e2e-gh-')))
  const git = (...args) =>
    execFileSync('git', ['-c', 'user.name=e2e', '-c', 'user.email=e2e@example.invalid', ...args], {
      cwd: workspace,
      encoding: 'utf8'
    }).trim()
  writeFileSync(join(workspace, 'README.md'), '# Démo\n\nVersion 1\n\n## Utilisation\n')
  if (workflows) {
    mkdirSync(join(workspace, '.github', 'workflows'), { recursive: true })
    writeFileSync(join(workspace, '.github', 'workflows', 'ci.yml'), 'on: pull_request\n')
  }
  git('init', '-q', '-b', 'main')
  git('add', '.')
  git('commit', '-q', '-m', 'premier commit')
  git('config', 'user.name', 'e2e')
  git('config', 'user.email', 'e2e@example.invalid')
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main'], { cwd: remote })
  git('remote', 'add', 'origin', remote)
  git('push', '-q', 'origin', 'main')

  const stateFile = join(fake, 'state.json')
  const state = () => JSON.parse(readFileSync(stateFile, 'utf8'))
  const setState = (change) => writeFileSync(stateFile, JSON.stringify({ ...state(), ...change }))
  writeFileSync(stateFile, JSON.stringify({ pr: null, ...fakeState }))
  const gh = join(fake, 'gh')
  writeFileSync(
    gh,
    `#!/bin/sh\nexec "${process.execPath}" "${join(root, 'e2e', 'fake-gh.mjs')}" "${stateFile}" "$@"\n`
  )
  chmodSync(gh, 0o755)

  /** Dossier et branche du worktree de la conversation. */
  const worktree = () => {
    const lines = git('worktree', 'list', '--porcelain').split('\n')
    const at = lines.findIndex((l) => l.startsWith('worktree ') && l.includes('.worktrees'))
    const branch = lines.slice(at).find((l) => l.startsWith('branch '))
    return {
      path: lines[at].slice('worktree '.length),
      branch: branch.slice('branch refs/heads/'.length)
    }
  }
  /** Commit de la branche sur le dépôt distant, ou '' si elle n'y est pas. */
  const remoteHead = (branch) =>
    execFileSync('git', ['for-each-ref', '--format=%(objectname)', `refs/heads/${branch}`], {
      cwd: remote,
      encoding: 'utf8'
    }).trim()
  const dispose = () => {
    for (const dir of [workspace, remote, fake]) rmSync(dir, { recursive: true, force: true })
  }
  return { workspace, remote, gh, git, state, setState, worktree, remoteHead, dispose }
}

/** Liste des fichiers de la vue Git. */
export const FILES = `[...document.querySelectorAll('[data-testid=changes-file]')]`

/** Worktree, un tour de l'agent factice (deux fichiers), vue Git, commit par la barre. */
export async function openWorktreeAndCommit(ui) {
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
  await ui.waitFor(`!!${ui.$('changes-tab')}`)
  await ui.waitFor(`!!${ui.$('changes-view-git')}`)
  await ui.click(ui.$('changes-view-git'))
  await ui.waitFor(`!!${ui.$('worktree-bar')}`)
  await ui.waitFor(`${FILES}.length === 2`)
  await ui.click(ui.$('worktree-commit'))
  await ui.waitFor(`!!${ui.$('worktree-commit-form')}`)
  await ui.click(ui.$('worktree-commit-confirm'))
  await ui.waitFor(`${FILES}.length === 0`)
  await ui.waitFor(`!${ui.$('worktree-pr')}.disabled`)
}

/** « Ouvrir une PR », formulaire confirmé : la carte apparaît. */
export async function openPr(ui) {
  await ui.click(ui.$('worktree-pr'))
  await ui.waitFor(`!!${ui.$('worktree-pr-form')}`)
  await ui.click(ui.$('worktree-pr-confirm'))
  await ui.waitFor(`!!${ui.$('pr-card')}`, 30000)
}
