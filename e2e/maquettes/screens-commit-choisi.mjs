// Maquettes de la fiche 244 : « Committer d'abord » montre la liste complète des fichiers, une
// case par fichier (toutes cochées au départ, comme la vue Git de la fiche 110), et ne committe que
// les cochés. Un composant commun aux deux cartes : « Fusion refusée » (fiche 123) et
// l'avertissement avant le lancement d'une fille en worktree (fiche 240).
// Sur la vraie fenêtre : `@rôle` est tapé pour de vrai (écrans 5 et 6) ; le reste est injecté avec
// les classes de l'app. node e2e/maquettes/run.mjs light f244
import { i } from './icons.mjs'

/* Teintes des rôles (`TINTS`, src/shared/themes.ts) : l'app les pose en `--role` depuis le JS. */
const TINT = {
  light: { pink: '#b8336f', green: '#2c8151', blue: '#1d5bbf' },
  dark: { pink: '#e27aa9', green: '#5cb87f', blue: '#8fb4f0' }
}

/** Cinq fichiers : le cas ordinaire. */
const FIVE = [
  ['plan.md', 'M'],
  ['server/index.js', 'M'],
  ['server/routes/tasks.js', 'U'],
  ['public/app.js', 'M'],
  ['test/api.test.js', 'U']
]

/** Quarante fichiers, le `.env` (non suivi, non ignoré) vers la fin. */
const FORTY = [
  ['plan.md', 'M'],
  ['README.md', 'M'],
  ['package.json', 'M'],
  ['package-lock.json', 'M'],
  ['maquettes/a.html', 'U'],
  ['maquettes/b.html', 'U'],
  ['server/index.js', 'M'],
  ['server/db.js', 'U'],
  ['server/routes/tasks.js', 'U'],
  ['server/routes/users.js', 'U'],
  ['server/routes/auth.js', 'U'],
  ['server/middleware/errors.js', 'U'],
  ['server/middleware/session.js', 'U'],
  ['public/index.html', 'M'],
  ['public/app.js', 'M'],
  ['public/style.css', 'M'],
  ['public/components/task-list.js', 'U'],
  ['public/components/task-item.js', 'U'],
  ['public/components/filters.js', 'U'],
  ['public/components/toolbar.js', 'U'],
  ['public/icons/check.svg', 'U'],
  ['public/icons/trash.svg', 'U'],
  ['test/api.test.js', 'U'],
  ['test/db.test.js', 'U'],
  ['test/auth.test.js', 'U'],
  ['test/fixtures/tasks.json', 'U'],
  ['ios/Taches/ContentView.swift', 'U'],
  ['ios/Taches/TaskRow.swift', 'U'],
  ['ios/Taches/TaskStore.swift', 'U'],
  ['ios/Taches/TachesApp.swift', 'U'],
  ['ios/Taches.xcodeproj/project.pbxproj', 'U'],
  ['scripts/seed.js', 'U'],
  ['scripts/reset-db.sh', 'U'],
  ['docs/api.md', 'U'],
  ['docs/notes-perso.md', 'U'],
  ['.env', 'U'],
  ['data/taches.sqlite', 'U'],
  ['old/server.js', 'D'],
  ['old/README.md', 'D'],
  ['CHANGELOG.md', 'M']
]

const TONE = { M: 'mod', U: 'add', A: 'add', D: 'del', R: 'mod' }
const SCROLL_FROM = 8

/* ----------------------------------------------------------------- styles */

