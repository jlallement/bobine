import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProfileSummary } from '@shared/agent'
import type { RoleExportPreview, RoleExportStatus } from '@shared/role-export'
import { useRoleExport } from './RoleExportStatus'

const preview: RoleExportPreview = {
  profileId: 'agent-a',
  profileLabel: 'Agent A',
  format: 'bob-custom-modes',
  id: 'code-reviewer',
  label: 'Code reviewer',
  listedAs: 'Code reviewer',
  sharedFile: true,
  replacesBasePrompt: false,
  readOnly: true,
  defaultScope: 'project',
  places: [
    { scope: 'user', file: '~/.a/modes.yaml', exists: true },
    { scope: 'project', file: '.a/modes.yaml', exists: false }
  ],
  text: 'customModes:\n  - slug: code-reviewer\n'
}
const status = (over: Partial<RoleExportStatus> = {}): RoleExportStatus => ({
  key: 'k1',
  profileId: 'agent-a',
  profileLabel: 'Agent A',
  format: 'bob-custom-modes',
  scope: 'user',
  file: '~/.a/modes.yaml',
  id: 'code-reviewer',
  state: 'upToDate',
  useInBobine: true,
  ...over
})

const profiles = [
  { id: 'agent-a', label: 'Agent A', available: true, roleExport: 'bob-custom-modes' },
  { id: 'agent-b', label: 'Agent B', available: false, roleExport: 'opencode-agents' },
  { id: 'agent-c', label: 'Agent C', available: true }
] as ProfileSummary[]

function Page(props: { profiles?: readonly ProfileSummary[]; dirty?: boolean }) {
  const exported = useRoleExport({
    role: {
      scope: 'user',
      name: 'code-reviewer',
      conversationId: 'c1',
      icon: 'bot',
      color: 'blue'
    },
    profiles: props.profiles ?? profiles,
    dirty: props.dirty ?? false
  })
  return (
    <>
      {exported.button}
      {exported.panel}
    </>
  )
}

const api = window.api
let calls: Record<string, ReturnType<typeof vi.fn>>
beforeEach(() => {
  calls = {
    exportStatus: vi.fn(async () => [] as RoleExportStatus[]),
    exportPreview: vi.fn(async () => preview),
    export: vi.fn(async () => ({ ok: true, status: status() })),
    exportRemove: vi.fn(async () => ({ ok: true }))
  }
  Object.assign(window, { api: { ...api, roles: calls } })
})
afterEach(() => {
  // Démonté avant de rendre `window.api` : une relecture en attente ne part plus.
  cleanup()
  Object.assign(window, { api })
})

const openMenu = () => {
  const button = screen.getByTestId('role-export-button')
  fireEvent.pointerDown(button, { button: 0, ctrlKey: false })
}

describe('« Installer dans… » (fiche 223, phase 4)', () => {
  it('aucun agent installé qui sait recevoir un rôle : pas de bouton', () => {
    render(<Page profiles={profiles.filter((p) => p.id === 'agent-c')} />)
    expect(screen.queryByTestId('role-export-button')).toBeNull()
  })

  it('menu : seulement les agents installés qui le déclarent', async () => {
    render(<Page />)
    openMenu()
    expect(await screen.findByTestId('role-export-target-agent-a')).toBeTruthy()
    expect(screen.queryByTestId('role-export-target-agent-b')).toBeNull()
    expect(screen.queryByTestId('role-export-target-agent-c')).toBeNull()
  })

  it('feuille : portée du rôle, texte exact sur demande, installe avec « lancer dans ce mode »', async () => {
    render(<Page />)
    openMenu()
    fireEvent.click(await screen.findByTestId('role-export-target-agent-a'))
    await screen.findByTestId('role-export-sheet')
    await waitFor(() =>
      expect(
        (screen.getByTestId('role-export-place-project').querySelector('input') as HTMLInputElement)
          .checked
      ).toBe(true)
    )
    expect(screen.queryByTestId('role-export-text')).toBeNull()
    fireEvent.click(screen.getByTestId('role-export-show-text'))
    expect(screen.getByTestId('role-export-text').textContent).toBe(preview.text)
    fireEvent.click(screen.getByTestId('role-export-place-user').querySelector('input') as Element)
    calls['exportStatus']?.mockResolvedValue([status()])
    fireEvent.click(screen.getByTestId('role-export-install'))
    await waitFor(() => expect(screen.queryByTestId('role-export-sheet')).toBeNull())
    expect(calls['export']).toHaveBeenCalledWith(
      { scope: 'user', name: 'code-reviewer', conversationId: 'c1' },
      { profileId: 'agent-a', scope: 'user' },
      { useInBobine: true }
    )
    expect((await screen.findByTestId('role-export-row')).dataset['state']).toBe('upToDate')
  })

  it('conflit : la page dit que rien n’a été changé', async () => {
    calls['export']?.mockResolvedValue({
      ok: false,
      error: { code: 'foreign', detail: 'code-reviewer', file: '~/.a/modes.yaml' }
    })
    render(<Page />)
    openMenu()
    fireEvent.click(await screen.findByTestId('role-export-target-agent-a'))
    await screen.findByTestId('role-export-place-user')
    fireEvent.click(screen.getByTestId('role-export-install'))
    const text = (await screen.findByTestId('role-export-error')).textContent ?? ''
    expect(text).toContain('Agent A a déjà un mode')
    expect(text).toContain('code-reviewer')
    expect(text).toContain('que Bobine n’a pas écrit')
  })

  it('rôle changé : « Mettre à jour » ; modifié à la main : retirer seulement après confirmation', async () => {
    calls['exportStatus']?.mockResolvedValue([status({ state: 'roleChanged' })])
    const { unmount } = render(<Page />)
    fireEvent.click(await screen.findByTestId('role-export-update'))
    await waitFor(() =>
      expect(calls['export']).toHaveBeenCalledWith(
        { scope: 'user', name: 'code-reviewer', conversationId: 'c1' },
        { profileId: 'agent-a', scope: 'user' },
        { useInBobine: true }
      )
    )
    unmount()
    calls['exportStatus']?.mockResolvedValue([status({ state: 'handEdited' })])
    render(<Page />)
    fireEvent.click(await screen.findByTestId('role-export-remove'))
    expect(calls['exportRemove']).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('confirm-row-confirm'))
    await waitFor(() => expect(calls['exportRemove']).toHaveBeenCalledWith('k1', true))
  })

  it('modifications non enregistrées : bouton désactivé', () => {
    render(<Page dirty />)
    expect((screen.getByTestId('role-export-button') as HTMLButtonElement).disabled).toBe(true)
  })
})
