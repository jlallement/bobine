import { execFileSync } from 'node:child_process'
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { affirm, probes } from '../affirm.mjs'
import { L, check, withApp } from '../lib.mjs'
import { lifecycle } from './tour-de-table-vie.mjs'

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
 * 2 ter. Vie des participants (`tour-de-table-vie.mjs`) : arrêt lent (« arrêt en cours »), barre
 *    latérale pendant et après le tour, corbeille et restauration, synthèse retenue par le plafond.
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
  'fx/zeta=Fx/Zeta',
  'fx/omega=Fx/Omega',
  'fx/sigma=Fx/Sigma'
].join(',')

/** Scénario de chaque modèle ; « Factice précis » (la conversation) joue la synthèse. */
export const BY_MODEL = (rapide = 'avis-participant') =>
  [
    `factice-rapide=${rapide}`,
    'fx/alpha=avis-participant',
    'fx/beta=avis-hors-format',
    'fx/gamma=avis-erreur',
    'fx/delta=participant-ecrit',
    'fx/omega=participant-outils',
    'fx/sigma=avis-change-modele'
  ].join(',')

export const PEER = () => L('profiles.mockPeer.label')

/** Dépôt git jetable (la lecture seule seulement demandée y est surveillée). */
export function repo() {
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

export const env = (workspace, extra = {}) => ({
  BOBINE_WORKSPACE: workspace,
  BOBINE_MOCK_PEER: '1',
  MOCK_MODELS: MODELS,
  MOCK_AGENT_SCENARIO_BY_MODEL: BY_MODEL(),
  MOCK_AGENT_REFUSE_MODEL: 'fx/zeta',
  ...extra
})

/** La conversation arbitre avec « Factice précis » (ses participants gardent leurs modèles). */
export async function arbiterModel(ui) {
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
export async function choose(ui, names) {
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
const lineFits = (cost, label) =>
  probes.custom(
    label,
    `const line = document.querySelector('[data-testid=roundtable-line]')
    if (!line) return { ok: false, detail: 'pas de ligne' }
    const r = line.getBoundingClientRect()
    const visible = (el) => !!el && getComputedStyle(el).display !== 'none' && el.getClientRects().length > 0
    const forms = ['full', 'short', 'tiny'].map((f) => line.querySelector('[data-testid=roundtable-cost-' + f + ']'))
    const shown = forms.find(visible)
    const costText = line.querySelector('[data-testid=roundtable-cost]')?.textContent ?? ''
    const cut = [...line.querySelectorAll('*')].filter((el) => visible(el) && el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow !== 'visible').length
    const kids = [...line.children].filter(visible).map((el) => el.getBoundingClientRect())
    const oneRow = kids.every((k) => Math.abs(k.top + k.height / 2 - (kids[0].top + kids[0].height / 2)) < 6) && r.height < 30
    // Le bouton des participants déborde de 4 px à gauche par sa marge négative (fond au survol).
    const inside = kids.every((k) => k.right <= r.right + 1 && k.left >= r.left - 6)
    const text = shown?.textContent ?? ''
    const plus = costText.includes(${JSON.stringify(L('roundtable.line.plusSynthesis'))})
    return {
      ok: !!shown && [${[]
        .concat(cost)
        .map((c) => JSON.stringify(c))
        .join(
          ', '
        )}].includes(text) && plus && oneRow && inside && cut === 0 && line.scrollWidth <= line.clientWidth + 1,
      detail: JSON.stringify({ text, plus, oneRow, inside, cut, width: Math.round(r.width), scroll: line.scrollWidth })
    }`
  )

export const rowOf = (name) =>
  `[...document.querySelectorAll('[data-testid=roundtable-row]')].find((r) => r.querySelector('[data-testid=roundtable-row-name]')?.textContent.startsWith(${JSON.stringify(name)}))`
export const rowState = (name, state) =>
  `${rowOf(name)}?.dataset.state === ${JSON.stringify(state)}`

export async function roundtableSuite(scheme) {
  console.log(`\n— Tour de table (${scheme})`)
  await nominal(scheme)
  await degraded(scheme)
  await guarded(scheme)
  await lifecycle(scheme)
  await restart(scheme)
}

/**
 * 2 bis. Garde-fous du moteur : question trop longue dite avant l'envoi ; participant qui n'a aucun
 * outil de l'app et dont la commande est refusée d'office (jamais « attend votre réponse ») ;
 * modèle changé par l'agent en plein tour, avis écarté « modèle non appliqué ».
 */
async function guarded(scheme) {
  const workspace = repo()
  try {
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        await ui.closePanel()
        await arbiterModel(ui)
        await ui.ev(`${ui.$('composer-input')}.focus()`)
        await ui.type(`/roundtable ${'Trop long. '.repeat(800)}`)
        await ui.waitFor(`!!${ui.$('roundtable-line')}`)
        await choose(ui, ['Omega', 'Sigma', 'Alpha'])
        await ui.waitFor(`!!${ui.$('roundtable-too-long')}`)
        await affirm(ui, '285-question-trop-longue', [
          probes.custom(
            'la ligne le dit, Envoyer atténué',
            `return { ok: document.querySelector('[data-testid=roundtable-too-long]').textContent === ${JSON.stringify(L('roundtable.error.question'))} && document.querySelector('[data-testid=send]').disabled }`
          )
        ])
        await ui.ev(`${ui.$('composer-input')}.focus()`)
        await ui.enter()
        check(!(await ui.ev(`!!${ui.$('roundtable-card')}`)), 'question trop longue : rien ne part')

        // Raccourcie : le tour part.
        await ui.ev(
          `(() => { const i = ${ui.$('composer-input')}; i.focus(); i.select(); return true })()`
        )
        await ui.type('Une question courte ?')
        await ui.waitFor(`!!${ui.$('roundtable-cost-full')}`)
        await ui.enter()
        await ui.waitFor(`!!${ui.$('roundtable-card')}`, 20_000)

        // Modèle changé en plein tour : l'avis est écarté, la raison traduite.
        await ui.waitFor(rowState('Sigma', 'error'), 30_000)
        check(
          await ui.ev(
            `${rowOf('Sigma')}.querySelector('[data-testid=roundtable-row-meta]').textContent.includes(${JSON.stringify(L('roundtable.state.reason.model-not-applied'))})`
          ),
          'modèle changé en plein tour : « modèle non appliqué »'
        )
        // Participant aux outils : fini sans jamais attendre l'utilisateur, aucune carte d'accord.
        await ui.waitFor(`${rowOf('Omega')}?.dataset.state === 'answered'`, 30_000)
        check(
          !(await ui.ev(`!!document.querySelector('[data-testid=permission]')`)) &&
            !(await ui.ev(
              `[...document.querySelectorAll('.history-item')].some((h) => h.querySelector('.status-dot.needs-action, [data-attention=request]'))`
            )),
          'participant : commande refusée d’office, aucune carte d’autorisation'
        )
        await ui.waitFor(`!!${ui.$('roundtable-actions')}`, 60_000)
        await ui.click(ui.$('roundtable-head-toggle'))
        await ui.waitFor(`!!${rowOf('Sigma')}`)
        await affirm(ui, '285-garde-fous', [probes.threadFits()])

        // Conversation archivée (M11) : la carte se lit, ni « Appliquer » ni « Faire réagir ».
        check(!!(await ui.ev(`!!${ui.$('roundtable-apply')}`)), 'avant l’archivage : « Appliquer »')
        await ui.ev(
          `window.api.conversations.get().then((s) => window.api.conversations.archive(s.activeId, true)).then(() => true)`
        )
        await ui.waitFor(`!${ui.$('roundtable-apply')} && !${ui.$('roundtable-rebut')}`, 10_000)
        check(true, 'archivée : ni « Appliquer » ni « Faire réagir »')
      },
      undefined,
      'synthese-tour-de-table',
      env(workspace)
    )
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
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
        await toggle(ui, 'Alpha')
        // Un seul coché : il en faut au moins deux (M13).
        await ui.waitFor(
          `${ui.$('roundtable-choose-hint')}?.textContent === ${JSON.stringify(L('roundtable.line.needTwo'))}`
        )
        check(true, 'un seul participant : « il en faut au moins 2 »')
        for (const name of ['Beta', 'Gamma', PEER(), 'Delta']) await toggle(ui, name)
        await ui.waitFor(
          `${ui.$('roundtable-participants')}.getAttribute('aria-label') === ${JSON.stringify(L('roundtable.line.participants', { count: 5 }))}`
        )
        // La recherche filtre la liste : vidée, toutes les cases reviennent.
        if (await ui.ev(`!!${ui.$('roundtable-search')}`)) {
          // Champ contrôlé par React : valeur posée par le setter natif, puis l'évènement « input ».
          await ui.ev(`(() => {
            const i = ${ui.$('roundtable-search')}
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, '')
            i.dispatchEvent(new Event('input', { bubbles: true }))
            return true
          })()`)
          await ui.waitFor(
            `document.querySelectorAll('[data-testid=roundtable-option]').length > 5`
          )
        }
        await affirm(ui, '285-participants', [
          probes.custom(
            'cinq cochés, les autres désactivés avec leur raison (dont l’arbitre)',
            // Seulement les agents de l'essai : ce qui est installé sur la machine (Bob, OpenCode)
            // ne change pas le résultat (un agent absent n'est pas proposé du tout).
            `const mine = [${JSON.stringify(L('profiles.mock.label'))}, ${JSON.stringify(PEER())}]
            const opts = [...document.querySelectorAll('[data-testid=roundtable-option]')].filter((o) => mine.some((m) => o.textContent.includes(m)) || !!o.querySelector('[data-testid=roundtable-option-reason]'))
            const off = opts.filter((o) => o.getAttribute('aria-selected') !== 'true')
            return { ok: opts.filter((o) => o.getAttribute('aria-selected') === 'true').length === 5 && off.length > 0 && off.every((o) => o.getAttribute('aria-disabled') === 'true' && [${JSON.stringify(L('roundtable.menu.full'))}, ${JSON.stringify(L('roundtable.menu.arbiter'))}].includes(o.title)) && off.some((o) => o.title === ${JSON.stringify(L('roundtable.menu.arbiter'))}), detail: off.map((o) => o.textContent + ':' + o.getAttribute('aria-disabled')).join(', ') }`
          ),
          probes.custom(
            'aucune mention de gratuité ni de prix',
            `const t = document.querySelector('[data-testid=roundtable-menu]').textContent
            return { ok: !/gratuit|free|\\$/i.test(t), detail: t.slice(0, 200) }`
          )
        ])
        // Rien ne glisse sous le pointeur (A2) : une ligne reste à sa place quand on la décoche.
        const slide = `(() => { const o = ${optionByName('Delta')}; const m = document.querySelector('[data-testid=roundtable-menu]'); const l = document.querySelector('[data-testid=roundtable-menu-list]'); return { top: o.getBoundingClientRect().top, menu: Math.round(m.getBoundingClientRect().top), h: Math.round(m.getBoundingClientRect().height), scroll: l.scrollTop, n: l.children.length, search: !!document.querySelector('[data-testid=roundtable-search]') } })()`
        await ui.ev(
          `(() => { ${optionByName('Delta')}.scrollIntoView({ block: 'center' }); return true })()`
        )
        const at = await ui.ev(slide)
        // Delta (qui écrit) sert aux cas dégradés : quatre participants ici.
        await toggle(ui, 'Delta')
        const after = await ui.ev(slide)
        check(
          Math.abs(at.top - after.top) < 1,
          `menu : la ligne décochée reste sous le pointeur (${JSON.stringify(at)} → ${JSON.stringify(after)})`
        )
        // Le menu ne couvre pas la question : son bas au-dessus de la saisie (A2).
        check(
          await ui.ev(
            `${ui.$('roundtable-menu')}.getBoundingClientRect().bottom <= document.querySelector('.composer').getBoundingClientRect().top + 1`
          ),
          'menu ancré au-dessus de la saisie'
        )
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
        // Quatre largeurs (A1) : une ligne, « + synthèse » et « jetons » toujours là, rien de coupé.
        await ui.viewport(760)
        await affirm(ui, '285-fenetre-760', [
          lineFits(L('roundtable.cost.short', { n: 5 }), '760 px : forme courte')
        ])
        await ui.viewport(640)
        await affirm(ui, '285-fenetre-etroite', [
          lineFits(
            [L('roundtable.cost.short', { n: 5 }), L('roundtable.cost.tiny', { n: 5 })],
            '640 px : une forme courte'
          )
        ])
        await ui.viewport(520)
        await affirm(ui, '285-fenetre-520', [
          lineFits(L('roundtable.cost.tiny', { n: 5 }), '520 px : « ≥ 5× jetons », la plus courte'),
          probes.custom(
            '« 5 ▾ » : le compte seul à l’écran, le nom entier pour le lecteur d’écran',
            `const p = document.querySelector('[data-testid=roundtable-participants]')
            return { ok: getComputedStyle(p.querySelector('.roundtable-pick-short')).display !== 'none' && getComputedStyle(p.querySelector('.roundtable-pick-full')).display === 'none' && p.getAttribute('aria-label') === ${JSON.stringify(L('roundtable.line.participants', { count: 4 }))} }`
          )
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
          ),
          // Le pied sur une rangée, « Arrêter » en rouge (A3).
          probes.custom(
            'pied sur une rangée, « Arrêter » en rouge',
            `const foot = document.querySelector('[data-testid=roundtable-foot]')
            const kids = [...foot.children].map((c) => c.getBoundingClientRect()).filter((r) => r.width > 0)
            const mid = kids.map((r) => r.top + r.height / 2)
            const stop = document.querySelector('[data-testid=roundtable-stop]')
            const red = stop && getComputedStyle(stop).color === getComputedStyle(document.documentElement).getPropertyValue('--err').trim()
            return { ok: Math.max(...mid) - Math.min(...mid) <= 3, detail: mid.map(Math.round).join(', ') + ' · rouge ' + red }`
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
        // Fenêtre étroite (B7) : la carte tient, la méta passe sous le nom.
        for (const width of [760, 520]) {
          await ui.viewport(width)
          await affirm(ui, `285-carte-${width}`, [
            probes.threadFits(),
            probes.custom(
              'titre « Tour de table » sur une ligne, le résumé se réduit',
              `const t = [...document.querySelectorAll('[data-testid=roundtable-card] .work-group-title')]
              const lines = t.map((el) => { const cs = getComputedStyle(el); return Math.round(el.getBoundingClientRect().height / (parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.3)) })
              return { ok: t.length > 0 && lines.every((n) => n === 1), detail: JSON.stringify(lines) }`
            )
          ])
        }
        await ui.viewport()

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
        // Au clavier (focus visible), sans pointeur : Tab jusqu'à la lettre.
        await ui.ev(`(() => { document.activeElement?.blur(); return true })()`)
        for (let i = 0; i < 200 && !(await ui.ev(`document.activeElement === ${letter}`)); i++)
          await ui.press('Tab')
        check(
          await ui.ev(`document.activeElement === ${letter}`),
          `lettre atteinte au clavier (${await ui.ev(`document.activeElement?.outerHTML.slice(0, 120)`)})`
        )
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

        // Sommaire (S4) : le tour par sa question, marqué ; jamais les demandes de l'app.
        // Le sommaire a besoin de place à gauche du fil : panneau fermé.
        await ui.closePanel()
        await ui.waitFor(`!!${ui.$('outline')}`, 5000)
        const outline = await ui.ev(
          `[...document.querySelectorAll('[data-testid=outline-item]')].map((b) => ({ text: b.textContent, tour: b.dataset.roundtable === 'true' }))`
        )
        check(
          outline.some((o) => o.tour && o.text.includes('Postgres seul')) &&
            outline.every((o) => o.tour || !/^Roundtable:|Synthesize|rebuttal round/i.test(o.text)),
          `sommaire : le tour par sa question, sans demande interne (${JSON.stringify(outline)})`
        )
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
            `${rowOf('Zeta')}.textContent.includes(${JSON.stringify(L('roundtable.state.reason.model-not-applied'))})`
          ),
          'modèle refusé par l’agent : « modèle non appliqué », sans substitution'
        )
        await affirm(ui, '285-modele-refuse', [probes.threadFits()])
        // Les lignes d'au-dessus changent de hauteur en arrivant à leur état (Gamma en erreur, sa
        // raison sur deux lignes ; Delta et sa marque « a modifié des fichiers ») : sur une machine
        // lente, cela arrivait entre l'appui et le relâché du clic (GitHub, Mac, sombre : appui sur
        // « Choisir un autre modèle », relâché sur la ligne de Gamma). On clique une fois la carte
        // posée : les participants rapides ont fini, seul le lent travaille.
        await ui.waitFor(
          `!!${rowOf('Gamma')}?.querySelector('[data-testid=roundtable-relaunch]') && !!${rowOf('Delta')}?.querySelector('[data-testid=roundtable-changed]') && ${rowState('Alpha', 'answered')}`,
          30_000
        )
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
