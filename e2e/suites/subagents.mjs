import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { check, L, LANG, withApp } from '../lib.mjs'

/** Coût en bobcoins tel que l'app l'écrit dans la langue des essais. */
const bobcoins = (n) =>
  `${new Intl.NumberFormat(LANG, { maximumFractionDigits: 4 }).format(n)} Bobcoins`

/**
 * Carte « Sous-agents » (fiches 010, 117), aux formats de Bob 2.0.6 et d'OpenCode 1.19 et 2 : durée,
 * coût de Bob en direct (base de Bob d'un dossier personnel jetable), travail rejoué d'OpenCode 1.19
 * (fiche 053), travail d'OpenCode 2 rangé en direct sous la carte (fiche 078), deux sous-agents
 * lancés ensemble sur une même carte (fiche 117), sous-agent en arrière-plan qui finit après un
 * autre message, puis après redémarrage (fiche 127), deux sous-agents d'OpenCode 2.3.0, toujours en
 * arrière-plan, dont le parent répond de lui-même hors tour (fiche 232).
 */
export async function subagentsSuite(scheme) {
  console.log(`\n— Sous-agents (${scheme})`)
  const home = mkdtempSync(join(tmpdir(), 'bob-e2e-home-'))
  try {
    await subagents(scheme, home)
    await backgroundThenMessage(scheme)
    await openCode23(scheme)
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
}

async function subagents(scheme, home) {
  await withApp(
    scheme,
    async (ui) => {
      await ui.ready()
      const last = `[...document.querySelectorAll('[data-testid=subagent]')].at(-1)`

      // Bob : autorisation demandée avant de lancer le sous-agent.
      await ui.send('/scenario sous-agent-bob')
      await ui.waitFor(`!!${ui.$('permission')}`)
      await ui.shot('g0-sous-agent-autorisation')
      await ui.click(`${ui.$('permission')}.querySelector('[data-kind=allow_once]')`)
      // Pendant qu'il travaille : durée qui défile, coût relu dans la base de Bob.
      const meta = `${last}?.querySelector('[data-testid=subagent-meta]')?.innerText ?? ''`
      // Coût relu, et durée en secondes entières : lu dès le coût, le compteur pouvait encore dire
      // « < 1 s » (coût relu avant la première seconde, runner macOS et Linux chargé, fiche 250).
      await ui.waitFor(
        `(${meta}).includes(${JSON.stringify(bobcoins(0.0021))}) && /^\\d+ s/.test(${meta})`
      )
      const running = await ui.ev(`({ status: ${last}.dataset.status, meta: ${meta} })`)
      check(
        running.status !== 'completed' && /^\d+ s/.test(running.meta),
        `Bob : durée et coût du sous-agent pendant qu’il travaille (${running.meta.replace(/\s+/g, ' ')})`
      )
      await ui.shot('g0-sous-agent-en-cours')
      await ui.waitFor(`${last}?.dataset.status === 'completed'`)
      await ui.waitFor(`(${meta}).includes(${JSON.stringify(bobcoins(0.0058))})`)
      check(true, 'Bob : coût final du sous-agent sur sa ligne')
      await ui.click(`${last}.querySelector('summary')`)
      await ui.waitFor(`!!${last}.querySelector('[data-testid=subagent-answer]')`)
      await ui.shot('g1-sous-agent-bob')
      await ui.ready()

      // OpenCode : reconnu à la mise à jour qui porte rawInput.subagent_type.
      await ui.send('/scenario sous-agent-opencode')
      await ui.waitFor(
        `${last}?.dataset.subagent === 'general' && ${last}.dataset.status === 'completed'`
      )
      // La réponse de l'agent arrive juste après le sous-agent, et le fil (en bas) remonte la
      // ligne de sa hauteur : sur une machine chargée, l'appui tombait au-dessus d'elle et rien ne
      // se dépliait (Linux, fiche 250). On attend la fin du tour, comme un humain qui lit.
      await ui.ready()
      await ui.click(`${last}.querySelector('summary')`)
      // Dépliée : le détail est dans la page même replié, seul `open` dit que le clic a porté.
      await ui.waitFor(`${last}.open`)
      await ui.waitFor(`!!${last}.querySelector('[data-testid=subagent-answer]')`)
      // Son travail : la session du sous-agent est rejouée à part (fiche 053). Ses outils sont
      // des cartes eux aussi : on garde la carte du sous-agent.
      const row = `[...document.querySelectorAll('[data-testid=subagent]')].at(-1)`
      const show = `${row}.querySelector('[data-testid=subagent-work-show]')`
      const started = `!!${row}.querySelector('[data-testid=subagent-work]') || !!${show}?.disabled`
      await ui.click(show)
      // Clic perdu sur une machine chargée : le bouton n'a pas bougé, on clique une seconde fois.
      await ui.waitFor(started, 5000).catch(() => ui.click(show))
      await ui.waitFor(`!!${row}.querySelector('[data-testid=subagent-work]')`, 30_000)
      const work = await ui.ev(`${row}.querySelector('[data-testid=subagent-work]').innerText`)
      check(
        work.includes('notes.txt') && !work.includes('qui aime dormir au soleil'),
        'OpenCode : « Voir son travail » rejoue la session du sous-agent (sa lecture ; la réponse n’est pas répétée)'
      )
      await ui.shot('g2-sous-agent-opencode')

      // OpenCode 2 (fiche 078) : le travail du sous-agent arrive en direct, rangé sous sa carte.
      await ui.ready()
      const cards = `document.querySelectorAll('[data-testid=subagent]')`
      const before = await ui.ev(`${cards}.length`)
      await ui.send('/scenario sous-agent-opencode2')
      const oc2 = `[...${cards}].at(-1)`
      await ui.waitFor(
        `${cards}.length > ${before} && ${oc2}.dataset.subagent === 'explore' && ${oc2}.dataset.status === 'completed'`
      )
      await ui.ready()
      await ui.click(`${oc2}.querySelector('summary')`)
      await ui.waitFor(`!!${oc2}.querySelector('[data-testid=subagent-work]')`)
      await ui.shot('g3-sous-agent-opencode2')

      // Sous-agent lancé en arrière-plan (OpenCode 2, fiche 122) : son outil rend la main tout de
      // suite ; la ligne reste « en cours » après le tour, puis finit avec sa réponse.
      await ui.ready()
      const beforeBg = await ui.ev(`${cards}.length`)
      await ui.send('/scenario sous-agent-arriere-plan')
      const bg = `[...${cards}].at(-1)`
      await ui.waitFor(`${cards}.length > ${beforeBg} && ${bg}.dataset.subagent === 'general'`)
      await ui.ready()
      await ui.shot('g3b-sous-agent-arriere-plan-en-cours')
      await ui.waitFor(`${bg}.dataset.status === 'completed'`, 40_000)
      await ui.click(`${bg}.querySelector('summary')`)
      await ui.waitFor(`!!${bg}.querySelector('[data-testid=subagent-answer]')`)
      await ui.shot('g3c-sous-agent-arriere-plan-fini')

      // Deux sous-agents lancés ensemble (fiche 117) : une seule carte, deux lignes, le total.
      await ui.ready()
      const before2 = await ui.ev(`document.querySelectorAll('[data-testid=subagents]').length`)
      await ui.send('/scenario sous-agents-paralleles')
      const rowsOf = `[...[...document.querySelectorAll('[data-testid=subagents]')].at(-1).querySelectorAll('[data-testid=subagent]')]`
      // Bob demande une autorisation par sous-agent, l'une après l'autre.
      for (const i of [0, 1]) {
        await ui.waitFor(
          `${rowsOf}.length === 2 && ${rowsOf}[${i}].dataset.status === 'waiting' && !!${ui.$('permission')}`
        )
        await ui.click(`${ui.$('permission')}.querySelector('[data-kind=allow_once]')`)
        await ui.waitFor(`${rowsOf}[${i}].dataset.status === 'in_progress'`)
      }
      const parallel = `[...document.querySelectorAll('[data-testid=subagents]')].at(-1)`
      const head = `${parallel}?.querySelector('.subagents-head')?.innerText ?? ''`
      await ui.waitFor(
        `document.querySelectorAll('[data-testid=subagents]').length > ${before2} && (${head}).includes(${JSON.stringify(bobcoins(0.0033))})`
      )
      await ui.shot('g4-sous-agents-en-cours')
      await ui.waitFor(
        `(${head}).includes(${JSON.stringify(L('toolCall.subagents.done', { count: 1 }))})`
      )
      await ui.waitFor(
        `(${head}).includes(${JSON.stringify(L('toolCall.subagents.done', { count: 2 }))}) && (${head}).includes(${JSON.stringify(bobcoins(0.0078))})`,
        20_000
      )
      await ui.ready()
      await ui.click(`${parallel}.querySelector('[data-testid=subagent] summary')`)
      await ui.waitFor(`!!${parallel}.querySelector('[data-testid=subagent-answer]')`)
      await ui.shot('g5-sous-agents-finis')
    },
    undefined,
    'demo',
    {
      BOBINE_CONFIG_HOME: home,
      MOCK_AGENT_CURRENCY: 'bobcoins',
      MOCK_AGENT_COST_SOURCE: 'bob-db'
    }
  )
}

/**
 * Sous-agent en arrière-plan, puis un autre message avant sa fin (D25, fiche 127) : sa carte, dans
 * un tour qui n'est plus le dernier, finit quand même avec sa réponse, et le reste après
 * redémarrage (fil enregistré).
 */
async function backgroundThenMessage(scheme) {
  const userData = mkdtempSync(join(tmpdir(), 'bob-e2e-fond-'))
  const card = `document.querySelector('[data-testid=subagent]')`
  const answer = `${card}?.querySelector('[data-testid=subagent-answer]')?.innerHTML ?? ''`
  try {
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        await ui.send('/scenario sous-agent-arriere-plan-lent')
        await ui.waitFor(`${card}?.dataset.status === 'in_progress'`)
        await ui.ready()
        await ui.send('Et pendant ce temps, dis bonjour')
        await ui.ready()
        await ui.waitFor(`${card}.dataset.status === 'completed'`, 40_000)
        await ui.click(`${card}.querySelector('summary')`)
        await ui.waitFor(`(${answer}).includes('<strong>date</strong>')`)
        await ui.ev(`${card}.scrollIntoView({ block: 'center' }), true`)
        await ui.shot('g3d-arriere-plan-fini-apres-un-message')
      },
      userData,
      'echo'
    )
    await withApp(
      scheme,
      async (ui) => {
        const item = `[...document.querySelectorAll('[data-testid=history-item]')].find((r) => r.innerText.includes('sous-agent-arriere-plan-lent'))`
        await ui.waitFor(`!!${card} || !!${item}`, 20_000)
        if (!(await ui.ev(`!!${card}`)))
          await ui.click(`${item}.querySelector('.history-open') ?? ${item}`)
        await ui.waitFor(`!!${card}`, 20_000)
        await ui.click(`${card}.querySelector('summary')`)
        await ui.waitFor(`(${answer}).includes('<strong>date</strong>')`)
        check(
          (await ui.ev(`${card}.dataset.status`)) === 'completed',
          'arrière-plan : toujours fini, avec sa réponse, après redémarrage'
        )
      },
      userData,
      'echo'
    )
  } finally {
    rmSync(userData, { recursive: true, force: true })
  }
}

