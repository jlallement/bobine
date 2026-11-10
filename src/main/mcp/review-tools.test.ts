import { describe, expect, it, vi } from 'vitest'
import { reportFindingsTool } from './review-tools'

describe('outil `report_findings` (fiche 177)', () => {
  it('autorisé d’office ; rapport transmis pour son relecteur, réponse en texte', async () => {
    const report = vi.fn(async () => 'ok')
    const tool = reportFindingsTool('r', { report })
    expect(tool.definition.name).toBe('report_findings')
    expect(tool.autoAllow).toBe(true)
    expect(tool.definition.inputSchema).toMatchObject({ required: ['findings'] })
    const result = await tool.call({ findings: [] })
    expect(report).toHaveBeenCalledWith('r', { findings: [] })
    expect(result.content).toEqual([{ type: 'text', text: 'ok' }])
  })
})
