import { describe, expect, it } from 'vitest'
import { gitError } from './git-errors'

describe('erreurs de git montrées en entier (fiche 123)', () => {
  it('fast-forward refusé : les lignes error: et les fichiers, sans « Aborting »', () => {
    const stderr = [
      'error: Your local changes to the following files would be overwritten by merge:',
      '\tpublic/index.html',
      '\tpublic/style.css',
      'Please commit your changes or stash them before you merge.',
      'Aborting',
      ''
    ].join('\n')
    expect(gitError(stderr)).toBe(
      [
        'error: Your local changes to the following files would be overwritten by merge:',
        '  public/index.html',
        '  public/style.css',
        'Please commit your changes or stash them before you merge.'
      ].join('\n')
    )
  })

  it('fatal: et hint: : la ligne fatal gardée, les conseils retirés', () => {
    const stderr = [
      'hint: Diverging branches can be reconciled by…',
      'fatal: Not possible to fast-forward, aborting.'
    ].join('\n')
    expect(gitError(stderr)).toBe('fatal: Not possible to fast-forward, aborting.')
  })

  it('plusieurs erreurs : toutes, dans l’ordre', () => {
    expect(gitError('warning: x\nerror: a\nerror: b\n')).toBe('error: a\nerror: b')
  })

  it('sans error:/fatal: : la dernière ligne utile, jamais le seul « Aborting »', () => {
    expect(gitError('Updating 1234..5678\nsomething went wrong\nAborting\n')).toBe(
      'something went wrong'
    )
    expect(gitError('Aborting\n')).toBe('')
    expect(gitError('')).toBe('')
  })
})
