import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ChildReportItem } from './Subtasks'

const report = {
  kind: 'child-report' as const,
  id: 2,
  childId: 'f1',
  title: 'Relire',
  outcome: 'done' as const,
  files: [],
  fileCount: 0,
  added: 0,
  removed: 0,
  excerpt: 'Rien.',
  at: 1
}

afterEach(() => vi.unstubAllGlobals())

describe('« Enregistrer comme rôle » et profil en lecture seule (fiche 223, relecture)', () => {
  it('profil en lecture seule : le geste n’est pas proposé', async () => {
    const status = vi.fn(async () => ({ readOnly: true, notices: [] }))
    vi.stubGlobal(
      'window',
      Object.assign(window, { api: { profile: { status, onChanged: () => () => {} } } })
    )
    render(<ChildReportItem item={report} pending={false} onSaveAsRole={vi.fn()} />)
    await waitFor(() => expect(status).toHaveBeenCalled())
    await waitFor(() => expect(screen.queryByTestId('child-report-save-role')).toBeNull())
  })
})
