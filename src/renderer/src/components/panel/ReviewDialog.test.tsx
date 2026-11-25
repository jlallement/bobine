/**
 * « Faire relire… » (fiches 177, 265) : le rôle Code reviewer ; un autre modèle que celui de la
 * conversation relue proposé d'office quand l'agent en a un (idée D39 de la recette du 19/11),
 * dit et modifiable ; jamais un modèle refusé faute de connexion ; rien sans profil qui le permet.
 */
import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ConversationSummary, ProfileSummary, SessionControl } from '@shared/agent'
import { ReviewDialog } from './ReviewDialog'

const author: ConversationSummary = {
  id: 'm',
  title: 'Carnet',
  profileId: 'mock',
  profileLabel: 'Factice',
  workspace: '/depot',
  updatedAt: '2026-11-20T00:00:00Z',
  status: 'ready',
  draft: false
}

const model = (options: SessionControl['options'], currentValue = 'rapide'): SessionControl => ({
  id: 'model',
  name: 'Modèle',
  category: 'model',
  type: 'select',
  currentValue,
  options
})

const MODELS = model([
  { value: 'rapide', name: 'Rapide', group: 'zen' },
  { value: 'autre', name: 'Autre fournisseur', group: 'ailleurs' },
  { value: 'precis', name: 'Précis', group: 'zen' }
])

const startReview = vi.fn()
const plain = (text: string | null | undefined) => (text ?? '').replace(/[  ]/g, ' ')

function open(control: SessionControl | undefined, childModel = true) {
  window.api.conversations = {
    view: vi.fn().mockResolvedValue({ snapshot: { controls: control ? [control] : [] } }),
    startReview
  } as unknown as Window['api']['conversations']
  const profiles = [
    { id: 'mock', label: 'Factice', available: true, ...(childModel ? { childModel: true } : {}) }
  ] as ProfileSummary[]
  render(<ReviewDialog author={author} profiles={profiles} onClose={vi.fn()} />)
}

beforeEach(() => {
  startReview.mockReset().mockResolvedValue({ id: 'r' })
})

describe('« Faire relire… » : le Code reviewer, le modèle de la conversation (fiche 265)', () => {
  // Recette du 2026-11-25 (20:28) : conversation sur openai/GPT-6.1 Sol ; OpenCode annonce aussi
  // openai/GPT-5.5, que le compte n'a pas, en tête du fournisseur : il était présélectionné. Le
  // modèle de la conversation vient de répondre : c'est lui, présélectionné et envoyé.
  it('le modèle de la conversation présélectionné, jamais un autre annoncé', async () => {
    const sol = 'openai/gpt-6.1-sol'
    open(
      model(
        [
          { value: 'openai/gpt-5.5', name: 'openai/GPT-5.5', group: 'openai' },
          { value: sol, name: 'openai/GPT-6.1 Sol', group: 'openai' },
          { value: 'openai/gpt-6.1-terra', name: 'openai/GPT-6.1 Terra', group: 'openai' }
        ],
        sol
      )
    )
    await act(async () => {})
    expect((screen.getByTestId('review-model') as HTMLSelectElement).value).toBe(sol)
    expect(plain(screen.getByTestId('review-suggested').textContent)).toContain(
      'Agent et modèle de la conversation relue : à confirmer'
    )
    await act(async () => void fireEvent.click(screen.getByTestId('review-launch')))
    expect(startReview).toHaveBeenCalledWith('m', { model: { controlId: 'model', value: sol } })
  })

  it('un autre modèle choisi : dit (un regard neuf) ; il part avec la relecture', async () => {
    open(MODELS)
    await act(async () => {})
    expect((screen.getByTestId('review-model') as HTMLSelectElement).value).toBe('rapide')
    fireEvent.change(screen.getByTestId('review-model'), { target: { value: 'precis' } })
    expect(plain(screen.getByTestId('review-suggested').textContent)).toBe(
      'Autre que celui de la conversation (Rapide) : un regard neuf trouve davantage.'
    )
    expect(plain(screen.getByTestId('review-dialog').textContent)).toContain(
      'Le Code reviewer relit ce travail'
    )
    // Le coût sur sa propre ligne ; pas de changement de coût annoncé (aucun n'est gratuit).
    expect(screen.getByTestId('review-cost')).toBeTruthy()
    expect(screen.queryByTestId('review-cost-change')).toBeNull()
    await act(async () => void fireEvent.click(screen.getByTestId('review-launch')))
    expect(startReview).toHaveBeenCalledWith('m', {
      model: { controlId: 'model', value: 'precis' }
    })
  })

  it('le choix de l’utilisateur l’emporte, même le modèle de la conversation relue', async () => {
    open(MODELS)
    await act(async () => {})
    fireEvent.change(screen.getByTestId('review-model'), { target: { value: 'rapide' } })
    await act(async () => void fireEvent.click(screen.getByTestId('review-launch')))
    expect(startReview).toHaveBeenCalledWith('m', {
      model: { controlId: 'model', value: 'rapide' }
    })
  })

  it('modèle gratuit : un autre gratuit choisi, rien à dire ; un modèle payant choisi est signalé', async () => {
    const free = model(
      [
        { value: 'zen/a-free', name: 'A (free)', group: 'zen' },
        { value: 'zen/payant', name: 'Payant', group: 'zen' },
        { value: 'or/b:free', name: 'B', group: 'or' }
      ],
      'zen/a-free'
    )
    open(free)
    await act(async () => {})
    expect((screen.getByTestId('review-model') as HTMLSelectElement).value).toBe('zen/a-free')
    fireEvent.change(screen.getByTestId('review-model'), { target: { value: 'or/b:free' } })
    expect(screen.queryByTestId('review-cost-change')).toBeNull()
    fireEvent.change(screen.getByTestId('review-model'), { target: { value: 'zen/payant' } })
    expect(screen.getByTestId('review-cost-change').textContent).toContain('pas gratuit')
  })

  it('profil sans choix du modèle, ou un seul modèle : rien d’autre proposé', async () => {
    open(MODELS, false)
    await act(async () => {})
    expect(screen.queryByTestId('review-model')).toBeNull()
    expect(plain(screen.getByTestId('review-suggested').textContent)).toContain(
      'Agent et modèle de la conversation relue : à confirmer'
    )
    await act(async () => void fireEvent.click(screen.getByTestId('review-launch')))
    expect(startReview).toHaveBeenCalledWith('m', {})
  })
})
