import * as Tooltip from '@radix-ui/react-tooltip'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { SessionControl } from '@shared/agent'
import { t } from 'i18next'
import { ComposerFocus } from './Menus'
import { ModelChip, modelOptions, modelProvider, shortModelName } from './ModelMenu'

beforeAll(() => {
  // Le positionnement des menus (Radix) suit la taille de leur contenu ; jsdom ne la mesure pas.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
})

const model: SessionControl = {
  id: 'model',
  name: 'Model',
  category: 'model',
  type: 'select',
  currentValue: 'openai/gpt-6.1-sol',
  options: [
    { value: 'openai/gpt-5.5', name: 'openai/GPT-5.5', group: 'OpenAI' },
    { value: 'openai/gpt-6.1-sol', name: 'openai/GPT-6.1 Sol', group: 'OpenAI' }
  ]
}

/** Liste façon OpenCode : une quarantaine de modèles, sans groupes. */
const NAMES = [
  'opencode/Big Pickle',
  'opencode/Beam Free',
  ...['5.5', '5.6 Luna', '5.6 Sol', '6 Astra', '6 Luna', '6 Sol', '6.1 Sol'].flatMap((v) => [
    `openai/GPT-${v}`,
    `openai/GPT-${v} Fast`
  ]),
  'ollama/ministral-3:8b'
]
const long: SessionControl = {
  id: 'model',
  name: 'Modèle',
  category: 'model',
  type: 'select',
  currentValue: 'openai/GPT-6.1 Sol',
  options: NAMES.map((name) => ({ value: name, name }))
}

function open(control: SessionControl) {
  const onSetControl = vi.fn()
  render(
    <Tooltip.Provider>
      <ModelChip control={control} disabled={false} onSetControl={onSetControl} />
    </Tooltip.Provider>
  )
  fireEvent.click(screen.getByTestId('model-chip'))
  const menu = screen.getByTestId('model-menu-content')
  const highlighted = () => menu.querySelector('[data-highlighted]')?.getAttribute('data-testid')
  return { onSetControl, menu, highlighted }
}

