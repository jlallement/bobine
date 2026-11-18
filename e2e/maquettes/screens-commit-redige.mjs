// Maquettes de la fiche 246 (ADR-0056) : le message de commit est rédigé par l'agent, dans une
// session jetable, puis modifiable ; repli en anglais déduit des fichiers. Sur la vraie fenêtre :
// vraie vue Git d'une conversation ordinaire, vrais fichiers modifiés, vrai formulaire de commit
// (« Committer » cliqué) ; seul l'état de la rédaction est injecté dans le formulaire.
// Écran 4 : la même rédaction dans « Committer d'abord » de la carte « Fusion refusée » (scène de
// la fiche 244). node e2e/maquettes/run.mjs light f246
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { i, resolveIcons } from './icons.mjs'
import { MERGE_CARD_CSS, mergeCardScene, scrollToCard } from './screens-commit-choisi.mjs'

/** Fichiers du chantier « filtre par statut » de la conversation (carnet de lecture). */
const FILES = {
  'public/index.html':
    '<!doctype html>\n<header class="toolbar">\n  <h1>Carnet de lecture</h1>\n  <select id="status-filter">\n    <option value="">Tous</option>\n    <option value="to-read">À lire</option>\n    <option value="reading">En cours</option>\n    <option value="read">Lu</option>\n  </select>\n</header>\n<ul id="books"></ul>\n<script type="module" src="app.js"></script>\n',
  'public/app.js':
    "import { applyFilter, filterFromUrl } from './filters.js'\nconst list = document.getElementById('books')\nconst select = document.getElementById('status-filter')\nselect.value = filterFromUrl()\nselect.addEventListener('change', () => applyFilter(list, select.value))\n",
  'public/style.css':
    '.toolbar { display: flex; gap: 12px; align-items: center; }\n#status-filter { margin-left: auto; }\n',
  'public/filters.js':
    "export function filterFromUrl() { return new URL(location.href).searchParams.get('status') ?? '' }\nexport function applyFilter(list, status) {\n  for (const li of list.children) li.hidden = !!status && li.dataset.status !== status\n  const url = new URL(location.href)\n  if (status) url.searchParams.set('status', status); else url.searchParams.delete('status')\n  history.replaceState(null, '', url)\n}\n"
}

/** Ce que l'agent factice rendrait : la forme des réponses mesurées d'OpenCode (fiche 246). */
const AGENT_MESSAGE = `feat: add a reading status filter to the toolbar

Filter the book list by status (to read, reading, read) from a new
select in the toolbar, and keep the choice in the URL.`

/** Repli (`fallbackCommitMessage`) : type `chore`, sujet `filesSubject`, liste des fichiers. */
const FALLBACK = `chore: update 4 files in public

- public/app.js
- public/filters.js (new)
- public/index.html
- public/style.css`

const FALLBACK_FIVE = `chore: update 5 files

- plan.md
- server/index.js
- server/routes/tasks.js (new)
- public/app.js
- test/api.test.js (new)`

/* ----------------------------------------------------------------- styles */

const CSS = `
.commit-draft { display: flex; align-items: flex-start; gap: 6px; min-height: 22px; color: var(--text-2); font-size: 12.5px; line-height: 1.4; }
.commit-draft svg { flex-shrink: 0; color: var(--muted); margin-top: 2px; }
.commit-draft > span:not(.grow) { flex: 1; min-width: 0; }
.commit-draft .commit-draft-time { color: var(--muted); font-variant-numeric: tabular-nums; }
.commit-draft .grow { display: none; }
.commit-draft .link-button { font-size: 12px; white-space: nowrap; }
.commit-draft.received svg { color: var(--accent); }
.commit-draft.fallback svg { color: var(--warn); }
.worktree-form textarea[data-drafting] { background: var(--surface-2); color: var(--muted); cursor: progress; }
.worktree-form textarea[data-drafting]::placeholder { color: var(--muted); font-style: italic; font-family: var(--font-ui, inherit); }
.worktree-form .btn.primary:disabled { opacity: .45; cursor: not-allowed; }
`

/* --------------------------------------------------------------- morceaux */

const drafting = (agent, seconds) =>
  `<div class="commit-draft drafting" role="status">${i('loader-circle', 13, 'spin')}<span>Rédaction par ${agent}… <span class="commit-draft-time">${seconds} s</span></span><span class="grow"></span><button class="link-button">Arrêter</button></div>`

const received = (agent, seconds, count) =>
  `<div class="commit-draft received" role="status">${i('sparkles', 13)}<span>Rédigé par ${agent} en ${seconds} s, d’après ${count} fichiers et la mémoire du projet</span><span class="grow"></span><button class="link-button">Rédiger à nouveau</button></div>`

const fallback = (reason) =>
  `<div class="commit-draft fallback" role="status">${i('triangle-alert', 13)}<span>${reason} : message déduit des fichiers.</span><span class="grow"></span><button class="link-button">Réessayer</button></div>`

/**
 * Pose l'état de la rédaction dans le formulaire de commit (`.worktree-form`) sous `root` : la ligne
 * d'état sous le libellé (rédaction en cours) ou sous le champ (reçu, repli), le texte du champ, et
 * « Committer » désactivé pendant la rédaction.
 */
