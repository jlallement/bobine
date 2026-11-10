/**
 * `pnpm pilote etat` : l'écran de Bobine en 5 à 15 lignes de texte, à partir de la lecture brute
 * (`lecture.mjs`). Pur, testé (`etat.test.ts`). Une ligne n'apparaît que si elle dit quelque
 * chose : un écran calme tient en 4 lignes.
 *
 * Les libellés du pilote sont en français ; les textes de Bobine sont repris tels qu'affichés,
 * dans la langue de l'interface.
 */

/** Extrait court d'un texte : `n` caractères au plus, coupé sur un mot. */
export function excerpt(text, n) {
  const t = (text ?? '').replace(/\s+/g, ' ').trim()
  if (t.length <= n) return t
  const cut = t.slice(0, n)
  const space = cut.lastIndexOf(' ')
  return `${(space > n * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`
}

export const words = (text) => (text ?? '').split(/\s+/).filter(Boolean).length

const join = (parts, sep = ' · ') => parts.filter(Boolean).join(sep)
const buttonsLine = (list) => list.map((b) => `[${b}]`).join(' ')

/** État du tour : en cours (activité, durée), fini (résumé), ou rien encore. */
export function turnLine(shot) {
  if (shot.working) {
    return `Tour : en cours — ${join([shot.working.label, shot.working.time])}${
      shot.queued ? ` · ${shot.queued} message(s) en file` : ''
    }`
  }
  if (shot.turnSummary) return `Tour : fini — ${shot.turnSummary}`
  if (shot.turnLimit) return `Tour : arrêté — ${shot.turnLimit}`
  if (shot.turnDuration) return `Tour : fini en ${shot.turnDuration}`
  if (shot.messages) return 'Tour : fini (sans résumé : interrompu ou en erreur ?)'
  return null
}

/** Résumé des outils du tour : nombre par genre, puis le dernier et son état. */
export function toolsLine(tools) {
  const items = tools?.items ?? []
  const total = items.length + (tools?.grouped ?? 0)
  if (!total) return null
  const byKind = new Map()
  for (const t of items) byKind.set(t.kind || '?', (byKind.get(t.kind || '?') ?? 0) + 1)
  if (tools.grouped) byKind.set('groupés', tools.grouped)
  const kinds = [...byKind].map(([k, n]) => `${k} ${n}`).join(', ')
  const last = items.at(-1)
  const lastText = last
    ? ` · dernier : ${excerpt(last.label, 70)} (${last.status})`
    : tools.groupSummary
      ? ` · ${excerpt(tools.groupSummary, 100)}`
      : ''
  return `Outils du tour : ${total} (${kinds})${lastText}`
}

/** Lignes d'une carte en attente : titre, objet (commande, fichier, question), boutons. */
export function cardLines(card) {
  const lines = [`Carte (${card.type}) : ${join([card.title, card.sub], ' — ')}`]
  if (card.command) lines.push(`  Commande : ${excerpt(card.command, 300)}`)
  if (card.cwd) lines.push(`  Dossier : ${card.cwd}`)
  for (const w of card.warnings ?? []) lines.push(`  ⚠ ${w}`)
  if (card.file) lines.push(`  Fichier : ${join([card.file, card.stats], ' ')}`)
  if (card.question) lines.push(`  Question : ${excerpt(card.question, 300)}`)
  if (card.choices?.length)
    lines.push(`  Choix : ${card.choices.map((c) => excerpt(c, 60)).join(' | ')}`)
  if (card.body) lines.push(`  ${excerpt(card.body, 300)}`)
  if (card.note) lines.push(`  Note : ${excerpt(card.note, 160)}`)
  lines.push(`  Boutons : ${buttonsLine(card.buttons)}`)
  return lines
}

