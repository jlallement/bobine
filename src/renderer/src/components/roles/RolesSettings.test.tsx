import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Role, RolesListing, RoleView } from '@shared/roles'
import { RolesSettings } from './RolesSettings'
import { resetRolesUi, useRolesUi } from '../../roles/roles-store'

const base: Omit<Role, 'name' | 'label' | 'scope'> = {
  icon: 'bot',
  color: 'blue',
  description: 'Fait des choses.',
  readOnly: false,
  prompt: 'Consigne.'
}
const role = (over: Partial<RoleView> & Pick<RoleView, 'name' | 'label' | 'scope'>): RoleView => ({
  ...base,
  enabled: true,
  ...over
})

const listing: RolesListing = {
  roles: [
    role({ name: 'code-reviewer', label: 'Code reviewer', scope: 'project', hides: ['builtin'] }),
    role({ name: 'testeur', label: 'Testeur', scope: 'user', readOnly: true }),
    role({ name: 'tech-lead', label: 'Tech lead', scope: 'builtin', enabled: false })
  ],
  problems: [
    {
      scope: 'project',
      file: '/p/.bobine/roles/faute.md',
      error: { code: 'unknownField', field: 'read-onyl', line: 3 }
    }
  ]
}

const api = window.api
let calls: Record<string, ReturnType<typeof vi.fn>>

beforeEach(() => {
  resetRolesUi()
  calls = {
    list: vi.fn(async () => listing),
    read: vi.fn(async (scope: string, name: string) => {
      const found = listing.roles.find((r) => r.name === name && r.scope === scope)
      return found ? { ...found } : null
    }),
    save: vi.fn(async () => ({ ok: true })),
    setEnabled: vi.fn(async () => undefined),
    remove: vi.fn(async () => true),
    exportStatus: vi.fn(async () => []),
    exportOrphans: vi.fn(async () => [])
  }
  Object.assign(window, { api: { ...api, roles: calls } })
})
afterEach(() => {
  // Démonter d'abord : remise avant le démontage de Testing Library, l'`api` d'origine (sans
  // `roles`) était lue par un effet encore monté (instable sur la CI, fiche 229).
  cleanup()
  Object.assign(window, { api })
})

function Wizard() {
  const ui = useRolesUi()
  return <span data-testid="wizard-open">{ui.wizard ? 'oui' : 'non'}</span>
}

const show = async () => {
  render(
    <>
      <RolesSettings conversationId="c1" project="boutique" profiles={[]} />
      <Wizard />
    </>
  )
  await waitFor(() => expect(screen.getByTestId('roles-settings')).toBeTruthy())
}

