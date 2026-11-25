/**
 * Infobulle d'un élément focalisé au clavier (fiche 285) : le défilement qui amène l'élément en vue
 * juste après son focus ne la referme pas ; plus tard, un défilement la ferme comme avant.
 */
import * as Tooltip from '@radix-ui/react-tooltip'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Tip } from './Menus'

afterEach(() => vi.useRealTimers())

function show() {
  render(
    <Tooltip.Provider>
      <Tip label="Alpha">
        <abbr tabIndex={0} data-testid="letter">
          Participant A
        </abbr>
      </Tip>
    </Tooltip.Provider>
  )
  return screen.getByTestId('letter')
}

describe('infobulle au focus', () => {
  it('le défilement dû au focus ne la ferme pas, un défilement plus tard si', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const letter = show()
    act(() => letter.focus())
    expect(letter.getAttribute('data-state')).not.toBe('closed')
    fireEvent.scroll(document)
    expect(letter.getAttribute('data-state')).not.toBe('closed')
    vi.setSystemTime(Date.now() + 1000)
    fireEvent.scroll(document)
    expect(letter.getAttribute('data-state')).toBe('closed')
  })
  it('le pointeur qui s’en va la ferme, même juste après le focus', () => {
    const letter = show()
    act(() => letter.focus())
    expect(letter.getAttribute('data-state')).not.toBe('closed')
    fireEvent.pointerLeave(letter)
    expect(letter.getAttribute('data-state')).toBe('closed')
  })
})
