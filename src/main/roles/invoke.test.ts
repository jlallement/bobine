/**
 * `@rôle` de la saisie (fiche 223, phase 3B) : requête vérifiée, une fille par rôle, agent du rôle
 * repris s'il est disponible, un refus n'empêche pas les autres.
 */
import { describe, expect, it, vi } from 'vitest'
import type { ConversationSummary } from '@shared/agent'
import type { RoleView } from '@shared/roles'
import type { ChildChoices } from '../conversations/children'
import { parseRolesStartRequest, startRoleChildren, type RoleInvokeHost } from './invoke'

const role = (name: string, extra: Partial<RoleView> = {}): RoleView => ({
  name,
  label: name,
  icon: 'bot',
  color: 'blue',
  description: 'd',
  readOnly: false,
  prompt: 'p',
  scope: 'builtin',
  enabled: true,
  ...extra
})

const choices: ChildChoices = {
  profileId: 'mock',
  profiles: [
    { id: 'mock', label: 'Factice', available: true },
    { id: 'autre', label: 'Autre', available: true },
    { id: 'absent', label: 'Absent', available: false }
  ]
}

function host(roles: RoleView[], limit = 10) {
  let count = 0
  const start = vi.fn(async (_mother: string, _request: unknown) => {
    if (count >= limit) throw new Error('Plafond atteint')
    count++
    return { id: `fille-${count}` } as ConversationSummary
  })
  const fake: RoleInvokeHost = {
    start,
    choices: () => choices,
    findRole: (_mother, name) => {
      const found = roles.find((r) => r.name === name)
      if (!found) throw new Error(`Rôle inconnu : ${name}`)
      return found
    }
  }
  return { fake, start }
}

describe('parseRolesStartRequest', () => {
  it('garde les noms sans `@`, sans doublon, et le texte nettoyé', () => {
    expect(parseRolesStartRequest({ roles: ['@a', 'b', 'a'], text: '  Relis.  ' })).toEqual({
      roles: ['a', 'b'],
      text: 'Relis.'
    })
  })
  it('refuse une requête mal formée', () => {
    expect(() => parseRolesStartRequest(null)).toThrow()
    expect(() => parseRolesStartRequest({ roles: [], text: 'x' })).toThrow(/roles/)
    expect(() => parseRolesStartRequest({ roles: ['a'], text: '  ' })).toThrow()
    expect(() => parseRolesStartRequest({ roles: [1], text: 'x' })).toThrow(/roles/)
    expect(() =>
      parseRolesStartRequest({ roles: Array.from({ length: 11 }, (_, i) => `r${i}`), text: 'x' })
    ).toThrow(/roles/)
  })
})

describe('startRoleChildren', () => {
  it('une fille par rôle, même texte, dans l’ordre', async () => {
    const { fake, start } = host([role('a'), role('b')])
    const result = await startRoleChildren(fake, 'mere', { roles: ['a', 'b'], text: 'Relis.' })
    expect(result).toEqual({
      started: [
        { role: 'a', childId: 'fille-1' },
        { role: 'b', childId: 'fille-2' }
      ],
      failed: []
    })
    expect(start.mock.calls.map((c) => c.slice(0, 2))).toEqual([
      ['mere', { text: 'Relis.', role: 'a' }],
      ['mere', { text: 'Relis.', role: 'b' }]
    ])
  })

  it('agent du rôle repris s’il est disponible ; sinon celui de la mère', async () => {
    const { fake, start } = host([role('a', { agent: 'autre' }), role('b', { agent: 'absent' })])
    await startRoleChildren(fake, 'mere', { roles: ['a', 'b'], text: 'x' })
    expect(start.mock.calls[0]?.[1]).toEqual({ text: 'x', role: 'a', profileId: 'autre' })
    expect(start.mock.calls[1]?.[1]).toEqual({ text: 'x', role: 'b' })
  })

  it('rôle inconnu et plafond : rendus avec leur raison, les autres partent', async () => {
    const { fake } = host([role('a'), role('b'), role('c')], 2)
    const result = await startRoleChildren(fake, 'mere', {
      roles: ['a', 'inconnu', 'b', 'c'],
      text: 'x'
    })
    expect(result.started.map((s) => s.role)).toEqual(['a', 'b'])
    expect(result.failed).toEqual([
      { role: 'inconnu', error: 'Rôle inconnu : inconnu' },
      { role: 'c', error: 'Plafond atteint' }
    ])
  })
})
