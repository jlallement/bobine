import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { L, NEUTRAL_ENV, check, withApp } from '../lib.mjs'

const CARD = `[...document.querySelectorAll('[data-testid=permission]')].at(-1)`
const IN_CARD = (testId) => `${CARD}?.querySelector('[data-testid=${testId}]')`

/**
 * Règles d'approbation pour tous les projets (fiche 215), contre l'agent factice qui les déclare
 * comme Bob, dans un dossier personnel jetable (`BOBINE_CONFIG_HOME`), jamais le vrai `~/.bob` :
 * IPC du preload, section « Pour tous les projets » des cartes de commande (autoriser, refuser,
 * commande enchaînée, préfixe d'un seul mot), page Réglages › Agents › <agent> › Approbations
 * (groupes, listes, groupe interdit, fichier illisible).
 */
export async function approvalRulesSuite(scheme) {
  console.log(`\n— Règles d’approbation de Bob (${scheme})`)
  const home = mkdtempSync(join(tmpdir(), 'bob-e2e-approval-home-'))
  const dir = join(home, '.bob', 'settings')
  const file = join(dir, 'settings.json')
  mkdirSync(dir, { recursive: true })
  writeFileSync(file, `${JSON.stringify({ telemetry: { enabled: false }, zz: 1 }, null, 2)}\n`)
  const settings = () => JSON.parse(readFileSync(file, 'utf8'))
  const call = (ui, expression) => ui.ev(`(async () => JSON.stringify(await ${expression}))()`)
  try {
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        await cardChecks(ui, settings)
        await terminalChecks(ui, settings, call)
        await pageChecks(ui, settings)
        await brokenFileChecks(ui, file)
      },
      undefined,
      'demo',
      { ...NEUTRAL_ENV, BOBINE_CONFIG_HOME: home, MOCK_AGENT_ALWAYS_SCOPE: 'bob' }
    )
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
}

async function cardChecks(ui) {
  // Commande déjà couverte par la liste par défaut de Bob (`git status`) : rien à proposer.
  await ui.send('/scenario commande-courte')
  await ui.waitFor(`!!${IN_CARD('global-rule-all-covered')}`)
  await ui.shot('215-k-carte-deja-autorisee')
  await ui.click(`${CARD}.querySelector('.pc-actions [data-kind=allow_once]')`)
  await ui.waitFor(`!document.querySelector('[data-testid=permission]')`)
  await ui.ready()

  // Commande simple : section repliée, commande entière, « première fois », un seul mot.
  await ui.send('/scenario commande-lint')
  await ui.waitFor(`!!${IN_CARD('global-rule-toggle')}`)
  await ui.shot('215-a-carte-repliee')
  await ui.click(IN_CARD('global-rule-toggle'))
  await ui.waitFor(`!!${IN_CARD('global-rule-prefix')}`)
  await ui.shot('215-b-carte-premiere-fois')
  await ui.ev(`${IN_CARD('global-rule-prefix')}.focus()`)
  await ui.ev(`${IN_CARD('global-rule-prefix')}.select()`)
  await ui.type('npm')
  await ui.waitFor(`!!${IN_CARD('global-rule-one-word')}`)
  await ui.shot('215-c-carte-un-seul-mot')
  await ui.ev(`${IN_CARD('global-rule-prefix')}.select()`)
  await ui.type('npm run lint')
  await ui.click(IN_CARD('global-rule-allow'))
  await ui.waitFor(`!!document.querySelector('[data-testid=global-rule-answer]')`)
  await ui.ready()
  check(
    (
      await ui.ev(
        `document.querySelector('[data-testid=global-rule-answer]').closest('[data-testid=permission-answer]').innerText`
      )
    ).includes(L('toolCall.permission.alwaysConversation')) &&
      (await ui.ev(
        `getComputedStyle(document.querySelector('.global-rule-manage')).textDecorationLine`
      )) === 'underline',
    'ligne de réponse : « Toujours dans cette conversation », « Gérer » souligné comme un lien'
  )
  await ui.shot('215-d-apres-autoriser-partout')

  // Commit au message entre guillemets avec parenthèses (recette QA) : deux parties proposées.
  await ui.send('/scenario commande-commit')
  await ui.waitFor(`!!${IN_CARD('global-rule-toggle')}`)
  await ui.click(IN_CARD('global-rule-toggle'))
  await ui.waitFor(`!!${IN_CARD('global-rule-prefix')}`)
  await ui.shot('215-n-carte-commit-parentheses')
  await ui.click(`${CARD}.querySelector('.pc-actions [data-kind=allow_once]')`)
  await ui.waitFor(`!document.querySelector('[data-testid=permission]')`)
  await ui.ready()

  // Commande enchaînée : une partie par champ, celles déjà couvertes (`wc`) ni cochables ni
  // écrites ; « Refuser partout » refuse aussi la carte.
  await ui.send('/scenario commande-bob')
  await ui.waitFor(`!!${IN_CARD('global-rule-toggle')}`)
  await ui.click(IN_CARD('global-rule-toggle'))
  await ui.waitFor(`!!${IN_CARD('global-rule-prefix')}`)
  // Seulement la dernière partie à cocher (`sed -i …`).
  for (let i = 0; i < 4; i++) {
    await ui.click(`${CARD}.querySelectorAll('[data-testid=global-rule-part-on]')[${i}]`)
  }
  await ui.shot('215-e-carte-enchainee')
  await ui.click(IN_CARD('global-rule-deny'))
  await ui.waitFor(`!!document.querySelectorAll('[data-testid=global-rule-answer]')[1]`)
  await ui.ready()
}

