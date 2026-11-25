import { rmSync } from 'node:fs'
import { affirm, probes } from '../affirm.mjs'
import { L, check, withApp } from '../lib.mjs'
import {
  BY_MODEL,
  PEER,
  arbiterModel,
  choose,
  env,
  repo,
  rowOf,
  rowState
} from './tour-de-table.mjs'

/**
 * Tour de table (fiche 285), vie des participants après le tour, contre l'agent factice :
 *
 * 1. Arrêt avec un participant lent (arrêt lent de l'agent factice) : « arrêt en cours », puis
 *    « arrêté » ; la carte, le panneau Session et la barre latérale disent la même chose (B5).
 * 2. Barre latérale : les participants y sont pendant le tour, plus après (M7) ; « Ouvrir sa
 *    conversation » depuis la carte marche, le participant ouvert reste dans la liste.
 * 3. Corbeille d'un participant (S1) : l'avis se lit, sans « Ouvrir » ; restauré, la ligne revient.
 * 4. Synthèse retenue par le plafond de la conversation, puis « Continuer » : la carte du plafond
 *    montre un libellé traduit ; l'étiquette de la synthèse nomme le modèle qui l'a écrite (S3).
 */
export async function lifecycle(scheme) {
  await stopAndSidebar(scheme)
  await heldSynthesis(scheme)
  await twoTours(scheme)
  await arbiterWrites(scheme)
}

/** Participants du tour dans la barre latérale (icône du tour). */
const sidebarSeats = `[...document.querySelectorAll('[data-testid=history-item]')].filter((h) => h.querySelector('[data-testid=history-roundtable]')).length`
/** Travaux en cours dans le panneau Session (absent : panneau fermé). */
const sessionChildren = `(() => { const s = document.querySelector('[data-testid=session-running]'); return s ? s.querySelectorAll('ul:not(.finished) [data-testid=session-entry][data-kind=child]').length : -1 })()`
const meta = (name) =>
  `${rowOf(name)}?.querySelector('[data-testid=roundtable-row-meta]')?.textContent`
const activeId = `window.api.conversations.get().then((s) => s.activeId)`

