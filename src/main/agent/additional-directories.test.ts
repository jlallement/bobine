import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { AgentEvent } from '@shared/agent'
import { emptyTranscript, reduceTranscript } from '@shared/transcript'
import { MOCK_AGENT_ENTRY } from '../../mock-agent/testing.mts'
import { AgentHost } from './agent-host'
import {
  SessionDirectories,
  type ToldDirectories,
  type ToldStore,
  additionalDirectoriesParam,
  directoriesContext
} from './additional-directories'
import type { AgentProfile } from './profiles'

/** Agent factice qui garde ses sessions ; `--dossiers-en-plus` : annonce la capacité. */
function profile(withCapability: boolean): AgentProfile {
  const store = mkdtempSync(join(tmpdir(), 'dirs-store-'))
  return {
    id: 'mock',
    label: 'Agent factice',
    command: process.execPath,
    args: [
      MOCK_AGENT_ENTRY,
      '--scenario',
      'dossiers',
      '--delay',
      '0',
      '--store',
      store,
      ...(withCapability ? ['--dossiers-en-plus'] : [])
    ],
    env: {}
  }
}

function host(p: AgentProfile, folders: readonly string[], reopen?: string, told?: ToldStore) {
  const events: AgentEvent[] = []
  const agent = new AgentHost({
    profile: p,
    workspace: process.cwd(),
    directories: new SessionDirectories(() => folders, told),
    emit: (e) => events.push(e),
    ...(reopen ? { reopen: { sessionId: reopen, keepTranscript: true } } : {})
  })
  const reply = () => {
    const last = events.reduce(reduceTranscript, emptyTranscript).items.at(-1)
    return last?.kind === 'agent' ? last.text : ''
  }
  return { agent, reply }
}

describe('autres dossiers envoyés à l’ouverture de session (fiche 179)', () => {
  const other = mkdtempSync(join(tmpdir(), 'autre-dossier-'))

  it('agent qui annonce la capacité : reçus à session/new, puis à la réouverture', async () => {
    const p = profile(true)
    const first = host(p, [other])
    await first.agent.start()
    expect(first.agent.snapshot().additionalDirectories).toBe(true)
    await first.agent.prompt('Quels dossiers ?')
    expect(first.reply()).toContain(other)
    const sessionId = first.agent.currentSessionId ?? ''
    first.agent.stop()

    // Liste changée : la session rouverte (`session/load`) reçoit la nouvelle, complète.
    const second = mkdtempSync(join(tmpdir(), 'second-dossier-'))
    const again = host(p, [second], sessionId)
    await again.agent.start()
    await again.agent.prompt('Et maintenant ?')
    expect(again.reply()).toContain(second)
    expect(again.reply()).not.toContain(other)
    again.agent.stop()
  })

  it('agent qui ne l’annonce pas : rien envoyé (l’agent factice refuserait la session)', async () => {
    const { agent, reply } = host(profile(false), [other])
    await agent.start()
    expect(agent.snapshot().status).toBe('ready')
    expect(agent.snapshot().additionalDirectories).toBeUndefined()
    await agent.prompt('Quels dossiers ?')
    expect(reply()).toContain('Aucun autre dossier reçu.')
    agent.stop()
  })

  it('dossier disparu ou chemin relatif : pas envoyé', () => {
    expect(additionalDirectoriesParam(true, [other, '/nulle/part/ici', 'relatif'])).toEqual({
      additionalDirectories: [other]
    })
    expect(additionalDirectoriesParam(true, ['/nulle/part/ici'])).toEqual({})
    expect(additionalDirectoriesParam(false, [other])).toEqual({})
  })

  it('ligne de contexte (D13) : au premier message, puis une fois par changement', async () => {
    const p = profile(true)
    let saved: ToldDirectories | undefined
    const told: ToldStore = { get: () => saved, set: (t) => (saved = t) }
    const line = 'Additional working directories for this conversation:'
    const first = host(p, [other], undefined, told)
    await first.agent.start()
    await first.agent.prompt('Quels dossiers ?')
    expect(first.reply()).toContain(`${line} ${other}`)
    await first.agent.prompt('Encore ?')
    expect(first.reply()).toContain('Pas de ligne sur les dossiers dans ce message.')
    const sessionId = first.agent.currentSessionId ?? ''
    first.agent.stop()

    // Dossier retiré, session rouverte par un nouvel hôte : l'agent l'apprend une fois.
    const again = host(p, [], sessionId, told)
    await again.agent.start()
    await again.agent.prompt('Et sans ?')
    expect(again.reply()).toContain(`${line} none (removed ${other})`)
    await again.agent.prompt('Toujours sans ?')
    expect(again.reply()).toContain('Pas de ligne sur les dossiers dans ce message.')
    again.agent.stop()
  })

  it('directoriesContext : rien sans changement ; ajouts, retraits, autre session', () => {
    expect(directoriesContext([], [])).toBeUndefined()
    expect(directoriesContext(['/a', '/b'], ['/b', '/a'])).toBeUndefined()
    expect(directoriesContext([], ['/a', '/b'])).toBe(
      'Additional working directories for this conversation: /a, /b'
    )
    expect(directoriesContext(['/a', '/b'], ['/b'])).toBe(
      'Additional working directories for this conversation: /b (removed /a)'
    )
    let saved: ToldDirectories | undefined = { sessionId: 's1', folders: [other] }
    const dirs = new SessionDirectories(() => [other], {
      get: () => saved,
      set: (t) => (saved = t)
    })
    dirs.param(true)
    expect(dirs.context('s1')).toBeUndefined()
    // Session neuve (l'ancienne perdue) : elle ne sait rien, la liste est redite.
    expect(dirs.context('s2')).toContain(other)
    expect(saved).toEqual({ sessionId: 's2', folders: [other] })
    // Agent sans la capacité : rien envoyé, rien dit.
    const none = new SessionDirectories(() => [other], { get: () => undefined, set: vi.fn() })
    none.param(false)
    expect(none.context('s1')).toBeUndefined()
  })
})
