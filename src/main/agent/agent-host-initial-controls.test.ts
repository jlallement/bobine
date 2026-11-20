/**
 * Réglages de départ d'une session selon qu'elle est rouverte ou neuve (fiche 256) : l'hôte dit
 * lequel, et relit les réglages à chaque ouverture (jamais figés à sa création).
 */
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { ControlValue } from '@shared/agent'
import { noticeText } from '@shared/transcript'
import { MOCK_AGENT_ENTRY } from '../../mock-agent/testing.mts'
import { AgentHost, type AgentHostOptions } from './agent-host'
import { lateNotice, watchLate } from './initial-controls'
import { AgentTimeout } from './process-utils'
import { withoutWarned } from '../conversations/host-options'
import type { AgentProfile } from './profiles'

function storeProfile(...extra: string[]): AgentProfile {
  const store = mkdtempSync(join(tmpdir(), 'initial-controls-'))
  return {
    id: 'mock',
    label: 'Agent factice',
    command: process.execPath,
    args: [MOCK_AGENT_ENTRY, '--scenario', 'echo', '--delay', '0', '--store', store, ...extra],
    env: {}
  }
}

/** Hôte dont les réglages de départ sont notés à chaque ouverture ; `values` les fournit. */
function host(
  profile: AgentProfile,
  values: () => Record<string, ControlValue> | undefined,
  reopen?: AgentHostOptions['reopen']
) {
  const asked: ('new' | 'reopened')[] = []
  const agent = new AgentHost({
    profile,
    workspace: process.cwd(),
    emit: () => {},
    initialControls: (session) => {
      asked.push(session)
      return values()
    },
    ...(reopen ? { reopen } : {})
  })
  const value = (id: string) => agent.snapshot().controls.find((c) => c.id === id)?.currentValue
  return { agent, asked, value }
}

describe('AgentHost : réglages de départ, session neuve ou rouverte (fiche 256)', () => {
  it('session neuve, puis rouverte : l’hôte le dit, et rien n’est appliqué sans réglages', async () => {
    const profile = storeProfile('--reglages-oublies')
    const first = host(profile, () => ({ mode: 'ask' }))
    await first.agent.start()
    expect(first.asked).toEqual(['new'])
    expect(first.value('mode')).toBe('ask')
    const sessionId = first.agent.currentSessionId
    first.agent.stop()
    if (!sessionId) throw new Error('session absente')

    // Rouverte sans réglages (conversation d'avant la fiche) : ceux de l'agent, ici ses défauts.
    const again = host(profile, () => undefined, { sessionId })
    await again.agent.start()
    expect(again.asked).toEqual(['reopened'])
    expect(again.agent.currentSessionId).toBe(sessionId)
    expect(again.value('mode')).toBe('code')
    again.agent.stop()
  })

  it('relus à chaque ouverture : une relance dans le même hôte prend les derniers', async () => {
    const profile = storeProfile()
    let wanted: Record<string, ControlValue> = { model: 'factice-precis' }
    const { agent, asked, value } = host(profile, () => wanted)
    await agent.start()
    expect(value('model')).toBe('factice-precis')
    wanted = { model: 'factice-rapide' }
    await agent.restart()
    expect(asked).toEqual(['new', 'new'])
    expect(value('model')).toBe('factice-rapide')
    agent.stop()
  })

  it('session perdue par l’agent : la session neuve qui la remplace est dite neuve', async () => {
    const profile = storeProfile()
    const { agent, asked, value } = host(profile, () => ({ mode: 'plan' }), {
      sessionId: 'mock-perdue',
      keepTranscript: true
    })
    await agent.start()
    expect(agent.currentSessionId).not.toBe('mock-perdue')
    expect(asked).toEqual(['new'])
    expect(value('mode')).toBe('plan')
    agent.stop()
  })
})

