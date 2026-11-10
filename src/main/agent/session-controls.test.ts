import { describe, expect, it } from 'vitest'
import type { SessionConfigOption, SessionModeState } from '../../shared/acp-sdk.mts'
import {
  buildControls,
  currentModel,
  isValidValue,
  MODE_CONTROL_ID,
  sessionChoices
} from './session-controls'

const modes: SessionModeState = {
  currentModeId: 'code',
  availableModes: [
    { id: 'code', name: 'Code' },
    { id: 'ask', name: 'Question', description: 'Sans modification' }
  ]
}

// Extrait réel (simplifié) de ce que Codex renvoie dans session/new.
const codexOptions: SessionConfigOption[] = [
  {
    id: 'mode',
    name: 'Mode',
    category: 'mode',
    type: 'select',
    currentValue: 'agent',
    options: [
      { value: 'read-only', name: 'Read-only' },
      { value: 'workspace-write', name: 'Workspace access' },
      { value: 'agent', name: 'Auto review' }
    ]
  },
  {
    id: 'model',
    name: 'Model',
    category: 'model',
    type: 'select',
    currentValue: 'b',
    options: [
      { group: 'rapides', name: 'Rapides', options: [{ value: 'a', name: 'A' }] },
      { group: 'precis', name: 'Précis', options: [{ value: 'b', name: 'B' }] }
    ]
  },
  { id: 'verbose', name: 'Verbeux', type: 'boolean', currentValue: false }
]

describe('buildControls', () => {
  it('modes seuls : un contrôle « mode »', () => {
    const [mode] = buildControls(modes, undefined)
    expect(mode).toMatchObject({ id: MODE_CONTROL_ID, type: 'select', currentValue: 'code' })
    expect(mode?.options[1]).toEqual({
      value: 'ask',
      name: 'Question',
      description: 'Sans modification'
    })
  })

  it('cas Codex : l’option de catégorie mode masque les modes, groupes aplatis, booléen', () => {
    const controls = buildControls(modes, codexOptions)
    expect(controls.map((c) => c.id)).toEqual(['mode', 'model', 'verbose'])
    expect(controls[0]?.currentValue).toBe('agent')
    expect(controls[1]?.options).toEqual([
      { value: 'a', name: 'A', description: undefined, group: 'Rapides' },
      { value: 'b', name: 'B', description: undefined, group: 'Précis' }
    ])
    expect(controls[2]).toMatchObject({ type: 'boolean', currentValue: false, options: [] })
  })

  it('rien d’exposé : aucun contrôle', () => {
    expect(buildControls(null, null)).toEqual([])
    expect(buildControls({ currentModeId: 'x', availableModes: [] }, [])).toEqual([])
  })

  it('type d’option inconnu : ignoré', () => {
    const futur = {
      id: 'f',
      name: 'Futur',
      type: 'slider',
      currentValue: 3
    } as unknown as SessionConfigOption
    expect(buildControls(null, [futur])).toEqual([])
  })
})

describe('isValidValue', () => {
  const controls = buildControls(null, codexOptions)
  const byId = (id: string) => {
    const control = controls.find((c) => c.id === id)
    if (!control) throw new Error(`contrôle absent : ${id}`)
    return control
  }
  it('select : seulement une option proposée', () => {
    expect(isValidValue(byId('mode'), 'read-only')).toBe(true)
    expect(isValidValue(byId('mode'), 'full-access-pirate')).toBe(false)
    expect(isValidValue(byId('mode'), true)).toBe(false)
  })
  it('booléen : seulement un booléen', () => {
    expect(isValidValue(byId('verbose'), true)).toBe(true)
    expect(isValidValue(byId('verbose'), 'true')).toBe(false)
  })
})

describe('mode et modèle à l’envoi (fiche 130)', () => {
  it('option choisie des réglages de catégorie mode et model, groupes compris', () => {
    const controls = buildControls(modes, codexOptions)
    expect(sessionChoices(controls)).toEqual({
      mode: { id: 'agent', name: 'Auto review' },
      model: { id: 'b', name: 'B' }
    })
  })

  it('sans réglage de modèle (Bob) : modèle absent, rien d’inventé', () => {
    const controls = buildControls(modes, [])
    expect(currentModel(controls)).toBeUndefined()
    expect(sessionChoices(controls)).toEqual({ mode: { id: 'code', name: 'Code' } })
  })
})
