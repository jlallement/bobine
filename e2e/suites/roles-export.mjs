import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { L, LANG, check, withApp } from '../lib.mjs'

/** Fichier de modes personnels déjà là (commentaires, un autre mode) : gardé tel quel. */
const USER_MODES = `# Mes modes à moi
customModes:
  - slug: traducteur # le mien
    name: Traducteur
    roleDefinition: Tu traduis.
    groups: [read]
`

/** Rôle du projet au libellé le plus long permis. */
const LONG_ROLE = `---
name: relecteur-des-migrations
label: Relecteur des migrations de la base SQL
icon: database
color: green
description: Relit les migrations de base de données avant fusion.
read-only: true
---

Tu relis les migrations.
`

/** Mode du projet du même nom, que Bobine n'a pas écrit : jamais touché. */
const FOREIGN_PROJECT_MODES = `customModes:
  - slug: code-reviewer
    name: Relecteur de l’équipe
    roleDefinition: Le nôtre.
    groups: [read]
`

/**
 * « Installer dans Bob / OpenCode » (fiche 223, phase 4, maquettes 05-1 à 05-4), contre l'agent
 * factice qui lit les fichiers comme Bob (`MOCK_AGENT_ROLE_EXPORT=bob`) puis comme OpenCode
 * (`opencode`), dans un dossier personnel et un dépôt git jetables :
 * - Bob : bouton et menu, feuille (portée, droits, texte exact), installé « à jour » avec le reste
 *   du fichier gardé ; conflit avec un mode du projet que Bobine n'a pas écrit (rien changé) ; rôle
 *   changé puis « Mettre à jour » ; « lancer dans ce mode » : la fille du rôle est mise dans le mode
 *   installé ; « Retirer » rend le fichier d'origine ;
 * - OpenCode : feuille, installé pour le projet, modifié à la main (dit), retiré après
 *   confirmation (fichier supprimé).
 */
