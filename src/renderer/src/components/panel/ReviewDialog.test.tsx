/**
 * « Faire relire… » (fiches 177, 265) : le rôle Code reviewer ; un autre modèle que celui de la
 * conversation relue proposé d'office quand l'agent en a un (idée D39 de la recette du 19/11),
 * dit et modifiable ; jamais un modèle refusé faute de connexion ; rien sans profil qui le permet.
 */
import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ConversationSummary, ProfileSummary, SessionControl } from '@shared/agent'
import { otherModel, ReviewDialog } from './ReviewDialog'

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

describe('« Faire relire… » : le Code reviewer, un autre modèle (fiche 265)', () => {
  it('otherModel : même fournisseur d’abord, sinon le premier autre ; jamais un modèle refusé', () => {
    expect(otherModel(MODELS)).toBe('precis')
    expect(
      otherModel(
        model([
          { value: 'rapide', name: 'Rapide', group: 'a' },
          { value: 'b1', name: 'B1', group: 'b' }
        ])
      )
    ).toBe('b1')
    expect(
      otherModel(
        model([
          { value: 'rapide', name: 'Rapide' },
          { value: 'ferme', name: 'Fermé', authRequired: true }
        ])
      )
    ).toBeNull()
    expect(otherModel(model([{ value: 'rapide', name: 'Rapide' }]))).toBeNull()
  })

  it('un autre modèle proposé d’office, dit ; il part avec la relecture', async () => {
    open(MODELS)
    await act(async () => {})
    expect((screen.getByTestId('review-model') as HTMLSelectElement).value).toBe('precis')
    expect(plain(screen.getByTestId('review-suggested').textContent)).toContain(
      'Un autre modèle que celui de la conversation relue est proposé'
    )
    expect(plain(screen.getByTestId('review-dialog').textContent)).toContain(
      'Le rôle Code reviewer relit ce travail'
    )
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

  it('profil sans choix du modèle, ou un seul modèle : rien d’autre proposé', async () => {
    open(MODELS, false)
    await act(async () => {})
    expect(screen.queryByTestId('review-model')).toBeNull()
    expect(plain(screen.getByTestId('review-suggested').textContent)).toContain(
      'Agent et modèle de la conversation relue, suggérés'
    )
    await act(async () => void fireEvent.click(screen.getByTestId('review-launch')))
    expect(startReview).toHaveBeenCalledWith('m', {})
  })
})
