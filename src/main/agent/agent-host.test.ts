import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { describe, expect, it } from 'vitest'
import type { AgentEvent, AgentStatus } from '@shared/agent'
import { translate } from '@shared/i18n/message'
import { conversationChanges } from '@shared/changes'
import { turnCost } from '@shared/usage'
import {
  emptyTranscript,
  noticeText,
  reduceTranscript,
  type TranscriptState
} from '@shared/transcript'
import { MOCK_AGENT_ENTRY } from '../../mock-agent/testing.mts'
import { TRUST_MARKER } from '../../mock-agent/agent.mts'
import {
  BACKGROUND_SLEEP,
  CHILD_SLEEP,
  DETACHED_SLEEP
} from '../../mock-agent/scenarios-pannes.mts'
import { AppToolServer } from '../mcp/tool-server'
import { initLog, setVerbosity } from '../log'
import type { AppToolModule } from '../mcp/tools'
import { AgentHost, type AgentHostOptions } from './agent-host'
import { UNTRUSTED_WORKSPACE } from './bob-contract'
import { bobDbCosts } from './bob-costs'
import { OPENCODE_SUBAGENT_STREAM, OPENCODE_TOOL_STATUS } from './opencode-contract'
import { OPENCODE_DIFF_SOURCE } from './opencode-diffs'
import { BOB_SUBAGENT_FORMAT } from './bob-subagents'
import { OPENCODE_SUBAGENT_FORMAT } from './opencode-subagents'
import type { AgentProfile } from './profiles'

/** Texte affiché d'un avis du fil (traduit s'il est en code, fiche 074). */
const noticeOf = (item: ReturnType<typeof reduceTranscript>['items'][number] | undefined) =>
  item?.kind === 'notice' ? noticeText(item) : undefined

function mockProfile(scenario: string, delayMs = 0): AgentProfile {
  return {
    id: 'mock',
    label: 'Agent factice',
    command: process.execPath,
    args: [MOCK_AGENT_ENTRY, '--scenario', scenario, '--delay', String(delayMs)],
    env: {}
  }
}

function createHost(profile: AgentProfile) {
  const events: AgentEvent[] = []
  const host = new AgentHost({ profile, workspace: process.cwd(), emit: (e) => events.push(e) })
  // Changements de statut (un instantané rafraîchi sans changement de statut ne compte pas).
  const statuses = () =>
    (
      events.flatMap((e) => (e.type === 'status' ? [e.snapshot.status] : [])) as AgentStatus[]
    ).filter((s, i, all) => s !== all[i - 1])
  const transcript = () => events.reduce(reduceTranscript, emptyTranscript).items
  return { host, events, statuses, transcript }
}

