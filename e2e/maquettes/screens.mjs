// Écrans maquettés : chaque écran prépare l'app (DOM injecté), puis la capture est prise.
import { i } from './icons.mjs'
import { agent, site, toolDone, toolRunning, user, working } from './parts.mjs'

/* ------------------------------------------------------------------ fil */
export const threadWrap = (inner) => `<div class="thread" data-testid="thread">${inner}</div>`

const patchStart =
  user('Ajoute le filtre par statut dans la barre d’outils (point 4 du README).') +
  toolDone('layers', '3 lectures') +
  agent(
    '<p>J’ajoute les choix « Tous les statuts », « Lu », « En cours » et « À lire », combinables avec la recherche et le tri. Le résumé et l’export CSV resteront globaux.</p>'
  )

/* ------------------------------------------------------------- panneau */
export const panel = (
  tabs,
  body,
  max = tabs.includes('minimize-2')
) => `<aside class="side-panel mq-panel">
  <div class="side-panel-resize"></div>
  <header class="side-panel-head drag"><div class="side-panel-tabs no-drag" role="tablist">${tabs}</div>
  <button class="icon-button small no-drag">${i('plus', 15)}</button><span class="grow"></span>
  <button class="icon-button no-drag">${i(max ? 'minimize-2' : 'maximize-2', 15)}</button><button class="icon-button no-drag">${i('x', 15)}</button></header>
  <div class="side-panel-body" style="padding:0;display:flex;overflow:hidden">${body}</div></aside>`
const tab = (icon, label, active) =>
  `<div class="side-panel-tab ${active ? 'active' : ''}"><button class="side-panel-tab-main">${i(icon, 14)}<span class="side-panel-tab-label">${label}</span></button>${active ? `<button class="side-panel-tab-close">${i('x', 12)}</button>` : ''}</div>`
export const browserTabs =
  tab('globe', 'Navigateur', true) + tab('file-diff', 'Modifications', false)

export function browserBar({ device = '', zoom = '', comment = false, menu = '' } = {}) {
  const deviceCtl = device
    ? `<span class="mq-device"><button type="button" class="chip mq-on">${i('smartphone', 14)}<span class="chip-label">${device}</span>${i('chevron-down', 13)}</button>${menu}</span>`
    : ''
  return `<form class="browser-bar">
    <button type="button" class="icon-button small">${i('arrow-left', 15)}</button>
    <button type="button" class="icon-button small" disabled>${i('arrow-right', 15)}</button>
    <button type="button" class="icon-button small">${i('rotate-cw', 14)}</button>
    <span class="mq-addr"><input class="browser-address" value="http://localhost:3000/">${zoom ? `<span class="mq-zoom">${zoom}</span>` : ''}</span>
    ${deviceCtl}
    <button type="button" class="icon-button small ${comment ? 'mq-on' : ''}" aria-label="Annoter">${i('message-square-plus', 15)}</button>
    <button type="button" class="icon-button small">${i('image-plus', 15)}</button>
  </form>`
}

const browserThread = threadWrap(
  user('La liste des livres déborde quand la fenêtre est étroite, regarde.') +
    agent('<p>J’ouvre la page dans le navigateur.</p>') +
    toolDone('layers', '2 actions dans le navigateur') +
    agent(
      '<p>Le tableau garde sa largeur de bureau : sous 600 px, il déborde de l’écran. Je propose de l’afficher en cartes, une par livre.</p>'
    )
)

/* -------------------------------------------------------------- réglages */
const NAV = [
  [
    ['settings', 'Général'],
    ['palette', 'Apparence'],
    ['bell', 'Notifications'],
    ['keyboard', 'Raccourcis clavier']
  ],
  [
    ['messages-square', 'Conversations'],
    ['bot', 'Agents'],
    ['plug', 'Serveurs MCP'],
    ['square-slash', 'Commandes']
  ],
  [
    ['chart-column', 'Consommation'],
    ['shield', 'Confidentialité'],
    ['hard-drive', 'Données'],
    ['stethoscope', 'Diagnostic'],
    ['sparkles', 'Nouveautés']
  ]
]
const settingsNav = (active) =>
  `<nav class="settings-nav"><h2 class="settings-title">Réglages</h2><label class="settings-search">${i('search', 14)}<input placeholder="Rechercher" type="search"></label>` +
  NAV.map((group) =>
    group
      .map(
        ([icon, label]) =>
          `<button class="settings-nav-item ${label === active ? 'active' : ''}">${i(icon, 15)}${label}</button>`
      )
      .join('')
  ).join('<div class="mq-gap"></div>') +
  `</nav>`
const settingsMain = (heading, body, crumb = '') =>
  `<div class="settings-main"><header class="settings-header"><h2 class="settings-heading">${crumb}${heading}</h2><button type="button" class="icon-button settings-close">${i('x', 16)}</button></header><div class="settings-body mq-settings-body">${body}</div></div>`
