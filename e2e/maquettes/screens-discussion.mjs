// Maquettes de la fiche 224 (espace Discussion, à côté de l'espace Code). Sur la vraie fenêtre,
// avec les vraies classes de l'app : seuls les morceaux nouveaux sont injectés.
import { i } from './icons.mjs'

/* --------------------------------------------------------- barre latérale */

const item = (title, { active = false } = {}) =>
  `<div class="history-item sidebar-item ${active ? 'active' : ''}"><button class="history-open"><span class="row-main"><span class="row-title"><span class="label">${title}</span></span></span></button></div>`

const section = (label, body) =>
  `<section class="sidebar-group"><div class="sidebar-section"><button class="section-toggle" aria-expanded="true"><span class="section-label">${label}</span><span class="section-chevron">${i('chevron-down', 13)}</span></button></div>${body}</section>`

/** Sélecteur d'espace, en tête de la barre latérale. */
const switcher = (space) =>
  `<div class="mq-seg" role="tablist"><button class="${space === 'code' ? 'on' : ''}">${i('code-xml', 14)}Code<kbd>⌘1</kbd></button><button class="${space === 'discussion' ? 'on' : ''}">${i('message-circle', 14)}Discussion<kbd>⌘2</kbd></button></div>`

const ACTIVE = 'Ventes du T3 par région'

/** Barre latérale de l'espace Discussion : pas d'Équipe, pas de dossiers, pas de tâches planifiées. */
async function discussionSidebar(h, active = ACTIVE) {
  await h.stage(
    '[data-testid=sidebar-fixed]',
    `<div class="sidebar-fixed">${switcher('discussion')}<button class="sidebar-item primary"><span class="icon-badge">${i('plus', 14)}</span><span class="label">Nouvelle discussion</span></button><button class="sidebar-item"><span class="icon-badge plain">${i('chart-column', 15)}</span><span class="label">Mon activité</span><kbd class="sidebar-kbd">⇧⌘U</kbd></button></div>`
  )
  await h.stage(
    '.sidebar-scroll',
    `<div class="sidebar-scroll">${section('Épinglées', item('Notes du comité de direction'))}${section(
      'Récentes',
      [
        ACTIVE,
        'E-mail de relance au fournisseur',
        'Résumé du contrat de maintenance',
        'Différence entre OAuth et OIDC',
        'Reformuler l’annonce de l’équipe'
      ]
        .map((t) => item(t, { active: t === active }))
        .join('')
    )}</div>`
  )
}

/* ----------------------------------------------------------------- styles */

