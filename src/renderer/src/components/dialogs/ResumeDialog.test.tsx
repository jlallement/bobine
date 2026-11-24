import { act, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AgentSessionView, ProfileSummary } from '@shared/agent'
import { ResumeDialog } from './ResumeDialog'

/**
 * « Reprendre une session… » (fiche 055) : remplace les vérifications de composant de
 * `e2e/suites/resume.mjs` (n° 2, 3, 6). La liste filtrée par dossier et le rejeu restent au main
 * (`manager.test.ts`, `session-list.test.ts`) ; la reprise réelle (`session/load`), à l'e2e.
 */

const api = window.api as unknown as { agent: Record<string, unknown> }
const listSessionsBefore = api.agent.listSessions
afterEach(() => {
  api.agent.listSessions = listSessionsBefore
})

const profiles = [
  { id: 'mock', label: 'Agent factice', available: true, capabilities: {} }
] as unknown as ProfileSummary[]

const sessions: AgentSessionView[] = [
  { sessionId: 's1', cwd: '/Users/moi/projet', title: 'Réparer le parser' },
  { sessionId: 's2', cwd: '/Users/moi/projet', title: 'Écrire la doc' },
  { sessionId: 's3', cwd: '/Users/moi/base', title: 'Migration postgres du parser' }
]

async function setup() {
  const listSessions = vi.fn(async (_agent: string, only?: string) =>
    only ? sessions.filter((s) => s.cwd === only) : sessions
  )
  api.agent.listSessions = listSessions
  const onClose = vi.fn()
  function Host() {
    const [open, setOpen] = useState(true)
    return open ? (
      <ResumeDialog
        profiles={profiles}
        profileId="mock"
        workspace="/Users/moi/projet"
        onClose={() => {
          onClose()
          setOpen(false)
        }}
        onResume={vi.fn(async () => {})}
      />
    ) : (
      <button data-testid="history-menu">Historique</button>
    )
  }
  render(<Host />)
  await act(async () => {})
  return { listSessions, onClose }
}

const titles = () => screen.queryAllByTestId('resume-session').map((s) => s.title)
const folders = () =>
  [...document.querySelectorAll('.resume-folder')].map((f) => f.getAttribute('title'))

describe('« Reprendre une session… » (fiche 055)', () => {
  it('« Tous les dossiers » : la liste s’élargit, groupée par dossier (resume n° 2)', async () => {
    const { listSessions } = await setup()
    expect(listSessions).toHaveBeenLastCalledWith('mock', '/Users/moi/projet')
    expect(titles()).toEqual(['Réparer le parser', 'Écrire la doc'])
    expect(folders()).toEqual([])
    await act(async () => fireEvent.click(screen.getByTestId('resume-scope-all')))
    expect(listSessions).toHaveBeenLastCalledWith('mock', undefined)
    expect(folders()).toEqual(['/Users/moi/projet', '/Users/moi/base'])
    const groups = [...document.querySelectorAll('.resume-group')].map((g) =>
      [...g.querySelectorAll('[data-testid=resume-session]')].map((s) => s.getAttribute('title'))
    )
    expect(groups).toEqual([
      ['Réparer le parser', 'Écrire la doc'],
      ['Migration postgres du parser']
    ])
    // Le dossier personnel est abrégé.
    expect(document.querySelector('.resume-folder .muted')?.textContent).toBe('~/projet')
  })

  it('filtre « parser » puis « postgres » : une seule session reste (resume n° 3)', async () => {
    await setup()
    await act(async () => fireEvent.click(screen.getByTestId('resume-scope-all')))
    const filter = screen.getByTestId('resume-filter')
    fireEvent.change(filter, { target: { value: 'parser' } })
    expect(titles()).toEqual(['Réparer le parser', 'Migration postgres du parser'])
    fireEvent.change(filter, { target: { value: 'parser postgres' } })
    expect(titles()).toEqual(['Migration postgres du parser'])
    fireEvent.change(filter, { target: { value: 'introuvable' } })
    expect(screen.getByTestId('resume-none').textContent).toBe('Aucune session ne correspond.')
  })

  it('fenêtre refermée : rien de modal ne reste, le menu de l’historique se clique (resume n° 6)', async () => {
    const { onClose } = await setup()
    fireEvent.keyDown(screen.getByTestId('resume-dialog'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('resume-dialog')).toBeNull()
    expect(document.body.style.pointerEvents).not.toBe('none')
    expect(screen.getByTestId('history-menu').closest('[aria-hidden=true]')).toBeNull()
  })
})
