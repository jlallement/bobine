import { describe, expect, it, vi } from 'vitest'
import type { AgentSnapshot, ConversationSummary, SessionControl } from '@shared/agent'
import { AGENT_PROMPTS } from '@shared/app-commands'
import {
  appCommandActions,
  applyAppCommand,
  stepConversation,
  type AppCommandContext
} from './app-commands'

const model: SessionControl = {
  id: 'model',
  name: 'Modèle',
  category: 'model',
  type: 'select',
  currentValue: 'fast',
  options: [
    { value: 'fast', name: 'Rapide' },
    { value: 'deep', name: 'Réfléchi' }
  ]
}

const noop = { info: vi.fn(), send: vi.fn(), create: vi.fn(), setControl: vi.fn() }

function snapshot(change: Partial<AgentSnapshot> = {}): AgentSnapshot {
  return {
    status: 'ready',
    info: { profileId: 'p', profileLabel: 'Profil', agentName: 'Agent X', workspace: '/w' },
    controls: [model],
    commands: [],
    promptCapabilities: {},
    queued: [],
    ...change
  } as AgentSnapshot
}

const summary = { id: 'c1', profileId: 'p', workspace: '/w', draft: false } as ConversationSummary

const context = (change: Partial<AppCommandContext> = {}): AppCommandContext => ({
  summary,
  snapshot: snapshot(),
  usage: undefined,
  ...change
})

