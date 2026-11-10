import { describe, expect, it, vi } from 'vitest'
import type { AgentEvent } from '@shared/agent'
import { emptyTranscript, reduceTranscript } from '@shared/transcript'
import { CONTINUE_PROMPT } from './cost-cap'
import { answerTurnLimit, turnLimitHandlers } from './turn-limit'

/** Gestionnaire réduit : un fil tenu par le réducteur, les actions espionnées. */
function fakeManager(refused: boolean, reopen: boolean) {
  const start: AgentEvent[] = [
    { type: 'user-message', text: 'Travaille' },
    { type: 'turn-end', stopReason: 'max_turn_requests', limit: { refused, reopen } }
  ]
  let transcript = start.reduce(reduceTranscript, emptyTranscript)
  const posted: AgentEvent[] = []
  const manager = {
    view: () => ({ transcript }) as never,
    post: (_id: string, event: AgentEvent) => {
      posted.push(event)
      transcript = reduceTranscript(transcript, event)
    },
    prompt: vi.fn(() => Promise.resolve())
  }
  const restart = vi.fn((_how: 'reopen' | 'renew') => Promise.resolve())
  const cardId = transcript.items.find((i) => i.kind === 'turn-limit')?.id ?? -1
  return { manager, restart, posted, cardId }
}

describe('réponse à la carte « limite d’étapes » (fiche 209)', () => {
  it('Continuer : la carte est répondue, puis le message fixe de l’app part', async () => {
    const { manager, restart, posted, cardId } = fakeManager(false, false)
    await answerTurnLimit(manager, restart, 'c1', cardId, 'continue')
    expect(posted).toEqual([{ type: 'turn-limit-answer', itemId: cardId, answer: 'continue' }])
    expect(manager.prompt).toHaveBeenCalledWith('c1', CONTINUE_PROMPT)
    expect(restart).not.toHaveBeenCalled()
  })

  it('refus : rouvrir ou repartir selon le choix ; une seconde réponse est ignorée', async () => {
    const { manager, restart, cardId } = fakeManager(true, true)
    await answerTurnLimit(manager, restart, 'c1', cardId, 'reopen')
    await answerTurnLimit(manager, restart, 'c1', cardId, 'renew')
    expect(restart.mock.calls).toEqual([['reopen']])
  })

  it('réponse que la carte ne propose pas : rien (réouverture non proposée, Continuer après un refus)', async () => {
    const { manager, restart, posted, cardId } = fakeManager(true, false)
    await answerTurnLimit(manager, restart, 'c1', cardId, 'reopen')
    await answerTurnLimit(manager, restart, 'c1', cardId, 'continue')
    await answerTurnLimit(manager, restart, 'c1', cardId + 1, 'renew')
    expect(posted).toEqual([])
    expect(restart).not.toHaveBeenCalled()
    expect(manager.prompt).not.toHaveBeenCalled()
  })

  it('échec de l’action : dit dans le fil, la carte reste répondue', async () => {
    const { manager, restart, posted, cardId } = fakeManager(true, false)
    restart.mockRejectedValueOnce(new Error('agent arrêté'))
    await answerTurnLimit(manager, restart, 'c1', cardId, 'renew')
    expect(posted).toEqual([
      { type: 'turn-limit-answer', itemId: cardId, answer: 'renew' },
      { type: 'notice', level: 'error', message: 'agent arrêté' }
    ])
  })

  it('IPC : paramètres vérifiés', async () => {
    const handler = turnLimitHandlers({ answerTurnLimit: () => Promise.resolve() })[
      'conversation:answerTurnLimit'
    ]
    await expect(handler('c1', 1.5, 'renew')).rejects.toThrow('itemId')
    await expect(handler('c1', 1, 'stop' as never)).rejects.toThrow('answer')
    await expect(handler('', 1, 'renew')).rejects.toThrow('id')
    await expect(handler('c1', 1, 'renew')).resolves.toBeUndefined()
  })
})
