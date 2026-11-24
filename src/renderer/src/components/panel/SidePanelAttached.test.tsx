/**
 * Panneau agrandi (fiches 082, 094) : la zone de saisie est cachée, la page jointe depuis le
 * navigateur se signale dans l'en-tête, et un clic revient à la conversation. La page native qui
 * suit le panneau agrandi reste dans l'e2e `browser-view`.
 */
import * as Tooltip from '@radix-ui/react-tooltip'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { t } from 'i18next'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ImageAttachment } from '@shared/attachments'
import { SidePanel } from './SidePanel'

const page: ImageAttachment = { kind: 'image', name: 'Page.png', mimeType: 'image/png', data: 'AA' }

// L'onglet Navigateur sans vue native : son bouton « Joindre » donne la page.
vi.mock('./BrowserTab', () => ({
  BrowserTab: ({ onAttach }: { onAttach?: (image: ImageAttachment) => void }) => (
    <button data-testid="browser-attach" onClick={() => onAttach?.(page)} />
  )
}))
vi.mock('./TerminalTab', () => ({ TerminalTab: () => null, INSERT_TEXT_EVENT: 'x' }))
Element.prototype.scrollTo = () => {}
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
)

afterEach(() => vi.useRealTimers())

function renderPanel(maximized: boolean) {
  const onAttachImage = vi.fn()
  const onShowConversation = vi.fn()
  render(
    <Tooltip.Provider>
      <SidePanel
        conversationId="c1"
        tab="browser"
        tabs={['tasks', 'browser']}
        width={420}
        maxWidth={800}
        maximized={maximized}
        onMaximize={() => {}}
        onCloseTab={() => {}}
        onShowConversation={onShowConversation}
        onAttachImage={onAttachImage}
        items={[]}
        onTab={() => {}}
        onClose={() => {}}
        onResize={() => {}}
        onResetWidth={() => {}}
      />
    </Tooltip.Provider>
  )
  return { onAttachImage, onShowConversation }
}

describe('page jointe, panneau agrandi (fiche 094)', () => {
  it('« Page jointe au message » dans l’en-tête ; un clic revient à la conversation ; puis s’efface', () => {
    vi.useFakeTimers()
    const { onAttachImage, onShowConversation } = renderPanel(true)
    expect(screen.queryByTestId('panel-attached')).toBeNull()
    fireEvent.click(screen.getByTestId('browser-attach'))
    expect(onAttachImage).toHaveBeenCalledWith(page)
    const notice = screen.getByTestId('panel-attached')
    expect(notice.textContent).toContain(t('sidePanel.attached.page'))
    fireEvent.click(notice)
    expect(onShowConversation).toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(3000))
    expect(screen.queryByTestId('panel-attached')).toBeNull()
  })

  it('panneau à sa taille : la saisie est visible, rien dans l’en-tête', () => {
    const { onAttachImage } = renderPanel(false)
    fireEvent.click(screen.getByTestId('browser-attach'))
    expect(onAttachImage).toHaveBeenCalledWith(page)
    expect(screen.queryByTestId('panel-attached')).toBeNull()
  })
})
