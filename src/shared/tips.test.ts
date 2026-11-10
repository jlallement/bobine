import { describe, expect, it } from 'vitest'
import {
  applyTipAction,
  EMPTY_TIPS,
  localDay,
  MAX_SENT,
  mayShowTip,
  normalizeMessage,
  noteSentMessage,
  parseTipsState
} from './tips'

describe('astuces de Bobine (fiche 191)', () => {
  const today = '2026-11-07'
  it('au plus une par jour, toutes confondues', () => {
    expect(mayShowTip(EMPTY_TIPS, 'aside', today)).toBe(true)
    const shown = applyTipAction(EMPTY_TIPS, 'aside', 'shown', today)
    expect(mayShowTip(shown, 'aside', today)).toBe(false)
    expect(mayShowTip(shown, 'context', today)).toBe(false)
    // Fermée par × : elle peut revenir un autre jour.
    expect(mayShowTip(shown, 'aside', '2026-11-08')).toBe(true)
  })

  it('« Ne plus montrer » ou fonction utilisée : jamais plus', () => {
    const never = applyTipAction(EMPTY_TIPS, 'aside', 'never', today)
    const used = applyTipAction(never, 'review', 'used', today)
    expect(used.hidden).toEqual(['aside', 'review'])
    expect(mayShowTip(used, 'aside', '2030-01-01')).toBe(false)
    expect(applyTipAction(used, 'aside', 'used', today)).toBe(used)
  })

  it('état du disque validé ; jour local', () => {
    expect(
      parseTipsState({ hidden: ['aside', 'nope', 'aside', 3], lastShownDay: '2026-11-07' })
    ).toEqual({
      hidden: ['aside'],
      lastShownDay: '2026-11-07'
    })
    expect(parseTipsState('x')).toEqual({ hidden: [] })
    expect(parseTipsState({ lastShownDay: 'hier' })).toEqual({ hidden: [] })
    expect(localDay(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })
})

describe('message répété → « Planifier… » (fiche 191)', () => {
  it('texte comparable : casse, ponctuation, espaces ; ni commande ni message court', () => {
    expect(normalizeMessage('  Fais le point sur les PR ouvertes !  ')).toBe(
      'fais le point sur les pr ouvertes'
    )
    expect(normalizeMessage('fais le point, sur les PR ouvertes')).toBe(
      normalizeMessage('Fais le point sur les PR ouvertes.')
    )
    expect(normalizeMessage('/compact maintenant svp')).toBeUndefined()
    expect(normalizeMessage('continue')).toBeUndefined()
  })

  it('troisième jour différent, une fois ce jour-là ; même jour : rien de plus', () => {
    let state = EMPTY_TIPS
    const note = (day: string) => {
      const r = noteSentMessage(state, 'a'.repeat(32), day)
      state = r.state
      return r.repeated
    }
    expect(note('2026-11-05')).toBe(false)
    expect(note('2026-11-05')).toBe(false)
    expect(note('2026-11-06')).toBe(false)
    expect(note('2026-11-07')).toBe(true)
    expect(note('2026-11-07')).toBe(false)
    expect(state.sent?.[0]?.days).toEqual(['2026-11-05', '2026-11-06', '2026-11-07'])
  })

  it('empreintes bornées et validées à la relecture', () => {
    let state = EMPTY_TIPS
    for (let i = 0; i < MAX_SENT + 5; i++) {
      state = noteSentMessage(state, i.toString(16).padStart(32, '0'), '2026-11-07').state
    }
    expect(state.sent).toHaveLength(MAX_SENT)
    expect(
      parseTipsState({
        hidden: [],
        sent: [
          { key: 'f'.repeat(32), days: ['2026-11-07', 'x'] },
          { key: 'pas une empreinte', days: ['2026-11-07'] },
          { key: 'e'.repeat(32), days: [] }
        ]
      }).sent
    ).toEqual([{ key: 'f'.repeat(32), days: ['2026-11-07'] }])
  })
})

describe('état relu du disque, piégé (fiche 191)', () => {
  it('trop d’empreintes, jours en double, clés et prototypes douteux', () => {
    const many = Array.from({ length: MAX_SENT + 50 }, (_, i) => ({
      key: i.toString(16).padStart(32, '0'),
      days: ['2026-11-05', '2026-11-05', '2026-11-06']
    }))
    const parsed = parseTipsState(
      JSON.parse(
        JSON.stringify({
          hidden: ['aside', 'aside', '__proto__', 'constructor'],
          sent: many,
          salt: 'pas une clé',
          firstDay: '2026-11-05'
        }).replace('"hidden"', '"__proto__":{"polluted":true},"hidden"')
      )
    )
    expect(parsed.hidden).toEqual(['aside'])
    expect(parsed.sent).toHaveLength(MAX_SENT)
    expect(parsed.sent?.[0]?.days).toEqual(['2026-11-05', '2026-11-06'])
    expect(parsed).not.toHaveProperty('salt')
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined()
    expect(Object.keys(parsed).sort()).toEqual(['firstDay', 'hidden', 'sent'])
  })
})
