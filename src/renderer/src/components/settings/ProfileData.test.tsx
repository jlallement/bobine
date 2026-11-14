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
})
