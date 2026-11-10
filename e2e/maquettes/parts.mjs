// Morceaux de DOM réutilisés par les écrans : barre latérale cible, fil, faux site.
import { i } from './icons.mjs'

const row = ({ title, meta = '', line = '', slot = '', cls = '', more = false }) =>
  `<div class="history-item sidebar-item ${cls}" ${more ? 'data-mq-menu' : ''}><button class="history-open"><span class="row-slot">${slot}</span><span class="row-main"><span class="row-title"><span class="label">${title}</span>${meta ? `<span class="row-meta">${meta}</span>` : ''}</span>${line ? `<span class="inbox-line">${line}</span>` : ''}</span></button>${more ? `<button class="history-more" data-state="open">${i('ellipsis', 15)}</button>` : ''}</div>`

const spin = () => i('loader-circle', 13, 'spin')
const sec = (label, tools = '', cls = '') =>
  `<div class="mq-sec ${cls}"><span>${label}</span><span class="mq-sec-tools">${tools}<span class="mq-chev">${i(cls.includes('collapsed') ? 'chevron-right' : 'chevron-down', 13)}</span></span></div>`
/** En-tête de dossier : icône dans la colonne d'icône, nom aligné sur les titres, chevron juste après le nom. */
const folder = (name, open = true) =>
  `<div class="mq-folder ${open ? '' : 'closed'}"><span class="mq-folder-name">${name}</span><span class="mq-folder-chev">${i(open ? 'chevron-down' : 'chevron-right', 13)}</span></div>`

/** Lien d'une fille à sa mère, dans la colonne d'icône : coude arrondi et petite flèche, sans retrait. */
const tree = (last, first = false) => {
  const top = first ? 4 : 0
  const trunk = last ? `M8 ${top} L8 10` : `M8 ${top} L8 32`
  const branch = last ? 'Q8 16 14 16 L17.5 16' : 'M8 10 Q8 16 14 16 L17.5 16'
  return `<svg class="mq-tree" width="20" height="32" viewBox="0 0 20 32" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="${trunk} ${branch}"/><path d="M15 13.5 L17.5 16 L15 18.5"/></svg>`
}

const inbox = () =>
  sec('À traiter · 2') +
  row({
    title: 'Configurer l’accès à la base',
    meta: '1 min',
    line: `${i('hand', 12, 'mq-reason')}Autorisation : modification de config.json`,
    cls: 'inbox-item unread'
  }) +
  row({
    title: 'Écris les tests du serveur',
    meta: '6 min',
    line: `${i('check', 12, 'mq-reason done')}Compte rendu à lire`,
    cls: 'inbox-item unread'
  })

const pinned = () => sec('Épinglées') + row({ title: 'Plan des statistiques (acte 2)' })

/** Barre latérale cible. `mode` : 'folders' | 'recent'. `active` : titre sélectionné. */
export function sidebar({
  mode = 'folders',
  active = 'Trois chantiers indépendants du README',
  hover = '',
  menuOn = ''
} = {}) {
  const r = (title, extra = {}) =>
    row({
      title,
      ...extra,
      more: title === menuOn,
      cls: `${title === active ? 'active' : ''} ${title === hover ? 'mq-hover' : ''} ${extra.cls ?? ''}`
    })
  const mother = r('Trois chantiers indépendants du README', { meta: spin(), cls: 'mq-mother' })
  const kids =
    r('Filtre statut &amp; étiquette (tâche 4)', {
      meta: spin(),
      slot: tree(false, true),
      cls: 'mq-child'
    }) +
    r('Page « À lire » réordonnable (tâche 6)', {
      meta: `<span class="mq-state ok" title="Finie">${i('check', 14, '', 2.2)}</span>`,
      slot: tree(true),
      cls: 'mq-child'
    })
  const books = r('La liste des livres déborde sur mobile')
  const explain = r('Explique-moi ce projet : à quoi il sert')
  const branch = r('Explique-moi ce projet (suite)')
  const agents = r('Crée un AGENTS.md court pour ce projet')
  const plan = r(
    'Plan de migration des réglages',
    mode === 'recent' ? { meta: '<span class="mq-state">hier</span>' } : {}
  )
  const menu = r('Corrige le menu Fenêtre')
  const body =
    mode === 'folders'
      ? sec('Dossiers', i('list-filter', 14)) +
        folder('carnet-de-lecture') +
        mother +
        kids +
        books +
        explain +
        branch +
        agents +
        folder('bobine', false) +
        folder('notes-perso', false)
      : sec('Récents', i('list-filter', 14)) +
        mother +
        kids +
        books +
        plan +
        explain +
        branch +
        menu +
        agents
  return `<nav class="sidebar-body mq-sb">
    <div class="mq-sb-fixed">
      <button class="sidebar-item primary"><span class="icon-badge">${i('plus', 14)}</span><span class="label">Nouvelle conversation</span></button>
      <button class="sidebar-item"><span class="icon-badge plain">${i('search', 15)}</span><span class="label">Rechercher</span><kbd class="sidebar-kbd">⌘K</kbd></button>
    </div>
    <div class="mq-sb-scroll">${inbox()}${pinned()}${body}${sec('Archivées', '', 'collapsed')}</div>
  </nav>`
}