const srow = (label, hint, control, cls = '') =>
  `<div class="settings-row ${cls}"><div class="settings-row-text"><div class="settings-row-label">${label}</div>${hint ? `<div class="settings-row-hint">${hint}</div>` : ''}</div><div class="settings-row-control">${control}</div></div>`
const sw = (on = true) =>
  `<label class="switch"><input type="checkbox" ${on ? 'checked' : ''}><span></span></label>`
const seg = (opts, active) =>
  `<div class="segmented">${opts.map((o) => `<button class="${o === active ? 'active' : ''}">${o}</button>`).join('')}</div>`
const stepper = (v) =>
  `<div class="stepper"><button>−</button><span>${v}</span><button>+</button></div>`
const select = (v) => `<select class="settings-input"><option>${v}</option></select>`
const card = (inner) => `<div class="mq-card">${inner}</div>`
const h3 = (t) => `<h3 class="mq-h3">${t}</h3>`

const notificationsBody =
  `<div class="mq-banner">${i('triangle-alert', 16)}<span class="grow">macOS bloque les bannières de Bobine. Le son et le Dock marchent quand même.</span><button class="btn small">Ouvrir les réglages du Mac</button></div>` +
  h3('Quand un agent a fini ou attend') +
  card(
    srow('Notifications', 'Une bannière quand la fenêtre est en arrière-plan.', sw()) +
      srow(
        'Faire rebondir l’icône du Dock',
        'Une fois pour une réponse finie, jusqu’à votre retour s’il attend.',
        sw(),
        'mq-sub'
      ) +
      srow(
        'Compteur sur l’icône du Dock',
        'Le nombre de conversations « À traiter ».',
        sw(),
        'mq-sub'
      )
  ) +
  h3('Son') +
  card(
    srow(
      'Son quand un agent attend',
      'Même sans notifications.',
      `<div style="display:flex;gap:6px;align-items:center">${select('Verre')}<button class="icon-button small">${i('volume-2', 15)}</button></div>`
    )
  )

const themeThumb = (name, bg, side, line, active) =>
  `<div class="mq-theme ${active ? 'active' : ''}"><div class="mq-thumb" style="background:${bg}"><i style="background:${side}"></i><b style="top:12px;background:${line}"></b><b style="top:22px;right:20px;background:${line}"></b></div>${name}</div>`
const swatch = (c, active) =>
  `<button class="accent-swatch ${active ? 'active' : ''}" style="background:${c}${active ? ';box-shadow:0 0 0 2px var(--bg),0 0 0 4px var(--text)' : ''}"></button>`
const appearanceBody =
  card(`<div class="mq-preview">
      <p>Voici la réponse de l’agent : le fichier <code>README.md</code> est à jour et les tests passent.</p>
      <div class="mq-code"><span class="k">export function</span> <span class="f">hello</span>(name) {<br>&nbsp;&nbsp;<span class="k">return</span> <span class="s">\`Bonjour \${name}\`</span> <span class="c">// accueil</span><br>}</div>
      <div class="mq-term"><span class="p">❯</span> pnpm test &nbsp; <span class="ok">✓ 312 tests</span> en 4,1 s</div></div>`) +
  h3('Interface') +
  card(
    srow('Mode', '', seg(['Système', 'Clair', 'Sombre'], 'Système')) +
      srow(
        'Thème clair',
        '',
        `<div class="mq-themes">${themeThumb('Clair', '#faf9f5', '#f3f1ea', '#d4d0c4', true)}${themeThumb('Sépia', '#f4ecd8', '#ebe1c8', '#cdbf9c', false)}</div>`
      ) +
      srow(
        'Thème sombre',
        '',
        `<div class="mq-themes">${themeThumb('Sombre', '#262624', '#1f1e1d', '#4d4c47', true)}${themeThumb('Nuit noire', '#0b0b0b', '#000000', '#333333', false)}</div>`
      ) +
      srow(
        'Couleur d’accent',
        '',
        `<div class="mq-swatch-wrap"><div class="accent-swatches">${swatch('#c96442', true)}${swatch('#2f6fdb')}${swatch('#7b55d6')}${swatch('#c2417f')}${swatch('#2f8a57')}${swatch('#6b6a66')}<button class="accent-swatch mq-mac-accent"></button></div></div>`
      )
  ) +
  h3('Fil') +
  card(
    srow(
      'Police des réponses',
      'Sans serif ou serif du système, ou une police installée sur le Mac.',
      select('Système (sans serif)')
    ) +
      srow('Taille des réponses', '', stepper(15)) +
      srow('Largeur du fil', '', seg(['Étroite', 'Normale', 'Large'], 'Normale'))
  ) +
  h3('Code et terminal') +
  `<div class="mq-card" style="overflow:visible">` +
  srow(
    'Police du code',
    'Blocs de code, diffs et sorties de commandes.',
    select('JetBrains Mono')
  ) +
  srow('Taille du code', '', stepper(13)) +
  srow(
    'Police du terminal',
    '',
    `<div class="mq-fontpick">${select('SF Mono (système)')}<div class="menu mq-fontmenu" role="menu"><div class="menu-label">Polices à chasse fixe installées</div><div class="menu-item"><span class="mq-check">${i('check', 14)}</span><span class="menu-text" style="font-family:'ui-monospace', ui-monospace, monospace">SF Mono (système)</span></div><div class="menu-item"><span class="mq-check">${''}</span><span class="menu-text" style="font-family:'Menlo', ui-monospace, monospace">Menlo</span></div><div class="menu-item"><span class="mq-check">${''}</span><span class="menu-text" style="font-family:'JetBrains Mono', ui-monospace, monospace">JetBrains Mono</span></div><div class="menu-item"><span class="mq-check">${''}</span><span class="menu-text" style="font-family:'Fira Code', ui-monospace, monospace">Fira Code</span></div><div class="menu-item"><span class="mq-check">${''}</span><span class="menu-text" style="font-family:'Cascadia Code', ui-monospace, monospace">Cascadia Code</span></div><div class="menu-item"><span class="mq-check">${''}</span><span class="menu-text" style="font-family:'IBM Plex Mono', ui-monospace, monospace">IBM Plex Mono</span></div><div class="menu-item"><span class="mq-check">${''}</span><span class="menu-text" style="font-family:'Courier New', ui-monospace, monospace">Courier New</span></div></div></div>`
  ) +
  srow('Taille du terminal', '', stepper(14)) +
  `</div>`

