import { describe, expect, it } from 'vitest'
import { MAX_DRAGGED_IMAGE, draggedFileName, parseDraggedImage } from './images'

describe('draggedFileName (fiche 156)', () => {
  const hash = 'abcdef0123456789'
  it('nom de la pièce jointe, sans chemin ni caractère gênant, extension du type', () => {
    expect(
      draggedFileName({ mimeType: 'image/png', data: '', name: 'Capture d’écran.png' }, hash)
    ).toBe('Capture décran.png')
    expect(
      draggedFileName({ mimeType: 'image/jpeg', data: '', name: '../../x/photo.heic' }, hash)
    ).toBe('photo.jpg')
  })
  it('sans nom utile : image-<empreinte>', () => {
    expect(draggedFileName({ mimeType: 'image/webp', data: '' }, hash)).toBe('image-abcdef01.webp')
    expect(draggedFileName({ mimeType: 'image/png', data: '', name: 'image' }, hash)).toBe(
      'image-abcdef01.png'
    )
    expect(draggedFileName({ mimeType: 'image/png', data: '', name: '.env' }, hash)).toBe(
      'image-abcdef01.png'
    )
  })
})

describe('parseDraggedImage', () => {
  it('refuse un autre type, des données vides, trop grandes ou pas en base64', () => {
    expect(() => parseDraggedImage({ mimeType: 'image/svg+xml', data: 'AA==' })).toThrow()
    expect(() => parseDraggedImage({ mimeType: 'toString', data: 'AA==' })).toThrow()
    expect(() => parseDraggedImage({ mimeType: 'image/png', data: '' })).toThrow()
    expect(() =>
      parseDraggedImage({ mimeType: 'image/png', data: 'A'.repeat(MAX_DRAGGED_IMAGE + 1) })
    ).toThrow()
    expect(() => parseDraggedImage({ mimeType: 'image/png', data: '<script>' })).toThrow()
    expect(parseDraggedImage({ mimeType: 'image/gif', data: 'R0lG', name: 3 })).toEqual({
      mimeType: 'image/gif',
      data: 'R0lG'
    })
  })
})
