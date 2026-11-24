/**
 * Images renvoyées par un outil de l'app (fiches 047, 075) : la planche contact du navigateur est
 * visible dans la carte, sans la déplier. Le vrai film d'une animation de Chromium et le suivi du
 * défilement quand l'image se charge restent dans l'e2e `browser`.
 */
import * as Tooltip from '@radix-ui/react-tooltip'
import { render, screen } from '@testing-library/react'
import { t } from 'i18next'
import { describe, expect, it, vi } from 'vitest'
import type { TranscriptItem } from '@shared/transcript'
import { ToolCall } from './ToolCall'

type ToolItem = Extract<TranscriptItem, { kind: 'tool' }>

const sheet = { mimeType: 'image/jpeg', data: 'L1BMQU5DSEU=' }
const filmstrip: ToolItem = {
  kind: 'tool',
  id: 1,
  toolCallId: 'film',
  title: 'browser_filmstrip',
  toolKind: 'other',
  status: 'completed',
  content: [
    { type: 'content', content: { type: 'text', text: 'Contact sheet: 4 frames, numbered.' } }
  ],
  locations: [],
  appTool: { label: t('appTools.browser_filmstrip.default'), group: 'browser' },
  images: [sheet]
}

function renderCard(item: ToolItem, hideImages?: boolean) {
  return render(
    <Tooltip.Provider>
      <ToolCall item={item} onRespond={vi.fn()} {...(hideImages ? { hideImages } : {})} />
    </Tooltip.Provider>
  )
}

describe('planche contact dans la carte de l’outil (fiche 075)', () => {
  it('l’image de la planche est sous la carte, sans rien déplier, agrandissable', () => {
    const { container } = renderCard(filmstrip)
    expect(screen.getByText(t('appTools.browser_filmstrip.default'))).toBeTruthy()
    const images = screen.getByTestId('tool-images')
    // Pas dans les détails repliés de la carte.
    expect(images.closest('details')).toBeNull()
    const img = images.querySelector('img') as HTMLImageElement
    expect(img.getAttribute('src')).toBe(`data:image/jpeg;base64,${sheet.data}`)
    expect(img.getAttribute('alt')).toBe(t('toolCall.image.alt'))
    expect(screen.getByTestId('image-zoom-open')).toBeTruthy()
    expect(container.querySelectorAll('.tool-image')).toHaveLength(1)
  })

  it('dans un groupe d’outils : la carte laisse l’image au groupe ; sans image : rien', () => {
    renderCard(filmstrip, true)
    expect(screen.queryByTestId('tool-images')).toBeNull()
    const { images: _none, ...withoutImages } = filmstrip
    renderCard(withoutImages)
    expect(screen.queryByTestId('tool-images')).toBeNull()
  })
})
