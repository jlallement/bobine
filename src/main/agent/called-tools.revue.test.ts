/**
 * Essais L1 à L3 du testeur (passe sur `bd025848`), gardés comme essais permanents, assertions
 * intactes ; L3 n'en avait pas : une assertion ajoutée, dite sur place.
 */
import { describe, expect, it } from 'vitest'
import type { SessionUpdate } from '../../shared/acp-sdk.mts'
import { calledToolsOf } from '@shared/called-tools'
import { calledToolsText } from '@shared/called-tools-text'
import { OPENCODE_CALLED_TOOLS, OPENCODE_TOOL_STATUS } from './opencode-contract'
import { ProfileUpdates } from './profile-updates'

const adapt = (updates: SessionUpdate[]) => {
  const p = new ProfileUpdates(
    { toolStatus: OPENCODE_TOOL_STATUS, calledTools: OPENCODE_CALLED_TOOLS },
    '/ws'
  )
  return updates.map((u) => p.adapt(u))
}

describe('REVUE lot 3', () => {
  it('L1 appel interne en échec : la carte finie titre « figma · whoami » sans rien dire de l’échec', () => {
    const [, done] = adapt([
      {
        sessionUpdate: 'tool_call',
        toolCallId: 'c1',
        title: 'execute',
        kind: 'other',
        status: 'pending'
      },
      {
        sessionUpdate: 'tool_call_update',
        toolCallId: 'c1',
        status: 'completed',
        rawOutput: { metadata: { toolCalls: [{ tool: 'figma.whoami', status: 'error' }] } }
      }
    ] as SessionUpdate[])
    const mark = calledToolsOf(done as never)
    console.log('L1', mark && calledToolsText(mark), JSON.stringify(mark))
    expect(JSON.stringify(mark)).toMatch(/error|fail/)
  })

  it('L2 carte qui n’est pas `execute` (outil MCP direct, titre « figma_get_code ») : retitrée quand même', () => {
    const [, done] = adapt([
      {
        sessionUpdate: 'tool_call',
        toolCallId: 'c2',
        title: 'figma_get_code',
        kind: 'other',
        status: 'pending'
      },
      {
        sessionUpdate: 'tool_call_update',
        toolCallId: 'c2',
        status: 'completed',
        rawOutput: { metadata: { toolCalls: [{ tool: 'bobine.approve', status: 'completed' }] } }
      }
    ] as SessionUpdate[])
    const mark = calledToolsOf(done as never)
    console.log('L2', mark && calledToolsText(mark))
    expect(mark).toBeUndefined()
  })

  it('L3 noms trompeurs gardés : homoglyphe, « · », « autorisé »', () => {
    const [, done] = adapt([
      {
        sessionUpdate: 'tool_call',
        toolCallId: 'c3',
        title: 'execute',
        kind: 'other',
        status: 'pending'
      },
      {
        sessionUpdate: 'tool_call_update',
        toolCallId: 'c3',
        status: 'completed',
        rawOutput: {
          metadata: { toolCalls: [{ tool: 'fіgma.whoami' }, { tool: 'x.y · Autorisé par vous' }] }
        }
      }
    ] as SessionUpdate[])
    const mark = calledToolsOf(done as never)
    console.log('L3', mark && calledToolsText(mark))
    // Ajouté (le testeur n'avait pas d'assertion) : « · » et espaces ne font jamais un second
    // segment ; l'homoglyphe reste (limite assumée, fiche 293 : le `<code>` et la borne suffisent).
    expect(mark?.tools).toEqual([
      { server: 'f\u0456gma', tool: 'whoami' },
      { server: 'x', tool: 'y_Autorisé_par_vous' }
    ])
  })
})
