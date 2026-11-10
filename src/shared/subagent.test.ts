import { describe, expect, it } from 'vitest'
import {
  formatDuration,
  subagentMarkOf,
  subagentResult,
  SUBAGENT_META,
  withSubagentMark
} from './subagent'

describe('marque générique d’un sous-agent (fiche 140)', () => {
  it('posée puis relue, sans toucher aux autres _meta', () => {
    const marked = withSubagentMark(
      { toolCallId: 't', _meta: { autre: 1 } },
      { subagent: { task: 'Lire' }, sessionId: 'ses_1' }
    )
    expect(marked._meta).toEqual({
      autre: 1,
      [SUBAGENT_META]: { subagent: { task: 'Lire' }, sessionId: 'ses_1' }
    })
    expect(subagentMarkOf(marked)).toEqual({ subagent: { task: 'Lire' }, sessionId: 'ses_1' })
    expect(subagentMarkOf({})).toBeUndefined()
    expect(subagentMarkOf({ _meta: null })).toBeUndefined()
  })
})

describe('réponse d’un sous-agent (règle générique)', () => {
  it('résultat sans balises (Bob, OpenCode), texte libre inchangé', () => {
    expect(subagentResult('<task_result>\nLe chat s’appelle Gribouille.\n</task_result>')).toBe(
      'Le chat s’appelle Gribouille.'
    )
    expect(
      subagentResult(
        '<task id="ses_1" state="completed">\n<task_result>\n**Résumé** : ok\n</task_result>\n</task>'
      )
    ).toBe('**Résumé** : ok')
    expect(subagentResult('  texte libre ')).toBe('texte libre')
    // OpenCode 2.0.31.
    expect(
      subagentResult(
        '<subagent sessionID="ses_eba5677c9ffeoRTtzuEDTgikp7" state="completed">\nLe mot de code est **ORNITHORYNQUE**.\n</subagent>'
      )
    ).toBe('Le mot de code est **ORNITHORYNQUE**.')
  })

  it('balise qui n’enveloppe pas tout : texte gardé', () => {
    expect(subagentResult('Voir <b>ceci</b> et cela')).toBe('Voir <b>ceci</b> et cela')
    expect(subagentResult('<a>x</a> <b>y</b>')).toBe('<a>x</a> <b>y</b>')
  })
})

describe('durée d’un sous-agent', () => {
  it('secondes, minutes, heures', () => {
    expect(formatDuration(8_400)).toBe('8 s')
    expect(formatDuration(65_000)).toBe('1 min 05 s')
    expect(formatDuration(3_720_000)).toBe('1 h 02 min')
    expect(formatDuration(400)).toBe('< 1 s')
    expect(formatDuration(-5)).toBe('< 1 s')
  })
})