const CSS = `
.mq-legend { position: fixed; left: 14px; bottom: 76px; z-index: 80; width: 270px; display: block; padding: 8px 11px; border-radius: 9px; background: var(--surface-2); border: 1px dashed var(--border-strong); color: var(--text-2); font-size: 12px; line-height: 1.45; }
.mq-legend b { color: var(--text); }
.mq-legend code { font-family: var(--font-mono); font-size: 11px; }
.mq-composer-dock .main-dirty { margin: 8px 12px 0; }
.mq-dirty .main-dirty-actions { justify-content: flex-start; align-items: center; }
.mq-dirty .main-dirty-actions .grow { flex: 1; }

/* Composant commun proposé : liste à cocher (fiche 244). */
.commit-chooser { display: flex; flex-direction: column; margin-left: 19px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--bg); min-width: 0; }
.commit-chooser-head { display: flex; align-items: center; gap: 6px; padding: 5px 8px 5px 2px; border-bottom: 1px solid var(--border); color: var(--text-2); font-size: 12.5px; }
.commit-chooser-head strong { color: var(--text); font-weight: 500; }
.commit-chooser-head .grow { flex: 1; }
.commit-chooser-head .link-button { font-size: 12px; }
.commit-chooser-list { list-style: none; margin: 0; padding: 2px 0; }
.commit-chooser-list.scroll { max-height: 214px; overflow-y: auto; scrollbar-gutter: stable; }
.commit-chooser-list li { display: flex; align-items: center; gap: 6px; padding: 2px 8px 2px 2px; border-radius: var(--radius-xs); font-size: 12.5px; min-width: 0; }
.commit-chooser-list li:hover { background: var(--surface-2); }
.commit-chooser-list li.off .changes-name, .commit-chooser-list li.off .changes-dir { color: var(--muted); text-decoration: line-through; text-decoration-color: color-mix(in srgb, var(--muted) 60%, transparent); }
.commit-chooser-list li.mq-focus { background: color-mix(in srgb, var(--accent) 10%, transparent); }
.commit-chooser .changes-check { margin: 0 2px 0 6px; }
.commit-chooser .changes-name { font-size: 12.5px; color: var(--text); }
.commit-chooser-tag { flex-shrink: 0; margin-left: auto; padding: 0 6px; border-radius: var(--radius-pill); background: color-mix(in srgb, var(--warn) 16%, transparent); color: var(--warn); font-size: 11px; line-height: 17px; }
.commit-chooser-left { display: flex; align-items: flex-start; gap: 6px; margin-left: 19px; color: var(--text-2); font-size: 12.5px; }
.commit-chooser-left svg { flex-shrink: 0; margin-top: 2px; color: var(--muted); }
.commit-chooser-none { margin: 0 0 0 auto; color: var(--warn); font-size: 12.5px; align-self: center; }
.main-dirty .worktree-form { margin-left: 19px; }
.main-dirty .worktree-form textarea { width: 100%; font-family: var(--font-mono); font-size: 12px; }
.main-dirty .worktree-form-actions { align-items: center; }
.main-dirty .worktree-form-actions .btn.primary:disabled { opacity: .45; cursor: not-allowed; }
`

/* --------------------------------------------------------------- morceaux */

const userMsg = (text) =>
  `<div class="msg-user-group"><div class="msg-user">${text}</div><div class="msg-user-actions"><time class="msg-time">20:58</time></div></div>`
const agentMsg = (html, duration = '') =>
  `<div class="msg-agent-group"><div class="msg-agent"><div class="markdown">${html}</div></div>${duration ? `<div class="msg-agent-actions"><time class="msg-time">20:59</time><span class="msg-duration">${duration}</span></div>` : ''}</div>`
const toolDone = (icon, label) =>
  `<div data-testid="tool" data-status="completed"><details class="tool"><summary class="tool-row">${i(icon, 15, 'tool-icon')}<span class="tool-title"><span>${label}</span></span><span class="tool-state completed">${i('check', 14)}</span>${i('chevron-right', 14, 'chevron tool-icon')}</summary></details></div>`

const split = (path) => {
  const k = path.lastIndexOf('/')
  return k < 0 ? { dir: '', name: path } : { dir: path.slice(0, k), name: path.slice(k + 1) }
}
const SECRET = /(^|\/)(\.env(\..*)?|id_rsa.*|.*\.(pem|key|p12))$/

/** Message proposé (forme de `proposeCommitMessage`) : seulement les fichiers cochés. */
function proposed(files, subject) {
  if (files.length === 0) return ''
  const max = 20
  const lines = files.slice(0, max).map(([p, s]) => `- ${p}${s === 'D' ? ' (deleted)' : ''}`)
  if (files.length > max) lines.push(`- … and ${files.length - max} more`)
  return `${subject}\n\n${lines.join('\n')}`
}

/**
 * Le composant commun proposé, `CommitChooser` : case de tête, liste (défilante au-delà de 8),
 * puis le formulaire de commit de toujours (message, Annuler, bouton).
 */
