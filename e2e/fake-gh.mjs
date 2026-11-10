/**
 * Faux `gh` des essais (fiche 176), jamais GitHub : lancé par un petit script shell que la suite
 * écrit (`BOBINE_GH`), il lit et écrit l'état d'une PR dans un fichier JSON (premier argument),
 * que la suite modifie pour faire avancer la CI. Chaque appel y est noté (`calls`).
 */
import { readFileSync, writeFileSync } from 'node:fs'

const [stateFile, ...args] = process.argv.slice(2)
const state = JSON.parse(readFileSync(stateFile, 'utf8'))
state.calls = [...(state.calls ?? []), args]
const save = () => writeFileSync(stateFile, JSON.stringify(state, null, 2))
const out = (text, code = 0) => {
  save()
  if (code === 0) process.stdout.write(text)
  else process.stderr.write(text)
  process.exit(code)
}

const [command, sub] = args
if (command === 'auth') out('Logged in to github.com\n')
if (command === 'pr' && sub === 'create') {
  // Comme GitHub : une seule PR ouverte par branche.
  if (state.pr?.state === 'OPEN') out(`a pull request for branch "${args[5]}" already exists\n`, 1)
  state.pr = { ...state.onCreate }
  out(`Creating pull request…\n${state.pr.url}\n`)
}
if (command === 'pr' && sub === 'view') {
  if (!state.pr) out(`no pull requests found for branch "${args[2]}"\n`, 1)
  // `--jq .url` (PR déjà là, fiche 110) : comme le vrai `gh`, le lien seul.
  if (args.includes('--jq')) out(`${state.pr.url}\n`)
  out(JSON.stringify(state.pr))
}
if (command === 'run' && sub === 'view') {
  const job = args[args.indexOf('--job') + 1]
  out(state.logs?.[job] ?? '', state.logs?.[job] ? 0 : 1)
}
if (command === 'repo' && sub === 'view') {
  out(
    JSON.stringify(
      state.repo ?? { mergeCommitAllowed: true, squashMergeAllowed: true, rebaseMergeAllowed: true }
    )
  )
}
if (command === 'pr' && sub === 'merge') {
  if (state.mergeError) out(`${state.mergeError}\n`, 1)
  // Comme GitHub : la fusion épinglée refuse un commit en tête qui a bougé.
  const pinned = args[args.indexOf('--match-head-commit') + 1]
  if (args.includes('--match-head-commit') && pinned !== state.pr.headRefOid) {
    out('GraphQL: Head branch was modified. Review and try the merge again.\n', 1)
  }
  state.pr = { ...state.pr, state: 'MERGED' }
  out('')
}
// Règles de la base (0.9.1) : `gh api repos/{owner}/{repo}/branches/<base>` et
// `…/rules/branches/<base>` ; rien de requis par défaut.
if (command === 'api') {
  const answer = sub.includes('/rules/')
    ? (state.rules ?? [])
    : (state.branch ?? { name: 'main', protected: false })
  if (answer.error) out(`${answer.error}\n`, 1)
  out(JSON.stringify(answer))
}
out(`fake gh: unexpected ${args.join(' ')}\n`, 1)
