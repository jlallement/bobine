// Maquettes du tableau de bord de consommation (façon GitHub) : une page dans la zone principale,
// ouverte depuis le bloc de l'agent en bas de la barre latérale. DOM injecté, aucun code produit.
import { i } from './icons.mjs'

const TODAY = new Date(2026, 9, 24) // samedi 24 octobre 2026
const START = new Date(2025, 9, 27) // lundi, 53 semaines plus tôt
const DAYS = Math.round((TODAY - START) / 86400000) + 1
const MONTHS = [
  'janv.',
  'févr.',
  'mars',
  'avr.',
  'mai',
  'juin',
  'juil.',
  'août',
  'sept.',
  'oct.',
  'nov.',
  'déc.'
]
const WEEKDAYS = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.']
const date = (d) => new Date(START.getFullYear(), START.getMonth(), START.getDate() + d)

/** Échanges d'un jour : rien avant mars, puis un usage qui monte, week-ends calmes. */
function exchanges(d) {
  const r = Math.abs(Math.sin(d * 12.9898) * 43758.5453) % 1
  const dow = d % 7
  if (d < 125) return 0
  const base = Math.min(4 + (d - 125) / 9, 26)
  if (dow >= 5) return r < 0.55 ? 0 : Math.round(base * 0.25 * r)
  if (r < 0.08) return 0
  return Math.round(base * (0.35 + r))
}
const DATA = Array.from({ length: DAYS }, (_, d) => exchanges(d))
DATA[DAYS - 5] = 38 // mardi 20 oct., le jour survolé
const level = (n) => (n === 0 ? 0 : n < 6 ? 1 : n < 13 ? 2 : n < 22 ? 3 : 4)

const CSS = `
:root { --heat-0: var(--surface-2); --heat-1: #e3a283; --heat-2: #cf7a55; --heat-3: #b35532; --heat-4: #7f351b; }
@media (prefers-color-scheme: dark) { :root { --heat-1: #8c4e36; --heat-2: #b46344; --heat-3: #d9845d; --heat-4: #f6b595; } }
.main > .thread-dock, .main-title-chevron { display: none !important; }
.mq-dash-scroll { flex: 1; min-height: 0; overflow-y: auto; }
.mq-dash { max-width: 940px; margin: 0 auto; padding: 4px 32px 48px; }
.mq-dash .mq-filters { margin: 0 0 14px; flex-wrap: wrap; }
.mq-nav { display: inline-flex; align-items: center; gap: 2px; font-size: 13px; color: var(--text); font-variant-numeric: tabular-nums; }
.mq-nav b { font-weight: 500; padding: 0 6px; min-width: 128px; text-align: center; }
.mq-nav .icon-button[disabled] { opacity: .35; }
.mq-chip-day { display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 6px 0 10px; border-radius: 8px; background: var(--surface-3); font-size: 13px; color: var(--text); }
.mq-chip-day svg { color: var(--muted); }
.mq-heat-card { padding: 14px 18px 12px; }
.mq-heat-head { display: flex; align-items: baseline; gap: 8px; margin-bottom: 10px; font-size: 13px; color: var(--text-2); }
.mq-heat-head b { font-size: 15px; font-weight: 600; color: var(--text); font-variant-numeric: tabular-nums; }
.mq-heat-head .grow { flex: 1; }
.mq-heat svg { display: block; overflow: visible; }
.mq-heat svg text { font-size: 10.5px; fill: var(--muted); font-family: var(--font-ui); }
.mq-heat-foot { display: flex; align-items: center; gap: 6px; margin-top: 8px; font-size: 11.5px; color: var(--muted); }
.mq-heat-foot .grow { flex: 1; }
.mq-heat-foot i { width: 11px; height: 11px; border-radius: 3px; display: inline-block; }
.mq-dash .mq-kpis { margin-top: 12px; }
.mq-delta { font-size: 12px; color: var(--muted); margin-top: 6px; display: flex; align-items: center; gap: 3px; }
.mq-delta svg { flex-shrink: 0; }
.mq-dash .mq-chart-card { margin-top: 12px; }
.mq-dash .mq-chart-head .segmented button { font-size: 12px; }
.mq-foot-entry { flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; margin: -6px -8px; padding: 6px 8px; border-radius: 10px; background: none; border: 0; text-align: left; color: inherit; font: inherit; cursor: default; }
.mq-foot-entry:hover, .mq-foot-entry.mq-hover { background: var(--surface-3); }
.mq-foot-entry.active { background: var(--surface-3); }
.mq-foot-entry .who { min-width: 0; flex: 1; }
.mq-foot-entry .who .name { font-weight: 500; font-size: 13px; }
.mq-foot-entry .who .sub { font-size: 11.5px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mq-foot-bar { height: 3px; border-radius: 2px; background: var(--surface-2); margin-top: 4px; overflow: hidden; }
.mq-foot-bar span { display: block; height: 100%; width: 32%; background: var(--muted); border-radius: 2px; }
.mq-hover-row { background: var(--surface-3); }
.mq-sb-fixed > .sidebar-item:nth-child(2) { display: none; }
.sidebar-header { gap: 2px; }
.mq-search-tip { position: fixed; z-index: 50; }
.mq-chart-note { display: flex; align-items: center; gap: 6px; margin-top: 8px; font-size: 12px; color: var(--muted); }
.mq-chart-note svg { flex-shrink: 0; }
.mq-k-label .mq-k-who { color: var(--text-2); }
.mq-pop-link { display: flex; align-items: center; gap: 6px; padding: 8px 10px; margin: 4px -4px -4px; border-top: 1px solid var(--border); color: var(--accent); font-size: 13px; }
`

