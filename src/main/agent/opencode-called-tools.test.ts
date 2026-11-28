/**
 * Nom des outils appelés par l'outil `execute` d'OpenCode 2 (« Code Mode », fiche 293, lot 3) :
 * rejeu de la trace **réelle** du 2026-11-28 (OpenCode 2.3.0 connecté à Figma, panneau « Échanges
 * ACP » de Bobine 1.2.0-rc.2), gardée octet pour octet dans
 * `__traces__/opencode-2.3.0/acp-execute-figma.jsonl` ; puis des noms adverses.
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { AnyMessage, SessionUpdate } from '../../shared/acp-sdk.mts'
import {
  CALLED_TOOLS_META,
  MAX_CALLED_NAME,
  MAX_CALLED_TOOLS,
  calledToolsMark,
  calledToolsOf,
  type CalledToolsMark
} from '@shared/called-tools'
import { calledToolsText } from '@shared/called-tools-text'
import type { TranscriptItem } from '@shared/transcript'
import type { Trace } from './acp-trace'
import {
  OPENCODE_CALLED_TOOLS,
  OPENCODE_TOOL_STATUS,
  executeCalledTools
} from './opencode-contract'
import { ProfileUpdates } from './profile-updates'
import { replayTrace, type ReplayProfile } from './trace-replay'

const FIXTURE = join(__dirname, '__traces__', 'opencode-2.3.0', 'acp-execute-figma.jsonl')
const SESSION = 'ses_FAKESESSION'
const OPENCODE: ReplayProfile = {
  toolStatus: OPENCODE_TOOL_STATUS,
  calledTools: OPENCODE_CALLED_TOOLS
}

type ToolItem = Extract<TranscriptItem, { kind: 'tool' }>

/** Les 9 messages `session/update` relevés, dans l'ordre. */
const relevé = (): AnyMessage[] =>
  readFileSync(FIXTURE, 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as AnyMessage)

/**
 * Trace de rejeu : une conversation reprise (`session/resume`) et un message envoyé, puis les
 * messages relevés de l'agent (`count` premiers) ; `load` : reprise par `session/load` (rejeu).
 */
function trace(count: number, load = false): Trace {
  const client = (msg: unknown) => ({ from: 'client' as const, t: 0, msg: msg as AnyMessage })
  const start = load
    ? [client({ jsonrpc: '2.0', id: 1, method: 'session/load', params: { sessionId: SESSION } })]
    : [
        client({ jsonrpc: '2.0', id: 1, method: 'session/resume', params: { sessionId: SESSION } }),
        client({
          jsonrpc: '2.0',
          id: 2,
          method: 'session/prompt',
          params: { sessionId: SESSION, prompt: [{ type: 'text', text: 'whoami' }] }
        })
      ]
  return {
    header: {
      agent: 'opencode',
      version: '2.3.0',
      recordedAt: '2026-11-28',
      name: 'execute figma'
    },
    lines: [
      ...start,
      ...relevé()
        .slice(0, count)
        .map((msg, i) => ({ from: 'agent' as const, t: i + 1, msg }))
    ]
  }
}

const tools = (count: number, profile: ReplayProfile = OPENCODE, load = false): ToolItem[] =>
  replayTrace(trace(count, load), profile).transcript.items.filter(
    (i): i is ToolItem => i.kind === 'tool'
  )

/** Titre que montre la carte : celui des outils appelés, sinon le titre de l'agent. */
const shown = (item: ToolItem) =>
  item.calledTools ? calledToolsText(item.calledTools) : item.title

