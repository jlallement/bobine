import { describe, expect, it } from 'vitest'
import { windowsPtyOptions } from './node-pty'

describe('ConPTY de node-pty sous Windows (fiche 229)', () => {
  it('Windows : conpty.dll livrée (pas de fork d’agent, interdit par le fusible RunAsNode)', () => {
    expect(windowsPtyOptions('windows')).toEqual({ useConptyDll: true })
  })

  it('macOS et Linux : aucune option de plus, comme avant', () => {
    expect(windowsPtyOptions('posix')).toEqual({})
  })
})
