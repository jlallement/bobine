import { describe, expect, it } from 'vitest'
import type { AgentBlocker } from '@shared/agent'
import { refusedTurnText } from './turn-auth-text'

describe('textes d’un message refusé faute de connexion (fiche 210)', () => {
  const atTurn: AgentBlocker = { kind: 'auth', methods: [], authenticating: false, atTurn: true }

  it('modèle nommé : « Modèle refusé », et une invite qui propose un autre modèle', () => {
    const blocker: AgentBlocker = { ...atTurn, model: { id: 'openai/gpt-5.2', name: 'GPT-5.2' } }
    expect(refusedTurnText(blocker, 'status')).toBe('Modèle refusé')
    expect(refusedTurnText(blocker, 'placeholder')).toBe(
      'Choisissez un autre modèle ou connectez-vous'
    )
  })

  it('sans modèle (Bob) : « Connexion expirée », comme avant', () => {
    expect(refusedTurnText(atTurn, 'status')).toBe('Connexion expirée')
    expect(refusedTurnText(atTurn, 'placeholder')).toBe('Reconnectez-vous pour continuer')
  })

  it('carte d’ouverture de session, ou pas de carte : rien', () => {
    const atOpening: AgentBlocker = { kind: 'auth', methods: [], authenticating: false }
    expect(refusedTurnText(atOpening, 'status')).toBeUndefined()
    expect(refusedTurnText(undefined, 'placeholder')).toBeUndefined()
  })
})
