import { describe, expect, it } from 'vitest'
import { createChime, soundFile } from './chime'

describe('son quand un agent attend (fiche 068)', () => {
  it('un son à la fois : rien à moins de 2 s, rien si désactivé', () => {
    const played: string[] = []
    let t = 0
    const chime = createChime({ play: (s) => played.push(s), now: () => t })
    chime('Glass')
    t = 1500
    chime('Glass')
    t = 2100
    chime('Ping')
    chime('off')
    expect(played).toEqual(['Glass', 'Ping'])
    expect(soundFile('Glass')).toBe('/System/Library/Sounds/Glass.aiff')
  })
})
