import { describe, expect, it } from 'vitest'
import { MENU_MAX_HEIGHT, placeMenu } from './menu-placement'

const limits = { top: 52, bottom: 820 }

describe('placeMenu', () => {
  it('opens above the composer when the whole menu fits there (conversation view)', () => {
    expect(placeMenu({ top: 700, bottom: 802 }, limits)).toEqual({
      side: 'above',
      maxHeight: MENU_MAX_HEIGHT
    })
  })

  it('opens below on the welcome screen when there is more room under the composer', () => {
    // Zone de saisie centrée : 335 px au-dessus (en-tête compris), 420 px en dessous.
    expect(placeMenu({ top: 335, bottom: 400 }, limits)).toEqual({ side: 'below', maxHeight: 380 })
  })

  it('caps the height to the room above when above is the larger side but too small', () => {
    expect(placeMenu({ top: 300, bottom: 700 }, limits)).toEqual({ side: 'above', maxHeight: 232 })
  })

  it('caps the height to the room below when it opens below', () => {
    expect(placeMenu({ top: 250, bottom: 450 }, { top: 52, bottom: 600 })).toEqual({
      side: 'above',
      maxHeight: 182
    })
    expect(placeMenu({ top: 200, bottom: 300 }, { top: 52, bottom: 600 })).toEqual({
      side: 'below',
      maxHeight: 284
    })
  })

  it('never goes under a usable minimum, even in a tiny window', () => {
    expect(placeMenu({ top: 120, bottom: 200 }, { top: 52, bottom: 260 }).maxHeight).toBe(120)
  })
})
