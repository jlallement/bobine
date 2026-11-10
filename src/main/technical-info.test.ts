import { describe, expect, it } from 'vitest'
import { technicalInfo, type TechnicalFacts } from './technical-info'

const facts: TechnicalFacts = {
  name: 'Bobine',
  version: '0.4.0',
  build: { date: '2026-10-22', commit: 'abc1234' },
  versions: { electron: '44.7.2', chrome: '146.0.7000.0', node: '24.9.0' },
  os: '26.0',
  arch: 'arm64',
  language: 'fr',
  agents: [
    {
      label: 'IBM Bob',
      available: true,
      capabilities: {
        announced: { version: '1.3.0', seenAt: '2026-10-21T10:00:00Z', items: [] },
        specific: []
      }
    },
    { label: 'OpenCode', available: true, capabilities: { specific: [] } },
    { label: 'Agent absent', available: false, capabilities: { specific: [] } }
  ]
}

describe('infos techniques de la fenêtre À propos (fiche 116)', () => {
  it('version, commit, date, moteurs, système, langue et agents installés', () => {
    expect(technicalInfo(facts)).toBe(
      [
        'Bobine 0.4.0 (commit abc1234, built 2026-10-22)',
        'Electron 44.7.2',
        'Chromium 146.0.7000.0',
        'Node 24.9.0',
        'macOS 26.0 (arm64)',
        'Interface language: fr',
        'Agents:',
        '- IBM Bob 1.3.0',
        '- OpenCode version unknown (not started yet)'
      ].join('\n')
    )
  })

  it('aucun agent installé : dit tel quel', () => {
    expect(technicalInfo({ ...facts, agents: [] })).toContain('Agents: none installed')
  })
})
