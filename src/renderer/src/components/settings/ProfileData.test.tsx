import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { TrashEntry } from '@shared/profile'
import { TrashList } from './ProfileData'

const originalApi = window.api
afterEach(() => {
  window.api = originalApi
})

const entry = (id: string, workspace: string, space?: 'discussion'): TrashEntry => ({
  id,
  title: `Titre ${id}`,
  workspace,
  ...(space ? { space } : {}),
  deletedAt: new Date().toISOString(),
  erasedAt: new Date(Date.now() + 10 * 86_400_000).toISOString()
})

describe('corbeille (fiche 196)', () => {
  it('une discussion (fiche 224) : « Discussion », jamais le nom de son dossier', async () => {
    const entries = [
      entry('d', '/data/discussions/3973c57d-c6ab', 'discussion'),
      entry('c', '/Users/ada/carnet')
    ]
    window.api = {
      ...originalApi,
      profile: { trash: async () => entries }
    } as unknown as Window['api']
    render(<TrashList readOnly={false} />)
    const rows = await screen.findAllByTestId('trash-item')
    expect(rows[0]?.textContent).toMatch(/^Titre dDiscussion · /)
    expect(rows[0]?.textContent).not.toContain('3973c57d')
    expect(rows[1]?.textContent).toContain('carnet · ')
  })

  it('la mère dit les travaux supprimés avec elle, qui reviendront avec elle (recette rc.4, T7)', async () => {
    const entries = [
      { ...entry('m', '/Users/ada/carnet'), children: 2 },
      { ...entry('u', '/Users/ada/carnet'), children: 1 },
      entry('f', '/Users/ada/carnet')
    ]
    window.api = {
      ...originalApi,
      profile: { trash: async () => entries }
    } as unknown as Window['api']
    render(<TrashList readOnly={false} />)
    const rows = await screen.findAllByTestId('trash-item')
    expect(rows[0]?.querySelector('[data-testid=trash-children]')?.textContent).toBe(
      'avec ses 2 travaux'
    )
    expect(rows[1]?.querySelector('[data-testid=trash-children]')?.textContent).toBe(
      'avec son travail'
    )
    expect(rows[2]?.querySelector('[data-testid=trash-children]')).toBeNull()
  })
})
