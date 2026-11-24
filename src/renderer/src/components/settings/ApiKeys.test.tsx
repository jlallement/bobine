import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { ApiKeyInfo } from '@shared/agent'
import { ApiKeyRow } from './ApiKeys'

/**
 * Clé d'API d'un agent dans Réglages › Agents (fiches 022, 100, 145, 207) : remplace les
 * vérifications de composant des e2e `auth` (n° 7, 8, 9, 13, 14, 20, 21, 22) et
 * `textes-plateforme` (n° 8). La valeur ne revient jamais à l'interface (api-keys.test.ts, main).
 */

const KEY: ApiKeyInfo = {
  env: 'MOCK_AGENT_API_KEY',
  label: 'Clé de l’agent factice',
  help: 'Dans la console de l’agent.',
  stored: false,
  fromEnvironment: false
}

/** Le main relit l'état après chaque enregistrement ou suppression : le parent le repasse. */
function Harness({
  initial,
  save,
  remove = () => {}
}: {
  initial: ApiKeyInfo
  save: (value: string) => Promise<void>
  remove?: () => void
}) {
  const [info, setInfo] = useState(initial)
  return (
    <ApiKeyRow
      info={info}
      onSave={async (value) => {
        await save(value)
        setInfo({ ...info, stored: true, unreadable: false })
      }}
      onRemove={() => {
        remove()
        setInfo({ ...info, stored: false, plaintext: false })
      }}
    />
  )
}

const state = () => screen.getByTestId('api-key-state').textContent
const input = () => screen.getByTestId('api-key-value') as HTMLInputElement
const submit = () => screen.getByTestId('api-key-submit') as HTMLButtonElement

function type(value: string) {
  fireEvent.click(screen.getByTestId('api-key-edit'))
  fireEvent.change(input(), { target: { value } })
  fireEvent.submit(input())
}

const TIMEOUT = new Error(
  "Error invoking remote method 'settings:setApiKey': Error: BOBINE_KEYCHAIN_TIMEOUT: Le trousseau macOS n’a pas répondu en 60 s : la clé n’est pas enregistrée."
)

