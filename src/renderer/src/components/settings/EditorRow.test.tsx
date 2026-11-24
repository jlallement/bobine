import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentSettingsView } from '@shared/agent'
import type { EditorInfo } from '@shared/editors'
import { useEditorAction } from '../../useEditor'
import { EditorRow } from './EditorRow'

/**
 * Réglages › Général › Éditeur (fiche 156) : remplace les vérifications de composant de l'e2e
 * `fil` (n° 9, 10). La détection des éditeurs installés est dans `editors.test.ts` (main) ; le
 * bouton « Ouvrir dans… » du fil, dans `ThreadExtras.test.tsx`.
 */

const INSTALLED: EditorInfo[] = [
  { id: 'vscode', name: 'Visual Studio Code' },
  { id: 'idea', name: 'IntelliJ IDEA' }
] as EditorInfo[]

const api = window.api
let installed: EditorInfo[]
let listeners: ((settings: AgentSettingsView) => void)[]
let preference: string | undefined

beforeEach(() => {
  installed = INSTALLED
  listeners = []
  preference = undefined
  Object.assign(window, {
    api: {
      ...api,
      editors: { list: async () => installed, open: vi.fn() },
      settings: {
        get: async () => ({ preferences: { editor: preference } }),
        onChanged: (listener: (settings: AgentSettingsView) => void) => {
          listeners.push(listener)
          return () => {}
        }
      }
    }
  })
})
afterEach(() => {
  Object.assign(window, { api })
})

describe('Réglages › Général › Éditeur (fiche 156)', () => {
  it('seulement les éditeurs installés ; le choix part dans les préférences', async () => {
    const onChange = vi.fn()
    render(<EditorRow preference={undefined} onChange={onChange} />)
    const select = (await screen.findByTestId('settings-editor')) as HTMLSelectElement
    expect([...select.options].map((o) => [o.value, o.textContent])).toEqual([
      ['vscode', 'Visual Studio Code'],
      ['idea', 'IntelliJ IDEA']
    ])
    fireEvent.change(select, { target: { value: 'idea' } })
    expect(onChange).toHaveBeenCalledWith('idea')
  })

  it('un éditeur choisi puis désinstallé : le premier installé est montré', async () => {
    render(<EditorRow preference="zed" onChange={vi.fn()} />)
    const select = (await screen.findByTestId('settings-editor')) as HTMLSelectElement
    expect(select.value).toBe('vscode')
  })

  it('aucun éditeur installé : pas de liste, la ligne le dit', async () => {
    installed = []
    render(<EditorRow preference={undefined} onChange={vi.fn()} />)
    await waitFor(() => expect(document.querySelector('.settings-row')).toBeTruthy())
    expect(screen.queryByTestId('settings-editor')).toBeNull()
  })

  it('le choix changé suit jusqu’aux boutons du fil : « Ouvrir dans IntelliJ IDEA »', async () => {
    function Probe() {
      return <span data-testid="editor-name">{useEditorAction('c1')?.name ?? ''}</span>
    }
    render(<Probe />)
    await waitFor(() =>
      expect(screen.getByTestId('editor-name').textContent).toBe('Visual Studio Code')
    )
    act(() => {
      for (const listener of listeners) {
        listener({ preferences: { editor: 'idea' } } as unknown as AgentSettingsView)
      }
    })
    expect(screen.getByTestId('editor-name').textContent).toBe('IntelliJ IDEA')
  })
})
