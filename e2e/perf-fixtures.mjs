/**
 * Profils lourds pour la suite `perf` et les bancs des fiches 192 et 193 : un long fil (même
 * recette que l'audit de la fiche 187 : tours « question, lecture, modification de 20 lignes,
 * réponse Markdown »), et des conversations à gros diff d'agent. Écrits directement dans
 * `conversations/` d'un profil jetable, au format du disque (`store.ts`).
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

const T0 = Date.UTC(2026, 10, 1)

/** Fil de `turns` tours de 4 éléments (5 000 éléments pour 1 250 tours). */
export function longThreadItems(turns) {
  const items = []
  let id = 0
  for (let n = 0; n < turns; n++) {
    const at = T0 + n * 2000
    items.push({ kind: 'user', text: `Question ${n} : explique le module ${n}`, at, id: ++id })
    items.push({
      kind: 'tool',
      toolCallId: `c${n}`,
      title: `Lecture de src/f${n}.ts`,
      toolKind: 'read',
      status: 'completed',
      content: [],
      locations: [{ path: `/projet/src/f${n}.ts` }],
      id: ++id
    })
    items.push({
      kind: 'tool',
      toolCallId: `e${n}`,
      title: `Modification de src/f${n}.ts`,
      toolKind: 'edit',
      status: 'completed',
      content: [
        {
          type: 'diff',
          path: `/projet/src/f${n}.ts`,
          oldText: `${n}a\n`.repeat(20),
          newText: `${n}b\n`.repeat(20)
        }
      ],
      locations: [{ path: `/projet/src/f${n}.ts` }],
      id: ++id
    })
    items.push({
      kind: 'agent',
      text: `Réponse **${n}** avec une liste :\n\n1. un\n2. deux\n\n\`\`\`ts\nconst x = ${n}\n\`\`\`\n`,
      at: at + 500,
      id: ++id
    })
  }
  return items
}

/** Modification d'un fichier de `lines` lignes, toutes changées (le pire cas de l'audit). */
export function bigDiffItems(lines) {
  const old = Array.from({ length: lines }, (_, i) => `ancienne ligne ${i} ${'x'.repeat(i % 40)}`)
  const neu = Array.from({ length: lines }, (_, i) => `nouvelle ligne ${i} ${'y'.repeat(i % 40)}`)
  return [
    { kind: 'user', text: `Réécris le gros fichier (${lines} lignes)`, at: T0, id: 1 },
    {
      kind: 'tool',
      toolCallId: 'big',
      title: 'Modification de package-lock.json',
      toolKind: 'edit',
      status: 'completed',
      content: [
        {
          type: 'diff',
          path: '/projet/package-lock.json',
          oldText: `${old.join('\n')}\n`,
          newText: `${neu.join('\n')}\n`
        }
      ],
      locations: [{ path: '/projet/package-lock.json' }],
      id: 2
    },
    { kind: 'agent', text: `Fichier de ${lines} lignes réécrit.`, at: T0 + 500, id: 3 }
  ]
}

/**
 * Profil jetable `userData` avec ces conversations (titre, éléments), la première en tête de liste.
 * Rend les identifiants, dans l'ordre.
 */
export function seedProfile(userData, workspace, conversations) {
  const dir = join(userData, 'conversations')
  mkdirSync(dir, { recursive: true })
  const records = conversations.map(({ title, items }, i) => {
    const id = randomUUID()
    writeFileSync(
      join(dir, `${id}.json`),
      JSON.stringify({ version: 1, items, nextId: items.length + 1 })
    )
    const updatedAt = new Date(T0 + (conversations.length - i) * 60_000).toISOString()
    return {
      id,
      title,
      titleSource: 'message',
      profileId: 'mock',
      workspace,
      createdAt: updatedAt,
      updatedAt
    }
  })
  writeFileSync(join(dir, 'index.json'), JSON.stringify(records))
  return records.map((r) => r.id)
}

/** Lecture dont la sortie fait `lines` lignes (« Afficher tout » sur une très longue sortie). */
export function bigOutputItems(lines) {
  // Un mot présent seulement dans la première ligne, masquée par le plafond (recherche dans le fil).
  const text = Array.from({ length: lines }, (_, i) =>
    i === 0 ? `ligne 1 MARQUE-DU-DEBUT` : `ligne ${i + 1} ${'.'.repeat(40)}`
  ).join('\n')
  return [
    { kind: 'user', text: `Lis le journal (${lines} lignes)`, at: T0, id: 1 },
    {
      kind: 'tool',
      toolCallId: 'log',
      title: 'Lecture de journal.log',
      toolKind: 'read',
      status: 'completed',
      content: [{ type: 'content', content: { type: 'text', text: `${text}\n` } }],
      locations: [{ path: '/projet/journal.log' }],
      id: 2
    },
    { kind: 'agent', text: `Journal de ${lines} lignes lu.`, at: T0 + 500, id: 3 }
  ]
}
