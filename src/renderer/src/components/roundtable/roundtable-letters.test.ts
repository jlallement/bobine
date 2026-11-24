/**
 * Lettres de la synthèse (fiche 285, décision D1) : « Participant C » marqué pour montrer le vrai
 * nom, hors code ; une lettre inconnue reste du texte.
 */
import { describe, expect, it } from 'vitest'
import { rehypeRoundtableLetters, splitLetters } from './roundtable-letters'

const names = { A: 'DeepSeek V4.1 Flash · Agent A', C: 'Agent B' }

describe('lettres des participants', () => {
  it('découpe le texte autour des lettres connues', () => {
    expect(
      splitLetters('Rejeté (Participant A) ; voir participant C et Participant D.', names)
    ).toEqual([
      'Rejeté (',
      { text: 'Participant A', letter: 'A' },
      ') ; voir ',
      { text: 'participant C', letter: 'C' },
      ' et Participant D.'
    ])
    expect(splitLetters('Participants A', names)).toEqual(['Participants A'])
    expect(splitLetters('', names)).toEqual([])
  })

  it('greffon : un élément abbr par lettre, rien dans le code ni les liens', () => {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'p',
          children: [
            { type: 'text', value: 'Selon Participant C, ' },
            {
              type: 'element',
              tagName: 'code',
              children: [{ type: 'text', value: 'Participant A' }]
            }
          ]
        }
      ]
    }
    rehypeRoundtableLetters({ names })(tree)
    expect(tree.children[0]?.children).toEqual([
      { type: 'text', value: 'Selon ' },
      {
        type: 'element',
        tagName: 'abbr',
        properties: { dataLetter: 'C' },
        children: [{ type: 'text', value: 'Participant C' }]
      },
      { type: 'text', value: ', ' },
      { type: 'element', tagName: 'code', children: [{ type: 'text', value: 'Participant A' }] }
    ])
  })
})