async function pageChecks(ui) {
  // « Gérer » mène à la page des approbations.
  await ui.click(
    `[...document.querySelectorAll('[data-testid=global-rule-answer] .link-button')].at(-1)`
  )
  await ui.waitFor(`!!${ui.$('approval-rules-page')}`)
  const group = (id) => `document.querySelector('[data-testid=approval-group][data-group=${id}]')`
  // Les groupes arrivent après le titre (règles lues dans le fichier de Bob).
  await ui.waitFor(`!!${group('execute')}`)
  await ui.click(`${group('todo')}.querySelector('.switch')`)
  await ui.waitFor(`${group('todo')}.querySelector('input').checked`)
  // Ajouter, modifier, retirer une commande autorisée.
  const allowed = `document.querySelector('[data-testid=approval-rules-allowed]')`
  await ui.ev(`${allowed}.querySelector('[data-testid=approval-rules-add-input]').focus()`)
  await ui.type('npm run lint')
  await ui.click(`${allowed}.querySelector('[data-testid=approval-rules-add]')`)
  const row = (c) =>
    `${allowed}.querySelector('[data-testid=approval-rules-command][data-command=${JSON.stringify(c)}]')`
  await ui.waitFor(`!!${row('npm run lint')}`)
  await ui.click(`${row('npm run lint')}.querySelector('[data-testid=approval-rules-edit]')`)
  await ui.waitFor(`!!${allowed}.querySelector('[data-testid=approval-rules-edit-input]')`)
  await ui.ev(`${allowed}.querySelector('[data-testid=approval-rules-edit-input]').select()`)
  await ui.type('npm run lint --fix')
  await ui.shot('215-f-reglages-modification')
  await ui.enter()
  await ui.waitFor(`!!${row('npm run lint --fix')}`)
  await ui.click(`${row('du')}.querySelector('[data-testid=approval-rules-remove]')`)
  await ui.waitFor(`!!${ui.$('confirm-row-confirm')}`)
  await ui.click(ui.$('confirm-row-confirm'))
  await ui.waitFor(`!${row('du')}`)
  await ui.shot('215-g-reglages-approbations')

  // Un seul mot aux autorisées : avertissement et confirmation, « Garder » n'écrit rien.
  await ui.ev(`${allowed}.querySelector('[data-testid=approval-rules-add-input]').focus()`)
  await ui.type('git')
  await ui.click(`${allowed}.querySelector('[data-testid=approval-rules-add]')`)
  await ui.waitFor(`!!${allowed}.querySelector('[data-testid=approval-rules-one-word]')`)
  await ui.ev(
    `${allowed}.querySelector('[data-testid=approval-rules-one-word]').scrollIntoView({ block: 'center' })`
  )
  await ui.shot('215-o-reglages-un-seul-mot')
  await ui.click(`${allowed}.querySelector('[data-testid=confirm-row-keep]')`)
  await ui.waitFor(`!${allowed}.querySelector('[data-testid=approval-rules-one-word]')`)

  // « Aussi hors du dossier » : l'effet sur l'interrupteur global est dit à l'endroit du clic.
  const outside = `${group('read')}.nextElementSibling`
  await ui.ev(`${outside}.scrollIntoView({ block: 'center' })`)
  await ui.shot('215-l-reglages-hors-dossier-effet')
  await ui.click(`${outside}.querySelector('.switch')`)
  await ui.waitFor(`${outside}.querySelector('input').checked`)
  await ui.click(`${outside}.querySelector('.switch')`)
  await ui.waitFor(`!!${ui.$('approval-outside-still-on')}`)
  await ui.ev(`${ui.$('approval-outside-still-on')}.scrollIntoView({ block: 'center' })`)
  await ui.shot('215-m-reglages-hors-dossier-reste-allume')
  await ui.click(ui.$('approval-outside-turn-off'))
  await ui.waitFor(`!${ui.$('approval-outside-still-on')}`)
}

