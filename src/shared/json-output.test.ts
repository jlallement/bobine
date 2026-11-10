import { describe, expect, it } from 'vitest'
import { prettyJsonOutput } from './json-output'

describe('prettyJsonOutput (fiche 128, D6)', () => {
  it('indente un objet JSON, avec de vrais retours à la ligne dans les chaînes', () => {
    const raw = JSON.stringify([
      { status: 'fulfilled', value: 'ligne 1\nligne 2' },
      { status: 'rejected', reason: 'dit "non"\tici' }
    ])
    expect(prettyJsonOutput(raw)).toBe(
      [
        '[',
        '  {',
        '    "status": "fulfilled",',
        '    "value": "ligne 1',
        'ligne 2"',
        '  },',
        '  {',
        '    "status": "rejected",',
        '    "reason": "dit \\"non\\"\tici"',
        '  }',
        ']'
      ].join('\n')
    )
  })

  it('garde un antislash suivi de n tel quel, et les valeurs simples', () => {
    expect(prettyJsonOutput('{"path":"C:\\\\new","n":1,"ok":true,"none":null,"a":[],"o":{}}')).toBe(
      [
        '{',
        '  "path": "C:\\\\new",',
        '  "n": 1,',
        '  "ok": true,',
        '  "none": null,',
        '  "a": [],',
        '  "o": {}',
        '}'
      ].join('\n')
    )
  })

  it('rien pour un texte ordinaire, un JSON invalide ou une valeur simple', () => {
    expect(prettyJsonOutput('Tests : 2 réussis')).toBeUndefined()
    expect(prettyJsonOutput('{"a": ')).toBeUndefined()
    expect(prettyJsonOutput('[1, 2')).toBeUndefined()
    expect(prettyJsonOutput('"seule"')).toBeUndefined()
    expect(prettyJsonOutput('42')).toBeUndefined()
    expect(prettyJsonOutput('')).toBeUndefined()
  })
})
