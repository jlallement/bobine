import { describe, expect, it } from 'vitest'
import type { SessionUpdate } from '../../shared/acp-sdk.mts'
import type { TranscriptItem } from '@shared/transcript'
import { ReplayBuffer } from './replay-buffer'

const user = (text: string): SessionUpdate => ({
  sessionUpdate: 'user_message_chunk',
  content: { type: 'text', text }
})
const agent = (text: string): SessionUpdate => ({
  sessionUpdate: 'agent_message_chunk',
  content: { type: 'text', text }
})
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe('ReplayBuffer (fil gardé, fiche 103)', () => {
  it('réduit le rejeu à part et le remet une fois le calme revenu', async () => {
    const settled: TranscriptItem[][] = []
    const buffer = new ReplayBuffer((items) => settled.push(items), 20)
    buffer.note(user('Un'))
    buffer.note(agent('Ré'))
    buffer.note(agent('ponse'))
    expect(settled).toEqual([])
    await sleep(40)
    expect(settled).toHaveLength(1)
    expect(settled[0]?.map((i) => i.kind)).toEqual(['user', 'agent'])
    expect(settled[0]?.[1]).toMatchObject({ text: 'Réponse' })
  })

  it('settle() remet tout de suite, puis plus rien ; loaded() seul ne remet rien', async () => {
    const settled: TranscriptItem[][] = []
    const buffer = new ReplayBuffer((items) => settled.push(items), 20)
    buffer.loaded()
    await sleep(40)
    expect(settled).toEqual([])
    buffer.note(user('Un'))
    buffer.settle()
    expect(settled).toHaveLength(1)
    await sleep(40)
    expect(settled).toHaveLength(1)
  })

  it('clear() oublie le rejeu en cours sans le remettre', async () => {
    const settled: TranscriptItem[][] = []
    const buffer = new ReplayBuffer((items) => settled.push(items), 20)
    buffer.note(user('Un'))
    buffer.clear()
    await sleep(40)
    expect(settled).toEqual([])
  })

  describe('attente d’un message à la relance (fiche 121)', () => {
    it('sans rejeu attendu : settled() répond tout de suite', async () => {
      const buffer = new ReplayBuffer(() => {}, 20)
      await expect(buffer.settled(1000)).resolves.toBe(true)
    })

    it('rejeu tardif : le calme sans rien entendu ne compte pas, le rejeu remis avant la réponse', async () => {
      const settled: TranscriptItem[][] = []
      const buffer = new ReplayBuffer((items) => settled.push(items), 20)
      buffer.expect()
      buffer.loaded()
      let calm: boolean | undefined
      void buffer.settled(1000).then((value) => (calm = value))
      await sleep(40)
      expect(calm).toBeUndefined()
      buffer.note(user('Un'))
      buffer.note(agent('Réponse'))
      await sleep(40)
      expect(calm).toBe(true)
      expect(settled).toHaveLength(1)
      await expect(buffer.settled(0)).resolves.toBe(true)
    })

    it('rejeu qui ne vient pas : false au bout du délai ; finish() n’attend plus rien', async () => {
      const buffer = new ReplayBuffer(() => {}, 20)
      buffer.expect()
      await expect(buffer.settled(30)).resolves.toBe(false)
      await expect(buffer.settled(10)).resolves.toBe(false)
      buffer.finish()
      await expect(buffer.settled(0)).resolves.toBe(true)
    })

    it('rejeu entendu avant la réponse à session/load (ACP) : rien à attendre', async () => {
      const buffer = new ReplayBuffer(() => {}, 1000)
      buffer.expect()
      buffer.note(user('Un'))
      buffer.loaded()
      await expect(buffer.settled(0)).resolves.toBe(true)
      buffer.clear()
    })

    it('clear() libère les messages en attente', async () => {
      const buffer = new ReplayBuffer(() => {}, 20)
      buffer.expect()
      const waiting = buffer.settled(1000)
      buffer.clear()
      await expect(waiting).resolves.toBe(true)
    })
  })
})