async function stopAndSidebar(scheme) {
  const workspace = repo()
  try {
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        await arbiterModel(ui)
        const mother = await ui.ev(activeId)
        await ui.ev(`${ui.$('composer-input')}.focus()`)
        await ui.type('/roundtable Cycle de vie ?')
        await ui.waitFor(`!!${ui.$('roundtable-line')}`)
        await choose(ui, [PEER(), 'Alpha', 'Beta'])
        await ui.ev(`${ui.$('composer-input')}.focus()`)
        await ui.enter()
        await ui.waitFor(`!!${ui.$('roundtable-card')}`, 20_000)
        await ui.waitFor(
          `${rowState('Alpha', 'answered')} && ${rowState('Beta', 'answered')} && ${rowState(PEER(), 'working')}`,
          30_000
        )

        // Pendant le tour : les trois participants dans la barre latérale.
        await ui.waitFor(`${sidebarSeats} === 3`, 10_000)
        await affirm(ui, '285-barre-pendant', [
          probes.custom(
            'trois participants dans la barre latérale, le lent au travail partout',
            `const session = ${sessionChildren}
            return { ok: ${sidebarSeats} === 3 && (session === -1 || session === 1), detail: JSON.stringify({ session }) }`
          )
        ])

        // Arrêt : « arrêt en cours » tant que le lent s'arrête, puis « arrêté ».
        await ui.click(ui.$('roundtable-stop'))
        await ui.waitFor(
          `${ui.$('roundtable-progress')}?.textContent.includes(${JSON.stringify(L('roundtable.card.stopping'))})`,
          5_000
        )
        await affirm(ui, '285-arret-en-cours', [
          probes.custom(
            '« arrêt en cours » : bouton désactivé, aucun geste sur les lignes',
            `const stop = document.querySelector('[data-testid=roundtable-stop]')
            return { ok: !!stop?.disabled && stop.textContent === ${JSON.stringify(L('roundtable.card.stopping'))} && !document.querySelector('[data-testid=roundtable-stop-seat]') && !document.querySelector('[data-testid=roundtable-synthesize]'), detail: stop?.textContent }`
          )
        ])
        await ui.waitFor(`${ui.$('roundtable-card')}?.dataset.phase === 'stopped'`, 20_000)
        check(
          (await ui.ev(meta(PEER()))) === L('roundtable.state.stopped.roundtable-stopped'),
          'après l’arrêt : le lent « Arrêté avec le tour de table » sur la carte'
        )
        await ui.waitFor(`${sidebarSeats} === 0 && ${sessionChildren} <= 0`, 10_000)
        check(true, 'après l’arrêt : plus de participant dans la barre latérale ni dans Session')
        await affirm(ui, '285-barre-apres', [probes.threadFits()])

        // N9 : « ↓ » près du bas, la carte en bout de fil. Son pied n'est pas sous le bouton, et le
        // bouton qui disparaît ne fait rien sauter (le fil ne se recale pas).
        await ui.viewport(1280, 560)
        // L'avis d'Alpha déplié : le fil dépasse assez la fenêtre pour s'éloigner du bas.
        await ui.click(`${rowOf('Alpha')}.querySelector('[data-testid=roundtable-row-toggle]')`)
        await ui.waitFor(`!!${rowOf('Alpha')}.querySelector('[data-testid=roundtable-row-open]')`)
        const scroller = `document.querySelector('.main > .scroll')`
        const goTo = (gap) =>
          ui.ev(
            `(async () => { const s = ${scroller}; s.scrollTop = s.scrollHeight - s.clientHeight - ${gap}; await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); await new Promise((r) => setTimeout(r, 150)); const card = document.querySelector('[data-testid=roundtable-card]').getBoundingClientRect(); return { gap: s.scrollHeight - s.clientHeight - s.scrollTop, anchor: Math.round(card.top + s.scrollTop), button: !!document.querySelector('[data-testid=scroll-to-bottom]') } })()`
          )
        // Du bas, on remonte juste assez pour que « ↓ » paraisse (61 px, seuil de 60) : le pied de
        // la carte, au bout du fil, n'est pas sous lui (B18).
        await goTo(0)
        const near = await goTo(61)
        const foot = await ui.ev(
          `(() => { const b = document.querySelector('[data-testid=scroll-to-bottom]')?.getBoundingClientRect(); const u = document.querySelector('[data-testid=roundtable-card] [data-testid=roundtable-used]'); const r = document.createRange(); if (u) r.selectNodeContents(u); const f = u && r.getBoundingClientRect(); const ok = !!b && !!f && f.width > 0 && f.bottom <= b.top; return ok || JSON.stringify({ b, f, scrollBottom: document.querySelector('.main > .scroll').getBoundingClientRect().bottom }) })()`
        )
        const bottom = await goTo(30)
        check(
          near.button &&
            !bottom.button &&
            foot === true &&
            near.anchor === bottom.anchor &&
            bottom.gap === 30,
          `« ↓ » près du bas : pied visible, aucun saut à sa disparition (${JSON.stringify({ near, bottom, foot })})`
        )
        await ui.click(`${rowOf('Alpha')}.querySelector('[data-testid=roundtable-row-toggle]')`)
        await ui.waitFor(`!${rowOf('Alpha')}.querySelector('[data-testid=roundtable-row-open]')`)
        await ui.viewport()

        // « Ouvrir sa conversation » depuis la carte : le participant ouvert reste dans la liste.
        await ui.click(`${rowOf('Alpha')}.querySelector('[data-testid=roundtable-open-row]')`)
        await ui.waitFor(`${activeId}.then((id) => id !== ${JSON.stringify(mother)})`, 10_000)
        const alpha = await ui.ev(activeId)
        await ui.waitFor(`${sidebarSeats} === 1`, 10_000)
        check(true, '« Ouvrir sa conversation » : le participant affiché, seul dans la liste')
        await ui.ev(`window.api.conversations.select(${JSON.stringify(mother)}).then(() => true)`)
        await ui.waitFor(`!!${ui.$('roundtable-card')} && ${sidebarSeats} === 0`, 10_000)

        // Corbeille : l'avis se lit, sans « Ouvrir » ; restauré, la ligne revient.
        await ui.ev(
          `window.api.conversations.delete(${JSON.stringify(alpha)}, { fromAgent: false }).then(() => true)`
        )
        await ui.waitFor(
          `${meta('Alpha')} === ${JSON.stringify(L('roundtable.state.trashed'))}`,
          10_000
        )
        check(
          !(await ui.ev(`!!${rowOf('Alpha')}.querySelector('[data-testid=roundtable-open-row]')`)),
          'à la corbeille : pas de bouton « Ouvrir »'
        )
        await ui.click(`${rowOf('Alpha')}.querySelector('[data-testid=roundtable-row-toggle]')`)
        await ui.waitFor(`!!${rowOf('Alpha')}.querySelector('[data-testid=work-body]')`)
        await affirm(ui, '285-participant-corbeille', [probes.threadFits()])
        await ui.ev(
          `window.api.profile.restoreFromTrash(${JSON.stringify(alpha)}).then(() => true)`
        )
        await ui.waitFor(
          `!!${rowOf('Alpha')}.querySelector('[data-testid=roundtable-open-row]') && ${meta('Alpha')} !== ${JSON.stringify(L('roundtable.state.trashed'))}`,
          10_000
        )
        check(true, 'restauré : la ligne revient comme avant')
      },
      undefined,
      'synthese-tour-de-table',
      env(workspace, {
        MOCK_AGENT_SCENARIO_BY_MODEL: BY_MODEL('avis-lent'),
        MOCK_AGENT_DELAY_MS: '150',
        // L'agent factice met 2,5 s à rendre un tour annulé : « arrêt en cours » se voit.
        MOCK_AGENT_SLOW_CANCEL_MS: '2500'
      })
    )
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
}

