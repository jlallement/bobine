import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { L, check, withApp } from '../lib.mjs'

/**
 * Faire relire (fiches 177, 265) : « Faire relire… » dans l'onglet Modifications lance le rôle Code
 * reviewer. Dans le fil : la bulle « @Code reviewer Relis … » et sa carte-réponse (en cours, puis
 * ses remarques visibles, son avis, « Demander à … de corriger », « Voir sur le diff ») ; un clic
 * sur `fichier:ligne` ouvre le diff, où les remarques sont des remarques de diff ; « corriger »
 * transmet sa réponse ; sa conversation montre la demande, la consigne repliée. Dépôt git jetable ;
 * l'agent factice joue `modifications` pour l'auteur, `relecture` pour le relecteur (consigne
 * reconnue). Captures `265-relecture-*` (la relecture d'un travail : suite `travaux-groupe`).
 */
export async function relectureSuite(scheme) {
  console.log(`\n— Relecture par le Code reviewer (${scheme})`)
  const workspace = mkdtempSync(join(tmpdir(), 'bob-e2e-relecture-'))
  const locks = mkdtempSync(join(tmpdir(), 'bob-e2e-relecture-verrou-'))
  const turnLock = join(locks, 'verrou')
  const git = (...args) =>
    execFileSync('git', ['-c', 'user.name=e2e', '-c', 'user.email=e2e@example.invalid', ...args], {
      cwd: workspace
    })
  writeFileSync(join(workspace, 'README.md'), '# Démo\n\nVersion 1\n\n## Utilisation\n')
  git('init', '-q', '-b', 'main')
  git('add', '.')
  git('commit', '-q', '-m', 'init')
  try {
    await withApp(
      scheme,
      (ui) => reviewRun(ui, { workspace, turnLock }),
      undefined,
      'modifications',
      { BOBINE_WORKSPACE: workspace, MOCK_AGENT_TURN_LOCK: turnLock }
    )
  } finally {
    rmSync(workspace, { recursive: true, force: true })
    rmSync(locks, { recursive: true, force: true })
  }
}

const card = `document.querySelector('[data-testid=work-card][data-role=code-reviewer]')`
const findings = `[...${card}.querySelectorAll('[data-testid=work-finding]')]`

/** Attend que `count` tours soient retenus par le verrou de l'agent factice (`docs/mock-agent.md`). */
async function heldTurns(turnLock, count, timeoutMs = 30000) {
  const file = `${turnLock}.retenus`
  const read = () =>
    existsSync(file) ? readFileSync(file, 'utf8').split('\n').filter(Boolean).length : 0
  const deadline = Date.now() + timeoutMs
  while (read() < count) {
    if (Date.now() > deadline) throw new Error(`tours retenus : ${read()} sur ${count}`)
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
}

async function reviewRun(ui, { workspace, turnLock }) {
  await ui.ready()
  await ui.send('Fais les modifications')
  await ui.ready()
  const authorId = await ui.ev(`document.querySelector('.history-item.active')?.dataset.id`)
  await ui.waitFor(`!!${ui.$('changes-toggle')}`)
  await ui.click(ui.$('changes-toggle'))
  await ui.waitFor(`!!${ui.$('changes-review')}`)
  check(
    (await ui.ev(`${ui.$('changes-review')}.getAttribute('aria-label')`)) === L('review.action'),
    'onglet Modifications d’un dossier git : « Faire relire… »'
  )
  await ui.shot('177-1-faire-relire')

  // Dialogue : le Code reviewer, ce qui est relu, le modèle de la conversation (jamais un autre
  // d'office, recette du 2026-11-25), le coût.
  await ui.click(ui.$('changes-review'))
  await ui.waitFor(`!!${ui.$('review-dialog')}`)
  await ui.waitFor(`!!${ui.$('review-model')}`)
  check(
    (await ui.ev(`${ui.$('review-suggested')}.textContent`)) === L('review.dialog.suggested'),
    'relecture : le modèle de la conversation proposé'
  )
  await ui.shot('177-2-dialogue')
  // Le relecteur est retenu par le verrou : on le voit au travail sans le prendre au vol.
  writeFileSync(turnLock, '')
  await ui.click(ui.$('review-launch'))
  await ui.waitFor(`!${ui.$('review-dialog')}`)
  await ui.closePanel()

  // En cours : la bulle « @Code reviewer Relis … », sa carte juste dessous.
  await ui.waitFor(`${card}?.dataset.state === 'running'`, 30000)
  await heldTurns(turnLock, 1)
  await ui.reveal(card)
  await ui.shot('265-relecture-en-cours')
  rmSync(turnLock)

  // A répondu : ses remarques visibles (gravité, fichier:ligne, une phrase), puis son avis.
  await ui.waitFor(
    `${card}?.dataset.state === 'replied' && ${card}.dataset.findings === '2'`,
    30000
  )
  check(!existsSync(join(workspace, 'relecture.txt')), 'dossier relu intact')
  await ui.reveal(card)
  await ui.shot('265-relecture-remarques')
  await ui.viewport(900, 760)
  await ui.reveal(card)
  await ui.shot('265-relecture-remarques-900')
  await ui.viewport()

  // `fichier:ligne` : la vue Git, le fichier ouvert, les remarques sur leurs lignes.
  await ui.click(`${findings}[0].querySelector('[data-testid=work-finding-where]')`)
  await ui.waitFor(`${ui.$('changes-view-git')}?.getAttribute('aria-selected') === 'true'`)
  const notes = `[...document.querySelectorAll('[data-testid=review-note]')]`
  await ui.waitFor(`${notes}.length === 2`)
  await ui.waitFor(
    `[...document.querySelectorAll('[data-testid=diff-note]')].some((n) => n.innerText.includes('process.argv'))`
  )
  // Sa ligne (src/app.js:2) mise en avant et à l'écran.
  await ui.waitFor(`!!document.querySelector('tr.diff-focus')`)
  // Fiche 272 (recette) : la remarque se lit dans la largeur visible du diff, sans défiler.
  const fits = await ui.ev(`[...document.querySelectorAll('[data-testid=diff-note]')].map((n) => {
    const table = n.closest('.diff-table').getBoundingClientRect()
    const note = n.getBoundingClientRect()
    return { note: Math.round(note.right), table: Math.round(table.right), ok: note.left >= table.left - 1 && note.right <= table.right + 1 }
  })`)
  check(
    fits.length > 0 && fits.every((f) => f.ok),
    `remarques du diff dans la largeur visible du panneau (${JSON.stringify(fits)})`
  )
  await ui.shot('177-4-remarque-sur-le-diff')
  await ui.closePanel()

  // « Demander à … de corriger » : message préparé ; sa réponse et ses remarques partent avec.
  await ui.click(`${card}.querySelector('[data-testid=work-fix]')`)
  await ui.waitFor(
    `${card}.querySelector('[data-testid=work-relay]')?.dataset.sent === 'true'`,
    30000
  )
  await ui.ready()
  await ui.reveal(card)
  await ui.shot('265-relecture-transmise')

  // Sa conversation : la demande, la consigne de relecture repliée (jamais en clair).
  await ui.click(`${card}.querySelector('[data-testid=work-open]')`)
  await ui.waitFor(
    `document.querySelector('.history-item.active')?.dataset.id !== ${JSON.stringify(authorId)}`
  )
  await ui.waitFor(
    `!!document.querySelector('[data-testid=user-message] [data-testid=role-brief]')`
  )
  await ui.shot('177-5-relecteur')
}
