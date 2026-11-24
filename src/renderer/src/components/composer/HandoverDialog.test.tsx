import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { HandoverTarget } from '@shared/handover'
import { HandoverDialog } from './HandoverDialog'

/**
 * Confirmation « Continuer avec » (fiche 108) : remplace les vérifications de composant de
 * `e2e/suites/handover.mjs` (n° 2, 3). La bascule réelle reste au main et à l'e2e `handover`.
 */

const api = window.api as unknown as Record<string, unknown>
afterEach(() => {
  delete api.conversations
})

const target: HandoverTarget = {
  profileId: 'opencode',
  label: 'OpenCode',
  models: [
    {
      value: 'maison/qwen3',
      name: 'maison/Qwen3 32B',
      featured: 'provider',
      destination: { kind: 'provider', name: 'Maison', url: 'http://127.0.0.1:9/v1' }
    }
  ],
  destination: { kind: 'unknown' }
}

async function setup(model?: string) {
  const continueWith = vi.fn(async () => {})
  api.conversations = {
    view: async () => ({
      transcript: {
        items: [
          { kind: 'user', id: 'u1', text: 'Bonjour' },
          { kind: 'tool', id: 't1' },
          { kind: 'agent', id: 'a1', text: 'Salut' }
        ]
      }
    }),
    continueWith
  }
  const onClose = vi.fn()
  render(
    <HandoverDialog
      conversationId="c1"
      fromLabel="Agent factice"
      choice={{ target, ...(model ? { model } : {}) }}
      onClose={onClose}
    />
  )
  await act(async () => {})
  return { continueWith, onClose }
}

describe('confirmation « Continuer avec » (fiche 108)', () => {
  it('destination : agent, modèle (nom court), fournisseur et adresse', async () => {
    await setup('maison/qwen3')
    const where = screen.getByTestId('handover-where')
    const pairs = [...where.querySelectorAll('dt')].map((dt) => [
      dt.textContent,
      dt.nextElementSibling?.textContent
    ])
    expect(pairs).toEqual([
      ['Agent', 'OpenCode'],
      ['Modèle', 'Qwen3 32B'],
      ['Fournisseur', 'Maison'],
      ['Adresse', 'http://127.0.0.1:9/v1']
    ])
  })

  it('sans modèle choisi : « celui que l’agent choisit », pas de fournisseur inventé', async () => {
    await setup()
    const where = screen.getByTestId('handover-where')
    expect(where.textContent).toContain('celui qu’OpenCode choisit')
    expect(where.textContent).not.toContain('Fournisseur')
  })

  it('ce qui part (les 2 messages de l’échange, pas les outils) et ce qui s’arrête', async () => {
    const { continueWith, onClose } = await setup('maison/qwen3')
    expect(screen.getByTestId('handover-sent').textContent).toContain(
      'L’échange jusqu’ici (2 messages) partira en texte avec votre prochain message, pas avant.'
    )
    expect(screen.getByTestId('handover-dialog').textContent).toContain(
      'Agent factice ne recevra plus rien de cette conversation'
    )
    // Rien ne part avant la confirmation ; elle bascule avec le modèle choisi.
    expect(continueWith).not.toHaveBeenCalled()
    await act(async () => fireEvent.click(screen.getByTestId('handover-confirm')))
    expect(continueWith).toHaveBeenCalledWith('c1', 'opencode', 'maison/qwen3')
    expect(onClose).toHaveBeenCalled()
  })
})
