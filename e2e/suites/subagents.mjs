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
 * autre message, puis après redémarrage (fiche 127).
 */
export async function subagentsSuite(scheme) {
  console.log(`\n— Sous-agents (${scheme})`)
  const home = mkdtempSync(join(tmpdir(), 'bob-e2e-home-'))
  try {
    await subagents(scheme, home)
    await backgroundThenMessage(scheme)
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
      check(
        (await ui.ev(`${ui.$('permission')}.innerText`)).includes(
          L('toolCall.permission.question.subagent')
        ) &&
          (await ui.ev(`${last}?.dataset.status`)) === 'waiting' &&
          !(await ui.ev(`${ui.$('subagents')}.contains(${ui.$('permission')})`)),
        'Bob : « Lancer ce sous-agent ? » sous la carte, avec sa consigne'
      )
      await ui.shot('g0-sous-agent-autorisation')
      await ui.click(`${ui.$('permission')}.querySelector('[data-kind=allow_once]')`)
      // Pendant qu'il travaille : durée qui défile, coût relu dans la base de Bob.
      const meta = `${last}?.querySelector('[data-testid=subagent-meta]')?.innerText ?? ''`
      await ui.waitFor(`(${meta}).includes(${JSON.stringify(bobcoins(0.0021))})`)
      const running = await ui.ev(`({ status: ${last}.dataset.status, meta: ${meta} })`)
      check(
        running.status !== 'completed' && /^\d+ s/.test(running.meta),
        `Bob : durée et coût du sous-agent pendant qu’il travaille (${running.meta.replace(/\s+/g, ' ')})`
      )
      // L'indicateur sous le fil dit ce que fait l'agent avec le libellé de la carte (fiche 053).
      const working = await ui.ev(`${ui.$('working')}?.innerText.replace(/\\s+/g, ' ') ?? ''`)
      check(
        working.startsWith(
          L('activity.subagent', { task: 'Read notes.txt' }).replace(/\s+/g, ' ')
        ) && /\d+ s$/.test(working),
        `indicateur : « Sous-agent : … » et sa durée sur une ligne (${working})`
      )
      await ui.shot('g0-sous-agent-en-cours')
      await ui.waitFor(`${last}?.dataset.status === 'completed'`)
      await ui.waitFor(`(${meta}).includes(${JSON.stringify(bobcoins(0.0058))})`)
      check(true, 'Bob : coût final du sous-agent sur sa ligne')
      const card = `${last}.closest('[data-testid=subagents]')`
      const bobCard = await ui.ev(
        `({ head: ${card}.querySelector('.subagents-head').innerText, row: ${last}.innerText, rows: ${card}.dataset.count })`
      )
      check(
        bobCard.rows === '1' &&
          bobCard.head.includes(L('toolCall.subagents.title', { count: 1 })) &&
          bobCard.head.includes(L('toolCall.subagents.done', { count: 1 })) &&
          bobCard.head.includes(bobcoins(0.0058)) &&
          /explore\s*Read notes\.txt/.test(bobCard.row),
        `Bob : carte « Sous-agent · 1 fini », une ligne « explore · consigne » (${bobCard.row.replace(/\s+/g, ' ')})`
      )
      await ui.click(`${last}.querySelector('summary')`)
      await ui.waitFor(`!!${last}.querySelector('[data-testid=subagent-answer]')`)
      const bobAnswer = await ui.ev(
        `${last}.querySelector('[data-testid=subagent-answer]').innerHTML`
      )
      check(
        bobAnswer.includes('<strong>Bobine</strong>') && !bobAnswer.includes('task_result'),
        'Bob : réponse mise en forme, sans les balises <task_result>'
      )
      await ui.shot('g1-sous-agent-bob')
      await ui.ready()

      // OpenCode : reconnu à la mise à jour qui porte rawInput.subagent_type.
      await ui.send('/scenario sous-agent-opencode')
      await ui.waitFor(
        `${last}?.dataset.subagent === 'general' && ${last}.dataset.status === 'completed'`
      )
      await ui.click(`${last}.querySelector('summary')`)
      await ui.waitFor(`!!${last}.querySelector('[data-testid=subagent-answer]')`)
      const details = await ui.ev(
        `${last}.querySelector('[data-testid=subagent-details]').innerText`
      )
      check(
        details.includes('summarize it in exactly one sentence') &&
          details.includes('Gribouille') &&
          !details.includes('<task'),
        'OpenCode : consigne complète et réponse, sans les balises <task>'
      )
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
      check(
        (await ui.lastAgentText()).trim() === 'Résumé : le fichier parle du chat Gribouille.',
        'OpenCode 2 : seule la réponse de l’agent dans le fil, rien du sous-agent collé'
      )
      const inThread = await ui.ev(
        `[...document.querySelectorAll('[data-testid=tool]')].filter((t) => !t.closest('[data-testid=subagent-work]')).map((t) => t.innerText).join(' | ')`
      )
      // Ses outils portent leur libellé lisible (fiche 107), pas le titre brut « glob ».
      const globLabel = L('toolCall.label.search', { target: '**/notes.txt' })
      const readLabel = L('toolCall.label.read', { target: 'notes.txt' })
      check(
        !/\bglob\b/.test(inThread) && !inThread.includes(globLabel),
        'OpenCode 2 : ses outils ne sont pas dans le fil'
      )
      await ui.click(`${oc2}.querySelector('summary')`)
      await ui.waitFor(`!!${oc2}.querySelector('[data-testid=subagent-work]')`)
      // Les libellés lus d'un bloc (`textContent`) : celui d'un fichier est en morceaux (fiche 203).
      const live = await ui.ev(
        `[...${oc2}.querySelectorAll('[data-testid=subagent-work] .tool-title')].map((t) => t.textContent).join(' | ') + ' | ' + ${oc2}.querySelector('[data-testid=subagent-work]').innerText`
      )
      const replayButton = await ui.ev(`!!${oc2}.querySelector('[data-testid=subagent-work-show]')`)
      check(
        live.includes(globLabel) &&
          live.includes(readLabel) &&
          !live.includes('qui aime dormir au soleil') &&
          !replayButton,
        'OpenCode 2 : son travail sous la carte, sans le rejouer (sa réponse n’est pas répétée)'
      )
      await ui.shot('g3-sous-agent-opencode2')

      // Sous-agent lancé en arrière-plan (OpenCode 2, fiche 122) : son outil rend la main tout de
      // suite ; la ligne reste « en cours » après le tour, puis finit avec sa réponse.
      await ui.ready()
      const beforeBg = await ui.ev(`${cards}.length`)
      await ui.send('/scenario sous-agent-arriere-plan')
      const bg = `[...${cards}].at(-1)`
      await ui.waitFor(`${cards}.length > ${beforeBg} && ${bg}.dataset.subagent === 'general'`)
      await ui.ready()
      const bgHead = `${bg}.closest('[data-testid=subagents]').querySelector('.subagents-head').innerText`
      check(
        (await ui.ev(`${bg}.dataset.status`)) === 'in_progress' &&
          (await ui.ev(bgHead)).includes(L('toolCall.subagents.running', { count: 1 })),
        'arrière-plan : « en cours » après la fin du tour, pas « fini, < 1 s »'
      )
      await ui.shot('g3b-sous-agent-arriere-plan-en-cours')
      await ui.waitFor(`${bg}.dataset.status === 'completed'`, 40_000)
      await ui.click(`${bg}.querySelector('summary')`)
      await ui.waitFor(`!!${bg}.querySelector('[data-testid=subagent-answer]')`)
      const bgAnswer = await ui.ev(`${bg}.querySelector('[data-testid=subagent-answer]').innerHTML`)
      check(
        bgAnswer.includes('<strong>date</strong>') && !bgAnswer.includes('background'),
        'arrière-plan : fini quand sa session finit, avec sa réponse finale (pas le texte d’attente)'
      )
      check(
        (await ui.ev(bgHead)).includes(L('toolCall.subagents.done', { count: 1 })),
        'arrière-plan : « 1 fini » dans l’en-tête de la carte'
      )
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
      const both = await ui.ev(`({ head: ${head}, rows: ${parallel}.dataset.count })`)
      check(
        both.rows === '2' &&
          both.head.includes(L('toolCall.subagents.title', { count: 2 })) &&
          both.head.includes(L('toolCall.subagents.running', { count: 2 })),
        `deux sous-agents : une carte, deux lignes, « 2 en cours » et le coût total en direct (${both.head.replace(/\s+/g, ' ')})`
      )
      await ui.shot('g4-sous-agents-en-cours')
      await ui.waitFor(
        `(${head}).includes(${JSON.stringify(L('toolCall.subagents.done', { count: 1 }))})`
      )
      const half = await ui.ev(
        `[...${parallel}.querySelectorAll('[data-testid=subagent]')].map((r) => r.dataset.status).join(' ')`
      )
      check(half === 'completed in_progress', `le premier finit d’abord (${half})`)
      await ui.waitFor(
        `(${head}).includes(${JSON.stringify(L('toolCall.subagents.done', { count: 2 }))}) && (${head}).includes(${JSON.stringify(bobcoins(0.0078))})`,
        20_000
      )
      await ui.ready()
      await ui.click(`${parallel}.querySelector('[data-testid=subagent] summary')`)
      await ui.waitFor(`!!${parallel}.querySelector('[data-testid=subagent-answer]')`)
      check(
        (
          await ui.ev(`${parallel}.querySelector('[data-testid=subagent-answer]').innerHTML`)
        ).includes('<strong>three</strong>'),
        '« Réponse » déplie la réponse du premier sous-agent, mise en forme'
      )
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
        check(
          (await ui.ev(`${card}.dataset.status`)) === 'in_progress' &&
            (await ui.ev(`document.querySelectorAll('.msg-user').length`)) === 2,
          'arrière-plan : un autre message part avant sa fin, la carte est toujours « en cours »'
        )
        await ui.waitFor(`${card}.dataset.status === 'completed'`, 40_000)
        await ui.click(`${card}.querySelector('summary')`)
        await ui.waitFor(`(${answer}).includes('<strong>date</strong>')`)
        check(true, 'arrière-plan : fini dans le tour précédent, avec sa réponse finale')
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
