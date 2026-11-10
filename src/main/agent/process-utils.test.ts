import { RequestError } from '../../shared/acp-sdk.mts'
import { describe, expect, it } from 'vitest'
import { errorMessage } from './process-utils'

describe('errorMessage', () => {
  it('message simple', () => {
    expect(errorMessage(new Error('boum'))).toBe('boum')
    expect(errorMessage('texte')).toBe('texte')
  })

  it('erreur de budget de Bob : titre et description au lieu de « Internal error »', () => {
    const details = `BudgetExceededError: ${JSON.stringify({
      title: 'Budget Exceeded',
      description: 'Oh no! It looks like you’ve gone over your budget allowance of 50 Bobcoins.'
    })}`
    expect(errorMessage(RequestError.internalError({ details }))).toBe(
      'Budget Exceeded — Oh no! It looks like you’ve gone over your budget allowance of 50 Bobcoins.'
    )
  })

  it('détail joint à une erreur JSON-RPC', () => {
    expect(errorMessage(RequestError.internalError({ details: 'quota épuisé' }))).toBe(
      'quota épuisé'
    )
    expect(errorMessage(RequestError.invalidParams({ message: 'mode inconnu' }))).toBe(
      'Invalid params (mode inconnu)'
    )
    expect(errorMessage(RequestError.internalError({ details: 'x' }, 'x'))).toBe(
      'Internal error: x'
    )
    expect(errorMessage(RequestError.internalError(undefined, 'boum'))).toBe('Internal error: boum')
  })

  it('détail illisible : gardé tel quel', () => {
    expect(errorMessage(RequestError.internalError({ details: 'FooError: {pas du json' }))).toBe(
      'FooError: {pas du json'
    )
  })
})
