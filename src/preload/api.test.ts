import { describe, expect, it, vi } from 'vitest'
import type { ConversationEvent } from '@shared/agent'
import { createApi, helpViewApi, type Invoke, type Subscribe } from './api'

function setup() {
  const invoke = vi.fn(async () => undefined) as unknown as Invoke & ReturnType<typeof vi.fn>
  const listeners = new Map<string, (payload: unknown) => void>()
  const unsubscribe = vi.fn()
  const subscribe = ((channel: string, listener: (payload: unknown) => void) => {
    listeners.set(channel, listener)
    return unsubscribe
  }) as Subscribe
  return { api: createApi(invoke, subscribe), invoke, listeners, unsubscribe }
}

describe('conversations en cours de suppression (chasse rc.4)', () => {
  it('aucun appel vers elles ne part au main, sauf la suppression ; libérées, de nouveau', async () => {
    const { api, invoke } = setup()
    api.conversations.removing(['m', 'f'], true)
    await expect(api.children.mergePlan('m')).rejects.toThrow('m')
    await expect(api.conversations.appTools('f')).rejects.toThrow('f')
    await expect(api.git.status('m')).rejects.toThrow()
    await api.conversations.delete('m', { children: 'delete' })
    await api.conversations.appTools('o')
    expect(invoke.mock.calls).toEqual([
      ['conversation:delete', 'm', { children: 'delete' }],
      ['conversation:appTools', 'o']
    ])
    api.conversations.removing(['m', 'f'], false)
    await api.conversations.appTools('m')
    expect(invoke.mock.calls.at(-1)).toEqual(['conversation:appTools', 'm'])
  })

  it('compté : deux suppressions de la même conversation se libèrent chacune', async () => {
    const { api, invoke } = setup()
    api.conversations.removing(['m'], true)
    api.conversations.removing(['m'], true)
    api.conversations.removing(['m'], false)
    await expect(api.conversations.rules('m')).rejects.toThrow()
    api.conversations.removing(['m'], false)
    await api.conversations.rules('m')
    expect(invoke.mock.calls).toEqual([['conversation:rules', 'm']])
  })
})

describe('createApi', () => {
  it('chaque méthode passe par le bon canal avec ses arguments', async () => {
    const { api, invoke } = setup()
    await api.app.getInfo()
    await api.conversations.get()
    await api.conversations.childLaunches()
    await api.conversations.select('c1')
    await api.conversations.create()
    await api.conversations.rename('c1', 'Titre')
    await api.conversations.delete('c1')
    await api.agent.prompt('c1', 'Bonjour')
    await api.agent.cancel('c1')
    await api.agent.respondPermission('c1', 'p1', 'allow')
    await api.agent.setControl('c1', 'mode', 'read-only')
    await api.agent.configure('c1', { profileId: 'codex' })
    await api.settings.get()
    await api.workspace.choose()
    await api.workspace.searchFiles('c1', 'app')
    await api.workspace.pickFiles('c1')
    expect(invoke.mock.calls).toEqual([
      ['app:getInfo'],
      ['conversations:get'],
      ['conversation:childLaunches'],
      ['conversation:select', 'c1'],
      ['conversation:create', {}],
      ['conversation:rename', 'c1', 'Titre'],
      ['conversation:delete', 'c1'],
      ['agent:prompt', 'c1', 'Bonjour', undefined, undefined],
      ['agent:cancel', 'c1'],
      ['agent:respondPermission', 'c1', 'p1', 'allow'],
      ['agent:setControl', 'c1', 'mode', 'read-only'],
      ['agent:configure', 'c1', { profileId: 'codex' }],
      ['settings:get'],
      ['workspace:choose'],
      ['workspace:searchFiles', 'c1', 'app'],
      ['workspace:pickFiles', 'c1']
    ])
  })

  it('onEvent / onChanged relaient les événements et renvoient le désabonnement', () => {
    const { api, listeners, unsubscribe } = setup()
    const received: ConversationEvent[] = []
    const off = api.agent.onEvent((e) => received.push(e))
    const payload: ConversationEvent = { conversationId: 'c1', event: { type: 'reset' } }
    listeners.get('agent:event')?.(payload)
    expect(received).toEqual([payload])
    off()
    expect(unsubscribe).toHaveBeenCalledOnce()
    const lists: unknown[] = []
    api.conversations.onChanged((s) => lists.push(s))
    listeners.get('conversations:changed')?.({ conversations: [], activeId: 'c1' })
    expect(lists).toHaveLength(1)
  })

  it('langue de l’interface : celle passée par le main, le français sinon (fiche 074)', () => {
    const { invoke } = setup()
    const subscribe = (() => () => {}) as Subscribe
    expect(createApi(invoke, subscribe).app.language).toBe('fr')
    expect(createApi(invoke, subscribe, () => '', 'en').app.language).toBe('en')
  })

  it('dossier personnel : celui passé par le main, vide sinon (fiche 214)', () => {
    const { invoke } = setup()
    const subscribe = (() => () => {}) as Subscribe
    expect(createApi(invoke, subscribe).app.home).toBe('')
    expect(createApi(invoke, subscribe, () => '', 'fr', undefined, '/Users/ada').app.home).toBe(
      '/Users/ada'
    )
  })

  it('préparation des filles : relaie la révision et permet de se désabonner', () => {
    const { api, listeners, unsubscribe } = setup()
    const receive = vi.fn()
    const off = api.conversations.onChildLaunches(receive)
    const payload = {
      revision: 3,
      entries: [{ id: 'launch', motherId: 'mother', title: 'Import', conversationId: 'child' }]
    }
    listeners.get('conversation:childLaunchesChanged')?.(payload)
    expect(receive).toHaveBeenCalledExactlyOnceWith(payload)
    off()
    expect(unsubscribe).toHaveBeenCalledOnce()
  })
})

describe('API de la fenêtre d’aide (fiche 186)', () => {
  it('seulement langue, apparence, erreurs, aide et réglages en lecture', () => {
    const { api } = setup()
    const view = helpViewApi(api)
    expect(Object.keys(view).sort()).toEqual(['app', 'help', 'settings'])
    expect(Object.keys(view.settings).sort()).toEqual(['get', 'onChanged'])
    expect(Object.keys(view.help).sort()).toEqual([
      'onFocusSearch',
      'onNavigate',
      'showChangelog',
      'target'
    ])
    expect(Object.keys(view.app)).not.toContain('relaunch')
    expect(view).not.toHaveProperty('agent')
    expect(view).not.toHaveProperty('files')
  })
})