const CSS = `
.mq-seg { display: flex; gap: 2px; margin: 0 0 12px; padding: 3px; border-radius: 9px; background: var(--surface-2); border: 1px solid var(--border); }
.mq-seg button { flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 28px; border: 0; border-radius: 7px; background: transparent; color: var(--muted); font: inherit; font-size: 13px; }
.mq-seg button.on { background: var(--surface); color: var(--text); box-shadow: 0 1px 2px rgba(0,0,0,.08); font-weight: 600; }
.mq-seg kbd { font: inherit; font-size: 10.5px; color: var(--muted); opacity: .7; font-weight: 400; }
.mq-dochint { margin-top: 10px; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 14px; border: 1.5px dashed var(--border-strong); border-radius: 12px; color: var(--muted); font-size: 13px; }
.mq-filecard { display: flex; align-items: center; gap: 10px; margin: 10px 0 4px; padding: 10px 12px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); max-width: 560px; }
.mq-filecard .mq-ficon { width: 36px; height: 36px; border-radius: 8px; display: grid; place-items: center; flex-shrink: 0; color: #fff; }
.mq-filecard .mq-ficon.word { background: #2e6edb; } .mq-filecard .mq-ficon.excel { background: #2c8151; }
.mq-filecard .mq-fname { font-weight: 600; color: var(--text); font-size: 14px; }
.mq-filecard .mq-fmeta { color: var(--muted); font-size: 12.5px; }
.mq-filecard .grow { flex: 1; }
.mq-filecard .btn { white-space: nowrap; }
.mq-filecard .mq-fmeta, .mq-filecard .mq-fname { white-space: nowrap; }
.mq-docs { display: flex; flex-direction: column; width: 100%; height: 100%; }
.mq-docs-list { padding: 10px 12px; border-bottom: 1px solid var(--border); }
.mq-docs-head { display: flex; align-items: center; justify-content: space-between; font-size: 11.5px; font-weight: 600; letter-spacing: .02em; text-transform: uppercase; color: var(--muted); margin: 2px 4px 8px; }
.mq-doc { display: flex; align-items: center; gap: 10px; padding: 7px 8px; border-radius: 8px; font-size: 13.5px; color: var(--text); }
.mq-doc.on { background: var(--surface-2); }
.mq-doc .mq-dmeta { margin-left: auto; color: var(--muted); font-size: 12px; }
.mq-doc .mq-dot { width: 22px; height: 22px; border-radius: 5px; display: grid; place-items: center; color: #fff; flex-shrink: 0; }
.mq-doc .mq-dot.word { background: #2e6edb; } .mq-doc .mq-dot.excel { background: #2c8151; }
.mq-docs-drop { margin-top: 8px; padding: 9px; border: 1.5px dashed var(--border); border-radius: 9px; color: var(--muted); font-size: 12.5px; text-align: center; }
.mq-preview { flex: 1; overflow: hidden; padding: 14px 16px; }
.mq-preview-bar { display: flex; gap: 8px; align-items: center; margin-bottom: 12px; color: var(--text); }
.mq-preview-bar .grow { flex: 1; }
.mq-page { background: #fff; color: #222; border-radius: 6px; box-shadow: 0 1px 4px rgba(0,0,0,.15); padding: 26px 28px; font-size: 12.5px; line-height: 1.5; }
.mq-page h1 { font-size: 18px; margin: 0 0 4px; color: #1f3d7a; } .mq-page h2 { font-size: 13.5px; margin: 14px 0 4px; color: #1f3d7a; }
.mq-page p, .mq-page td { margin: 0 0 6px; color: #222; } .mq-page table { border-collapse: collapse; width: 100%; margin: 6px 0; } .mq-page td, .mq-page th { border: 1px solid #ccd; padding: 3px 6px; text-align: left; font-size: 12px; } .mq-page th { background: #eef2fa; }
.mq-sheet table { border-collapse: collapse; width: 100%; font-size: 12.5px; } .mq-sheet td, .mq-sheet th { border: 1px solid var(--border); padding: 4px 8px; color: var(--text); text-align: left; } .mq-sheet th { background: var(--surface-2); font-weight: 600; }
.mq-plain { margin: 0 0 4px; color: var(--text); }
.mq-tech { margin-top: 8px; color: var(--muted); font-size: 12.5px; }
.mq-tech code { font-family: var(--font-mono); font-size: 12px; }
.mq-dialog { position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 520px; z-index: 60; }
.mq-dialog .mq-field { display: flex; align-items: center; gap: 8px; margin: 12px 0; color: var(--muted); }
.mq-dialog code { font-family: var(--font-mono); font-size: 12px; }
`

/* --------------------------------------------------------------- morceaux */

const fileCard = (kind, name, meta) =>
  `<div class="mq-filecard"><span class="mq-ficon ${kind}">${i(kind === 'word' ? 'file-text' : 'sheet', 18)}</span><span><div class="mq-fname">${name}</div><div class="mq-fmeta">${meta}</div></span><span class="grow"></span><button class="btn small">Ouvrir</button><button class="btn small ghost">Enregistrer sous…</button></div>`

const userMsg = (text, attachment = '') =>
  `<div class="msg-user-group">${attachment ? `<div class="msg-attachments"><span class="attachment file">${i('sheet', 14)}<span>${attachment}</span></span></div>` : ''}<div class="msg-user">${text}</div><div class="msg-user-actions"><time class="msg-time">10:12</time></div></div>`
const agentMsg = (html, duration = '') =>
  `<div class="msg-agent-group"><div class="msg-agent"><div class="markdown">${html}</div></div>${duration ? `<div class="msg-agent-actions"><time class="msg-time">10:12</time><span class="msg-duration">${duration}</span></div>` : ''}</div>`
