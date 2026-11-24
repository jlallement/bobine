import { execFileSync } from 'node:child_process'
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { affirm, probes } from '../affirm.mjs'
import { L, check, withApp } from '../lib.mjs'

/**
 * Tour de table (fiche 285), contre l'agent factice et son pair (« Agent factice B ») : chaque
 * participant joue le scénario de son modèle (`MOCK_AGENT_SCENARIO_BY_MODEL`), la conversation qui
 * arbitre joue `synthese-tour-de-table` sur son propre modèle (« Factice précis »).
 *
 * 1. Journée nominale : premier usage (Entrée ouvre le menu), menu à cases et ses bornes, ligne du
 *    surcoût mesurée à trois largeurs (« jetons » jamais coupé), lancement en deux gestes, carte en
 *    cours, avis (format suivi ou non), participant en erreur, synthèse automatique et carte
 *    repliée, lettres (survol et focus), réplique, décision, « Demander de l'appliquer ».
 * 2. Cas dégradés : modèle refusé (« Choisir un autre modèle »), erreur puis « Relancer », dossier
 *    modifié par un participant qui écrit sans demander, « Synthétiser sans attendre », « Arrêter ».
 * 3. Redémarrage en plein recueil : « interrompu », participant « arrêté (redémarrage) »,
 *    « Reprendre » ; rien ne repart seul.
 *
 * Les textes de l'app sont comparés par `L('clé')` ; chaque capture est accompagnée de mesures du
 * DOM réel (`affirm`).
 */

const MODELS = [
  'fx/alpha=Fx/Alpha',
  'fx/beta=Fx/Beta',
  'fx/gamma=Fx/Gamma',
  'fx/delta=Fx/Delta',
  'fx/zeta=Fx/Zeta'
].join(',')

/** Scénario de chaque modèle ; « Factice précis » (la conversation) joue la synthèse. */
const BY_MODEL = (rapide = 'avis-participant') =>
  [
    `factice-rapide=${rapide}`,
    'fx/alpha=avis-participant',
    'fx/beta=avis-hors-format',
    'fx/gamma=avis-erreur',
    'fx/delta=participant-ecrit'
  ].join(',')

const PEER = () => L('profiles.mockPeer.label')

/** Dépôt git jetable (la lecture seule seulement demandée y est surveillée). */
function repo() {
  const workspace = realpathSync(mkdtempSync(join(tmpdir(), 'bob-e2e-tour-de-table-')))
  const git = (...args) =>
    execFileSync('git', ['-c', 'user.name=e2e', '-c', 'user.email=e2e@example.invalid', ...args], {
      cwd: workspace,
      encoding: 'utf8'
    })
  writeFileSync(join(workspace, 'README.md'), '# File de tâches\n')
  git('init', '-q', '-b', 'main')
  git('add', '.')
  git('commit', '-q', '-m', 'init')
  return workspace
}

const env = (workspace, extra = {}) => ({
  BOBINE_WORKSPACE: workspace,
  BOBINE_MOCK_PEER: '1',
  MOCK_MODELS: MODELS,
  MOCK_AGENT_SCENARIO_BY_MODEL: BY_MODEL(),
  MOCK_AGENT_REFUSE_MODEL: 'fx/zeta',
  ...extra
})

/** La conversation arbitre avec « Factice précis » (ses participants gardent leurs modèles). */
async function arbiterModel(ui) {
  await ui.click(ui.$('model-chip'))
  await ui.waitFor(`!!${ui.$('control-model-factice-precis')}`)
  await ui.click(ui.$('control-model-factice-precis'))
  await ui.waitFor(`!${ui.$('model-menu-content')}`)
}

const optionByName = (name) =>
  `[...document.querySelectorAll('[data-testid=roundtable-option]')].find((o) => o.querySelector('.roundtable-option-name')?.textContent === ${JSON.stringify(name)})`

