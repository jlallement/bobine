import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { L, NEUTRAL_ENV, check, withApp } from '../lib.mjs'
import { BOB_LONG_COMMAND } from '../../src/mock-agent/scenarios-commandes.mts'

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
        await ipcChecks(ui, call)
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

/** L'IPC seul : lecture, refus d'un changement mal formé, profil sans règles. */
async function ipcChecks(ui, call) {
  const read = JSON.parse(await call(ui, `window.api.approvalRules.get('mock')`))
  check(
    read.ok && read.rules.commands.defaultList && read.rules.file.endsWith('settings.json'),
    `IPC : lecture, liste par défaut signalée (${read.ok ? read.rules.file : read.error.code})`
  )
  const refused = await call(
    ui,
    `window.api.approvalRules.change('mock', { type: 'setGroup', group: 'root', enabled: true }).then(() => 'accepté', () => 'refusé')`
  )
  check(refused === '"refusé"', 'IPC : changement mal formé venu du renderer, refusé')
  const unsupported = JSON.parse(await call(ui, `window.api.approvalRules.get('profil-inconnu')`))
  check(
    !unsupported.ok && unsupported.error.code === 'unsupported',
    'IPC : profil sans règles, « unsupported »'
  )
}

async function cardChecks(ui, settings) {
  // Commande déjà couverte par la liste par défaut de Bob (`git status`) : rien à proposer.
  await ui.send('/scenario commande-courte')
  await ui.waitFor(`!!${IN_CARD('global-rule-all-covered')}`)
  check(
    !(await ui.ev(`!!${IN_CARD('global-rule-toggle')}`)) &&
      (await ui.ev(`${IN_CARD('global-rule-all-covered')}.innerText`)).includes(
        L('approvalRules.card.coveredAllowed', { command: 'git status --short' }).replace(/`/g, '')
      ),
    'commande couverte par la liste par défaut : « déjà autorisée partout · Gérer », pas de section'
  )
  await ui.shot('215-k-carte-deja-autorisee')
  await ui.click(`${CARD}.querySelector('.pc-actions [data-kind=allow_once]')`)
  await ui.waitFor(`!document.querySelector('[data-testid=permission]')`)
  await ui.ready()

  // Commande simple : section repliée, commande entière, « première fois », un seul mot.
  await ui.send('/scenario commande-lint')
  await ui.waitFor(`!!${IN_CARD('global-rule-toggle')}`)
  check(
    (await ui.ev(`${IN_CARD('global-rule-toggle')}.getAttribute('aria-expanded')`)) === 'false' &&
      (await ui.ev(`${IN_CARD('global-rule-toggle')}.innerText`)).includes(
        L('approvalRules.card.toggle')
      ),
    'carte : « Pour tous les projets » replié en pied de carte'
  )
  await ui.shot('215-a-carte-repliee')
  await ui.click(IN_CARD('global-rule-toggle'))
  await ui.waitFor(`!!${IN_CARD('global-rule-prefix')}`)
  check(
    (await ui.ev(`${IN_CARD('global-rule-prefix')}.value`)) === 'npm run lint' &&
      !!(await ui.ev(`!!${IN_CARD('global-rule-first-time')}`)),
    'carte dépliée : commande entière proposée, encadré « première fois »'
  )
  // Une seule note de portée (déclarée par le profil) ; « Commandes de la liste » pas encore
  // permis : l'autorisation vaut à la prochaine conversation, le refus tout de suite (Bob 2.1.0).
  check(
    !(await ui.ev(`!!${IN_CARD('permission-agent-always-note')}`)) &&
      (await ui.ev(`${IN_CARD('permission-always-scope')}.querySelector('strong')?.innerText`)) ===
        L('profiles.mock.label') &&
      (await ui.ev(`${IN_CARD('global-rule-when')}.innerText`)) ===
        L('approvalRules.card.whenNext', {
          always: L('toolCall.permission.alwaysConversation'),
          reject: L('permissionOption.reject_once')
        }),
    'carte : une seule note de portée ; « Autoriser partout » à la prochaine conversation'
  )
  await ui.shot('215-b-carte-premiere-fois')
  await ui.ev(`${IN_CARD('global-rule-prefix')}.focus()`)
  await ui.ev(`${IN_CARD('global-rule-prefix')}.select()`)
  await ui.type('npm')
  await ui.waitFor(`!!${IN_CARD('global-rule-one-word')}`)
  check(
    (await ui.ev(`${IN_CARD('global-rule-one-word')}.innerText`)).includes('npm publish'),
    'préfixe d’un seul mot : avertissement avec un exemple'
  )
  await ui.shot('215-c-carte-un-seul-mot')
  await ui.ev(`${IN_CARD('global-rule-prefix')}.select()`)
  await ui.type('npm run lint')
  await ui.click(IN_CARD('global-rule-allow'))
  await ui.waitFor(`!!document.querySelector('[data-testid=global-rule-answer]')`)
  await ui.ready()
  const after = settings()
  check(
    after.zz === 1 &&
      after.approval.allowedExecutors[0].approvedCommands.includes('ls') &&
      after.approval.allowedExecutors[0].approvedCommands.at(-1) === 'npm run lint' &&
      JSON.stringify(after.approval.allowed_permissions) === '["read","execute"]' &&
      !('forbiddenApprovalGroups' in after.approval),
    'Autoriser partout : liste par défaut recopiée, execute ajouté, reste du fichier gardé'
  )
  check(
    (
      await ui.ev(
        `document.querySelector('[data-testid=global-rule-answer]').closest('[data-testid=permission-answer]').className`
      )
    ).includes('allowed'),
    'Autoriser partout : la carte reçoit aussi « toujours »'
  )
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
  const commit = await ui.ev(
    `[...${CARD}.querySelectorAll('[data-testid=global-rule-prefix]')].map((i) => i.value)`
  )
  check(
    JSON.stringify(commit) ===
      JSON.stringify(['git add -A', 'git commit -m "feat(calc): add add() and sub()"']),
    `commit avec parenthèses entre guillemets : deux parties (${JSON.stringify(commit)})`
  )
  check(
    (await ui.ev(`${IN_CARD('global-rule-when')}.innerText`)) ===
      L('approvalRules.card.whenNow', {
        always: L('toolCall.permission.alwaysConversation'),
        reject: L('permissionOption.reject_once')
      }),
    '« Commandes de la liste » déjà permis : autoriser et refuser partout valent tout de suite'
  )
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
  const parts = await ui.ev(
    `[...${CARD}.querySelectorAll('[data-testid=global-rule-prefix]')].map((i) => i.value)`
  )
  const covered = await ui.ev(
    `[...${CARD}.querySelectorAll('[data-testid=global-rule-covered]')].map((c) => c.innerText)`
  )
  check(
    parts.length === 5 &&
      parts[0] === 'seq 1 20000' &&
      covered.length === 1 &&
      covered[0].includes('wc -l gros.txt') &&
      covered[0].includes(L('approvalRules.card.alreadyAllowed')) &&
      (await ui.ev(`${CARD}.querySelectorAll('[data-testid=global-rule-part-on]').length`)) === 5,
    `commande enchaînée (${BOB_LONG_COMMAND.length} caractères) : 5 parties à cocher, « wc -l gros.txt » déjà autorisée`
  )
  check(
    !(await ui.ev(`!!${IN_CARD('global-rule-first-time')}`)),
    'execute déjà permis : plus d’encadré « première fois »'
  )
  // Seulement la dernière partie à cocher (`sed -i …`).
  for (let i = 0; i < 4; i++) {
    await ui.click(`${CARD}.querySelectorAll('[data-testid=global-rule-part-on]')[${i}]`)
  }
  await ui.shot('215-e-carte-enchainee')
  await ui.click(IN_CARD('global-rule-deny'))
  await ui.waitFor(`!!document.querySelectorAll('[data-testid=global-rule-answer]')[1]`)
  await ui.ready()
  const denied = settings().approval.allowedExecutors[0].deniedCommands
  check(
    JSON.stringify(denied) === JSON.stringify(["sed -i '' 's/numero/n°/' gros.txt"]) &&
      (
        await ui.ev(
          `[...document.querySelectorAll('[data-testid=global-rule-answer]')].at(-1).closest('[data-testid=permission-answer]').className`
        )
      ).includes('rejected'),
    `Refuser partout : la partie choisie seule, refusée partout, et la carte refusée (${JSON.stringify(denied)})`
  )
}

async function pageChecks(ui, settings) {
  // « Gérer » mène à la page des approbations.
  await ui.click(
    `[...document.querySelectorAll('[data-testid=global-rule-answer] .link-button')].at(-1)`
  )
  await ui.waitFor(`!!${ui.$('approval-rules-page')}`)
  check(
    (await ui.ev(`${ui.$('settings-heading')}.innerText`)) === L('approvalRules.page.title'),
    '« Gérer » : Réglages › Agents › agent › Approbations'
  )
  const group = (id) => `document.querySelector('[data-testid=approval-group][data-group=${id}]')`
  check(
    (await ui.ev(`${group('execute')}.querySelector('input').checked`)) &&
      !(await ui.ev(`${group('todo')}.querySelector('input').checked`)),
    'page : Commandes de la liste activé, Liste de tâches non'
  )
  await ui.click(`${group('todo')}.querySelector('.switch')`)
  await ui.waitFor(`${group('todo')}.querySelector('input').checked`)
  check(
    settings().approval.allowed_permissions.includes('todo'),
    'interrupteur Liste de tâches : écrit dans le fichier'
  )
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
  const commands = settings().approval.allowedExecutors[0].approvedCommands
  check(
    commands.includes('npm run lint --fix') &&
      !commands.includes('npm run lint') &&
      !commands.includes('du'),
    'listes : ajout, modification, retrait écrits dans le fichier'
  )
  await ui.shot('215-g-reglages-approbations')

  // Un seul mot aux autorisées : avertissement et confirmation, « Garder » n'écrit rien.
  await ui.ev(`${allowed}.querySelector('[data-testid=approval-rules-add-input]').focus()`)
  await ui.type('git')
  await ui.click(`${allowed}.querySelector('[data-testid=approval-rules-add]')`)
  await ui.waitFor(`!!${allowed}.querySelector('[data-testid=approval-rules-one-word]')`)
  check(
    (
      await ui.ev(`${allowed}.querySelector('[data-testid=approval-rules-one-word]').innerText`)
    ).includes('git push --force') &&
      !settings().approval.allowedExecutors[0].approvedCommands.includes('git'),
    'Réglages : « git » aux autorisées, avertissement et confirmation avant d’écrire'
  )
  await ui.ev(
    `${allowed}.querySelector('[data-testid=approval-rules-one-word]').scrollIntoView({ block: 'center' })`
  )
  await ui.shot('215-o-reglages-un-seul-mot')
  await ui.click(`${allowed}.querySelector('[data-testid=confirm-row-keep]')`)
  await ui.waitFor(`!${allowed}.querySelector('[data-testid=approval-rules-one-word]')`)
  check(
    !settings().approval.allowedExecutors[0].approvedCommands.includes('git'),
    '« Garder » : rien écrit'
  )

  // « Aussi hors du dossier » : l'effet sur l'interrupteur global est dit à l'endroit du clic.
  const outside = `${group('read')}.nextElementSibling`
  check(
    !!(await ui.ev(`!!${outside}.querySelector('[data-testid=approval-outside-effect]')`)),
    'hors du dossier : l’effet de bord est dit sous l’option avant le clic'
  )
  await ui.ev(`${outside}.scrollIntoView({ block: 'center' })`)
  await ui.shot('215-l-reglages-hors-dossier-effet')
  await ui.click(`${outside}.querySelector('.switch')`)
  await ui.waitFor(`${outside}.querySelector('input').checked`)
  let file = settings().approval
  check(
    file.outsideWorkspaceAllowed === true &&
      JSON.stringify(file.permissionOptions) ===
        JSON.stringify([{ groupId: 'read', enableOutsideWorkspace: true }]),
    'hors du dossier : option du groupe et interrupteur global écrits'
  )
  await ui.click(`${outside}.querySelector('.switch')`)
  await ui.waitFor(`!!${ui.$('approval-outside-still-on')}`)
  await ui.ev(`${ui.$('approval-outside-still-on')}.scrollIntoView({ block: 'center' })`)
  await ui.shot('215-m-reglages-hors-dossier-reste-allume')
  check(
    settings().approval.outsideWorkspaceAllowed === true,
    'option éteinte : le global reste allumé, et c’est dit'
  )
  await ui.click(ui.$('approval-outside-turn-off'))
  await ui.waitFor(`!${ui.$('approval-outside-still-on')}`)
  file = settings().approval
  check(file.outsideWorkspaceAllowed === false, '« Ne plus l’autoriser » : global éteint')
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
  check(
    settings().approval.allowedExecutors[0].deniedCommands.includes('node --version'),
    'node --version refusée partout'
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
  check(
    (await ui.ev(`${edit}.querySelector('input').disabled`)) &&
      (await ui.ev(`!!${edit}.querySelector('[data-testid=approval-group-forbidden]')`)),
    'groupe interdit : interrupteur désactivé, raison dite'
  )
  await ui.shot('215-h-reglages-groupe-interdit')
  // Fichier illisible : bandeau, « Relire », rien d'autre.
  writeFileSync(file, '{\n  "approval": {\n    "allowed_permissions": ["read"],\n  }\n}\n')
  await reopenPage(ui)
  await ui.waitFor(`!!${ui.$('approval-rules-unreadable')}`)
  check(
    (await ui.ev(`${ui.$('approval-rules-unreadable')}.innerText`)).includes(
      L('approvalRules.error.line', { line: 4 })
    ) && !(await ui.ev(`!!${ui.$('approval-rules-groups')}`)),
    'fichier illisible : bandeau avec la ligne, ni groupes ni listes'
  )
  await ui.shot('215-i-reglages-illisible')
  writeFileSync(file, readFileSync(file, 'utf8').replace('["read"],', '["read"]'))
  await ui.click(ui.$('approval-rules-reload'))
  await ui.waitFor(`!!${ui.$('approval-rules-groups')}`)
  check(true, 'fichier corrigé : « Relire » montre de nouveau les règles')
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