const agentRow = (letter, name, sub, side) =>
  `<div class="mq-list-row"><div class="mq-avatar">${letter}</div><div class="grow">${name}<small>${sub}</small></div><span class="mq-side">${side}</span>${i('chevron-right', 15)}</div>`
const agentsBody =
  h3('Agents') +
  card(
    agentRow(
      'B',
      'IBM Bob',
      '<span class="status-dot ready" style="position:static;display:inline-block;margin-right:6px"></span>Prêt · 2.0.6 · connecté par SSO',
      '32 % du quota'
    ) +
      agentRow(
        'O',
        'OpenCode',
        '<span class="status-dot ready" style="position:static;display:inline-block;margin-right:6px"></span>Prêt · 2.0.32 · 3 fournisseurs',
        ''
      ) +
      agentRow('A', 'Agent factice', 'Pour les essais', '')
  ) +
  `<p class="settings-row-hint" style="margin:10px 4px">Non installés : Gemini CLI, Goose. <a class="mq-link" style="color:var(--accent)">Voir le Diagnostic</a></p>` +
  `<details class="mq-advanced"><summary>${i('chevron-right', 13)}Avancé <small>· réseau d’entreprise : proxy et certificats définis</small></summary></details>`

const providerRow = (name, sub, side) =>
  `<div class="mq-list-row"><div class="grow">${name}<small>${sub}</small></div><span class="mq-side">${side}</span>${i('chevron-right', 15)}</div>`
const opencodeBody =
  card(
    `<div class="mq-agent-head"><div class="mq-avatar">O</div><div class="grow"><div class="mq-name">OpenCode</div><div class="mq-sub"><span class="status-dot ready"></span>Prêt · version 2.0.32 · <span style="font-family:var(--font-mono);font-size:12px">opencode acp</span></div></div><button class="btn small">Relancer</button></div>`
  ) +
  h3('Fournisseurs de modèles') +
  card(
    providerRow(
      'OpenAI',
      'Connecté par le compte ChatGPT',
      `<span class="mq-pill ok">${i('check', 12)} testé</span>`
    ) +
      providerRow(
        'Mistral interne (LLMaaS)',
        'https://llm.interne.example/v1 · clé dans le trousseau',
        `<span class="mq-pill ok">${i('check', 12)} testé</span>`
      ) +
      providerRow(
        'OpenRouter',
        'Clé d’API dans le trousseau',
        '<span class="mq-pill">non testé</span>'
      ) +
      `<div class="mq-list-row" style="color:var(--accent)">${i('plus', 15)}<div class="grow">Ajouter un fournisseur…</div></div>`
  ) +
  card(
    srow(
      'Seulement ces fournisseurs',
      'Les autres modèles d’OpenCode ne sont pas proposés.',
      sw(false)
    )
  ).replace('mq-card', 'mq-card" style="margin-top:10px') +
  h3('Ce qu’il annonce') +
  card(`<ul class="mq-check-list">
    <li>${i('check', 14)}Images dans les messages</li><li>${i('check', 14)}Reprise des conversations</li>
    <li>${i('check', 14)}Modes : Build, Plan</li><li>${i('check', 14)}Choix du modèle</li>
    <li>${i('check', 14)}Serveurs MCP de l’app</li><li class="no">${i('minus', 14)}Fichiers joints</li></ul>`) +
  h3('Propre à OpenCode') +
  card(
    srow(
      'Skills listés',
      '<code>.opencode/skills</code>, <code>.agents/skills</code>, <code>.claude/skills</code> du dossier et de <code>~</code>.',
      ''
    ) +
      srow(
        'Règles actives listées',
        '<code>AGENTS.md</code> et les fichiers <code>instructions</code> d’<code>opencode.json</code>.',
        ''
      ) +
      srow(
        'Serveurs MCP modifiables',
        '<code>opencode.json</code> du dossier et <code>~/.config/opencode</code>.',
        ''
      )
  )

