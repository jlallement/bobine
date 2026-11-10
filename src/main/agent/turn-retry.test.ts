import type { ContentBlock } from '../../shared/acp-sdk.mts'
import { RequestError } from '../../shared/acp-sdk.mts'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RETRY_DELAYS_MS, TurnRetry, type TurnRetryOptions } from './turn-retry'

const offline = new RequestError(-32603, 'Internal error', { details: 'TypeError: fetch failed' })
const tooMany = new RequestError(-32603, 'Rate limit exceeded')
const other = new RequestError(-32603, 'Erreur simulée')

/** Faux réseau : `restore()` prévient comme un retour du réseau ou une sortie de veille. */
function fakeNetwork() {
  const listeners = new Set<() => void>()
  return {
    onRestored: (listener: () => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    restore: () => [...listeners].forEach((listener) => listener()),
    get listening() {
      return listeners.size
    }
  }
}

function setup(options: Partial<TurnRetryOptions> = {}) {
  const blocks: ContentBlock[] = [{ type: 'text', text: 'Bonjour' }]
  const resend = vi.fn<(b: ContentBlock[]) => void>()
  const changed = vi.fn()
  const network = fakeNetwork()
  const retry = new TurnRetry({ resend, changed, network, ...options })
  // L'hôte relance le tour avec les mêmes blocs à chaque renvoi.
  resend.mockImplementation((b) => retry.begin(b))
  return { retry, blocks, resend, changed, network }
}

describe('TurnRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000_000)
  })
  afterEach(() => vi.useRealTimers())

  it('cinq tentatives après 2, 4, 8, 16 puis 32 s, puis plus rien', () => {
    const { retry, blocks, resend } = setup()
    expect(RETRY_DELAYS_MS).toEqual([2000, 4000, 8000, 16000, 32000])
    retry.begin(blocks)
    expect(retry.failed(offline)).toBe('waiting')
    for (const [index, delay] of RETRY_DELAYS_MS.entries()) {
      const attempt = index + 1
      expect(retry.view()).toEqual({
        cause: 'network',
        attempt,
        max: 5,
        at: Date.now() + delay
      })
      vi.advanceTimersByTime(delay - 1)
      expect(resend).toHaveBeenCalledTimes(index)
      vi.advanceTimersByTime(1)
      expect(resend).toHaveBeenCalledTimes(attempt)
      expect(resend).toHaveBeenLastCalledWith(blocks)
      expect(retry.view()).toBeUndefined()
      expect(retry.failed(offline)).toBe(attempt < 5 ? 'waiting' : 'exhausted')
    }
    expect(retry.view()).toEqual({ cause: 'network', attempt: 5, max: 5 })
    expect(retry.waiting).toBe(false)
    vi.advanceTimersByTime(120_000)
    expect(resend).toHaveBeenCalledTimes(5)
  })

  it('une limite de débit suit le même calendrier, sous sa propre cause', () => {
    const { retry, blocks } = setup()
    retry.begin(blocks)
    expect(retry.failed(tooMany)).toBe('waiting')
    expect(retry.view()?.cause).toBe('rate-limit')
  })

  it('une autre erreur n’est pas réessayée, et oublie une attente en cours', () => {
    const { retry, blocks, resend } = setup()
    retry.begin(blocks)
    expect(retry.failed(other)).toBeUndefined()
    expect(retry.view()).toBeUndefined()
    retry.begin(blocks)
    retry.failed(offline)
    vi.advanceTimersByTime(2000)
    expect(retry.failed(other)).toBeUndefined()
    expect(retry.view()).toBeUndefined()
    vi.advanceTimersByTime(60_000)
    expect(resend).toHaveBeenCalledTimes(1)
  })

  it('« Réessayer maintenant » renvoie tout de suite, la tentative compte', () => {
    const { retry, blocks, resend } = setup()
    retry.begin(blocks)
    retry.failed(offline)
    vi.advanceTimersByTime(2000)
    retry.failed(offline)
    expect(retry.view()?.attempt).toBe(2)
    expect(retry.now()).toBe(true)
    expect(resend).toHaveBeenCalledTimes(2)
    retry.failed(offline)
    expect(retry.view()).toMatchObject({ attempt: 3, at: Date.now() + 8000 })
    // Le minuteur de la tentative remplacée ne renvoie rien de plus.
    vi.advanceTimersByTime(7999)
    expect(resend).toHaveBeenCalledTimes(2)
  })

  it('« Réessayer » après l’épuisement repart pour cinq tentatives', () => {
    const { retry, blocks, resend } = setup()
    retry.begin(blocks)
    retry.failed(offline)
    for (let i = 0; i < 5; i++) {
      retry.now()
      retry.failed(offline)
    }
    expect(retry.view()).toEqual({ cause: 'network', attempt: 5, max: 5 })
    expect(retry.now()).toBe(true)
    expect(resend).toHaveBeenCalledTimes(6)
    expect(retry.failed(offline)).toBe('waiting')
    expect(retry.view()).toMatchObject({ attempt: 1, at: Date.now() + 2000 })
  })

  it('le retour du réseau déclenche une tentative immédiate, pendant l’attente ou après', () => {
    const { retry, blocks, resend, network } = setup()
    retry.begin(blocks)
    retry.failed(offline)
    expect(network.listening).toBe(1)
    network.restore()
    expect(resend).toHaveBeenCalledTimes(1)
    // Plus d'écoute pendant la tentative.
    expect(network.listening).toBe(0)
    // Tentatives 2 à 5 en échec : les tentatives sont épuisées.
    for (let i = 0; i < 4; i++) {
      retry.failed(offline)
      retry.now()
    }
    expect(retry.failed(offline)).toBe('exhausted')
    expect(network.listening).toBe(1)
    network.restore()
    expect(resend).toHaveBeenCalledTimes(6)
  })

  it('Échap ou Stop annule les tentatives', () => {
    const { retry, blocks, resend, network, changed } = setup()
    retry.begin(blocks)
    expect(retry.cancel()).toBe(false)
    retry.failed(offline)
    changed.mockClear()
    expect(retry.cancel()).toBe(true)
    expect(changed).toHaveBeenCalledTimes(1)
    expect(retry.view()).toBeUndefined()
    expect(network.listening).toBe(0)
    vi.advanceTimersByTime(60_000)
    network.restore()
    expect(resend).not.toHaveBeenCalled()
  })

  it('un nouveau message remplace celui qui attendait', () => {
    const { retry, blocks, resend } = setup()
    retry.begin(blocks)
    retry.failed(offline)
    for (let i = 0; i < 5; i++) {
      retry.now()
      retry.failed(offline)
    }
    const next: ContentBlock[] = [{ type: 'text', text: 'Autre chose' }]
    retry.begin(next)
    expect(retry.view()).toBeUndefined()
    // Le nouveau message a ses cinq tentatives à lui.
    expect(retry.failed(offline)).toBe('waiting')
    expect(retry.view()?.attempt).toBe(1)
    vi.advanceTimersByTime(2000)
    expect(resend).toHaveBeenLastCalledWith(next)
  })

  it('lit la sortie d’erreur écrite pendant le tour, et le format propre à l’agent', () => {
    let stderr = 'ancienne ligne : ECONNRESET\n'
    const agentProcess = () => ({
      stderrMark: () => stderr.length,
      stderrSince: (mark: number) => stderr.slice(mark)
    })
    const generic = new RequestError(-32603, 'Internal error')
    const { retry, blocks } = setup({ agentProcess })
    retry.begin(blocks)
    // Ce qui a été écrit avant le tour ne compte pas.
    expect(retry.failed(generic)).toBeUndefined()
    retry.begin(blocks)
    stderr += 'Error: getaddrinfo ENOTFOUND api.example.com\n'
    expect(retry.failed(generic)).toBe('waiting')

    const own = setup({ transientError: (e) => (e === other ? 'rate-limit' : undefined) })
    own.retry.begin(own.blocks)
    expect(own.retry.failed(other)).toBe('waiting')
    expect(own.retry.view()?.cause).toBe('rate-limit')
  })
})