function chooser({
  files,
  off = new Set(),
  confirm,
  leftText,
  subject,
  expanded = false,
  focus = '',
  tag = false
}) {
  const on = files.filter(([p]) => !off.has(p))
  const all = on.length === files.length
  const none = on.length === 0
  const long = files.length > SCROLL_FROM
  const rows = files
    .map(([p, s]) => {
      const { dir, name } = split(p)
      const cls = [off.has(p) ? 'off' : '', p === focus ? 'mq-focus' : ''].join(' ').trim()
      return `<li${cls ? ` class="${cls}"` : ''}><input type="checkbox" class="changes-check"${off.has(p) ? '' : ' checked'}><span class="changes-badge ${TONE[s]}">${s}</span><span class="changes-name">${name}</span><span class="changes-dir">${dir}</span>${tag && SECRET.test(p) ? '<span class="commit-chooser-tag">secret ?</span>' : ''}</li>`
    })
    .join('')
  const head = `<div class="commit-chooser-head"><input type="checkbox" class="changes-check" data-mq-head="${all ? 'all' : none ? 'none' : 'some'}"${all ? ' checked' : ''}><span>${files.length} fichiers · <strong>${all ? 'tous cochés' : none ? 'aucun coché' : `${on.length} sur ${files.length} cochés`}</strong></span><span class="grow"></span>${long ? `<button class="link-button">${expanded ? 'Réduire' : 'Tout afficher'}</button>` : ''}</div>`
  const left = files.length - on.length
  const leftLine =
    left > 0 && !none
      ? `<div class="commit-chooser-left">${i('info', 13)}<span>${leftText(left)}</span></div>`
      : ''
  const message = proposed(on, subject)
  return `
<div class="commit-chooser" data-mq-chooser>${head}<ul class="commit-chooser-list${long && !expanded ? ' scroll' : ''}">${rows}</ul></div>
${leftLine}
<div class="worktree-form"><label class="muted">Message du commit</label><textarea rows="${none ? 2 : 5}">${message}</textarea><div class="worktree-form-actions">${none ? '<span class="commit-chooser-none">Cochez au moins un fichier à committer.</span>' : ''}<button class="btn small ghost">Annuler</button><button class="btn small primary"${none ? ' disabled' : ''}>${confirm}</button></div></div>`
}

const MERGE_LEFT = (n) =>
  n === 1
    ? '1 fichier décoché reste non commité : mis de côté le temps de la fusion, puis remis.'
    : `${n} fichiers décochés restent non commités : mis de côté le temps de la fusion, puis remis.`
const LAUNCH_LEFT = (n) =>
  n === 1
    ? '1 fichier décoché reste dans ce dossier, non commité : les filles ne l’auront pas.'
    : `${n} fichiers décochés restent dans ce dossier, non commités : les filles ne les auront pas.`

/** Carte « Fusion refusée » (MainDirtyCard), formulaire ouvert : la liste à cocher remplace le résumé. */
const mergeDirty = (files, opts) => `
<div class="main-dirty" data-testid="main-dirty">
  <div class="main-dirty-title">${i('triangle-alert', 13)}<span>Fusion refusée : le dossier principal a ${files.length} modifications non commitées.</span></div>
  <div class="main-dirty-why">La fusion dans main pourrait les écraser. Committez-les d’abord, ou mettez-les de côté : elles reviendront après la fusion.</div>
  ${chooser({ files, confirm: 'Committer puis fusionner', leftText: MERGE_LEFT, subject: 'feat: page des tâches : plan, maquettes, serveur', ...opts })}
</div>`

/** Carte « Sous-tâches » de la mère, trois filles finies, pied de fusion bloqué. */
function subtasks(scheme, dirtyHtml) {
  const t = TINT[scheme]
  const row = (title, branch, add, del, color) => `
<div class="subtask-row" data-state="done">
  <span class="subtask-info"><span class="subtask-title">${color ? `<span class="role-avatar s22" style="--role:${color};display:inline-grid;vertical-align:middle;margin-right:6px" data-state="done">${i('palette', 12)}</span>` : ''}${title}</span>
  <span class="subtask-meta"><span class="subtask-branch">${i('git-branch', 12)} ${branch}</span><span class="subtask-files"><span class="diff-added">+${add}</span> <span class="diff-removed">−${del}</span></span><span class="subtask-cost">0,18 $</span></span></span>
  <button class="subtask-status">${i('circle-check', 16)}</button>
  <button class="btn small">Ouvrir</button>
</div>`
  return `
<div class="subtasks" data-testid="subtasks">
  <div class="subtasks-head"><strong>Sous-tâches</strong><span class="muted"> · 3 finies</span><span class="subtasks-total">0,61 $</span></div>
  ${row('API et tests', 'bobine/20261117-2109-9700', 412, 3)}
  ${row('Page web', 'bobine/20261117-2109-4d35', 287, 12)}
  ${row('Page des tâches d’après plan.md', 'bobine/20261117-2100-d022', 96, 4, t.pink)}
  <div class="subtasks-merge">
    <div class="subtasks-merge-text">3 filles finies, prêtes à fusionner dans <strong>main</strong>.</div>
    ${dirtyHtml}
  </div>
</div>`
}

