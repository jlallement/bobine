import * as Tooltip from '@radix-ui/react-tooltip'
import { fireEvent, render, screen } from '@testing-library/react'
import { t } from 'i18next'
import { beforeAll, describe, expect, it } from 'vitest'
import { AttachButton } from './AttachButton'

beforeAll(() => {
  // Le positionnement des menus (Radix) suit la taille de leur contenu ; jsdom ne la mesure pas.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
})

const show = (capture: boolean, folded = true) =>
  render(
    <Tooltip.Provider>
      <AttachButton
        folded={folded}
        disabled={false}
        onPickFiles={() => {}}
        onCaptureScreen={capture ? () => {} : undefined}
        extra={<span data-testid="extra">{t('sessionSettings.label')}</span>}
      />
    </Tooltip.Provider>
  )

describe('📎 de la barre de saisie (fiches 092, 145, 276)', () => {
  it('sans capture d’écran : bouton simple « Joindre des fichiers… », même replié, rien n’y est replié', () => {
    show(false)
    const attach = screen.getByTestId('attach')
    expect(attach.getAttribute('aria-haspopup')).toBeNull()
    expect(attach.getAttribute('aria-label')).toBe(t('composer.attach.label'))
  })

  it('avec capture d’écran, replié : un menu', () => {
    show(true)
    expect(screen.getByTestId('attach').getAttribute('aria-haspopup')).toBe('menu')
  })

  it('avec capture d’écran, déplié : bouton simple', () => {
    show(true, false)
    expect(screen.getByTestId('attach').getAttribute('aria-haspopup')).toBeNull()
  })

  // Remplace `e2e/suites/composer.mjs` n° 21 : le menu de 📎 replié contient les deux entrées.
  it('replié : « Joindre des fichiers… » et « Capturer une zone » dans le menu de 📎', () => {
    show(true)
    fireEvent.keyDown(screen.getByTestId('attach'), { key: 'Enter' })
    expect(screen.getByTestId('attach-files').textContent).toBe(t('composer.attach.files'))
    expect(screen.getByTestId('attach-capture').textContent).toBe(t('composer.capture.item'))
  })

  // Remplace `e2e/suites/composer.mjs` n° 26 : au dernier niveau, les réglages de la session sont
  // sous 📎, après un trait.
  it('replié avec les réglages : « Réglages de la session » sous un trait, dans le menu de 📎', () => {
    show(true)
    fireEvent.keyDown(screen.getByTestId('attach'), { key: 'Enter' })
    const menu = screen.getByTestId('attach-menu-content')
    const extra = screen.getByTestId('extra')
    expect(menu.contains(extra)).toBe(true)
    expect(extra.textContent).toBe(t('sessionSettings.label'))
    expect(menu.querySelector('.menu-separator')).toBeTruthy()
  })
})
