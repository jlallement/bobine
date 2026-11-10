import { RequestError } from '../../shared/acp-sdk.mts'
import { describe, expect, it } from 'vitest'
import { classifyTurnFailure } from './turn-failure'

/** Erreur JSON-RPC telle que le SDK la rend au client (`RequestError`). */
const rpc = (message: string, data?: unknown, code = -32603) =>
  new RequestError(code, message, data)

describe('classifyTurnFailure', () => {
  it('reconnaît les pannes réseau de Node, de Bun, des SDK et des proxys', () => {
    const cases: unknown[] = [
      // fetch de Node (undici) : la cause est dans `cause`, l'agent la relaie dans `data`.
      rpc('Internal error', { details: 'TypeError: fetch failed' }),
      rpc('Internal error', { details: 'fetch failed', cause: 'read ECONNRESET' }),
      rpc(
        'request to https://api.openai.com/v1/chat failed, reason: getaddrinfo ENOTFOUND api.openai.com'
      ),
      rpc('Internal error', { details: 'Connect Timeout Error', code: 'UND_ERR_CONNECT_TIMEOUT' }),
      // SDK OpenAI / Anthropic : `APIConnectionError`, `APIConnectionTimeoutError`.
      rpc('Connection error.'),
      rpc('Request timed out.'),
      // Bun (OpenCode) : `fetch` sans réseau.
      rpc('Unable to connect. Is the computer able to access the url?', {
        code: 'ConnectionRefused'
      }),
      rpc('The socket connection was closed unexpectedly.', { code: 'ConnectionClosed' }),
      // Proxy d'entreprise et VPN.
      rpc('tunneling socket could not be established, cause=connect ECONNREFUSED 10.0.0.1:3128'),
      rpc('Internal error', { status: 502, message: 'Bad Gateway' }),
      rpc('503 Service Unavailable'),
      rpc('socket hang up'),
      Object.assign(new Error('fetch failed'), {
        cause: Object.assign(new Error('connect ETIMEDOUT 104.18.6.192:443'), { code: 'ETIMEDOUT' })
      })
    ]
    for (const error of cases) expect(classifyTurnFailure(error), String(error)).toBe('network')
  })

  it('reconnaît une limite de débit (429)', () => {
    const cases: unknown[] = [
      // OpenCode et les modèles gratuits de Zen (fiche 078).
      rpc('Rate limit exceeded'),
      rpc('429 Too Many Requests'),
      rpc('Internal error', { error: { status: 429, message: 'slow down' } }),
      rpc('Internal error', {
        details: '429 {"type":"error","error":{"type":"rate_limit_error","message":"…"}}'
      }),
      rpc('Rate limit reached for gpt-4o in organization org-x on tokens per min'),
      rpc('Internal error', { details: '[API Error: RESOURCE_EXHAUSTED]' }),
      new RequestError(429, 'Too many requests')
    ]
    for (const error of cases) expect(classifyTurnFailure(error), String(error)).toBe('rate-limit')
  })

  it('laisse les autres erreurs, dont un budget ou un quota épuisés, comme avant', () => {
    const cases: unknown[] = [
      rpc('Erreur simulée par l’agent factice'),
      // Bob 2.0.6, budget de bobcoins épuisé (fiche 048).
      rpc('Internal error', {
        details: 'BudgetExceededError: {"title":"Budget Exceeded","description":"…50 Bobcoins."}'
      }),
      // OpenAI : quota du compte, renvoyé en 429 mais sans remède en attendant.
      rpc('429 You exceeded your current quota, please check your plan and billing details.', {
        code: 'insufficient_quota'
      }),
      rpc('401 Unauthorized: invalid x-api-key'),
      rpc('Invalid params', undefined, -32602),
      new RequestError(-32000, 'Authentication required'),
      'boom',
      undefined
    ]
    for (const error of cases) expect(classifyTurnFailure(error), String(error)).toBe('other')
  })

  it('lit la sortie d’erreur du tour quand l’erreur ne dit rien', () => {
    const stderr = 'retrying…\nError: getaddrinfo EAI_AGAIN api.anthropic.com\n'
    expect(classifyTurnFailure(rpc('Internal error'), stderr)).toBe('network')
    expect(classifyTurnFailure(rpc('Internal error'), 'HTTP 429 Too Many Requests')).toBe(
      'rate-limit'
    )
    // Une erreur précise (paramètres) n'est pas recouverte par la sortie d'erreur.
    expect(classifyTurnFailure(rpc('Invalid params', undefined, -32602), stderr)).toBe('other')
    // Un budget épuisé dit sur la sortie d'erreur n'est pas une limite de débit.
    expect(classifyTurnFailure(rpc('Internal error'), 'BudgetExceededError 429')).toBe('other')
    expect(classifyTurnFailure(rpc('Internal error'), '')).toBe('other')
  })
})
