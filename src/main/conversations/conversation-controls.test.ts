import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { ControlValue, SessionControl } from '@shared/agent'
import { MOCK_AGENT_ENTRY } from '../../mock-agent/testing.mts'
import type { AgentProfile } from '../agent/profiles'
import {
  noteSessionControls,
  openingControls,
  parseConversationControls
} from './conversation-controls'
import { noteSession } from './helpers'
import { ConversationManager } from './manager'
import { ConversationStore, type ConversationRecord } from './store'

const record = (fields: Partial<ConversationRecord> = {}): ConversationRecord => ({
  id: 'c1',
  title: 'Titre',
  titleSource: 'message',
  profileId: 'opencode',
  workspace: '/projet',
  createdAt: '2026-11-19T10:00:00Z',
  updatedAt: '2026-11-19T10:00:00Z',
  ...fields
})

const control = (id: string, currentValue: ControlValue): SessionControl => ({
  id,
  name: id,
  type: typeof currentValue === 'boolean' ? 'boolean' : 'select',
  currentValue,
  options: []
})

describe('openingControls (fiche 256)', () => {
  const profile = { id: 'opencode', defaultControls: { verbose: false } }
  const own = { profileId: 'opencode', values: { mode: 'plan', model: 'y' } }
  const lastChoice = { mode: 'build', model: 'x' }

  it('réouverture : les réglages de la conversation, jamais le dernier choix fait ailleurs', () => {
    expect(openingControls(record({ controls: own }), profile, lastChoice, 'reopened')).toEqual({
      mode: 'plan',
      model: 'y'
    })
  })

  it('réouverture sans réglages mémorisés : rien, la session garde ce qu’elle annonce', () => {
    expect(openingControls(record(), profile, lastChoice, 'reopened')).toBeUndefined()
  })

  it('session neuve dans la conversation (session perdue, aparté) : ses réglages aussi', () => {
    expect(openingControls(record({ controls: own }), profile, lastChoice, 'new')).toEqual({
      mode: 'plan',
      model: 'y'
    })
  })

  it('nouvelle conversation : dernier choix du profil par-dessus ses défauts', () => {
    expect(openingControls(record(), profile, lastChoice, 'new')).toEqual({
      verbose: false,
      mode: 'build',
      model: 'x'
    })
    expect(openingControls(record(), profile, undefined, 'new')).toEqual({ verbose: false })
  })

  it('réglages relevés avec un autre agent (bascule) : ignorés', () => {
    const other = { profileId: 'bob', values: { mode: 'plan' } }
    expect(openingControls(record({ controls: other }), profile, lastChoice, 'reopened')).toBe(
      undefined
    )
    expect(openingControls(record({ controls: other }), profile, lastChoice, 'new')).toEqual({
      verbose: false,
      mode: 'build',
      model: 'x'
    })
  })

  it('rend une copie : la fiche ne change pas si l’appelant modifie le résultat', () => {
    const conversation = record({ controls: { profileId: 'opencode', values: { mode: 'plan' } } })
    const values = openingControls(conversation, profile, undefined, 'reopened')
    if (values) values['mode'] = 'build'
    expect(conversation.controls?.values).toEqual({ mode: 'plan' })
  })
})

describe('noteSessionControls (fiche 256)', () => {
  const controls = [control('mode', 'plan'), control('model', 'y'), control('verbose', true)]

  it('session stable (prête ou au travail) : toutes les valeurs relevées, pour l’agent courant', () => {
    const conversation = record()
    expect(noteSessionControls(conversation, { status: 'ready', controls })).toBe(true)
    expect(conversation.controls).toEqual({
      profileId: 'opencode',
      values: { mode: 'plan', model: 'y', verbose: true }
    })
    // Inchangé : rien à enregistrer.
    expect(noteSessionControls(conversation, { status: 'busy', controls })).toBe(false)
    // Changé pendant un tour (mode changé par l'agent) : relevé.
    const changed = [control('mode', 'build'), control('model', 'y'), control('verbose', true)]
    expect(noteSessionControls(conversation, { status: 'busy', controls: changed })).toBe(true)
    expect(conversation.controls?.values['mode']).toBe('build')
  })

  it('pendant l’ouverture ou sans session : rien relevé (valeurs encore celles de l’agent)', () => {
    const conversation = record({ controls: { profileId: 'opencode', values: { mode: 'plan' } } })
    for (const status of ['starting', 'idle', 'error', 'exited', 'needs-action', 'read-only']) {
      const snapshot = { status: status as 'starting', controls: [control('mode', 'build')] }
      expect(noteSessionControls(conversation, snapshot)).toBe(false)
    }
    expect(noteSessionControls(conversation, { status: 'ready', controls: [] })).toBe(false)
    expect(conversation.controls?.values).toEqual({ mode: 'plan' })
  })

  it('la liste remplace la précédente : un réglage disparu n’est plus réappliqué', () => {
    const conversation = record({
      controls: { profileId: 'opencode', values: { model: 'x', effort: 'high' } }
    })
    expect(
      noteSessionControls(conversation, { status: 'ready', controls: [control('model', 'y')] })
    ).toBe(true)
    expect(conversation.controls?.values).toEqual({ model: 'y' })
  })

  it('après une bascule : relevés pour le nouvel agent, même valeurs comprises', () => {
    const conversation = record({ controls: { profileId: 'bob', values: { mode: 'plan' } } })
    expect(
      noteSessionControls(conversation, { status: 'ready', controls: [control('mode', 'plan')] })
    ).toBe(true)
    expect(conversation.controls?.profileId).toBe('opencode')
  })
})