describe('puce du modèle (fiches 090, 092)', () => {
  it('nom court : ce qui suit le dernier « / » ; fournisseur : ce qui précède', () => {
    expect(shortModelName('openai/GPT-6.1 Sol')).toBe('GPT-6.1 Sol')
    expect(shortModelName('ollama/ministral-3:8b')).toBe('ministral-3:8b')
    expect(shortModelName('Factice rapide')).toBe('Factice rapide')
    expect(shortModelName('fin/')).toBe('fin/')
    expect(modelProvider('openai/GPT-6.1 Sol')).toBe('openai')
    expect(modelProvider('a/b/Modèle')).toBe('a/b')
    expect(modelProvider('Factice rapide')).toBeUndefined()
    expect(modelProvider('fin/')).toBeUndefined()
  })

  it('filtre sans casse ni accents, sur le nom et le groupe, groupes dans leur ordre', () => {
    const grouped: SessionControl = {
      ...model,
      options: [
        { value: 'a', name: 'Factice précis', group: 'Précis' },
        { value: 'b', name: 'Factice rapide', group: 'Rapides' },
        { value: 'c', name: 'Autre précis', group: 'Précis' }
      ]
    }
    expect(modelOptions(grouped, '').map((o) => o.value)).toEqual(['a', 'c', 'b'])
    expect(modelOptions(grouped, 'PRECIS').map((o) => o.value)).toEqual(['a', 'c'])
    expect(modelOptions(grouped, ' rapides ').map((o) => o.value)).toEqual(['b'])
    expect(modelOptions(long, 'sol fast').map((o) => o.value)).toEqual([
      'openai/GPT-5.6 Sol Fast',
      'openai/GPT-6 Sol Fast',
      'openai/GPT-6.1 Sol Fast'
    ])
  })

  it('filtre aussi sur l’identifiant du modèle (recette 0.9, D11)', () => {
    const ids: SessionControl = {
      ...model,
      options: [
        { value: 'openai/gpt-6.1-sol', name: 'openai/GPT-6.1 Sol' },
        { value: 'openai/gpt-6.1-sol-fast', name: 'openai/GPT-6.1 Sol Fast' },
        { value: 'opencode/big-pickle', name: 'opencode/Big Pickle' }
      ]
    }
    expect(modelOptions(ids, 'gpt-6.1-sol').map((o) => o.value)).toEqual([
      'openai/gpt-6.1-sol',
      'openai/gpt-6.1-sol-fast'
    ])
    expect(modelOptions(ids, 'big-pickle').map((o) => o.value)).toEqual(['opencode/big-pickle'])
  })

  it('la puce montre le nom court', () => {
    render(
      <Tooltip.Provider>
        <ModelChip control={model} disabled={false} onSetControl={() => {}} />
      </Tooltip.Provider>
    )
    expect(screen.getByTestId('model-chip').textContent).toBe('GPT-6.1 Sol')
  })

  it('courte liste : pas de recherche, ouverte sur le modèle en cours, groupes affichés', () => {
    const { menu, highlighted, onSetControl } = open(model)
    expect(screen.queryByTestId('model-search')).toBeNull()
    expect(menu.textContent).toContain('OpenAI')
    const current = screen.getByTestId('control-model-openai/gpt-6.1-sol')
    expect(current.getAttribute('aria-selected')).toBe('true')
    expect(current.querySelector('.menu-title')?.textContent).toBe('GPT-6.1 Sol')
    expect(current.querySelector('.model-provider')?.textContent).toBe('openai')
    expect(highlighted()).toBe('control-model-openai/gpt-6.1-sol')
    // Au clavier depuis la liste : ↑ puis Entrée.
    const list = screen.getByRole('listbox')
    expect(document.activeElement).toBe(list)
    fireEvent.keyDown(list, { key: 'ArrowUp' })
    fireEvent.keyDown(list, { key: 'Enter' })
    expect(onSetControl).toHaveBeenCalledWith('model', 'openai/gpt-5.5')
  })

  it('longue liste : recherche focalisée, filtre, ↑ ↓ Entrée', () => {
    const { highlighted, onSetControl } = open(long)
    const search = screen.getByTestId('model-search')
    expect(document.activeElement).toBe(search)
    expect(highlighted()).toBe('control-model-openai/GPT-6.1 Sol')
    fireEvent.change(search, { target: { value: 'SOL' } })
    expect(screen.getAllByRole('option').map((o) => o.getAttribute('title'))).toEqual([
      'openai/GPT-5.6 Sol',
      'openai/GPT-5.6 Sol Fast',
      'openai/GPT-6 Sol',
      'openai/GPT-6 Sol Fast',
      'openai/GPT-6.1 Sol',
      'openai/GPT-6.1 Sol Fast'
    ])
    expect(highlighted()).toBe('control-model-openai/GPT-5.6 Sol')
    fireEvent.keyDown(search, { key: 'ArrowDown' })
    fireEvent.keyDown(search, { key: 'ArrowDown' })
    fireEvent.keyDown(search, { key: 'ArrowUp' })
    fireEvent.keyDown(search, { key: 'Enter' })
    expect(onSetControl).toHaveBeenCalledWith('model', 'openai/GPT-5.6 Sol Fast')
  })

  it('longue liste : rien de trouvé, puis retour sur le modèle en cours', () => {
    const { highlighted, onSetControl } = open(long)
    const search = screen.getByTestId('model-search')
    fireEvent.change(search, { target: { value: 'claude' } })
    expect(screen.getByTestId('model-none')).toBeTruthy()
    fireEvent.keyDown(search, { key: 'Enter' })
    expect(onSetControl).not.toHaveBeenCalled()
    fireEvent.change(search, { target: { value: '' } })
    expect(highlighted()).toBe('control-model-openai/GPT-6.1 Sol')
  })

  it('un clic sur le modèle en cours ferme la liste sans rien régler', () => {
    const { onSetControl } = open(long)
    fireEvent.click(screen.getByTestId('control-model-openai/GPT-6.1 Sol'))
    expect(onSetControl).not.toHaveBeenCalled()
    expect(screen.queryByTestId('model-menu-content')).toBeNull()
  })
})