function waitFor(predicate: () => boolean, timeoutMs = 5000): Promise<void> {
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

/** Hôte relié au serveur d'outils de l'app (fiches 028, 029). */
async function withAppTools(
  scenario: string,
  extra: Partial<AgentHostOptions> & { modules?: AppToolModule[] } = {}
) {
  const toolServer = new AppToolServer()
  await toolServer.start()
  const events: AgentEvent[] = []
  const { modules, ...options } = extra
  const host = new AgentHost({
    profile: mockProfile(scenario),
    workspace: process.cwd(),
    emit: (e) => events.push(e),
    toolServer,
    toolModules: modules,
    ...options
  })
  await host.start()
  const question = () =>
    events.find(
      (e): e is Extract<AgentEvent, { type: 'elicitation-request' }> =>
        e.type === 'elicitation-request'
    )
  const transcript = () => events.reduce(reduceTranscript, emptyTranscript).items
  return {
    host,
    events,
    question,
    transcript,
    stop: () => (host.stop(), toolServer.stop())
  }
}

describe('AgentHost', () => {
  describe('réouverture d’une conversation', () => {
    const storeProfile = (scenario: string, ...extra: string[]): AgentProfile => {
      const profile = mockProfile(scenario)
      const store = mkdtempSync(join(tmpdir(), 'host-store-'))
      return { ...profile, args: [...profile.args, '--store', store, ...extra] }
    }

    /** Joue un premier échange puis arrête l'agent ; renvoie l'identifiant de session. */
    async function firstExchange(profile: AgentProfile) {
      const { host } = createHost(profile)
      await host.start()
      await host.prompt('Première question')
      const sessionId = host.currentSessionId
      host.stop()
      if (!sessionId) throw new Error('pas de session')
      return sessionId
    }

    function reopenHost(
      profile: AgentProfile,
      sessionId: string,
      keepTranscript = false,
      timeouts?: AgentHostOptions['timeouts']
    ) {
      const events: AgentEvent[] = []
      const host = new AgentHost({
        profile,
        workspace: process.cwd(),
        emit: (e) => events.push(e),
        ...(timeouts ? { timeouts } : {}),
        reopen: { sessionId, ...(keepTranscript ? { keepTranscript } : {}) }
      })
      const transcript = (initial: TranscriptState = emptyTranscript) =>
        events.reduce(reduceTranscript, initial).items
      return { host, events, transcript }
    }

    /** Fil de l'app après `firstExchange`, tel qu'il serait gardé (fiche 103). */
    const firstTranscript = (): TranscriptState => ({
      items: [
        { kind: 'user', id: 1, text: 'Première question' },
        { kind: 'agent', id: 2, text: 'Réponse' }
      ],
      nextId: 3
    })

    describe('fil de l’app gardé (fiches 041, 103)', () => {
      const replayed = (events: AgentEvent[]) =>
        events.filter((e) => e.type === 'reset' || e.type === 'update')

      it('agent qui sait rejouer : ni remise à zéro ni rejeu dans le fil, rien de plus à ajouter', async () => {
        const profile = storeProfile('streaming-texte')
        const sessionId = await firstExchange(profile)
        const { host, events, transcript } = reopenHost(profile, sessionId, true)
        await host.start()
        await new Promise((r) => setTimeout(r, 400))
        expect(host.currentSessionId).toBe(sessionId)
        expect(replayed(events)).toEqual([])
        // Le rejeu arrive au gestionnaire (fiche 103), mais n'a rien que le fil n'ait déjà.
        expect(events.filter((e) => e.type === 'replayed')).toHaveLength(1)
        expect(transcript(firstTranscript()).map((i) => i.kind)).toEqual(['user', 'agent'])
        host.stop()
      })

      it('session/load seulement : le rejeu (même tardif) ne touche pas le fil, puis on continue', async () => {
        const profile = storeProfile('streaming-texte', '--sans-reprise', '--rejeu-tardif')
        const sessionId = await firstExchange(profile)
        const { host, events, transcript } = reopenHost(profile, sessionId, true)
        await host.start()
        await new Promise((r) => setTimeout(r, 100))
        expect(replayed(events)).toEqual([])
        await host.prompt('Suite')
        host.stop()
        expect(transcript(firstTranscript()).map((i) => i.kind)).toEqual([
          'user',
          'agent',
          'user',
          'agent'
        ])
      })

      it('relance après panne (D21, fiche 121) : un message envoyé aussitôt attend le rejeu tardif, réconcilié hors du tour', async () => {
        // Bob 2.0.6 : le rejeu commence après la réponse à `session/load`, quand le message de
        // l'utilisateur qui a relancé l'agent part déjà.
        // Tour assez long pour croiser le rejeu, comme en recette.
        const profile = storeProfile('streaming-texte', '--rejeu-tardif-ms', '150', '--delay', '40')
        const sessionId = await firstExchange(profile)
        const { host, events, transcript } = reopenHost(profile, sessionId, true)
        await host.start()
        await host.prompt('Suite')
        host.stop()
        const items = transcript(firstTranscript())
        expect(items.map((i) => i.kind)).toEqual(['user', 'agent', 'user', 'agent'])
        expect(items[2]).toMatchObject({ text: 'Suite' })
        // Rien du rejeu collé à la réponse du tour (« pongpong 2 » en recette) : une seule réponse.
        const answer = (items[3] && 'text' in items[3] ? items[3].text : undefined) ?? ''
        expect(answer.match(/Voici un exemple de réponse/g)).toHaveLength(1)
        // Le rejeu a été réconcilié avec le fil gardé, avant le message.
        const kinds = events.map((e) => e.type)
        expect(kinds.filter((k) => k === 'replayed')).toHaveLength(1)
        expect(kinds.indexOf('replayed')).toBeLessThan(kinds.indexOf('user-message'))
      })

      it('relance après panne : rejeu qui ne vient pas, le message part au bout de l’attente bornée', async () => {
        const profile = storeProfile('streaming-texte', '--rejeu-tardif-ms', '5000')
        const sessionId = await firstExchange(profile)
        const { host, transcript } = reopenHost(profile, sessionId, true, { replayWaitMs: 200 })
        await host.start()
        const sent = Date.now()
        await host.prompt('Suite')
        host.stop()
        expect(Date.now() - sent).toBeGreaterThanOrEqual(180)
        expect(transcript(firstTranscript()).map((i) => i.kind)).toEqual([
          'user',
          'agent',
          'user',
          'agent'
        ])
      })

      it('rejeu déjà calme (⌘Q puis réouverture) : le message part sans attendre', async () => {
        const profile = storeProfile('streaming-texte', '--rejeu-tardif-ms', '50')
        const sessionId = await firstExchange(profile)
        const { host, events } = reopenHost(profile, sessionId, true, { replayWaitMs: 5000 })
        await host.start()
        await expect.poll(() => events.filter((e) => e.type === 'replayed')).toHaveLength(1)
        const sent = Date.now()
        await host.prompt('Suite')
        host.stop()
        expect(Date.now() - sent).toBeLessThan(1000)
        expect(events.filter((e) => e.type === 'replayed')).toHaveLength(1)
      })

      it('session/resume seulement (agent sans rejeu) : la session continue, rien à réconcilier', async () => {
        const profile = storeProfile('streaming-texte', '--sans-rejeu')
        const sessionId = await firstExchange(profile)
        const { host, events } = reopenHost(profile, sessionId, true)
        await host.start()
        expect(host.currentSessionId).toBe(sessionId)
        expect(events.some((e) => e.type === 'replayed' || e.type === 'reset')).toBe(false)
        host.stop()
      })

      it('session continuée ailleurs pendant la veille (fiche 103) : la fin du rejeu est ajoutée, une fois', async () => {
        const profile = storeProfile('streaming-texte')
        const sessionId = await firstExchange(profile)
        // Un autre client (bob chat, Bob IDE…) continue la session.
        const other = reopenHost(profile, sessionId)
        await other.host.start()
        await other.host.prompt('Deuxième question, ailleurs')
        other.host.stop()

        const { host, events, transcript } = reopenHost(profile, sessionId, true)
        await host.start()
        await expect.poll(() => events.filter((e) => e.type === 'replayed')).toHaveLength(1)
        const items = transcript(firstTranscript())
        expect(items.map((i) => i.kind)).toEqual(['user', 'agent', 'notice', 'user', 'agent'])
        expect(items[3]).toMatchObject({ text: 'Deuxième question, ailleurs' })
        expect(noticeOf(items[2])).toContain('continuée ailleurs')
        expect(items.map((i) => i.id)).toEqual([1, 2, 3, 4, 5])
        await host.prompt('Troisième question')
        host.stop()
        expect(events.filter((e) => e.type === 'replayed')).toHaveLength(1)
        expect(transcript(firstTranscript()).map((i) => i.kind)).toEqual([
          'user',
          'agent',
          'notice',
          'user',
          'agent',
          'user',
          'agent'
        ])
      })

      it('session perdue par l’agent : nouvelle session, repère dans le fil (ADR-0030)', async () => {
        const profile = storeProfile('streaming-texte')
        const { host, transcript } = reopenHost(profile, 'mock-perdue', true)
        await host.start()
        expect(host.snapshot().status).toBe('ready')
        expect(host.currentSessionId).not.toBe('mock-perdue')
        expect(transcript()).toEqual([
          expect.objectContaining({
            kind: 'handover',
            reason: 'session-lost',
            from: { profileId: profile.id, label: profile.label },
            to: { profileId: profile.id, label: profile.label }
          })
        ])
        host.stop()
      })
    })

    it('session/load : le fil est reconstruit par rejeu, puis on continue l’échange', async () => {
      const profile = storeProfile('streaming-texte')
      const sessionId = await firstExchange(profile)
      const { host, events, transcript } = reopenHost(profile, sessionId)
      await host.start()
      expect(host.snapshot().status).toBe('ready')
      expect(host.currentSessionId).toBe(sessionId)
      expect(events.find((e) => e.type !== 'status')).toEqual({ type: 'reset' })
      expect(transcript().map((i) => i.kind)).toEqual(['user', 'agent'])
      expect(transcript()[0]).toMatchObject({ text: 'Première question' })
      await host.prompt('Deuxième question')
      host.stop()
      expect(transcript().map((i) => i.kind)).toEqual(['user', 'agent', 'user', 'agent'])
    })

    it('rejeu APRÈS la réponse à session/load (Bob 2.0.6) : les messages de l’utilisateur restent', async () => {
      const profile = storeProfile('streaming-texte', '--rejeu-tardif')
      const sessionId = await firstExchange(profile)
      const { host, transcript } = reopenHost(profile, sessionId)
      await host.start()
      await expect.poll(() => transcript().map((i) => i.kind)).toEqual(['user', 'agent'])
      expect(transcript()[0]).toMatchObject({ text: 'Première question' })
      host.stop()
    })

    it('session/resume (agent sans rejeu) : pas de reset, la session continue', async () => {
      const profile = storeProfile('streaming-texte', '--sans-rejeu')
      const sessionId = await firstExchange(profile)
      const { host, events } = reopenHost(profile, sessionId)
      await host.start()
      expect(host.snapshot().status).toBe('ready')
      expect(events.some((e) => e.type === 'reset')).toBe(false)
      expect(events.some((e) => e.type === 'update')).toBe(false)
      host.stop()
    })

    it('agent sans historique : session neuve et repère dans le fil (ADR-0030)', async () => {
      const profile = storeProfile('streaming-texte', '--sans-historique')
      const sessionId = await firstExchange(profile)
      for (const keepTranscript of [false, true]) {
        const { host, events } = reopenHost(profile, sessionId, keepTranscript)
        await host.start()
        expect(host.snapshot().status).toBe('ready')
        expect(host.currentSessionId).toBeTruthy()
        expect(host.currentSessionId).not.toBe(sessionId)
        expect(events.filter((e) => e.type === 'handover')).toEqual([
          {
            type: 'handover',
            handover: {
              from: { profileId: profile.id, label: profile.label },
              to: { profileId: profile.id, label: profile.label },
              reason: 'no-resume'
            }
          }
        ])
        expect(events.some((e) => e.type === 'reset')).toBe(false)
        await host.prompt('Suite')
        expect(host.snapshot().status).toBe('ready')
        host.stop()
      }
    })

    it('session disparue côté agent : lecture seule, avec l’erreur de l’agent', async () => {
      const profile = storeProfile('streaming-texte')
      const { host } = reopenHost(profile, 'mock-inexistante')
      await host.start()
      expect(host.snapshot().status).toBe('read-only')
      expect(host.snapshot().detail).toContain('n’a pas pu être reprise')
    })

    it('closeSession et deleteSession selon les capacités', async () => {
      const profile = storeProfile('streaming-texte')
      const { host } = createHost(profile)
      await host.start()
      await host.prompt('Bonjour')
      expect(host.sessionSupport).toEqual({
        load: true,
        resume: true,
        close: true,
        delete: true,
        fork: false,
        additionalDirectories: false
      })
      const sessionId = host.currentSessionId ?? ''
      await host.deleteSession()
      host.stop()
      const { host: again } = reopenHost(profile, sessionId)
      await again.start()
      expect(again.snapshot().status).toBe('read-only')
    })
  })

  it('un seul nom : celui du profil, pas le titre annoncé (recette 0.11, C4)', async () => {
    const profile = { ...mockProfile('streaming-texte'), label: 'IBM Bob' }
    profile.args = [...profile.args, '--nom', 'Bob']
    const { host } = createHost(profile)
    await host.start()
    expect(host.snapshot().info.agentName).toBe('IBM Bob')
    expect(host.snapshot().info.profileLabel).toBe('IBM Bob')
    host.stop()
  })

  it('démarre, annonce le nom de l’agent, et un démarrage concurrent est partagé', async () => {
    const { host, statuses } = createHost(mockProfile('streaming-texte'))
    await Promise.all([host.start(), host.start()])
    expect(statuses()).toEqual(['starting', 'ready'])
    expect(host.snapshot().info.agentName).toBe('Agent factice')
    host.stop()
  })

  it('commandes « / » annoncées après l’ouverture de session : dans l’instantané', async () => {
    const { host, events } = createHost(mockProfile('streaming-texte'))
    await host.start()
    await expect
      .poll(() => host.snapshot().commands.map((c) => c.name))
      .toEqual(['scenario', 'aide', 'demo'])
    expect(host.snapshot().commands[0]).toEqual({
      name: 'scenario',
      description: 'Joue un scénario de l’agent factice pour ce tour',
      hint: 'nom du scénario (vide = liste)'
    })
    // Métadonnée de session, pas un élément du fil.
    expect(events.some((e) => e.type === 'update')).toBe(false)
    host.stop()
    const restart = events.length
    await host.start()
    // Remises à zéro au redémarrage : l'instantané « starting » n'a plus celles de la session
    // d'avant. Celles de la nouvelle session arrivent juste après son ouverture, parfois avant même
    // la fin de `start()` (fiche 041) : on les attend au lieu de supposer qu'elles manquent encore.
    const starting = events
      .slice(restart)
      .find((e) => e.type === 'status' && e.snapshot.status === 'starting')
    expect(starting?.type === 'status' && starting.snapshot.commands).toEqual([])
    await expect
      .poll(() => host.snapshot().commands.map((c) => c.name))
      .toEqual(['scenario', 'aide', 'demo'])
    host.stop()
  })

  it('astuce d’accueil tirée du profil, dans l’instantané (fiche 088)', () => {
    const { host } = createHost({ ...mockProfile('demo'), welcomeHint: 'Tapez `/scenario`.' })
    expect(host.snapshot().info.welcomeHint).toBe('Tapez `/scenario`.')
    expect(createHost(mockProfile('demo')).host.snapshot().info).not.toHaveProperty('welcomeHint')
  })

  it('coût lu dans la base locale de Bob (costSource du profil) après chaque tour', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'bob-db-'))
    const bobDb = join(dir, 'bob.db')
    const events: AgentEvent[] = []
    const host = new AgentHost({
      profile: { ...mockProfile('streaming-texte'), costSource: bobDbCosts(bobDb) },
      workspace: process.cwd(),
      emit: (e) => events.push(e)
    })
    await host.start()
    const db = new DatabaseSync(bobDb)
    db.exec('CREATE TABLE tasks (id TEXT PRIMARY KEY, costs TEXT)')
    db.prepare('INSERT INTO tasks VALUES (?, ?)').run(
      host.currentSessionId ?? '',
      JSON.stringify({ cost: 0.021006, contextTokens: 10503 })
    )
    db.close()
    await host.prompt('Bonjour')
    host.stop()
    expect(events).toContainEqual({
      type: 'usage-report',
      cost: { amount: 0.021006, currency: 'bobcoins' }
    })
  })

  it('agent factice « comme Bob » (fiche 109) : rien par ACP, coût relu après chaque tour', async () => {
    const bobDb = join(mkdtempSync(join(tmpdir(), 'bob-db-')), 'bob.db')
    const events: AgentEvent[] = []
    const profile = mockProfile('streaming-texte')
    const host = new AgentHost({
      profile: {
        ...profile,
        args: [...profile.args, '--bob-db', bobDb, '--cout-bob'],
        costSource: bobDbCosts(bobDb)
      },
      workspace: process.cwd(),
      emit: (e) => events.push(e)
    })
    await host.start()
    for (const text of ['Un', 'Deux']) {
      events.push({ type: 'user-message', text })
      await host.prompt(text)
      // Bob écrit son coût après sa réponse : relu 1,5 s après la fin du tour.
      await waitFor(() => events.at(-1)?.type === 'usage-report', 3000)
    }
    host.stop()
    expect(
      events.some((e) => e.type === 'update' && e.update.sessionUpdate === 'usage_update')
    ).toBe(false)
    expect(events.some((e) => e.type === 'turn-end' && e.usage)).toBe(false)
    const usage = events.reduce(reduceTranscript, emptyTranscript).usage
    expect(usage?.cost).toEqual({ amount: 0.025, currency: 'bobcoins' })
    expect(usage?.turns?.map(turnCost)).toEqual([0.0125, 0.0125])
  }, 15_000)

  it('coût d’un sous-agent de Bob relu dans sa base pendant qu’il travaille (fiche 053)', async () => {
    const bobDb = join(mkdtempSync(join(tmpdir(), 'bob-db-')), 'bob.db')
    const events: AgentEvent[] = []
    const profile = mockProfile('sous-agent-bob', 40)
    const host = new AgentHost({
      profile: {
        ...profile,
        args: [...profile.args, '--bob-db', bobDb],
        costSource: bobDbCosts(bobDb),
        subagentFormat: BOB_SUBAGENT_FORMAT
      },
      workspace: process.cwd(),
      emit: (e) => {
        events.push(e)
        if (e.type === 'permission-request') {
          host.respondPermission(e.requestId, 'allow')
        }
      }
    })
    await host.start()
    await host.prompt('Lance un sous-agent')
    host.stop()
    const runs = events.flatMap((e) => (e.type === 'subagent-run' ? [e.run] : []))
    const costs = runs.flatMap((r) => (r.cost ? [r.cost.amount] : []))
    // 2,1 relu pendant le travail (relecture toutes les 2 s), 5,8 à la fin.
    expect(costs).toEqual([0.0021, 0.0058])
    expect(runs[0]).toEqual({ startedAt: expect.any(Number) })
    expect(runs.some((r) => r.endedAt)).toBe(true)
    expect(runs.some((r) => r.sessionId)).toBe(false)
  }, 15_000)

  it('deux sous-agents de Bob en parallèle : chacun son coût, rattaché par sa consigne (fiche 117)', async () => {
    const bobDb = join(mkdtempSync(join(tmpdir(), 'bob-db-')), 'bob.db')
    const events: AgentEvent[] = []
    const profile = mockProfile('sous-agents-paralleles', 40)
    const host = new AgentHost({
      profile: {
        ...profile,
        args: [...profile.args, '--bob-db', bobDb],
        costSource: bobDbCosts(bobDb),
        subagentFormat: BOB_SUBAGENT_FORMAT
      },
      workspace: process.cwd(),
      emit: (e) => {
        events.push(e)
        if (e.type === 'permission-request') host.respondPermission(e.requestId, 'allow')
      }
    })
    await host.start()
    await host.prompt('Lance deux sous-agents')
    host.stop()
    const cards = events
      .reduce(reduceTranscript, emptyTranscript)
      .items.flatMap((i) => (i.kind === 'tool' && i.subagent ? [i] : []))
    expect(cards.map((c) => [c.toolCallId, c.status, c.subagentRun?.cost?.amount])).toEqual([
      ['subagent_a', 'completed', 0.0041],
      ['subagent_b', 'completed', 0.0037]
    ])
    expect(cards.every((c) => c.subagentRun?.endedAt)).toBe(true)
  }, 15_000)

  it('OpenCode 2 : travail du sous-agent rangé sous sa carte, jamais dans le fil (fiche 078)', async () => {
    const profile: AgentProfile = {
      ...mockProfile('sous-agent-opencode2'),
      subagentFormat: OPENCODE_SUBAGENT_FORMAT,
      subagentStream: OPENCODE_SUBAGENT_STREAM,
      subagentReplay: true
    }
    const { host, events, transcript } = createHost(profile)
    await host.start()
    await host.prompt('Lance un sous-agent')
    host.stop()
    // Rien du sous-agent dans le fil : ni son texte, ni sa réflexion, ni ses outils.
    const leaked = events.filter(
      (e) => e.type === 'update' && JSON.stringify(e.update).includes('opencode/child-session')
    )
    expect(leaked).toEqual([])
    const items = transcript()
    expect(items.map((i) => i.kind)).toEqual(['user', 'tool', 'agent'])
    expect(items[2]).toMatchObject({ text: 'Résumé : le fichier parle du chat Gribouille.' })
    const card = items[1]
    expect(card).toMatchObject({
      status: 'completed',
      subagent: { type: 'explore', task: 'Lire notes.txt et résumer' },
      subagentRun: { sessionId: 'ses_mock_enfant2', startedAt: expect.any(Number) }
    })
    // Sous la carte : ses deux outils, titres sans le préfixe, puis sa réponse.
    expect(card?.kind === 'tool' && card.work).toMatchObject([
      {
        kind: 'tool',
        toolCallId: 'ses_mock_enfant2:call_glob',
        title: 'glob',
        status: 'completed'
      },
      {
        kind: 'tool',
        toolCallId: 'ses_mock_enfant2:call_read',
        title: 'read',
        status: 'completed'
      },
      {
        kind: 'agent',
        text: 'Le fichier présente le chat **Gribouille**, qui aime dormir au soleil.'
      }
    ])
  })

  it('OpenCode 2 au rejeu : diffs perdus refaits depuis le patch, mêmes modifications (fiche 096)', async () => {
    const workspace = mkdtempSync(join(tmpdir(), 'host-patch-'))
    writeFileSync(join(workspace, 'README.md'), '# Projet\n\nVersion 1\n')
    const base = mockProfile('patch-opencode')
    const store = mkdtempSync(join(tmpdir(), 'host-store-'))
    const profile: AgentProfile = {
      ...base,
      args: [...base.args, '--store', store],
      diffSource: OPENCODE_DIFF_SOURCE
    }
    const run = (options: Partial<AgentHostOptions>, agent = profile) => {
      const events: AgentEvent[] = []
      const host = new AgentHost({
        profile: agent,
        workspace,
        emit: (e) => events.push(e),
        ...options
      })
      const changes = () =>
        conversationChanges(events.reduce(reduceTranscript, emptyTranscript).items).map((f) => ({
          path: f.path.slice(workspace.length + 1),
          created: f.created,
          added: f.added,
          removed: f.removed
        }))
      return { host, changes }
    }
    const live = run({})
    await live.host.start()
    await live.host.prompt('Patch')
    const sessionId = live.host.currentSessionId ?? ''
    live.host.stop()
    expect(live.changes()).toEqual([
      { path: 'notes.md', created: true, added: 16, removed: 0 },
      { path: 'src/calc.js', created: true, added: 3, removed: 0 },
      { path: 'README.md', created: false, added: 1, removed: 1 }
    ])

    const replayed = run({ reopen: { sessionId } })
    await replayed.host.start()
    replayed.host.stop()
    expect(replayed.changes()).toEqual(live.changes())

    // Sans l'adaptateur (comportement générique) : seuls restent les fichiers créés.
    const generic = run({ reopen: { sessionId } }, { ...profile, diffSource: undefined })
    await generic.host.start()
    generic.host.stop()
    expect(generic.changes().map((f) => [f.path, f.added])).toEqual([
      ['notes.md', 14],
      ['src/calc.js', 3]
    ])
  })

  it('OpenCode 2 : `execute` dont un appel est en erreur → carte en échec, en direct et au rejeu (fiche 122)', async () => {
    const base = mockProfile('outils-execute-erreur')
    const store = mkdtempSync(join(tmpdir(), 'host-store-'))
    const profile: AgentProfile = {
      ...base,
      args: [...base.args, '--store', store],
      toolStatus: OPENCODE_TOOL_STATUS
    }
    const run = (options: Partial<AgentHostOptions>, agent = profile) => {
      const events: AgentEvent[] = []
      const host = new AgentHost({
        profile: agent,
        workspace: process.cwd(),
        emit: (e) => events.push(e),
        ...options
      })
      const status = () =>
        events
          .reduce(reduceTranscript, emptyTranscript)
          .items.find((i) => i.kind === 'tool' && i.toolCallId === 'call_exec_err')
      return { host, status }
    }
    const live = run({})
    await live.host.start()
    await live.host.prompt('Lance l’app')
    const sessionId = live.host.currentSessionId ?? ''
    live.host.stop()
    expect(live.status()).toMatchObject({ status: 'failed' })
    const replayed = run({ reopen: { sessionId } })
    await replayed.host.start()
    replayed.host.stop()
    expect(replayed.status()).toMatchObject({ status: 'failed' })
    // Sans l'adaptateur (comportement générique) : l'agent dit « fini ».
    const generic = run({}, { ...profile, toolStatus: undefined })
    await generic.host.start()
    await generic.host.prompt('Lance l’app')
    generic.host.stop()
    expect(generic.status()).toMatchObject({ status: 'completed' })
  })

  it('profil sans subagentStream : la marque n’est pas lue (comportement générique)', async () => {
    const { host, transcript } = createHost(mockProfile('sous-agent-opencode2'))
    await host.start()
    await host.prompt('Lance un sous-agent')
    host.stop()
    const tools = transcript().filter((i) => i.kind === 'tool')
    expect(tools.map((i) => i.kind === 'tool' && i.toolCallId)).toEqual([
      'call_sub',
      'ses_mock_enfant2:call_glob',
      'ses_mock_enfant2:call_read'
    ])
  })

  it('pièces jointes : blocs ACP envoyés à l’agent, refus clair si l’agent n’accepte pas les images', async () => {
    const { host, transcript } = createHost(mockProfile('echo'))
    await host.start()
    expect(host.snapshot().promptCapabilities).toEqual({ image: true, embeddedContext: true })
    await host.prompt('Vois', [
      { kind: 'image', name: 'a.png', mimeType: 'image/png', data: 'iVBORw==' }
    ])
    host.stop()
    const items = transcript()
    expect(items[0]).toMatchObject({
      kind: 'user',
      attachments: [{ kind: 'image', name: 'a.png' }]
    })
    expect(items.at(-1)?.kind === 'agent' && items.at(-1)).toMatchObject({
      text: expect.stringContaining('image : image/png')
    })

    const textOnly = createHost({
      ...mockProfile('echo'),
      args: [...mockProfile('echo').args, '--sans-images']
    })
    await textOnly.host.start()
    await expect(
      textOnly.host.prompt('', [
        { kind: 'image', name: 'a.png', mimeType: 'image/png', data: 'AA==' }
      ])
    ).rejects.toThrow('n’accepte pas les images')
    expect(textOnly.host.snapshot().status).toBe('ready')
    textOnly.host.stop()
  })

  describe('questions de l’agent via l’outil ask_user (fiche 028)', () => {
    async function withQuestions(askUserWaitMs?: number) {
      return withAppTools('question-bob', { askUserWaitMs })
    }

    it('question affichée, autorisation accordée seule, réponse renvoyée à l’agent', async () => {
      const t = await withQuestions()
      const turn = t.host.prompt('Fais un script')
      await expect.poll(() => t.question()).toBeDefined()
      const asked = t.question()
      expect(asked?.prompt).toMatchObject({
        message: 'Quel shell veux-tu utiliser pour ton script hello ?'
      })
      expect(asked?.prompt.mode === 'form' && asked.prompt.toolCallId).toMatch(/^ask-/)
      expect(t.events.some((e) => e.type === 'permission-request')).toBe(false)
      t.host.respondElicitation(asked?.requestId ?? '', {
        action: 'accept',
        content: { answer: 'zsh' }
      })
      await turn
      expect(t.transcript().at(-1)).toMatchObject({
        kind: 'agent',
        text: expect.stringContaining('The user chose: zsh.')
      })
      t.stop()
    })

    it('réponse tardive : l’agent finit son tour, la réponse part ensuite en message', async () => {
      const t = await withQuestions(100)
      await t.host.prompt('Fais un script')
      expect(t.transcript().at(-1)).toMatchObject({
        text: expect.stringContaining('not answered yet')
      })
      // La question reste ouverte après la fin du tour.
      expect(t.transcript().find((i) => i.kind === 'elicitation')).toMatchObject({
        state: 'pending'
      })
      t.host.respondElicitation(t.question()?.requestId ?? '', {
        action: 'accept',
        content: { answer: 'bash', answer_custom: 'version 5' }
      })
      await expect
        .poll(() => t.events.filter((e) => e.type === 'user-message').at(-1))
        .toMatchObject({
          text: 'Réponse à ta question « Quel shell veux-tu utiliser pour ton script hello ? » : bash, version 5'
        })
      await expect.poll(() => t.host.snapshot().status).toBe('ready')
      t.stop()
    })
  })

  describe('outils de l’app (fiche 029)', () => {
    const IMAGE = { mimeType: 'image/png', data: 'iVBORw0KGgo=' }
    const captureModule = (autoAllow: boolean): AppToolModule => ({
      id: 'capture',
      about: {
        title: 'appToolFamilies.browser.title',
        summary: 'appToolFamilies.browser.summary',
        condition: 'appToolFamilies.always'
      },
      tools: () => [
        {
          definition: {
            name: 'screenshot',
            description: 'Capture',
            inputSchema: { type: 'object' }
          },
          autoAllow,
          panel: 'tasks',
          call: async () => ({
            content: [
              { type: 'text', text: 'Capture prise.' },
              { type: 'image', ...IMAGE }
            ]
          })
        }
      ]
    })

    it('outil sans risque : appelé sans demande, image dans la carte, onglet ouvert', async () => {
      const t = await withAppTools('outil-app', { modules: [captureModule(true)] })
      await t.host.prompt('Capture')
      t.stop()
      expect(t.events.some((e) => e.type === 'permission-request')).toBe(false)
      expect(t.events).toContainEqual({ type: 'panel-open', tab: 'tasks' })
      const tool = t.transcript().find((i) => i.kind === 'tool')
      expect(tool).toMatchObject({
        title: 'Running Screenshot (bobine)',
        status: 'completed',
        images: [IMAGE]
      })
      expect(t.transcript().at(-1)).toMatchObject({
        text: expect.stringContaining('Capture prise.')
      })
    })

    it('outil qui touche le système, ou réglage « tout demander » : autorisation demandée', async () => {
      for (const extra of [
        { modules: [captureModule(false)] },
        { modules: [captureModule(true)], confirmAppTools: true }
      ]) {
        const t = await withAppTools('outil-app', extra)
        const turn = t.host.prompt('Capture')
        await expect.poll(() => t.events.some((e) => e.type === 'permission-request')).toBe(true)
        await t.host.cancel()
        await turn
        t.stop()
      }
    })

    it('outils reçus par la session (menu ⚙, fiche 099) : aucun avant elle, puis ceux donnés', async () => {
      const toolServer = new AppToolServer()
      await toolServer.start()
      const host = new AgentHost({
        profile: mockProfile('outil-app'),
        workspace: process.cwd(),
        emit: () => {},
        toolServer,
        toolModules: [
          captureModule(true),
          { ...captureModule(true), id: 'x', enabled: () => false }
        ]
      })
      expect(host.appToolNames).toBeUndefined()
      await host.start()
      expect(host.appToolNames).toEqual(['ask_user', 'screenshot'])
      host.stop()
      expect(host.appToolNames).toBeUndefined()
      // Sans serveur d'outils (agent sans MCP par HTTP) : la session n'en reçoit aucun.
      const bare = new AgentHost({
        profile: mockProfile('outil-app'),
        workspace: process.cwd(),
        emit: () => {},
        toolModules: [captureModule(true)]
      })
      await bare.start()
      expect(bare.appToolNames).toEqual([])
      bare.stop()
      toolServer.stop()
    })

    it('module inutile dans ce dossier : outil non proposé, rien d’accordé d’office', async () => {
      const t = await withAppTools('outil-app', {
        modules: [{ ...captureModule(true), enabled: () => false }]
      })
      const turn = t.host.prompt('Capture')
      await expect.poll(() => t.events.some((e) => e.type === 'permission-request')).toBe(true)
      const request = t.events.find((e) => e.type === 'permission-request')
      if (request?.type === 'permission-request')
        t.host.respondPermission(request.requestId, 'allow')
      await turn
      t.stop()
      expect(t.transcript().at(-1)).toMatchObject({
        text: expect.stringContaining('Outil inconnu')
      })
    })
  })

  it('contexte d’une branche (fiche 023) : envoyé avant le message, absent du fil', async () => {
    const { host, events, transcript } = createHost(mockProfile('echo'))
    await host.start()
    await host.prompt('Ma question', [], { context: 'Échange repris…' })
    host.stop()
    expect(events.find((e) => e.type === 'user-message')).toEqual({
      type: 'user-message',
      text: 'Ma question',
      mode: expect.anything(),
      // Modèle de la session à l'envoi (fiche 130).
      model: { id: 'factice-rapide', name: 'Factice rapide' },
      at: expect.any(Number)
    })
    const reply = transcript().at(-1)
    expect(reply?.kind === 'agent' && reply.text).toContain('2 bloc(s)')
    expect(reply?.kind === 'agent' && reply.text).toContain('« Échange repris… »')
  })

  it('streaming-texte : le fil contient le message utilisateur puis la réponse Markdown', async () => {
    const { host, events, statuses, transcript } = createHost(mockProfile('streaming-texte'))
    await host.start()
    await host.prompt('Bonjour')
    host.stop()
    expect(statuses()).toEqual(['starting', 'ready', 'busy', 'ready', 'idle'])
    // « répond… » est annoncé avant le message de l'utilisateur.
    const order = events.map((e) => (e.type === 'status' ? e.snapshot.status : e.type))
    expect(order.indexOf('busy')).toBeLessThan(order.indexOf('user-message'))
    const items = transcript()
    expect(items[0]).toMatchObject({ kind: 'user', text: 'Bonjour' })
    expect(items[1]).toMatchObject({ kind: 'agent' })
    expect(items[1]?.kind === 'agent' && items[1].text).toContain('```ts')
    expect(items).toHaveLength(2)
  })

  it('appel-outil : un seul élément outil, fusionné jusqu’à completed', async () => {
    const { host, transcript } = createHost(mockProfile('appel-outil'))
    await host.start()
    await host.prompt('Lis le README')
    host.stop()
    const tools = transcript().filter((i) => i.kind === 'tool')
    expect(tools).toHaveLength(1)
    expect(tools[0]).toMatchObject({ status: 'completed', toolKind: 'read' })
  })

  /** Lance le scénario permission et attend la demande ; renvoie son identifiant. */
  async function untilPermission(scenario = 'permission') {
    const ctx = createHost(mockProfile(scenario))
    await ctx.host.start()
    const turn = ctx.host.prompt('Modifie la config')
    await waitFor(() => ctx.events.some((e) => e.type === 'permission-request'))
    const request = ctx.events.find((e) => e.type === 'permission-request')
    if (request?.type !== 'permission-request') throw new Error('pas de demande')
    return { ...ctx, turn, request }
  }

  it('permission : la demande arrive avec ses options, autoriser applique le diff', async () => {
    const { host, turn, request, events, transcript } = await untilPermission()
    expect(request.options.map((o) => o.optionId)).toEqual(['allow', 'allow_always', 'reject'])
    expect(host.snapshot().status).toBe('busy')

    host.respondPermission(request.requestId, 'allow')
    await turn
    host.stop()
    expect(events).toContainEqual({
      type: 'permission-resolved',
      requestId: request.requestId,
      optionId: 'allow'
    })
    // La consommation du tour (`PromptResponse.usage`) accompagne la fin de tour.
    expect(events).toContainEqual({
      type: 'turn-end',
      stopReason: 'end_turn',
      usage: expect.objectContaining({ outputTokens: 250 }),
      at: expect.any(Number)
    })
    const tool = transcript().find((i) => i.kind === 'tool' && i.toolCallId === 'call_edit')
    expect(tool).toMatchObject({
      status: 'completed',
      permission: { state: { optionId: 'allow', name: 'Autoriser' } }
    })
  })

  it('permission : refuser fait échouer l’outil, que la carte dit « refusé » (fiche 122)', async () => {
    const { host, turn, request, transcript } = await untilPermission()
    host.respondPermission(request.requestId, 'reject')
    await turn
    host.stop()
    const tool = transcript().find((i) => i.kind === 'tool' && i.toolCallId === 'call_edit')
    expect(tool).toMatchObject({
      status: 'refused',
      permission: { state: { kind: 'reject_once' } }
    })
  })

  it('permission : Stop pendant l’attente répond cancelled et termine le tour', async () => {
    const { host, turn, request, events, transcript } = await untilPermission()
    await host.cancel()
    await turn
    host.stop()
    expect(events).toContainEqual({
      type: 'permission-resolved',
      requestId: request.requestId,
      optionId: null
    })
    expect(events).toContainEqual({
      type: 'turn-end',
      stopReason: 'cancelled',
      at: expect.any(Number)
    })
    const tool = transcript().find((i) => i.kind === 'tool' && i.toolCallId === 'call_edit')
    expect(tool).toMatchObject({ status: 'cancelled', permission: { state: 'cancelled' } })
  })

  describe('cartes à risque (fiche 211)', () => {
    /** Hôte dans un dossier jetable : `../dehors` est à côté de lui, jamais chez l'utilisateur. */
    async function riskRequest(scenario: string) {
      const workspace = realpathSync(mkdtempSync(join(tmpdir(), 'bobine-risque-')))
      const events: AgentEvent[] = []
      const remembered = new Set<string>()
      const host = new AgentHost({
        profile: mockProfile(scenario),
        workspace,
        emit: (e) => events.push(e),
        rememberedTools: remembered
      })
      await host.start()
      const turn = host.prompt('Lance la commande')
      await waitFor(() => events.some((e) => e.type === 'permission-request'))
      const request = events.find((e) => e.type === 'permission-request')
      if (request?.type !== 'permission-request') throw new Error('pas de demande')
      const transcript = () => events.reduce(reduceTranscript, emptyTranscript).items
      return { host, turn, request, workspace, remembered, transcript }
    }

    it('écriture hors du dossier (commande seule, comme Bob) : le risque part avec la demande', async () => {
      const { host, turn, request, workspace, transcript } = await riskRequest(
        'commande-ecriture-hors-dossier'
      )
      const path = join(dirname(workspace), 'dehors', 'x.properties')
      const tilde = path.startsWith(`${homedir()}/`) ? `~${path.slice(homedir().length)}` : path
      expect(request.risks).toEqual([{ kind: 'outside-folder', path: tilde }])
      host.respondPermission(request.requestId, 'reject')
      await turn
      host.stop()
      // Gardé après la décision, sur la carte du fil.
      const tool = transcript().find((i) => i.kind === 'tool')
      expect(tool?.kind === 'tool' && tool.permission?.risks).toEqual(request.risks)
    })

    it('sudo : droits d’administrateur et dossier système ; « Toujours » ne retient rien', async () => {
      const { host, turn, request, remembered } = await riskRequest('commande-sudo')
      expect(request.risks).toEqual([
        { kind: 'privilege', via: 'sudo' },
        { kind: 'system-path', path: '/var/run/docker.sock' }
      ])
      host.respondPermission(request.requestId, 'always')
      await turn
      host.stop()
      expect(remembered.size).toBe(0)
    })

    it('lecture hors du dossier : aucun risque, la demande n’en porte pas', async () => {
      const { host, turn, request } = await riskRequest('commande-lecture-hors-dossier')
      expect(request.risks).toBeUndefined()
      host.respondPermission(request.requestId, 'reject')
      await turn
      host.stop()
    })

    it('modification d’un fichier hors du dossier (outil edit) : signalée', async () => {
      const { host, turn, request, workspace } = await riskRequest('ecriture-hors-dossier')
      const path = join(dirname(workspace), 'dehors', 'outil.toml')
      const tilde = path.startsWith(`${homedir()}/`) ? `~${path.slice(homedir().length)}` : path
      expect(request.risks).toEqual([{ kind: 'outside-folder', path: tilde }])
      host.respondPermission(request.requestId, 'reject')
      await turn
      host.stop()
    })
  })

  // Fiche 214 : Bob retire lui-même sa demande (`$/cancel_request`), comme dans le banc de la
  // fiche 213 (écriture hors du dossier) ; l'agent factice rejoue la même séquence.
  it('permission : l’agent retire sa demande ($/cancel_request), la carte se ferme', async () => {
    const workspace = realpathSync(mkdtempSync(join(tmpdir(), 'bobine-annulee-')))
    const events: AgentEvent[] = []
    const host = new AgentHost({
      profile: mockProfile('annulation-par-agent'),
      workspace,
      emit: (e) => events.push(e)
    })
    await host.start()
    const turn = host.prompt('Écris hors du dossier')
    await waitFor(() => events.some((e) => e.type === 'permission-request'))
    const request = events.find((e) => e.type === 'permission-request')
    if (request?.type !== 'permission-request') throw new Error('pas de demande')
    await waitFor(() => events.some((e) => e.type === 'permission-resolved'))
    expect(events).toContainEqual({
      type: 'permission-resolved',
      requestId: request.requestId,
      optionId: null,
      cancelledBy: 'agent'
    })
    await turn
    // Réponse tardive de l'utilisateur : ni erreur, ni rien d'envoyé à l'agent.
    const count = events.length
    expect(() => host.respondPermission(request.requestId, 'allow')).not.toThrow()
    expect(events).toHaveLength(count)
    expect(host.snapshot().status).toBe('ready')
    const items = events.reduce(reduceTranscript, emptyTranscript).items
    const tool = items.find((i) => i.kind === 'tool')
    // Retirée par l'agent : ni carte, ni « annulée », ni échec ; l'outil finit comme l'agent le dit.
    expect(tool).toMatchObject({ status: 'completed' })
    expect(tool).not.toHaveProperty('permission')
    host.stop()
  })

  it('permission : l’agent qui meurt pendant l’attente annule la demande', async () => {
    const { host, turn, request, events } = await untilPermission()
    ;(host as unknown as { child: { kill: (s: string) => void } }).child.kill('SIGKILL')
    await turn
    await waitFor(() => host.snapshot().status === 'exited')
    expect(events).toContainEqual({
      type: 'permission-resolved',
      requestId: request.requestId,
      optionId: null
    })
  })

  it('permission : réponses invalides refusées, pas de double réponse', async () => {
    const { host, turn, request } = await untilPermission()
    expect(() => host.respondPermission('inconnue', 'allow')).toThrow('inconnue')
    expect(() => host.respondPermission(request.requestId, 'pirate')).toThrow('non proposée')
    host.respondPermission(request.requestId, 'allow')
    expect(() => host.respondPermission(request.requestId, 'allow')).toThrow('déjà traitée')
    await turn
    host.stop()
  })

  it('erreur : le tour échoue avec un avis d’erreur et l’agent reste prêt', async () => {
    const { host, transcript } = createHost(mockProfile('erreur'))
    await host.start()
    await host.prompt('Vas-y')
    expect(host.snapshot().status).toBe('ready')
    host.stop()
    expect(transcript().at(-1)).toMatchObject({ kind: 'notice', level: 'error' })
    expect(noticeOf(transcript().at(-1))).toContain('Erreur simulée')
  })

  it('réseau coupé (fiches 139, 142) : l’outil de la tentative ratée est interrompu, pas « en cours »', async () => {
    const { host, transcript } = createHost(mockProfile('reseau-coupe'))
    await host.start()
    await host.prompt('Vas-y')
    // Une autre tentative est prévue : le tour continue, sans avis, mais l'outil ne finira pas.
    expect(host.snapshot().retry).toMatchObject({ cause: 'network', attempt: 1 })
    const items = transcript()
    expect(items.find((i) => i.kind === 'tool')).toMatchObject({ status: 'cancelled' })
    expect(items.some((i) => i.kind === 'notice')).toBe(false)
    host.stop()
  })

  it('cancel : interrompt un tour en cours', async () => {
    const { host, events, transcript } = createHost(mockProfile('lent', 20))
    await host.start()
    const turn = host.prompt('Longue réponse')
    await waitFor(() => events.some((e) => e.type === 'update'))
    await host.cancel()
    await turn
    host.stop()
    expect(events).toContainEqual({
      type: 'turn-end',
      stopReason: 'cancelled',
      at: expect.any(Number)
    })
    expect(noticeOf(transcript().at(-1))).toBe('Réponse interrompue.')
  })

  describe('file d’attente (fiche 020)', () => {
    const userTexts = (items: ReturnType<ReturnType<typeof createHost>['transcript']>) =>
      items.flatMap((i) => (i.kind === 'user' ? [i.text] : []))

    it('messages écrits pendant la réponse : envoyés ensemble à la fin du tour', async () => {
      const { host, events, transcript } = createHost(mockProfile('streaming-texte', 15))
      await host.start()
      const turn = host.prompt('Un')
      await waitFor(() => events.some((e) => e.type === 'update'))
      await host.send('Deux')
      await host.send('Trois', [
        { kind: 'image', name: 'a.png', mimeType: 'image/png', data: 'AA==' }
      ])
      expect(host.snapshot().queued).toEqual([
        { id: expect.any(String), text: 'Deux', attachments: [] },
        { id: expect.any(String), text: 'Trois', attachments: [{ kind: 'image', name: 'a.png' }] }
      ])
      await turn
      await waitFor(
        () => userTexts(transcript()).length === 2 && host.snapshot().status === 'ready'
      )
      host.stop()
      expect(userTexts(transcript())).toEqual(['Un', 'Deux\n\nTrois'])
      expect(host.snapshot().queued).toEqual([])
    })

    it('Stop : la file reste en attente, puis part à la demande', async () => {
      const { host, events, transcript } = createHost(mockProfile('lent', 20))
      await host.start()
      const turn = host.prompt('Longue réponse')
      await waitFor(() => events.some((e) => e.type === 'update'))
      await host.send('Suite')
      await host.cancel()
      await turn
      expect(host.snapshot()).toMatchObject({ status: 'ready', queued: [{ text: 'Suite' }] })
      const [queued] = host.snapshot().queued
      await host.sendNow(queued?.id ?? '')
      await waitFor(() => userTexts(transcript()).length === 2)
      await host.cancel()
      host.stop()
      expect(userTexts(transcript())).toEqual(['Longue réponse', 'Suite'])
    })

    it('« Envoyer maintenant » : interrompt la réponse, ce message part en premier', async () => {
      const { host, events, transcript } = createHost(mockProfile('lent', 20))
      await host.start()
      const turn = host.prompt('Longue réponse')
      await waitFor(() => events.some((e) => e.type === 'update'))
      await host.send('A')
      await host.send('B')
      const b = host.snapshot().queued.find((m) => m.text === 'B')
      await host.sendNow(b?.id ?? '')
      await turn
      await waitFor(() => userTexts(transcript()).length === 2)
      expect(events).toContainEqual({
        type: 'turn-end',
        stopReason: 'cancelled',
        at: expect.any(Number)
      })
      expect(userTexts(transcript())).toEqual(['Longue réponse', 'B\n\nA'])
      await host.cancel()
      host.stop()
    })

    it('messages d’autres conversations (fiche 097) : provenance, contexte, un tour chacun', async () => {
      const { host, transcript, events } = createHost(mockProfile('echo'))
      await host.start()
      const mother = { kind: 'parent', id: 'm', title: 'Carnet' } as const
      // Deux envois au même moment : le second attend que le premier soit parti (jamais deux
      // tours à la fois), et chaque provenance part dans son propre tour.
      const first = host.send('Précision', [], { from: mother })
      const second = host.send('De moi')
      expect(host.snapshot().queued).toEqual([
        { id: expect.any(String), text: 'De moi', attachments: [] }
      ])
      await Promise.all([first, second])
      await waitFor(
        () => userTexts(transcript()).length === 2 && host.snapshot().status === 'ready'
      )
      host.stop()
      const users = transcript().filter((i) => i.kind === 'user')
      expect(users.map((u) => (u.kind === 'user' ? u.from : undefined))).toEqual([
        mother,
        undefined
      ])
      const replies = transcript().flatMap((i) => (i.kind === 'agent' ? [i.text] : []))
      expect(replies[0]).toContain('comes from your parent conversation "Carnet"')
      expect(replies[1]).not.toContain('parent conversation')
      expect(events.filter((e) => e.type === 'turn-end')).toHaveLength(2)
    })

    it('unqueue rend le message et le retire ; identifiant inconnu refusé', async () => {
      const { host, events } = createHost(mockProfile('lent', 20))
      await host.start()
      const turn = host.prompt('Longue réponse')
      await waitFor(() => events.some((e) => e.type === 'update'))
      await host.send('À corriger', [{ kind: 'file', path: '/tmp/x.md' }])
      const [queued] = host.snapshot().queued
      expect(host.unqueue(queued?.id ?? '')).toEqual({
        text: 'À corriger',
        attachments: [{ kind: 'file', path: '/tmp/x.md' }]
      })
      expect(host.snapshot().queued).toEqual([])
      expect(() => host.unqueue('inconnu')).toThrow('introuvable')
      await host.cancel()
      await turn
      host.stop()
    })
  })

  it('mort du processus : statut exited avec explication, puis relance possible', async () => {
    const { host, statuses, transcript } = createHost(mockProfile('lent', 20))
    await host.start()
    const turn = host.prompt('Longue réponse')
    await waitFor(() => host.snapshot().status === 'busy')
    // Simule un crash de l'agent.
    ;(host as unknown as { child: { kill: (s: string) => void } }).child.kill('SIGKILL')
    await turn
    await waitFor(() => host.snapshot().status === 'exited')
    expect(host.snapshot().detail).toContain('SIGKILL')
    expect(transcript().at(-1)).toMatchObject({ kind: 'notice', level: 'error' })

    await host.restart()
    expect(statuses().slice(-2)).toEqual(['starting', 'ready'])
    host.stop()
  })

  it('contrôles : modes + options de l’agent dans le snapshot, mode masqué en double', async () => {
    const { host } = createHost(mockProfile('echo'))
    await host.start()
    const controls = host.snapshot().controls
    host.stop()
    expect(controls.map((c) => [c.id, c.currentValue])).toEqual([
      ['mode', 'code'],
      ['model', 'factice-rapide'],
      ['verbose', false]
    ])
    expect(controls[1]?.options.map((o) => o.group)).toEqual(['Rapides', 'Précis'])
  })

  it('setControl : mode (set_mode) et option (set_config_option) appliqués par l’agent', async () => {
    const { host, events, transcript } = createHost(mockProfile('echo'))
    await host.start()
    await host.setControl('mode', 'ask')
    await host.setControl('model', 'factice-precis')
    await host.setControl('verbose', true)
    expect(host.snapshot().controls.map((c) => c.currentValue)).toEqual([
      'ask',
      'factice-precis',
      true
    ])
    // L'agent confirme lui-même ce qu'il a appliqué.
    await host.prompt('Quel réglage ?')
    host.stop()
    const last = transcript().at(-1)
    expect(last?.kind === 'agent' && last.text).toContain(
      'Mode : ask · Modèle : factice-precis · Détaillé : oui'
    )
    // Chaque changement réémet l'état pour l'UI.
    expect(
      events.filter((e) => e.type === 'status' && e.snapshot.status === 'ready').length
    ).toBeGreaterThan(3)
  })

  it('setControl refuse un réglage inconnu, une valeur non proposée, ou pendant une réponse', async () => {
    const { host } = createHost(mockProfile('lent', 20))
    await host.start()
    await expect(host.setControl('inconnu', 'x')).rejects.toThrow('Réglage inconnu')
    await expect(host.setControl('model', 'pirate')).rejects.toThrow('non proposée')
    await expect(host.setControl('verbose', 'oui')).rejects.toThrow('non proposée')
    const turn = host.prompt('Long')
    await waitFor(() => host.snapshot().status === 'busy')
    await expect(host.setControl('mode', 'ask')).rejects.toThrow('impossible maintenant')
    await host.cancel()
    await turn
    host.stop()
  })

  it('réglages initiaux appliqués à l’ouverture ; inapplicables signalés sans bloquer', async () => {
    const events: AgentEvent[] = []
    const host = new AgentHost({
      profile: mockProfile('echo'),
      workspace: process.cwd(),
      emit: (e) => events.push(e),
      initialControls: {
        mode: 'ask',
        model: 'factice-precis',
        inconnu: 'x',
        verbose: 'pas-un-booleen'
      }
    })
    await host.start()
    expect(host.snapshot().status).toBe('ready')
    expect(host.snapshot().controls.map((c) => c.currentValue)).toEqual([
      'ask',
      'factice-precis',
      false
    ])
    host.stop()
    const warnings = events.flatMap((e) =>
      e.type === 'notice' ? [typeof e.message === 'string' ? e.message : translate(e.message)] : []
    )
    expect(warnings).toHaveLength(2)
    expect(warnings[0]).toContain('inconnu')
    expect(warnings[1]).toContain('Réponses détaillées')
  })

  it('agent sans options de configuration (modes seuls, cas possible de Bob)', async () => {
    const profile = mockProfile('echo')
    const { host } = createHost({ ...profile, args: [...profile.args, '--sans-options'] })
    await host.start()
    expect(host.snapshot().controls.map((c) => c.id)).toEqual(['mode'])
    await host.setControl('mode', 'ask')
    expect(host.snapshot().controls[0]?.currentValue).toBe('ask')
    host.stop()
  })

  it('agent introuvable : statut error, message clair, pas d’exception', async () => {
    const { host } = createHost({ ...mockProfile('demo'), command: '/nexiste/pas' })
    await host.start()
    expect(host.snapshot().status).toBe('error')
    expect(host.snapshot().detail).toContain('Commande introuvable\u00a0: /nexiste/pas')
  })

  describe('pannes de l’agent (fiche 041)', () => {
    function failing(scenario: string, extra: Partial<AgentHostOptions> = {}, args: string[] = []) {
      const events: AgentEvent[] = []
      const profile = mockProfile(scenario, 5)
      const host = new AgentHost({
        profile: { ...profile, args: [...profile.args, ...args] },
        workspace: process.cwd(),
        emit: (e) => events.push(e),
        ...extra
      })
      const transcript = () => events.reduce(reduceTranscript, emptyTranscript).items
      return { host, events, transcript }
    }

    it('plantage en plein tour : outil interrompu, un seul avis avec la fin de stderr', async () => {
      const { host, transcript } = failing('plantage')
      await host.start()
      await host.prompt('Compile')
      await waitFor(() => host.snapshot().status === 'exited')
      expect(transcript().find((i) => i.kind === 'tool')).toMatchObject({ status: 'cancelled' })
      const notices = transcript().filter((i) => i.kind === 'notice')
      expect(notices).toHaveLength(1)
      expect(notices[0]).toMatchObject({ level: 'error' })
      expect(noticeOf(notices[0])).toContain('code 3')
      expect(noticeOf(notices[0])).toContain('plantage simulé')
      await host.restart()
      expect(host.snapshot().status).toBe('ready')
      host.stop()
    })

    it('agent figé qui ignore Stop : processus arrêté après le délai de grâce', async () => {
      const { host, transcript } = failing('muet', { timeouts: { cancelGraceMs: 200 } })
      await host.start()
      const turn = host.prompt('Vas-y')
      await waitFor(() => transcript().some((i) => i.kind === 'agent'))
      await host.cancel()
      await turn
      await waitFor(() => host.snapshot().status === 'exited')
      expect(host.snapshot().detail).toContain('ne répondait plus')
      host.stop()
    })

    it('démarrage sans réponse : erreur explicite au bout du délai', async () => {
      const { host } = failing('demo', { timeouts: { initializeMs: 300 } }, ['--demarrage-bloque'])
      await host.start()
      expect(host.snapshot().status).toBe('error')
      expect(host.snapshot().detail).toContain('n’a pas répondu au démarrage')
    })

    it('silence, Stop, arrêt après le délai (fiche 194) : un seul `exited`, un seul avis', async () => {
      const previous = process.env['BOBINE_SILENCE_MS']
      process.env['BOBINE_SILENCE_MS'] = '300'
      try {
        const { host, events, transcript } = failing('muet', { timeouts: { cancelGraceMs: 300 } })
        await host.start()
        const turn = host.prompt('Vas-y')
        await waitFor(() => host.snapshot().silentSince !== undefined, 5000)
        await host.cancel()
        await turn
        await waitFor(() => host.snapshot().status === 'exited', 5000)
        await new Promise((resolve) => setTimeout(resolve, 300))
        const exits = events.filter((e) => e.type === 'status' && e.snapshot.status === 'exited')
        expect(exits).toHaveLength(1)
        expect(host.snapshot().silentSince).toBeUndefined()
        expect(transcript().filter((i) => i.kind === 'notice')).toHaveLength(1)
        host.stop()
      } finally {
        if (previous === undefined) delete process.env['BOBINE_SILENCE_MS']
        else process.env['BOBINE_SILENCE_MS'] = previous
      }
    })

    describe('commande mise en arrière-plan par l’agent (fiche 195, M3)', () => {
      const running = (duration: string) =>
        execFileSync('ps', ['-A', '-ww', '-o', 'pid=,pgid=,command='], { encoding: 'utf8' })
          .split('\n')
          .filter((line) => line.trim().endsWith(`sleep ${duration}`))
          .map((line) => line.trim().split(/\s+/).map(Number))

      it('dans le groupe de l’agent : vit après le tour, arrêtée avec l’agent', async () => {
        const { host } = failing('arriere-plan')
        await host.start()
        await host.prompt('Lance-la en arrière-plan')
        expect(host.snapshot().status).toBe('ready')
        const [sleep] = running(BACKGROUND_SLEEP)
        expect(sleep).toBeDefined()
        host.stop()
        await waitFor(() => running(BACKGROUND_SLEEP).length === 0, 8000)
      })

      it('détachée par l’agent (autre groupe) : Bobine ne l’arrête pas, à l’aveugle', async () => {
        const { host } = failing('arriere-plan-detache')
        await host.start()
        await host.prompt('Lance-la en arrière-plan')
        const [sleep] = running(DETACHED_SLEEP)
        expect(sleep).toBeDefined()
        host.stop()
        await new Promise((resolve) => setTimeout(resolve, 3500))
        // Toujours là : hors de notre groupe, elle n'est pas à nous (comportement documenté).
        expect(running(DETACHED_SLEEP)).toHaveLength(1)
        process.kill(sleep?.[0] ?? 0, 'SIGKILL')
      })
    })

    it('agent tué par kill -9 en plein tour (fiche 195) : la commande qu’il avait lancée ne survit pas', async () => {
      const sleeping = () =>
        execFileSync('ps', ['-A', '-ww', '-o', 'pid=,command='], { encoding: 'utf8' })
          .split('\n')
          .filter((line) => line.trim().endsWith(`sleep ${CHILD_SLEEP}`))
      const { host } = failing('plantage-avec-enfant', {}, [])
      await host.start()
      await host.prompt('Compile')
      await waitFor(() => host.snapshot().status === 'exited', 10_000)
      expect(host.snapshot().detail).toContain('SIGKILL')
      await waitFor(() => sleeping().length === 0, 8000)
      expect(sleeping()).toEqual([])
      host.stop()
    })

    it('protocole incompatible (fiches 194, 198) : un seul statut d’erreur, un seul avis', async () => {
      const { host, events, transcript } = failing('protocole-incompatible')
      await host.start()
      await new Promise((resolve) => setTimeout(resolve, 300))
      expect(host.snapshot().status).toBe('error')
      const errors = events.filter((e) => e.type === 'status' && e.snapshot.status === 'error')
      expect(errors).toHaveLength(1)
      expect(transcript().filter((i) => i.kind === 'notice')).toHaveLength(1)
    })

    it('plantage à `initialize` (fiche 195) : erreur avec la fin de stderr, pas d’attente', async () => {
      const { host } = failing('demo', {}, ['--panne', 'plantage-initialize'])
      const started = Date.now()
      await host.start()
      expect(host.snapshot().status).toBe('error')
      expect(host.snapshot().detail).toContain('panic: initialize')
      expect(Date.now() - started).toBeLessThan(10_000)
    })

    it('`session/new` sans réponse (fiche 195) : erreur explicite au bout du délai', async () => {
      const { host } = failing('demo', { timeouts: { sessionMs: 300 } }, [
        '--panne',
        'bloque-session-new'
      ])
      await host.start()
      expect(host.snapshot().status).toBe('error')
      expect(host.snapshot().detail).toMatch(/n’a pas ouvert la session/)
    })

    it('rouvrir une session sans réponse (fiche 195) : erreur explicite au bout du délai', async () => {
      const first = failing('demo')
      await first.host.start()
      const sessionId = first.host.currentSessionId
      first.host.stop()
      if (!sessionId) throw new Error('session attendue')
      const { host } = failing('demo', { timeouts: { sessionMs: 300 }, reopen: { sessionId } }, [
        '--panne',
        'bloque-session-load'
      ])
      await host.start()
      expect(host.snapshot().status).toBe('read-only')
      expect(host.snapshot().detail).toMatch(/n’a pas (rouvert|ouvert|répondu)/)
    })

    it.each([
      ['plantage-signal', 'SIGKILL'],
      ['plantage-segfault', 'SIGSEGV']
    ])(
      'mort par signal en plein tour (%s, fiche 195) : outil interrompu, le signal est dit',
      async (scenario, signal) => {
        const { host, transcript } = failing(scenario)
        await host.start()
        await host.prompt('Compile')
        await waitFor(() => host.snapshot().status === 'exited')
        expect(host.snapshot().detail).toContain(signal)
        expect(transcript().find((i) => i.kind === 'tool')).toMatchObject({ status: 'cancelled' })
        host.stop()
      }
    )

    it('connexion coupée, processus vivant (fiche 195) : arrêté, la cause est dite', async () => {
      const { host, transcript } = failing('connexion-coupee')
      await host.start()
      await host.prompt('Vas-y')
      await waitFor(() => host.snapshot().status === 'exited', 10_000)
      expect(host.snapshot().detail).toContain('connexion avec Bobine s’est coupée')
      expect(transcript().some((i) => i.kind === 'agent')).toBe(true)
      host.stop()
    })

    it('flot sur stderr (fiche 195) : le tour se termine, la fin seule est gardée', async () => {
      const { host, transcript } = failing('flot-stderr')
      await host.start()
      await host.prompt('Vas-y')
      expect(host.snapshot().status).toBe('ready')
      expect(transcript().at(-1)).toMatchObject({ kind: 'agent' })
      host.stop()
    })

    it('ligne hors protocole sur stdout : ignorée, la réponse arrive', async () => {
      const { host, transcript } = failing('bavard')
      await host.start()
      await host.prompt('Bonjour')
      expect(host.snapshot().status).toBe('ready')
      expect(transcript().at(-1)).toMatchObject({ kind: 'agent', text: 'Réponse malgré le bruit.' })
      host.stop()
    })

    it('dossier de travail disparu : erreur qui le dit', async () => {
      const events: AgentEvent[] = []
      const host = new AgentHost({
        profile: mockProfile('demo'),
        workspace: join(tmpdir(), 'bobine-dossier-disparu'),
        emit: (e) => events.push(e)
      })
      await host.start()
      expect(host.snapshot()).toMatchObject({
        status: 'error',
        detail: expect.stringContaining('Dossier de travail introuvable')
      })
    })
  })

  describe('actions requises (Bob)', () => {
    const onDisk = (scenario: string): AgentProfile => ({
      ...mockProfile(scenario),
      trust: { pattern: UNTRUSTED_WORKSPACE, flag: '--trust' }
    })
    const freshWorkspace = () => mkdtempSync(join(tmpdir(), 'ws-trust-'))

    function hostIn(
      profile: AgentProfile,
      workspace: string,
      extra: Partial<AgentHostOptions> = {}
    ) {
      const events: AgentEvent[] = []
      const host = new AgentHost({ profile, workspace, emit: (e) => events.push(e), ...extra })
      const transcript = () => events.reduce(reduceTranscript, emptyTranscript).items
      return { host, events, transcript }
    }

    it('dossier non approuvé : action requise avec le message de l’agent, l’agent reste vivant', async () => {
      const { host } = hostIn(onDisk('bob-workspace-non-approuve'), freshWorkspace())
      await host.start()
      const snapshot = host.snapshot()
      expect(snapshot.status).toBe('needs-action')
      expect(snapshot.blocker).toMatchObject({ kind: 'trust', canTrustForSession: true })
      expect(snapshot.blocker?.kind === 'trust' && snapshot.blocker.message).toContain(
        'is not trusted'
      )
      expect((host as unknown as { child?: unknown }).child).toBeDefined()
      host.stop()
    })

    it('dossier approuvé entre-temps (comme « lancer bob une fois ») : Réessayer ouvre la session', async () => {
      const workspace = freshWorkspace()
      const { host } = hostIn(onDisk('bob-workspace-non-approuve'), workspace)
      await host.start()
      writeFileSync(join(workspace, TRUST_MARKER), '')
      await host.retrySession()
      expect(host.snapshot().status).toBe('ready')
      expect(host.snapshot().blocker).toBeUndefined()
      host.stop()
    })

    it('confiance pour cette session : relance avec --trust, puis prêt', async () => {
      const { host } = hostIn(onDisk('bob-workspace-non-approuve'), freshWorkspace())
      await host.start()
      await host.trustForSession()
      expect(host.snapshot().status).toBe('ready')
      host.stop()
    })

    it('sans flag de confiance dans le profil : pas de confiance ponctuelle proposée', async () => {
      const profile = {
        ...mockProfile('bob-workspace-non-approuve'),
        trust: { pattern: UNTRUSTED_WORKSPACE }
      }
      const { host } = hostIn(profile, freshWorkspace())
      await host.start()
      expect(host.snapshot().blocker).toEqual({
        kind: 'trust',
        message: expect.stringContaining('is not trusted'),
        canTrustForSession: false,
        trustRemembered: false
      })
      await expect(host.trustForSession()).rejects.toThrow()
      host.stop()
    })

    it('commande pour approuver le dossier : tirée du profil, transmise à l’UI', async () => {
      const profile = {
        ...mockProfile('bob-workspace-non-approuve'),
        trust: { pattern: UNTRUSTED_WORKSPACE, remembered: true, approveCommand: 'bob' }
      }
      const { host } = hostIn(profile, freshWorkspace())
      await host.start()
      expect(host.snapshot().blocker).toMatchObject({
        kind: 'trust',
        trustRemembered: true,
        approveCommand: 'bob'
      })
      host.stop()
    })

    it('profil sans motif de confiance : le refus reste une erreur, sans panneau', async () => {
      const { host } = hostIn(mockProfile('bob-workspace-non-approuve'), freshWorkspace())
      await host.start()
      expect(host.snapshot()).toMatchObject({
        status: 'error',
        detail: expect.stringContaining('is not trusted')
      })
      expect(host.snapshot().blocker).toBeUndefined()
      host.stop()
    })

    it('connexion requise : bouton par méthode, authenticate puis session ouverte', async () => {
      const { host, events } = hostIn(onDisk('bob-auth-requise'), freshWorkspace())
      await host.start()
      expect(host.snapshot().blocker).toEqual({
        kind: 'auth',
        methods: [
          // Profil sans libellé pour cette méthode : le nom donné par l'agent, tel quel.
          { id: 'mock-sso', name: 'Log in with SSO', description: 'Simule la connexion SSO de Bob' }
        ],
        authenticating: false
      })
      await expect(host.authenticate('inconnue')).rejects.toThrow('inconnue')
      await host.authenticate('mock-sso')
      expect(host.snapshot().status).toBe('ready')
      // L'attente du navigateur a été signalée à l'UI.
      expect(
        events.some(
          (e) =>
            e.type === 'status' &&
            e.snapshot.blocker?.kind === 'auth' &&
            e.snapshot.blocker.authenticating
        )
      ).toBe(true)
      await host.prompt('Bonjour')
      host.stop()
    })

    it('méthode libellée par le profil : son libellé traduit, pas le nom anglais (fiche 205)', async () => {
      const profile: AgentProfile = {
        ...onDisk('bob-auth-requise'),
        authMethodLabels: {
          'mock-sso': { label: 'Se connecter par SSO' },
          autre: { label: 'Jamais annoncée' }
        }
      }
      const { host } = hostIn(profile, freshWorkspace())
      await host.start()
      const blocker = host.snapshot().blocker
      expect(blocker?.kind === 'auth' && blocker.methods).toEqual([
        {
          id: 'mock-sso',
          name: 'Se connecter par SSO',
          description: 'Simule la connexion SSO de Bob'
        }
      ])
      await host.authenticate('mock-sso')
      expect(host.snapshot().status).toBe('ready')
      host.stop()
    })

    it('premier lancement de Bob : dossier d’abord, PUIS connexion (ordre réel)', async () => {
      const { host } = hostIn(onDisk('bob-premiere-connexion'), freshWorkspace())
      await host.start()
      expect(host.snapshot().blocker?.kind).toBe('trust')
      await host.trustForSession()
      expect(host.snapshot().blocker?.kind).toBe('auth')
      await host.authenticate('mock-sso')
      expect(host.snapshot().status).toBe('ready')
      host.stop()
    })
  })

  describe('connexion par clé d’API, terminal, licence (fiche 022)', () => {
    const freshWorkspace = () => mkdtempSync(join(tmpdir(), 'ws-auth-'))
    const withSteps = (scenario: string): AgentProfile => ({
      ...mockProfile(scenario),
      terminalSteps: {
        'mock-login': { label: 'Se connecter', command: 'touch .mock-agent-logged-in' },
        'show-license': { label: 'Lire la licence', command: 'echo licence' }
      },
      license: { pattern: /license agreement is required/i, steps: ['show-license'] }
    })
    function hostIn(
      profile: AgentProfile,
      workspace: string,
      extra: Partial<AgentHostOptions> = {}
    ) {
      return new AgentHost({ profile, workspace, emit: () => {}, ...extra })
    }
    const KEY = {
      env: 'MOCK_AGENT_API_KEY',
      label: 'Clé',
      stored: false,
      fromEnvironment: false
    }

    it('clé proposée dans « Connexion requise » ; posée au lancement, plus de connexion', async () => {
      const saved: { key?: string } = {}
      const host = hostIn(withSteps('bob-auth-requise'), freshWorkspace(), {
        apiKeyInfo: () => KEY,
        credentials: () => Promise.resolve(saved.key ? { MOCK_AGENT_API_KEY: saved.key } : {})
      })
      await host.start()
      expect(host.snapshot().blocker).toMatchObject({ kind: 'auth', apiKey: KEY })
      saved.key = 'cle-de-test'
      await host.restart()
      expect(host.snapshot().status).toBe('ready')
      host.stop()
    })

    it('arrêté pendant la lecture des clés (trousseau) : rien n’est lancé', async () => {
      let release: () => void = () => {}
      const host = hostIn(withSteps('bob-auth-requise'), freshWorkspace(), {
        credentials: () =>
          new Promise((resolve) => {
            release = () => resolve({ MOCK_AGENT_API_KEY: 'cle' })
          })
      })
      const started = host.start()
      host.stop()
      release()
      await started
      expect(host.snapshot().status).toBe('idle')
    })

    it('ancien nom de variable retiré au lancement', async () => {
      process.env['MOCK_AGENT_API_KEY'] = 'heritee'
      try {
        const host = hostIn(withSteps('bob-auth-requise'), freshWorkspace(), {
          credentials: () => Promise.resolve({ MOCK_AGENT_API_KEY: undefined })
        })
        await host.start()
        expect(host.snapshot().blocker?.kind).toBe('auth')
        host.stop()
      } finally {
        delete process.env['MOCK_AGENT_API_KEY']
      }
    })

    it('connexion dans un terminal : jamais par authenticate ; Réessayer relance l’agent', async () => {
      const workspace = freshWorkspace()
      const host = hostIn(withSteps('connexion-terminal'), workspace)
      await host.start()
      const blocker = host.snapshot().blocker
      expect(blocker?.kind === 'auth' && blocker.methods[0]?.step).toEqual({
        id: 'mock-login',
        label: 'Se connecter',
        command: 'touch .mock-agent-logged-in'
      })
      await expect(host.authenticate('mock-login')).rejects.toThrow('terminal')
      writeFileSync(join(workspace, '.mock-agent-logged-in'), '')
      await host.retrySession()
      expect(host.snapshot().status).toBe('ready')
      host.stop()
    })

    it('licence non acceptée : blocage dédié, avec l’étape pour la lire ; acceptée → prêt', async () => {
      const workspace = freshWorkspace()
      const host = hostIn(withSteps('bob-licence-requise'), workspace)
      await host.start()
      expect(host.snapshot().blocker).toEqual({
        kind: 'license',
        message: expect.stringContaining('license agreement is required'),
        steps: [{ id: 'show-license', label: 'Lire la licence', command: 'echo licence' }]
      })
      writeFileSync(join(workspace, '.mock-agent-license'), '')
      await host.retrySession()
      expect(host.snapshot().status).toBe('ready')
      host.stop()
    })

    it('licence demandée au message (Bob 2.0.9) : formulaire refusé → explication, pas l’erreur brute', async () => {
      const events: AgentEvent[] = []
      const host = new AgentHost({
        profile: withSteps('bob-licence-formulaire'),
        workspace: freshWorkspace(),
        emit: (e) => events.push(e)
      })
      await host.start()
      expect(host.snapshot().status).toBe('ready')
      const turn = host.prompt('Bonjour')
      await waitFor(() => events.some((e) => e.type === 'elicitation-request'))
      const request = events.find((e) => e.type === 'elicitation-request')
      if (request?.type !== 'elicitation-request') throw new Error('pas de formulaire')
      expect(request.prompt.message).toContain('IBM license agreement')
      host.respondElicitation(request.requestId, { action: 'decline' })
      await turn.catch(() => {})
      host.stop()
      const failure = events.find((e) => e.type === 'turn-error')
      if (failure?.type !== 'turn-error') throw new Error('pas d’échec du tour')
      expect(failure.message).toContain('Agent factice demande d’accepter sa licence')
      expect(failure.message).not.toContain('--show-license')
    })
  })

  describe('élicitation', () => {
    async function untilElicitation(scenario: string, extra: Partial<AgentHostOptions> = {}) {
      const events: AgentEvent[] = []
      const host = new AgentHost({
        profile: mockProfile(scenario),
        workspace: process.cwd(),
        emit: (e) => events.push(e),
        ...extra
      })
      await host.start()
      const turn = host.prompt('Vas-y')
      await waitFor(() => events.some((e) => e.type === 'elicitation-request'))
      const request = events.find((e) => e.type === 'elicitation-request')
      if (request?.type !== 'elicitation-request') throw new Error('pas de demande')
      const transcript = () => events.reduce(reduceTranscript, emptyTranscript).items
      return { host, events, turn, request, transcript }
    }

    it('formulaire : réponse invalide refusée par le main, réponse valide transmise', async () => {
      const { host, turn, request, transcript } = await untilElicitation('bob-elicitation')
      expect(request.prompt.mode).toBe('form')
      expect(() =>
        host.respondElicitation(request.requestId, {
          action: 'accept',
          content: { environnement: 'staging' }
        })
      ).toThrow('Formulaire invalide')
      host.respondElicitation(request.requestId, {
        action: 'accept',
        content: { environnement: 'recette', confirmer: true, instances: 3, regions: ['eu'] }
      })
      await turn
      host.stop()
      expect(transcript().find((i) => i.kind === 'elicitation')).toMatchObject({ state: 'accept' })
      const last = transcript().at(-1)
      expect(last?.kind === 'agent' && last.text).toContain('Déploiement sur recette lancé')
    })

    it('formulaire refusé : l’agent continue sans', async () => {
      const { host, turn, request, transcript } = await untilElicitation('bob-elicitation')
      host.respondElicitation(request.requestId, { action: 'decline' })
      await turn
      host.stop()
      const last = transcript().at(-1)
      expect(last?.kind === 'agent' && last.text).toContain('Déploiement annulé')
    })

    it('Stop pendant un formulaire : demande annulée, tour annulé', async () => {
      const { host, turn, events } = await untilElicitation('bob-elicitation')
      await host.cancel()
      await turn
      host.stop()
      expect(events).toContainEqual(
        expect.objectContaining({ type: 'elicitation-resolved', action: 'cancel' })
      )
      expect(events).toContainEqual({
        type: 'turn-end',
        stopReason: 'cancelled',
        at: expect.any(Number)
      })
    })

    it('page web : accord → lien https ouvert dans le navigateur système', async () => {
      const opened: string[] = []
      const { host, turn, request, transcript } = await untilElicitation('elicitation-url', {
        openExternal: (url) => opened.push(url)
      })
      expect(request.prompt).toMatchObject({ mode: 'url', url: 'https://example.com/autoriser' })
      host.respondElicitation(request.requestId, { action: 'accept' })
      await turn
      host.stop()
      expect(opened).toEqual(['https://example.com/autoriser'])
      const last = transcript().at(-1)
      expect(last?.kind === 'agent' && last.text).toContain('accès autorisé')
    })
  })

  it('prompt avant démarrage : erreur explicite', async () => {
    const { host } = createHost(mockProfile('demo'))
    await expect(host.prompt('Bonjour')).rejects.toThrow('non prêt')
  })
})