describe('noteSession', () => {
  const snapshot = { status: 'ready' as const, controls: [control('mode', 'plan')] }

  it('identifiant et réglages relevés ; index à réécrire seulement si quelque chose a changé', () => {
    const conversation = { record: record(), draft: false }
    expect(noteSession(conversation, 's1', snapshot)).toBe(true)
    expect(conversation.record).toMatchObject({
      sessionId: 's1',
      controls: { values: { mode: 'plan' } }
    })
    expect(noteSession(conversation, 's1', snapshot)).toBe(false)
  })

  it('brouillon : réglages relevés en mémoire, ni identifiant ni écriture', () => {
    const conversation = { record: record(), draft: true }
    expect(noteSession(conversation, 's1', snapshot)).toBe(false)
    expect(conversation.record.sessionId).toBeUndefined()
    expect(conversation.record.controls?.values).toEqual({ mode: 'plan' })
  })
})

describe('parseConversationControls', () => {
  it('garde des réglages bien formés ; refuse le reste', () => {
    const good = { profileId: 'p', values: { mode: 'plan', verbose: false } }
    expect(parseConversationControls(good)).toEqual(good)
    for (const bad of [
      undefined,
      null,
      'plan',
      { values: { mode: 'plan' } },
      { profileId: '', values: { mode: 'plan' } },
      { profileId: 'p' },
      { profileId: 'p', values: [] },
      { profileId: 'p', values: {} },
      { profileId: 'p', values: { mode: 3 } },
      { profileId: 'p', values: { mode: null } }
    ]) {
      expect(parseConversationControls(bad)).toBeUndefined()
    }
  })

  it('fiche de conversation : réglages abîmés retirés à la lecture, pas la conversation', () => {
    const dir = mkdtempSync(join(tmpdir(), 'conv-controls-'))
    const controls = { profileId: 'p', values: { mode: 'plan' } }
    writeFileSync(
      join(dir, 'index.json'),
      JSON.stringify([
        record({ id: 'a', controls }),
        { ...record({ id: 'b' }), controls: { profileId: 'p', values: { mode: 3 } } }
      ])
    )
    const [a, b] = new ConversationStore(dir).loadIndex()
    expect(a?.controls).toEqual(controls)
    expect(b?.id).toBe('b')
    expect(b && 'controls' in b).toBe(false)
  })
})

function waitFor(predicate: () => boolean, timeoutMs = 8000): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = Date.now()
    const check = () => {
      if (predicate()) return resolve()
      if (Date.now() - started > timeoutMs) return reject(new Error('waitFor : délai dépassé'))
      setTimeout(check, 10)
    }
    check()
  })
}

/**
 * Deux « instances de l'app » successives (relance) sur les mêmes dossiers, avec l'agent factice
 * dont les sessions survivent à la relance (`--store`). `forget` : agent qui rouvre ses sessions
 * dans ses réglages par défaut (`--reglages-oublies`).
 */
