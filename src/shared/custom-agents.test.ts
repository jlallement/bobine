import { describe, expect, it } from 'vitest'
import {
  EMPTY_DRAFT,
  agentFromDraft,
  draftOf,
  draftProblems,
  joinCommandLine,
  newCustomAgentId,
  parseCustomAgents,
  parseEnvLines,
  splitCommandLine
} from './custom-agents'

describe('ligne de commande', () => {
  it('découpe comme un shell, sans rien évaluer', () => {
    expect(splitCommandLine('npx -y @acme/agent --acp')).toEqual([
      'npx',
      '-y',
      '@acme/agent',
      '--acp'
    ])
    expect(splitCommandLine('  "/Applications/Mon Agent.app/agent"  acp ')).toEqual([
      '/Applications/Mon Agent.app/agent',
      'acp'
    ])
    expect(splitCommandLine(`agent --name 'a "b" c' --x "d \\"e\\" \\\\f"`)).toEqual([
      'agent',
      '--name',
      'a "b" c',
      '--x',
      'd "e" \\f'
    ])
    expect(splitCommandLine('agent mon\\ dossier "" $HOME')).toEqual([
      'agent',
      'mon dossier',
      '',
      '$HOME'
    ])
    expect(splitCommandLine('')).toEqual([])
    expect(splitCommandLine('agent "pas fermé')).toBeUndefined()
  })

  it('se recompose à l’identique', () => {
    for (const words of [
      ['npx', '-y', '@acme/agent', '--acp'],
      ['/Applications/Mon Agent.app/agent', 'a "b"', 'c\\d', '', '~/x']
    ]) {
      expect(splitCommandLine(joinCommandLine(words))).toEqual(words)
    }
    expect(joinCommandLine(['npx', '-y', '@acme/agent'])).toBe('npx -y @acme/agent')
  })
})

describe('variables d’environnement', () => {
  it('lit le format .env', () => {
    expect(
      parseEnvLines('ACME_REGION=eu\n\n# commentaire\nexport ACME_LOG = "info"\nVIDE=\nURL=a=b')
    ).toEqual({ env: { ACME_REGION: 'eu', ACME_LOG: 'info', VIDE: '', URL: 'a=b' } })
  })

  it('rend la première ligne mal formée', () => {
    expect(parseEnvLines('A=1\nACME LOG info\n2X=3').bad).toEqual({
      line: 2,
      text: 'ACME LOG info'
    })
    expect(parseEnvLines('=valeur').bad).toEqual({ line: 1, text: '=valeur' })
  })
})

describe('formulaire', () => {
  const draft = {
    label: ' Agent maison ',
    commandLine: 'npx -y @acme/agent --acp',
    envText: 'ACME_REGION=eu',
    apiKeyEnv: 'ACME_API_KEY',
    compactCommand: '/compact'
  }

  it('sans erreur : l’agent, et son formulaire à l’identique', () => {
    expect(draftProblems(draft)).toEqual([])
    const agent = agentFromDraft(draft, 'custom-agent-maison')
    expect(agent).toEqual({
      id: 'custom-agent-maison',
      label: 'Agent maison',
      command: 'npx',
      args: ['-y', '@acme/agent', '--acp'],
      env: { ACME_REGION: 'eu' },
      apiKeyEnv: 'ACME_API_KEY',
      compactCommand: '/compact'
    })
    expect(draftOf(agent)).toEqual({ ...draft, label: 'Agent maison' })
  })

  it('les champs facultatifs vides restent absents', () => {
    const agent = agentFromDraft({ ...EMPTY_DRAFT, label: 'A', commandLine: 'a' }, 'custom-a')
    expect(agent).toEqual({ id: 'custom-a', label: 'A', command: 'a', args: [], env: {} })
  })

  it('erreurs par champ', () => {
    const keys = (d: Partial<typeof draft>) =>
      draftProblems({ ...draft, ...d }).map((p) => `${p.field}:${p.key.split('.').pop()}`)
    expect(keys({ label: '  ' })).toEqual(['label:labelMissing'])
    expect(keys({ commandLine: '   ' })).toEqual(['commandLine:commandMissing'])
    expect(keys({ commandLine: 'agent "x' })).toEqual(['commandLine:quote'])
    expect(keys({ envText: 'A=1\nACME LOG' })).toEqual(['envText:envLine'])
    expect(keys({ apiKeyEnv: 'ma clé' })).toEqual(['apiKeyEnv:apiKeyName'])
    expect(keys({ apiKeyEnv: 'ACME_REGION' })).toEqual(['apiKeyEnv:apiKeyInEnv'])
    expect(keys({ compactCommand: 'compact' })).toEqual(['compactCommand:compact'])
    expect(draftProblems({ ...draft, envText: 'A=1\nACME LOG' })[0]?.params).toEqual({
      line: 2,
      text: 'ACME LOG'
    })
  })
})

describe('identifiant', () => {
  it('custom-<nom>, jamais mock*, suffixé s’il est pris', () => {
    expect(newCustomAgentId('Agent Maison', [])).toBe('custom-agent-maison')
    expect(newCustomAgentId('Éléphant 2', [])).toBe('custom-elephant-2')
    expect(newCustomAgentId('mock', ['mock'])).toBe('custom-mock')
    expect(newCustomAgentId('!!!', [])).toBe('custom-agent')
    expect(newCustomAgentId('A', ['custom-a', 'custom-a-2'])).toBe('custom-a-3')
  })
})

describe('lecture de settings.json', () => {
  it('garde les agents valides, ignore le reste', () => {
    expect(
      parseCustomAgents([
        {
          id: 'custom-a',
          label: 'A',
          command: 'a',
          args: ['x', 3],
          env: { OK: '1', 'PAS OK': '2', N: 3 },
          apiKeyEnv: 'KEY',
          compactCommand: '/compact'
        },
        { id: 'custom-a', label: 'Doublon', command: 'b' },
        { id: 'bob', label: 'Usurpé', command: 'b' },
        { id: 'custom-b', label: '', command: 'b' },
        { id: 'custom-c', label: 'C', command: 'c', apiKeyEnv: 'mal nommée', compactCommand: 'x' },
        'n’importe quoi'
      ])
    ).toEqual([
      {
        id: 'custom-a',
        label: 'A',
        command: 'a',
        args: ['x'],
        env: { OK: '1' },
        apiKeyEnv: 'KEY',
        compactCommand: '/compact'
      },
      { id: 'custom-c', label: 'C', command: 'c', args: [], env: {} }
    ])
    expect(parseCustomAgents(undefined)).toEqual([])
  })
})
