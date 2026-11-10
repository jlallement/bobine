import { describe, expect, it } from 'vitest'
import {
  diagnosticReport,
  diagnosticSummary,
  groupLevel,
  type DiagnosticGroup
} from './diagnostics'

const [app, bob, ios]: [DiagnosticGroup, DiagnosticGroup, DiagnosticGroup] = [
  {
    id: 'app',
    title: 'Bobine',
    checks: [{ id: 'version', label: 'Version', level: 'ok', detail: '0.1.1' }]
  },
  {
    id: 'agent:bob',
    title: 'IBM Bob',
    checks: [
      { id: 'command', label: 'Commande', level: 'ok', detail: '~/.local/bin/bob' },
      {
        id: 'license',
        label: 'Licence',
        level: 'error',
        detail: 'à accepter',
        fix: 'Lisez-la et acceptez-la vous-même.',
        command: 'bob --show-license'
      }
    ]
  },
  {
    id: 'ios',
    title: 'Simulateur iOS',
    checks: [{ id: 'xcode', label: 'Xcode', level: 'optional', detail: 'pas installé' }]
  }
]
const groups = [app, bob, ios]

describe('rapport du diagnostic (fiche 061)', () => {
  it('une ligne par vérification, la marche à suivre dessous', () => {
    expect(diagnosticReport(groups, new Date(2026, 9, 14, 21, 5))).toBe(
      [
        'Diagnostic de Bobine — 2026-10-14 21:05',
        '1 problème',
        '',
        'Bobine',
        '  ✓ Version\u00a0: 0.1.1',
        '',
        'IBM Bob',
        '  ✓ Commande\u00a0: ~/.local/bin/bob',
        '  ✗ Licence\u00a0: à accepter',
        '    → Lisez-la et acceptez-la vous-même.',
        '    $ bob --show-license',
        '',
        'Simulateur iOS',
        '  – Xcode\u00a0: pas installé',
        ''
      ].join('\n')
    )
  })

  it('résumé et pastille d’un groupe', () => {
    expect(diagnosticSummary([app, ios])).toBe('Tout va bien.')
    const warning: DiagnosticGroup = {
      id: 'x',
      title: 'X',
      checks: [
        { id: 'a', label: 'A', level: 'warning', detail: '' },
        { id: 'b', label: 'B', level: 'warning', detail: '' },
        { id: 'c', label: 'C', level: 'pending', detail: '' }
      ]
    }
    expect(diagnosticSummary([...groups, warning])).toBe(
      '1 problème, 2 points à regarder, 1 vérification en cours'
    )
    expect(groupLevel(bob)).toBe('error')
    expect(groupLevel(ios)).toBe('optional')
    expect(groupLevel(warning)).toBe('warning')
  })
})