/**
 * Recette QA (Bob 2.1.0) : après « Refuser partout », l'agent tente la commande par le terminal de
 * Bobine. Refusée par les règles de l'agent, sans question ni lancement, et c'est dit dans le fil.
 */
async function terminalChecks(ui, settings, call) {
  await call(
    ui,
    `window.api.approvalRules.change('mock', { type: 'addCommand', prefix: 'node --version', list: 'denied' })`
  )
  await ui.send('/scenario terminal-refusee-partout')
  await ui.ready()
  const thread = await ui.ev(`document.querySelector('[data-testid=thread]').innerText`)
  check(
    thread.includes(
      L('approvalRules.terminal.denied', { command: 'node --version' }).replace(/`/g, '')
    ) &&
      thread.includes('denied everywhere') &&
      !(await ui.ev(`!!document.querySelector('[data-testid=questions]')`)),
    'terminal de Bobine : commande refusée partout, ni question ni lancement, dit dans le fil'
  )
  await ui.shot('215-p-terminal-refusee-partout')
}

async function brokenFileChecks(ui, file) {
  // Groupe interdit par l'administration : grisé, avec sa raison.
  const data = JSON.parse(readFileSync(file, 'utf8'))
  data.approval.forbiddenApprovalGroups = ['edit']
  writeFileSync(file, JSON.stringify(data, null, 2))
  await reopenPage(ui)
  const edit = `document.querySelector('[data-testid=approval-group][data-group=edit]')`
  await ui.waitFor(`!!${edit}`)
  await ui.shot('215-h-reglages-groupe-interdit')
  // Fichier illisible : bandeau, « Relire », rien d'autre.
  writeFileSync(file, '{\n  "approval": {\n    "allowed_permissions": ["read"],\n  }\n}\n')
  await reopenPage(ui)
  await ui.waitFor(`!!${ui.$('approval-rules-unreadable')}`)
  await ui.shot('215-i-reglages-illisible')
  writeFileSync(file, readFileSync(file, 'utf8').replace('["read"],', '["read"]'))
  await ui.click(ui.$('approval-rules-reload'))
  await ui.waitFor(`!!${ui.$('approval-rules-groups')}`)
  await ui.key('Escape')
}

/** Revient à la page de l'agent puis aux approbations : les règles sont relues. */
async function reopenPage(ui) {
  await ui.click(ui.$('settings-agent-back'))
  await ui.waitFor(`!!${ui.$('agent-open-approvals')}`)
  await ui.waitFor(
    `${ui.$('settings-heading')}?.innerText === ${ui.$('settings-agent-page')}?.querySelector('.agent-head-name')?.innerText`
  )
  // Page de l'agent : l'entrée « Approbations pour tous les projets ».
  await ui.ev(`${ui.$('agent-open-approvals')}.scrollIntoView({ block: 'center' })`)
  await ui.shot('215-j-page-agent')
  await ui.click(ui.$('agent-open-approvals'))
  await ui.waitFor(`!!${ui.$('approval-rules-page')}`)
}