/* ------------------------------------------------------------------ grille d'activité */

/**
 * Grille d'un an, semaines en colonnes (lundi en haut). `focus` : [premier, dernier] jour mis en
 * avant (les autres pâlissent) ; `pick` : jour sélectionné (anneau) ; `tip` : jour survolé.
 */
function heatmap({ focus, pick, tip }) {
  const step = 15
  const cell = 12
  const left = 30
  const top = 18
  const cols = Math.ceil(DAYS / 7)
  let cells = ''
  for (let d = 0; d < DAYS; d++) {
    const x = left + Math.floor(d / 7) * step
    const y = top + (d % 7) * step
    const dim = focus && (d < focus[0] || d > focus[1])
    cells += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2.5" fill="var(--heat-${level(DATA[d])})" ${dim ? 'opacity="0.28"' : ''}/>`
  }
  const today = DAYS - 1
  const tx = left + Math.floor(today / 7) * step
  const ty = top + (today % 7) * step
  cells += `<rect x="${tx - 1.5}" y="${ty - 1.5}" width="${cell + 3}" height="${cell + 3}" rx="3.5" fill="none" stroke="var(--text-2)" stroke-width="1"/>`
  if (pick !== undefined) {
    const px = left + Math.floor(pick / 7) * step
    const py = top + (pick % 7) * step
    cells += `<rect x="${px - 2}" y="${py - 2}" width="${cell + 4}" height="${cell + 4}" rx="4" fill="none" stroke="var(--text)" stroke-width="1.6"/>`
  }
  let months = ''
  for (let c = 0; c < cols; c++) {
    const first = date(c * 7)
    const prev = date(c * 7 - 7)
    if (c === 0 || first.getMonth() !== prev.getMonth()) {
      if (c === 0 && first.getDate() > 20) continue
      months += `<text x="${left + c * step}" y="11">${MONTHS[first.getMonth()]}</text>`
    }
  }
  const days = [0, 2, 4]
    .map((r) => `<text x="0" y="${top + r * step + 10}">${WEEKDAYS[r]}</text>`)
    .join('')
  let tooltip = ''
  if (tip !== undefined) {
    const x = left + Math.floor(tip / 7) * step + cell / 2
    const y = top + (tip % 7) * step
    const w = 186
    tooltip = `<g><rect x="${x - w - 14}" y="${y - 19}" width="${w}" height="50" rx="7" fill="var(--text)"/><text x="${x - w - 2}" y="${y}" style="fill:var(--bg);font-size:12px;font-weight:600">38 échanges · mardi 20 oct.</text><text x="${x - w - 2}" y="${y + 18}" style="fill:var(--bg);font-size:11.5px;opacity:.85">IBM Bob 17 · OpenCode 21</text></g>`
  }
  const W = left + cols * step
  const H = top + 7 * step
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${months}${days}${cells}${tooltip}</svg>`
}

const heatCard = ({ total, scope, focus, pick, tip, hint }) =>
  `<div class="mq-card mq-heat-card"><div class="mq-heat-head"><b>${total}</b><span>${scope}</span><span class="grow"></span><button class="btn small ghost">12 derniers mois${i('chevron-down', 13)}</button></div>
  <div class="mq-heat">${heatmap({ focus, pick, tip })}</div>
  <div class="mq-heat-foot"><span>${hint}</span><span class="grow"></span>Moins <i style="background:var(--heat-0)"></i><i style="background:var(--heat-1)"></i><i style="background:var(--heat-2)"></i><i style="background:var(--heat-3)"></i><i style="background:var(--heat-4)"></i> Plus</div></div>`

/* ------------------------------------------------------------------ barres par agent */

function bars(scheme, { labels, data, max, ticks, hover, fmt = (v) => v }) {
  const [bob, oc] = scheme === 'dark' ? ['#5a85cc', '#14a893'] : ['#4a78c2', '#0f9d8a']
  const W = 840
  const H = 170
  const pad = 40
  const n = data.length
  const slot = (W - pad) / n
  const bw = Math.min(slot - 4, 36)
  const y = (v) => H - 18 - (v / max) * (H - 30)
  const grid = ticks
    .map(
      (v) =>
        `<line x1="${pad}" x2="${W}" y1="${y(v)}" y2="${y(v)}" stroke="var(--border)"/><text x="${pad - 6}" y="${y(v) + 4}" text-anchor="end">${fmt(v)}</text>`
    )
    .join('')
  const rects = data
    .map(([b, o], k) => {
      const x = pad + k * slot + (slot - bw) / 2
      const yb = y(b)
      const yo = y(b + o)
      return (
        (b
          ? `<rect x="${x}" y="${yb}" width="${bw}" height="${H - 18 - yb}" rx="3" fill="${bob}"/>`
          : '') +
        (o
          ? `<rect x="${x}" y="${yo}" width="${bw}" height="${Math.max(yb - yo - 2, 0)}" rx="3" fill="${oc}"/>`
          : '')
      )
    })
    .join('')
  const xs = labels
    .map(
      ([k, t]) =>
        `<text x="${pad + k * slot + slot / 2}" y="${H - 2}" text-anchor="middle">${t}</text>`
    )
    .join('')
  let hov = ''
  if (hover) {
    const [k, lines] = hover
    const x = pad + k * slot
    const tx = x + slot + 6
    hov = `<rect x="${x + 1}" y="8" width="${slot - 2}" height="${H - 26}" fill="var(--text)" opacity="0.06" rx="4"/><g><rect x="${tx}" y="10" width="124" height="${16 + lines.length * 14}" rx="6" fill="var(--text)"/>${lines
      .map(
        (l, j) =>
          `<text x="${tx + 9}" y="${26 + j * 14}" style="fill:var(--bg);${j === 0 ? 'font-weight:600' : ''}">${l}</text>`
      )
      .join('')}</g>`
  }
  return {
    colors: [bob, oc],
    svg: `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}">${grid}${rects}${hov}${xs}</svg>`
  }
}