describe('AgentHost : modèle retenu que l’agent ne propose plus (fiche 266, D32)', () => {
  function withNotices(
    wanted: Record<string, ControlValue>,
    knownName?: (controlId: string, value: string) => string | undefined
  ) {
    const notices: string[] = []
    const agent = new AgentHost({
      profile: storeProfile(),
      workspace: process.cwd(),
      emit: (event) => {
        if (event.type === 'notice' && typeof event.message !== 'string')
          notices.push(noticeText({ message: event.message }))
      },
      initialControls: () => wanted,
      ...(knownName ? { controlNotices: { knownName } } : {})
    })
    return { agent, notices }
  }

  it('phrase claire : le modèle voulu par son nom retenu, celui pris à la place, sans identifiant brut', async () => {
    const { agent, notices } = withNotices({ model: 'openai/gpt-6.2-sol' }, (id, value) =>
      id === 'model' && value === 'openai/gpt-6.2-sol' ? 'GPT-6.2 Sol' : undefined
    )
    await agent.start()
    const current = agent.snapshot().controls.find((c) => c.id === 'model')
    const name = current?.options.find((o) => o.value === current.currentValue)?.name ?? ''
    expect(notices).toEqual([
      `Le modèle «\u00a0GPT-6.2 Sol\u00a0» n’est plus proposé par Agent factice\u00a0: cette conversation utilise «\u00a0${name}\u00a0». Changez le modèle par défaut dans Réglages › Agents.`
    ])
    expect(notices[0]).not.toContain('openai/')
    expect(notices[0]).not.toContain('Valeur non proposée')
    agent.stop()
  })

  it('sans nom retenu : la valeur telle quelle, faute de mieux', async () => {
    const { agent, notices } = withNotices({ model: 'inconnu-42' })
    await agent.start()
    expect(notices[0]).toMatch(/^Le modèle «.inconnu-42.» n’est plus proposé par Agent factice/)
    agent.stop()
  })

  it('un seul avis : la valeur dite est signalée à l’hôte, qui ne la renvoie plus (revue QA)', async () => {
    const warned: string[] = []
    const notices: string[] = []
    const agent = new AgentHost({
      profile: storeProfile(),
      workspace: process.cwd(),
      emit: (event) => {
        if (event.type === 'notice' && typeof event.message !== 'string')
          notices.push(noticeText({ message: event.message }))
      },
      initialControls: () => withoutWarned({ model: 'retire' }, new Set(warned.map((w) => w))),
      controlNotices: { warned: (id, value) => warned.push(`${id}=${value}`) }
    })
    await agent.start()
    expect(warned).toEqual(['model=retire'])
    await agent.restart()
    expect(notices).toHaveLength(1)
    agent.stop()
  })
})

describe('réglage appliqué après le délai (revue QA)', () => {
  it('l’avis d’échec est corrigé quand l’agent finit par l’appliquer', async () => {
    let resolve: () => void = () => {}
    const call = new Promise<void>((r) => (resolve = r))
    const raced = Promise.reject(new AgentTimeout('délai'))
    const late: string[] = []
    watchLate(call, raced, () => late.push('tard'))
    await raced.catch(() => {})
    expect(late).toEqual([])
    resolve()
    await call
    await Promise.resolve()
    expect(late).toEqual(['tard'])
  })

  it('autre erreur que le délai : pas de correction', async () => {
    const call = Promise.resolve()
    const raced = Promise.reject(new Error('refusé'))
    const late: string[] = []
    watchLate(call, raced, () => late.push('tard'))
    await raced.catch(() => {})
    await call
    await Promise.resolve()
    expect(late).toEqual([])
  })

  it('le texte de la correction nomme l’agent, le réglage et la valeur', () => {
    const control = {
      id: 'mode',
      name: 'Mode',
      type: 'select' as const,
      currentValue: 'ask',
      options: [{ value: 'ask', name: 'Question' }]
    }
    const event = lateNotice({ label: 'Agent factice' }, control, 'ask')
    expect(
      event.type === 'notice' &&
        typeof event.message !== 'string' &&
        noticeText({ message: event.message })
    ).toBe('Agent factice a finalement appliqué «\u00a0Mode\u00a0»\u00a0: «\u00a0Question\u00a0».')
  })
})
