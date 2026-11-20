import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { L, Lpart, check, withApp } from '../lib.mjs'

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

  // Dialogue : le Code reviewer, ce qui est relu, un autre modèle proposé, le coût.
  await ui.click(ui.$('changes-review'))
  await ui.waitFor(`!!${ui.$('review-dialog')}`)
  await ui.waitFor(`!!${ui.$('review-model')}`)
  const dialog = await ui.ev(`(() => ({
    scope: ${ui.$('review-scope')}.innerText,
    suggested: ${ui.$('review-suggested')}.innerText,
    text: ${ui.$('review-dialog')}.innerText,
    model: ${ui.$('review-model')}.value
  }))()`)
  const authorModel = await ui.ev(
    `window.api.conversations.view(${JSON.stringify(authorId)}).then((v) => String(v.snapshot.controls.find((c) => c.category === 'model').currentValue))`
  )
  check(
    dialog.scope === L('review.dialog.scopeUncommitted') &&
      dialog.text.includes(L('review.dialog.description')) &&
      dialog.suggested.includes(Lpart('review.dialog.suggestedOther')) &&
      dialog.text.includes(L('review.dialog.cost')) &&
      !!dialog.model &&
      dialog.model !== authorModel,
    `dialogue : Code reviewer, non commité relu, un autre modèle (${dialog.model} ≠ ${authorModel}), coût`
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
  const running = await ui.ev(`(() => {
    const card = ${card}
    const bubble = [...document.querySelectorAll('[data-testid=role-request]')].at(-1)
    return {
      before: !!(bubble.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING),
      mention: bubble.querySelector('[data-testid=role-mention]')?.dataset.role,
      text: bubble.querySelector('.role-request-text')?.innerText,
      place: card.querySelector('[data-testid=work-place]')?.innerText,
      stop: !!card.querySelector('[data-testid=work-stop]'),
      old: !!document.querySelector('[data-testid=review-card], [data-testid=subtasks]')
    }
  })()`)
  check(
    running.before &&
      running.mention === 'code-reviewer' &&
      running.text === L('review.ask.uncommitted', { count: 2 }) &&
      running.place === L('workCard.readOnly') &&
      running.stop &&
      !running.old,
    `en cours : bulle « @Code reviewer Relis … », sa carte dessous, Arrêter (${JSON.stringify(running)})`
  )
  await ui.reveal(card)
  await ui.shot('265-relecture-en-cours')
  rmSync(turnLock)

  // A répondu : ses remarques visibles (gravité, fichier:ligne, une phrase), puis son avis.
  await ui.waitFor(
    `${card}?.dataset.state === 'replied' && ${card}.dataset.findings === '2'`,
    30000
  )
  const shown = await ui.ev(`(() => ({
    severities: ${findings}.map((f) => f.querySelector('.review-severity').innerText),
    places: ${findings}.map((f) => f.querySelector('[data-testid=work-finding-where]').innerText),
    titles: ${findings}.map((f) => f.querySelector('[data-testid=work-finding-title]').innerText),
    summary: ${card}.querySelector('[data-testid=work-review-summary]')?.innerText,
    fix: ${card}.querySelector('[data-testid=work-fix]')?.innerText,
    diff: ${card}.querySelector('[data-testid=work-show-diff]')?.innerText,
    reply: ${card}.querySelector('[data-testid=work-reply]')?.innerText,
    open: !!${card}.querySelector('[data-testid=work-open]'),
    old: !!document.querySelector('[data-testid=review-card]')
  }))()`)
  const agent = await ui.ev(
    `window.api.conversations.get().then((s) => s.conversations.find((c) => c.id === ${JSON.stringify(authorId)}).profileLabel)`
  )
  check(
    JSON.stringify(shown.severities) ===
      JSON.stringify([L('review.severity.high'), L('review.severity.low')]) &&
      JSON.stringify(shown.places) === JSON.stringify(['src/app.js:2', 'src/app.js:1-3']) &&
      shown.titles[0] === 'Le message est écrit en dur' &&
      shown.summary === 'Une remarque haute à corriger.' &&
      shown.fix === L('workCard.fix', { agent }) &&
      shown.diff === L('workCard.showDiff') &&
      shown.reply === L('workCard.reply', { role: L('roles.builtin.codeReviewer') }) &&
      shown.open &&
      !shown.old,
    `remarques visibles, avis, « corriger », « Voir sur le diff », « Répondre » (${JSON.stringify(shown)})`
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
  check(
    await ui.ev(
      `[...document.querySelectorAll('[data-testid=diff-note-severity]')].some((s) => s.innerText === ${JSON.stringify(L('review.severity.high'))})`
    ),
    'clic sur `fichier:ligne` : vue Git, le fichier ouvert, la remarque sous sa ligne, sa gravité'
  )
  // Sa ligne (src/app.js:2) mise en avant et à l'écran.
  await ui.waitFor(`!!document.querySelector('tr.diff-focus')`)
  const focused = await ui.ev(`(() => {
    const row = document.querySelector('tr.diff-focus')
    const r = row.getBoundingClientRect()
    return { line: row.dataset.line, side: row.dataset.side, shown: r.top >= 0 && r.bottom <= innerHeight }
  })()`)
  check(
    focused.line === '2' && focused.side === 'new' && focused.shown,
    `clic sur \`fichier:ligne\` : la ligne mise en avant, à l’écran (${JSON.stringify(focused)})`
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
  const sent = await ui.ev(
    `window.api.conversations.view(${JSON.stringify(authorId)}).then((v) => v.transcript.items.filter((i) => i.kind === 'user').at(-1)?.text ?? '')`
  )
  check(
    sent === L('workCard.fixMessage', { role: L('roles.builtin.codeReviewer') }) &&
      !(await ui.ev(`!!${card}.querySelector('[data-testid=work-fix]')`)) &&
      (await ui.ev(`!!${card}.querySelector('[data-testid=work-show-diff]')`)),
    `corriger : le message nomme le relecteur ; transmise, « corriger » retiré, « Voir sur le diff » reste (${sent})`
  )
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
  const opened = await ui.ev(`(() => {
    const first = document.querySelector('[data-testid=user-message]')
    return {
      text: first.innerText,
      folded: !first.querySelector('[data-testid=role-brief-text]'),
      toggle: first.querySelector('[data-testid=role-brief-toggle]')?.innerText ?? ''
    }
  })()`)
  check(
    opened.text.includes(L('review.ask.uncommitted', { count: 2 })) &&
      !opened.text.includes('Code review request from Bobine') &&
      opened.folded &&
      opened.toggle.includes(L('roleWork.brief')),
    `relecteur : la demande, « Consigne du rôle » repliée (${JSON.stringify(opened)})`
  )
  await ui.shot('177-5-relecteur')
}