const seg = (opts, active) =>
  `<div class="segmented">${opts.map((o) => `<button class="${o === active ? 'active' : ''}">${o}</button>`).join('')}</div>`
const card = (inner) => `<div class="mq-card">${inner}</div>`
const h3 = (t) => `<h3 class="mq-h3">${t}</h3>`
const kpi = (label, value, sub, delta) =>
  `<div class="mq-kpi"><div class="mq-k-label">${label}</div><div class="mq-k-value">${value}</div><div class="mq-k-sub">${sub}</div>${delta ? `<div class="mq-delta">${delta}</div>` : ''}</div>`
const up = (t) => `${i('arrow-up-right', 13)}${t}`
const down = (t) => `${i('arrow-down-right', 13)}${t}`
const small = (t) => `<small style="font-size:13px;font-weight:500">${t}</small>`

const filters = (period, nav) =>
  `<div class="mq-filters">${seg(['Semaine', 'Mois', 'Année'], period)}${nav}<span class="grow"></span><select class="settings-input"><option>Tous les agents</option></select><button class="btn small">${i('download', 13)}Exporter…</button></div>`
const nav = (label, next = false) =>
  `<span class="mq-nav"><button class="icon-button small">${i('chevron-left', 15)}</button><b>${label}</b><button class="icon-button small" ${next ? '' : 'disabled'}>${i('chevron-right', 15)}</button></span>`

