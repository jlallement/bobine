import { describe, expect, it, vi } from 'vitest'
import type { AgentEvent } from '@shared/agent'
import { PendingRequests } from './pending-requests'

describe('PendingRequests', () => {
  it('Stop : autorisations et formulaires en attente annulés, une seule fois', async () => {
    const events: AgentEvent[] = []
    const requests = new PendingRequests((e) => events.push(e))
    const permission = requests.permission({
      sessionId: 's',
      toolCall: { toolCallId: 't', title: 'Écrire' },
      options: [{ optionId: 'ok', name: 'Autoriser', kind: 'allow_once' }]
    })
    const form = requests.elicitation({
      mode: 'form',
      message: 'Nom ?',
      schema: { type: 'object', properties: {} }
    })
    requests.cancelAll()
    await expect(permission).resolves.toEqual({ outcome: { outcome: 'cancelled' } })
    await expect(form).resolves.toEqual({ action: 'cancel' })
    expect(events.map((e) => e.type)).toEqual([
      'permission-request',
      'elicitation-request',
      'permission-resolved',
      'elicitation-resolved'
    ])
    expect(() => requests.respondPermission('permission-1', 'ok')).toThrow('déjà traitée')
  })

  // Fiche 214 : Bob retire lui-même sa demande (`$/cancel_request` → signal de la requête).
  describe('demande retirée par l’agent', () => {
    /** Raison de l'abandon du signal par le SDK pour `$/cancel_request` (RequestError -32800). */
    const CANCELLED = Object.assign(new Error('Request cancelled'), { code: -32800 })

    const ask = (requests: PendingRequests, signal?: AbortSignal) =>
      requests.permission(
        {
          sessionId: 's',
          toolCall: { toolCallId: 't', title: 'Écrire' },
          options: [{ optionId: 'ok', name: 'Autoriser', kind: 'allow_once' }]
        },
        [],
        signal
      )

    it('retirée : plus en attente, carte fermée « par l’agent », réponse annulée', async () => {
      const events: AgentEvent[] = []
      const requests = new PendingRequests((e) => events.push(e))
      const controller = new AbortController()
      const permission = ask(requests, controller.signal)
      expect(requests.waiting()).toBe(true)
      controller.abort(CANCELLED)
      await expect(permission).resolves.toEqual({ outcome: { outcome: 'cancelled' } })
      expect(requests.waiting()).toBe(false)
      expect(events.at(-1)).toEqual({
        type: 'permission-resolved',
        requestId: 'permission-1',
        optionId: null,
        cancelledBy: 'agent'
      })
    })

    it('réponse de l’utilisateur après le retrait : sans effet, sans erreur, rien d’émis', async () => {
      const events: AgentEvent[] = []
      const requests = new PendingRequests((e) => events.push(e))
      const controller = new AbortController()
      const permission = ask(requests, controller.signal)
      controller.abort(CANCELLED)
      await permission
      const count = events.length
      expect(() => requests.respondPermission('permission-1', 'ok')).not.toThrow()
      expect(requests.permissionChoice('permission-1', 'ok')).toBeUndefined()
      expect(events).toHaveLength(count)
    })

    it('déjà retirée à l’arrivée : fermée aussitôt, sans rester en attente', async () => {
      const events: AgentEvent[] = []
      const requests = new PendingRequests((e) => events.push(e))
      const controller = new AbortController()
      controller.abort(CANCELLED)
      await expect(ask(requests, controller.signal)).resolves.toEqual({
        outcome: { outcome: 'cancelled' }
      })
      expect(requests.waiting()).toBe(false)
      expect(events.map((e) => e.type)).toEqual(['permission-request', 'permission-resolved'])
    })

    it('répondue puis retirée : la réponse de l’utilisateur reste, rien de plus', async () => {
      const events: AgentEvent[] = []
      const requests = new PendingRequests((e) => events.push(e))
      const controller = new AbortController()
      const permission = ask(requests, controller.signal)
      requests.respondPermission('permission-1', 'ok')
      controller.abort(CANCELLED)
      await expect(permission).resolves.toEqual({
        outcome: { outcome: 'selected', optionId: 'ok' }
      })
      expect(events.map((e) => e.type)).toEqual(['permission-request', 'permission-resolved'])
    })

    it('connexion fermée (agent mort) : pas un retrait, la demande reste pour cancelAll', async () => {
      const events: AgentEvent[] = []
      const requests = new PendingRequests((e) => events.push(e))
      const controller = new AbortController()
      const permission = ask(requests, controller.signal)
      controller.abort(new Error('ACP connection closed'))
      expect(requests.waiting()).toBe(true)
      requests.cancelAll()
      await expect(permission).resolves.toEqual({ outcome: { outcome: 'cancelled' } })
      expect(events.at(-1)).toEqual({
        type: 'permission-resolved',
        requestId: 'permission-1',
        optionId: null
      })
    })

    it('un identifiant inconnu lève toujours l’erreur (pas retiré par l’agent)', () => {
      const requests = new PendingRequests(() => {})
      expect(() => requests.respondPermission('permission-9', 'ok')).toThrow('déjà traitée')
    })
  })

  it('page demandée : seuls les liens https sont ouverts', async () => {
    const open = vi.fn()
    const requests = new PendingRequests(() => {}, open)
    void requests.elicitation({ mode: 'url', message: 'Connexion', url: 'file:///etc/passwd' })
    expect(() => requests.respondElicitation('elicitation-1', { action: 'accept' })).toThrow(
      'https'
    )
    expect(open).not.toHaveBeenCalled()
    const answered = requests.elicitation({
      mode: 'url',
      message: 'Connexion',
      url: 'https://x.test/'
    })
    requests.respondElicitation('elicitation-2', { action: 'accept' })
    await expect(answered).resolves.toEqual({ action: 'accept' })
    expect(open).toHaveBeenCalledWith('https://x.test/')
  })
})
