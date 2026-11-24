/**
 * Raccourci des modifications dans l'en-tête (fiche 021) : remplaçant des vérifications de
 * composant de la suite e2e `changes` (inventaire B, #1 et #2). Les totaux viennent du même calcul
 * que dans `App` (`changesSummary(conversationChanges(…))`).
 */
import * as Tooltip from '@radix-ui/react-tooltip'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { changesSummary, conversationChanges } from '@shared/changes'
import type { TranscriptItem } from '@shared/transcript'
import { ChangesToggle } from './ChangesToggle'

const edit = (id: number, path: string, oldText: string | null, newText: string) =>
  ({
    kind: 'tool',
    id,
    toolCallId: `t${id}`,
    title: 'Edit',
    toolKind: 'edit',
    status: 'completed',
    content: [{ type: 'diff', path, oldText, newText }],
    locations: []
  }) as TranscriptItem

function toggle(items: TranscriptItem[], open = false) {
  const onToggle = vi.fn()
  render(
    <Tooltip.Provider>
      <ChangesToggle
        changes={changesSummary(conversationChanges(items))}
        open={open}
        onToggle={onToggle}
      />
    </Tooltip.Provider>
  )
  return onToggle
}
const shown = () => screen.getByTestId('changes-toggle').textContent?.replace(/\s+/g, ' ').trim()

describe('raccourci des modifications de l’en-tête (fiche 021)', () => {
  it('pas de raccourci tant que rien n’est modifié', () => {
    toggle([{ kind: 'user', id: 1, text: 'Bonjour' }])
    expect(screen.queryByTestId('changes-toggle')).toBeNull()
  })

  it('2 fichiers, +6 −1 ; un clic ouvre l’onglet', () => {
    const onToggle = toggle([
      edit(1, '/p/README.md', '# Démo\nancienne\n', '# Démo\nnouvelle\nligne\n'),
      edit(2, '/p/src/app.js', null, 'a\nb\nc\nd\n')
    ])
    expect(shown()).toBe('2+6−1')
    expect(screen.getByTestId('changes-toggle').querySelector('.diff-added')?.textContent).toBe(
      '+6'
    )
    expect(screen.getByTestId('changes-toggle').querySelector('.diff-removed')?.textContent).toBe(
      '−1'
    )
    fireEvent.click(screen.getByTestId('changes-toggle'))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('onglet affiché : le raccourci est actif', () => {
    toggle([edit(1, '/p/a.txt', 'x\n', 'y\n')], true)
    expect(screen.getByTestId('changes-toggle').classList.contains('active')).toBe(true)
  })
})
