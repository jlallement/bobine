import { describe, expect, it } from 'vitest'
import type { TerminalTabInfo } from '@shared/terminal'
import { terminalText } from './terminal-context'

const tab = (id: string, title: string): TerminalTabInfo => ({ id, title, cwd: '/p', busy: false })

describe('@terminal (fiche 057)', () => {
  it('dernières lignes de l’onglet le plus récent, sans les icônes du thème de l’invite', async () => {
    const read = async (_c: string, id: string, lines: number) =>
      id === 't2' ? ` ~/projet  main   \n❯ npm test\nErreur : 1 test échoue   ` : `${lines}`
    const text = await terminalText(
      { list: () => [tab('t1', 'zsh'), tab('t2', 'npm')], read },
      'c1'
    )
    expect(text).toContain('Terminal « npm »')
    expect(text).toContain('❯ npm test\nErreur : 1 test échoue\n```')
    expect(text).not.toMatch(/[-]/u)
    expect(text).toContain(' ~/projet  main\n')
  })

  it('sans terminal, ou terminal vide : le texte le dit', async () => {
    const read = async () => '   \n'
    expect(await terminalText({ list: () => [], read }, 'c1')).toBe(
      'Aucun terminal n’est ouvert dans cette conversation.'
    )
    expect(await terminalText({ list: () => [tab('t', 'zsh')], read }, 'c1')).toBe(
      'Le terminal « zsh » est vide.'
    )
  })
})