function environment(extraArgs: string[] = []) {
  const root = mkdtempSync(join(tmpdir(), 'conv-controls-'))
  const store = join(root, 'mock-store')
  const workspace = mkdtempSync(join(tmpdir(), 'ws-controls-'))
  const mock = (id: string): AgentProfile => ({
    id,
    label: `Factice ${id}`,
    command: process.execPath,
    args: [MOCK_AGENT_ENTRY, '--scenario', 'echo', '--delay', '0', '--store', store, ...extraArgs],
    env: {}
  })
  const launch = (options: { maxLive?: number } = {}) => {
    const manager = new ConversationManager({
      profiles: [mock('factice'), mock('autre')],
      settingsFile: join(root, 'settings.json'),
      conversationsDir: join(root, 'conversations'),
      defaultWorkspace: workspace,
      neutralFolder: workspace,
      pathEnv: () => process.env['PATH'],
      emit: () => {},
      emitList: () => {},
      ...(options.maxLive ? { maxLive: options.maxLive } : {}),
      agentHome: mkdtempSync(join(tmpdir(), 'maison-vide-'))
    })
    const value = (id: string, controlId: string) =>
      manager.view(id).snapshot?.controls.find((c) => c.id === controlId)?.currentValue
    const ready = (id: string) => waitFor(() => manager.view(id).snapshot?.status === 'ready')
    return { manager, value, ready }
  }
  const index = () =>
    JSON.parse(
      readFileSync(join(root, 'conversations', 'index.json'), 'utf8')
    ) as ConversationRecord[]
  /** Réglages tels que l'agent les a (sa mémoire de sessions), pas tels que l'app les affiche. */
  const agentSide = (id: string) => {
    const sessionId = index().find((r) => r.id === id)?.sessionId
    if (!sessionId) throw new Error(`session de ${id} inconnue`)
    const stored = JSON.parse(readFileSync(join(store, `${sessionId}.json`), 'utf8')) as {
      modeId: string
      model: string
    }
    return { mode: stored.modeId, model: stored.model }
  }
  return { root, launch, index, agentSide }
}

/** A en Question / précis, B en Code / rapide ; le dernier choix (celui de B) est Code / rapide. */
async function twoConversations(app: ReturnType<ReturnType<typeof environment>['launch']>) {
  const a = app.manager.state().activeId
  await app.manager.startActive()
  await app.manager.setControl(a, 'mode', 'ask')
  await app.manager.setControl(a, 'model', 'factice-precis')
  await app.manager.prompt(a, 'Conversation A')
  const b = (await app.manager.create()).summary.id
  await app.ready(b)
  await app.manager.setControl(b, 'mode', 'code')
  await app.manager.setControl(b, 'model', 'factice-rapide')
  await app.manager.prompt(b, 'Conversation B')
  return { a, b }
}

