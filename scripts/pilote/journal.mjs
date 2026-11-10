/**
 * Journal de la session (fiche 206) : ce que le testeur a remarqué, ses interventions, et la
 * durée de chaque attente. Deux fichiers dans le dossier de la session :
 * - `journal.md` : lisible (le juge le relit), une section par entrée ;
 * - `journal.jsonl` : les mêmes entrées, une par ligne, pour `journal --resume`.
 * Le journal est l'état de la session : une session Claude interrompue reprend depuis lui.
 */
import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { formatDuration } from './args.mjs'
import { parseShownDuration } from './raison.mjs'

export const GRAVITY_LABELS = {
  bloquant: 'Bloquant',
  genant: 'Gênant',
  mineur: 'Mineur',
  idee: 'Idée'
}

const TYPE_TITLES = {
  debut: 'Début',
  fin: 'Fin',
  note: 'Note',
  intervention: 'Intervention',
  attente: 'Attente',
  action: 'Action'
}

/** Heure locale `14:02:31`. */
export const localClock = (date) => new Date(date).toLocaleTimeString('fr-FR', { hour12: false })
const clock = localClock

/** Section Markdown d'une entrée (pur). */
export function entryMarkdown(entry) {
  const title = [
    clock(entry.at),
    TYPE_TITLES[entry.type] ?? entry.type,
    entry.gravite && GRAVITY_LABELS[entry.gravite],
    entry.raison,
    entry.attenteMs !== undefined && formatDuration(entry.attenteMs)
  ]
    .filter(Boolean)
    .join(' · ')
  const parts = [`## ${title}`]
  if (entry.texte) parts.push(entry.texte)
  if (entry.detail) parts.push(`Détail : ${entry.detail}`)
  if (entry.capture) parts.push(`Capture : ${entry.capture}`)
  if (entry.etat) parts.push(`\`\`\`text\n${entry.etat}\n\`\`\``)
  return `${parts.join('\n\n')}\n\n`
}

/** Ajoute une entrée aux deux fichiers. */
export function appendEntry(dir, entry) {
  const full = { at: new Date().toISOString(), ...entry }
  const md = join(dir, 'journal.md')
  if (!existsSync(md)) appendFileSync(md, `# Journal de session Bobine\n\nDossier : ${dir}\n\n`)
  appendFileSync(md, entryMarkdown(full))
  appendFileSync(join(dir, 'journal.jsonl'), `${JSON.stringify(full)}\n`)
  return full
}

/** Entrées du journal (lignes illisibles ignorées). */
export function readEntries(dir) {
  const file = join(dir, 'journal.jsonl')
  if (!existsSync(file)) return []
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line)]
      } catch {
        return []
      }
    })
}

const median = (values) => {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/** Résumé chiffré (pur) : gravités, interventions, attentes et tours, durée de la session. */
export function summarize(entries, now = new Date()) {
  const notes = entries.filter((e) => e.type === 'note')
  const gravities = Object.fromEntries(Object.keys(GRAVITY_LABELS).map((g) => [g, 0]))
  for (const n of notes) gravities[n.gravite] = (gravities[n.gravite] ?? 0) + 1
  const interventions = entries.filter((e) => e.type === 'intervention')
  const waits = entries.filter((e) => e.type === 'attente')
  const reasons = {}
  for (const w of waits) reasons[w.raison] = (reasons[w.raison] ?? 0) + 1
  const turns = waits.map((w) => w.tourMs).filter((ms) => typeof ms === 'number')
  const first = entries[0]?.at
  // Session close (dernière entrée « fin ») : jusqu'à elle ; sinon jusqu'à maintenant.
  const last = entries.at(-1)?.type === 'fin' ? entries.at(-1).at : undefined
  return {
    notes: notes.length,
    gravities,
    interventions: interventions.map((i) => ({ at: i.at, texte: i.texte })),
    waits: waits.length,
    waitedMs: waits.reduce((n, w) => n + (w.attenteMs ?? 0), 0),
    reasons,
    turns: {
      count: turns.length,
      medianMs: median(turns),
      maxMs: turns.length ? Math.max(...turns) : 0,
      totalMs: turns.reduce((a, b) => a + b, 0)
    },
    sessionMs: first ? new Date(last ?? now).getTime() - new Date(first).getTime() : 0
  }
}

/** Résumé en texte (pur). */
export function formatSummary(s) {
  const lines = [
    `Session : ${formatDuration(s.sessionMs)} · ${s.waits} attente(s), ${formatDuration(s.waitedMs)} à attendre`,
    `Notes : ${s.notes} — ${Object.entries(s.gravities)
      .map(([g, n]) => `${GRAVITY_LABELS[g] ?? g} ${n}`)
      .join(', ')}`,
    `Interventions : ${s.interventions.length}`
  ]
  for (const i of s.interventions) lines.push(`  ${clock(i.at)} ${i.texte}`)
  if (s.turns.count) {
    lines.push(
      `Tours mesurés : ${s.turns.count} — médiane ${formatDuration(s.turns.medianMs)}, max ${formatDuration(s.turns.maxMs)}, total ${formatDuration(s.turns.totalMs)}`
    )
  }
  const reasons = Object.entries(s.reasons)
  if (reasons.length)
    lines.push(`Fins d’attente : ${reasons.map(([r, n]) => `${r} ${n}`).join(', ')}`)
  return lines.join('\n')
}

/** Durée du tour d'après l'écran (« 44 s » sous le dernier message), en ms. */
export const turnMs = (shot) => parseShownDuration(shot?.turnDuration)