/** Coche (ou décoche) un participant ; cherché dans « Autres modèles… » s'il n'est pas en tête. */
async function toggle(ui, name) {
  if (!(await ui.ev(`!!${optionByName(name)}`))) {
    if (await ui.ev(`!!${ui.$('roundtable-others')}`)) await ui.click(ui.$('roundtable-others'))
    await ui.waitFor(`!!${ui.$('roundtable-search')}`)
    await ui.ev(
      `(() => { const i = ${ui.$('roundtable-search')}; i.focus(); i.select(); return true })()`
    )
    await ui.type(name)
    await ui.waitFor(`!!${optionByName(name)}`)
  }
  await ui.click(optionByName(name))
}

/** Ouvre le menu des participants et coche ces participants (aucun avant). */
async function choose(ui, names) {
  if (!(await ui.ev(`!!${ui.$('roundtable-menu')}`)))
    await ui.click(ui.$('roundtable-participants'))
  await ui.waitFor(`!!${ui.$('roundtable-menu')}`)
  await ui.waitFor(`document.querySelectorAll('[data-testid=roundtable-option]').length > 0`)
  for (const name of names) await toggle(ui, name)
  await ui.key('Escape')
  await ui.waitFor(`!${ui.$('roundtable-menu')}`)
}

/**
 * La ligne du tour de table tient sur une ligne, sans rien de coupé, et le surcoût visible est
 * celui attendu (il contient le mot des jetons, en forme longue ou courte selon la largeur).
 */
const lineFits = (cost, label, { wrap = false } = {}) =>
  probes.custom(
    label,
    `const line = document.querySelector('[data-testid=roundtable-line]')
    if (!line) return { ok: false, detail: 'pas de ligne' }
    const r = line.getBoundingClientRect()
    const visible = (el) => !!el && getComputedStyle(el).display !== 'none' && el.getClientRects().length > 0
    const full = line.querySelector('[data-testid=roundtable-cost-full]')
    const short = line.querySelector('[data-testid=roundtable-cost-short]')
    const shown = [full, short].find(visible)
    const cut = [...line.querySelectorAll('*')].filter((el) => visible(el) && el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow !== 'visible').length
    const kids = [...line.children].filter(visible).map((el) => el.getBoundingClientRect())
    const oneRow = kids.every((k) => Math.abs(k.top + k.height / 2 - (kids[0].top + kids[0].height / 2)) < 6)
    const inside = kids.every((k) => k.right <= r.right + 1 && k.left >= r.left - 1)
    const text = shown?.textContent ?? ''
    return {
      ok: !!shown && text === ${JSON.stringify(cost)} && (oneRow || ${wrap}) && inside && cut === 0 && line.scrollWidth <= line.clientWidth + 1,
      detail: JSON.stringify({ text, oneRow, inside, cut, width: Math.round(r.width), scroll: line.scrollWidth })
    }`
  )

const rowOf = (name) =>
  `[...document.querySelectorAll('[data-testid=roundtable-row]')].find((r) => r.querySelector('[data-testid=roundtable-row-name]')?.textContent.startsWith(${JSON.stringify(name)}))`
const rowState = (name, state) => `${rowOf(name)}?.dataset.state === ${JSON.stringify(state)}`

export async function roundtableSuite(scheme) {
  console.log(`\n— Tour de table (${scheme})`)
  await nominal(scheme)
  await degraded(scheme)
  await restart(scheme)
}

