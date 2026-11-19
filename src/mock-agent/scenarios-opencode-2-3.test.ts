import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { methods } from '../shared/acp-sdk.mts'
import type { SessionNotification, SessionUpdate } from '../shared/acp-sdk.mts'
import { agentText, initialize, playTurn, withMockAgent } from './testing.mts'

/** Sous-agents d'OpenCode 2.3.0, toujours en arrière-plan (relevé du 2026-11-16). */

const CWD = '/tmp/projet'
const stores: string[] = []
const storeArgs = () => {
  const store = mkdtempSync(join(tmpdir(), 'mock-store-'))
  stores.push(store)
  return ['--store', store, '--arriere-plan-ms', '150']
}
afterEach(() => {
  for (const store of stores.splice(0)) rmSync(store, { recursive: true, force: true })
})
const meta = (u: SessionUpdate) => u._meta?.['opencode/child-session'] as { id: string } | undefined

/**
 * Joue un tour, attend la suite hors tour jusqu'à la fin de la réponse du parent (`lastWords`) ;
 * rend les mises à jour du tour, puis celles d'après. Attendre la réponse elle-même, pas un délai
 * fixe (fiche 250) : sur un coureur chargé, 600 ms ne suffisaient pas toujours à la recevoir.
 */
async function played(scenario: string, args: string[], lastWords: string) {
  const all: SessionNotification[] = []
  let turnEnded = -1
  let sessionId = ''
  const updatesAfter = () =>
    all
      .slice(turnEnded)
      .filter((n) => n.sessionId === sessionId)
      .map((n) => n.update)
  let wake = () => {}
  const answered = new Promise<void>((resolve) => {
    wake = () => {
      if (turnEnded >= 0 && agentText(updatesAfter()).endsWith(lastWords)) resolve()
    }
  })
  await withMockAgent(
    {
      scenario,
      args,
      onUpdate: (n) => {
        all.push(n)
        wake()
      }
    },
    async (ctx) => {
      await initialize(ctx)
      return ctx.buildSession(CWD).withSession(async (session) => {
        sessionId = session.sessionId
        await playTurn(session, 'Lance les sous-agents')
        turnEnded = all.length
        wake()
        await answered
        // La réponse hors tour est enregistrée après son envoi : l'agent reste en vie jusque-là,
        // sinon l'arrêt qui suit la perdrait (essai « rechargées »).
        const store = args[args.indexOf('--store') + 1]
        if (store) {
          const file = join(store, `${sessionId}.json`)
          await vi.waitFor(
            () => expect(existsSync(file) && readFileSync(file, 'utf8')).toContain(lastWords),
            { timeout: 10_000, interval: 20 }
          )
        }
      })
    }
  )
  const own = (n: SessionNotification) => n.sessionId === sessionId
  return {
    sessionId,
    turn: all
      .slice(0, turnEnded)
      .filter(own)
      .map((n) => n.update),
    after: updatesAfter()
  }
}

describe('sous-agents d’OpenCode 2.3.0 (agent factice)', () => {
  it('un sous-agent : outil rendu aussitôt « running », travail relayé pendant le tour, réponse du parent hors tour', async () => {
    const { turn, after } = await played(
      'sous-agent-arriere-plan-2-3',
      storeArgs(),
      '**KANGOUROU**.'
    )
    const card = turn.filter(
      (u) => u.sessionUpdate.startsWith('tool_call') && !meta(u) && 'toolCallId' in u
    )
    expect(card.at(-1)).toMatchObject({
      status: 'completed',
      rawOutput: { metadata: { sessionID: 'ses_mock_kangourou', status: 'running' } }
    })
    expect(turn.some((u) => meta(u)?.id === 'ses_mock_kangourou')).toBe(true)
    expect(agentText(turn)).not.toContain('KANGOUROU')
    // Après le tour : la réponse du parent seulement, rien du sous-agent.
    expect(after.every((u) => u.sessionUpdate === 'agent_message_chunk' && !meta(u))).toBe(true)
    expect(agentText(after)).toBe('Le mot de code est **KANGOUROU**.')
  })

  it('deux sous-agents en parallèle : deux cartes, deux sessions, chacune son travail', async () => {
    const { turn, after } = await played('sous-agents-arriere-plan-2-3', storeArgs(), '**ZEBRE**')
    const sessions = turn.flatMap((u) =>
      u.sessionUpdate === 'tool_call_update' && u.status === 'completed' && !meta(u)
        ? [(u.rawOutput as { metadata: { sessionID: string } }).metadata.sessionID]
        : []
    )
    expect(sessions).toEqual(['ses_mock_secret', 'ses_mock_autre'])
    const relayed = turn.flatMap((u) =>
      meta(u) && u.sessionUpdate === 'tool_call' ? [[meta(u)?.id, u.toolCallId]] : []
    )
    expect(relayed).toEqual([
      ['ses_mock_secret', 'ses_mock_secret:read_secret'],
      ['ses_mock_autre', 'ses_mock_autre:read_autre']
    ])
    expect(agentText(after)).toContain('ZEBRE')
  })

  it('rechargées : la réponse hors tour du parent est rejouée, la session du sous-agent a fini', async () => {
    const args = storeArgs()
    const { sessionId } = await played('sous-agent-arriere-plan-2-3', args, '**KANGOUROU**.')
    const replayed: SessionNotification[] = []
    await withMockAgent({ args, onUpdate: (n) => replayed.push(n) }, async (ctx) => {
      await initialize(ctx)
      for (const id of [sessionId, 'ses_mock_kangourou']) {
        await ctx.request(methods.agent.session.load, { sessionId: id, cwd: CWD, mcpServers: [] })
      }
    })
    const of = (id: string) => replayed.filter((n) => n.sessionId === id).map((n) => n.update)
    expect(agentText(of(sessionId))).toContain('Le mot de code est **KANGOUROU**.')
    const child = of('ses_mock_kangourou')
    expect(child[0]).toMatchObject({ sessionUpdate: 'user_message_chunk' })
    expect(
      child.some((u) => u.sessionUpdate === 'tool_call_update' && u.status === 'completed')
    ).toBe(true)
    expect(agentText(child)).toBe('Le mot de code de `secret.txt` est **KANGOUROU**.')
  })
})
