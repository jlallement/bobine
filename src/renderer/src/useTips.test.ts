import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ConversationSummary } from '@shared/agent'
import { localDay, type TipAction, type TipId, type TipsView } from '@shared/tips'
import { reviewTipFor, tooRecent, useAppTips, useTips } from './useTips'

const summary = (id: string, extra: Partial<ConversationSummary> = {}) =>
  ({ id, draft: false, ...extra }) as ConversationSummary

describe('astuces : moment et contexte (fiche 191)', () => {
  it('rien pendant les deux premières minutes d’une conversation', () => {
    const created = '2026-11-07T10:00:00Z'
    const at = (s: string) => Date.parse(s)
    expect(tooRecent(created, at('2026-11-07T10:01:59Z'))).toBe(true)
    expect(tooRecent(created, at('2026-11-07T10:02:01Z'))).toBe(false)
    expect(tooRecent(created, at('2026-11-07T10:00:01Z'), 0)).toBe(false)
    expect(tooRecent(undefined, Date.now())).toBe(false)
  })

  it('« Faire relire » : gros changement, pas encore relu, pas une relecture elle-même', () => {
    const open = vi.fn()
    const big = { files: 21, added: 0, removed: 0 }
    const lines = { files: 3, added: 400, removed: 101 }
    const small = { files: 20, added: 250, removed: 250 }
    const a = summary('a')
    expect(reviewTipFor(a, [a], big, open)).toBe(open)
    expect(reviewTipFor(a, [a], lines, open)).toBe(open)
    expect(reviewTipFor(a, [a], small, open)).toBeUndefined()
    const reviewer = summary('r', { reviewOf: { id: 'a', title: 'A' } })
    expect(reviewTipFor(a, [a, reviewer], big, open)).toBeUndefined()
    expect(reviewTipFor(reviewer, [a, reviewer], big, open)).toBeUndefined()
    expect(reviewTipFor(summary('d', { draft: true }), [], big, open)).toBeUndefined()
    expect(reviewTipFor(null, [], big, open)).toBeUndefined()
  })
})

describe('règles de fréquence des astuces (fiche 191)', () => {
  const today = localDay(new Date())
  let view: TipsView
  const record = vi.fn(async (id: TipId, action: TipAction) => {
    view = {
      ...view,
      ...(action === 'shown' ? { lastShownDay: today } : { hidden: [...view.hidden, id] })
    }
    return view
  })
  const original = window.api
  beforeEach(() => {
    view = { hidden: [], quietMs: 0, firstDayRule: true }
    record.mockClear()
    window.api = {
      ...original,
      tips: { state: async () => view, record }
    } as unknown as Window['api']
  })
  afterEach(() => {
    window.api = original
  })

  const setup = async (props: Partial<Parameters<typeof useTips>[0]> = {}) => {
    const hook = renderHook((p: Parameters<typeof useTips>[0]) => useTips(p), {
      initialProps: {
        enabled: true,
        quiet: false,
        conversationId: 'c1',
        createdAt: undefined,
        ...props
      }
    })
    await act(async () => {})
    return hook
  }

  it('une à la fois, une par jour toutes confondues', async () => {
    const { result } = await setup()
    act(() => result.current.offer('aside'))
    expect(result.current.current).toBe('aside')
    act(() => result.current.offer('context'))
    expect(result.current.current).toBe('aside')
    act(() => result.current.close())
    await act(async () => {})
    act(() => result.current.offer('context'))
    expect(result.current.current).toBeNull()
    expect(record).toHaveBeenCalledWith('aside', 'shown')
  })

  it('jamais pendant une demande de l’agent ; elle s’efface si une demande arrive', async () => {
    const { result, rerender } = await setup({ quiet: true })
    act(() => result.current.offer('aside'))
    expect(result.current.current).toBeNull()
    rerender({ enabled: true, quiet: false, conversationId: 'c1', createdAt: undefined })
    act(() => result.current.offer('aside'))
    expect(result.current.current).toBe('aside')
    rerender({ enabled: true, quiet: true, conversationId: 'c1', createdAt: undefined })
    expect(result.current.current).toBeNull()
  })

  it('réglage coupé : aucune ; jour du premier lancement : aucune', async () => {
    const off = await setup({ enabled: false })
    act(() => off.result.current.offer('aside'))
    expect(off.result.current.current).toBeNull()
    view = { hidden: [], quietMs: 0, firstDayRule: true, firstDay: localDay(new Date()) }
    const first = await setup()
    act(() => first.result.current.offer('aside'))
    expect(first.result.current.current).toBeNull()
  })

  it('« Ne plus montrer » et fonction utilisée : jamais plus', async () => {
    view = { hidden: ['aside', 'review'], quietMs: 0, firstDayRule: true }
    const { result } = await setup()
    act(() => result.current.offer('aside'))
    act(() => result.current.offer('review'))
    expect(result.current.current).toBeNull()
    act(() => result.current.used('context'))
    expect(record).toHaveBeenCalledWith('context', 'used')
  })

  it('deux premières minutes : rien, sauf le message répété (montré en fin de tour)', async () => {
    view = { hidden: [], quietMs: 120_000, firstDayRule: true }
    const createdAt = new Date().toISOString()
    const { result } = await setup({ createdAt })
    act(() => result.current.offer('aside'))
    expect(result.current.current).toBeNull()
    act(() => result.current.offer('scheduled'))
    expect(result.current.current).toBe('scheduled')
  })

  it('autre conversation : l’astuce s’efface', async () => {
    const { result, rerender } = await setup()
    act(() => result.current.offer('aside'))
    rerender({ enabled: true, quiet: false, conversationId: 'c2', createdAt: undefined })
    expect(result.current.current).toBeNull()
  })
})

