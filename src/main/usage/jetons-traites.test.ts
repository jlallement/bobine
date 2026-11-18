import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { costReport } from '@shared/app-commands'
import { endTurn, formatEstimate, type ConversationUsage } from '@shared/usage'
import { MOTHER_TURN } from '../../mock-agent/scenarios-consommation.mts'
import { tokensOf } from './journal'
import { usageStats } from './stats'
import type { TurnRow } from './usage-db'

/**
 * Fiche 245 (recette du 2026-11-17, D6 et D8) : un tour réel d'OpenCode 2.3.0 — entrée hors
 * cache, 96 384 jetons relus en cache, 447 de réflexion, `totalTokens` 131 886, coût annoncé de
 * 0,007455 $ malgré l'abonnement ChatGPT.
 */

const plain = (text: string) => text.replace(/[  ]/g, ' ')

/** La conversation après ce tour : coût cumulé de `usage_update`, jetons de la réponse. */
const usage: ConversationUsage = endTurn(
  { cost: { amount: MOTHER_TURN.cost, currency: 'USD' } },
  MOTHER_TURN.usage
)

const row: TurnRow = {
  id: 'mere:1',
  conversationId: 'mere',
  startedAt: new Date(2026, 10, 17, 20).getTime(),
  endedAt: new Date(2026, 10, 17, 20, 2).getTime(),
  profileId: 'opencode',
  profileLabel: 'OpenCode',
  tokens: tokensOf(MOTHER_TURN.usage),
  cost: { amount: MOTHER_TURN.cost, currency: 'USD' },
  tools: {},
  subagents: 0
}

describe('jetons traités : le même nombre partout (fiche 245, D6)', () => {
  it('/cost compte l’entrée et la sortie, et dit à part le cache et la réflexion', () => {
    const lines = plain(costReport(usage, 'OpenCode')).split('\n')
    expect(lines[0]).toBe(
      'Jetons traités : 35 055 sur 1 échange (28 149 en entrée, 6 906 en sortie)'
    )
    expect(lines[1]).toBe('En plus : 96 384 relus en cache, 447 de réflexion.')
  })

  it('Mon activité donne le même nombre que /cost pour le même tour', () => {
    const { totals } = usageStats(
      [row],
      [{ profileId: 'opencode', profileLabel: 'OpenCode' }],
      { scope: 'day', date: '2026-11-17' },
      { now: new Date(2026, 10, 18), agentSlot: () => 0, title: () => undefined }
    )
    expect(totals.input + totals.output).toBe(35_055)
    expect(totals.cachedRead).toBe(96_384)
    expect(plain(costReport(usage, 'OpenCode'))).toContain(
      `${plain(new Intl.NumberFormat('fr').format(totals.input + totals.output))} sur`
    )
  })
})

describe('coût estimé (fiche 245, D8)', () => {
  it('coût en dollars annoncé par l’agent : « ≈ » et « estimation » dans /cost', () => {
    const lines = plain(costReport(usage, 'OpenCode')).split('\n')
    expect(lines[2]).toBe('Coût : ≈ 0,0075 $US (estimation annoncée par OpenCode)')
  })

  it('coût nul d’une fille : estimé lui aussi', () => {
    expect(plain(formatEstimate({ amount: 0, currency: 'USD' }))).toBe('≈ 0,00 $US')
  })

  it('bobcoins de Bob : son propre décompte, sans « ≈ »', () => {
    expect(plain(formatEstimate({ amount: 0.0632, currency: 'bobcoins' }))).toBe('0,0632 Bobcoins')
  })
})

describe('aucun coût affiché sans sa marque d’estimation (fiche 245, D8)', () => {
  it('les composants affichent un coût par `formatEstimate`, jamais `formatCost` nu', () => {
    // `formatCost` nu reste aux plafonds (montants choisis par l'utilisateur, `cost-cap.ts`).
    const root = join(__dirname, '../../renderer/src/components')
    const offenders = readdirSync(root, { recursive: true, encoding: 'utf8' })
      .filter((file) => file.endsWith('.tsx') && !file.includes('.test.'))
      .filter((file) => /\bformatCost\(/.test(readFileSync(join(root, file), 'utf8')))
    expect(offenders).toEqual([])
  })
})