/**
 * Remplaçants des vérifications de composant de `e2e/suites/composer.mjs` (n° 13, 15) et
 * `connexion-expiree.mjs` (n° 22).
 */
describe('puce du modèle — remplaçants des e2e', () => {
  it('longue liste ouverte : le modèle en cours amené au milieu de la partie visible (composer n° 13)', () => {
    // jsdom ne met rien en page : des lignes de 30 px dans une liste de 300 px.
    const proto = HTMLElement.prototype
    const saved = {
      offsetTop: Object.getOwnPropertyDescriptor(proto, 'offsetTop'),
      offsetHeight: Object.getOwnPropertyDescriptor(proto, 'offsetHeight'),
      clientHeight: Object.getOwnPropertyDescriptor(Element.prototype, 'clientHeight')
    }
    Object.defineProperty(proto, 'offsetTop', {
      configurable: true,
      get(this: HTMLElement) {
        return Number(this.dataset.index ?? 0) * 30
      }
    })
    Object.defineProperty(proto, 'offsetHeight', { configurable: true, get: () => 30 })
    Object.defineProperty(Element.prototype, 'clientHeight', { configurable: true, get: () => 300 })
    try {
      const { highlighted } = open(long)
      const index = NAMES.indexOf('openai/GPT-6.1 Sol')
      expect(highlighted()).toBe('control-model-openai/GPT-6.1 Sol')
      const list = screen.getByRole('listbox')
      expect(list.scrollTop).toBe(index * 30 - (300 - 30) / 2)
    } finally {
      for (const [name, descriptor] of Object.entries(saved)) {
        const target = name === 'clientHeight' ? Element.prototype : proto
        if (descriptor) Object.defineProperty(target, name, descriptor)
      }
    }
  })

  it('choix au clavier dans la zone de saisie : modèle réglé, focus rendu à la saisie (composer n° 15)', async () => {
    const onSetControl = vi.fn()
    const focusInput = vi.fn(() => document.getElementById('saisie')?.focus())
    render(
      <Tooltip.Provider>
        <div className="composer-dock">
          <textarea id="saisie" />
          <ComposerFocus.Provider value={focusInput}>
            <ModelChip control={long} disabled={false} onSetControl={onSetControl} />
          </ComposerFocus.Provider>
        </div>
      </Tooltip.Provider>
    )
    fireEvent.click(screen.getByTestId('model-chip'))
    const search = screen.getByTestId('model-search')
    fireEvent.change(search, { target: { value: 'luna fast' } })
    fireEvent.keyDown(search, { key: 'ArrowDown' })
    await act(async () => fireEvent.keyDown(search, { key: 'Enter' }))
    expect(onSetControl).toHaveBeenCalledWith('model', 'openai/GPT-6 Luna Fast')
    expect(screen.queryByTestId('model-menu-content')).toBeNull()
    // Radix rend le focus au tour suivant (FocusScope) : la saisie, pas la puce.
    await waitFor(() => expect(focusInput).toHaveBeenCalled())
    expect(document.activeElement?.id).toBe('saisie')
  })

  it('modèle refusé faute de connexion : marqué dans la liste, toujours choisissable (connexion-expiree n° 22)', () => {
    const refused: SessionControl = {
      ...model,
      options: [
        { value: 'openai/gpt-5.5', name: 'openai/GPT-5.5', group: 'OpenAI', authRequired: true },
        { value: 'openai/gpt-6.1-sol', name: 'openai/GPT-6.1 Sol', group: 'OpenAI' }
      ]
    }
    const { onSetControl } = open(refused)
    const option = screen.getByTestId('control-model-openai/gpt-5.5')
    expect(option.querySelector('[data-testid=model-auth-required]')?.textContent).toBe(
      t('modelMenu.authRequired')
    )
    expect(option.getAttribute('title')).toContain(t('modelMenu.authRequiredTip'))
    expect(
      screen.getByTestId('control-model-openai/gpt-6.1-sol').querySelector('.model-auth-tag')
    ).toBeNull()
    fireEvent.click(option)
    expect(onSetControl).toHaveBeenCalledWith('model', 'openai/gpt-5.5')
  })
})
