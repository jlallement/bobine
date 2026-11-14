import { describe, expect, it } from 'vitest'
import type { SessionControl } from '@shared/agent'
import type { RoleDefinition } from '@shared/roles'
import { roleToolModules } from '../conversations/host-options'
import type { AppToolModule } from '../mcp/tools'
import { nativeMode, readOnlyLevel } from './launch'

const MODES: SessionControl[] = [
  {
    id: 'mode',
    name: 'Mode',
    category: 'mode',
    type: 'select',
    currentValue: 'code',
    options: [
      { value: 'code', name: 'Code' },
      { value: 'ask', name: 'Question' }
    ]
  } as SessionControl
]

const role = (extra: Partial<RoleDefinition> = {}): RoleDefinition => ({
  name: 'r',
  label: 'R',
  icon: 'bot',
  color: 'blue',
  description: 'd',
  readOnly: false,
  prompt: 'p',
  ...extra
})

describe('lancement d’une fille avec un rôle (fiche 223)', () => {
  it('mode natif trouvé par sa valeur ou son nom, casse ignorée ; absent sinon', () => {
    expect(nativeMode(MODES, 'ask')).toEqual({ controlId: 'mode', value: 'ask' })
    expect(nativeMode(MODES, 'QUESTION')).toEqual({ controlId: 'mode', value: 'ask' })
    expect(nativeMode(MODES, 'plan')).toBeUndefined()
    expect(nativeMode(MODES, undefined)).toBeUndefined()
    expect(nativeMode([], 'ask')).toBeUndefined()
  })

  it('lecture seule imposée, ou seulement demandée pour un agent qui écrit sans demander', () => {
    const readOnly = role({ readOnly: true })
    expect(readOnlyLevel(role(), false, true)).toBeUndefined()
    expect(readOnlyLevel(readOnly, false, false)).toBe('enforced')
    expect(readOnlyLevel(readOnly, false, true)).toBe('requested')
    // Le mode natif choisi par le rôle fait foi chez un agent qui ne demande rien.
    expect(readOnlyLevel(readOnly, true, true)).toBe('enforced')
  })
})

describe('outils de Bobine d’une fille avec un rôle (`mcp`, fiche 223)', () => {
  const modules = ['terminal', 'browser', 'memory', 'children'].map(
    (id) => ({ id }) as AppToolModule
  )
  const stamp = { name: 'r', label: 'R', icon: 'bot', color: 'blue' as const }

  it('sans `mcp`, toutes les familles ; avec, les siennes et le lien avec la mère', () => {
    expect(roleToolModules(modules, undefined)).toBe(modules)
    expect(roleToolModules(modules, stamp)).toBe(modules)
    expect(roleToolModules(modules, { ...stamp, mcp: ['browser'] })?.map((m) => m.id)).toEqual([
      'browser',
      'children'
    ])
    expect(roleToolModules(modules, { ...stamp, mcp: [] })?.map((m) => m.id)).toEqual(['children'])
  })
})
