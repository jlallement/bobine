import { describe, expect, it } from 'vitest'
import type { ConversationSummary } from './agent'
import { exportConversation, exportFileName } from './export'
import type { TranscriptState } from './transcript'

const summary: ConversationSummary = {
  id: 'c1',
  title: 'Plan de migration Postgres : étape 1',
  profileId: 'bob',
  profileLabel: 'IBM Bob',
  workspace: '/Users/x/projet',
  updatedAt: '2026-10-13T10:00:00.000Z',
  status: 'stopped',
  draft: false
}

const transcript: TranscriptState = {
  items: [
    {
      kind: 'user',
      id: 1,
      text: 'Migre la base',
      attachments: [
        { kind: 'file', name: 'schema.sql' },
        { kind: 'text', name: 'Texte collé', text: 'ERREUR ```x```\nligne 2\n' }
      ]
    },
    { kind: 'thought', id: 2, text: 'Il faut lire le schéma.' },
    {
      kind: 'tool',
      id: 3,
      toolCallId: 't1',
      title: 'Writing file',
      status: 'completed',
      content: [
        { type: 'diff', path: '/Users/x/projet/migrate.sql', oldText: null, newText: 'ALTER' }
      ],
      locations: []
    },
    {
      kind: 'tool',
      id: 4,
      toolCallId: 't2',
      title: 'Running psql',
      status: 'completed',
      content: [{ type: 'terminal', terminalId: 'term-1' }],
      locations: []
    },
    {
      kind: 'plan',
      id: 5,
      entries: [
        { content: 'Lire le schéma', status: 'completed', priority: 'high' },
        { content: 'Migrer', status: 'pending', priority: 'medium' }
      ]
    },
    { kind: 'agent', id: 6, text: 'Voilà le **plan**.' },
    { kind: 'notice', id: 7, level: 'warning', text: 'Budget presque épuisé' }
  ],
  nextId: 8,
  terminals: { 'term-1': { output: '\u001b[32mOK\u001b[0m done\n', exited: true, exitCode: 0 } }
}

describe('export d’une conversation (fiche 043)', () => {
  it('exporte le texte entier des consignes de reprise (150)', () => {
    const value: TranscriptState = {
      items: [
        {
          kind: 'child-instruction',
          id: 1,
          childId: 'f',
          title: 'Import',
          prompt: 'Une première ligne.\nUne seconde ligne.',
          at: 1
        }
      ],
      nextId: 2
    }
    const md = exportConversation(summary, value, 'markdown')
    expect(md).toContain('Consigne pour «\u00a0Import\u00a0»')
    expect(md).toContain('Une première ligne.')
    expect(md).toContain('Une seconde ligne.')
    const saved = JSON.parse(exportConversation(summary, value, 'json')) as {
      transcript: TranscriptState
    }
    expect(saved.transcript.items).toEqual(value.items)
  })
  it('nom de fichier : titre en minuscules sans accents, date, extension', () => {
    const day = new Date(2026, 9, 13)
    expect(exportFileName(summary, 'markdown', day)).toBe(
      'plan-de-migration-postgres-etape-1-2026-10-13.md'
    )
    expect(exportFileName({ title: '???' }, 'json', day)).toBe('conversation-2026-10-13.json')
  })

  it('Markdown : en-tête, messages, outils, tâches, terminal sans codes couleur', () => {
    const md = exportConversation(summary, transcript, 'markdown', new Date(2026, 9, 13))
    expect(md.startsWith('# Plan de migration Postgres : étape 1\n')).toBe(true)
    expect(md).toContain('- Agent\u00a0: IBM Bob')
    expect(md).toContain(
      '## Vous\n\n*Pièces jointes\u00a0: schema.sql, Texte collé*\n\nMigre la base\n\n*Texte collé*\n\n````\nERREUR ```x```\nligne 2\n````'
    )
    expect(md).toContain('> **Réflexion**\n> Il faut lire le schéma.')
    expect(md).toContain(
      '**Outil** — Writing file *(completed)*\n\nFichier modifié\u00a0: `/Users/x/projet/migrate.sql`'
    )
    expect(md).toContain('```\nOK done\n```')
    expect(md).not.toContain('\u001b')
    expect(md).toContain('- [x] Lire le schéma\n- [ ] Migrer')
    expect(md).toContain('## IBM Bob\n\nVoilà le **plan**.')
    expect(md).toContain('> *warning*\u00a0: Budget presque épuisé')
    expect(md.endsWith('\n')).toBe(true)
    expect(md).not.toMatch(/\n{3,}/)
  })

  it('JSON : fil complet, réimportable', () => {
    const json = JSON.parse(exportConversation(summary, transcript, 'json')) as {
      format: string
      conversation: ConversationSummary
      transcript: TranscriptState
    }
    expect(json.format).toBe('bobine-conversation')
    expect(json.conversation.id).toBe('c1')
    expect(json.transcript.items).toHaveLength(7)
    expect(json.transcript.terminals?.['term-1']?.output).toContain('OK')
  })
})
