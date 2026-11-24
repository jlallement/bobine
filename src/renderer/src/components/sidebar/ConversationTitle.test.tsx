import * as Tooltip from '@radix-ui/react-tooltip'
import { act, fireEvent, render, screen } from '@testing-library/react'
import i18next from 'i18next'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { ConversationSummary } from '@shared/agent'
import { ConversationTitle, TitleOrigin } from './ConversationTitle'

/**
 * Titre de la conversation dans l'en-tête (fiches 049, 117, 131) : remplace les vérifications de
 * composant de `e2e/suites/git.mjs` (n° 4, 5), `filles.mjs` (n° 14) et `branch.mjs` (n° 8). Le
 * renommage enregistré (et repris par la barre latérale) reste au main (`manager.test.ts`).
 */

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
})

const conversation = {
  id: 'c1',
  title: 'Corriger le parseur',
  pinned: false,
  archived: false
} as unknown as ConversationSummary

async function setup() {
  const actions = {
    onRename: vi.fn(),
    onPin: vi.fn(),
    onExport: vi.fn(),
    onArchive: vi.fn(),
    onDelete: vi.fn()
  }
  render(
    <Tooltip.Provider>
      <ConversationTitle conversation={conversation} {...actions} />
    </Tooltip.Provider>
  )
  await act(async () => {})
  const open = () => fireEvent.keyDown(screen.getByTestId('title-menu'), { key: 'Enter' })
  return { ...actions, open }
}

describe('menu du titre (fiche 049)', () => {
  it('« Renommer » édite le titre en place ; Entrée enregistre le nouveau titre (git n° 4)', async () => {
    const t = await setup()
    t.open()
    fireEvent.click(screen.getByTestId('title-rename'))
    const input = screen.getByTestId('title-input') as HTMLInputElement
    expect(input.value).toBe('Corriger le parseur')
    expect(document.activeElement).toBe(input)
    fireEvent.change(input, { target: { value: '  Parseur réparé ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(t.onRename).toHaveBeenCalledWith('Parseur réparé')
    expect(screen.queryByTestId('title-input')).toBeNull()
  })

  it('Échap annule le renommage ; un titre inchangé n’est pas renvoyé', async () => {
    const t = await setup()
    t.open()
    fireEvent.click(screen.getByTestId('title-rename'))
    fireEvent.change(screen.getByTestId('title-input'), { target: { value: 'Autre' } })
    fireEvent.keyDown(screen.getByTestId('title-input'), { key: 'Escape' })
    t.open()
    fireEvent.click(screen.getByTestId('title-rename'))
    fireEvent.keyDown(screen.getByTestId('title-input'), { key: 'Enter' })
    expect(t.onRename).not.toHaveBeenCalled()
  })

  it('« Supprimer » demande la confirmation, la page reste cliquable (menu non modal) (git n° 5)', async () => {
    const t = await setup()
    t.open()
    fireEvent.click(screen.getByTestId('title-delete'))
    expect(t.onDelete).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).toBeNull()
    expect(document.body.style.pointerEvents).not.toBe('none')
  })
})

describe('origine dans l’en-tête (fiches 117, 131)', () => {
  it('fille : « ↳ depuis « mère » », qui ramène à la mère (filles n° 14)', () => {
    const onSelect = vi.fn()
    render(
      <TitleOrigin
        conversation={{ startedFrom: { id: 'm', title: 'Mère' } } as ConversationSummary}
        list={[{ id: 'm', title: 'Mère' }]}
        onSelect={onSelect}
      />
    )
    const origin = screen.getByTestId('title-origin')
    expect(origin.textContent).toBe(i18next.t('conversationTitle.from', { title: 'Mère' }))
    fireEvent.click(origin)
    expect(onSelect).toHaveBeenCalledWith('m')
  })

  it('branche : « ↳ branche de « … » » avec le titre actuel de l’origine (branch n° 8)', () => {
    const onSelect = vi.fn()
    render(
      <TitleOrigin
        conversation={
          { branchedFrom: { id: 'o', title: 'Ancien titre' } } as unknown as ConversationSummary
        }
        list={[{ id: 'o', title: 'Titre actuel' }]}
        onSelect={onSelect}
      />
    )
    const origin = screen.getByTestId('title-branch-origin')
    expect(origin.textContent).toBe(
      i18next.t('conversationTitle.branchFrom', { title: 'Titre actuel' })
    )
    fireEvent.click(origin)
    expect(onSelect).toHaveBeenCalledWith('o')
  })

  it('branche dont l’origine n’existe plus : le titre retenu, sans lien', () => {
    render(
      <TitleOrigin
        conversation={
          { branchedFrom: { id: 'o', title: 'Ancien titre' } } as unknown as ConversationSummary
        }
        list={[]}
        onSelect={vi.fn()}
      />
    )
    const origin = screen.getByTestId('title-branch-origin')
    expect(origin.tagName).toBe('SPAN')
    expect(origin.textContent).toBe(
      i18next.t('conversationTitle.branchFrom', { title: 'Ancien titre' })
    )
  })
})