/* --------------------------------------------------------- consommation */
function usageChart(scheme) {
  const [bob, oc] = scheme === 'dark' ? ['#cf6b48', '#5a85cc'] : ['#c96442', '#4a78c2']
  // 30 jours, échanges par jour (week-ends calmes)
  const data = Array.from({ length: 30 }, (_, d) => {
    const we = d % 7 === 5 || d % 7 === 6
    const b = we ? d % 3 : 3 + ((d * 7) % 6)
    const o = we ? (d % 2) * 2 : 2 + ((d * 5) % 7)
    return [b, o]
  })
  const W = 640,
    H = 170,
    pad = 26,
    bw = (W - pad) / 30 - 4,
    max = 17
  const y = (v) => H - 18 - (v / max) * (H - 30)
  const bars = data
    .map(([b, o], d) => {
      const x = pad + d * ((W - pad) / 30) + 2
      const yb = y(b),
        yo = y(b + o)
      const hb = H - 18 - yb,
        ho = yb - yo - (o ? 2 : 0)
      return (
        (b
          ? `<rect x="${x}" y="${yb}" width="${bw}" height="${hb}" rx="${Math.min(3, hb / 2)}" fill="${bob}"/>`
          : '') +
        (o
          ? `<rect x="${x}" y="${yo}" width="${bw}" height="${Math.max(ho, 0)}" rx="3" fill="${oc}"/>`
          : '')
      )
    })
    .join('')
  const grid = [0, 5, 10, 15]
    .map(
      (v) =>
        `<line x1="${pad}" x2="${W}" y1="${y(v)}" y2="${y(v)}" stroke="var(--border)" stroke-width="1"/><text x="${pad - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`
    )
    .join('')
  const labels = [0, 7, 14, 21, 29]
    .map(
      (d) =>
        `<text x="${pad + d * ((W - pad) / 30) + bw / 2 + 2}" y="${H - 2}" text-anchor="${d === 29 ? 'end' : 'middle'}">${['24 sept.', '1 oct.', '8 oct.', '15 oct.', '23 oct.'][[0, 7, 14, 21, 29].indexOf(d)]}</text>`
    )
    .join('')
  const hoverX = pad + 27 * ((W - pad) / 30) + 2
  const tip = `<g><rect x="${hoverX - 120}" y="6" width="112" height="46" rx="6" fill="var(--text)"/><text x="${hoverX - 112}" y="22" style="fill:var(--bg);font-weight:600">mar. 21 oct.</text><text x="${hoverX - 112}" y="36" style="fill:var(--bg)">IBM Bob · 7</text><text x="${hoverX - 112}" y="48" style="fill:var(--bg)">OpenCode · 8</text></g>`
  return {
    colors: [bob, oc],
    svg: `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}">${grid}${bars}<rect x="${hoverX - 1}" y="8" width="${bw + 2}" height="${H - 26}" fill="var(--text)" opacity="0.06" rx="3"/>${tip}${labels}</svg>`
  }
}
function usageBody(scheme) {
  const ch = usageChart(scheme)
  const kpi = (label, value, sub) =>
    `<div class="mq-kpi"><div class="mq-k-label">${label}</div><div class="mq-k-value">${value}</div><div class="mq-k-sub">${sub}</div></div>`
  const dot = (c) => `<span class="mq-dot" style="background:${c}"></span>`
  const bar = (w) => `<i style="width:${w}px"></i>`
  return `<div class="mq-filters">${seg(['Aujourd’hui', '7 j', '30 j', 'Ce mois', 'Tout'], '30 j')}${select('Tous les agents')}<span class="grow"></span><button class="btn small">${i('download', 13)}Exporter…</button></div>
  <div class="mq-kpis">${kpi('Échanges', '214', 'dans 61 conversations')}${kpi('Jetons traités', '3,2 M', 'entrée 2,9 M · sortie 0,3 M')}${kpi('Temps de travail', '6 h 40', '1 min 52 par échange')}${kpi('Coût', '4,12 <small style="font-size:13px;font-weight:500">bobcoins</small>', 'et 0,00 $ (OpenCode)')}</div>
  <div class="mq-card mq-chart-card" style="margin-top:12px"><div class="mq-chart-head"><span class="mq-title">Échanges par jour</span><span class="mq-legend"><span><i style="background:${ch.colors[0]}"></i>IBM Bob</span><span><i style="background:${ch.colors[1]}"></i>OpenCode</span></span><span class="grow"></span>${seg(['Échanges', 'Jetons', 'Coût'], 'Échanges')}</div><div class="mq-chart">${ch.svg}</div></div>
  ${h3('Par modèle')}
  ${card(`<table class="mq-table"><thead><tr><th>Modèle</th><th>Échanges</th><th>Jetons entrée · sortie</th><th>Coût</th><th>Par échange</th></tr></thead><tbody>
    <tr><td>${dot(ch.colors[0])}IBM Bob <small>· modèle non communiqué</small></td><td>96</td><td>1,4 M · 0,12 M</td><td>4,12 bobcoins</td><td>0,043</td></tr>
    <tr><td>${dot(ch.colors[1])}GPT-6.1 Sol <small>· OpenCode</small></td><td>74</td><td>1,1 M · 0,11 M</td><td>0,00 $</td><td>—</td></tr>
    <tr><td>${dot(ch.colors[1])}Mistral interne <small>· OpenCode</small></td><td>44</td><td>0,4 M · 0,07 M</td><td><small>non communiqué</small></td><td>—</td></tr></tbody></table>`)}
  <div class="mq-two">
  <div>${h3('Par projet')}${card(`<table class="mq-table"><tbody>
    <tr><td>carnet-de-lecture</td><td><span class="mq-bar-cell">${bar(90)}151</span></td></tr>
    <tr><td>bobine</td><td><span class="mq-bar-cell">${bar(30)}52</span></td></tr>
    <tr><td>notes-perso</td><td><span class="mq-bar-cell">${bar(7)}11</span></td></tr></tbody></table>`)}</div>
  <div>${h3('Conversations les plus longues')}${card(`<table class="mq-table"><tbody>
    <tr><td>Trois chantiers indépendants…</td><td>38</td></tr>
    <tr><td>Plan de migration des réglages</td><td>21</td></tr>
    <tr><td>Explique-moi ce projet</td><td>17</td></tr></tbody></table>`)}</div></div>
  ${h3('IBM Bob sur ce Mac')}
  ${card(srow('Quota du mois', 'D’après le serveur de Bob, toutes machines confondues, travail hors Bobine compris.', '<span style="font-variant-numeric:tabular-nums">6,4 sur 20 bobcoins · 32 %</span>'))}
  ${h3('Historique')}
  ${card(srow('Remettre à zéro', 'Efface toute la consommation enregistrée par Bobine, après confirmation. Exportez-la d’abord pour la garder. Le quota de Bob n’est pas concerné.', '<button class="btn small danger">Remettre à zéro…</button>'))}`
}