const MOTHER =
  userMsg('Découpe la page des tâches en trois filles, puis fusionne leur travail.') +
  toolDone('split', '3 conversations filles lancées') +
  agentMsg(
    '<p>Les trois filles ont fini. Pendant ce temps j’ai continué dans ce dossier : plan, maquettes, serveur, rien n’est encore commité.</p>',
    '6 min 40 s'
  )

const legend = (html) => `<div class="mq-legend"><p style="margin:0">${html}</p></div>`

/* ------------------------------------------------------------ préparation */

async function clearComposer(h) {
  // run.mjs vide la valeur du DOM sans que React le sache : on rétablit puis efface pour de bon.
  await h.ui
    .ev(`(() => { const i = document.querySelector('[data-testid=composer-input]'); i.focus()
    document.execCommand('selectAll'); document.execCommand('insertText', false, 'x')
    document.execCommand('selectAll'); document.execCommand('delete') })()`)
  await h.ui.press('Escape')
  await h.ui.ev(`document.activeElement?.blur()`)
}

async function scene(h, thread, title) {
  await h.css(CSS)
  await clearComposer(h)
  await h.stage('[data-testid=thread]', `<div class="thread">${thread}</div>`)
  await h.title(title)
  await h.ui.ev(
    `document.querySelectorAll('[data-testid=workspace-menu] .chip-label').forEach((n) => (n.textContent = 'taches'))`
  )
  // Cases intermédiaires (case de tête) : seulement en JS.
  await h.ui.ev(
    `document.querySelectorAll('[data-mq-head=some]').forEach((n) => (n.indeterminate = true))`
  )
}

/** Fait défiler le fil jusqu'à la carte, et la liste jusqu'au fichier `focus`. */
async function scrollTo(h, focus) {
  await h.ui.ev(`(() => {
    const card = document.querySelector('[data-maq] .main-dirty, [data-maq] .subtasks')
    card?.scrollIntoView({ block: 'end' })
    const list = document.querySelector('.commit-chooser-list.scroll')
    const row = list && [...list.querySelectorAll('li')].find((li) => li.textContent.includes(${JSON.stringify(focus ?? '')}))
    if (list && row && ${JSON.stringify(!!focus)}) list.scrollTop = row.offsetTop - list.clientHeight + row.offsetHeight * 3
  })()`)
}

async function typeRoles(h, text) {
  const ui = h.ui
  await ui.ev(`document.querySelector('[data-testid=composer-input]').focus()`)
  await ui.type(text)
  await ui.press('Escape')
  await ui.waitFor(`!!document.querySelector('[data-testid=role-destination]')`, 8000)
}

/** Avertissement de la fiche 240 (LaunchDirtyCard), formulaire ouvert, sous « Partira à… ». */
const launchDirty = (files, opts) => `
<div class="main-dirty mq-dirty" data-testid="launch-dirty">
  <div class="main-dirty-title">${i('triangle-alert', 13)}<span>Ce dossier a ${files.length} modifications non commitées : les 2 conversations filles ne les verront pas.</span></div>
  <div class="main-dirty-why">Chacune part du dernier commit (<code>main</code> · <code>9970242</code> « chore: initial commit »), dans son propre worktree. Committez d’abord pour qu’elles y soient.</div>
  ${chooser({ files, confirm: 'Committer puis lancer', leftText: LAUNCH_LEFT, subject: 'feat: plan, mockups and task server with tests', ...opts })}
</div>`