describe('Réglages › page de l’agent : clé d’API', () => {
  it('saisie puis « Enregistrée » ; jamais la valeur à l’écran', async () => {
    const save = vi.fn(async () => {})
    render(<Harness initial={KEY} save={save} />)
    expect(state()).toBe('Aucune')
    type('cle-de-test-123')
    await waitFor(() => expect(state()).toBe('Enregistrée'))
    expect(save).toHaveBeenCalledWith('cle-de-test-123')
    expect(screen.queryByTestId('api-key-value')).toBeNull()
    expect(document.body.textContent).not.toContain('cle-de-test-123')
    expect(screen.getByTestId('api-key-edit').textContent).toBe('Remplacer')
    expect(screen.queryByTestId('api-key-plaintext')).toBeNull()
  })

  it('en clair (Linux sans trousseau) : l’état le dit, et l’avis nomme la variable', () => {
    render(
      <ApiKeyRow
        info={{ ...KEY, stored: true, plaintext: true }}
        onSave={vi.fn()}
        onRemove={vi.fn()}
      />
    )
    expect(state()).toBe('Enregistrée en clair')
    const notice = screen.getByTestId('api-key-plaintext')
    expect(notice.getAttribute('role')).toBe('note')
    expect(notice.textContent).toContain('MOCK_AGENT_API_KEY')
  })

  it('chiffrée (Windows, Mac) : « Enregistrée », pas d’avis en clair', () => {
    render(<ApiKeyRow info={{ ...KEY, stored: true }} onSave={vi.fn()} onRemove={vi.fn()} />)
    expect(state()).toBe('Enregistrée')
    expect(screen.queryByTestId('api-key-plaintext')).toBeNull()
  })

  it('supprimer : confirmation dans la ligne, puis l’état revient à « Aucune »', () => {
    const remove = vi.fn()
    render(<Harness initial={{ ...KEY, stored: true }} save={vi.fn()} remove={remove} />)
    fireEvent.click(screen.getByTestId('api-key-remove'))
    expect(remove).not.toHaveBeenCalled()
    const row = screen.getByTestId('api-key-MOCK_AGENT_API_KEY')
    expect(row.textContent).toContain('Il faudra la saisir de nouveau')
    fireEvent.click(within(row).getByRole('button', { name: 'Supprimer' }))
    expect(remove).toHaveBeenCalledTimes(1)
    expect(state()).toBe('Aucune')
    expect(screen.queryByTestId('api-key-remove')).toBeNull()
  })

  it('clé refusée par le main : la cause seule, sans « Error », la saisie reste ouverte', async () => {
    const save = vi.fn(async () => {
      throw new Error(
        "Error invoking remote method 'settings:setApiKey': Error: Clé invalide : elle contient des espaces."
      )
    })
    render(<Harness initial={KEY} save={save} />)
    type('cle avec espaces')
    const error = await screen.findByTestId('api-key-error')
    expect(error.textContent).toBe('Clé invalide : elle contient des espaces.')
    expect(error.textContent).not.toContain('Error')
    expect(input().value).toBe('cle avec espaces')
    expect(state()).toBe('Aucune')
  })

  it('clé illisible (nom de l’app changé) : dit, puis ressaisie, de nouveau « Enregistrée »', async () => {
    render(
      <Harness initial={{ ...KEY, stored: true, unreadable: true }} save={vi.fn(async () => {})} />
    )
    expect(state()).toBe('Illisible, à saisir de nouveau')
    type('nouvelle-cle')
    await waitFor(() => expect(state()).toBe('Enregistrée'))
  })

  it('fournie par l’environnement : dit avec le nom de la variable', () => {
    render(
      <ApiKeyRow info={{ ...KEY, fromEnvironment: true }} onSave={vi.fn()} onRemove={vi.fn()} />
    )
    expect(state()).toBe('Fournie par l’environnement (MOCK_AGENT_API_KEY)')
  })

  it('trousseau lent : champ et bouton désactivés, « Enregistrement… », puis l’attente dite', async () => {
    vi.useFakeTimers()
    try {
      const save = vi.fn(() => new Promise<void>(() => {}))
      render(<Harness initial={KEY} save={save} />)
      type('cle-123')
      expect(input().disabled).toBe(true)
      expect(submit().disabled).toBe(true)
      expect(submit().textContent).toContain('Enregistrement…')
      expect(screen.queryByTestId('keychain-wait')).toBeNull()
      fireEvent.submit(input())
      expect(save).toHaveBeenCalledTimes(1)
      await act(async () => vi.advanceTimersByTime(1000))
      expect(screen.getByTestId('keychain-wait').textContent).toContain('En attente du trousseau')
    } finally {
      vi.useRealTimers()
    }
  })

  it('délai dépassé : le message, la valeur gardée, rien d’enregistré, puis « Réessayer »', async () => {
    const save = vi
      .fn<(value: string) => Promise<void>>()
      .mockRejectedValueOnce(TIMEOUT)
      .mockResolvedValueOnce(undefined)
    render(<Harness initial={KEY} save={save} />)
    type('cle-123')
    const error = await screen.findByTestId('api-key-error')
    expect(error.textContent).toBe(
      'Le trousseau macOS n’a pas répondu en 60 s : la clé n’est pas enregistrée.'
    )
    expect(input().value).toBe('cle-123')
    expect(state()).toBe('Aucune')
    expect(submit().disabled).toBe(false)
    expect(submit().textContent).toContain('Réessayer')
    fireEvent.click(submit())
    await waitFor(() => expect(state()).toBe('Enregistrée'))
    expect(save).toHaveBeenCalledTimes(2)
    expect(save).toHaveBeenLastCalledWith('cle-123')
  })
})
