import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { t } from 'i18next'
import { CommandText } from './CommandText'

describe('commande citée par un message de l’app (fiche 194)', () => {
  it('git introuvable : la commande en code, avec « Copier »', () => {
    const { container } = render(<CommandText text={t('git.missing')} />)
    expect(container.querySelector('code')?.textContent).toBe('xcode-select --install')
    expect(screen.getByTestId('copy-command')).toBeTruthy()
    expect(container.textContent).not.toContain('`')
  })

  it('sans commande, ou accent grave orphelin : texte tel quel', () => {
    expect(render(<CommandText text="git a échoué" />).container.textContent).toBe('git a échoué')
    const orphan = render(<CommandText text="un ` seul" />).container
    expect(orphan.textContent).toBe('un ` seul')
    expect(orphan.querySelector('code')).toBeNull()
  })
})