export const user = (text, time = '14:02') =>
  `<div class="msg-user-group"><div class="msg-user">${text}</div><div class="msg-user-actions"><time class="msg-time">${time}</time></div></div>`
export const agent = (html) =>
  `<div class="msg-agent-group"><div class="msg-agent"><div class="markdown">${html}</div></div></div>`
export const toolDone = (icon, label) =>
  `<div data-testid="tool" data-status="completed"><details class="tool"><summary class="tool-row">${i(icon, 15, 'tool-icon')}<span class="tool-title"><span>${label}</span></span><span class="tool-state completed">${i('check', 14)}</span>${i('chevron-right', 14, 'chevron tool-icon')}</summary></details></div>`
export const toolRunning = (icon, label) =>
  `<div data-testid="tool" data-status="in_progress"><div class="tool tool-row">${i(icon, 15, 'tool-icon')}<span class="tool-title"><span>${label}</span></span><span class="tool-state in_progress">${i('loader-circle', 14, 'spin')}</span></div></div>`
export const working = (spool, label, time, tip = '') =>
  `<div class="working" role="status">${spool}<span class="working-label">${label}</span><span class="working-time mq-time">${time}${tip ? `<span class="tooltip">${tip}</span>` : ''}</span></div>`

/** Faux site, en largeur « bureau » (tableau) ou « mobile » (cartes). */
export function site({ mobile = false } = {}) {
  const books = [
    ['L’Étranger', 'Albert Camus', '1942', 'Lu', ''],
    ['La Peste', 'Albert Camus', '1947', 'En cours', 'r'],
    ['Les Misérables', 'Victor Hugo', '1862', 'À lire', 'a'],
    ['Le Petit Prince', 'Antoine de Saint-Exupéry', '1943', 'Lu', ''],
    ['Germinal', 'Émile Zola', '1885', 'À lire', 'a'],
    ['Madame Bovary', 'Gustave Flaubert', '1857', 'Lu', '']
  ]
  const list = mobile
    ? books
        .map(
          ([t, a, y, s, c]) =>
            `<div class="card"><b>${t}</b><span>${a} · ${y}</span> <span class="st ${c}">${s}</span></div>`
        )
        .join('')
    : `<table><thead><tr><th>Titre</th><th>Auteur</th><th>Année</th><th>Statut</th></tr></thead><tbody>${books
        .map(
          ([t, a, y, s, c]) =>
            `<tr><td>${t}</td><td>${a}</td><td>${y}</td><td><span class="st ${c}">${s}</span></td></tr>`
        )
        .join('')}</tbody></table>`
  return `<div class="mq-site" style="padding:${mobile ? '18px 16px' : '22px 26px'}">
    <h1>Carnet de lecture</h1>
    <div class="bar"><input placeholder="Chercher un titre ou un auteur" style="flex:1;min-width:${mobile ? '100%' : '200px'}"><select><option>Tous les statuts</option></select><select><option>Dernières lectures</option></select></div>
    ${list}
    <h2>Ajouter un livre</h2>
    <div class="add"><input placeholder="Titre" style="width:${mobile ? '100%' : '150px'}"><input placeholder="Auteur" style="width:${mobile ? '100%' : '150px'}"><input placeholder="Année" style="width:80px"><span class="b primary" data-mq="add-btn">Ajouter</span></div>
  </div>`
}