describe('trace réelle : `execute` d’OpenCode 2.3.0 connecté à Figma (fiche 293)', () => {
  it('la fixture est le relevé, octet pour octet (9 messages `session/update`)', () => {
    const bytes = readFileSync(FIXTURE)
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(
      'aa7ae641f1d0920aec29e075f23b06229a144387c2b1646bdc9d2d5cc6480e85'
    )
    const messages = relevé() as { method?: string }[]
    expect(messages).toHaveLength(9)
    expect(messages.every((m) => m.method === 'session/update')).toBe(true)
  })

  it('rejouée dans l’ordre : « execute » pendant l’appel, puis les deux titres attendus', () => {
    const titles = Array.from({ length: 9 }, (_, i) => tools(i + 1).map(shown))
    expect(titles).toEqual([
      ['execute'],
      ['execute'],
      ['execute'],
      // Fin de la 1re carte : `search` sans espace (la trace n'a que `query`) → libellé générique.
      ['Cherche parmi les outils'],
      ['Cherche parmi les outils', 'execute'],
      ['Cherche parmi les outils', 'execute'],
      ['Cherche parmi les outils', 'execute'],
      ['Cherche parmi les outils', 'execute'],
      ['Cherche parmi les outils', 'figma · whoami']
    ])
    const [search, whoami] = tools(9)
    expect(search?.calledTools).toEqual({ tools: [{ search: true }], total: 1 })
    expect(whoami?.calledTools).toEqual({ tools: [{ server: 'figma', tool: 'whoami' }], total: 1 })
    // La fin ne porte ni titre ni genre : la carte garde les siens, et finit « terminé ».
    expect(tools(9).map((t) => [t.title, t.toolKind, t.status])).toEqual([
      ['execute', 'other', 'completed'],
      ['execute', 'other', 'completed']
    ])
  })

  it('reprise par `session/load` (rejeu) : mêmes titres qu’en direct', () => {
    expect(tools(9, OPENCODE, true).map(shown)).toEqual([
      'Cherche parmi les outils',
      'figma · whoami'
    ])
  })

  it('agent sans la capacité (profil sans `calledTools`) : « execute », comme avant', () => {
    expect(tools(9, { toolStatus: OPENCODE_TOOL_STATUS }).map(shown)).toEqual([
      'execute',
      'execute'
    ])
  })

  it('carte dont la fin n’arrive jamais : « execute »', () => {
    // Les 3 premiers messages de la 2e carte, sans sa fin.
    expect(tools(8).map(shown)).toEqual(['Cherche parmi les outils', 'execute'])
  })

  it('la marque est posée par le main (`bobine/calledTools`), jamais lue chez l’agent', () => {
    const updates = new ProfileUpdates(OPENCODE, '/dossier')
    const marked = relevé().map(
      (m) => updates.adapt((m as { params: { update: SessionUpdate } }).params.update)._meta
    )
    expect(marked.map((meta) => meta?.[CALLED_TOOLS_META] !== undefined)).toEqual([
      false,
      false,
      false,
      true,
      false,
      false,
      false,
      false,
      true
    ])
    // Une marque envoyée par l'agent lui-même n'est jamais la nôtre : retirée, avec ou sans la
    // capacité (et remplacée par ce que l'agent nomme, s'il nomme quelque chose).
    const forged = (toolCalls?: unknown[]) =>
      ({
        sessionUpdate: 'tool_call_update',
        toolCallId: 'x',
        status: 'completed',
        ...(toolCalls ? { rawOutput: { metadata: { toolCalls } } } : {}),
        _meta: { [CALLED_TOOLS_META]: { tools: [{ tool: 'faux' }], total: 1 }, autre: 1 }
      }) as SessionUpdate
    const without = new ProfileUpdates({ toolStatus: OPENCODE_TOOL_STATUS }, '/d').adapt(forged())
    expect(calledToolsOf(without)).toBeUndefined()
    expect(without._meta).toEqual({ autre: 1 })
    expect(calledToolsOf(new ProfileUpdates(OPENCODE, '/d').adapt(forged()))).toBeUndefined()
    expect(
      calledToolsOf(new ProfileUpdates(OPENCODE, '/d').adapt(forged([{ tool: 'figma.whoami' }])))
    ).toEqual({ tools: [{ server: 'figma', tool: 'whoami' }], total: 1 })
  })
})

describe('lecture de `toolCalls[]` par l’adaptateur d’OpenCode (fiche 293)', () => {
  const done = (toolCalls: unknown, status = 'completed'): SessionUpdate =>
    ({
      sessionUpdate: 'tool_call_update',
      toolCallId: 'c',
      status,
      rawOutput: { metadata: { toolCalls } }
    }) as SessionUpdate

  it('serveur au premier point seulement ; sans point, ou point en bord : pas de serveur', () => {
    expect(
      executeCalledTools(
        done([
          { tool: 'figma.whoami' },
          { tool: 'figma.files.get' },
          { tool: 'whoami' },
          { tool: '.whoami' },
          { tool: 'figma.' }
        ])
      )?.tools
    ).toEqual([
      { server: 'figma', tool: 'whoami' },
      { server: 'figma', tool: 'files.get' },
      { tool: 'whoami' },
      { tool: '.whoami' },
      { tool: 'figma.' }
    ])
  })

  it('`search` : une recherche ; son espace pris s’il est donné (hypothèse, non gardée en octets)', () => {
    expect(
      executeCalledTools(
        done([
          { tool: 'search', input: { query: 'figma', limit: 20 } },
          // Hypothèse : relevée le 2026-11-27 à l'écran, pas gardée en octets.
          { tool: 'search', input: { namespace: 'figma', limit: 100 } },
          { tool: 'search', input: { namespace: 42 } }
        ])
      )?.tools
    ).toEqual([{ search: true }, { search: true, server: 'figma' }, { search: true }])
  })

  it('rien pendant l’appel, ni sans `toolCalls`, ni sur une autre mise à jour', () => {
    expect(executeCalledTools(done([{ tool: 'figma.whoami' }], 'in_progress'))).toBeUndefined()
    expect(executeCalledTools(done([]))).toBeUndefined()
    expect(executeCalledTools(done('figma.whoami'))).toBeUndefined()
    expect(executeCalledTools(done([{ tool: 42 }, null, 'x']))).toBeUndefined()
    expect(
      executeCalledTools({
        sessionUpdate: 'tool_call',
        toolCallId: 'c',
        title: 'execute',
        rawOutput: { metadata: { toolCalls: [{ tool: 'figma.whoami' }] } }
      } as SessionUpdate)
    ).toBeUndefined()
  })

  it('appel en échec : nommé aussi ; la carte reste en échec (fiche 122)', () => {
    const update = done([{ tool: 'figma.whoami', status: 'error' }])
    const adapted = new ProfileUpdates(OPENCODE, '/d').adapt(update)
    expect(adapted).toMatchObject({ status: 'failed' })
    expect(calledToolsOf(adapted)).toEqual({
      tools: [{ server: 'figma', tool: 'whoami' }],
      total: 1
    })
  })
})

