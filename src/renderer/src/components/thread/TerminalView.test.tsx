import { render, screen } from '@testing-library/react'
import i18next from 'i18next'
import { describe, expect, it } from 'vitest'
import { TerminalView } from './TerminalView'

/**
 * Sortie d'une commande de l'agent (extension terminal ACP) : remplace les vérifications de
 * composant de `e2e/suites/command-output.mjs` (n° 2, 5). L'assemblage des morceaux reste à
 * `terminal-output.test.ts` ; les couleurs de la palette, à la capture.
 */
describe('sortie d’une commande', () => {
  it('commande finie : la sortie, couleurs ANSI rendues, puis « code 0 » (command-output n° 2)', () => {
    render(
      <TerminalView
        terminal={{ output: '\u001b[32mok\u001b[0m fini\n', exited: true, exitCode: 0 }}
      />
    )
    expect(screen.getByTestId('terminal').querySelector('.ansi-green')?.textContent).toBe('ok')
    const exit = screen.getByTestId('terminal-exit')
    expect(exit.textContent).toBe(i18next.t('terminalView.exitCode', { code: 0 }))
    expect(exit.classList.contains('failed')).toBe(false)
  })

  it('commande en échec : « code 2 », signalée en échec (command-output n° 5)', () => {
    render(<TerminalView terminal={{ output: 'erreur\n', exited: true, exitCode: 2 }} />)
    const exit = screen.getByTestId('terminal-exit')
    expect(exit.textContent).toBe(i18next.t('terminalView.exitCode', { code: 2 }))
    expect(exit.classList.contains('failed')).toBe(true)
  })

  it('en cours : pas de code de sortie ; sans sortie encore, « en cours » le dit', () => {
    render(<TerminalView terminal={{ output: '' }} />)
    expect(screen.queryByTestId('terminal-exit')).toBeNull()
    expect(screen.getByTestId('terminal').textContent).toBe(i18next.t('terminalView.running'))
  })
})