function chartCard(ch, title) {
  return `<div class="mq-card mq-chart-card"><div class="mq-chart-head"><span class="mq-title">${title}</span><span class="mq-legend"><span><i style="background:${ch.colors[0]}"></i>IBM Bob</span><span><i style="background:${ch.colors[1]}"></i>OpenCode</span></span><span class="grow"></span>${seg(['Agents', 'Modèles'], 'Agents')}${seg(['Échanges', 'Jetons', 'Coût'], 'Échanges')}</div><div class="mq-chart">${ch.svg}</div></div>`
}

function tables(colors, scale = 1) {
  const n = (v) => Math.round(v * scale)
  const dot = (c) => `<span class="mq-dot" style="background:${c}"></span>`
  const bar = (w) => `<i style="width:${w}px"></i>`
  return `${h3('Par modèle')}
  ${card(`<table class="mq-table"><thead><tr><th>Modèle</th><th>Échanges</th><th>Jetons entrée · sortie</th><th>Coût</th><th>Par échange</th></tr></thead><tbody>
    <tr><td>${dot(colors[0])}IBM Bob <small>· modèle non communiqué</small></td><td>${n(96)}</td><td>1,4 M · 0,12 M</td><td>4,12 Bobcoins</td><td>0,043</td></tr>
    <tr><td>${dot(colors[1])}GPT-6.1 Sol <small>· OpenCode</small></td><td>${n(74)}</td><td>1,1 M · 0,11 M</td><td>0,00 $</td><td>—</td></tr>
    <tr><td>${dot(colors[1])}Mistral interne <small>· OpenCode</small></td><td>${n(44)}</td><td>0,4 M · 0,07 M</td><td><small>non communiqué</small></td><td>—</td></tr></tbody></table>`)}
  <div class="mq-two">
  <div>${h3('Par projet')}${card(`<table class="mq-table"><tbody>
    <tr><td>carnet-de-lecture</td><td><span class="mq-bar-cell">${bar(90)}${n(151)}</span></td></tr>
    <tr><td>bobine</td><td><span class="mq-bar-cell">${bar(30)}${n(52)}</span></td></tr>
    <tr><td>notes-perso</td><td><span class="mq-bar-cell">${bar(7)}${n(11)}</span></td></tr></tbody></table>`)}</div>
  <div>${h3('Conversations qui ont le plus consommé')}${card(`<table class="mq-table"><tbody>
    <tr><td>Trois chantiers indépendants…</td><td>${n(38)}</td></tr>
    <tr><td>Plan de migration des réglages</td><td>${n(21)}</td></tr>
    <tr><td>Explique-moi ce projet</td><td>${n(17)}</td></tr></tbody></table>`)}</div></div>
  ${h3('IBM Bob sur ce Mac')}
  ${card(`<div class="settings-row"><div class="settings-row-text"><div class="settings-row-label">Quota du mois · 6,4 sur 20 Bobcoins (32 %)</div><div class="settings-row-hint">D’après le serveur de Bob, toutes machines confondues, travail hors Bobine compris. Lu à 16:42.</div></div><div class="settings-row-control"><button class="btn small">${i('rotate-cw', 13)}Actualiser</button></div></div>`)}`
}

/* ------------------------------------------------------------------ pages */

const weekStart = DAYS - 6 // lundi 19 oct.
const monthStart = DAYS - 24 // 1er oct.
const sum = (a, b) => DATA.slice(a, b + 1).reduce((s, v) => s + v, 0)
const yearTotal = sum(0, DAYS - 1).toLocaleString('fr-FR')

function weekPage(scheme) {
  const days = DATA.slice(weekStart, DAYS)
  const split = days.map((v, k) => [
    Math.round(v * (k % 2 ? 0.45 : 0.6)),
    v - Math.round(v * (k % 2 ? 0.45 : 0.6))
  ])
  split.push([0, 0])
  const ch = bars(scheme, {
    labels: WEEKDAYS.map((w, k) => [k, `${w} ${19 + k}`]),
    data: split,
    max: 40,
    ticks: [0, 10, 20, 30, 40],
    hover: [1, ['mar. 20 oct.', 'IBM Bob · 17', 'OpenCode · 21']]
  })
  return `${filters('Semaine', nav('19 – 25 oct. 2026'))}
  ${heatCard({ total: `${yearTotal} échanges`, scope: 'ces 12 derniers mois', focus: [weekStart, DAYS - 1], hint: 'Un clic sur un jour affiche ce jour.' })}
  <div class="mq-kpis">${kpi('Échanges', String(sum(weekStart, DAYS - 1)), 'dans 23 conversations', up('18 % vs semaine précédente'))}${kpi('Jetons traités', '1,4 M', 'entrée 1,3 M · sortie 0,1 M', up('9 %'))}${kpi('Temps de travail', '3 h 05', '1 min 41 par échange', down('4 %'))}${kpi('Coût', `1,87 ${small('Bobcoins')}`, 'et 0,00 $ (OpenCode)', up('12 %'))}</div>
  ${chartCard(ch, 'Échanges par jour')}
  ${tables(ch.colors, 0.45)}`
}

