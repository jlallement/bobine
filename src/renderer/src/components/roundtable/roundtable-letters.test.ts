/**
 * Lettres de la synthèse (fiche 285, décision D1) : « Participant C » marqué pour montrer le vrai
 * nom, hors code ; une lettre inconnue reste du texte.
 */
import { describe, expect, it } from 'vitest'
import { rehypeRoundtableLetters, splitLetters } from './roundtable-letters'

const names = { A: 'DeepSeek V4.1 Flash · Agent A', C: 'Agent B' }
const all = { A: 'Alpha', B: 'Beta', C: 'Gamma' }

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
    expect(splitLetters('', names)).toEqual([])
  })

  it('formes groupées, en français et en anglais (recette, S3)', () => {
    const letter = (text: string, l: string) => ({ text, letter: l })
    expect(splitLetters('Participants A et B divergent.', all)).toEqual([
      letter('Participants A', 'A'),
      ' et ',
      letter('B', 'B'),
      ' divergent.'
    ])
    expect(splitLetters('participants A, B et C', all)).toEqual([
      letter('participants A', 'A'),
      ', ',
      letter('B', 'B'),
      ' et ',
      letter('C', 'C')
    ])
    expect(splitLetters('Participants A and B agree', all)).toEqual([
      letter('Participants A', 'A'),
      ' and ',
      letter('B', 'B'),
      ' agree'
    ])
    // Une lettre inconnue de la table reste du texte ; les autres sont marquées.
    expect(splitLetters('Participants B et C', names)).toEqual([
      'Participants B et ',
      letter('C', 'C')
    ])
  })

  it('une lettre seule, hors de ces formes, reste du texte', () => {
    expect(splitLetters('A et B choisissent pg-boss.', all)).toEqual([
      'A et B choisissent pg-boss.'
    ])
    expect(splitLetters('Plan A, puis B.', all)).toEqual(['Plan A, puis B.'])
    expect(splitLetters('Participant A et la base', all)).toEqual([
      { text: 'Participant A', letter: 'A' },
      ' et la base'
    ])
    expect(splitLetters('Participant A, Bob', all)).toEqual([
      { text: 'Participant A', letter: 'A' },
      ', Bob'
    ])
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
        properties: { dataLetter: 'C', dataFirst: 'true' },
        children: [{ type: 'text', value: 'Participant C' }]
      },
      { type: 'text', value: ', ' },
      { type: 'element', tagName: 'code', children: [{ type: 'text', value: 'Participant A' }] }
    ])
  })
})
