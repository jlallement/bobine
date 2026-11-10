import { describe, expect, it } from 'vitest'
import {
  applyTerminalPatch,
  MAX_TERMINAL_OUTPUT,
  parseAnsi,
  terminalPatchOf
} from './terminal-output'

describe('sortie des commandes (extension de terminal)', () => {
  it('terminalPatchOf : formes réelles de Codex', () => {
    expect(terminalPatchOf({ terminal_info: { terminal_id: 't1', cwd: '/p' } })).toEqual({
      terminalId: 't1'
    })
    expect(
      terminalPatchOf({
        terminal_output_delta: { data: 'bonjour\n', terminal_id: 't1' },
        terminal_exit: { exit_code: 0, signal: null, terminal_id: 't1' }
      })
    ).toEqual({ terminalId: 't1', append: 'bonjour\n', exit: { exitCode: 0, signal: null } })
    expect(terminalPatchOf({ terminal_output: { terminal_id: 't1', data: 'tout' } })).toEqual({
      terminalId: 't1',
      replace: 'tout'
    })
    expect(terminalPatchOf({ autre: 1 })).toBeUndefined()
    expect(terminalPatchOf(null)).toBeUndefined()
  })

  it('applyTerminalPatch : ajout, remplacement, fin, troncature', () => {
    let state = applyTerminalPatch(undefined, { terminalId: 't', append: 'a' })
    state = applyTerminalPatch(state, { terminalId: 't', append: 'b' })
    expect(state).toEqual({ output: 'ab' })
    state = applyTerminalPatch(state, { terminalId: 't', exit: { exitCode: 2, signal: null } })
    expect(state).toEqual({ output: 'ab', exitCode: 2, signal: null, exited: true })
    const big = applyTerminalPatch(undefined, {
      terminalId: 't',
      append: 'x'.repeat(MAX_TERMINAL_OUTPUT + 10)
    })
    expect(big.output).toHaveLength(MAX_TERMINAL_OUTPUT)
    expect(big.truncated).toBe(true)
  })

  it('parseAnsi : couleurs, gras, réinitialisation ; autres séquences retirées', () => {
    expect(parseAnsi('\u001b[32m✓\u001b[39m ok \u001b[1;31mKO\u001b[0m fin')).toEqual([
      { text: '✓', color: 'green' },
      { text: ' ok ' },
      { text: 'KO', color: 'red', bold: true },
      { text: ' fin' }
    ])
    expect(parseAnsi('\u001b[2K\u001b[1Gprogression\r100 %\n')).toEqual([
      { text: 'progression100 %\n' }
    ])
    expect(parseAnsi('\u001b[94mbleu vif')).toEqual([{ text: 'bleu vif', color: 'bright-blue' }])
  })
})