const toolDone = (icon, label) =>
  `<div data-testid="tool" data-status="completed"><details class="tool"><summary class="tool-row">${i(icon, 15, 'tool-icon')}<span class="tool-title"><span>${label}</span></span><span class="tool-state completed">${i('check', 14)}</span>${i('chevron-right', 14, 'chevron tool-icon')}</summary></details></div>`

const ROWS = [
  ['Ouest', '412 k€', '486 k€', '+18 %'],
  ['Île-de-France', '538 k€', '571 k€', '+6 %'],
  ['Sud', '301 k€', '318 k€', '+6 %'],
  ['Nord', '244 k€', '229 k€', '−6 %']
]
const table = (cls = '') =>
  `<table class="${cls}"><tr><th>Région</th><th>T2</th><th>T3</th><th>Évolution</th></tr>${ROWS.map((r) => `<tr><td>${r.join('</td><td>')}</td></tr>`).join('')}</table>`

const SUMMARY = `<p>Le T3 est en hausse de <b>8 %</b> sur le T2, porté par l’Ouest ; le Nord recule.</p>
<div class="mq-sheet">${table()}</div>
<p>Voulez-vous une synthèse en Word pour le comité ?</p>`

const thread = (inner) => `<div class="thread">${inner}</div>`
const T1 =
  userMsg(
    'Voici les ventes du trimestre. Fais-moi un point par région, comparé au T2.',
    'Ventes 2026 T2-T3.xlsx'
  ) +
  toolDone('file-search', 'A lu « Ventes 2026 T2-T3.xlsx »') +
  agentMsg(SUMMARY, '14 s')
const T2 = userMsg('Oui, une page, avec le tableau et trois points à retenir.')

/** Panneau Documents : liste en haut, aperçu du document choisi en dessous. */
const docsPanel = ({ word = false } = {}) => {
  const docs = [
    word && ['word', 'Synthèse ventes T3.docx', 'créé par IBM Bob · 24 Ko', true],
    ['excel', 'Ventes 2026 T2-T3.xlsx', 'déposé · 48 Ko', !word]
  ].filter(Boolean)
  const preview = word
    ? `<div class="mq-page"><h1>Ventes du troisième trimestre</h1><p style="color:#666">Comité de direction — 18 novembre 2026</p><h2>À retenir</h2><p>1. Hausse de 8 % sur le T2, portée par l’Ouest (+18 %).<br>2. L’Île-de-France et le Sud progressent de 6 %.<br>3. Le Nord recule de 6 % : à examiner avec l’équipe régionale.</p><h2>Ventes par région</h2>${table()}</div>`
    : `<div class="mq-sheet"><table><tr><th></th><th>A · Région</th><th>B · Mois</th><th>C · Ventes</th></tr>${[
        ['Ouest', 'juillet', '158 200'],
        ['Ouest', 'août', '149 900'],
        ['Ouest', 'septembre', '177 900'],
        ['Île-de-France', 'juillet', '186 400'],
        ['Île-de-France', 'août', '172 300'],
        ['Île-de-France', 'septembre', '212 300'],
        ['Sud', 'juillet', '104 100'],
        ['Sud', 'août', '98 700'],
        ['Nord', 'juillet', '80 900']
      ]
        .map((r, n) => `<tr><th>${n + 2}</th><td>${r.join('</td><td>')}</td></tr>`)
        .join('')}</table></div>`
  const name = word ? 'Synthèse ventes T3.docx' : 'Ventes 2026 T2-T3.xlsx'
  const rows = docs
    .map(
      ([k, n, m, on]) =>
        `<div class="mq-doc ${on ? 'on' : ''}"><span class="mq-dot ${k}">${i(k === 'word' ? 'file-text' : 'sheet', 13)}</span>${n}<span class="mq-dmeta">${m}</span></div>`
    )
    .join('')
  return `<aside class="side-panel mq-panel"><div class="side-panel-resize"></div>
  <header class="side-panel-head drag"><div class="side-panel-tabs no-drag" role="tablist"><div class="side-panel-tab active"><button class="side-panel-tab-main">${i('files', 14)}<span class="side-panel-tab-label">Documents</span></button></div></div><span class="grow"></span><button class="icon-button no-drag">${i('maximize-2', 15)}</button><button class="icon-button no-drag">${i('x', 15)}</button></header>
  <div class="side-panel-body" style="padding:0;display:flex;overflow:hidden"><div class="mq-docs">
    <div class="mq-docs-list"><div class="mq-docs-head"><span>Documents de la discussion · ${docs.length}</span><button class="icon-button small" title="Ajouter un document">${i('plus', 14)}</button></div>${rows}
    <div class="mq-docs-drop">Glissez un document ici pour l’ajouter</div></div>
    <div class="mq-preview"><div class="mq-preview-bar"><b style="font-size:13.5px">${name}</b><span class="grow"></span><button class="btn small">Ouvrir</button><button class="btn small ghost">Enregistrer sous…</button></div>${preview}</div>
  </div></div></aside>`
}