/** 1. Journée nominale. */
async function nominal(scheme) {
  const workspace = repo()
  try {
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        await ui.closePanel()
        await arbiterModel(ui)

        // Premier usage : personne de retenu ; Entrée ouvre le menu au lieu d'envoyer.
        await ui.ev(`${ui.$('composer-input')}.focus()`)
        await ui.type('/roundtable Postgres seul, Redis ou un service géré ?')
        await ui.waitFor(`!!${ui.$('roundtable-line')}`)
        await affirm(ui, '285-premier-usage', [
          probes.custom(
            'ligne du premier usage, Envoyer atténué',
            `const line = document.querySelector('[data-testid=roundtable-line]')
            return { ok: line.textContent.includes(${JSON.stringify(L('roundtable.line.choose'))}) && document.querySelector('[data-testid=send]').disabled, detail: line.textContent }`
          )
        ])
        await ui.enter()
        await ui.waitFor(`!!${ui.$('roundtable-menu')}`)

        // Menu : 2 à 5 ; au-delà, les cases se désactivent et disent pourquoi.
        await ui.waitFor(`document.querySelectorAll('[data-testid=roundtable-option]').length > 0`)
        for (const name of ['Alpha', 'Beta', 'Gamma', PEER(), 'Delta']) await toggle(ui, name)
        await ui.waitFor(
          `${ui.$('roundtable-participants')}.textContent.includes(${JSON.stringify(L('roundtable.line.participants', { count: 5 }))})`
        )
        await affirm(ui, '285-participants', [
          probes.custom(
            'cinq cochés, les autres désactivés avec leur raison',
            `const opts = [...document.querySelectorAll('[data-testid=roundtable-option]')]
            const off = opts.filter((o) => o.getAttribute('aria-selected') !== 'true')
            return { ok: opts.filter((o) => o.getAttribute('aria-selected') === 'true').length === 5 && off.length > 0 && off.every((o) => o.getAttribute('aria-disabled') === 'true' && o.title === ${JSON.stringify(L('roundtable.menu.full'))}), detail: off.map((o) => o.textContent + ':' + o.getAttribute('aria-disabled')).join(', ') }`
          ),
          probes.custom(
            'aucune mention de gratuité ni de prix',
            `const t = document.querySelector('[data-testid=roundtable-menu]').textContent
            return { ok: !/gratuit|free|\\$/i.test(t), detail: t.slice(0, 200) }`
          )
        ])
        // Delta (qui écrit) sert aux cas dégradés : quatre participants ici.
        await toggle(ui, 'Delta')
        await ui.key('Escape')
        await ui.waitFor(`!${ui.$('roundtable-menu')}`)
        await ui.waitFor(`document.activeElement === ${ui.$('composer-input')}`, 3000)
        check(true, 'Échap : focus rendu à la saisie')

        // Ligne prête, mesurée à trois largeurs : « jetons » jamais coupé, rien ne déborde.
        await ui.waitFor(`!!${ui.$('roundtable-cost-full')}`)
        await affirm(ui, '285-lancement-pret', [
          lineFits(L('roundtable.cost.full', { n: 5 }), 'surcoût entier, sur une ligne'),
          // Gris discret mais lisible, en clair comme en sombre (ADR-0071).
          probes.contrast('[data-testid=roundtable-cost-full]', 3, 'surcoût lisible'),
          probes.contrast('[data-testid=roundtable-participants]', 4.5, 'bouton des participants')
        ])
        await ui.viewport(640)
        await affirm(ui, '285-fenetre-etroite', [
          lineFits(L('roundtable.cost.short', { n: 5 }), 'forme courte en saisie étroite')
        ])
        await ui.viewport(480)
        await affirm(ui, '285-fenetre-tres-etroite', [
          // Plus étroite que la forme courte : elle passe à la ligne, entière, sans rien couper.
          lineFits(L('roundtable.cost.short', { n: 5 }), 'très étroite : rien de coupé', {
            wrap: true
          }),
          probes.computed('.roundtable-plus', 'display', 'none')
        ])
        await ui.viewport()

        // Lancement : Entrée envoie ; une seule bulle, la question n'est pas un message envoyé.
        await ui.ev(`${ui.$('composer-input')}.focus()`)
        await ui.enter()
        await ui.waitFor(`!!${ui.$('roundtable-card')}`, 20_000)
        check(
          (await ui.ev(`document.querySelectorAll('[data-testid=roundtable-bubble]').length`)) ===
            1 &&
            !(await ui.ev(
              `[...document.querySelectorAll('[data-testid=user-message]')].some((m) => m.textContent.includes('Postgres seul'))`
            )),
          'une seule bulle pour la question'
        )
        // La saisie se vide et revient à une question simple (elle passe de l'accueil au fil).
        await ui.waitFor(
          `${ui.$('composer-input')}?.value === '' && !document.querySelector('.composer [data-testid=roundtable-tag]')`,
          5000
        )
        check(true, 'saisie vidée, revenue à une question simple')
        await affirm(ui, '285-carte-en-cours', [
          probes.inWidth('[data-testid=roundtable-card]', 'carte dans la colonne'),
          probes.custom(
            'quatre lignes',
            `return { ok: document.querySelectorAll('[data-testid=roundtable-row]').length === 4 }`
          )
        ])

        // Synthèse automatique malgré l'erreur de Gamma ; la carte se replie.
        await ui.waitFor(`!!${ui.$('roundtable-answer-label')}`, 60_000)
        await ui.waitFor(`${ui.$('roundtable-card')}?.dataset.collapsed === 'true'`, 60_000)
        await ui.waitFor(`!!${ui.$('roundtable-actions')}`, 60_000)
        check(
          (await ui.ev(`${ui.$('roundtable-request')}.textContent`)).includes(
            L('roundtable.synthesis.requested', { count: 3 })
          ),
          'synthèse : « Synthèse demandée · 3 avis »'
        )
        await affirm(ui, '285-apres-synthese', [
          probes.custom(
            'carte repliée en une ligne, « Consommé »',
            `const card = document.querySelector('[data-testid=roundtable-card]')
            return { ok: !card.querySelector('[data-testid=roundtable-row]') && !!card.querySelector('[data-testid=roundtable-used]'), detail: card.textContent }`
          ),
          probes.threadFits()
        ])

        // Avis rouverts : format non suivi, l'erreur dite, l'avis entier déplié.
        await ui.click(ui.$('roundtable-head-toggle'))
        await ui.waitFor(`document.querySelectorAll('[data-testid=roundtable-row]').length === 4`)
        check(
          await ui.ev(
            `${rowOf('Beta')}.textContent.includes(${JSON.stringify(L('roundtable.formatNotFollowed'))})`
          ),
          'avis hors format : « format non suivi »'
        )
        check(await ui.ev(rowState('Gamma', 'error')), 'participant en erreur dit sur sa ligne')
        await ui.click(`${rowOf('Alpha')}.querySelector('[data-testid=roundtable-row-toggle]')`)
        await ui.waitFor(`!!${rowOf('Alpha')}.querySelector('[data-testid=roundtable-row-open]')`)
        await affirm(ui, '285-avis', [probes.threadFits()])

        // Lettres : le vrai nom au survol, et au focus seul.
        const letter = ui.$('roundtable-letter')
        await ui.ev(`${letter}.scrollIntoView({ block: 'center' })`)
        await ui.hover(await ui.center(letter))
        await ui.waitFor(`!!document.querySelector('[role=tooltip]')`, 5000)
        await affirm(ui, '285-synthese-lettre', [
          probes.custom(
            'infobulle : un vrai nom',
            `const t = document.querySelector('[role=tooltip]')?.textContent ?? ''
            return { ok: ['Alpha', 'Beta', ${JSON.stringify(PEER())}].some((n) => t.includes(n)), detail: t }`
          )
        ])
        await ui.hover({ x: 2, y: 400 })
        await ui.waitFor(`!document.querySelector('[role=tooltip]')`, 5000)
        // Au clavier (modalité clavier : focus visible), sans pointeur.
        await ui.key('Shift')
        await ui.ev(`${letter}.focus()`)
        await ui.waitFor(`!!document.querySelector('[role=tooltip]')`, 5000)
        check(true, 'lettre : infobulle au focus seul')

        // Réplique, puis décision ; « Demander de l'appliquer » envoie un message ordinaire.
        await ui.click(ui.$('roundtable-rebut'))
        await ui.waitFor(`!!${ui.$('roundtable-rebuttal')}`, 30_000)
        await ui.waitFor(
          `document.querySelectorAll('[data-testid=roundtable-answer-label]').length === 2`,
          60_000
        )
        await ui.waitFor(`!!${ui.$('roundtable-apply')}`, 60_000)
        await affirm(ui, '285-replique-decision', [probes.threadFits()])
        await ui.click(ui.$('roundtable-apply'))
        await ui.waitFor(
          `[...document.querySelectorAll('[data-testid=user-message]')].some((m) => m.textContent.includes(${JSON.stringify(L('roundtable.synthesis.applyDraft'))}))`,
          20_000
        )
        await ui.ready()
      },
      undefined,
      'synthese-tour-de-table',
      env(workspace)
    )
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
}

