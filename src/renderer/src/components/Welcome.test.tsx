import { fireEvent, render, screen } from '@testing-library/react'
import i18next from 'i18next'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Welcome } from './Welcome'
import type { OnboardingController } from './onboarding/useOnboarding'

/**
 * Page d'accueil d'une conversation vide (fiches 088, 188) : remplace les vérifications de
 * composant de `e2e/suites/base.mjs` (n° 1, 2, 4) et `onboarding.mjs` (n° 10, 11, 12). L'astuce
 * tirée du profil est lue au main (`agent-host.test.ts`) ; la commande de tests, par
 * `trial-folder.test.ts`.
 */

const api = window.api as unknown as Record<string, unknown>
afterEach(() => {
  delete api.help
})

function setup(options: { testCommand?: string; welcomeHint?: string; discussion?: boolean } = {}) {
  const open = vi.fn()
  api.help = { open }
  const fill = vi.fn()
  const onboarding = {
    visible: false,
    hints: options.testCommand ? { testCommand: options.testCommand } : null,
    clearHints: () => {}
  } as unknown as OnboardingController
  render(
    <Welcome
      userName=""
      asideCard={null}
      composer={<textarea data-testid="composer-input" />}
      welcomeHint={options.welcomeHint}
      fill={fill}
      onboarding={onboarding}
      configure={() => undefined}
      workspace="/tmp/projet"
      onShowTerminal={() => {}}
      {...(options.discussion ? { discussion: true } : {})}
    />
  )
  return { fill, open }
}

describe('accueil d’une conversation vide', () => {
  it('accueil affiché : salutation, puis la saisie, puis les suggestions (base n° 1)', () => {
    setup()
    const welcome = screen.getByTestId('welcome')
    const input = screen.getByTestId('composer-input')
    const suggestions = screen.getByTestId('suggestions')
    expect(welcome.contains(input)).toBe(true)
    const greeting = welcome.querySelector('h1.greeting')
    if (!greeting) throw new Error('salutation absente')
    // Dans l'ordre du document : salutation, saisie, suggestions (la mise au centre reste au CSS).
    expect(greeting.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(
      input.compareDocumentPosition(suggestions) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(screen.getAllByTestId('suggestion')).toHaveLength(4)
  })

  it('la bobine est dans la salutation, animée à l’arrivée (base n° 2)', () => {
    setup()
    const greeting = screen.getByTestId('welcome').querySelector('h1.greeting')
    const spool = screen.getByTestId('spool-mark')
    expect(greeting?.contains(spool)).toBe(true)
    expect(spool.getAttribute('data-motion')).toBe('intro')
  })

  it('astuce d’accueil du profil affichée sous les suggestions (base n° 4)', () => {
    setup({ welcomeHint: 'Tapez `/scenario demo` pour essayer.' })
    const hint = screen.getByTestId('welcome').querySelector('.welcome-hint')
    expect(hint?.textContent).toBe('Tapez /scenario demo pour essayer.')
    expect(hint?.querySelector('code')?.textContent).toBe('/scenario demo')
  })

  it('sans astuce : pas de ligne vide', () => {
    setup()
    expect(screen.getByTestId('welcome').querySelector('.welcome-hint')).toBeNull()
  })

  it('première conversation : « Lance les tests (pnpm test) » à la place de la suggestion générique (onboarding n° 10)', () => {
    const { fill } = setup({ testCommand: 'pnpm test' })
    const run = screen.getByTestId('suggestion-run-tests')
    expect(run.textContent).toBe('Lance les tests (pnpm test)')
    expect(screen.getAllByTestId('suggestion')).toHaveLength(3)
    fireEvent.click(run)
    expect(fill).toHaveBeenCalledWith(
      i18next.t('onboarding.home.runTestsText', { command: 'pnpm test' })
    )
  })

  it('première conversation : liens vers « Premiers pas » et « Autorisations » de l’aide (onboarding n° 11)', () => {
    const { open } = setup({ testCommand: 'pnpm test' })
    const help = screen.getByTestId('welcome-help')
    const [first, second] = help.querySelectorAll('button')
    if (!first || !second) throw new Error('liens absents')
    expect(first.textContent?.trim()).toBe('Premiers pas')
    expect(second.textContent?.trim()).toBe('Autorisations')
    fireEvent.click(first)
    fireEvent.click(second)
    expect(open.mock.calls).toEqual([['gettingStarted'], ['permissions']])
  })

  it('conversation ordinaire : pas de liens vers l’aide', () => {
    setup()
    expect(screen.queryByTestId('welcome-help')).toBeNull()
  })

  it('une suggestion remplit la saisie, sans rien envoyer (onboarding n° 12)', () => {
    const { fill } = setup()
    const [first] = screen.getAllByTestId('suggestion')
    if (!first) throw new Error('aucune suggestion')
    fireEvent.click(first)
    expect(fill).toHaveBeenCalledTimes(1)
    expect(fill).toHaveBeenCalledWith(i18next.t('home.suggestions.explain.text'))
  })
})