function monthPage(scheme) {
  const days = Array.from({ length: 31 }, (_, k) =>
    monthStart + k < DAYS ? DATA[monthStart + k] : 0
  )
  const split = days.map((v, k) => [
    Math.round(v * (k % 3 ? 0.55 : 0.4)),
    v - Math.round(v * (k % 3 ? 0.55 : 0.4))
  ])
  const ch = bars(scheme, {
    labels: [0, 6, 13, 20, 27].map((k) => [k, `${k + 1} oct.`]),
    data: split,
    max: 40,
    ticks: [0, 10, 20, 30, 40]
  })
  return `${filters('Mois', nav('octobre 2026'))}
  ${heatCard({ total: `${yearTotal} échanges`, scope: 'ces 12 derniers mois', focus: [monthStart, DAYS - 1], hint: 'Un clic sur un jour affiche ce jour.' })}
  <div class="mq-kpis">${kpi('Échanges', String(sum(monthStart, DAYS - 1)), 'dans 61 conversations', up('31 % vs septembre à date égale'))}${kpi('Jetons traités', '3,2 M', 'entrée 2,9 M · sortie 0,3 M', up('22 %'))}${kpi('Temps de travail', '6 h 40', '1 min 52 par échange', up('15 %'))}${kpi('Coût', `4,12 ${small('Bobcoins')}`, 'et 0,00 $ (OpenCode)', up('27 %'))}</div>
  ${chartCard(ch, 'Échanges par jour')}
  ${tables(ch.colors)}`
}

function yearPage(scheme) {
  // Douze mois glissants : nov. 2025 à oct. 2026.
  const months = Array.from({ length: 12 }, (_, m) => {
    let total = 0
    for (let d = 0; d < DAYS; d++)
      if (date(d).getMonth() === (10 + m) % 12 && date(d).getFullYear() === (m < 2 ? 2025 : 2026))
        total += DATA[d]
    return total
  })
  const split = months.map((v, k) => [
    Math.round(v * (k < 7 ? 0.8 : 0.5)),
    v - Math.round(v * (k < 7 ? 0.8 : 0.5))
  ])
  const ch = bars(scheme, {
    labels: Array.from({ length: 12 }, (_, k) => [k, MONTHS[(10 + k) % 12]]),
    data: split,
    max: 500,
    ticks: [0, 100, 200, 300, 400, 500]
  })
  return `${filters('Année', nav('nov. 2025 – oct. 2026'))}
  ${heatCard({ total: `${yearTotal} échanges`, scope: 'ces 12 derniers mois', hint: 'Un clic sur un jour affiche ce jour.' })}
  <div class="mq-kpis">${kpi('Échanges', yearTotal, 'dans 412 conversations', '')}${kpi('Jetons traités', '24,8 M', 'entrée 22,6 M · sortie 2,2 M', '')}${kpi('Temps de travail', '48 h', '1 min 49 par échange', '')}${kpi('Coût', `31,6 ${small('Bobcoins')}`, 'et 2,40 $ (OpenCode)', '')}</div>
  ${chartCard(ch, 'Échanges par mois')}
  ${tables(ch.colors, 7.5)}`
}

