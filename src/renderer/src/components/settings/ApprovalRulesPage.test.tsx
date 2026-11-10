import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProfileSummary } from '@shared/agent'
import { APPROVAL_GROUPS, type ApprovalRulesView } from '@shared/approval-rules'
import { ApprovalRulesPage } from './ApprovalRulesPage'

const rules = (outside: { global: boolean; read: boolean }): ApprovalRulesView => ({
  profileId: 'bob',
  file: '~/.bob/settings/settings.json',
  exists: true,
  groups: APPROVAL_GROUPS.map((id) => ({
    id,
    enabled: id === 'read',
    forbidden: false,
    outsideWorkspace: id === 'read' && outside.read
  })),
  defaultGroups: false,
  otherGroups: [],
  commands: { allowed: ['ls'], denied: [], defaultList: false },
  outsideWorkspaceAllowed: outside.global,
  autoApprovalEnabled: true,
  forbiddenGroups: []
})

const profile = { id: 'bob', label: 'IBM Bob' } as ProfileSummary
const get = vi.fn()
const change = vi.fn()
const original = window.api

beforeEach(() => {
  get.mockReset()
  change.mockReset()
  window.api = { ...original, approvalRules: { get, change, open: vi.fn() } } as typeof window.api
})

afterEach(() => {
  window.api = original
})

const readRow = () =>
  screen
    .getAllByTestId('approval-group-outside')
    .map((input) => input.closest('.settings-row') as HTMLElement)[0] as HTMLElement

describe('Approbations : hors du dossier (fiche 215)', () => {
  it('global éteint : l’effet de bord est dit sous l’option, et l’allumer écrit les deux', async () => {
    get.mockResolvedValue({ ok: true, rules: rules({ global: false, read: false }) })
    change.mockImplementation(() =>
      Promise.resolve({ ok: true, rules: rules({ global: true, read: true }), notice: {} })
    )
    render(<ApprovalRulesPage profile={profile} />)
    await screen.findAllByTestId('approval-group-outside')
    expect(within(readRow()).getByTestId('approval-outside-effect').textContent).toMatch(
      /accord explicite/
    )
    fireEvent.click(within(readRow()).getByTestId('approval-group-outside'))
    await waitFor(() => expect(change).toHaveBeenCalledTimes(2))
    expect(change.mock.calls.map((c) => c[1])).toEqual([
      { type: 'setOutsideWorkspaceAllowed', enabled: true },
      { type: 'setGroupOutsideWorkspace', group: 'read', enabled: true }
    ])
  })

  it('global déjà allumé : rien à dire sous l’option', async () => {
    get.mockResolvedValue({ ok: true, rules: rules({ global: true, read: true }) })
    render(<ApprovalRulesPage profile={profile} />)
    await screen.findAllByTestId('approval-group-outside')
    expect(screen.queryByTestId('approval-outside-effect')).toBeNull()
    expect(screen.queryByTestId('approval-outside-still-on')).toBeNull()
  })

  it('options éteintes, global resté allumé : dit, avec « Ne plus l’autoriser »', async () => {
    get.mockResolvedValue({ ok: true, rules: rules({ global: true, read: false }) })
    change.mockResolvedValue({ ok: true, rules: rules({ global: false, read: false }), notice: {} })
    render(<ApprovalRulesPage profile={profile} />)
    const note = await screen.findByTestId('approval-outside-still-on')
    expect(note.textContent).toMatch(/reste autorisé/)
    fireEvent.click(screen.getByTestId('approval-outside-turn-off'))
    await waitFor(() =>
      expect(change).toHaveBeenCalledWith('bob', {
        type: 'setOutsideWorkspaceAllowed',
        enabled: false
      })
    )
    await waitFor(() => expect(screen.queryByTestId('approval-outside-still-on')).toBeNull())
  })
})

describe('Approbations : un seul mot (recette QA)', () => {
  const card = (list: 'allowed' | 'denied') => screen.getByTestId(`approval-rules-${list}`)
  const add = (list: 'allowed' | 'denied', text: string) => {
    fireEvent.change(within(card(list)).getByTestId('approval-rules-add-input'), {
      target: { value: text }
    })
    fireEvent.click(within(card(list)).getByTestId('approval-rules-add'))
  }

  beforeEach(() => {
    get.mockResolvedValue({ ok: true, rules: rules({ global: false, read: false }) })
    change.mockResolvedValue({ ok: true, rules: rules({ global: false, read: false }), notice: {} })
  })

  it('autorisées : avertissement et confirmation explicite avant d’écrire', async () => {
    render(<ApprovalRulesPage profile={profile} />)
    await screen.findByTestId('approval-rules-allowed')
    add('allowed', ' git ')
    const confirm = within(card('allowed')).getByTestId('approval-rules-one-word')
    expect(within(confirm).getByTestId('global-rule-one-word').textContent).toContain(
      'git push --force'
    )
    expect(change).not.toHaveBeenCalled()
    fireEvent.click(within(confirm).getByTestId('confirm-row-confirm'))
    await waitFor(() =>
      expect(change).toHaveBeenCalledWith('bob', {
        type: 'addCommand',
        prefix: ' git ',
        list: 'allowed'
      })
    )
  })

  it('autorisées : « Garder » n’écrit rien ; commande entière : pas de confirmation', async () => {
    render(<ApprovalRulesPage profile={profile} />)
    await screen.findByTestId('approval-rules-allowed')
    add('allowed', 'git')
    fireEvent.click(within(card('allowed')).getByTestId('confirm-row-keep'))
    expect(screen.queryByTestId('approval-rules-one-word')).toBeNull()
    add('allowed', 'git status')
    await waitFor(() => expect(change).toHaveBeenCalledTimes(1))
    expect(change.mock.calls[0]?.[1]).toMatchObject({ prefix: 'git status' })
  })

  it('refusées : un seul mot s’écrit sans avertissement', async () => {
    render(<ApprovalRulesPage profile={profile} />)
    await screen.findByTestId('approval-rules-denied')
    add('denied', 'rm')
    expect(screen.queryByTestId('approval-rules-one-word')).toBeNull()
    await waitFor(() =>
      expect(change).toHaveBeenCalledWith('bob', {
        type: 'addCommand',
        prefix: 'rm',
        list: 'denied'
      })
    )
  })
})
