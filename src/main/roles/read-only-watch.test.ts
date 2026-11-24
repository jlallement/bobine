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

const REVIEWER = summary('r', {
  title: 'Relecture',
  startedFrom: { id: 'm', title: 'm' },
  reviewOf: { id: 'm', title: 'm' },
  role: {
    name: 'code-reviewer',
    label: 'Code reviewer',
    icon: 'bot',
    color: 'blue',
    readOnly: true
  }
})

/** git factice : `git status` rend l'état courant du dossier. */
function setup() {
  let folder = 'propre'
  let failing = false
  const run: Run = async (_file, args) => ({
    code: failing ? 128 : 0,
    stdout: Buffer.from(args[0] === 'status' ? folder : ''),
    stderr: ''
  })
  const posted: [string, AgentEvent][] = []
  const changed: string[] = []
  const watch = new ReadOnlyWatch({
    conversations: { post: (id, event) => posted.push([id, event]) > 0 },
    summary: (id) => (id === 'f' ? CHILD : id === 'r' ? REVIEWER : summary(id)),
    run,
    changed: (id) => changed.push(id)
  })
  const send = (id: string, event: AgentEvent) => watch.onEvent({ conversationId: id, event })
  const settle = () => new Promise((resolve) => setTimeout(resolve, 20))
  return {
    watch,
    posted,
    changed,
    send,
    settle,
    write: () => {
      folder = `${folder}+`
    },
    fail: () => {
      failing = true
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

  it('git en échec : pas de jugement, mais c’est dit dans le fil de la fille', async () => {
    const s = setup()
    await s.watch.prepare('f')
    s.send('f', userMessage)
    s.fail()
    s.send('f', turnEnd)
    await s.settle()
    expect(s.posted.map(([id, e]) => [id, e.type === 'notice' && e.message])).toEqual([
      ['f', { key: 'roles.notice.watchFailed' }]
    ])
  })

  it('un second message pendant le tour garde l’empreinte de départ', async () => {
    const s = setup()
    await s.watch.prepare('f')
    s.send('f', userMessage)
    s.write()
    s.send('f', userMessage)
    s.send('f', turnEnd)
    await s.settle()
    expect(s.posted.map(([id]) => id)).toEqual(['f', 'm'])
  })

  it('Code reviewer (fiche 265) : suivi comme un rôle en lecture seule, l’écart dit à sa carte', async () => {
    const s = setup()
    await s.watch.prepare('r')
    s.send('r', userMessage)
    s.write()
    s.send('r', turnEnd)
    await s.watch.settled('r')
    expect(s.changed).toEqual(['r'])
    // Texte neutre dans son fil : le dossier a changé, sans accuser la relecture.
    expect(s.posted[0]).toEqual([
      'r',
      expect.objectContaining({ message: { key: 'roles.notice.folderChanged' } })
    ])
  })

  it('Code reviewer : la mère écrit pendant la relecture, ni avis ni carte « dossier changé »', async () => {
    const s = setup()
    await s.watch.prepare('r')
    s.send('r', userMessage)
    s.send('m', {
      type: 'update',
      update: { sessionUpdate: 'tool_call', toolCallId: 'x', title: 'Edit', kind: 'edit' }
    })
    s.write()
    s.send('r', turnEnd)
    await s.watch.settled('r')
    expect(s.posted).toEqual([])
    expect(s.changed).toEqual([])
  })

  it('Code reviewer : git en échec n’est pas « inchangé », l’avis de surveillance est donné', async () => {
    const s = setup()
    await s.watch.prepare('r')
    s.send('r', userMessage)
    s.fail()
    s.send('r', turnEnd)
    await s.watch.settled('r')
    expect(s.posted.map(([id, e]) => [id, e.type === 'notice' && e.message])).toEqual([
      ['r', { key: 'roles.notice.watchFailed' }]
    ])
    expect(s.changed).toEqual([])
  })

  it('fiche 285 : participants d’un même tour — un outil des autres ne les rend pas « partagés », un écart est dit à tous ceux qui se chevauchent', async () => {
    let folder = 'propre'
    const run: Run = async (_file, args) => ({
      code: 0,
      stdout: Buffer.from(args[0] === 'status' ? folder : ''),
      stderr: ''
    })
    const changed: string[] = []
    const unjudged: string[] = []
    const participant = (id: string) => summary(id, { ...CHILD, id })
    const watch = new ReadOnlyWatch({
      conversations: { post: () => true },
      summary: (id) => (id === 'm' ? summary('m') : participant(id)),
      run,
      changed: (id) => changed.push(id),
      group: (id) => (id === 'a' || id === 'b' ? 'tour' : undefined),
      unjudged: (id) => unjudged.push(id)
    })
    const send = (id: string, event: AgentEvent) => watch.onEvent({ conversationId: id, event })
    const execute: AgentEvent = {
      type: 'update',
      update: { sessionUpdate: 'tool_call', toolCallId: 't', title: 'cat', kind: 'execute' }
    }
    send('a', userMessage)
    send('b', userMessage)
    // Les deux lisent par le shell ; `a` écrit en plus.
    send('a', execute)
    send('b', execute)
    // Empreintes de départ prises (le git factice répond au tour de boucle suivant).
    await new Promise((resolve) => setTimeout(resolve, 20))
    folder = `${folder}+`
    send('a', turnEnd)
    send('b', turnEnd)
    await Promise.all([watch.settled('a'), watch.settled('b')])
    expect([...new Set(changed)].sort()).toEqual(['a', 'b'])
    expect(unjudged).toEqual([])
    // Un outil d'une autre conversation du dossier (la mère) : le tour n'est pas jugé, et c'est dit.
    send('a', userMessage)
    send('m', execute)
    send('a', turnEnd)
    await watch.settled('a')
    expect(unjudged).toEqual(['a'])
  })
})