describe('AgentHost — session d’essai du diagnostic (fiche 061)', () => {
  const trial = (profile: AgentProfile) =>
    new AgentHost({
      profile,
      workspace: process.cwd(),
      emit: () => {},
      newSession: 'if-deletable'
    })

  it('n’ouvre pas de session chez un agent qui ne saurait pas la supprimer', async () => {
    // Sans historique : l'agent factice n'annonce ni `session/delete` ni les autres.
    const profile = mockProfile('streaming-texte')
    const host = trial({ ...profile, args: [...profile.args, '--sans-historique'] })
    await host.start()
    expect(host.snapshot().status).toBe('ready')
    expect(host.snapshot().info.agentName).toBe('Agent factice')
    expect(host.currentSessionId).toBeUndefined()
    host.stop()
  })

  it('ouvre la session quand l’agent sait la supprimer, et rend ses blocages', async () => {
    const store = mkdtempSync(join(tmpdir(), 'host-trial-'))
    const withStore = (scenario: string): AgentProfile => {
      const profile = mockProfile(scenario)
      return {
        ...profile,
        args: [...profile.args, '--store', store],
        trust: { pattern: UNTRUSTED_WORKSPACE }
      }
    }
    const ready = trial(withStore('streaming-texte'))
    await ready.start()
    expect(ready.currentSessionId).toBeDefined()
    expect(ready.sessionSupport.delete).toBe(true)
    ready.stop()

    const blocked = trial(withStore('bob-workspace-non-approuve'))
    await blocked.start()
    expect(blocked.snapshot().status).toBe('needs-action')
    expect(blocked.snapshot().blocker?.kind).toBe('trust')
    blocked.stop()
  })
})

