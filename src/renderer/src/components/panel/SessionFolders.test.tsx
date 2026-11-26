import * as Tooltip from '@radix-ui/react-tooltip'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SessionFolders, type SessionFoldersProps } from './SessionFolders'

const props = (over: Partial<SessionFoldersProps> = {}): SessionFoldersProps => ({
  folders: [],
  supported: true,
  busy: false,
  agentLabel: 'IBM Bob',
  finder: true,
  onAdd: vi.fn(),
  onRemove: vi.fn(),
  onReveal: vi.fn(),
  ...over
})
const wrap = (p: SessionFoldersProps) =>
  render(
    <Tooltip.Provider>
      <SessionFolders {...p} />
    </Tooltip.Provider>
  )

describe('onglet « Session » : autres dossiers (fiche 179)', () => {
  it('sans la capacité ni dossier : rien', () => {
    const { container } = wrap(props({ supported: false }))
    expect(container.textContent).toBe('')
  })

  it('avec la capacité : dossiers listés, ajout, retrait, affichage', () => {
    const p = props({ folders: ['/projets/lib', '/projets/serveur'] })
    wrap(p)
    const rows = screen.getAllByTestId('session-extra-folder')
    expect(rows.map((r) => r.textContent)).toEqual(['lib', 'serveur'])
    fireEvent.click(screen.getByTestId('session-add-folder'))
    expect(p.onAdd).toHaveBeenCalledTimes(1)
    const [, second] = screen.getAllByTestId('session-remove-folder')
    if (second) fireEvent.click(second)
    expect(p.onRemove).toHaveBeenCalledWith('/projets/serveur')
    fireEvent.click(screen.getByText('lib'))
    expect(p.onReveal).toHaveBeenCalledWith('/projets/lib')
    expect(screen.queryByTestId('session-folders-unsupported')).toBeNull()
  })

  it('pendant une réponse : ajout et retrait sans effet, la raison dite au clavier (fiche 287)', () => {
    const p = props({ folders: ['/projets/lib'], busy: true })
    wrap(p)
    const add = screen.getByTestId('session-add-folder') as HTMLButtonElement
    const remove = screen.getByTestId('session-remove-folder') as HTMLButtonElement
    const why =
      'L’agent répond\u00a0: un dossier s’ajoute ou se retire une fois son tour fini.'
    for (const button of [add, remove]) {
      // Atteignable au clavier (pas `disabled`), mais sans effet, et il dit pourquoi.
      expect(button.disabled).toBe(false)
      expect(button.getAttribute('aria-disabled')).toBe('true')
      expect(button.getAttribute('aria-description')).toBe(why)
      fireEvent.click(button)
    }
    expect(p.onAdd).not.toHaveBeenCalled()
    expect(p.onRemove).not.toHaveBeenCalled()
  })

  it('agent qui ne les prend pas : dossiers gardés, « non transmis », pas d’ajout', () => {
    wrap(props({ folders: ['/projets/lib'], supported: false }))
    expect(screen.queryByTestId('session-add-folder')).toBeNull()
    expect(screen.getByTestId('session-folders-unsupported').textContent).toContain('IBM Bob')
    expect(screen.getByTestId('session-remove-folder')).toBeTruthy()
  })
})
