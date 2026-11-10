import { describe, expect, it } from 'vitest'
import { buildInfo } from './build-info'

describe('date et commit du build (fiche 116)', () => {
  it('hors build : date du jour et « dev »', () => {
    expect(buildInfo(new Date(2026, 9, 2, 23, 30))).toEqual({ date: '2026-10-02', commit: 'dev' })
  })
})