describe('noms adverses : des données, bornées et nettoyées (fiche 293)', () => {
  const mark = (toolCalls: unknown[]): CalledToolsMark | undefined => {
    const read = executeCalledTools({
      sessionUpdate: 'tool_call_update',
      toolCallId: 'c',
      status: 'completed',
      rawOutput: { metadata: { toolCalls } }
    } as SessionUpdate)
    return read && calledToolsMark(read.tools, read.total)
  }

  it('nom géant : raccourci par « … », borné', () => {
    const giant = mark([{ tool: `figma.${'w'.repeat(100_000)}` }])
    const tool = giant?.tools[0]
    expect(tool && 'tool' in tool ? [...tool.tool].length : 0).toBe(MAX_CALLED_NAME)
    expect(tool && 'tool' in tool ? tool.tool.endsWith('…') : false).toBe(true)
  })

  it('5 000 appels : les premiers gardés, tous comptés, « +N » vrai', () => {
    const many = mark(Array.from({ length: 5000 }, (_, i) => ({ tool: `figma.t${i}` })))
    expect(many?.tools).toHaveLength(MAX_CALLED_TOOLS)
    expect(many?.total).toBe(5000)
    expect(many && calledToolsText(many)).toBe('figma · t0, t1, t2 +4997')
    const same = mark(Array.from({ length: 5000 }, () => ({ tool: 'figma.whoami' })))
    // Les appels au-delà de la marque ne sont pas connus : comptés, jamais devinés.
    expect(same && calledToolsText(same)).toBe(`figma · whoami +${5000 - MAX_CALLED_TOOLS}`)
  })

  it('caractères de contrôle, retours à la ligne, sens d’écriture, largeur nulle : retirés', () => {
    const dirty = mark([
      { tool: 'fig\nma.who\r\nami' },
      { tool: 'a\u202eb.c\u200bd\u0000e' },
      { tool: 'x.\u2028y\u2029' }
    ])
    expect(dirty?.tools).toEqual([
      { server: 'fig ma', tool: 'who ami' },
      { server: 'a b', tool: 'c d e' },
      { server: 'x', tool: 'y' }
    ])
    for (const tool of dirty?.tools ?? []) {
      expect(JSON.stringify(tool)).not.toMatch(/\\n|\\r|\\u0000|\u202e|\u200b|\u2028/)
    }
  })

  it('HTML : gardé tel quel comme texte (React l’échappe), jamais interprété', () => {
    expect(mark([{ tool: '<img src=x onerror=alert(1)>.<b>x</b>' }])?.tools).toEqual([
      { server: '<img src=x onerror=alert(1)>', tool: '<b>x</b>' }
    ])
  })

  it('vide, blanc, non chaîne : écartés ; s’il ne reste rien, pas de marque', () => {
    expect(mark([{ tool: '' }, { tool: '   ' }, { tool: 7 }, { tool: ['a'] }, {}])).toBeUndefined()
    expect(mark([{ tool: '\u0000\u200b' }])).toBeUndefined()
    expect(mark([{ tool: '' }, { tool: 'figma.whoami' }])?.tools).toEqual([
      { server: 'figma', tool: 'whoami' }
    ])
  })

  it('marque relue (fil gardé sur le disque) : nettoyée de nouveau, mal formée = ignorée', () => {
    const relu = (value: unknown) => calledToolsOf({ _meta: { [CALLED_TOOLS_META]: value } })
    expect(relu('figma')).toBeUndefined()
    expect(relu({ tools: 'x' })).toBeUndefined()
    expect(relu({ tools: [{ tool: 'a\nb' }], total: -3 })).toEqual({
      tools: [{ tool: 'a b' }],
      total: 1
    })
    expect(relu({ tools: [{ search: 'oui' }] })).toBeUndefined()
    // Nom non chaîne dans une marque relue : jamais converti en texte.
    expect(relu({ tools: [{ tool: 7 }, { tool: ['a'] }, { server: {}, tool: 'x' }] })).toEqual({
      tools: [{ tool: 'x' }],
      total: 3
    })
    expect(relu({ tools: [{ search: true, server: '\u0000' }], total: 2 })).toEqual({
      tools: [{ search: true }],
      total: 2
    })
  })
})