/** 2. Cas dégradés. */
async function degraded(scheme) {
  const workspace = repo()
  try {
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        await ui.closePanel()
        await arbiterModel(ui)
        await ui.ev(`${ui.$('composer-input')}.focus()`)
        await ui.type('/roundtable Que vaut ce plan ?')
        await ui.waitFor(`!!${ui.$('roundtable-line')}`)
        // Lent (B), en erreur, refusé, qui écrit, sain.
        await choose(ui, [PEER(), 'Gamma', 'Zeta', 'Delta', 'Alpha'])
        await ui.ev(`${ui.$('composer-input')}.focus()`)
        await ui.enter()
        await ui.waitFor(`!!${ui.$('roundtable-card')}`, 20_000)

        // Modèle refusé : dit, sans substitution ; « Choisir un autre modèle » ouvre le menu.
        await ui.waitFor(`!!${ui.$('roundtable-other-model')}`, 30_000)
        check(
          await ui.ev(
            `${rowOf('Zeta')}.textContent.includes(${JSON.stringify(L('roundtable.state.modelNotOffered', { agent: L('profiles.mock.label') }))})`
          ),
          'modèle refusé : « Modèle non proposé… »'
        )
        await affirm(ui, '285-modele-refuse', [probes.threadFits()])
        await ui.click(ui.$('roundtable-other-model'))
        await ui.waitFor(`!!${ui.$('roundtable-menu')}`)
        await ui.key('Escape')
        await ui.waitFor(`!${ui.$('roundtable-menu')}`)

        // Erreur puis « Relancer » (pendant que B travaille encore).
        await ui.waitFor(
          `!!${rowOf('Gamma')}?.querySelector('[data-testid=roundtable-relaunch]')`,
          30_000
        )
        await affirm(ui, '285-erreur', [probes.threadFits()])
        // Relance acceptée (aucun refus), le participant repart dans sa conversation et échoue encore.
        await ui.click(`${rowOf('Gamma')}.querySelector('[data-testid=roundtable-relaunch]')`)
        await ui.waitFor(
          `!${ui.$('roundtable-gesture-refusal')} && ${rowState('Gamma', 'error')} && !!${rowOf('Gamma')}.querySelector('[data-testid=roundtable-relaunch]')`,
          30_000
        )
        check(true, 'relance acceptée : le participant repart, puis échoue de nouveau')

        // Dossier modifié par un participant qui écrit sans demander.
        await ui.waitFor(
          `!!${rowOf('Delta')}?.querySelector('[data-testid=roundtable-changed]')`,
          30_000
        )
        await affirm(ui, '285-dossier-modifie', [probes.threadFits()])

        // « Synthétiser sans attendre » : B, lent, est arrêté.
        await ui.waitFor(`!!${ui.$('roundtable-synthesize')}`, 30_000)
        await ui.click(ui.$('roundtable-synthesize'))
        await ui.waitFor(rowState(PEER(), 'stopped'), 20_000)
        check(
          await ui.ev(
            `${rowOf(PEER())}.textContent.includes(${JSON.stringify(L('roundtable.state.stopped.early-synthesis'))})`
          ),
          'synthèse sans attendre : le lent arrêté'
        )
        await ui.waitFor(`!!${ui.$('roundtable-actions')}`, 60_000)

        // Un second tour, arrêté en entier.
        await ui.ev(`${ui.$('composer-input')}.focus()`)
        await ui.type('/roundtable Et maintenant ?')
        await ui.waitFor(`!!${ui.$('roundtable-cost-full')}`)
        await ui.enter()
        const second = `document.querySelectorAll('[data-testid=roundtable-card]')[1]`
        await ui.waitFor(`!!${second}?.querySelector('[data-testid=roundtable-stop]')`, 20_000)
        await ui.click(`${second}.querySelector('[data-testid=roundtable-stop]')`)
        await ui.waitFor(`${second}.dataset.phase === 'stopped'`, 20_000)
        await affirm(ui, '285-arrete', [probes.threadFits()])
      },
      undefined,
      'synthese-tour-de-table',
      env(workspace, {
        MOCK_AGENT_SCENARIO_BY_MODEL: BY_MODEL('avis-lent'),
        MOCK_AGENT_WRITES: 'silent',
        // Le lent le reste le temps des gestes (100 pas de 150 ms) ; les autres scénarios du tour
        // ne font qu'un ou deux pas.
        MOCK_AGENT_DELAY_MS: '150'
      })
    )
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
}