describe('réglages propres à chaque conversation, contre l’agent factice (fiche 256, D3)', () => {
  it('relance : A changée n’entraîne pas B ; chacune est rouverte avec les siens', async () => {
    const env = environment()
    const app1 = env.launch()
    const { a, b } = await twoConversations(app1)
    app1.manager.stopAll()
    expect(env.index().find((r) => r.id === a)?.controls).toEqual({
      profileId: 'factice',
      values: { mode: 'ask', model: 'factice-precis', verbose: false }
    })

    const app2 = env.launch()
    // A rouverte : les siens, pas le dernier choix (Code / rapide, fait dans B).
    app2.manager.select(a)
    await app2.ready(a)
    expect([app2.value(a, 'mode'), app2.value(a, 'model')]).toEqual(['ask', 'factice-precis'])
    // D3 : A passe en Plan et en modèle précis… puis B, pas encore rouverte, est ouverte.
    await app2.manager.setControl(a, 'mode', 'plan')
    app2.manager.select(b)
    await app2.ready(b)
    expect([app2.value(b, 'mode'), app2.value(b, 'model')]).toEqual(['code', 'factice-rapide'])
    app2.manager.stopAll()
    // Côté agent aussi : rien n'a été envoyé à B.
    expect(env.agentSide(b)).toEqual({ mode: 'code', model: 'factice-rapide' })
    expect(env.agentSide(a)).toEqual({ mode: 'plan', model: 'factice-precis' })

    // Une nouvelle conversation prend toujours le dernier choix (Plan, fait dans A).
    const app3 = env.launch()
    const fresh = (await app3.manager.create()).summary.id
    await app3.ready(fresh)
    expect([app3.value(fresh, 'mode'), app3.value(fresh, 'model')]).toEqual([
      'plan',
      'factice-rapide'
    ])
    app3.manager.stopAll()
  })

  it('agent qui oublie les réglages à la réouverture : ceux de la conversation réappliqués', async () => {
    const env = environment(['--reglages-oublies'])
    const app1 = env.launch()
    const { a, b } = await twoConversations(app1)
    await app1.manager.setControl(a, 'mode', 'plan')
    app1.manager.stopAll()

    const app2 = env.launch()
    app2.manager.select(a)
    await app2.ready(a)
    // L'agent rouvre en Code / rapide ; la conversation était en Plan / précis : elle le reste.
    expect([app2.value(a, 'mode'), app2.value(a, 'model')]).toEqual(['plan', 'factice-precis'])
    app2.manager.select(b)
    await app2.ready(b)
    expect([app2.value(b, 'mode'), app2.value(b, 'model')]).toEqual(['code', 'factice-rapide'])
    app2.manager.stopAll()
    expect(env.agentSide(a)).toEqual({ mode: 'plan', model: 'factice-precis' })
  })

  it('conversation sans réglages mémorisés (d’avant) : rien envoyé, la session garde les siens', async () => {
    const env = environment()
    const app1 = env.launch()
    const { a } = await twoConversations(app1)
    app1.manager.stopAll()
    // Fiche écrite avant la fiche 256 : pas de réglages.
    const records = env.index().map(({ controls: _dropped, ...rest }) => rest)
    writeFileSync(join(env.root, 'conversations', 'index.json'), JSON.stringify(records))

    const app2 = env.launch()
    app2.manager.select(a)
    await app2.ready(a)
    // Dernier choix : Code / rapide ; la session de A, rendue par l'agent : Question / précis.
    expect([app2.value(a, 'mode'), app2.value(a, 'model')]).toEqual(['ask', 'factice-precis'])
    app2.manager.stopAll()
    expect(env.agentSide(a)).toEqual({ mode: 'ask', model: 'factice-precis' })
    // Relevés à l'ouverture : la prochaine réouverture les a.
    expect(env.index().find((r) => r.id === a)?.controls?.values).toMatchObject({ mode: 'ask' })
  })

  it('sans relance : conversation mise en veille puis rouverte, avec les siens', async () => {
    const env = environment(['--reglages-oublies'])
    const app = env.launch({ maxLive: 1 })
    const { a, b } = await twoConversations(app)
    // Une seule conversation vivante : A a été mise en veille pour B.
    const status = (id: string) =>
      app.manager.state().conversations.find((c) => c.id === id)?.status
    await waitFor(() => status(a) === 'stopped')
    app.manager.select(a)
    await app.ready(a)
    expect([app.value(a, 'mode'), app.value(a, 'model')]).toEqual(['ask', 'factice-precis'])
    app.manager.select(b)
    await app.ready(b)
    expect([app.value(b, 'mode'), app.value(b, 'model')]).toEqual(['code', 'factice-rapide'])
    app.manager.stopAll()
  })

  it('branche : mêmes réglages que l’originale, pas le dernier choix fait ailleurs', async () => {
    const env = environment()
    const app = env.launch()
    const { a } = await twoConversations(app)
    app.manager.select(a)
    await app.ready(a)
    const first = app.manager.view(a).transcript.items.find((i) => i.kind === 'user')
    if (!first) throw new Error('message absent')
    const branch = (await app.manager.branch(a, first.id, 'Autre piste')).summary.id
    await waitFor(() => app.value(branch, 'mode') !== undefined)
    await app.ready(branch)
    expect([app.value(branch, 'mode'), app.value(branch, 'model')]).toEqual([
      'ask',
      'factice-precis'
    ])
    app.manager.stopAll()
  })

  it('bascule vers un autre agent : réglages de l’ancien oubliés, dernier choix du nouveau', async () => {
    const env = environment()
    const app = env.launch()
    const { a } = await twoConversations(app)
    app.manager.select(a)
    await app.ready(a)
    app.manager.switchAgent(a, 'autre', {
      type: 'handover',
      handover: {
        from: { profileId: 'factice', label: 'Factice factice' },
        to: { profileId: 'autre', label: 'Factice autre' }
      }
    })
    await app.ready(a)
    // Aucun choix fait avec « autre » : ses défauts, pas Question / précis de l'ancien agent.
    expect([app.value(a, 'mode'), app.value(a, 'model')]).toEqual(['code', 'factice-rapide'])
    app.manager.stopAll()
    expect(env.index().find((r) => r.id === a)?.controls?.profileId).toBe('autre')
  })
})
