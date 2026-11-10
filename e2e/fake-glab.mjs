/**
 * Faux `glab` des essais (fiche 189), jamais GitLab : lancé par un petit script shell que la suite
 * écrit (`BOBINE_GLAB`), il lit et écrit l'état d'une MR dans un fichier JSON (premier argument),
 * que la suite modifie. Ses sorties reprennent celles du vrai `glab` 1.128
 * (`src/main/changes/fixtures/glab/`). Chaque appel y est noté (`calls`), avec l'entrée standard.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const [stateFile, ...args] = process.argv.slice(2)
const state = JSON.parse(readFileSync(stateFile, 'utf8'))
const input = args.includes('--description-file') ? readFileSync(0, 'utf8') : undefined
state.calls = [...(state.calls ?? []), input === undefined ? args : [...args, `<stdin:${input}>`]]
const save = () => writeFileSync(stateFile, JSON.stringify(state, null, 2))
const out = (text, code = 0) => {
  save()
  if (code === 0) process.stdout.write(text)
  else process.stderr.write(text)
  process.exit(code)
}
const option = (name) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)
const DOWN =
  '\n   ERROR  \n\n  Get "http://gitlab.e2e.test/api/v4/projects/demo%2Fapp": dial tcp\n  [::1]:443: connect: connection refused.\n'

const [command, sub] = args
if (command === 'auth') {
  const host = args[args.indexOf('--hostname') + 1]
  if (state.auth === 'ok' && host === state.host) out('', 0)
  out(
    `\n   ERROR  \n\n  x ${host} has not been authenticated with glab; run \`glab auth login --hostname ${host}\` to\n  authenticate.\n`,
    1
  )
}
if (command === 'mr' && sub === 'create') {
  if (state.down) out(DOWN, 1)
  // Comme GitLab : une seule MR ouverte par branche (409).
  if (state.mr) {
    out(
      `\n   ERROR  \n\n  POST ${state.url}: 409 {message: [Another open merge request\n  already exists for this source branch: !1]}.\n`,
      1
    )
  }
  state.mr = {
    iid: 1,
    web_url: state.url,
    title: option('title'),
    state: 'opened',
    source_branch: option('source-branch'),
    target_branch: option('target-branch'),
    description: input
  }
  out(`${state.url}\n`)
}
if (command === 'mr' && sub === 'list') {
  if (state.down) out(DOWN, 1)
  const branch = option('source-branch')
  out(JSON.stringify(state.mr && state.mr.source_branch === branch ? [state.mr] : []))
}
out(`unknown command: ${args.join(' ')}\n`, 1)