async function draftState(h, root, { line, text, waiting = false }) {
  const markup = JSON.stringify(await resolveIcons(line))
  await h.ui.ev(`(() => {
    const form = document.querySelector(${JSON.stringify(root)} + ' .worktree-form')
    if (!form) throw new Error('formulaire absent')
    const area = form.querySelector('textarea')
    area.value = ${JSON.stringify(text)}
    area.rows = ${waiting} ? 4 : 7
    const primary = form.querySelector('.worktree-form-actions .btn.primary')
    if (${waiting}) {
      area.disabled = true
      area.setAttribute('data-drafting', '')
      area.placeholder = 'L’agent rédige le message d’après les fichiers cochés et la mémoire du projet.'
      primary.disabled = true
    }
    const t = document.createElement('template'); t.innerHTML = ${markup}
    const n = t.content.firstElementChild; n.setAttribute('data-maq', '')
    if (${waiting}) form.querySelector('label').after(n)
    else area.after(n)
  })()`)
}

/** Fichiers modifiés dans le dossier de la conversation (une fois), puis vue Git et « Committer ». */
async function gitViewWithForm(h) {
  const ui = h.ui
  const git = (...a) =>
    execFileSync('git', ['-c', 'user.name=e2e', '-c', 'user.email=e@x.invalid', ...a], {
      cwd: h.workspace
    })
  // Une première version commitée de trois fichiers (pastilles M), puis le chantier (filters.js, U).
  if (!existsSync(join(h.workspace, 'public', 'app.js'))) {
    mkdirSync(join(h.workspace, 'public'), { recursive: true })
    writeFileSync(join(h.workspace, 'public/index.html'), '<!doctype html>\n<ul id="books"></ul>\n')
    writeFileSync(
      join(h.workspace, 'public/app.js'),
      "const list = document.getElementById('books')\n"
    )
    writeFileSync(join(h.workspace, 'public/style.css'), '.toolbar { display: flex; }\n')
    git('add', '.')
    git('commit', '-q', '-m', 'feat: book list page')
  }
  for (const [path, content] of Object.entries(FILES))
    writeFileSync(join(h.workspace, path), content)
  await h.stage(
    '[data-testid=thread]',
    `<div class="thread"><div class="msg-user-group"><div class="msg-user">Ajoute le filtre par statut dans la barre d’outils (point 4 du README).</div></div><div class="msg-agent-group"><div class="msg-agent"><div class="markdown"><p>C’est fait : un menu « Statut » dans la barre d’outils (<code>index.html</code>), le filtrage dans <code>filters.js</code>, et le choix gardé dans l’adresse de la page. Rien n’est commité.</p></div></div><div class="msg-agent-actions"><time class="msg-time">10:42</time><span class="msg-duration">1 min 12 s</span></div></div></div>`
  )
  await h.css(CSS)
  await h.title('Ajoute le filtre par statut dans la barre d’outils')
  // Pas de modification de l'agent dans ce fil : panneau, puis onglet Modifications (« + »).
  const tab = `document.querySelector('.side-panel-tab[data-tab=changes]')`
  if (!(await ui.ev(`!!${ui.$('side-panel')}`))) await ui.click(ui.$('panel-toggle'))
  await ui.waitFor(`!!${ui.$('side-panel')}`)
  if (await ui.ev(`!!${tab}`)) await ui.click(tab)
  else {
    await ui.click(ui.$('panel-more'))
    await ui.waitFor(`!!${ui.$('panel-more-menu')}`)
    await ui.click(`${ui.$('panel-more-menu')}.querySelector('[data-tab=changes]')`)
  }
  await ui.waitFor(`!!${ui.$('changes-tab')}`)
  await ui.waitFor(`!!${ui.$('changes-view-git')}`)
  await ui.click(ui.$('changes-view-git'))
  await ui.waitFor(`!!${ui.$('changes-commit')}`, 10000)
  await ui.waitFor(`document.querySelectorAll('[data-testid=changes-file]').length === 4`, 10000)
  await ui.click(ui.$('changes-commit'))
  await ui.waitFor(`!!${ui.$('changes-commit-form')}`)
  await ui.ev(`document.activeElement?.blur()`)
}

export const COMMIT_DRAFT_SCREENS = [
  {
    id: 'f246-1-redaction',
    agent: 'OpenCode',
    prepare: async (h) => {
      await gitViewWithForm(h)
      await draftState(h, '[data-testid=changes-commit-bar]', {
        line: drafting('OpenCode', 3),
        text: '',
        waiting: true
      })
    }
  },
  {
    id: 'f246-2-recu',
    agent: 'OpenCode',
    prepare: async (h) => {
      await gitViewWithForm(h)
      await draftState(h, '[data-testid=changes-commit-bar]', {
        line: received('OpenCode', 4, 4),
        text: AGENT_MESSAGE
      })
    }
  },
  {
    id: 'f246-3-repli',
    agent: 'OpenCode',
    prepare: async (h) => {
      await gitViewWithForm(h)
      await draftState(h, '[data-testid=changes-commit-bar]', {
        line: fallback('OpenCode n’a pas répondu en 45 s'),
        text: FALLBACK
      })
    }
  },
  {
    id: 'f246-4-carte-fusion',
    agent: 'IBM Bob',
    prepare: async (h, scheme) => {
      await mergeCardScene(h, scheme)
      await h.css(MERGE_CARD_CSS + CSS)
      await draftState(h, '[data-maq] .main-dirty', {
        line: drafting('IBM Bob', 6),
        text: '',
        waiting: true
      })
      await scrollToCard(h)
    }
  },
  {
    id: 'f246-5-carte-fusion-bob-connexion',
    agent: 'IBM Bob',
    prepare: async (h, scheme) => {
      await mergeCardScene(h, scheme)
      await h.css(MERGE_CARD_CSS + CSS)
      await draftState(h, '[data-maq] .main-dirty', {
        line: fallback('IBM Bob demande une connexion (ouvrez la conversation pour la renouveler)'),
        text: FALLBACK_FIVE
      })
      await scrollToCard(h)
    }
  }
]
