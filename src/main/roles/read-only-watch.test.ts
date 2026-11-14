import { describe, expect, it } from 'vitest'
import type { AgentEvent, ConversationSummary } from '@shared/agent'
import type { Run } from '../simulator/run'
import { ReadOnlyWatch } from './read-only-watch'

const summary = (id: string, extra: Partial<ConversationSummary> = {}): ConversationSummary => ({
  id,
  title: id,
  profileId: 'mock',
  profileLabel: 'Factice',
  workspace: '/depot',
  updatedAt: '',
  status: 'ready',
  draft: false,
  ...extra
})

const CHILD = summary('f', {
  title: 'Audit',
  startedFrom: { id: 'm', title: 'm' },
  role: { name: 'r', label: 'R', icon: 'bot', color: 'blue', readOnly: true }
})

/** git factice : `git status` rend l'état courant du dossier. */
function setup() {
  let folder = 'propre'
  const run: Run = async (_file, args) => ({
    code: 0,
    stdout: Buffer.from(args[0] === 'status' ? folder : ''),
    stderr: ''
  })
  const posted: [string, AgentEvent][] = []
  const watch = new ReadOnlyWatch({
    conversations: { post: (id, event) => posted.push([id, event]) },
    summary: (id) => (id === 'f' ? CHILD : summary(id)),
    run
  })
  const send = (id: string, event: AgentEvent) => watch.onEvent({ conversationId: id, event })
  const settle = () => new Promise((resolve) => setTimeout(resolve, 20))
  return {
    watch,
    posted,
    send,
    settle,
    write: () => {
      folder = `${folder}+`
    }
  }
}

const userMessage: AgentEvent = { type: 'user-message', text: 't', at: 0 }
const turnEnd: AgentEvent = { type: 'turn-end', stopReason: 'end_turn' }

describe('garde-fou des rôles en lecture seule (fiche 223)', () => {
  it('un dossier changé pendant le tour est dit à la fille et à sa mère', async () => {
    const s = setup()
    await s.watch.prepare('f')
    s.send('f', userMessage)
    s.write()
    s.send('f', turnEnd)
    await s.settle()
    expect(s.posted.map(([id, e]) => [id, e.type === 'notice' && e.message])).toEqual([
      ['f', { key: 'roles.notice.folderChanged' }],
      ['m', { key: 'roles.notice.childFolderChanged', params: { title: 'Audit' } }]
    ])
  })

  it('rien à dire si le dossier n’a pas changé', async () => {
    const s = setup()
    s.send('f', userMessage)
    await s.settle()
    s.send('f', turnEnd)
    await s.settle()
    expect(s.posted).toEqual([])
  })

  it('pas d’accusation quand une autre conversation du dossier lançait un outil qui écrit', async () => {
    const s = setup()
    await s.watch.prepare('f')
    s.send('f', userMessage)
    s.send('m', {
      type: 'update',
      update: { sessionUpdate: 'tool_call', toolCallId: 'x', title: 'Edit', kind: 'edit' }
    })
    s.write()
    s.send('f', turnEnd)
    await s.settle()
    expect(s.posted).toEqual([])
    expect(s.watch.watching).toBe(0)
  })

  it('une fille sans rôle en lecture seule n’est pas suivie', async () => {
    const s = setup()
    await s.watch.prepare('m')
    s.send('m', userMessage)
    expect(s.watch.watching).toBe(0)
  })
})
