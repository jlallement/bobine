import { describe, expect, it } from 'vitest'
import type { ConversationSummary, SessionControl } from '@shared/agent'
import type { RoleDefinition } from '@shared/roles'
import { roleToolModules } from '../conversations/host-options'
import type { AppToolModule } from '../mcp/tools'
import { nativeMode, readOnlyLevel, roleFirstMessage, type RoleLaunchHost } from './launch'

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
    const readOnly = role({ readOnly: true, mode: 'build' })
    expect(readOnlyLevel(role(), true)).toBeUndefined()
    expect(readOnlyLevel(readOnly, false)).toBe('enforced')
    // Un mode natif ne prouve pas la lecture seule (relecture) : seulement demandée.
    expect(readOnlyLevel(readOnly, true)).toBe('requested')
    // Mode installé par Bobine en lecture seule (phase 4) : tenue par les droits de l'agent.
    expect(readOnlyLevel(readOnly, true, true)).toBe('enforced')
    expect(readOnlyLevel(role(), true, true)).toBeUndefined()
  })
})

describe('mode installé par Bobine (« lancer dans ce mode », phase 4)', () => {
  const installedModes: SessionControl[] = [
    {
      ...MODES[0],
      options: [
        ...(MODES[0] as { options: { value: string; name: string }[] }).options,
        {
          value: 'code-reviewer',
          name: 'Code reviewer'
        }
      ]
    } as SessionControl
  ]
  const launch = (controls: SessionControl[], writesWithoutAsking: boolean) => {
    const set: string[] = []
    const posted: string[] = []
    const host = {
      view: () => ({ snapshot: { controls } }),
      setControl: (_id: string, _control: string, value: string) => {
        set.push(value)
        return Promise.resolve()
      },
      settingsView: () => ({
        profiles: [{ id: 'p', label: 'P', ...(writesWithoutAsking ? { writesWithoutAsking } : {}) }]
      }),
      post: (_id: string, event: { message: { key: string } }) => posted.push(event.message.key)
    } as unknown as RoleLaunchHost
    const child = { id: 'c', profileId: 'p', profileLabel: 'P' } as ConversationSummary
    return { host, child, set, posted }
  }
  const reviewer = role({ name: 'code-reviewer', readOnly: true })

  it('sans `mode` dans le rôle : le mode installé est posé, lecture seule tenue par l’agent', async () => {
    const run = launch(installedModes, true)
    const text = await roleFirstMessage(run.host, run.child, reviewer, 'relis', {
      id: 'code-reviewer',
      readOnly: true
    })
    expect(run.set).toEqual(['code-reviewer'])
    expect(run.posted).toEqual([])
    expect(text).toContain('Bobine refuses your write requests')
  })

  it('mode absent de la session (pas encore relu par l’agent) : rien posé, seulement demandée', async () => {
    const run = launch(MODES, true)
    await roleFirstMessage(run.host, run.child, reviewer, 'relis', {
      id: 'code-reviewer',
      readOnly: true
    })
    expect(run.set).toEqual([])
    expect(run.posted).toEqual(['roles.notice.readOnlyRequested'])
  })

  it('le `mode` du rôle l’emporte sur le mode installé', async () => {
    const run = launch(installedModes, false)
    await roleFirstMessage(run.host, run.child, { ...reviewer, mode: 'ask' }, 'relis', {
      id: 'code-reviewer',
      readOnly: true
    })
    expect(run.set).toEqual(['ask'])
  })

  it('installé sans lecture seule : un agent qui écrit sans demander reste « demandée »', async () => {
    const run = launch(installedModes, true)
    await roleFirstMessage(run.host, run.child, reviewer, 'relis', {
      id: 'code-reviewer',
      readOnly: false
    })
    expect(run.set).toEqual(['code-reviewer'])
    expect(run.posted).toEqual(['roles.notice.readOnlyRequested'])
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
