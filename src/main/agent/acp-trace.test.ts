import { mkdtempSync, readFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { AnyMessage, Stream } from '../../shared/acp-sdk.mts'
import {
  formatTrace,
  parseTrace,
  ProbeTraces,
  sanitize,
  TraceRecorder,
  traceFileName
} from './acp-trace'

/** Paire de flux reliés : ce que l'un écrit, l'autre le lit. */
function pipe(): { app: Stream; agent: Stream } {
  const toAgent = new TransformStream<AnyMessage, AnyMessage>()
  const toApp = new TransformStream<AnyMessage, AnyMessage>()
  return {
    app: { readable: toApp.readable, writable: toAgent.writable },
    agent: { readable: toAgent.readable, writable: toApp.writable }
  }
}

describe('traces ACP (fiche 139)', () => {
  it('nettoie : chemins jetables et dossier personnel remplacés, secrets masqués', () => {
    const msg = {
      cwd: '/tmp/sonde-123/projet',
      home: `${homedir()}/.bob`,
      url: 'http://127.0.0.1:5000/mcp/0123456789abcdef0123',
      env: { BOB_API_KEY: 'cle-tres-secrete' }
    }
    expect(sanitize(msg, { dossier: '/tmp/sonde-123/projet', home: '/tmp/sonde-123' })).toEqual({
      cwd: '<dossier>',
      home: '<maison>/.bob',
      url: 'http://127.0.0.1:5000/mcp/«masqué»',
      env: { BOB_API_KEY: '«masqué»' }
    })
  })

  it('NDJSON : en-tête puis une ligne par message, relu à l’identique', () => {
    const trace = {
      header: { agent: 'bob', version: '2.0.6', recordedAt: '2026-10-24', name: 'initialize' },
      lines: [
        { from: 'client' as const, t: 0, msg: { jsonrpc: '2.0', id: 0, method: 'initialize' } },
        { from: 'agent' as const, t: 5, msg: { jsonrpc: '2.0', id: 0, result: {} } }
      ]
    } as Parameters<typeof formatTrace>[0]
    const text = formatTrace(trace)
    expect(text.trim().split('\n')).toHaveLength(3)
    expect(parseTrace(text)).toEqual(trace)
    expect(() => parseTrace('{"from":"client"}\n')).toThrow(/en-tête/)
  })

  it('enregistre les deux sens d’une connexion, nettoyés, sans rien changer aux messages', async () => {
    const { app, agent } = pipe()
    const recorder = new TraceRecorder(
      { agent: 'bob', version: '2.0.6', recordedAt: '2026-10-24', name: 'essai' },
      { dossier: '/tmp/x' }
    )
    const traced = recorder.tap(app)
    const request = { jsonrpc: '2.0', id: 1, method: 'session/new', params: { cwd: '/tmp/x' } }
    const writer = traced.writable.getWriter()
    void writer.write(request as AnyMessage)
    const received = await agent.readable.getReader().read()
    expect(received.value).toEqual(request)
    const answer = { jsonrpc: '2.0', id: 1, result: { sessionId: 's' } }
    void agent.writable.getWriter().write(answer as AnyMessage)
    expect((await traced.readable.getReader().read()).value).toEqual(answer)
    expect(recorder.trace().lines.map((l) => [l.from, l.msg])).toEqual([
      ['client', { ...request, params: { cwd: '<dossier>' } }],
      ['agent', answer]
    ])
  })

  it('sonde : sans --traces, le flux est rendu tel quel ; avec, une trace par connexion', () => {
    const { app } = pipe()
    expect(new ProbeTraces('bob', false).connection(app, {})).toBe(app)
    const traces = new ProbeTraces('opencode', true)
    traces.current = 'réponse simple'
    traces.connection(pipe().app, {})
    traces.connection(pipe().app, {})
    const root = mkdtempSync(join(tmpdir(), 'traces-'))
    const files = traces.save(root, '2.0.32')
    expect(files.map((f) => f.slice(root.length + 1))).toEqual([
      'opencode-2.0.32/reponse-simple.ndjson',
      'opencode-2.0.32/reponse-simple-2.ndjson'
    ])
    expect(parseTrace(readFileSync(files[0] ?? '', 'utf8')).header).toMatchObject({
      agent: 'opencode',
      version: '2.0.32',
      name: 'réponse simple'
    })
  })

  it('nom de fichier d’un sondage', () => {
    expect(traceFileName('session/load, resume, delete')).toBe('session-load-resume-delete')
    expect(traceFileName('Outils de l’app')).toBe('outils-de-l-app')
  })
})