/* ----------------------------------------------------- journal et ACP */
const fileRow = (name, size, hint) =>
  `<div class="mq-list-row">${i('file-text', 16)}<div class="grow"><span style="font-family:var(--font-mono);font-size:13px">${name}</span> <span class="mq-side">· ${size}</span><small>${hint}</small></div><button class="btn small">Ouvrir</button><button class="icon-button small" aria-label="Afficher dans le Finder">${i('folder-open', 15)}</button></div>`
const diagnosticBody =
  `<div class="mq-diag-head"><span class="status-dot" style="position:static;background:var(--warn)"></span><b>2 points à regarder</b><span class="grow"></span><button class="btn small">${i('rotate-cw', 13)}Relancer</button><button class="btn small">${i('bug', 13)}Signaler un problème</button></div>` +
  h3('Journal') +
  card(
    fileRow('main.log', '1,2 Mo', 'Démarrage, erreurs, agents lancés et arrêtés.') +
      fileRow('agents.log', '3,4 Mo', 'Échanges avec les agents, selon le niveau du journal.') +
      srow(
        'Niveau du journal',
        'Détaillé : chaque échange avec les agents, sans leur contenu. Trace : avec des extraits, jusqu’au prochain lancement.',
        select('Normal')
      )
  ) +
  h3('Bobine') +
  card(srow('Version', '', '<span class="mq-side">0.5.0 · Electron 44.7.2 · macOS 27.0</span>')) +
  h3('Environnement') +
  card(
    srow(
      `<span class="status-dot" style="position:static;display:inline-block;margin-right:8px;background:var(--warn)"></span>Enregistrement de l’écran`,
      'Refusé : une capture ne montrerait que le fond d’écran.',
      '<button class="btn small">Ouvrir les réglages du Mac</button>'
    )
  )

const acpRow = ({ t, dir, what, detail = '', size = '', sel = false, group = false }) =>
  `<div class="mq-acp-row ${sel ? 'sel' : ''}"><span class="mq-acp-t">${t}</span><span class="mq-acp-dir ${dir}">${dir === 'out' ? '→' : '←'}</span><span class="mq-acp-what">${what}${group ? ' <span class="mq-pill">regroupés</span>' : ''}</span><span class="mq-acp-detail">${detail}</span><span class="mq-acp-size">${size}</span></div>`
