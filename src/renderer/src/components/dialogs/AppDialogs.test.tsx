import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BranchPreview, ConversationSummary } from '@shared/agent'
import type { Conversations } from '../../useConversations'
import { AppDialogs, useAppDialogs } from './AppDialogs'

const summary = (id: string, title: string) =>
  ({
    id,
    title,
    profileId: 'p',
    profileLabel: 'Agent',
    workspace: '/w',
    updatedAt: '2026-10-20T08:00:00.000Z',
    status: 'stopped',
    draft: false
  }) as ConversationSummary

const preview: BranchPreview = {
  files: [{ path: '/w/a.ts', status: 'restore' }],
  commands: 0
} as unknown as BranchPreview

function fakeConversations() {
  return {
    settings: null,
    notificationStatus: {},
    list: [summary('a', 'Alpha'), summary('b', 'Bêta')],
    activeId: 'a',
    activeSummary: null,
    select: vi.fn(),
    remove: vi.fn(async () => {}),
    branch: vi.fn(async () => {}),
    worktreeStatus: vi.fn(async () => null),
    resumeSession: vi.fn(async () => {})
  } as unknown as Conversations
}

const originalApi = window.api
const search = vi.fn(async (_query: string) => [] as unknown[])
beforeEach(() => {
  search.mockReset().mockResolvedValue([])
  window.api = { ...originalApi, conversations: { search } } as unknown as Window['api']
})
afterEach(() => {
  window.api = originalApi
})

/** La fenêtre : ce qui ouvre les dialogues, et les dialogues. */
function MainWindow({ c, onFindIn }: { c: Conversations; onFindIn: () => void }) {
  const dialogs = useAppDialogs()
  return (
    <>
      <button onClick={dialogs.openSearch}>search</button>
      <button onClick={() => dialogs.setDeleting(summary('b', 'Bêta'))}>delete</button>
      <button onClick={() => dialogs.setBranching({ itemId: 7, text: 'encore', preview })}>
        branch
      </button>
      <AppDialogs
        dialogs={dialogs}
        conversations={c}
        projectCommands={[]}
        onFindIn={onFindIn}
        onOpenActivity={vi.fn()}
      />
    </>
  )
}

function setup() {
  const c = fakeConversations()
  const onFindIn = vi.fn()
  render(<MainWindow c={c} onFindIn={onFindIn} />)
  return { c, onFindIn }
}

describe('dialogues de la fenêtre', () => {
  it('aucun dialogue ouvert au départ', () => {
    setup()
    for (const id of ['settings', 'search', 'delete-dialog', 'branch-dialog']) {
      expect(screen.queryByTestId(id)).toBeNull()
    }
  })

  it('⌘K : chaque ouverture est une recherche neuve', () => {
    const { result } = renderHook(() => useAppDialogs())
    const now = vi.spyOn(Date, 'now').mockReturnValueOnce(1).mockReturnValueOnce(2)
    act(() => result.current.openSearch())
    expect(result.current.searchKey).toBe(1)
    act(() => result.current.openSearch())
    expect(result.current.searchKey).toBe(2)
    act(() => result.current.closeSearch())
    expect(result.current.searchKey).toBeNull()
    now.mockRestore()
  })

  it('recherche par titre : la conversation est choisie, sans ⌘F', () => {
    const { c, onFindIn } = setup()
    fireEvent.click(screen.getByText('search'))
    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'bêta' } })
    fireEvent.click(screen.getByTestId('search-result'))
    expect(c.select).toHaveBeenCalledWith('b')
    expect(onFindIn).not.toHaveBeenCalled()
    expect(screen.queryByTestId('search')).toBeNull()
  })

  it('trouvée par son contenu : ⌘F s’y ouvrira sur ces mots (fiche 086)', async () => {
    search.mockResolvedValue([{ id: 'b', snippet: 'le mot rare', highlights: [[3, 11]] }])
    const { c, onFindIn } = setup()
    fireEvent.click(screen.getByText('search'))
    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'mot rare' } })
    const result = await screen.findByTestId('search-result', {}, { timeout: 2000 })
    fireEvent.click(result)
    expect(c.select).toHaveBeenCalledWith('b')
    expect(onFindIn).toHaveBeenCalledWith({ id: 'b', query: 'mot rare' })
  })

  it('suppression confirmée : la conversation est supprimée, le dialogue se ferme', async () => {
    const { c } = setup()
    fireEvent.click(screen.getByText('delete'))
    fireEvent.click(await screen.findByTestId('delete-confirm'))
    expect(c.remove).toHaveBeenCalledWith('b', expect.any(Object))
    await waitFor(() => expect(screen.queryByTestId('delete-dialog')).toBeNull())
  })

  it('branche confirmée : le message repart avec les fichiers restaurés', async () => {
    const { c } = setup()
    fireEvent.click(screen.getByText('branch'))
    fireEvent.click(await screen.findByTestId('branch-confirm'))
    expect(c.branch).toHaveBeenCalledWith(7, 'encore', { restoreFiles: true })
    await waitFor(() => expect(screen.queryByTestId('branch-dialog')).toBeNull())
  })
})
