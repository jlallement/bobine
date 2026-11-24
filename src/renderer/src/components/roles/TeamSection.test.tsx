import * as Tooltip from '@radix-ui/react-tooltip'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RolesListing, RoleView } from '@shared/roles'
import { TeamSection } from './TeamSection'
import { onRoleInvoked, resetRolesUi, rolesChanged } from '../../roles/roles-store'

/**
 * Section « Équipe » de la barre latérale (fiche 223) : remplace les vérifications de composant
 * de l'e2e `roles-gestion` (n° 1, 2, 3, 9 et 18). Le jeton posé dans la saisie et la ligne « Sera
 * confié à… » sont ceux de `RoleComposer.test.tsx` : ici, le chemin unique `invokeRole`.
 */

const role = (over: Partial<RoleView> & Pick<RoleView, 'name' | 'label'>): RoleView => ({
  scope: 'builtin',
  icon: 'bot',
  color: 'blue',
  description: `Description de ${over.label}.`,
  readOnly: false,
  prompt: 'Consigne.',
  enabled: true,
  ...over
})

const listing: RolesListing = {
  roles: [
    // Le relecteur du projet remplace le fourni : le main ne rend que lui (library.test.ts).
    role({ name: 'code-reviewer', label: 'Relecteur', scope: 'project', hides: ['builtin'] }),
    role({ name: 'tech-lead', label: 'Tech lead' }),
    role({ name: 'ux-ui-expert', label: 'Expert UX/UI' }),
    role({ name: 'archive', label: 'Archiviste', scope: 'user', enabled: false })
  ],
  problems: []
}

const api = window.api
let list: ReturnType<typeof vi.fn>

beforeEach(() => {
  resetRolesUi()
  list = vi.fn(async () => listing)
  Object.assign(window, { api: { ...api, roles: { list } } })
})
afterEach(() => {
  cleanup()
  Object.assign(window, { api })
})

const show = async (onShowConversation = vi.fn()) => {
  render(
    <Tooltip.Provider>
      <TeamSection
        conversationId="c1"
        folded={false}
        onToggle={() => {}}
        onShowConversation={onShowConversation}
      />
    </Tooltip.Provider>
  )
  await waitFor(() => expect(screen.getByTestId('team-section')).toBeTruthy())
  return onShowConversation
}

const tiles = () => screen.queryAllByTestId('team-role').map((tile) => tile.dataset.role)

describe('section Équipe (fiche 223)', () => {
  it('les rôles actifs du projet de la conversation, sous le titre « Équipe »', async () => {
    await show()
    expect(list).toHaveBeenCalledWith('c1')
    expect(screen.getByTestId('team-section').textContent).toContain('Équipe')
    expect(tiles()).toEqual(['code-reviewer', 'tech-lead', 'ux-ui-expert'])
    expect(screen.queryByText('Archiviste')).toBeNull()
  })

  it('chaque tuile a un nom accessible « Confier un travail à … »', async () => {
    await show()
    const names = screen.getAllByTestId('team-role').map((tile) => tile.getAttribute('aria-label'))
    expect(names).toEqual([
      'Confier un travail à Relecteur',
      'Confier un travail à Tech lead',
      'Confier un travail à Expert UX/UI'
    ])
    expect(screen.getByRole('list', { name: 'Équipe' })).toBeTruthy()
  })

  it('infobulle au focus : le nom puis la description (reçue traduite du main)', async () => {
    await show()
    const tile = screen.getAllByTestId('team-role')[1] as HTMLElement
    fireEvent.focus(tile)
    const tip = await screen.findByRole('tooltip')
    expect(tip.textContent).toContain('Tech lead')
    expect(tip.textContent).toContain('Description de Tech lead.')
  })

  it('clic sur une tuile : le rôle part à la saisie abonnée, sans ramener la conversation', async () => {
    const received: string[] = []
    const off = onRoleInvoked((name) => received.push(name))
    const onShow = await show()
    fireEvent.click(screen.getAllByTestId('team-role')[2] as HTMLElement)
    expect(received).toEqual(['ux-ui-expert'])
    expect(onShow).not.toHaveBeenCalled()
    off()
  })

  it('aucune saisie à l’écran : la conversation est ramenée, le jeton l’attend', async () => {
    const onShow = await show()
    fireEvent.click(screen.getAllByTestId('team-role')[0] as HTMLElement)
    expect(onShow).toHaveBeenCalledTimes(1)
    const received: string[] = []
    const off = onRoleInvoked((name) => received.push(name))
    expect(received).toEqual(['code-reviewer'])
    off()
  })

  it('un rôle désactivé dans les Réglages quitte la section à la relecture', async () => {
    await show()
    expect(tiles()).toContain('tech-lead')
    list.mockResolvedValue({
      ...listing,
      roles: listing.roles.map((r) => (r.name === 'tech-lead' ? { ...r, enabled: false } : r))
    })
    await act(async () => rolesChanged())
    await waitFor(() => expect(tiles()).toEqual(['code-reviewer', 'ux-ui-expert']))
  })

  it('aucun rôle actif : la section le dit', async () => {
    list.mockResolvedValue({ roles: [listing.roles[3]], problems: [] })
    await show()
    expect(tiles()).toEqual([])
    expect(document.querySelector('.team-empty')).toBeTruthy()
  })
})