describe('AgentHost : fin de tour déterministe (fiche 106)', () => {
  it('tous les morceaux reçus avant la réponse de session/prompt précèdent turn-end, puis ready', async () => {
    // Sans délai : les derniers `agent_message_chunk` et la réponse arrivent dans le même souffle.
    const { host, events } = createHost(mockProfile('streaming-texte', 0))
    await host.start()
    await host.prompt('/scenario streaming-texte')
    host.stop()
    const index = (predicate: (e: AgentEvent) => boolean) => events.findIndex(predicate)
    const lastUpdate =
      events.length - 1 - [...events].reverse().findIndex((e) => e.type === 'update')
    const turnEnd = index((e) => e.type === 'turn-end')
    const readyAfterTurn = events.findIndex(
      (e, i) => i > turnEnd && e.type === 'status' && e.snapshot.status === 'ready'
    )
    expect(turnEnd).toBeGreaterThan(lastUpdate)
    expect(readyAfterTurn).toBeGreaterThan(turnEnd)
    // Le fil est complet à la fin du tour : le dernier morceau (la fin du tableau) y est.
    const text = events
      .slice(0, turnEnd)
      .flatMap((e) =>
        e.type === 'update' &&
        e.update.sessionUpdate === 'agent_message_chunk' &&
        e.update.content.type === 'text'
          ? [e.update.content.text]
          : []
      )
      .join('')
    expect(text.trimEnd().endsWith('| b | 2 |')).toBe(true)
  })
})

