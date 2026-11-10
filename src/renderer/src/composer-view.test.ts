import { describe, expect, it } from 'vitest'
import type { AgentSettingsView, AgentSnapshot } from '@shared/agent'
import { composerView } from './composer-view'

const snapshot = (change: Partial<AgentSnapshot> = {}): AgentSnapshot => ({
  status: 'ready',
  info: { profileId: 'bob', profileLabel: 'IBM Bob', workspace: '/projet' },
  controls: [
    {
      id: 'mode',
      name: 'Mode',
      category: 'mode',
      type: 'select',
      currentValue: 'code',
      options: [{ value: 'code', name: 'Code' }]
    }
  ],
  commands: [],
  promptCapabilities: { image: true, embeddedContext: true },
  queued: [],
  ...change
})

describe('état de la zone de saisie (fiche 089)', () => {
  it('sans agent : rien à envoyer, noms par défaut', () => {
    const view = composerView(null, null)
    expect(view).toMatchObject({ status: 'idle', busy: false, canSendNow: false, locked: false })
    expect(view.agentName).toBe('L’agent')
    expect(view.agentLabel).toBe('Agent')
    expect(view.installedAgents).toEqual(['Agent'])
  })

  it('agent prêt, en réponse, arrêté : le message peut partir ; pendant une réponse, verrouillé', () => {
    expect(composerView(snapshot(), null)).toMatchObject({ canSendNow: true, locked: false })
    expect(composerView(snapshot({ status: 'busy' }), null)).toMatchObject({
      busy: true,
      canSendNow: true,
      locked: true
    })
    expect(composerView(snapshot({ status: 'exited' }), null).canSendNow).toBe(true)
    expect(composerView(snapshot({ status: 'starting' }), null)).toMatchObject({
      canSendNow: false,
      locked: true
    })
  })

  it('noms de l’agent, mode, agents installés pour les badges du menu « / »', () => {
    const settings = {
      profiles: [
        { label: 'IBM Bob', available: true },
        { label: 'OpenCode', available: false }
      ]
    } as unknown as AgentSettingsView
    const view = composerView(
      snapshot({
        info: { profileId: 'bob', profileLabel: 'IBM Bob', agentName: 'Bob', workspace: '/p' }
      }),
      settings
    )
    expect(view).toMatchObject({ agentName: 'Bob', agentLabel: 'Bob', profileLabel: 'IBM Bob' })
    expect(view.installedAgents).toEqual(['IBM Bob'])
    expect(view.modeControl?.id).toBe('mode')
    expect(view.modelControl).toBeUndefined()
  })

  it('modèle : le réglage « liste » de catégorie `model` (fiche 090)', () => {
    const model = {
      id: 'model',
      name: 'Model',
      category: 'model',
      type: 'select' as const,
      currentValue: 'openai/gpt-6.1-sol',
      options: [{ value: 'openai/gpt-6.1-sol', name: 'openai/GPT-6.1 Sol' }]
    }
    const view = composerView(snapshot({ controls: [...snapshot().controls, model] }), null)
    expect(view.modelControl).toBe(model)
  })

  it('mode plan (fiche 098) : reconnu par `isPlanMode`, avec le mode où mène Maj+Tab', () => {
    const mode = (currentValue: string, options: { value: string; name: string }[]) =>
      snapshot({
        controls: [
          { id: 'mode', name: 'Mode', category: 'mode', type: 'select', currentValue, options }
        ]
      })
    // Bob : agent, plan, ask — Maj+Tab mène à « Ask ».
    const bob = [
      { value: 'agent', name: 'Agent' },
      { value: 'plan', name: 'Plan' },
      { value: 'ask', name: 'Ask' }
    ]
    expect(composerView(mode('plan', bob), null)).toMatchObject({
      planMode: true,
      nextModeName: 'Ask'
    })
    expect(composerView(mode('agent', bob), null)).toMatchObject({
      planMode: false,
      nextModeName: undefined
    })
    // OpenCode : build, plan — retour à « build » au bout de la liste.
    const opencode = [
      { value: 'build', name: 'build' },
      { value: 'plan', name: 'plan' }
    ]
    expect(composerView(mode('plan', opencode), null).nextModeName).toBe('build')
    // Reconnu par le nom aussi ; un seul mode : pas de mode où aller.
    expect(composerView(mode('p', [{ value: 'p', name: 'Plan' }]), null)).toMatchObject({
      planMode: true,
      nextModeName: undefined
    })
    expect(composerView(null, null).planMode).toBe(false)
  })

  it('action requise : le panneau de l’agent, seulement dans cet état', () => {
    const blocker = { kind: 'trust', message: 'Dossier non approuvé' } as AgentSnapshot['blocker']
    expect(composerView(snapshot({ status: 'needs-action', blocker }), null).blocker).toBe(blocker)
    expect(composerView(snapshot({ blocker }), null).blocker).toBeUndefined()
  })
})