async function heldSynthesis(scheme) {
  const workspace = repo()
  try {
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        await ui.closePanel()
        await arbiterModel(ui)
        await ui.send('Bonjour')
        await ui.ready()
        // Plafond plus bas que ce premier tour : donné à la conversation par « Par défaut »
        // (comme la suite pendant-tour) ; le message suivant, la synthèse, est retenu.
        await ui.ev(
          `window.api.settings.setPreferences({ costCapEnabled: true, costCapAmount: 0.01 }).then(() => true)`
        )
        await ui.click(ui.$('usage-meter'))
        await ui.waitFor(`!!${ui.$('usage-cap-default')}`)
        await ui.click(ui.$('usage-cap-default'))
        await ui.waitFor(`${ui.$('usage-cap-default')}?.getAttribute('aria-pressed') === 'true'`)
        await ui.key('Escape')
        await ui.ev(`${ui.$('composer-input')}.focus()`)
        await ui.type('/roundtable Retenue ?')
        await ui.waitFor(`!!${ui.$('roundtable-line')}`)
        await choose(ui, ['Alpha', 'Beta'])
        await ui.ev(`${ui.$('composer-input')}.focus()`)
        await ui.enter()
        const lastCap = `[...document.querySelectorAll('[data-testid=cost-cap-card]')].at(-1)`
        await ui.waitFor(
          `${ui.$('roundtable-progress')}?.textContent.includes(${JSON.stringify(L('roundtable.card.held'))})`,
          40_000
        )
        await ui.waitFor(
          `${lastCap}?.querySelector('[data-testid=cost-cap-held]')?.textContent.includes(${JSON.stringify(L('roundtable.held.synthesis'))})`,
          10_000
        )
        await affirm(ui, '285-synthese-retenue', [
          probes.custom(
            'carte du plafond : libellé traduit, jamais la consigne',
            `const held = ${lastCap}.querySelector('[data-testid=cost-cap-held]').textContent
            return { ok: !/Synthesize|<bobine/i.test(held), detail: held }`
          )
        ])
        await ui.click(`${lastCap}.querySelector('[data-testid=cost-cap-continue]')`)
        await ui.waitFor(`!!${ui.$('roundtable-answer-label')}`, 40_000)
        const label = await ui.ev(`${ui.$('roundtable-answer-label')}.textContent`)
        // Le modèle de la conversation (inchangé depuis la demande), lu une fois la synthèse rendue.
        const model = await ui.ev(`${ui.$('model-chip')}.textContent.trim()`)
        check(
          label === L('roundtable.synthesis.label', { model }),
          `étiquette de la synthèse : le modèle qui l’a écrite (${label})`
        )
        // L'étiquette en vue : le fil a défilé jusqu'à la carte du plafond suivante.
        await ui.ev(`${ui.$('roundtable-answer-label')}.scrollIntoView({ block: 'start' }), true`)
        await affirm(ui, '285-etiquette-synthese', [probes.threadFits()])
      },
      undefined,
      'synthese-tour-de-table',
      env(workspace)
    )
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
}

/**
 * Recette du 2026-11-25 : la synthèse écrit la lettre seule (« A ») et groupée (« Participants B et
 * C ») ; chaque ligne montre sa lettre (S3). Puis un second tour : plus aucune action du premier,
 * « Faire réagir » compris (G2).
 */