/** Ce que l'espace Discussion retire de la fenêtre (dossier, branche, mode, Équipe). */
const dressDiscussion = (h) =>
  h.ui.ev(`(() => {
    const hide = (s) => document.querySelectorAll(s).forEach((n) => (n.style.display = 'none'))
    hide('[data-testid=composer-context]'); hide('[data-testid=mode-chip]'); hide('[data-testid=team-section]')
  })()`)

/** L'agent montré partout : IBM Bob (sans puce de modèle). */
const asBob = (h) =>
  h.ui.ev(`(() => {
    const set = (s, v) => document.querySelectorAll(s).forEach((n) => (n.textContent = v))
    set('.sidebar-footer .name', 'IBM Bob')
    set('[data-testid=agent-menu] .chip-label', 'IBM Bob')
    const m = document.querySelector('[data-testid=model-chip]'); if (m) m.style.display = 'none'
    const inp = document.querySelector('[data-testid=composer-input]')
    if (inp && inp.placeholder.startsWith('Répondre')) inp.placeholder = 'Répondre à IBM Bob…'
  })()`)

async function openThread(h, title) {
  const { ui } = h
  if (!(await ui.ev(`!!document.querySelector('.main-title-text')`))) {
    await ui.click(`document.querySelector('[data-testid=history-item] .history-open')`)
    await ui.waitFor(`!!document.querySelector('.main-title-text')`)
    await new Promise((r) => setTimeout(r, 500))
  }
  await h.css(CSS)
  await asBob(h)
  if (title) await h.title(title)
}

async function discussion(h, inner, { panel = '' } = {}) {
  await openThread(h, ACTIVE)
  await h.stage('[data-testid=thread]', thread(inner))
  await dressDiscussion(h)
  await discussionSidebar(h)
  if (panel) await h.openPanel(panel)
}

/* ----------------------------------------------------------------- écrans */

