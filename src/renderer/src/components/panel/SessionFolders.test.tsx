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

  it('pendant une réponse : ajout et retrait désactivés', () => {
    wrap(props({ folders: ['/projets/lib'], busy: true }))
    expect((screen.getByTestId('session-add-folder') as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByTestId('session-remove-folder') as HTMLButtonElement).disabled).toBe(true)
  })

  it('agent qui ne les prend pas : dossiers gardés, « non transmis », pas d’ajout', () => {
    wrap(props({ folders: ['/projets/lib'], supported: false }))
    expect(screen.queryByTestId('session-add-folder')).toBeNull()
    expect(screen.getByTestId('session-folders-unsupported').textContent).toContain('IBM Bob')
    expect(screen.getByTestId('session-remove-folder')).toBeTruthy()
  })
})