function dayPage(scheme) {
  const hours = [0, 0, 0, 0, 0, 0, 0, 0, 2, 5, 7, 4, 1, 3, 6, 5, 3, 2, 0, 0, 0, 0, 0, 0]
  const split = hours.map((v, k) => [
    Math.round(v * (k < 12 ? 0.6 : 0.3)),
    v - Math.round(v * (k < 12 ? 0.6 : 0.3))
  ])
  const ch = bars(scheme, {
    labels: [0, 6, 12, 18].map((k) => [k, `${k} h`]),
    data: split,
    max: 8,
    ticks: [0, 2, 4, 6, 8]
  })
  const day = `<span class="mq-chip-day">mardi 20 octobre 2026<button class="icon-button small" aria-label="Revenir à la semaine">${i('x', 13)}</button></span>`
  return `${filters('', day)}
  ${heatCard({ total: `${yearTotal} échanges`, scope: 'ces 12 derniers mois', focus: [DAYS - 5, DAYS - 5], pick: DAYS - 5, tip: DAYS - 5, hint: 'Un clic sur un jour affiche ce jour.' })}
  <div class="mq-kpis">${kpi('Échanges', '38', 'dans 9 conversations', up('2,1 × la moyenne d’un mardi'))}${kpi('Jetons traités', '0,61 M', 'entrée 0,56 M · sortie 0,05 M', '')}${kpi('Temps de travail', '1 h 12', '1 min 54 par échange', '')}${kpi('Coût', `0,74 ${small('Bobcoins')}`, 'et 0,00 $ (OpenCode)', '')}</div>
  ${chartCard(ch, 'Échanges par heure')}
  ${tables(ch.colors, 0.18)}`
}

/* ------------------------------------------------------------------ mise en place */

const footer = ({ active = false, hover = false } = {}) =>
  `<div class="sidebar-footer"><button class="mq-foot-entry ${active ? 'active' : ''} ${hover ? 'mq-hover' : ''}" aria-label="Consommation"><div class="agent-avatar">B<span class="status-dot ready"></span></div><div class="who"><div class="name">IBM Bob</div><div class="sub">Prêt · 32 % du quota</div><div class="mq-foot-bar"><span></span></div></div></button><button class="icon-button small">${i('settings', 15)}</button><button class="icon-button small">${i('bell', 15)}</button></div>`

const searchIcon = `<button class="icon-button no-drag" aria-label="Rechercher">${i('search', 17)}</button>`

const navRow = ({ active = false, hover = false } = {}) =>
  `<button class="sidebar-item ${active ? 'active' : ''} ${hover ? 'mq-hover-row' : ''}"><span class="icon-badge plain">${i('chart-column', 15)}</span><span class="label">Mon activité</span><kbd class="sidebar-kbd">⇧⌘U</kbd></button>`

async function openDashboard(h, page, { search = true } = {}) {
  await h.css(CSS)
  await h.sidebar({ active: '' })
  await h.stage('.mq-sb-fixed', navRow({ active: true }), 'append')
  if (search) await h.stage('.sidebar-header', searchIcon, 'prepend')
  await h.stage('.sidebar-footer', footer())
  await h.title('Mon activité')
  await h.stage(
    '.main > .scroll',
    `<div class="mq-dash-scroll"><div class="mq-dash">${page}</div></div>`
  )
}

export const DASHBOARD_SCREENS = [
  {
    id: 'bord-1-semaine',
    title: 'Ouverture : la semaine en cours, l’année en grille au-dessus, la semaine mise en avant',
    agent: 'IBM Bob',
    prepare: (h, scheme) => openDashboard(h, weekPage(scheme))
  },
  {
    id: 'bord-2-mois',
    title: 'Mois : chiffres comparés au mois précédent, barres par jour, tableaux en dessous',
    agent: 'IBM Bob',
    tall: true,
    prepare: async (h, scheme) => {
      await h.ui.viewport(1440, 1760)
      await openDashboard(h, monthPage(scheme))
    }
  },
  {
    id: 'bord-3-annee',
    title: 'Année : douze mois glissants, barres par mois',
    agent: 'IBM Bob',
    prepare: (h, scheme) => openDashboard(h, yearPage(scheme))
  },
  {
    id: 'bord-4-jour',
    title: 'Clic sur un jour de la grille : la page montre ce jour, barres par heure',
    agent: 'IBM Bob',
    prepare: (h, scheme) => openDashboard(h, dayPage(scheme))
  },
  {
    id: 'bord-5-entree',
    title: 'Point d’entrée : « Mon activité » sous « Nouvelle conversation », Rechercher en icône',
    agent: 'IBM Bob',
    prepare: async (h) => {
      await h.css(
        CSS.replace('.main > .thread-dock, .main-title-chevron { display: none !important; }', '')
      )
      await h.sidebar()
      await h.stage('.mq-sb-fixed', navRow({ hover: true }), 'append')
      await h.stage('.sidebar-header', searchIcon, 'prepend')
      h.after = `(() => { const b = document.querySelector('.sidebar-header [aria-label=Rechercher]').getBoundingClientRect();
        const t = document.createElement('div'); t.className = 'tooltip mq-search-tip'; t.setAttribute('data-maq', ''); t.textContent = 'Rechercher  ⌘K';
        t.style.left = (b.left - 20) + 'px'; t.style.top = (b.bottom + 6) + 'px'; document.body.append(t) })()`
      await h.stage('.sidebar-footer', footer())
      await h.title('Trois chantiers indépendants du README')
      await h.stage(
        '[data-testid=thread]',
        '<div class="thread"><div class="msg-user-group"><div class="msg-user">Trois chantiers indépendants du README : 4, 5 et 6. Confie-les à des conversations filles.</div></div><div class="msg-agent-group"><div class="msg-agent"><div class="markdown"><p>Je lance trois chantiers en parallèle, chacun dans son worktree.</p></div></div></div></div>'
      )
    }
  }
]

