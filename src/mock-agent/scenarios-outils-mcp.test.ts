/**
 * Le scénario `outils-mcp-execute` rejoue la forme relevée (fiche 293) : mêmes mises à jour que la
 * trace réelle d'OpenCode 2.3.0, aux identifiants et au texte du résultat près.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { outilsMcpScenarios } from './scenarios-outils-mcp.mts'

const FIXTURE = join(
  import.meta.dirname,
  '..',
  'main',
  'agent',
  '__traces__',
  'opencode-2.3.0',
  'acp-execute-figma.jsonl'
)

type Update = Record<string, unknown>

/** Sans identifiant ni texte de résultat (assainis dans la trace, choisis dans le scénario). */
const shape = ({ toolCallId: _id, content: _content, ...rest }: Update) => rest

describe('scénario `outils-mcp-execute` (fiche 293)', () => {
  const relevé = readFileSync(FIXTURE, 'utf8')
    .trim()
    .split('\n')
    .map((line) => (JSON.parse(line) as { params: { update: Update } }).params.update)
  const steps = outilsMcpScenarios['outils-mcp-execute']?.steps ?? []
  const updates = steps.flatMap((s) => (s.kind === 'update' ? [s.update as Update] : []))
  const card = (list: Update[], id: string) => list.filter((u) => u['toolCallId'] === id).map(shape)

  it('1re carte (`search`) et 3e (`figma.whoami`) : la forme de la trace réelle', () => {
    expect(card(updates, 'call_mcp_1')).toEqual(card(relevé, 'call_FAKE_1'))
    // La 2e carte relevée a trois `in_progress` ; le scénario en joue deux, comme la 1re.
    const whoami = card(relevé, 'call_FAKE_2')
    expect(card(updates, 'call_mcp_3')).toEqual([whoami[0], whoami[1], whoami[2], whoami[4]])
  })

  it('2e carte : hypothèse (`input.namespace`), dite comme telle', () => {
    expect(outilsMcpScenarios['outils-mcp-execute']?.description).toContain('hypothèse')
    const end = card(updates, 'call_mcp_2').at(-1)
    expect(end?.['rawOutput']).toEqual({
      metadata: {
        toolCalls: [
          { tool: 'search', status: 'completed', input: { namespace: 'figma', limit: 100 } }
        ],
        truncated: false
      }
    })
  })
})