describe('message répété : en fin de tour seulement (fiche 191)', () => {
  const original = window.api
  afterEach(() => {
    window.api = original
  })

  it('pas pendant le tour ; à sa fin, « Planifier… » ; rien ailleurs', async () => {
    let view: TipsView = { hidden: [], quietMs: 0, firstDayRule: true }
    window.api = {
      ...original,
      tips: {
        state: async () => view,
        record: vi.fn(async () => (view = { ...view, lastShownDay: localDay(new Date()) })),
        noteMessage: vi.fn(async () => true)
      }
    } as unknown as Window['api']
    const conv = (status: string) => ({
      settings: { preferences: { tipsEnabled: true } },
      activeId: 'c1',
      activeSummary: null,
      attention: {},
      list: [],
      active: { snapshot: { status } }
    })
    const showScheduled = vi.fn()
    const actions = { startAside: vi.fn(), openReview: vi.fn(), showScheduled, closePage: vi.fn() }
    const changes = { files: 0, added: 0, removed: 0 }
    const { result, rerender } = renderHook(
      ({ status }: { status: string }) => useAppTips(conv(status), changes, actions),
      { initialProps: { status: 'ready' } }
    )
    await act(async () => {})
    await act(async () => result.current.tips.noteSent?.('/projet', 'Fais le point sur les PR'))
    rerender({ status: 'busy' })
    expect(result.current.tips.current).toBeNull()
    rerender({ status: 'ready' })
    expect(result.current.tips.current).toBe('scheduled')
    act(() => result.current.tips.planRepeated?.())
    expect(showScheduled).toHaveBeenCalled()
    expect(result.current.tips.plan).toEqual({
      instruction: 'Fais le point sur les PR',
      folder: '/projet'
    })
  })
})

