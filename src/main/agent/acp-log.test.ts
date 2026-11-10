import { describe, expect, it } from 'vitest'
import { AcpLog, type AcpLogSink } from './acp-log'

function setup(level: 'normal' | 'detailed' | 'trace' = 'detailed') {
  const lines: string[] = []
  let now = 1000
  const sink: AcpLogSink = {
    write: (text) => lines.push(text),
    detailed: () => level !== 'normal',
    trace: () => level === 'trace'
  }
  const acp = new AcpLog(sink, () => now)
  const send = (direction: 'in' | 'out', message: object) =>
    acp.bytes(direction, new TextEncoder().encode(`${JSON.stringify(message)}\n`))
  return { lines, acp, send, tick: (ms: number) => (now += ms) }
}

const update = (u: object, sessionId = 'ses_1234567890abcdef') => ({
  jsonrpc: '2.0',
  method: 'session/update',
  params: { sessionId, update: u }
})

describe('relevé ACP (fiche 080)', () => {
  it('requête, réponse et temps de réponse, dans les deux sens', () => {
    const t = setup()
    t.send('out', {
      jsonrpc: '2.0',
      id: 3,
      method: 'session/prompt',
      params: { sessionId: 'ses_1234567890abcdef', prompt: [{ type: 'text', text: 'Bonjour' }] }
    })
    t.tick(2500)
    t.send('in', { jsonrpc: '2.0', id: 3, result: { stopReason: 'end_turn' } })
    expect(t.lines[0]).toMatch(/^→ session\/prompt #3 s …90abcdef, 1 bloc\(s\) text \(\d+ o\)$/)
    expect(t.lines[1]).toMatch(/^← réponse #3 session\/prompt end_turn en 2\.5 s \(\d+ o\)$/)
  })

  it('morceaux de texte regroupés par message ; outils résumés ; erreur lisible', () => {
    const t = setup()
    for (const text of ['Bon', 'jour', ' !'])
      t.send(
        'in',
        update({
          sessionUpdate: 'agent_message_chunk',
          messageId: 'm1',
          content: { type: 'text', text }
        })
      )
    t.send(
      'in',
      update({
        sessionUpdate: 'tool_call',
        toolCallId: 'call_1',
        title: 'execute',
        kind: 'other',
        status: 'pending',
        rawInput: {}
      })
    )
    t.send(
      'in',
      update({
        sessionUpdate: 'tool_call_update',
        toolCallId: 'call_1',
        status: 'completed',
        content: [
          { type: 'content', content: { type: 'text', text: 'ok' } },
          { type: 'content', content: { type: 'image', data: 'AA', mimeType: 'image/png' } }
        ]
      })
    )
    t.send('out', {
      jsonrpc: '2.0',
      id: 9,
      method: 'session/load',
      params: { sessionId: 's', mcpServers: [{}] }
    })
    t.send('in', { jsonrpc: '2.0', id: 9, error: { code: -32603, message: 'Internal error' } })
    expect(t.lines).toEqual([
      expect.stringMatching(/^← agent_message_chunk ×3 \(9 car\.\)$/),
      expect.stringMatching(/^← tool_call call_1 « execute » other pending entrée \[s …90abcdef\]/),
      expect.stringMatching(
        /^← tool_call_update call_1 completed contenu 1 text, 1 image \[s …90abcdef\]/
      ),
      expect.stringMatching(/^→ session\/load #9 s s, 1 serveur\(s\) MCP /),
      expect.stringMatching(/^← erreur #9 session\/load -32603 « Internal error » en 0 ms/)
    ])
  })

  it('niveau Normal : rien d’analysé ni d’écrit', () => {
    const t = setup('normal')
    t.send('in', update({ sessionUpdate: 'plan', entries: [] }))
    t.acp.flush()
    expect(t.lines).toEqual([])
  })

  it('Trace : extraits du contenu, secrets masqués ; lignes coupées en plusieurs morceaux', () => {
    const t = setup('trace')
    const message = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'session/new',
      params: {
        cwd: '/projet',
        mcpServers: [{ url: 'http://127.0.0.1:1/mcp/0123456789abcdef0123456789abcdef' }]
      }
    })
    const bytes = new TextEncoder().encode(`${message}\n`)
    t.acp.bytes('out', bytes.slice(0, 20))
    t.acp.bytes('out', bytes.slice(20))
    t.send(
      'in',
      update({
        sessionUpdate: 'tool_call_update',
        toolCallId: 'x',
        status: 'in_progress',
        rawInput: { code: 'await tools.bobine.browser_screenshot({})' }
      })
    )
    expect(t.lines[0]).toContain('/mcp/«masqué»')
    expect(t.lines[0]).not.toContain('0123456789abcdef')
    expect(t.lines[1]).toContain('entrée {"code":"await tools.bobine.browser_screenshot({})"}')
  })

  it('les morceaux de texte en attente sont écrits à la fin du tour', () => {
    const t = setup('trace')
    t.send(
      'in',
      update({
        sessionUpdate: 'agent_thought_chunk',
        content: { type: 'text', text: 'Je réfléchis' }
      })
    )
    expect(t.lines).toEqual([])
    t.acp.flush()
    expect(t.lines).toEqual(['← agent_thought_chunk ×1 (12 car.) : Je réfléchis'])
  })

  it('récepteur `lines` : chaque ligne entière, même en Normal, coupée n’importe où (fiche 135)', () => {
    const lines: string[] = []
    const written: string[] = []
    const acp = new AcpLog({
      write: (text) => written.push(text),
      detailed: () => false,
      trace: () => false,
      lines: (direction, line) => lines.push(`${direction} ${line}`)
    })
    const text =
      '{"jsonrpc":"2.0","id":1,"method":"initialize"}\n\n{"jsonrpc":"2.0","id":1,"result":{}}\n{"a":'
    const bytes = new TextEncoder().encode(text)
    for (let i = 0; i < bytes.length; i += 7) acp.bytes('in', bytes.slice(i, i + 7))
    acp.bytes('in', new TextEncoder().encode('1}\n'))
    expect(lines).toEqual([
      'in {"jsonrpc":"2.0","id":1,"method":"initialize"}',
      'in {"jsonrpc":"2.0","id":1,"result":{}}',
      'in {"a":1}'
    ])
    expect(written).toEqual([])
  })
})
