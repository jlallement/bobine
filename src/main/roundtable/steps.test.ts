import { describe, expect, it } from 'vitest'
import { retryDelay } from './steps'

describe('réessai d’une demande refusée parce que l’agent préparait', () => {
  it('espacé et borné', () => {
    expect([1, 2, 3, 4, 10, 50].map(retryDelay)).toEqual([100, 200, 400, 800, 5000, 5000])
  })
})