async function twoTours(scheme) {
  const workspace = repo()
  try {
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        await ui.closePanel()
        await arbiterModel(ui)
        await ui.ev(`${ui.$('composer-input')}.focus()`)
        await ui.type('/roundtable Premier tour ?')
        await ui.waitFor(`!!${ui.$('roundtable-line')}`)
        await choose(ui, ['Alpha', 'Beta', 'Omega'])
        await ui.ev(`${ui.$('composer-input')}.focus()`)
        await ui.enter()
        await ui.waitFor(`!!${ui.$('roundtable-actions')}`, 60_000)
        await ui.click(ui.$('roundtable-head-toggle'))
        await ui.waitFor(
          `document.querySelectorAll('[data-testid=roundtable-seat-letter]').length === 3`
        )
        await affirm(ui, '285-lettres-seules', [
          probes.custom(
            'lettres groupées reconnues, lettre seule laissée telle quelle, une pastille par ligne',
            `const marked = [...document.querySelectorAll('[data-testid=roundtable-answer] [data-testid=roundtable-letter]')].map((a) => a.textContent.trim().slice(-1))
            const badges = [...document.querySelectorAll('[data-testid=roundtable-seat-letter]')].map((b) => b.textContent + '=' + b.getAttribute('aria-label'))
            const ok = marked.includes('B') && marked.includes('C') && !marked.includes('A') && badges.length === 3 && badges.every((b) => /^([A-C])=Participant \\1$/.test(b))
            return { ok, detail: JSON.stringify({ marked, badges }) }`
          )
        ])
        check(!!(await ui.ev(`!!${ui.$('roundtable-rebut')}`)), 'premier tour : « Faire réagir »')

        // Second tour : celui d'avant ne propose plus rien.
        await ui.ev(`${ui.$('composer-input')}.focus()`)
        await ui.type('/roundtable Second tour ?')
        await ui.waitFor(`!!${ui.$('roundtable-cost-full')}`)
        await ui.enter()
        await ui.waitFor(
          `document.querySelectorAll('[data-testid=roundtable-card]').length === 2`,
          20_000
        )
        await ui.waitFor(`!${ui.$('roundtable-rebut')} && !${ui.$('roundtable-apply')}`, 10_000)
        await affirm(ui, '285-deux-tours', [probes.threadFits()])
      },
      undefined,
      'synthese-tour-de-table',
      env(workspace, {
        MOCK_AGENT_SCENARIO_BY_MODEL: `${BY_MODEL()},factice-precis=synthese-lettres-seules`
      })
    )
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
}

/**
 * Recette du 2026-11-25, S1 : la synthèse se fait en lecture seule ; un agent qui écrit quand même
 * (`arbitre-ecrit`, comme OpenCode par défaut) est signalé sous l'étiquette, fichiers compris. Le
 * menu désactive le modèle de la conversation, qui arbitre.
 */
async function arbiterWrites(scheme) {
  const workspace = repo()
  try {
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        await ui.closePanel()
        await arbiterModel(ui)
        await ui.ev(`${ui.$('composer-input')}.focus()`)
        await ui.type('/roundtable Qui écrit ?')
        await ui.waitFor(`!!${ui.$('roundtable-line')}`)
        await ui.click(ui.$('roundtable-participants'))
        await ui.waitFor(`document.querySelectorAll('[data-testid=roundtable-option]').length > 0`)
        const arbiterRow = `[...document.querySelectorAll('[data-testid=roundtable-option]')].find((o) => o.title === ${JSON.stringify(L('roundtable.menu.arbiter'))})`
        await affirm(ui, '285-menu-arbitre', [
          probes.custom(
            'le modèle de la conversation : désactivé, avec sa raison',
            `const o = ${arbiterRow}
            return { ok: !!o && o.getAttribute('aria-disabled') === 'true' && o.textContent.includes(${JSON.stringify(await ui.ev(`${ui.$('model-chip')}.textContent.trim()`))}), detail: o?.textContent }`
          )
        ])
        await ui.key('Escape')
        await choose(ui, ['Alpha', 'Beta'])
        await ui.ev(`${ui.$('composer-input')}.focus()`)
        await ui.enter()
        await ui.waitFor(`!!${ui.$('roundtable-step-changed')}`, 60_000)
        const warning = await ui.ev(`${ui.$('roundtable-step-changed')}.textContent`)
        check(
          warning.includes('notes-arbitre.md'),
          `synthèse qui écrit : l’avertissement nomme le fichier (${warning})`
        )
        await ui.ev(`${ui.$('roundtable-answer-label')}.scrollIntoView({ block: 'start' }), true`)
        await affirm(ui, '285-synthese-a-ecrit', [probes.threadFits()])
      },
      undefined,
      'synthese-tour-de-table',
      env(workspace, {
        MOCK_AGENT_SCENARIO_BY_MODEL: `${BY_MODEL()},factice-precis=arbitre-ecrit`,
        MOCK_AGENT_WRITES: 'silent'
      })
    )
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
}
