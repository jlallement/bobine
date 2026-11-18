/** Rappel dans la mère d'une fille partie sans le non commité (fiche 240). */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ChildReportItem } from './Subtasks'

const report = {
  kind: 'child-report' as const,
  id: 2,
  childId: 'f1',
  title: 'API et tests',
  outcome: 'done' as const,
  files: [],
  fileCount: 0,
  added: 0,
  removed: 0,
  excerpt: 'API dans api/.',
  at: 1
}
const plain = (text: string | null | undefined) => (text ?? '').replace(/[  ]/g, ' ')

describe('compte rendu d’une fille partie sans le non commité (fiche 240)', () => {
  it('la ligne dit le commit de départ et ce qui manquait', () => {
    render(
      <ChildReportItem
        item={{ ...report, leftBehind: { count: 17, commit: '9970242' } }}
        pending={false}
      />
    )
    expect(plain(screen.getByTestId('child-report-left-behind').textContent)).toBe(
      'Partie du commit 9970242 sans les 17 modifications non commitées de ce dossier : son travail ne les a pas vues.'
    )
  })

  it('partie d’un dossier propre : aucune ligne', () => {
    render(<ChildReportItem item={report} pending={false} />)
    expect(screen.queryByTestId('child-report-left-behind')).toBeNull()
  })
})