/**
 * OpenCode 2.3.0 (fiche 232) : deux sous-agents lancés ensemble, toujours en arrière-plan. Leur
 * travail n'est relayé que pendant le tour ; ils finissent après, et le parent répond de lui-même,
 * hors tour. Chaque ligne garde son travail, complet à sa fin ; la réponse hors tour est un message
 * à part ; le tout tient après redémarrage.
 */
async function openCode23(scheme) {
  const userData = mkdtempSync(join(tmpdir(), 'bob-e2e-2-3-'))
  const block = `[...document.querySelectorAll('[data-testid=subagents]')].at(-1)`
  const rows = `[...(${block}?.querySelectorAll('[data-testid=subagent]') ?? [])]`
  const work = (i) =>
    `(${rows}[${i}]?.querySelector('[data-testid=subagent-work]')?.textContent ?? '')`
  const answer = (i) =>
    `(${rows}[${i}]?.querySelector('[data-testid=subagent-answer]')?.textContent ?? '')`
  const replies = `[...document.querySelectorAll('.msg-agent')].map((m) => m.innerText)`
  // Ligne dépliée (`<details>`) : « Réponse » et travail visibles.
  const open = async (ui, i) => {
    if (!(await ui.ev(`${rows}[${i}].open`)))
      await ui.click(`${rows}[${i}].querySelector('summary')`)
  }
  try {
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        await ui.send('/scenario sous-agents-arriere-plan-2-3')
        await ui.waitFor(`${rows}.length === 2`)
        await ui.ready()
        // Fiche 255 (D1) : le tour ACP est fini, mais le travail continue : « en cours » partout.
        const status = `document.querySelector('[data-testid=agent-status]')?.textContent`
        const summary = `document.querySelector('[data-testid=turn-summary]')`
        await ui.shot('255-en-cours-apres-le-tour')
        await open(ui, 0)
        await open(ui, 1)
        const live = await ui.ev(`[${work(0)}, ${work(1)}]`)
        check(
          live[0].includes('secret.txt') &&
            !live[0].includes('autre.txt') &&
            live[1].includes('autre.txt') &&
            !live[1].includes('secret.txt'),
          '2.3.0 : chaque ligne montre le travail de son sous-agent, pas celui de l’autre'
        )
        await ui.shot('g6-2-3-deux-en-cours')

        await ui.waitFor(`${rows}.every((r) => r.dataset.status === 'completed')`, 40_000)
        await open(ui, 0)
        await open(ui, 1)
        await ui.waitFor(`${answer(0)}.includes('KANGOUROU') && ${answer(1)}.includes('ZEBRE')`)
        await ui.waitFor(`${replies}.at(-1)?.includes('ZEBRE')`, 20_000)
        // Fiche 255 : le bilan vient à la fin du travail (quelques secondes de silence après la
        // réponse hors tour), sous cette réponse, et l'agent redit « Prêt ».
        await ui.waitFor(`!!${summary}`, 20_000)
        check(
          (await ui.ev(`(() => {
            const last = [...document.querySelectorAll('.msg-agent')].at(-1)
            return !!last && !!(last.compareDocumentPosition(${summary}) & Node.DOCUMENT_POSITION_FOLLOWING)
          })()`)) &&
            !(await ui.ev(`!!document.querySelector('[data-testid=working]')`)) &&
            (await ui.ev(status)) === L('sidebar.status.ready'),
          '2.3.0 (fiche 255) : le bilan vient à la fin du travail, sous la réponse hors tour ; « Prêt » ensuite'
        )
        // Le pied de la réponse en vue (revue UX) : le bilan qui a remplacé « Travaille encore… ».
        await ui.ev(`${summary}.scrollIntoView({ block: 'end' }), true`)
        await ui.shot('g6b-2-3-fini')
      },
      userData,
      'echo'
    )
    await withApp(
      scheme,
      async (ui) => {
        const item = `[...document.querySelectorAll('[data-testid=history-item]')].find((r) => r.innerText.includes('sous-agents-arriere-plan-2-3'))`
        await ui.waitFor(`${rows}.length === 2 || !!${item}`, 20_000)
        if (!(await ui.ev(`${rows}.length === 2`)))
          await ui.click(`${item}.querySelector('.history-open') ?? ${item}`)
        await ui.waitFor(`${rows}.length === 2`, 20_000)
        await open(ui, 0)
        await open(ui, 1)
        const [before, after] = (await ui.ev(replies)).slice(-2)
        check(
          (await ui.ev(`${rows}.map((r) => r.dataset.status).join(' ')`)) ===
            'completed completed' &&
            (await ui.ev(answer(1))).includes('ZEBRE') &&
            (await ui.ev(work(1))).includes('autre.txt') &&
            !before.includes('ZEBRE') &&
            after.includes('ZEBRE'),
          '2.3.0 : après redémarrage, mêmes lignes finies, même travail, mêmes deux messages'
        )
      },
      userData,
      'echo'
    )
  } finally {
    rmSync(userData, { recursive: true, force: true })
  }
}
