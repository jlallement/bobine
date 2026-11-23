import * as Tooltip from '@radix-ui/react-tooltip'
import { render, screen } from '@testing-library/react'
import { t } from 'i18next'
import { describe, expect, it } from 'vitest'
import { AttachButton } from './AttachButton'

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
})