function panelLine(panel) {
  if (!panel) return null
  const tabs = panel.tabs
    .map((t) => `${t.label}${t.count ? ` (${t.count})` : ''}${t.active ? '*' : ''}`)
    .join(' · ')
  return join([
    `Panneau : ${tabs || 'ouvert'}`,
    panel.running && `En cours : ${excerpt(panel.running, 120)}`,
    panel.changes && `Modifications : ${excerpt(panel.changes, 120)}`
  ])
}

function sidebarLine(sidebar) {
  if (!sidebar?.length) return null
  const shown = sidebar.slice(0, 8).map((c) => {
    const badges = [c.state, c.unread && !c.active ? 'non lu' : ''].filter(Boolean)
    return `${c.active ? '▸ ' : ''}${excerpt(c.title, 40)}${badges.length ? ` [${badges.join(', ')}]` : ''}`
  })
  const more = sidebar.length > 8 ? ` · +${sidebar.length - 8}` : ''
  return `Conversations (${sidebar.length}) : ${shown.join(' · ')}${more}`
}

/** `etat` en lignes de texte ; `long` : message de l'agent en entier. */
export function formatState(shot, { long = false } = {}) {
  const lines = []
  const agent = shot.agent ?? {}
  lines.push(
    join([
      `Bobine · ${agent.name || 'agent ?'} : ${agent.status || '?'}${agent.dot ? ` (${agent.dot})` : ''}`,
      shot.temporary && 'profil temporaire'
    ])
  )
  if (shot.onboarding) {
    const o = shot.onboarding
    lines.push(`Accueil : étape « ${o.step || '?'} » — ${o.title}${o.waiting ? ' (attente…)' : ''}`)
    if (o.text) lines.push(`  ${excerpt(o.text, long ? 2000 : 300)}`)
    if (o.choices?.length) {
      lines.push(
        `  Choix : ${o.choices.map((c) => `(${c.checked ? '•' : ' '}) ${c.label}`).join(' · ')}`
      )
    }
    if (o.error) lines.push(`  Erreur : ${o.error}`)
    if (o.buttons?.length) lines.push(`  Boutons : ${buttonsLine(o.buttons)}`)
  }
  if (shot.settings) lines.push(`Réglages ouverts : ${shot.settings}`)
  for (const d of shot.dialogs ?? []) {
    lines.push(`Dialogue : ${d.title}${d.buttons.length ? ` — ${buttonsLine(d.buttons)}` : ''}`)
  }
  if (shot.menu?.length) lines.push(`Menu ouvert : ${shot.menu.join(' | ')}`)
  if (!shot.onboarding) {
    const chips = shot.chips ?? {}
    const where =
      shot.welcome && !shot.messages ? 'nouvelle conversation' : `« ${shot.title || '?'} »`
    lines.push(`Conversation : ${join([where, chips.agent, chips.model, chips.mode])}`)
  }
  const turn = turnLine(shot)
  if (turn) lines.push(turn)
  for (const card of shot.cards ?? []) lines.push(...cardLines(card))
  if (shot.questions) lines.push('Question de l’agent à l’écran (formulaire)')
  for (const b of shot.blockers ?? []) {
    lines.push(`Blocage (${b.id}) : ${excerpt(b.text, 300)}`)
    if (b.buttons.length) lines.push(`  Boutons : ${buttonsLine(b.buttons)}`)
  }
  for (const a of shot.alerts ?? []) lines.push(`Avis (${a.kind}) : ${excerpt(a.text, 300)}`)
  if (shot.lastAgent) {
    const text = long ? shot.lastAgent : excerpt(shot.lastAgent, 300)
    lines.push(`Agent (${words(shot.lastAgent)} mots) : ${text}`)
  }
  const tools = toolsLine(shot.tools)
  if (tools) lines.push(tools)
  const panel = panelLine(shot.panel)
  if (panel) lines.push(panel)
  const sidebar = sidebarLine(shot.sidebar)
  if (sidebar) lines.push(sidebar)
  if (shot.composer?.present && shot.composer.draft) {
    lines.push(`Saisie : ${shot.composer.draft} caractères pas encore envoyés`)
  }
  return lines.join('\n')
}