/** 3. Redémarrage en plein recueil. */
async function restart(scheme) {
  const workspace = repo()
  const userData = mkdtempSync(join(tmpdir(), 'bob-e2e-tour-de-table-data-'))
  const extra = env(workspace, {
    MOCK_AGENT_SCENARIO_BY_MODEL: BY_MODEL('avis-lent'),
    MOCK_AGENT_DELAY_MS: '150'
  })
  try {
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        await ui.closePanel()
        await arbiterModel(ui)
        await ui.ev(`${ui.$('composer-input')}.focus()`)
        await ui.type('/roundtable Avant le redémarrage')
        await ui.waitFor(`!!${ui.$('roundtable-line')}`)
        await choose(ui, [PEER(), 'Alpha'])
        await ui.ev(`${ui.$('composer-input')}.focus()`)
        await ui.enter()
        await ui.waitFor(rowState(PEER(), 'working'), 20_000)
        // L'app quitte pendant que B travaille encore.
      },
      userData,
      'synthese-tour-de-table',
      extra
    )
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        // L'app rouvre sur une conversation neuve : retour à celle du tour.
        const tour = `[...document.querySelectorAll('.history-item')].find((h) => h.textContent.includes('Avant le redémarrage'))`
        await ui.waitFor(`!!${tour}`, 10_000)
        await ui.click(tour)
        await ui.waitFor(`${ui.$('roundtable-card')}?.dataset.phase === 'interrupted'`, 20_000)
        check(
          await ui.ev(
            `${rowOf(PEER())}.textContent.includes(${JSON.stringify(L('roundtable.state.stopped.restart'))})`
          ),
          'redémarrage : « Arrêté (redémarrage) »'
        )
        check(!(await ui.ev(`!!${ui.$('roundtable-answer-label')}`)), 'rien ne repart seul')
        await affirm(ui, '285-redemarrage', [probes.threadFits()])
        await ui.click(ui.$('roundtable-resume'))
        await ui.waitFor(`${ui.$('roundtable-card')}?.dataset.phase !== 'interrupted'`, 20_000)
        check(true, '« Reprendre » relance le participant arrêté')
      },
      userData,
      'synthese-tour-de-table',
      extra
    )
  } finally {
    rmSync(workspace, { recursive: true, force: true })
    rmSync(userData, { recursive: true, force: true })
  }
}
