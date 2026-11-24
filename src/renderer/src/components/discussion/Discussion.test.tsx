import { act, fireEvent, render, screen } from '@testing-library/react'
import * as Tooltip from '@radix-ui/react-tooltip'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ConversationSummary } from '@shared/agent'
import { spaceOf } from '../../useSpace'
import { ContinueInProjectDialog } from './ContinueInProjectDialog'
import { DocumentCards, ThreadConversationContext } from './DocumentCards'
import { SpaceSwitcher } from './SpaceSwitcher'

/**
 * Espace Discussion (fiche 224) : remplace les vérifications de composant de
 * `e2e/suites/discussion.mjs` (n° 1, 5, 15). Les documents posés dans le fil et copiés dans le
 * projet restent au main (`documents/ipc.test.ts`) ; le choix du dossier (dialogue du système), à
 * l'e2e.
 */

const api = window.api as unknown as Record<string, unknown>
afterEach(() => {
  delete api.documents
})

describe('espace Discussion (fiche 224)', () => {
  it('lancement : l’espace Code sélectionné, Discussion à un clic (discussion n° 1)', () => {
    // Sans conversation (premier lancement), l'espace est Code.
    expect(spaceOf(undefined)).toBe('code')
    const onChoose = vi.fn()
    render(<SpaceSwitcher space={spaceOf(undefined)} onChoose={onChoose} />)
    expect(screen.getByTestId('space-code').getAttribute('aria-selected')).toBe('true')
    expect(screen.getByTestId('space-discussion').getAttribute('aria-selected')).toBe('false')
    fireEvent.click(screen.getByTestId('space-discussion'))
    expect(onChoose).toHaveBeenCalledWith('discussion')
  })

  it('document créé pendant le tour : sa carte, nom et genre, « Ouvrir » avec son app (discussion n° 5)', () => {
    const open = vi.fn(async () => {})
    api.documents = { open, saveCopy: vi.fn(async () => {}), reveal: vi.fn(async () => {}) }
    render(
      <Tooltip.Provider>
        <ThreadConversationContext.Provider value="d1">
          <DocumentCards names={['Synthèse.md']} />
        </ThreadConversationContext.Provider>
      </Tooltip.Provider>
    )
    const card = screen.getByTestId('document-card')
    expect(card.querySelector('.document-name')?.textContent).toBe('Synthèse.md')
    expect(card.querySelector('.document-meta')?.textContent).toBe('MD')
    fireEvent.click(screen.getByText('Ouvrir'))
    expect(open).toHaveBeenCalledWith('d1', 'Synthèse.md')
  })

  it('« Continuer dans un projet » : documents copiés par défaut (case cochée) (discussion n° 15)', async () => {
    const continueInProject = vi.fn(async () => ({ summary: { id: 'c-neuve' } }))
    api.documents = {
      list: vi.fn(async () => [{ name: 'Synthèse.md' }, { name: 'Tableau.csv' }]),
      continueInProject
    }
    const onOpened = vi.fn()
    render(
      <ContinueInProjectDialog
        discussion={{ id: 'd1', title: 'E-mail' } as ConversationSummary}
        onClose={vi.fn()}
        onOpened={onOpened}
      />
    )
    await act(async () => {})
    const copy = screen.getByTestId('continue-copy') as HTMLInputElement
    expect(copy.checked).toBe(true)
    await act(async () => fireEvent.click(screen.getByTestId('continue-choose')))
    expect(continueInProject).toHaveBeenCalledWith('d1', { copyDocuments: true })
    expect(onOpened).toHaveBeenCalledWith('c-neuve')
  })
})
