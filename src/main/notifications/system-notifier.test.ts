import { EventEmitter } from 'node:events'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ConversationSummary } from '@shared/agent'
import { DEFAULT_PREFERENCES } from '@shared/preferences'
import type { AttentionNotice } from './attention'

/**
 * Notifications du système (fiches 024, 119) avec un Electron simulé : construction de la
 * `Notification`, clic, refus du système (`failed`), retrait. Puis le câblage de l'app
 * (`appAttention`) : un refus n'empêche ni le rebond du Dock ni son compteur.
 */

/** Fausse `Notification` d'Electron : garde ce qu'on lui demande. */
class FakeNotification extends EventEmitter {
  static supported = true
  static all: FakeNotification[] = []
  static failNext: string | undefined
  static isSupported(): boolean {
    return FakeNotification.supported
  }
  readonly options: { title: string; body: string }
  shown = 0
  closed = 0
  constructor(options: { title: string; body: string }) {
    super()
    this.options = options
    FakeNotification.all.push(this)
  }
  show(): void {
    this.shown++
    // macOS refuse (app signée « ad hoc », réglage coupé) : Electron émet `failed` après `show`.
    const error = FakeNotification.failNext
    if (error) this.emit('failed', {}, error)
  }
  close(): void {
    this.closed++
  }
}

const dock = {
  bounce: vi.fn((_kind: string) => 1),
  cancelBounce: vi.fn(),
  setBadge: vi.fn()
}
const openExternal = vi.fn(async (_url: string) => {})

vi.mock('electron', () => ({
  Notification: FakeNotification,
  shell: { openExternal: (url: string) => openExternal(url) },
  app: { dock, on: vi.fn() }
}))

const { SystemNotifier, NOTIFICATION_SETTINGS } = await import('./system-notifier')
const { appAttention } = await import('./app-attention')
const { GROUP_WINDOW_MS } = await import('./grouping')

const notice = (over: Partial<AttentionNotice> = {}): AttentionNotice => ({
  conversationId: 'a',
  kind: 'done',
  reason: 'done',
  conversationTitle: 'Conversation a',
  title: 'IBM Bob · Conversation a',
  body: 'Terminé, tout passe.',
  ...over
})

beforeEach(() => {
  FakeNotification.all = []
  FakeNotification.supported = true
  FakeNotification.failNext = undefined
  vi.clearAllMocks()
})

