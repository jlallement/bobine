import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { methods } from '../shared/acp-sdk.mts'
import { agentText, initialize, playTurn, withMockAgent } from './testing.mts'
import { scenarios } from './scenarios.mts'
import { TurnCancelled } from './scenario.mts'
import { waitWhileLocked } from './verrou-fin-de-tour.mts'

const CWD = '/tmp/projet'
const dirs: string[] = []
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

/** Un chemin de verrou dans un dossier jetable, posé ou non. */
function lockPath(present: boolean): string {
  const dir = mkdtempSync(join(tmpdir(), 'mock-verrou-'))
  dirs.push(dir)
  const lock = join(dir, 'verrou')
  if (present) writeFileSync(lock, '')
  return lock
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe('verrou de fin de tour (fiche 223)', () => {
  it('sans fichier : passe tout de suite', async () => {
    await expect(
      waitWhileLocked(lockPath(false), new AbortController().signal)
    ).resolves.toBeUndefined()
  })

  it('fichier posé : attend sa disparition', async () => {
    const lock = lockPath(true)
    let released = false
    const waiting = waitWhileLocked(lock, new AbortController().signal, 5).then(() => {
      released = true
    })
    await sleep(60)
    expect(released).toBe(false)
    rmSync(lock)
    await waiting
    expect(released).toBe(true)
  })

  it('annulation pendant l’attente : TurnCancelled', async () => {
    const abort = new AbortController()
    const waiting = waitWhileLocked(lockPath(true), abort.signal, 5)
    abort.abort()
    await expect(waiting).rejects.toBeInstanceOf(TurnCancelled)
  })

  it('agent : le scénario est joué, mais le tour ne finit qu’une fois le verrou enlevé', async () => {
    const lock = lockPath(true)
    let firstUpdateAt = 0
    let removedAt = 0
    const turn = await withMockAgent(
      { scenario: 'streaming-texte', args: ['--verrou-fin-de-tour', lock] },
      async (ctx) => {
        await initialize(ctx)
        return ctx.buildSession(CWD).withSession((session) =>
          playTurn(session, 'Bonjour', () => {
            if (firstUpdateAt) return
            firstUpdateAt = Date.now()
            // Le texte part pendant que le verrou tient ; on l'enlève un peu plus tard.
            setTimeout(() => {
              removedAt = Date.now()
              rmSync(lock)
            }, 300)
          })
        )
      }
    )
    const endedAt = Date.now()
    expect(turn.stopReason).toBe('end_turn')
    expect(removedAt).toBeGreaterThan(0)
    expect(endedAt).toBeGreaterThanOrEqual(removedAt)
    expect(existsSync(lock)).toBe(false)
    expect(agentText(turn.updates)).toBe(
      (scenarios['streaming-texte']?.steps[0] as { text: string }).text
    )
  })

  it('agent : session/cancel libère un tour verrouillé (stopReason cancelled)', async () => {
    const lock = lockPath(true)
    const turn = await withMockAgent(
      { scenario: 'streaming-texte', args: ['--verrou-fin-de-tour', lock] },
      async (ctx) => {
        await initialize(ctx)
        return ctx.buildSession(CWD).withSession((session) => {
          let sent = false
          return playTurn(session, 'Bonjour', () => {
            if (sent) return
            sent = true
            setTimeout(
              () => void ctx.notify(methods.agent.session.cancel, { sessionId: session.sessionId }),
              200
            )
          })
        })
      }
    )
    expect(turn.stopReason).toBe('cancelled')
    expect(existsSync(lock)).toBe(true)
  })
})
