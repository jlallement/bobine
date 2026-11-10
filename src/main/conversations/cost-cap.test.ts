import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { CapPreferences } from '@shared/cost-cap'
import type { TranscriptItem } from '@shared/transcript'
import { MOCK_AGENT_ENTRY } from '../../mock-agent/testing.mts'
import type { AgentProfile } from '../agent/profiles'
import { CONTINUE_PROMPT, CostCapGuard, costCapHandlers } from './cost-cap'
import { ConversationManager } from './manager'

function waitFor(predicate: () => boolean, timeoutMs = 10_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = Date.now()
    const check = () => {
      if (predicate()) return resolve()
      if (Date.now() - started > timeoutMs) return reject(new Error('waitFor : délai dépassé'))
      setTimeout(check, 10)
    }
    check()
  })
}

/** Un gestionnaire sur l'agent factice, le gardien du plafond branché avec ces réglages. */
function environment(scenario: string, prefs: CapPreferences, extraArgs: string[] = []) {
  const root = mkdtempSync(join(tmpdir(), 'plafond-'))
  const profile: AgentProfile = {
    id: 'mock',
    label: 'Factice',
    command: process.execPath,
    args: [MOCK_AGENT_ENTRY, '--scenario', scenario, '--delay', '20', ...extraArgs],
    env: {}
  }
  const manager = new ConversationManager({
    profiles: [profile],
    settingsFile: join(root, 'settings.json'),
    conversationsDir: join(root, 'conversations'),
    defaultWorkspace: root,
    neutralFolder: root,
    pathEnv: () => process.env['PATH'],
    agentHome: mkdtempSync(join(tmpdir(), 'maison-vide-'))
  })
  const guard = new CostCapGuard(manager, () => prefs)
  guard.start()
  const id = manager.state().activeId
  const items = () => manager.view(id).transcript.items
  const card = () =>
    items().findLast(
      (i): i is Extract<TranscriptItem, { kind: 'cost-cap' }> => i.kind === 'cost-cap'
    )
  return { manager, guard, id, items, card }
}

const PREFS: CapPreferences = { costCapEnabled: true, costCapAmount: 1, costCapTokens: 1000 }

