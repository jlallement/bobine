import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LineTotals } from './LineTotals'

const text = (ui: React.ReactElement) => render(ui).container.textContent ?? ''

describe('totaux des modifications (fiche 272)', () => {
  it('fichiers binaires : « binaire », jamais « +0 −0 »', () => {
    expect(text(<LineTotals files={1} added={0} removed={0} binary={1} />)).toBe('binaire')
    expect(text(<LineTotals files={2} added={3} removed={1} binary={1} spaced />)).toBe(
      '+3 −1 · 1 binaire'
    )
  })

  it('sans diff connu : « sans totaux »', () => {
    expect(text(<LineTotals files={1} added={0} removed={0} unknown={1} />)).toBe('sans totaux')
  })
})