/* ------------------------------------------------------------------ fiche 147 : comparer les agents */

const WEEK_SPLIT = (() => {
  const days = DATA.slice(weekStart, DAYS)
  const split = days.map((v, k) => [
    Math.round(v * (k % 2 ? 0.45 : 0.6)),
    v - Math.round(v * (k % 2 ? 0.45 : 0.6))
  ])
  split.push([0, 0])
  return split
})()
const WEEK_LABELS = WEEKDAYS.map((w, k) => [k, `${w} ${19 + k}`])
const METRICS = ['Échanges', 'Temps', 'Jetons', 'Coût ($)', 'Coût (Bobcoins)']

function chartCard147(ch, title, metric, note, agents = ['IBM Bob', 'OpenCode']) {
  const legend = agents
    .map((a) => `<span><i style="background:${ch.colors[a === 'IBM Bob' ? 0 : 1]}"></i>${a}</span>`)
    .join('')
  const metrics = agents.includes('IBM Bob')
    ? METRICS
    : METRICS.filter((m) => m !== 'Coût (Bobcoins)')
  return `<div class="mq-card mq-chart-card"><div class="mq-chart-head"><span class="mq-title">${title}</span><span class="grow"></span>${seg(metrics, metric)}</div><div class="mq-chart-head"><span class="mq-legend">${legend}</span><span class="grow"></span>${seg(['Agents', 'Modèles'], 'Agents')}</div><div class="mq-chart">${ch.svg}</div>${note ? `<div class="mq-chart-note">${i('info', 13)}${note}</div>` : ''}</div>`
}

/** Tableaux, avec la ligne de Bob telle que le journal la donne : pas de jetons. */
const tables147 = (colors, scale) =>
  tables(colors, scale).replace('<td>1,4 M · 0,12 M</td>', '<td><small>non communiqué</small></td>')

const kpis147 = ({
  tokensWho = '',
  tokens = '1,7 M',
  tokensSub = 'entrée 1,5 M · sortie 0,18 M',
  cost,
  costSub,
  turns = String(sum(weekStart, DAYS - 1)),
  time = '3 h 05'
}) =>
  `<div class="mq-kpis">${kpi('Échanges', turns, 'dans 23 conversations', up('18 % vs semaine précédente'))}${kpi('Temps de travail', time, '1 min 41 par échange', down('4 %'))}${kpi(`Jetons traités${tokensWho ? ` <span class="mq-k-who">· ${tokensWho}</span>` : ''}`, tokens, tokensSub, up('9 %'))}${kpi('Coût', cost ?? `1,87 ${small('Bobcoins')}`, costSub ?? 'et 0,00 $ (OpenCode)', up('12 %'))}</div>`

function tokensChart(scheme) {
  return bars(scheme, {
    labels: WEEK_LABELS,
    data: WEEK_SPLIT.map(([, o]) => [0, o * 9]),
    max: 200,
    ticks: [0, 50, 100, 150, 200],
    fmt: (v) => (v ? `${v} k` : '0')
  })
}