const json = `<pre class="mq-json">{
  <k>"jsonrpc"</k>: <s>"2.0"</s>,
  <k>"method"</k>: <s>"session/update"</s>,
  <k>"params"</k>: {
    <k>"sessionId"</k>: <s>"ses_6f1c…a92"</s>,
    <k>"update"</k>: {
      <k>"sessionUpdate"</k>: <s>"tool_call"</s>,
      <k>"toolCallId"</k>: <s>"call_8f2d…"</s>,
      <k>"title"</k>: <s>"patch"</s>,
      <k>"kind"</k>: <s>"edit"</s>,
      <k>"status"</k>: <s>"pending"</s>,
      <k>"rawInput"</k>: {}
    }
  }
}</pre>`
const acpTab = `<div class="mq-acp">
  <div class="mq-acp-bar"><label class="mq-acp-search">${i('search', 14)}<input placeholder="Filtrer : méthode, outil, texte"></label>
    <button class="chip mq-on">${i('layers', 13)}<span class="chip-label">Regrouper les morceaux</span></button><span class="grow"></span>
    <button class="icon-button small" aria-label="Mettre en pause">${i('pause', 14)}</button>
    <button class="icon-button small" aria-label="Copier">${i('copy', 14)}</button>
    <button class="icon-button small" aria-label="Ouvrir agents.log">${i('external-link', 14)}</button></div>
  <div class="mq-acp-list">
    ${acpRow({ t: '14:02:11.204', dir: 'out', what: 'session/prompt', detail: '#12 · texte, 1 fichier', size: '2,1 Ko' })}
    ${acpRow({ t: '14:02:11.390', dir: 'in', what: 'agent_thought_chunk ×18', detail: '', size: '0,9 Ko', group: true })}
    ${acpRow({ t: '14:02:12.018', dir: 'in', what: 'tool_call', detail: 'read · completed', size: '1,4 Ko' })}
    ${acpRow({ t: '14:02:12.733', dir: 'in', what: 'agent_message_chunk ×31', detail: '', size: '1,2 Ko', group: true })}
    ${acpRow({ t: '14:02:13.010', dir: 'in', what: 'tool_call', detail: 'patch · pending', size: '0,3 Ko', sel: true })}
    ${json}
    ${acpRow({ t: '14:02:51.788', dir: 'in', what: 'tool_call_update', detail: 'in_progress · 38,8 s après', size: '7,0 Ko' })}
    ${acpRow({ t: '14:02:51.792', dir: 'in', what: 'tool_call_update', detail: 'completed', size: '0,4 Ko' })}
    ${acpRow({ t: '14:02:51.950', dir: 'in', what: 'session/request_permission', detail: '#7', size: '0,6 Ko' })}
    ${acpRow({ t: '14:02:53.102', dir: 'out', what: 'réponse #7', detail: 'allow_once · 1,2 s', size: '0,1 Ko' })}
  </div>
  <div class="mq-acp-foot">${i('shield', 13)}Clés et jetons masqués · 2 000 derniers messages de cette conversation, en mémoire seulement</div>
</div>`