describe('AgentHost : journal (fiche 080)', () => {
  it('Détaillé : chaque échange ACP dans agents.log ; lancement, tour et arrêt dans main.log', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'host-log-'))
    initLog(dir)
    setVerbosity('detailed')
    try {
      const { host } = createHost(mockProfile('streaming-texte'))
      await host.start()
      await host.prompt('/scenario streaming-texte')
      host.stop()
      const agents = readFileSync(join(dir, 'agents.log'), 'utf8')
      expect(agents).toMatch(/\[— · mock\] → initialize #\d+/)
      expect(agents).toMatch(/← réponse #\d+ initialize .*en \d+/)
      expect(agents).toMatch(/→ session\/prompt #\d+ s .*1 bloc\(s\) text/)
      expect(agents).toMatch(/← agent_message_chunk ×\d+ \(\d+ car\.\)/)
      expect(agents).toMatch(/← réponse #\d+ session\/prompt end_turn en /)
      // Pas d'extrait au niveau Détaillé : le texte du message n'y est pas.
      expect(agents).not.toContain('/scenario streaming-texte')
      const main = readFileSync(join(dir, 'main.log'), 'utf8')
      expect(main).toMatch(/Agent lancé \(mock\) : .* dans /)
      expect(main).toMatch(/Tour fini \(mock\) : end_turn en /)
      await waitFor(() => /Agent arrêté \(mock\)/.test(readFileSync(join(dir, 'main.log'), 'utf8')))
    } finally {
      setVerbosity('normal')
    }
  })
})

describe('AgentHost : contexte de session et /split (fiche 118)', () => {
  /** Module qui déclare un faux `start_child` : la session est celle d'une mère possible. */
  const childrenModule: AppToolModule = {
    id: 'children',
    about: {
      title: 'appToolFamilies.children.title',
      summary: 'appToolFamilies.children.summary',
      condition: 'appToolFamilies.children.condition'
    },
    tools: () => [
      {
        definition: { name: 'start_child', description: 'Start', inputSchema: { type: 'object' } },
        autoAllow: true,
        call: async () => ({ content: [{ type: 'text', text: 'ok' }] })
      }
    ]
  }
  const replyOf = (t: { transcript: () => ReturnType<typeof reduceTranscript>['items'] }) => {
    const reply = t.transcript().at(-1)
    return reply?.kind === 'agent' ? reply.text : ''
  }

  it('joint au premier message de chaque session, d’après les outils reçus ; de nouveau après un redémarrage', async () => {
    const seen: string[][] = []
    const t = await withAppTools('echo', {
      modules: [childrenModule],
      sessionContext: (tools) => {
        seen.push([...tools])
        return tools.includes('start_child') ? 'CAPACITES-DE-SESSION' : undefined
      }
    })
    try {
      await t.host.prompt('Premier')
      expect(replyOf(t)).toContain('CAPACITES-DE-SESSION')
      // Après le message : le titre que l'agent donne à sa session reste le message (Bob).
      expect(replyOf(t).indexOf('Premier')).toBeLessThan(replyOf(t).indexOf('CAPACITES'))
      await t.host.prompt('Deuxième')
      expect(replyOf(t)).not.toContain('CAPACITES-DE-SESSION')
      expect(seen).toEqual([['ask_user', 'start_child']])
      // Une nouvelle session (redémarrage de l'agent) le reçoit à son tour.
      await t.host.restart()
      await t.host.prompt('Après le redémarrage')
      expect(replyOf(t)).toContain('CAPACITES-DE-SESSION')
      // Le message affiché reste celui de l'utilisateur.
      expect(
        t
          .transcript()
          .filter((i) => i.kind === 'user')
          .map((i) => i.text)
      ).toEqual(['Premier', 'Deuxième', 'Après le redémarrage'])
    } finally {
      t.stop()
    }
  })

  it('/split : la demande de découpage part après le message, aussi depuis la file d’attente', async () => {
    const t = await withAppTools('echo', { modules: [childrenModule] })
    try {
      await t.host.send('Trois chantiers', [], { askChildren: true })
      expect(replyOf(t)).toContain('<child_conversations_request>')
      // Après le message (fiche 125) : un agent qui titre sa session d'après lui garde le texte.
      expect(replyOf(t).indexOf('Trois chantiers')).toBeLessThan(
        replyOf(t).indexOf('<child_conversations_request>')
      )
      await t.host.send('Rien de plus')
      expect(replyOf(t)).not.toContain('<child_conversations_request>')
    } finally {
      t.stop()
    }
    // File d'attente : le message garde sa demande, et ne part pas avec un message ordinaire.
    const slow = await withAppTools('streaming-texte', { modules: [childrenModule] })
    try {
      const first = slow.host.send('/scenario streaming-texte')
      await expect.poll(() => slow.host.snapshot().status).toBe('busy')
      await slow.host.send('Deux chantiers', [], { askChildren: true })
      await slow.host.send('/scenario echo')
      expect(slow.host.snapshot().queued.map((m) => m.text)).toEqual([
        '/split Deux chantiers',
        '/scenario echo'
      ])
      await first
      await expect.poll(() => slow.host.snapshot().queued.length, { timeout: 10000 }).toBe(0)
      await expect
        .poll(() => slow.transcript().filter((i) => i.kind === 'agent').length, { timeout: 10000 })
        .toBe(3)
      const agents = slow.transcript().filter((i) => i.kind === 'agent')
      expect(agents[1]?.kind === 'agent' && agents[1].text).not.toContain('/scenario echo')
    } finally {
      slow.stop()
    }
  })
})

describe('mode de départ à l’ouverture (fiche 163)', () => {
  // Comme Bob 2.0.6+ : `_meta["bob/mode"]` lu à `session/new`. Modes du factice : code, ask, plan.
  const profile = (execute: string): AgentProfile => ({
    ...mockProfile('streaming-texte'),
    args: [...mockProfile('streaming-texte').args, '--mode-depart', 'bob/mode'],
    initialModeMeta: { key: 'bob/mode', ids: { plan: 'plan', execute } }
  })
  const modeOf = (host: AgentHost) =>
    host.snapshot().controls.find((c) => c.category === 'mode')?.currentValue

  it('accepté : la session s’ouvre dans le mode demandé', async () => {
    const events: AgentEvent[] = []
    const host = new AgentHost({
      profile: profile('code'),
      workspace: process.cwd(),
      emit: (e) => events.push(e),
      initialMode: 'plan'
    })
    await host.start()
    expect(modeOf(host)).toBe('plan')
    // Pas de `session/set_mode` (son `current_mode_update` donnerait un `update`).
    expect(events.some((e) => e.type === 'update')).toBe(false)
    host.stop()
  })

  it('refusé par l’agent : session ouverte sans, puis mode appliqué comme avant', async () => {
    const events: AgentEvent[] = []
    const host = new AgentHost({
      // « agent » n'est pas un mode du factice : `invalidParams`, comme Bob pour un mode inconnu.
      profile: profile('agent'),
      workspace: process.cwd(),
      emit: (e) => events.push(e),
      initialMode: 'execute'
    })
    await host.start()
    expect(host.snapshot().status).toBe('ready')
    expect(modeOf(host)).toBe('code')
    expect(events.some((e) => e.type === 'notice')).toBe(false)
    host.stop()
  })
})
