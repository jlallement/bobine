import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { L, check, withApp } from '../lib.mjs'

/**
 * Rôles au travail (fiche 223, phase 3B), contre l'agent factice, dans un dépôt git jetable qui a
 * un rôle du projet (`security-expert`, il remplace le rôle fourni du même nom) :
 * - menu `@` (rôles en tête, filtre, clavier), jeton, ligne « Partira à… », une fille ;
 * - deux `@rôle` dans un message : deux filles, carte « Sous-tâches » à l'identité des rôles ;
 * - en-tête de la fille ; proposition de l'agent (`roles-delegue`) : badge, mode, lecture seule,
 *   rôle du projet qui en remplace un autre ;
 * - un agent qui écrit sans demander (`MOCK_AGENT_WRITES=silent`) : lecture seule seulement
 *   demandée, sur la ligne « Partira à… », la carte de proposition et l'en-tête de la fille.
 */
export async function rolesTravailSuite(scheme) {
  console.log(`\n— Rôles au travail (${scheme})`)
  const workspace = realpathSync(mkdtempSync(join(tmpdir(), 'bob-e2e-roles-')))
  const git = (...args) =>
    execFileSync('git', ['-c', 'user.name=e2e', '-c', 'user.email=e2e@example.invalid', ...args], {
      cwd: workspace,
      encoding: 'utf8'
    }).trim()
  writeFileSync(join(workspace, 'README.md'), '# Carnet\n')
  mkdirSync(join(workspace, '.bobine', 'roles'), { recursive: true })
  writeFileSync(
    join(workspace, '.bobine', 'roles', 'security-expert.md'),
    [
      '---',
      'name: security-expert',
      'label: Expert sécu',
      'icon: shield-check',
      'color: orange',
      'description: Relit le code sensible du projet (authentification, secrets, entrées).',
      'mode: ask',
      'read-only: true',
      '---',
      'Tu es l’expert sécurité de ce projet.',
      ''
    ].join('\n')
  )
  git('init', '-q', '-b', 'main')
  git('add', '.')
  git('commit', '-q', '-m', 'init')
  const env = { BOBINE_WORKSPACE: workspace }
  try {
    // Conversation neuve : `@rôle` en tout premier message (essai réel de la phase 4).
    await withApp(scheme, (ui) => freshRun(ui), undefined, 'streaming-texte', env)
    await withApp(scheme, (ui) => mainRun(ui), undefined, 'streaming-texte', env)
    await withApp(
      scheme,
      (ui) => requestedRun(ui),
      undefined,
      'streaming-texte',
      // Agent qui écrit sans demander, comme OpenCode réglé par défaut.
      { ...env, MOCK_AGENT_WRITES: 'silent' }
    )
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
}

const input = `document.querySelector('[data-testid="composer-input"]')`
const roleItems = `[...document.querySelectorAll('[data-testid=role-item]')].map((i) => i.dataset.role)`

/**
 * Amène un élément au milieu du fil, en ne faisant défiler que le fil (`scrollIntoView` décalait
 * toute la fenêtre).
 */
function reveal(ui, element) {
  return ui.ev(
    `(() => { const el = ${element}; let p = el.parentElement; while (p && !/(auto|scroll)/.test(getComputedStyle(p).overflowY)) p = p.parentElement; if (!p) return; const r = el.getBoundingClientRect(); const pr = p.getBoundingClientRect(); p.scrollTop += r.top - pr.top - Math.max(0, (pr.height - r.height) / 2) })()`
  )
}

/** Tape dans la saisie (sans envoyer). */
async function typeIn(ui, text) {
  await ui.ev(`${input}.focus()`)
  await ui.type(text)
}

/**
 * `@rôle` comme tout premier message d'une conversation neuve : la conversation entre dans
 * l'historique (titrée d'après la demande, sans message à son agent), la fille s'y rattache, deux
 * rôles cités donnent deux filles.
 */
async function freshRun(ui) {
  await ui.ready()
  check(
    (await ui.ev(`document.querySelectorAll('[data-testid=history-item]').length`)) === 0,
    'conversation neuve : rien encore dans l’historique'
  )
  await typeIn(ui, '@security-expert @code-reviewer relisez calc.js')
  await ui.press('Escape')
  await ui.waitFor(`!!${ui.$('role-destination')}`)
  await ui.enter()
  await ui.waitFor(`document.querySelectorAll('[data-testid=role-launch]').length === 2`, 30000)
  check(
    (await ui.ev(`${input}.value`)) === '',
    'premier message `@rôle` : parti, saisie vidée, aucun refus'
  )
  await ui.waitFor(
    `[...document.querySelectorAll('[data-testid=history-item]')].some((i) => i.innerText.includes('relisez calc.js'))`
  )
  await ui.waitFor(
    `document.querySelectorAll('[data-testid=history-item][data-mother]').length === 2`,
    30000
  )
  check(
    true,
    'la conversation est dans l’historique, titrée d’après la demande ; deux filles dessous'
  )
  await ui.waitFor(`document.querySelectorAll('[data-testid=child-report]').length === 2`, 30000)
  await ui.shot('roles-travail-0-premier-message')
}

async function mainRun(ui) {
  await ui.ready()
  // La mère : une conversation de l'historique (une fille s'y rattache).
  await ui.send('Bonjour')
  await ui.ready()

  // Menu `@` : les rôles en tête, cinq au plus, puis « Tous les rôles ».
  await typeIn(ui, 'Relis le module de connexion @')
  await ui.waitFor(`!!${ui.$('role-item')}`)
  const shown = await ui.ev(roleItems)
  check(
    shown.length === 5 && (await ui.ev(`!!${ui.$('role-more')}`)),
    'menu @ : cinq rôles en tête, puis « Tous les rôles »'
  )
  check(
    (await ui.ev(
      `!!document.querySelector('[data-testid=role-item][data-role=security-expert] .role-item-project')`
    )) &&
      (await ui.ev(`document.querySelector('[data-testid=file-menu]').innerText`)).includes(
        L('roleWork.menu.title')
      ),
    'menu @ : section « Rôles », marque du rôle du projet'
  )
  await ui.shot('roles-travail-1-menu')

  // Filtre, accents ignorés : le nom d'abord, puis la description.
  await ui.type('secu')
  await ui.waitFor(`${roleItems}[0] === 'security-expert'`)
  await ui.shot('roles-travail-2-filtre')
  // Échap referme, le texte reste ; on rouvre, Entrée prend le rôle surligné.
  await ui.press('Escape')
  await ui.waitFor(`!${ui.$('file-menu')}`)
  await ui.type('r')
  await ui.waitFor(`${roleItems}[0] === 'security-expert'`)
  await ui.enter()
  await ui.waitFor(`!!${ui.$('role-token')}`)
  check(
    (await ui.ev(`${input}.value`)) === 'Relis le module de connexion ' &&
      (await ui.ev(`${ui.$('role-token')}.dataset.role`)) === 'security-expert',
    'Entrée : le rôle devient un jeton, `@requête` sort du texte'
  )
  const line = await ui.ev(`${ui.$('role-destination')}.innerText`)
  check(
    line.includes(L('roleWork.readOnly')) && line.includes(L('roleWork.destination.sameFolder')),
    `ligne « Partira à… » : lecture seule, dans ce dossier (${line})`
  )
  await ui.shot('roles-travail-3-jeton')
  // Retour arrière en tête de la saisie : le jeton part d'un coup ; on le remet.
  await ui.ev(`${input}.setSelectionRange(0, 0)`)
  await ui.press('Backspace')
  await ui.waitFor(`!${ui.$('role-token')}`)
  await ui.ev(
    `(() => { const i = ${input}; i.setSelectionRange(i.value.length, i.value.length) })()`
  )
  await ui.type('@security-expert')
  await ui.press('Escape')
  await ui.waitFor(`!!${ui.$('role-destination')}`)
  await ui.enter()

  // Une fille du rôle, dans le fil de la mère, à son identité.
  await ui.waitFor(
    `!!document.querySelector('[data-testid=role-launch][data-role=security-expert]')`,
    30000
  )
  check((await ui.ev(`${input}.value`)) === '', 'envoi : la saisie se vide, rien à la mère')
  await ui.waitFor(
    `document.querySelector('[data-testid=role-launch]')?.dataset.state === 'unread'`,
    30000
  )
  await ui.waitFor(`!!${ui.$('child-report')}`, 30000)
  check(
    (await ui.ev(`${ui.$('child-report')}.dataset.role`)) === 'security-expert',
    'compte rendu titré du rôle'
  )
  await ui.shot('roles-travail-4-fille')

  // Deux `@rôle` tapés : deux filles, en parallèle, avec le même texte.
  await typeIn(ui, '@security-expert @code-reviewer relisez le carnet avant la fusion')
  await ui.waitFor(`!!${ui.$('role-destination')}`)
  check(
    (await ui.ev(`${ui.$('role-destination')}.innerText`)).includes('2'),
    'deux rôles : la ligne résume'
  )
  await ui.shot('roles-travail-5-deux-roles')
  await ui.enter()
  await ui.waitFor(`document.querySelectorAll('[data-testid=role-launch]').length === 3`, 30000)
  // Au travail : l'anneau de l'avatar (maquette 03-5), pris au vol tant qu'une fille répond.
  await ui.waitFor(
    `!!document.querySelector('[data-testid=role-avatar][data-state=running]')`,
    15000
  )
  await reveal(ui, `document.querySelector('[data-testid=role-avatar][data-state=running]')`)
  await ui.shot('roles-travail-5b-au-travail')
  await ui.waitFor(
    `[...document.querySelectorAll('[data-testid=subtask-row]')].length === 3 && !document.querySelector('[data-testid=role-launch][data-state=running]')`,
    60000
  )
  check(
    (await ui.ev(
      `[...document.querySelectorAll('[data-testid=role-launch]')].map((l) => l.dataset.role).join()`
    )) === 'security-expert,security-expert,code-reviewer',
    'deux filles, une par rôle, dans l’ordre du message'
  )
  check(
    (await ui.ev(
      `document.querySelectorAll('[data-testid=subtask-row] .role-subtask-head').length`
    )) === 3,
    'Sous-tâches : chaque ligne à l’identité de son rôle'
  )
  await reveal(ui, `${ui.$('subtasks')}`)
  await ui.shot('roles-travail-6-sous-taches')

  // L'en-tête de la fille dit son rôle et sa lecture seule.
  await ui.ev(`${ui.$('role-launch-open')}.click()`)
  await ui.waitFor(`!!${ui.$('role-title-badge')}`)
  check(
    (await ui.ev(
      `document.querySelector('[data-testid=role-title-badge] [data-testid=role-read-only]')?.dataset.level`
    )) === 'enforced',
    'en-tête de la fille : son rôle, lecture seule garantie'
  )
  await ui.shot('roles-travail-7-fille-entete')
  // En-tête étroit (essais réels : 1 280 px, panneau ouvert, pastille « Profil temporaire ») : la
  // pastille est posée comme en profil temporaire ; le titre reste lisible, rien ne déborde.
  const narrow = await ui.ev(`(() => {
    const header = document.querySelector('.main-header')
    const chip = document.createElement('span')
    chip.className = 'temporary-chip no-drag'
    chip.dataset.e2e = 'chip'
    chip.textContent = ${JSON.stringify(L('settings.data.fresh.chip'))}
    header.querySelector('.grow').after(chip)
    const right = header.getBoundingClientRect().right
    return {
      title: header.querySelector('.main-title').getBoundingClientRect().width,
      overflow: [...header.children].some((el) => el.getBoundingClientRect().right > right + 1)
    }
  })()`)
  check(
    narrow.title >= 90 && !narrow.overflow,
    `en-tête d'une fille étroit : titre lisible (${Math.round(narrow.title)} px), rien ne déborde`
  )
  await ui.shot('roles-travail-7b-entete-etroit')
  await ui.ev(`document.querySelector('[data-e2e=chip]')?.remove()`)
  await ui.click(ui.$('title-origin'))
  await ui.waitFor(`!${ui.$('role-title-badge')}`)

  // L'agent propose un rôle : la carte le montre, figé (badge, mode, lecture seule, projet).
  await ui.send('/scenario roles-delegue')
  const pending = `document.querySelector('[data-testid=proposal-row][data-outcome=pending]')`
  await ui.waitFor(`!!${pending}?.querySelector('[data-testid=proposal-role]')`, 30000)
  check(
    (await ui.ev(`${pending}.querySelector('[data-testid=role-read-only]').dataset.level`)) ===
      'enforced' &&
      (await ui.ev(`${pending}.querySelector('[data-testid=proposal-role-mode]').innerText`)) ===
        L('roleWork.mode', { mode: 'ask' }) &&
      (await ui.ev(`!!${pending}.querySelector('[data-testid=proposal-role-hides]')`)),
    'proposition : lecture seule garantie, mode, rôle du projet qui remplace le fourni'
  )
  await reveal(ui, `${pending}`)
  await ui.shot('roles-travail-8-proposition')
  await ui.click(`${pending}.querySelector('[data-testid=proposal-start]')`)
  await ui.waitFor(`document.querySelectorAll('[data-testid=role-launch]').length === 4`, 30000)
}

async function requestedRun(ui) {
  await ui.ready()
  await ui.send('Bonjour')
  await ui.ready()
  // La ligne « Partira à… » le dit avant l'envoi.
  await typeIn(ui, '@security-expert relis le carnet')
  await ui.waitFor(`!!${ui.$('role-destination')}`)
  check(
    (await ui.ev(`${ui.$('role-destination')}.innerText`)).includes(
      L('roleWork.readOnlyRequested')
    ),
    'agent qui écrit sans demander : « lecture seule demandée » avant l’envoi'
  )
  await ui.shot('roles-travail-9-jeton-demandee')
  await ui.ev(
    `(() => { const i = ${input}; const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; set.call(i, ''); i.dispatchEvent(new Event('input', { bubbles: true })) })()`
  )
  // La proposition de l'agent : lecture seule seulement demandée, sans nom d'agent.
  await ui.send('/scenario roles-delegue')
  const pending = `document.querySelector('[data-testid=proposal-row][data-outcome=pending]')`
  await ui.waitFor(`!!${pending}?.querySelector('[data-testid=proposal-role]')`, 30000)
  const tag = await ui.ev(
    `(() => { const t = ${pending}.querySelector('[data-testid=role-read-only]'); return { level: t.dataset.level, text: t.innerText } })()`
  )
  check(
    tag.level === 'requested' && tag.text === L('roleWork.readOnlyRequested'),
    'proposition : lecture seule seulement demandée'
  )
  await reveal(ui, `${pending}`)
  await ui.shot('roles-travail-10-proposition-demandee')
  await ui.click(`${pending}.querySelector('[data-testid=proposal-start]')`)
  await ui.waitFor(`!!${ui.$('role-launch-open')}`, 30000)
  // Bouton ordinaire : cliqué sans viser, le fil peut défiler (réveil de la mère).
  await ui.ev(`${ui.$('role-launch-open')}.click()`)
  await ui.waitFor(`!!${ui.$('role-title-badge')}`)
  check(
    (await ui.ev(
      `document.querySelector('[data-testid=role-title-badge] [data-testid=role-read-only]')?.dataset.level`
    )) === 'requested',
    'en-tête de la fille : lecture seule seulement demandée'
  )
  await ui.shot('roles-travail-11-fille-demandee')
}