/* -------------------------------------------------------------- écrans */
export const SCREENS = [
  {
    id: 'activite-1-pendant',
    title: 'Activité : pendant que le modèle écrit le patch',
    agent: 'OpenCode',
    prepare: async (h) => {
      await h.sidebar({ active: 'Filtre statut &amp; étiquette (tâche 4)' })
      await h.stage(
        '[data-testid=thread]',
        threadWrap(
          patchStart +
            toolRunning('file-pen-line', 'Prépare une modification…') +
            working(h.spool, 'Prépare une modification…', '38 s', 'Tour commencé il y a 2 min 10')
        )
      )
      await h.title('Filtre statut & étiquette (tâche 4)')
      await h.busy()
    }
  },
  {
    id: 'activite-2-etape-suivante',
    title: 'Activité : le chronomètre repart à chaque étape',
    agent: 'OpenCode',
    prepare: async (h) => {
      await h.sidebar({ active: 'Filtre statut &amp; étiquette (tâche 4)' })
      await h.stage(
        '[data-testid=thread]',
        threadWrap(
          patchStart +
            toolDone('file-pen-line', 'Modification de public/app.js et 2 autres') +
            agent('<p>Je lance les tests.</p>') +
            toolRunning('square-terminal', 'Lance <code>npm test</code>') +
            working(h.spool, 'Lance npm test…', '12 s')
        )
      )
      await h.title('Filtre statut & étiquette (tâche 4)')
      await h.busy()
    }
  },
  {
    id: 'navigateur-1-panneau',
    title: 'Navigateur : la page suit le panneau et défile',
    agent: 'IBM Bob',
    prepare: async (h) => {
      await h.sidebar({ active: 'La liste des livres déborde sur mobile' })
      await h.stage('[data-testid=thread]', browserThread)
      await h.title('La liste des livres déborde sur mobile')
      await h.openPanel(
        panel(
          browserTabs,
          `<div class="browser-tab">${browserBar({ zoom: '110 %' })}<div class="browser-page" style="overflow:hidden"><div style="position:absolute;inset:0;overflow:hidden"><div style="transform:translateY(-40px)">${site()}</div></div><div style="position:absolute;right:3px;top:70px;width:6px;height:150px;border-radius:3px;background:rgb(0 0 0 / .35)"></div></div></div>`
        )
      )
    }
  },
  {
    id: 'navigateur-2-agrandi',
    title: 'Navigateur : panneau agrandi, la page suit',
    agent: 'IBM Bob',
    prepare: async (h) => {
      await h.sidebar({ active: 'La liste des livres déborde sur mobile' })
      await h.stage('[data-testid=thread]', browserThread)
      await h.title('La liste des livres déborde sur mobile')
      await h.openPanel(
        panel(
          browserTabs + '<!--minimize-2-->',
          `<div class="browser-tab">${browserBar()}<div class="browser-page" style="overflow:hidden"><div style="position:absolute;inset:0;overflow:hidden"><div style="transform:translateY(-60px)">${site()}</div></div><div style="position:absolute;right:3px;top:40px;width:6px;height:260px;border-radius:3px;background:rgb(0 0 0 / .35)"></div></div></div>`
        )
      )
      await h.css(
        '.main { display: none !important; } .mq-panel { width: auto !important; flex: 1; min-width: 0; }'
      )
    }
  },
  {
    id: 'navigateur-3-annoter',
    title: 'Navigateur : annoter à l’endroit du clic, comme dans Figma',
    agent: 'IBM Bob',
    prepare: async (h) => {
      await h.sidebar({ active: 'La liste des livres déborde sur mobile' })
      await h.stage('[data-testid=thread]', browserThread)
      await h.title('La liste des livres déborde sur mobile')
      const hint = `<div class="mq-hint">${i('message-square-plus', 14)}<span>Cliquez là où vous voulez laisser une remarque.</span><span class="grow"></span><kbd>Échap</kbd>&nbsp;pour finir</div>`
      const pin = (n, x, y) =>
        `<div class="mq-pin" style="left:${x}px;top:${y}px"><span>${n}</span></div>`
      const bubble = (x, y, inner, editing = false) =>
        `<div class="mq-bubble ${editing ? 'editing' : ''}" style="left:${x}px;top:${y}px">${inner}</div>`
      const page = `<div style="position:absolute;inset:0;overflow:hidden"><div style="transform:translateY(-20px)">${site()}</div></div>
        ${pin(1, 505, 205)}
        ${bubble(245, 216, `<div class="mq-bubble-text">Le statut devrait être une pastille de couleur, pas du texte.</div>`)}
        ${pin(2, 440, 425)}
        ${bubble(180, 436, `<textarea>Bouton collé au champ Année : 12 px d’écart.</textarea><div class="mq-note-actions"><button class="btn small ghost">Annuler</button><button class="btn small primary">Ajouter <kbd>⌘↩</kbd></button></div>`, true)}`
      const bar = `<div class="diff-notes-bar">${i('message-square', 14)}<span class="diff-notes-count">1 remarque</span><span class="grow"></span><button class="icon-button small">${i('trash-2', 13)}</button><button class="btn small primary">${i('send', 13)}Envoyer à l’agent</button></div>`
      await h.openPanel(
        panel(
          browserTabs,
          `<div class="browser-tab">${browserBar({ comment: true })}${hint}<div class="browser-page mq-frozen" style="overflow:hidden">${page}</div>${bar}</div>`
        )
      )
    }
  },
  {
    id: 'barre-1-dossiers',
    title: 'Barre latérale : sections nettes, dossier = projet, filles en retrait',
    agent: 'OpenCode',
    prepare: async (h) => {
      await h.sidebar({ hover: 'Plan de migration des réglages' })
      await h.stage(
        '[data-testid=thread]',
        threadWrap(
          user(
            'Trois chantiers indépendants du README : 4 (filtre par statut), 5 (supprimer un livre) et 6 (page « À lire »). Confie-les à des conversations filles.'
          ) + agent('<p>Je lance trois chantiers en parallèle, chacun dans son worktree.</p>')
        )
      )
      await h.title('Trois chantiers indépendants du README')
    }
  },
  {
    id: 'barre-2-recents',
    title: 'Barre latérale : même structure en mode Récents',
    agent: 'OpenCode',
    prepare: async (h) => {
      await h.sidebar({ mode: 'recent' })
      await h.stage(
        '[data-testid=thread]',
        threadWrap(
          user(
            'Trois chantiers indépendants du README : 4 (filtre par statut), 5 (supprimer un livre) et 6 (page « À lire »). Confie-les à des conversations filles.'
          ) + agent('<p>Je lance trois chantiers en parallèle, chacun dans son worktree.</p>')
        )
      )
      await h.title('Trois chantiers indépendants du README')
    }
  },
  {
    id: 'barre-3-menu',
    title: 'Barre latérale : le menu « … » de chaque conversation, inchangé',
    agent: 'OpenCode',
    prepare: async (h) => {
      await h.sidebar({
        menuOn: 'Filtre statut &amp; étiquette (tâche 4)',
        hover: 'Filtre statut &amp; étiquette (tâche 4)'
      })
      await h.stage(
        '[data-testid=thread]',
        threadWrap(
          user(
            'Trois chantiers indépendants du README : 4 (filtre par statut), 5 (supprimer un livre) et 6 (page « À lire »). Confie-les à des conversations filles.'
          ) + agent('<p>Je lance trois chantiers en parallèle, chacun dans son worktree.</p>')
        )
      )
      await h.title('Trois chantiers indépendants du README')
      const it = (icon, label, cls = '') =>
        `<div class="menu-item ${cls}">${i(icon, 15, 'menu-icon')}<span class="menu-text">${label}</span></div>`
      await h.stage(
        'body',
        `<div class="menu mq-row-menu" role="menu" style="position:fixed;z-index:80;width:230px">
        ${it('pencil', 'Renommer')}${it('pin', 'Épingler')}${it('columns-2', 'Ouvrir à côté')}${it('git-fork', 'Lancer en parallèle…')}
        <div class="menu-separator"></div>${it('file-down', 'Exporter en Markdown…')}${it('braces', 'Exporter en JSON…')}
        <div class="menu-separator"></div>${it('archive', 'Archiver')}${it('trash-2', 'Supprimer', 'danger')}</div>`,
        'append'
      )
      h.after = `(() => { const r = document.querySelector('[data-mq-menu] .history-more').getBoundingClientRect(); const m = document.querySelector('.mq-row-menu'); m.style.left = r.left + 'px'; m.style.top = (r.bottom + 4) + 'px' })()`
    }
  },
  {
    id: 'reglages-1-notifications',
    title: 'Réglages : trois groupes, sections en cartes (Notifications)',
    agent: 'OpenCode',
    prepare: async (h) =>
      h.bgSettings(settingsNav('Notifications'), settingsMain('Notifications', notificationsBody))
  },
  {
    id: 'reglages-2-apparence',
    title: 'Réglages › Apparence : tout au même endroit, aperçu en tête',
    agent: 'OpenCode',
    tall: true,
    prepare: async (h) =>
      h.bgSettings(settingsNav('Apparence'), settingsMain('Apparence', appearanceBody))
  },
  {
    id: 'reglages-3-agents',
    title: 'Réglages › Agents : une ligne par agent',
    agent: 'OpenCode',
    prepare: async (h) => h.bgSettings(settingsNav('Agents'), settingsMain('Agents', agentsBody))
  },
  {
    id: 'reglages-4-agent-opencode',
    title: 'Réglages › Agents › OpenCode : tout ce qui le concerne sur une page',
    agent: 'OpenCode',
    prepare: async (h) =>
      h.bgSettings(
        settingsNav('Agents'),
        settingsMain(
          'OpenCode',
          opencodeBody,
          `<span class="mq-crumb">${i('chevron-left', 15)}Agents</span>`
        )
      )
  },
  {
    id: 'consommation',
    title: 'Réglages › Consommation : jour, semaine, mois, par modèle',
    agent: 'OpenCode',
    tall: true,
    prepare: async (h, scheme) =>
      h.bgSettings(settingsNav('Consommation'), settingsMain('Consommation', usageBody(scheme)))
  },
  {
    id: 'reseau',
    title: 'Panne réseau : la cause, et un nouvel essai tout seul',
    agent: 'IBM Bob',
    prepare: async (h) => {
      await h.sidebar({ active: 'Plan de migration des réglages' })
      await h.stage(
        '[data-testid=thread]',
        threadWrap(
          user('Liste les réglages qui changent de place et propose une migration.') +
            agent('<p>Je lis le schéma des préférences et les fichiers de réglages.</p>') +
            toolDone('layers', '4 lectures') +
            `<div class="mq-net">${i('wifi-off', 16)}<div class="grow"><b>Connexion perdue</b><small>Nouvelle tentative dans 8 s (3 sur 5). Votre message reste en attente.</small></div><button class="btn small">Réessayer maintenant</button></div>`
        )
      )
      await h.title('Plan de migration des réglages')
    }
  },
  {
    id: 'journal-diagnostic',
    title: 'Réglages › Diagnostic : le journal en premier',
    agent: 'OpenCode',
    prepare: async (h) =>
      h.bgSettings(settingsNav('Diagnostic'), settingsMain('Diagnostic', diagnosticBody))
  },
  {
    id: 'acp-echanges',
    title: 'Panneau : les échanges ACP bruts de la conversation',
    agent: 'OpenCode',
    prepare: async (h) => {
      await h.sidebar({ active: 'Filtre statut &amp; étiquette (tâche 4)' })
      await h.stage(
        '[data-testid=thread]',
        threadWrap(
          patchStart +
            toolRunning('file-pen-line', 'Prépare une modification…') +
            working(h.spool, 'Prépare une modification…', '38 s')
        )
      )
      await h.title('Filtre statut & étiquette (tâche 4)')
      await h.busy()
      await h.openPanel(
        panel(
          tab('arrow-left-right', 'Échanges ACP', true) + tab('file-diff', 'Modifications', false),
          acpTab
        )
      )
    }
  }
]
