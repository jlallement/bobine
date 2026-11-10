import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ConversationSummary } from '@shared/agent'
import type { DevServerView } from '@shared/launch'
import type { TerminalTabInfo, TerminalsChange } from '@shared/terminal'
import type { TranscriptItem } from '@shared/transcript'
import { useSessionRunning } from './useSessionRunning'

const originalApi = window.api
let tabs: TerminalTabInfo[] = []
let onTerminals: ((change: TerminalsChange) => void) | undefined
let servers: DevServerView[] = []
let onServers: (() => void) | undefined
const idle: TerminalTabInfo = { id: '1', title: 'p', cwd: '/p', busy: false, startedAt: 1 }

beforeEach(() => {
  tabs = [idle]
  servers = []
  window.api = {
    ...originalApi,
    terminal: {
      list: async () => tabs,
      onChanged: (listener: (change: TerminalsChange) => void) => {
        onTerminals = listener
        return () => (onTerminals = undefined)
      }
    },
    preview: {
      list: async () => servers,
      onChanged: (listener: () => void) => {
        onServers = listener
        return () => (onServers = undefined)
      }
    }
  } as unknown as Window['api']
})
afterEach(() => {
  window.api = originalApi
})

interface Props {
  conversationId: string | null
  items: readonly TranscriptItem[]
  conversations: readonly ConversationSummary[]
}

describe('useSessionRunning (fiche 166)', () => {
  it('fil et liste neufs à chaque rendu : pas de boucle ; serveur arrêté → terminé', async () => {
    let renders = 0
    const { result, rerender } = renderHook(
      (p: Props) => {
        renders++
        return useSessionRunning({ ...p, attention: {} })
      },
      // Comme `App` : un fil vide est un tableau neuf à chaque rendu.
      { initialProps: { conversationId: 'c1', items: [], conversations: [] } }
    )
    // Shell à l'invite : rien en cours.
    await waitFor(() => expect(onTerminals).toBeDefined())
    expect(result.current.running).toEqual([])
    // Une commande tourne : en cours ; l'invite revient : disparaît, pas dans « Terminées ».
    const command = { name: 'sleep', startedAt: Date.now() - 500 }
    tabs = [{ ...idle, title: 'sleep', busy: true, command }]
    act(() => onTerminals?.({ conversationId: 'c1', tabs }))
    await waitFor(() =>
      expect(result.current.running).toMatchObject([
        { kind: 'terminal', label: 'sleep', startedAt: command.startedAt }
      ])
    )
    for (let i = 0; i < 5; i++) rerender({ conversationId: 'c1', items: [], conversations: [] })
    expect(renders).toBeLessThan(20)
    tabs = [idle]
    act(() => onTerminals?.({ conversationId: 'c1', tabs }))
    await waitFor(() => expect(result.current.running).toEqual([]))
    expect(result.current.finished).toEqual([])
    // Un serveur de dev qui s'arrête, lui, va dans « Terminées ».
    servers = [{ name: 'web', status: 'running', url: 'u', command: 'c', startedAt: Date.now() }]
    act(() => onServers?.())
    await waitFor(() => expect(result.current.running).toHaveLength(1))
    servers = []
    act(() => onServers?.())
    await waitFor(() => expect(result.current.finished).toHaveLength(1))
    expect(result.current.running).toEqual([])
    // Autre conversation, puis retour : le suivi est gardé.
    rerender({ conversationId: 'c2', items: [], conversations: [] })
    await waitFor(() => expect(result.current.finished).toEqual([]))
    rerender({ conversationId: 'c1', items: [], conversations: [] })
    expect(result.current.finished).toHaveLength(1)
  })
})
