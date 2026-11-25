import * as Tooltip from '@radix-ui/react-tooltip'
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AppMenuItem } from '@shared/app-menu'
import { AppMenuButton, useAltAlone } from './AppMenu'

const key = (type: 'keydown' | 'keyup', key: string, init: KeyboardEventInit = {}) =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent(type, { key, ...init }))
  })

describe('Alt seul ouvre le menu ☰ (fiche 145)', () => {
  it('Alt appuyé puis relâché, sans autre touche', () => {
    const onAlt = vi.fn()
    renderHook(() => useAltAlone(onAlt))
    key('keydown', 'Alt', { altKey: true })
    key('keyup', 'Alt')
    expect(onAlt).toHaveBeenCalledTimes(1)
  })

  it('ni Alt+lettre, ni AltGr, ni Ctrl+Alt, ni après une perte du focus (Alt+Tab)', () => {
    const onAlt = vi.fn()
    renderHook(() => useAltAlone(onAlt))
    key('keydown', 'Alt', { altKey: true })
    key('keydown', 'f', { altKey: true })
    key('keyup', 'Alt')
    key('keydown', 'AltGraph')
    key('keyup', 'AltGraph')
    key('keydown', 'Alt', { altKey: true, ctrlKey: true })
    key('keyup', 'Alt')
    key('keydown', 'Alt', { altKey: true })
    act(() => {
      window.dispatchEvent(new Event('blur'))
    })
    key('keyup', 'Alt')
    key('keydown', 'Alt', { altKey: true, isComposing: true })
    key('keyup', 'Alt')
    expect(onAlt).not.toHaveBeenCalled()
  })
})

/**
 * Menu ☰ hors macOS (fiche 145) : remplace les vérifications de composant de l'e2e `settings`
 * (n° 39, 40). Le modèle vient du main (`menu.test.ts`, `app-menu.test.ts`) ; la fenêtre sans
 * barre de menu et les accélérateurs natifs restent à l'e2e Linux.
 */
describe('menu ☰ de Bobine (fiche 145)', () => {
  const MODEL: AppMenuItem[] = [
    {
      kind: 'submenu',
      id: 'file',
      label: 'Fichier',
      items: [
        {
          kind: 'item',
          id: 'new',
          label: 'Nouvelle conversation',
          accelerator: 'CmdOrCtrl+N',
          enabled: true
        }
      ]
    },
    { kind: 'item', id: 'settings', label: 'Réglages…', accelerator: 'CmdOrCtrl+,', enabled: true },
    { kind: 'separator' },
    { kind: 'item', id: 'quit', label: 'Quitter', accelerator: 'CmdOrCtrl+Q', enabled: true }
  ]
  const original = window.api
  afterEach(() => {
    window.api = original
  })
  const show = (menu: () => Promise<AppMenuItem[]> = async () => MODEL) => {
    const menuInvoke = vi.fn(async () => undefined)
    window.api = {
      ...original,
      app: {
        ...original.app,
        features: { ...original.app?.features, commandKey: false },
        menu,
        menuInvoke
      }
    } as unknown as Window['api']
    render(
      <Tooltip.Provider>
        <AppMenuButton />
      </Tooltip.Provider>
    )
    return menuInvoke
  }

  it('ouvert au clavier : rôle `menu`, entrées du main, raccourcis en Ctrl', async () => {
    show()
    const button = screen.getByTestId('app-menu')
    button.focus()
    fireEvent.keyDown(button, { key: 'Enter' })
    const menu = await screen.findByRole('menu')
    expect(menu.textContent).toContain('Fichier')
    expect(menu.textContent).toContain('Réglages…')
    const keys = [...menu.querySelectorAll('.app-menu-keys')].map((k) => k.textContent)
    expect(keys).toEqual(['Ctrl+,', 'Ctrl+Q'])
    expect(keys.join(' ')).not.toContain('⌘')
  })

  it('Échap : menu refermé, focus rendu au bouton ☰', async () => {
    show()
    const button = screen.getByTestId('app-menu')
    button.focus()
    fireEvent.keyDown(button, { key: 'Enter' })
    const menu = await screen.findByRole('menu')
    fireEvent.keyDown(menu, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    expect(document.activeElement).toBe(button)
  })

  // Fiche 250 (e2e `settings` sous Linux) : Radix rend le focus au bouton après coup (minuterie) ;
  // arrivé après la réouverture par Alt, ce focus hors du menu le refermait aussitôt.
  it('Alt aussitôt après Échap : le menu rouvert reste ouvert', async () => {
    show()
    const button = screen.getByTestId('app-menu')
    button.focus()
    fireEvent.keyDown(button, { key: 'Enter' })
    const menu = await screen.findByRole('menu')
    fireEvent.keyDown(menu, { key: 'Escape' })
    key('keydown', 'Alt', { altKey: true })
    key('keyup', 'Alt')
    await screen.findByRole('menu')
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)))
    expect(screen.queryByRole('menu')).not.toBeNull()
  })

  it('Alt pressé deux fois avant la lecture du modèle : menu fermé', async () => {
    let resolve: (model: AppMenuItem[]) => void = () => undefined
    show(() => new Promise((r) => (resolve = r)))
    key('keydown', 'Alt', { altKey: true })
    key('keyup', 'Alt')
    key('keydown', 'Alt', { altKey: true })
    key('keyup', 'Alt')
    await act(async () => resolve(MODEL))
    await act(() => new Promise((r) => setTimeout(r, 20)))
    expect(screen.queryByRole('menu')).toBeNull()
  })
})
