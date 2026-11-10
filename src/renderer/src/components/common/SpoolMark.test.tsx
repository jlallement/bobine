import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AppIcon, SpoolMark } from './SpoolMark'

describe('bobine dans l’app (fiche 069)', () => {
  it('masques propres à chaque bobine, animation choisie, invite seulement en grand', () => {
    const { container } = render(
      <>
        <SpoolMark size={38} motion="intro" />
        <SpoolMark size={16} motion="loop" />
      </>
    )
    const spools = [...container.querySelectorAll('svg.spool-mark')]
    expect(spools).toHaveLength(2)
    const masks = [...container.querySelectorAll('mask')].map((m) => m.id)
    expect(new Set(masks).size).toBe(4)
    for (const svg of spools) {
      for (const path of svg.querySelectorAll('g > path')) {
        const ref = path.getAttribute('mask')?.match(/^url\(#(.+)\)$/)?.[1]
        expect(svg.querySelector(`mask[id="${ref}"]`)).not.toBeNull()
      }
    }
    const [big, small] = spools
    expect(big?.classList.contains('spool-intro')).toBe(true)
    expect(small?.classList.contains('spool-loop')).toBe(true)
    expect(big?.querySelector('.spool-cursor')).not.toBeNull()
    expect(small?.querySelector('.spool-cursor')).toBeNull()
    expect(big?.getAttribute('height')).toBe('38')
    expect(big?.getAttribute('width')).toBe('34')
  })

  it('icône de l’app : fond pétrole, bobine crème', () => {
    const { getByTestId } = render(<AppIcon size={56} />)
    const icon = getByTestId('app-icon')
    expect(icon.querySelector('rect')?.getAttribute('fill')).toBe('#165C63')
    expect(icon.querySelector('g')?.getAttribute('fill')).toBe('#F4F0E5')
  })
})