describe('SystemNotifier (fiche 024)', () => {
  it('une vraie notification : titre et texte de l’avis, montrée une fois', () => {
    const notifier = new SystemNotifier({ onClick: vi.fn(), onBlocked: vi.fn() })
    notifier.notify(notice())
    expect(FakeNotification.all).toHaveLength(1)
    expect(FakeNotification.all[0]?.options).toEqual({
      title: 'IBM Bob · Conversation a',
      body: 'Terminé, tout passe.'
    })
    expect(FakeNotification.all[0]?.shown).toBe(1)
  })

  it('système sans notifications : rien n’est construit', () => {
    FakeNotification.supported = false
    const notifier = new SystemNotifier({ onClick: vi.fn(), onBlocked: vi.fn() })
    notifier.notify(notice())
    expect(FakeNotification.all).toEqual([])
  })

  it('clic : sa conversation s’ouvre, ses autres bannières sont retirées', () => {
    const onClick = vi.fn()
    const notifier = new SystemNotifier({ onClick, onBlocked: vi.fn() })
    notifier.notify(notice())
    notifier.notify(notice({ body: 'Seconde' }))
    FakeNotification.all[1]?.emit('click')
    expect(onClick).toHaveBeenCalledWith('a')
    // Les deux bannières de « a » sont retirées du centre de notifications.
    expect(FakeNotification.all.map((n) => n.closed)).toEqual([1, 1])
  })

  it('bannière groupée (fiche 119) : retirée seulement quand toutes ses conversations sont vues', () => {
    const onClick = vi.fn()
    const notifier = new SystemNotifier({ onClick, onBlocked: vi.fn() })
    notifier.notify(notice({ conversationIds: ['a', 'b'] }))
    const [grouped] = FakeNotification.all
    notifier.withdraw('a')
    expect(grouped?.closed).toBe(0)
    notifier.withdraw('b')
    expect(grouped?.closed).toBe(1)
    // Déjà retirée : un retrait de plus ne fait rien.
    notifier.withdraw('b')
    expect(grouped?.closed).toBe(1)
    // Cliquée, la bannière groupée ouvre sa première conversation.
    notifier.notify(notice({ conversationId: 'b', conversationIds: ['b', 'c'] }))
    FakeNotification.all[1]?.emit('click')
    expect(onClick).toHaveBeenCalledWith('b')
  })

  it('refus du système : dit une fois, l’état le garde pour les Réglages ; le lien ouvre ceux du système', async () => {
    const onBlocked = vi.fn()
    const notifier = new SystemNotifier({ onClick: vi.fn(), onBlocked })
    FakeNotification.failNext = 'Notifications are not allowed for this application'
    notifier.notify(notice())
    notifier.notify(notice({ conversationId: 'b' }))
    expect(onBlocked).toHaveBeenCalledTimes(1)
    expect(onBlocked).toHaveBeenCalledWith('Notifications are not allowed for this application')
    expect(notifier.blockedReason).toBe('Notifications are not allowed for this application')
    const controls = notifier.controls()
    expect(controls.status()).toEqual({
      blocked: 'Notifications are not allowed for this application'
    })
    await controls.openSettings()
    expect(openExternal).toHaveBeenCalledWith(NOTIFICATION_SETTINGS.posix)
    // Une bannière refusée est oubliée : la retirer ne touche à rien.
    notifier.withdraw('a')
    expect(FakeNotification.all[0]?.closed).toBe(0)
  })

  it('sans refus : statut vide ; Windows : ses propres réglages', async () => {
    const notifier = new SystemNotifier({
      onClick: vi.fn(),
      onBlocked: vi.fn(),
      settingsUrl: NOTIFICATION_SETTINGS.windows
    })
    expect(notifier.controls().status()).toEqual({})
    await notifier.controls().openSettings()
    expect(openExternal).toHaveBeenCalledWith('ms-settings:notifications')
  })
})

describe('appAttention : un refus des notifications ne coupe ni le Dock ni son compteur', () => {
  function setup() {
    const conversations: ConversationSummary[] = [
      {
        id: 'a',
        title: 'Conversation a',
        profileId: 'mock',
        profileLabel: 'IBM Bob',
        workspace: '/p',
        updatedAt: '2026-11-24T08:00:00.000Z',
        status: 'ready',
        draft: false
      } as ConversationSummary
    ]
    const onBlocked = vi.fn()
    const notifier = new SystemNotifier({ onClick: vi.fn(), onBlocked })
    const { attention } = appAttention({
      settings: { preferences: () => DEFAULT_PREFERENCES, notificationsEnabled: () => true },
      presentation: { active: false, onChange: () => () => {} },
      conversations: {
        state: () => ({ activeId: 'other', conversations }),
        shownIds: () => ['other']
      },
      notifier,
      isFocused: () => false,
      dockBadge: true,
      emit: () => {}
    })
    return { attention, onBlocked }
  }

  it('macOS refuse la bannière : le Dock rebondit quand même, le compteur passe à 1 et y reste', () => {
    FakeNotification.failNext = 'not allowed'
    // Bannières groupées (fiche 119) : l'avis part à la fin de sa fenêtre de regroupement.
    vi.useFakeTimers()
    const { attention, onBlocked } = setup()
    attention.onEvent('a', { type: 'user-message', text: 'salut' })
    attention.onEvent('a', { type: 'turn-end', stopReason: 'end_turn' })
    vi.advanceTimersByTime(GROUP_WINDOW_MS + 1)
    vi.useRealTimers()
    expect(onBlocked).toHaveBeenCalledWith('not allowed')
    expect(dock.bounce).toHaveBeenCalledWith('informational')
    expect(dock.setBadge).toHaveBeenLastCalledWith('1')
    // Réponse toujours non lue : un nouvel état (rafraîchi) ne remet pas le compteur à zéro.
    attention.refresh()
    expect(dock.setBadge).toHaveBeenLastCalledWith('1')
    expect(dock.setBadge).not.toHaveBeenCalledWith('')
  })
})