describe('commandes « / » de l’app (fiche 039)', () => {
  it('/clear ouvre une conversation avec le même agent et le même dossier', () => {
    expect(appCommandActions('clear', '', context())).toEqual([
      { type: 'create', request: { profileId: 'p', workspace: '/w' } }
    ])
    expect(appCommandActions('clear', '', context({ summary: null }))).toEqual([
      { type: 'create', request: {} }
    ])
  })

  it('/compact envoie la commande de l’agent, ou dit qu’il ne sait pas', () => {
    expect(
      appCommandActions('compact', '', context({ snapshot: snapshot({ compactCommand: '/c' }) }))
    ).toEqual([{ type: 'send', text: '/c' }])
    expect(appCommandActions('compact', '', context())).toEqual([
      { type: 'info', message: 'Agent X ne sait pas compacter sa conversation.' }
    ])
  })

  it('nom de l’agent : annoncé, sinon celui du profil, sinon « L’agent »', () => {
    const noName = snapshot({ info: { profileId: 'p', profileLabel: 'Profil', workspace: '/w' } })
    expect(appCommandActions('compact', '', context({ snapshot: noName }))).toEqual([
      { type: 'info', message: 'Profil ne sait pas compacter sa conversation.' }
    ])
    expect(appCommandActions('compact', '', context({ snapshot: null }))).toEqual([
      { type: 'info', message: 'L’agent ne sait pas compacter sa conversation.' }
    ])
  })

  it('/context et /cost : chacun son encadré titré, sans rien envoyer (fiche 126)', () => {
    const titles = (['context', 'cost'] as const).map((name) => {
      const [action] = appCommandActions(name, '', context())
      expect(action?.type).toBe('info')
      return action?.type === 'info' ? action.title : undefined
    })
    expect(titles).toEqual(['Contexte de la conversation', 'Coût de la conversation'])
    const [bob] = appCommandActions(
      'context',
      '',
      context({
        snapshot: snapshot({ compactCommand: '/compress' }),
        usage: { cost: { amount: 2, currency: 'bobcoins' } }
      })
    )
    expect(bob?.type === 'info' && bob.message).toContain('Agent X ne transmet pas')
  })

  it('/model sans argument : la liste des choix, le choix courant marqué', () => {
    expect(appCommandActions('model', '', context())).toEqual([
      { type: 'info', message: 'Modèle\u00a0:\n• Rapide\n◦ Réfléchi' }
    ])
  })

  it('/model nom : règle l’option puis le dit', () => {
    expect(appCommandActions('model', 'réfl', context())).toEqual([
      { type: 'setControl', controlId: 'model', value: 'deep' },
      { type: 'info', message: 'Modèle\u00a0: Réfléchi' }
    ])
  })

  it('/model sans correspondance unique, /mode sans contrôle de mode', () => {
    expect(appCommandActions('model', 'zzz', context())).toEqual([
      { type: 'info', message: 'Aucun modèle unique ne correspond à «\u00a0zzz\u00a0».' }
    ])
    expect(appCommandActions('mode', 'plan', context())).toEqual([
      { type: 'info', message: 'Agent X ne propose pas de choix de mode.' }
    ])
  })

  it('/init et /review envoient leur consigne à l’agent', () => {
    expect(appCommandActions('init', '', context())).toEqual([
      { type: 'send', text: AGENT_PROMPTS.init }
    ])
    expect(appCommandActions('review', '', context())).toEqual([
      { type: 'send', text: AGENT_PROMPTS.review }
    ])
  })

  it('/btw ouvre un aparté avec la question tapée, ou vide (fiche 180)', () => {
    expect(appCommandActions('btw', 'C’est quoi ce flag ?', context())).toEqual([
      { type: 'aside', question: 'C’est quoi ce flag ?' }
    ])
    expect(appCommandActions('btw', '', context())).toEqual([{ type: 'aside', question: '' }])
    const target = {
      info: vi.fn(),
      send: vi.fn(),
      create: vi.fn(),
      setControl: vi.fn(),
      aside: vi.fn()
    }
    applyAppCommand([{ type: 'aside', question: 'Q' }], target)
    expect(target.aside).toHaveBeenCalledWith('Q')
    expect(target.send).not.toHaveBeenCalled()
  })

  it('/split envoie le message avec la demande de découpage ; seul, il explique (fiche 118)', () => {
    expect(appCommandActions('split', 'Trois chantiers', context())).toEqual([
      { type: 'send', text: 'Trois chantiers', askChildren: true }
    ])
    const [alone] = appCommandActions('split', '', context())
    expect(alone?.type === 'info' && alone.message).toContain('/split')
    const send = vi.fn()
    applyAppCommand([{ type: 'send', text: 'x', askChildren: true }], { ...noop, send })
    applyAppCommand([{ type: 'send', text: 'y' }], { ...noop, send })
    expect(send.mock.calls).toEqual([
      ['x', [], { askChildren: true }],
      ['y', [], {}]
    ])
  })

  it('/help liste les commandes de l’agent puis celles de l’app', () => {
    const withCommand = snapshot({ commands: [{ name: 'go', description: 'Va', hint: '[où]' }] })
    const [action] = appCommandActions('help', '', context({ snapshot: withCommand }))
    expect(action?.type === 'info' && action.message.split('\n').slice(0, 2)).toEqual([
      '/go [où] — Va',
      '/clear — Nouvelle conversation, même agent et même dossier'
    ])
  })

  it('les actions sont faites dans l’ordre', () => {
    const calls: string[] = []
    const target = {
      info: vi.fn((m: string) => calls.push(`info ${m}`)),
      send: vi.fn((t: string) => calls.push(`send ${t}`)),
      create: vi.fn(() => calls.push('create')),
      setControl: vi.fn((id: string, v: unknown) => calls.push(`set ${id} ${String(v)}`))
    }
    applyAppCommand(
      [
        { type: 'setControl', controlId: 'model', value: 'deep' },
        { type: 'info', message: 'ok' },
        { type: 'send', text: 'hi' },
        { type: 'create', request: {} }
      ],
      target
    )
    expect(calls).toEqual(['set model deep', 'info ok', 'send hi', 'create'])
  })
})

describe('conversation précédente / suivante du menu (fiche 027)', () => {
  const conv = (id: string, draft = false) => ({ id, draft }) as ConversationSummary
  const list = [conv('a'), conv('draft', true), conv('b'), conv('c')]

  it('passe à la voisine dans l’historique, en boucle, sans les brouillons', () => {
    expect(stepConversation(list, 'a', 1)).toBe('b')
    expect(stepConversation(list, 'c', 1)).toBe('a')
    expect(stepConversation(list, 'a', -1)).toBe('c')
    expect(stepConversation(list, 'b', -1)).toBe('a')
  })

  it('depuis un brouillon ou sans conversation : la première de l’historique', () => {
    expect(stepConversation(list, 'draft', 1)).toBe('a')
    expect(stepConversation(list, null, -1)).toBe('a')
  })

  it('historique vide : rien', () => {
    expect(stepConversation([conv('draft', true)], 'draft', 1)).toBeUndefined()
  })
})