describe('astuces : relecture (fiche 191)', () => {
  const original = window.api
  afterEach(() => {
    window.api = original
    vi.useRealTimers()
  })

  it('jour du premier lancement relu à chaque offre : l’app restée ouverte après minuit en montre', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 7, 23, 50))
    const view: TipsView = { hidden: [], quietMs: 0, firstDayRule: true, firstDay: '2026-11-07' }
    window.api = {
      ...original,
      tips: { state: async () => view, record: vi.fn(async () => view) }
    } as unknown as Window['api']
    const { result } = renderHook(() =>
      useTips({ enabled: true, quiet: false, conversationId: 'c1', createdAt: undefined })
    )
    await act(async () => {})
    act(() => result.current.offer('aside'))
    expect(result.current.current).toBeNull()
    vi.setSystemTime(new Date(2026, 10, 8, 0, 10))
    act(() => result.current.offer('aside'))
    expect(result.current.current).toBe('aside')
  })

  it('message répété : le tour finit avant la réponse du main, l’astuce paraît quand même', async () => {
    let answer: (again: boolean) => void = () => undefined
    const view: TipsView = { hidden: [], quietMs: 0, firstDayRule: false }
    window.api = {
      ...original,
      tips: {
        state: async () => view,
        record: vi.fn(async () => view),
        noteMessage: vi.fn(() => new Promise<boolean>((r) => (answer = r)))
      }
    } as unknown as Window['api']
    const conv = (status: string) => ({
      settings: { preferences: { tipsEnabled: true } },
      activeId: 'c1',
      activeSummary: null,
      attention: {},
      list: [],
      active: { snapshot: { status } }
    })
    const actions = {
      startAside: vi.fn(),
      openReview: vi.fn(),
      showScheduled: vi.fn(),
      closePage: vi.fn()
    }
    const changes = { files: 0, added: 0, removed: 0 }
    const { result, rerender } = renderHook(
      ({ status }: { status: string }) => useAppTips(conv(status), changes, actions),
      { initialProps: { status: 'ready' } }
    )
    await act(async () => {})
    act(() => result.current.tips.noteSent?.('/projet', 'Fais le point sur les PR'))
    rerender({ status: 'busy' })
    rerender({ status: 'ready' })
    expect(result.current.tips.current).toBeNull()
    await act(async () => answer(true))
    expect(result.current.tips.current).toBe('scheduled')
  })
})

describe('astuces : seconde relecture (fiche 191)', () => {
  const original = window.api
  afterEach(() => {
    window.api = original
  })

  it('message envoyé pendant que l’agent travaille : « Planifier… » à la fin du tour', async () => {
    const view: TipsView = { hidden: [], quietMs: 0, firstDayRule: false }
    window.api = {
      ...original,
      tips: {
        state: async () => view,
        record: vi.fn(async () => view),
        noteMessage: vi.fn(async () => true)
      }
    } as unknown as Window['api']
    const conv = (status: string) => ({
      settings: { preferences: { tipsEnabled: true } },
      activeId: 'c1',
      activeSummary: null,
      attention: {},
      list: [],
      active: { snapshot: { status } }
    })
    const actions = {
      startAside: vi.fn(),
      openReview: vi.fn(),
      showScheduled: vi.fn(),
      closePage: vi.fn()
    }
    const changes = { files: 0, added: 0, removed: 0 }
    const { result, rerender } = renderHook(
      ({ status }: { status: string }) => useAppTips(conv(status), changes, actions),
      { initialProps: { status: 'busy' } }
    )
    await act(async () => {})
    await act(async () => result.current.tips.noteSent?.('/projet', 'Fais le point sur les PR'))
    expect(result.current.tips.current).toBeNull()
    rerender({ status: 'ready' })
    expect(result.current.tips.current).toBe('scheduled')
  })

  it('« Tout réafficher » ailleurs : l’état suit sans remonter le composant', async () => {
    let view: TipsView = { hidden: ['aside'], quietMs: 0, firstDayRule: false }
    let changed: (v: TipsView) => void = () => undefined
    window.api = {
      ...original,
      tips: {
        state: async () => view,
        record: vi.fn(async () => view),
        onChanged: (listener: (v: TipsView) => void) => {
          changed = listener
          return () => {}
        }
      }
    } as unknown as Window['api']
    const { result } = renderHook(() =>
      useTips({ enabled: true, quiet: false, conversationId: 'c1', createdAt: undefined })
    )
    await act(async () => {})
    act(() => result.current.offer('aside'))
    expect(result.current.current).toBeNull()
    view = { ...view, hidden: [] }
    act(() => changed(view))
    act(() => result.current.offer('aside'))
    expect(result.current.current).toBe('aside')
  })
})
