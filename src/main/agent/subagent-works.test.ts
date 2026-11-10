import { describe, expect, it, vi } from 'vitest'
import type { TranscriptItem } from '@shared/transcript'
import type { AgentProfile } from './profiles'
import type { ReplayOptions } from './session-replay'
import { SubagentWorks } from './subagent-works'

const profile: AgentProfile = { id: 'opencode', label: 'OpenCode', command: 'x', args: [], env: {} }
const options = (sessionId: string): ReplayOptions => ({
  profile,
  workspace: '/projet',
  sessionId,
  credentials: () => Promise.resolve({})
})
const consigne: TranscriptItem = { kind: 'user', id: 1, text: 'Cherche les tests' }
const travail: TranscriptItem = { kind: 'agent', id: 2, text: 'Trois fichiers trouvés.' }

describe('travail des sous-agents gardé en mémoire (fiche 053)', () => {
  it('rejoué une fois, sans la consigne déjà sur la carte', async () => {
    const replay = vi.fn(async () => [consigne, travail])
    const works = new SubagentWorks({ replay })
    expect(await works.load(options('s1'))).toEqual([travail])
    expect(await works.load(options('s1'))).toEqual([travail])
    expect(replay).toHaveBeenCalledTimes(1)
  })

  it('un échec est oublié : on peut réessayer', async () => {
    const replay = vi
      .fn<(o: ReplayOptions) => Promise<TranscriptItem[]>>()
      .mockRejectedValueOnce(new Error('session introuvable'))
      .mockResolvedValueOnce([travail])
    const works = new SubagentWorks({ replay })
    await expect(works.load(options('s1'))).rejects.toThrow('introuvable')
    expect(await works.load(options('s1'))).toEqual([travail])
  })

  it('seuls les plus récents restent', async () => {
    const replay = vi.fn(async () => [travail])
    const works = new SubagentWorks({ replay, max: 2 })
    for (const id of ['s1', 's2', 's3']) await works.load(options(id))
    await works.load(options('s3'))
    await works.load(options('s1'))
    expect(replay).toHaveBeenCalledTimes(4)
  })
})

describe('sous-agent qui travaille encore (fiche 122)', () => {
  it('relu à chaque fois, sans prendre la place du travail gardé', async () => {
    const replay = vi
      .fn<(o: ReplayOptions) => Promise<TranscriptItem[]>>()
      .mockResolvedValueOnce([consigne])
      .mockResolvedValueOnce([consigne, travail])
      .mockResolvedValueOnce([consigne, travail])
    const works = new SubagentWorks({ replay })
    expect(await works.load(options('s1'), { fresh: true })).toEqual([])
    expect(await works.load(options('s1'), { fresh: true })).toEqual([travail])
    expect(await works.load(options('s1'))).toEqual([travail])
    expect(replay).toHaveBeenCalledTimes(3)
  })
})