function comparePage(scheme, variant) {
  const head = `${filters('Semaine', nav('19 – 25 oct. 2026'))}
  ${heatCard({ total: `${yearTotal} échanges`, scope: 'ces 12 derniers mois', focus: [weekStart, DAYS - 1], hint: 'Un clic sur un jour affiche ce jour.' })}`
  if (variant === 'today') {
    const ch = tokensChart(scheme)
    return `${head}
    <div class="mq-kpis">${kpi('Échanges', String(sum(weekStart, DAYS - 1)), 'dans 23 conversations', up('18 % vs semaine précédente'))}${kpi('Jetons traités', '1,7 M', 'entrée 1,5 M · sortie 0,18 M', up('9 %'))}${kpi('Temps de travail', '3 h 05', '1 min 41 par échange', down('4 %'))}${kpi('Coût', `1,87 ${small('Bobcoins')}`, 'et 0,00 $ (OpenCode)', up('12 %'))}</div>
    <div class="mq-card mq-chart-card"><div class="mq-chart-head"><span class="mq-title">Jetons par jour</span><span class="mq-legend"><span><i style="background:${ch.colors[0]}"></i>IBM Bob</span><span><i style="background:${ch.colors[1]}"></i>OpenCode</span></span><span class="grow"></span>${seg(['Agents', 'Modèles'], 'Agents')}${seg(['Échanges', 'Jetons', 'Coût ($)', 'Coût (Bobcoins)'], 'Jetons')}</div><div class="mq-chart">${ch.svg}</div></div>
    ${tables147(ch.colors, 0.45)}`
  }
  if (variant === 'tokens') {
    const ch = tokensChart(scheme)
    return `${head}${kpis147({ tokensWho: 'OpenCode' })}
    ${chartCard147(ch, 'Jetons par jour', 'Jetons', 'Jetons : OpenCode seulement. IBM Bob ne communique pas ses jetons.')}
    ${tables147(ch.colors, 0.45)}`
  }
  if (variant === 'time') {
    const ch = bars(scheme, {
      labels: WEEK_LABELS,
      data: WEEK_SPLIT.map(([b, o]) => [Math.round(b * 1.6), Math.round(o * 2.1)]),
      max: 80,
      ticks: [0, 20, 40, 60, 80],
      fmt: (v) => (v ? `${v} min` : '0'),
      hover: [1, ['mar. 20 oct.', 'IBM Bob · 27 min', 'OpenCode · 44 min']]
    })
    return `${head}${kpis147({ tokensWho: 'OpenCode' })}
    ${chartCard147(ch, 'Temps de travail par jour', 'Temps')}
    ${tables147(ch.colors, 0.45)}`
  }
  // Filtre « OpenCode » : chiffres et tableaux de l'agent seul, pas de carte « IBM Bob sur ce Mac ».
  const ch = bars(scheme, {
    labels: WEEK_LABELS,
    data: WEEK_SPLIT.map(([, o]) => [0, o]),
    max: 40,
    ticks: [0, 10, 20, 30, 40]
  })
  const t = tables147(ch.colors, 0.45)
    .replace(/<tr><td><span class="mq-dot"[^]*?IBM Bob <small>[^]*?<\/tr>/, '')
    .replace(/<h3 class="mq-h3">IBM Bob sur ce Mac<\/h3>[^]*$/, '')
  return `${filters('Semaine', nav('19 – 25 oct. 2026')).replace('<option>Tous les agents</option>', '<option>OpenCode</option>')}
  ${heatCard({ total: '1 214 échanges', scope: 'ces 12 derniers mois', focus: [weekStart, DAYS - 1], hint: 'Un clic sur un jour affiche ce jour.' })}
  ${kpis147({ turns: '54', time: '1 h 52', cost: `0,00 ${small('$')}`, costSub: '0,00 $ par échange' })}
  ${chartCard147(ch, 'Échanges par jour', 'Échanges', '', ['OpenCode'])}
  ${t}`
}

export const ACTIVITY_SCREENS = [
  {
    id: 'act-0-aujourdhui',
    title: 'Aujourd’hui : « Jetons » montre OpenCode seul, sans le dire',
    agent: 'IBM Bob',
    prepare: (h, scheme) => openDashboard(h, comparePage(scheme, 'today'), { search: false })
  },
  {
    id: 'act-1-jetons',
    title: 'Proposé : la mesure dit qui elle couvre',
    agent: 'IBM Bob',
    prepare: (h, scheme) => openDashboard(h, comparePage(scheme, 'tokens'), { search: false })
  },
  {
    id: 'act-2-temps',
    title: 'Proposé : « Temps », la deuxième mesure comparable entre agents',
    agent: 'IBM Bob',
    prepare: (h, scheme) => openDashboard(h, comparePage(scheme, 'time'), { search: false })
  },
  {
    id: 'act-3-opencode',
    title: 'Proposé : filtre « OpenCode », sans la carte de Bob',
    agent: 'OpenCode',
    tall: true,
    prepare: (h, scheme) => openDashboard(h, comparePage(scheme, 'opencode'), { search: false })
  }
]