export const DISCUSSION_SCREENS = [
  {
    id: 'disc-e1-code',
    title: 'E1 — Espace Code, inchangé, avec le sélecteur Code | Discussion',
    agent: 'IBM Bob',
    prepare: async (h) => {
      await openThread(h, 'Filtre par statut dans la barre d’outils')
      await h.stage(
        '[data-testid=thread]',
        thread(
          userMsg('Ajoute le filtre par statut dans la barre d’outils (point 4 du README).') +
            toolDone('layers', '3 lectures') +
            toolDone('file-pen', 'A modifié src/Toolbar.tsx') +
            agentMsg(
              '<p>J’ai ajouté le filtre « Tous les statuts », « Lu », « En cours » et « À lire », combinable avec la recherche et le tri. Les tests passent.</p>',
              '1 min 12 s'
            )
        )
      )
      await h.stage('[data-testid=sidebar-fixed]', switcher('code'), 'prepend')
    }
  },
  {
    id: 'disc-e2-accueil',
    title: 'E2 — Espace Discussion : accueil, sans dossier ni branche, documents à glisser',
    agent: 'IBM Bob',
    prepare: async (h) => {
      const { ui } = h
      await ui.click(ui.$('new-conversation'))
      await ui.waitFor(`!!document.querySelector('[data-testid=welcome]')`)
      await new Promise((r) => setTimeout(r, 700))
      await h.css(CSS)
      await asBob(h)
      await dressDiscussion(h)
      await discussionSidebar(h, '')
      await ui.ev(`(() => {
        document.querySelector('.greeting').lastChild.textContent = 'Bonjour, sur quoi travaille-t-on ?'
        document.querySelector('[data-testid=composer-input]').placeholder = 'Posez une question, demandez un texte, joignez un document…'
        document.querySelector('.welcome-hint').style.display = 'none'
      })()`)
      const suggestions = [
        ['file-text', 'Résume un document'],
        ['table', 'Fais un tableau'],
        ['mail', 'Rédige un e-mail'],
        ['lightbulb', 'Explique une notion']
      ]
        .map(([ic, t]) => `<button class="suggestion">${i(ic, 15)}${t}</button>`)
        .join('')
      await h.stage(
        '[data-testid=suggestions]',
        `<div><div class="suggestions">${suggestions}</div><div class="mq-dochint">${i('file-up', 16)}Glissez ici des PDF, Word, Excel ou images : ils restent avec la discussion.</div></div>`
      )
    }
  },
  {
    id: 'disc-e3-excel',
    title: 'E3 — Une discussion sur un Excel déposé ; panneau Documents avec aperçu',
    agent: 'IBM Bob',
    prepare: (h) => discussion(h, T1, { panel: docsPanel() })
  },
  {
    id: 'disc-e4-autorisation',
    title: 'E4 — Autorisation dite en clair (commande repliée sous « Détails techniques »)',
    agent: 'IBM Bob',
    prepare: (h) =>
      discussion(
        h,
        T1 +
          T2 +
          agentMsg('<p>Je prépare le document Word.</p>') +
          `<div class="permission-card"><div class="pc-head">${i('shield-alert', 18, 'pc-icon')}<div><div class="pc-title">IBM Bob veut lancer un petit programme</div><div class="pc-sub">Pour fabriquer « Synthèse ventes T3.docx » dans les documents de cette discussion.</div></div></div>
          <div class="pc-body"><p class="mq-plain">Il lit votre fichier Excel et écrit un nouveau document Word. Vos fichiers d’origine ne sont pas modifiés.</p><details class="mq-tech"><summary>Détails techniques</summary><code>python3 make_report.py "Ventes 2026 T2-T3.xlsx"</code></details></div>
          <div class="pc-actions"><button class="btn ghost">Refuser</button><button class="btn primary">Autoriser</button></div></div>`
      )
  },
  {
    id: 'disc-e5-document',
    title: 'E5 — Document produit : carte dans le fil, aperçu dans le panneau',
    agent: 'IBM Bob',
    prepare: (h) =>
      discussion(
        h,
        T1 +
          T2 +
          toolDone('file-plus', 'A créé « Synthèse ventes T3.docx »') +
          agentMsg(
            `<p>Voici la synthèse d’une page : les trois points à retenir, puis le tableau par région.</p>${fileCard('word', 'Synthèse ventes T3.docx', 'Document Word · 24 Ko')}`,
            '41 s'
          ),
        { panel: docsPanel({ word: true }) }
      )
  },
  {
    id: 'disc-e6-continuer',
    title: 'E6 — « Continuer dans un projet… » : vers l’espace Code, documents copiés si on veut',
    agent: 'IBM Bob',
    prepare: async (h) => {
      await discussion(
        h,
        T1 +
          T2 +
          agentMsg(
            `<p>Voici la synthèse d’une page.</p>${fileCard('word', 'Synthèse ventes T3.docx', 'Document Word · 24 Ko')}`,
            '41 s'
          )
      )
      await h.stage(
        'body',
        `<div><div class="dialog-overlay"></div><div class="dialog confirm-dialog mq-dialog"><div class="confirm-title">Continuer dans un projet</div>
        <p class="confirm-text">Une nouvelle conversation s’ouvre dans l’espace Code, dans le dossier choisi. Cette discussion lui est passée avec votre premier message ; elle reste telle quelle ici.</p>
        <div class="mq-field">Dossier<button class="chip">${i('folder', 14)}<span class="chip-label">tableau-de-bord-ventes</span>${i('chevron-down', 13)}</button></div>
        <label class="confirm-option"><input type="checkbox" checked> Copier les 2 documents dans le projet (dossier <code>documents/</code>)</label>
        <div class="confirm-actions"><button class="btn ghost">Annuler</button><button class="btn primary">Continuer dans Code</button></div></div></div>`,
        'append'
      )
    }
  }
]