export async function rolesExportSuite(scheme) {
  console.log(`\n— Rôles : installer dans un agent (${scheme})`)
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'bob-e2e-roles-export-')))
  const home = join(root, 'home')
  const workspace = join(root, 'projet')
  mkdirSync(join(home, '.bob', 'settings'), { recursive: true })
  mkdirSync(join(workspace, '.bob'), { recursive: true })
  writeFileSync(join(home, '.bob', 'settings', 'custom_modes.yaml'), USER_MODES)
  writeFileSync(join(workspace, '.bob', 'custom_modes.yaml'), FOREIGN_PROJECT_MODES)
  writeFileSync(join(workspace, 'README.md'), '# Boutique\n')
  // Rôle du projet au nom long (40 caractères) : en-tête de sa page, puis renommé (sans rôle).
  mkdirSync(join(workspace, '.bobine', 'roles'), { recursive: true })
  writeFileSync(join(workspace, '.bobine', 'roles', 'relecteur-des-migrations.md'), LONG_ROLE)
  const git = (...args) =>
    execFileSync('git', ['-c', 'user.name=e2e', '-c', 'user.email=e2e@example.invalid', ...args], {
      cwd: workspace
    })
  git('init', '-q', '-b', 'main')
  git('add', '.')
  git('commit', '-q', '-m', 'init')
  const env = { BOBINE_WORKSPACE: workspace, BOBINE_CONFIG_HOME: home }
  try {
    await withApp(scheme, (ui) => bobRun(ui, { home, workspace }), undefined, 'streaming-texte', {
      ...env,
      MOCK_AGENT_ROLE_EXPORT: 'bob'
    })
    await withApp(scheme, (ui) => openCodeRun(ui, { workspace }), undefined, 'streaming-texte', {
      ...env,
      MOCK_AGENT_ROLE_EXPORT: 'opencode'
    })
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

const F = (format, key) => L(`roleExport.format.${format}.${key}`)
const row = (name) => `document.querySelector('[data-testid=role-row][data-role=${name}]')`
const rows = `[...document.querySelectorAll('[data-testid=role-export-row]')].map((r) => r.dataset.state)`

/** Saisie comme au clavier pour React : valeur posée puis évènement `input`. */
const fill = (ui, testId, value) =>
  ui.ev(`(() => {
    const el = ${ui.$(testId)}
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement : HTMLInputElement
    Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, ${JSON.stringify(value)})
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })()`)

/** Réglages › Rôles, puis la page du rôle. */
async function openRole(ui, name) {
  if (!(await ui.ev(`!!${ui.$('settings')}`))) {
    await ui.click(ui.$('open-settings'))
    await ui.waitFor(`!!${ui.$('settings')}`)
  }
  await ui.click(ui.$('settings-roles'))
  await ui.waitFor(`!!${row(name)}`)
  await ui.click(`${row(name)}.querySelector('[data-testid=role-row-open]')`)
  await ui.waitFor(`${ui.$('role-edit')}?.dataset.role === '${name}'`)
}

/** Ouvre le menu « Installer dans… » puis la feuille de l'agent factice. */
async function openSheet(ui, capture) {
  await ui.click(ui.$('role-export-button'))
  await ui.waitFor(`!!${ui.$('role-export-target-mock')}`)
  if (capture) await ui.shot(capture)
  await ui.click(ui.$('role-export-target-mock'))
  await ui.waitFor(`!!${ui.$('role-export-install')} && !${ui.$('role-export-install')}.disabled`)
}

async function bobRun(ui, { home, workspace }) {
  const userFile = join(home, '.bob', 'settings', 'custom_modes.yaml')
  const projectFile = join(workspace, '.bob', 'custom_modes.yaml')
  await ui.ready()
  // La mère d'une fille de rôle : une conversation de l'historique.
  await ui.send('Bonjour')
  await ui.ready()

  // Page d'un rôle fourni : « Installer dans… », menu des agents qui savent recevoir un rôle.
  await openRole(ui, 'code-reviewer')
  check(
    !(await ui.ev(`!!${ui.$('role-export-rows')}`)),
    'rôle jamais installé : aucune ligne d’état'
  )
  await openSheet(ui, 'rx1-bouton')
  const sheet = ui.$('role-export-sheet')
  check(
    (await ui.ev(`${sheet}.dataset.format`)) === 'bob-custom-modes' &&
      (await ui.ev(`${ui.$('role-export-place-user')}.querySelector('input').checked`)) &&
      (await ui.ev(`${ui.$('role-export-place-user')}.innerText`)).includes(
        '~/.bob/settings/custom_modes.yaml'
      ) &&
      (await ui.ev(`${ui.$('role-export-place-project')}.innerText`)).includes(
        '.bob/custom_modes.yaml'
      ) &&
      (await ui.ev(`${ui.$('role-export-rights')}.innerText`)) ===
        F('bob-custom-modes', 'readOnly'),
    'feuille : portée du rôle par défaut (pour vous), chemins, droits en lecture seule'
  )
  await ui.click(ui.$('role-export-show-text'))
  await ui.waitFor(`!!${ui.$('role-export-text')}`)
  check(
    (await ui.ev(`${ui.$('role-export-text')}.innerText`)).includes('slug: code-reviewer') &&
      (await ui.ev(`${ui.$('role-export-text')}.innerText`)).includes('- mcp'),
    '« Voir ce qui sera écrit » : le bloc YAML exact'
  )
  await ui.shot('rx2-feuille-bob')

  // Installer pour vous : le mode est ajouté, le reste du fichier gardé, « à jour ».
  await ui.click(ui.$('role-export-install'))
  await ui.waitFor(`!${sheet} && ${rows}.join() === 'upToDate'`)
  const written = readFileSync(userFile, 'utf8')
  check(
    written.startsWith(USER_MODES) && written.includes('slug: code-reviewer'),
    'installé : mode ajouté à ~/.bob/settings/custom_modes.yaml, le reste et ses commentaires gardés'
  )

  // Ce projet : un mode du même nom que Bobine n'a pas écrit → rien n'est changé, c'est dit.
  await openSheet(ui)
  await ui.click(`${ui.$('role-export-place-project')}.querySelector('input')`)
  await ui.click(ui.$('role-export-install'))
  await ui.waitFor(`!!${ui.$('role-export-error')}`)
  check(
    readFileSync(projectFile, 'utf8') === FOREIGN_PROJECT_MODES &&
      (await ui.ev(`${ui.$('role-export-error')}.innerText`)).includes('code-reviewer'),
    'conflit : mode du projet que Bobine n’a pas écrit, fichier inchangé, dit sur la page'
  )
  await ui.shot('rx3-installe-conflit')

  // Le rôle change (enregistré en rôle personnel) : « le rôle a changé depuis », puis à jour.
  await ui.ev(`(() => {
    const el = ${ui.$('role-description')}
    const set = Object.getOwnPropertyDescriptor(el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value').set
    set.call(el, 'Relit un diff avant fusion, sans rien modifier.')
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })()`)
  await ui.click(ui.$('role-edit-save'))
  await ui.waitFor(
    `${ui.$('role-edit')}?.dataset.scope === 'user' && ${rows}.join() === 'roleChanged'`
  )
  check(
    !(await ui.ev(`!!${ui.$('role-export-error')}`)),
    'rôle réenregistré : le refus d’avant n’est plus montré'
  )
  await ui.shot('rx4-role-change')
  await ui.click(ui.$('role-export-update'))
  await ui.waitFor(`${rows}.join() === 'upToDate'`)
  check(
    readFileSync(userFile, 'utf8').includes('Relit un diff avant fusion, sans rien modifier.'),
    'rôle changé : « Mettre à jour » réécrit le mode, la ligne repasse « à jour »'
  )

  // « Dans Bobine, lancer ce rôle dans ce mode » : la fille du rôle est mise dans le mode installé.
  await ui.click(ui.$('role-edit-try'))
  await ui.waitFor(`!${ui.$('settings')}`)
  await ui.waitFor(`!!document.querySelector('[data-testid=role-token][data-role=code-reviewer]')`)
  await ui.ev(`document.querySelector('[data-testid="composer-input"]').focus()`)
  await ui.type('/scenario echo')
  await ui.enter()
  await ui.waitFor(`!!${ui.$('child-report')}`, 30_000)
  const expected = LANG === 'en' ? 'Mode: code-reviewer' : 'Mode : code-reviewer'
  await ui.waitFor(
    `${ui.$('child-report')}.innerText.includes(${JSON.stringify(expected)})`,
    30_000
  )
  check(true, 'lancer dans ce mode : la fille du rôle travaille dans le mode installé de Bob')
  await ui.shot('rx5-fille-mode-installe')

  // Retirer : seul ce mode part, le fichier redevient celui d'origine.
  await openRole(ui, 'code-reviewer')
  await ui.waitFor(`${rows}.join() === 'upToDate'`)
  await ui.click(ui.$('role-export-remove'))
  await ui.waitFor(`!${ui.$('role-export-rows')}`)
  check(
    readFileSync(userFile, 'utf8') === USER_MODES,
    'retirer : seul le mode de Bobine part, le fichier redevient celui d’origine'
  )
}

async function openCodeRun(ui, { workspace }) {
  const agentFile = join(workspace, '.opencode', 'agents', 'security-expert.md')
  await ui.ready()
  // Une conversation de l'historique : son dossier est le projet (rôles de `.bobine/roles/`).
  await ui.send('Bonjour')
  await ui.ready()
  await openRole(ui, 'security-expert')
  await openSheet(ui)
  check(
    (await ui.ev(`${ui.$('role-export-sheet')}.dataset.format`)) === 'opencode-agents' &&
      (await ui.ev(`${ui.$('role-export-place-user')}.innerText`)).includes(
        '~/.config/opencode/agents/security-expert.md'
      ) &&
      (await ui.ev(`${ui.$('role-export-rights')}.innerText`)) === F('opencode-agents', 'readOnly'),
    'feuille OpenCode : un fichier par agent, lecture seule par ses permissions'
  )
  await ui.click(`${ui.$('role-export-place-project')}.querySelector('input')`)
  await ui.shot('rx6-feuille-opencode')
  await ui.click(ui.$('role-export-install'))
  await ui.waitFor(`!${ui.$('role-export-sheet')} && ${rows}.join() === 'upToDate'`)
  check(
    readFileSync(agentFile, 'utf8').includes('mode: primary'),
    'installé pour ce projet : .opencode/agents/security-expert.md'
  )

  // Modifié à la main : dit ; « Retirer » demande confirmation, puis supprime le fichier.
  writeFileSync(agentFile, `${readFileSync(agentFile, 'utf8')}\nMa note.\n`)
  await ui.click(ui.$('role-edit-back'))
  await openRole(ui, 'security-expert')
  await ui.waitFor(`${rows}.join() === 'handEdited'`)
  await ui.click(ui.$('role-export-remove'))
  await ui.waitFor(`!!${ui.$('confirm-row')}`)
  check(existsSync(agentFile), 'modifié à la main : rien n’est retiré sans confirmation')
  await ui.shot('rx7-modifie-a-la-main')
  await ui.click(ui.$('confirm-row-confirm'))
  await ui.waitFor(`!${ui.$('role-export-rows')}`)
  check(!existsSync(agentFile), 'retiré après confirmation : le fichier de l’agent est supprimé')

  // Nom long : le sous-titre tient sur une ligne (chemin en infobulle), les actions passent dessous.
  // Rôle du projet : installé pour le projet (portée du rôle, par défaut).
  const longFile = join(workspace, '.opencode', 'agents', 'relecteur-des-migrations.md')
  await ui.click(ui.$('role-edit-back'))
  await openRole(ui, 'relecteur-des-migrations')
  const where = ui.$('role-edit-where')
  check(
    (await ui.ev(`getComputedStyle(${where}).whiteSpace`)) === 'nowrap' &&
      (await ui.ev(`${where}.title`)).endsWith('/.bobine/roles/relecteur-des-migrations.md') &&
      (await ui.ev(
        `document.querySelector('.role-edit-title').getBoundingClientRect().width >= 200`
      )),
    'en-tête : nom long lisible, sous-titre sur une ligne, chemin complet en infobulle'
  )
  await ui.shot('rx8-entete-nom-long')

  // Installé puis renommé : l'ancienne installation reste visible (« Installations sans rôle »).
  await openSheet(ui)
  await ui.click(ui.$('role-export-install'))
  await ui.waitFor(`!${ui.$('role-export-sheet')} && ${rows}.join() === 'upToDate'`)
  await fill(ui, 'role-name', 'relecteur-migrations')
  await ui.click(ui.$('role-edit-save'))
  await ui.waitFor(`${ui.$('role-edit')}?.dataset.role === 'relecteur-migrations'`)
  await ui.waitFor(`!!${ui.$('role-edit-saved')}`)
  check(
    (await ui.ev(`${ui.$('role-edit-saved')}.innerText`)).includes('relecteur-des-migrations'),
    'renommé alors qu’installé : dit à l’enregistrement (ancien identifiant)'
  )
  await ui.click(ui.$('role-edit-back'))
  await ui.waitFor(`!!${ui.$('roles-group-orphans')}`)
  await ui.ev(`${ui.$('roles-group-orphans')}.scrollIntoView({ block: 'center' })`)
  check(
    (await ui.ev(`${ui.$('roles-group-orphans')}.innerText`)).includes(
      'relecteur-des-migrations'
    ) && existsSync(longFile),
    '« Installations sans rôle » : l’installation du rôle renommé reste visible'
  )
  await ui.shot('rx9-sans-role')
  await ui.click(`${ui.$('roles-group-orphans')}.querySelector('[data-testid=role-export-remove]')`)
  await ui.waitFor(`!${ui.$('roles-group-orphans')}`)
  check(!existsSync(longFile), 'installation sans rôle retirée : fichier de l’agent supprimé')
}