describe('Réglages › Rôles (fiche 223, phase 3A)', () => {
  it('trois groupes, rôle de projet qui en remplace un autre, rôle désactivé, fichier écarté', async () => {
    await show()
    expect(calls['list']).toHaveBeenCalledWith('c1')
    const rows = screen.getAllByTestId('role-row')
    expect(rows.map((r) => [r.dataset.role, r.dataset.scope, r.dataset.enabled])).toEqual([
      ['code-reviewer', 'project', 'true'],
      ['testeur', 'user', 'true'],
      ['tech-lead', 'builtin', 'false']
    ])
    expect(within(rows[0] as HTMLElement).getByTestId('role-hides').textContent).toBe(
      'Remplace un rôle fourni'
    )
    expect(screen.getByTestId('role-problem').textContent).toContain('.bobine/roles/faute.md')
    expect(screen.getByTestId('role-problem').textContent).not.toContain('/p/')
    expect(screen.getByTitle('/p/.bobine/roles/faute.md')).toBeTruthy()
    expect(screen.getByTestId('role-problem').textContent).toContain('read-onyl')
    expect(screen.queryByTestId('roles-empty')).toBeNull()
  })

  it('activer un rôle passe par le main, puis la liste se relit', async () => {
    await show()
    const off = screen.getAllByTestId('role-row-enabled')[2] as HTMLInputElement
    await act(async () => {
      fireEvent.click(off)
    })
    expect(calls['setEnabled']).toHaveBeenCalledWith('tech-lead', true)
    await waitFor(() => expect(calls['list']).toHaveBeenCalledTimes(2))
  })

  it('aucun rôle à soi : l’état vide propose de créer, et « Nouveau rôle » ouvre l’assistant', async () => {
    calls['list']?.mockResolvedValue({ roles: [listing.roles[2]], problems: [] })
    await show()
    expect(screen.getByTestId('roles-empty')).toBeTruthy()
    fireEvent.click(screen.getByTestId('roles-empty-new'))
    expect(screen.getByTestId('wizard-open').textContent).toBe('oui')
  })

  it('modifier un rôle personnel : renommé avec `previousName`, la page suit', async () => {
    await show()
    fireEvent.click(
      within(screen.getAllByTestId('role-row')[1] as HTMLElement).getByTestId('role-row-open')
    )
    await waitFor(() => expect(screen.getByTestId('role-edit')).toBeTruthy())
    expect((screen.getByTestId('role-edit-save') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByTestId('role-name'), { target: { value: 'testeuse' } })
    await act(async () => {
      fireEvent.click(screen.getByTestId('role-edit-save'))
    })
    expect(calls['save']).toHaveBeenCalledWith(
      'user',
      expect.objectContaining({ name: 'testeuse', readOnly: true }),
      { conversationId: 'c1', previousName: 'testeur' }
    )
  })

  it('renommé alors qu’il est installé dans un agent : dit à l’enregistrement, avec l’ancien identifiant', async () => {
    // Remplace l'e2e `roles-export` n° 15.
    calls['exportStatus']?.mockResolvedValue([
      {
        key: 'k1',
        profileId: 'agent-a',
        profileLabel: 'Agent A',
        format: 'bob-custom-modes',
        scope: 'user',
        file: '~/.a/modes.yaml',
        id: 'testeur',
        state: 'upToDate',
        useInBobine: true
      }
    ])
    // Relu sous son nouvel identifiant après l'enregistrement (la page suit le rôle).
    calls['read']?.mockImplementation(async (_scope: string, name: string) => {
      const found = listing.roles.find((r) => r.name === 'testeur')
      return found && (name === 'testeur' || name === 'testeuse') ? { ...found, name } : null
    })
    await show()
    fireEvent.click(
      within(screen.getAllByTestId('role-row')[1] as HTMLElement).getByTestId('role-row-open')
    )
    await waitFor(() => expect(calls['exportStatus']).toHaveBeenCalled())
    fireEvent.change(screen.getByTestId('role-name'), { target: { value: 'testeuse' } })
    await act(async () => {
      fireEvent.click(screen.getByTestId('role-edit-save'))
    })
    const saved = await screen.findByTestId('role-edit-saved')
    expect(saved.textContent).toContain('ancien identifiant')
    expect(saved.textContent).toContain('testeur')
  })

  it('deux rôles personnels de même icône et même couleur : tous deux listés chez les personnels', async () => {
    // Remplace l'e2e `roles-meme-icone` n° 2.
    calls['list']?.mockResolvedValue({
      roles: [
        role({ name: 'perf', label: 'Perf', scope: 'user', icon: 'gauge', color: 'green' }),
        role({ name: 'perf-web', label: 'Perf web', scope: 'user', icon: 'gauge', color: 'green' })
      ],
      problems: []
    })
    await show()
    const personal = screen.getByTestId('roles-group-user')
    expect(
      within(personal)
        .getAllByTestId('role-row')
        .map((r) => r.dataset['role'])
    ).toEqual(['perf', 'perf-web'])
  })

  it('un rôle fourni s’enregistre en rôle personnel du même nom, sans « Supprimer »', async () => {
    await show()
    fireEvent.click(
      within(screen.getAllByTestId('role-row')[2] as HTMLElement).getByTestId('role-row-open')
    )
    await waitFor(() => expect(screen.getByTestId('role-edit-builtin')).toBeTruthy())
    expect(screen.queryByTestId('role-edit-delete')).toBeNull()
    fireEvent.change(screen.getByTestId('role-description'), { target: { value: 'Tranche.' } })
    await act(async () => {
      fireEvent.click(screen.getByTestId('role-edit-save'))
    })
    expect(calls['save']).toHaveBeenCalledWith(
      'user',
      expect.objectContaining({ name: 'tech-lead', description: 'Tranche.' }),
      // Fiche 268 : le remplacement d'un rôle fourni est dit au main, jamais supposé.
      { conversationId: 'c1', replaceBuiltin: 'tech-lead' }
    )
  })

  it('rôle fourni enregistré sous un autre identifiant : une création, sans `replaceBuiltin`', async () => {
    await show()
    fireEvent.click(
      within(screen.getAllByTestId('role-row')[2] as HTMLElement).getByTestId('role-row-open')
    )
    await waitFor(() => expect(screen.getByTestId('role-edit-builtin')).toBeTruthy())
    fireEvent.change(screen.getByTestId('role-name'), { target: { value: 'mon-lead' } })
    await act(async () => {
      fireEvent.click(screen.getByTestId('role-edit-save'))
    })
    expect(calls['save']).toHaveBeenCalledWith(
      'user',
      expect.objectContaining({ name: 'mon-lead' }),
      { conversationId: 'c1' }
    )
  })

  it('« Essayer » : désactivé pour un rôle désactivé, avec la raison', async () => {
    await show()
    fireEvent.click(
      within(screen.getAllByTestId('role-row')[2] as HTMLElement).getByTestId('role-row-open')
    )
    await waitFor(() =>
      expect((screen.getByTestId('role-edit-try') as HTMLButtonElement).disabled).toBe(true)
    )
    expect(screen.getByTestId('role-edit-try').title).toContain('Activez d’abord ce rôle')
  })

  it('supprimer un rôle du projet demande confirmation, puis revient à la liste', async () => {
    await show()
    fireEvent.click(
      within(screen.getAllByTestId('role-row')[0] as HTMLElement).getByTestId('role-row-open')
    )
    await waitFor(() => expect(screen.getByTestId('role-edit-git')).toBeTruthy())
    fireEvent.click(screen.getByTestId('role-edit-delete'))
    expect(calls['remove']).not.toHaveBeenCalled()
    await act(async () => {
      fireEvent.click(screen.getByTestId('confirm-row-confirm'))
    })
    expect(calls['remove']).toHaveBeenCalledWith('project', 'code-reviewer', 'c1')
    await waitFor(() => expect(screen.getByTestId('roles-settings')).toBeTruthy())
  })
})