describe('gardien du plafond de coût (fiche 157)', () => {
  it('coût qui monte : attend la fin de l’outil en cours, interrompt, puis « Continuer » relance', async () => {
    const { manager, guard, id, items, card } = environment('cout-qui-monte', PREFS)
    await manager.startActive()
    await manager.prompt(id, 'Lis les modules')
    await waitFor(() => !!card())
    const tools = items().flatMap((i) => (i.kind === 'tool' ? [`${i.toolCallId}:${i.status}`] : []))
    // Plafond (1 $) franchi pendant la troisième lecture (1,2 $) : elle finit, puis le tour est
    // interrompu ; la quatrième ne finit pas (sur une machine chargée, elle a pu commencer).
    expect(tools.slice(0, 3)).toEqual(['cout-1:completed', 'cout-2:completed', 'cout-3:completed'])
    expect(tools.slice(3).every((t) => !t.endsWith(':completed'))).toBe(true)
    expect(card()).toMatchObject({ limit: 1, unit: 'USD', spent: 1.2, step: 1, interrupted: true })
    // La carte vient après l'avis d'interruption du tour.
    expect(items().at(-1)?.kind).toBe('cost-cap')
    expect(
      items().some((i) => i.kind === 'notice' && i.message?.key === 'transcript.notice.cancelled')
    ).toBe(true)

    // Plafond des réglages figé au premier message (il vaut pour les nouvelles conversations).
    expect(manager.view(id).transcript.costCap).toBe('settings')
    // « Continuer » rend la main tout de suite ; l'agent est relancé à côté.
    guard.answer(id, card()?.id ?? 0, 'continue')
    expect(manager.view(id).transcript.costCap).toEqual({ limit: 2, unit: 'USD' })
    expect(card()).toMatchObject({ answer: 'continue', raisedTo: 2 })
    await waitFor(() => items().some((i) => i.kind === 'user' && i.text === CONTINUE_PROMPT))
    await waitFor(() => manager.view(id).snapshot?.status === 'ready')
    // Relancé sous le nouveau plafond (1,6 $ au plus) : pas de nouvelle carte.
    expect(items().filter((i) => i.kind === 'cost-cap')).toHaveLength(1)
    manager.stopAll()
  }, 30_000)

  it('« Arrêter », puis nouveau message : retenu avec une carte, rien d’envoyé sans accord', async () => {
    const { manager, guard, id, items, card } = environment('cout-qui-monte', PREFS)
    await manager.startActive()
    await manager.prompt(id, 'Lis les modules')
    await waitFor(() => !!card())
    const users = () => items().filter((i) => i.kind === 'user').length
    const before = users()
    guard.answer(id, card()?.id ?? 0, 'stop')
    expect(card()?.answer).toBe('stop')
    expect(users()).toBe(before)

    // Le plafond reste atteint : le message ne part pas, une carte le cite.
    await manager.prompt(id, 'Encore un module')
    expect(users()).toBe(before)
    expect(card()).toMatchObject({ held: 'Encore un module', interrupted: false, limit: 1 })
    expect(manager.view(id).snapshot?.status).toBe('ready')
    // Encore un : il prend la place du précédent, qui n'a plus de boutons.
    await manager.prompt(id, 'Et celui-ci')
    const cards = items().filter((i) => i.kind === 'cost-cap')
    expect(cards.at(-2)).toMatchObject({ held: 'Encore un module', superseded: true })
    expect(users()).toBe(before)

    // « Continuer » : plafond relevé, et c'est le dernier message retenu qui part.
    guard.answer(id, card()?.id ?? 0, 'continue')
    await waitFor(() => items().some((i) => i.kind === 'user' && i.text === 'Et celui-ci'))
    expect(users()).toBe(before + 1)
    await waitFor(() => manager.view(id).snapshot?.status === 'ready')
    manager.stopAll()
  }, 30_000)

  it('« Aucun » pour la conversation : plus de carte ni de message retenu', async () => {
    const { manager, guard, id, items, card } = environment('cout-qui-monte', PREFS)
    await manager.startActive()
    await manager.prompt(id, 'Lis les modules')
    await waitFor(() => !!card())
    guard.answer(id, card()?.id ?? 0, 'stop')
    guard.setCap(id, 'none')
    await manager.prompt(id, 'Encore')
    expect(items().filter((i) => i.kind === 'cost-cap')).toHaveLength(1)
    expect(items().some((i) => i.kind === 'user' && i.text === 'Encore')).toBe(true)
    manager.stopAll()
  }, 30_000)

  it('sans coût connu : plafond en jetons, carte à la fin du tour, sans interruption', async () => {
    const { manager, id, card, items } = environment('jetons-sans-cout', PREFS, ['--sans-cout'])
    await manager.startActive()
    await manager.prompt(id, 'Réponds')
    await waitFor(() => !!card())
    // ≈ 1 375 jetons pour un tour de l'agent factice, au-delà de 1 000.
    expect(card()).toMatchObject({ unit: 'tokens', limit: 1000, step: 1000, interrupted: false })
    expect(card()?.spent).toBeGreaterThan(1000)
    expect(
      items().some((i) => i.kind === 'notice' && i.message?.key === 'transcript.notice.cancelled')
    ).toBe(false)
    manager.stopAll()
  }, 30_000)

  it('réglage désactivé à la création : pas de plafond, même activé ensuite', async () => {
    const prefs = { ...PREFS, costCapEnabled: false }
    const { manager, guard, id, card } = environment('cout-qui-monte', prefs)
    await manager.startActive()
    await manager.prompt(id, 'Lis les modules')
    expect(card()).toBeUndefined()
    expect(manager.view(id).transcript.costCap).toBeUndefined()
    // Activé après coup : vaut pour les nouvelles conversations, pas pour celle-ci…
    prefs.costCapEnabled = true
    await manager.prompt(id, 'Encore')
    expect(card()).toBeUndefined()
    // … sauf si on le lui donne (« Par défaut ») : le plafond est déjà atteint, le message attend.
    guard.setCap(id, 'settings')
    await manager.prompt(id, 'Et encore')
    expect(card()).toMatchObject({ held: 'Et encore' })
    manager.stopAll()
  }, 30_000)

  it('canaux IPC : arguments vérifiés', async () => {
    const guard = { setCap: vi.fn(), answer: vi.fn() }
    const handlers = costCapHandlers(guard)
    handlers['conversation:setCostCap']('c1', { limit: 3, unit: 'USD' })
    expect(guard.setCap).toHaveBeenCalledWith('c1', { limit: 3, unit: 'USD' })
    expect(() => handlers['conversation:setCostCap']('c1', { limit: 0, unit: 'USD' })).toThrow()
    handlers['conversation:setCostCap']('c1', 'settings')
    expect(guard.setCap).toHaveBeenCalledWith('c1', 'settings')
    handlers['conversation:answerCostCap']('c1', 4, 'stop')
    expect(guard.answer).toHaveBeenCalledWith('c1', 4, 'stop')
    expect(() => handlers['conversation:answerCostCap']('c1', 4, 'oui' as never)).toThrow('answer')
  })
})
