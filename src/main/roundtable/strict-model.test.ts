import { describe, expect, it, vi } from 'vitest'
import type { SessionControl } from '@shared/agent'
import { applyModelStrict, StrictModelError } from './strict-model'

function host(current: string, options = ['a', 'b'], apply?: (value: string) => string | Error) {
  const control: SessionControl = {
    id: 'model',
    name: 'Model',
    category: 'model',
    type: 'select',
    currentValue: current,
    options: options.map((value) => ({ value, name: value.toUpperCase() }))
  }
  const setControl = vi.fn(async (_id: string, _controlId: string, value: unknown) => {
    const result = apply ? apply(String(value)) : String(value)
    if (result instanceof Error) throw result
    control.currentValue = result
  })
  return {
    setControl,
    host: {
      view: () => ({ snapshot: { controls: [control] } }) as never,
      setControl: setControl as never
    }
  }
}

const reasonOf = async (promise: Promise<void>) => {
  try {
    await promise
    return 'applied'
  } catch (error) {
    return error instanceof StrictModelError ? error.reason : 'other'
  }
}

describe('modèle strict (fiche 285, décision C4)', () => {
  it('déjà en place : aucun réglage ; sinon un seul, relu après les mises à jour', async () => {
    const same = host('a')
    expect(
      await reasonOf(applyModelStrict(same.host, 'c', { controlId: 'model', value: 'a' }, 0))
    ).toBe('applied')
    expect(same.setControl).not.toHaveBeenCalled()
    const other = host('a')
    expect(
      await reasonOf(applyModelStrict(other.host, 'c', { controlId: 'model', value: 'b' }, 0))
    ).toBe('applied')
    expect(other.setControl).toHaveBeenCalledTimes(1)
    expect(other.setControl).toHaveBeenCalledWith('c', 'model', 'b', { remember: false })
  })

  it('absent du catalogue, refusé, ou retombé : jamais de repli', async () => {
    const model = (value: string) => ({ controlId: 'model', value })
    expect(await reasonOf(applyModelStrict(host('a').host, 'c', model('z'), 0))).toBe(
      'model-not-found'
    )
    const refused = host('a', ['a', 'b'], () => new Error('Invalid params: model not found: b'))
    const error = await applyModelStrict(refused.host, 'c', model('b'), 0).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(StrictModelError)
    expect(error).toMatchObject({
      reason: 'model-not-applied',
      detail: expect.stringMatching(/not found/)
    })
    const fallback = host('a', ['a', 'b'], () => 'a')
    expect(await reasonOf(applyModelStrict(fallback.host, 'c', model('b'), 0))).toBe(
      'model-not-applied'
    )
    const noSetting = {
      view: () => ({ snapshot: { controls: [] } }) as never,
      setControl: vi.fn() as never
    }
    expect(await reasonOf(applyModelStrict(noSetting, 'c', model('b'), 0))).toBe(
      'model-not-applied'
    )
  })
})
