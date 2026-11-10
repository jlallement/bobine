import { describe, expect, it } from 'vitest'
import { RESUME_AFTER_MS, lastActivity, resumeSummary, shorten } from './resume-card'
import type { TranscriptItem } from './transcript'

const DAY = RESUME_AFTER_MS
const T0 = Date.UTC(2026, 9, 20, 9, 0)

const thread: TranscriptItem[] = [
  { kind: 'user', id: 1, text: 'Première demande', at: T0 },
  { kind: 'agent', id: 2, text: 'Réponse', at: T0 + 1000 },
  { kind: 'user', id: 3, text: 'Ajoute la page de connexion', at: T0 + 60_000 },
  {
    kind: 'plan',
    id: 4,
    entries: [
      { content: 'Formulaire', status: 'completed', priority: 'high' },
      { content: 'Validation', status: 'pending', priority: 'medium' },
      { content: 'Appel au serveur', status: 'in_progress', priority: 'high' }
    ]
  },
  { kind: 'agent', id: 5, text: '## Fait\n\nLe **formulaire** est prêt.', at: T0 + 120_000 }
]

describe('resumeSummary : « Où en était-on ? » (fiche 156)', () => {
  it('rien avant un jour d’inactivité, ni sans heure', () => {
    expect(resumeSummary(thread, T0 + 120_000 + DAY)).toBeNull()
    expect(resumeSummary([{ kind: 'user', id: 1, text: 'x' }], T0 + 10 * DAY)).toBeNull()
  })

  it('dernière demande, tâches faites et en cours (en cours d’abord), fichiers', () => {
    const summary = resumeSummary(thread, T0 + 2 * DAY, ['src/login.ts'])
    expect(summary).toEqual({
      lastAt: T0 + 120_000,
      request: 'Ajoute la page de connexion',
      done: ['Formulaire'],
      todo: [
        { text: 'Appel au serveur', running: true },
        { text: 'Validation', running: false }
      ],
      files: ['src/login.ts']
    })
  })

  it('sans plan : le début de la dernière réponse, sans Markdown', () => {
    const items = thread.filter((i) => i.kind !== 'plan')
    const summary = resumeSummary(items, T0 + 2 * DAY)
    expect(summary?.reply).toBe('Fait')
    expect(summary?.done).toEqual([])
  })

  it('messages d’une autre conversation et contexte de l’app ignorés', () => {
    const items: TranscriptItem[] = [
      {
        kind: 'user',
        id: 1,
        text: 'Vraie demande\n<bobine_capabilities>x</bobine_capabilities>',
        at: T0
      },
      {
        kind: 'user',
        id: 2,
        text: 'Compte rendu',
        at: T0 + 1,
        from: { kind: 'wake' }
      }
    ]
    expect(resumeSummary(items, T0 + 2 * DAY)?.request).toMatch(/^Vraie demande/)
  })
})

describe('lastActivity et shorten', () => {
  it('la plus récente heure, texte coupé sur une ligne', () => {
    expect(lastActivity(thread)).toBe(T0 + 120_000)
    expect(shorten('a\n  b', 10)).toBe('a b')
    expect(shorten('x'.repeat(20), 10)).toBe(`${'x'.repeat(9)}…`)
  })
})