async function launchScene(h, opts) {
  await scene(
    h,
    userMsg('Écris le plan de la page des tâches, puis le serveur et ses tests.') +
      toolDone('file-pen', 'A écrit 5 fichiers') +
      agentMsg(
        '<p>C’est fait : <code>plan.md</code>, le serveur et ses tests. Rien n’est encore commité.</p>',
        '2 min 05 s'
      ),
    'Page des tâches : plan, serveur'
  )
  await typeRoles(
    h,
    '@ux-ui-expert @back-architect construisez la page des tâches d’après plan.md '
  )
  const keep = await h.ui.ev(`document.querySelector('[data-testid=role-destination]').outerHTML`)
  await h.stage(
    '[data-testid=role-destination]',
    `<div class="mq-composer-dock">${keep}${launchDirty(FIVE, opts)}</div>`
  )
  await h.ui.ev(
    `document.querySelectorAll('[data-mq-head=some]').forEach((n) => (n.indeterminate = true))`
  )
}

/* ---------------------------------------------------------------- écrans */

export const COMMIT_CHOOSER_SCREENS = [
  {
    id: 'f244-1-fusion-5-fichiers',
    agent: 'OpenCode',
    prepare: async (h, scheme) => {
      await scene(h, MOTHER + subtasks(scheme, mergeDirty(FIVE, {})), 'Page des tâches')
      await scrollTo(h)
      await h.stage(
        'body',
        legend(
          '<b>« Committer d’abord », 5 fichiers.</b> La liste entière, une case par fichier, toutes cochées (comme la vue Git d’un worktree). Pastille d’état : <code>M</code> modifié, <code>U</code> non suivi. Le message proposé cite les cochés.'
        ),
        'append'
      )
    }
  },
  {
    id: 'f244-2-fusion-40-fichiers',
    agent: 'OpenCode',
    tall: true,
    prepare: async (h, scheme) => {
      await scene(
        h,
        MOTHER + subtasks(scheme, mergeDirty(FORTY, { focus: '.env', tag: true })),
        'Page des tâches'
      )
      await scrollTo(h, '.env')
      await h.stage(
        'body',
        legend(
          '<b>40 fichiers.</b> La liste défile dans un cadre (8 lignes et demie) ; « Tout afficher » la déplie en entier. Ici défilée jusqu’au <code>.env</code>, non suivi et non ignoré. Étiquette « secret ? » : proposition (Q2), le fichier reste coché.'
        ),
        'append'
      )
    }
  },
  {
    id: 'f244-3-fusion-un-decoche',
    agent: 'OpenCode',
    tall: true,
    prepare: async (h, scheme) => {
      await scene(
        h,
        MOTHER + subtasks(scheme, mergeDirty(FORTY, { off: new Set(['.env']), focus: '.env' })),
        'Page des tâches'
      )
      await scrollTo(h, '.env')
      await h.stage(
        'body',
        legend(
          '<b>Le <code>.env</code> décoché.</b> « 39 sur 40 cochés », case de tête intermédiaire ; le message ne compte plus que 39 fichiers. Ligne grise : ce que devient le décoché pendant la fusion (Q1 : mis de côté, puis remis).'
        ),
        'append'
      )
    }
  },
  {
    id: 'f244-4-fusion-tout-decoche',
    agent: 'OpenCode',
    prepare: async (h, scheme) => {
      await scene(
        h,
        MOTHER + subtasks(scheme, mergeDirty(FIVE, { off: new Set(FIVE.map(([p]) => p)) })),
        'Page des tâches'
      )
      await scrollTo(h)
      await h.stage(
        'body',
        legend(
          '<b>Tout décoché.</b> « Committer puis fusionner » est désactivé ; la raison est écrite à côté. Le message proposé est vide (rien à décrire).'
        ),
        'append'
      )
    }
  },
  {
    id: 'f244-5-lancement-5-fichiers',
    agent: 'OpenCode',
    prepare: async (h) => {
      await launchScene(h, {})
      await h.stage(
        'body',
        legend(
          '<b>Lancement de filles (fiche 240), « Committer d’abord ».</b> Le même composant sous « Partira à… » ; seul le bouton change (« Committer puis lancer »).'
        ),
        'append'
      )
    }
  },
  {
    id: 'f244-6-lancement-un-decoche',
    agent: 'OpenCode',
    prepare: async (h) => {
      await launchScene(h, { off: new Set(['test/api.test.js']) })
      await h.stage(
        'body',
        legend(
          '<b>Un fichier décoché au lancement.</b> Il reste dans le dossier de la mère, non commité ; la ligne grise dit que les filles ne l’auront pas.'
        ),
        'append'
      )
    }
  }
]
