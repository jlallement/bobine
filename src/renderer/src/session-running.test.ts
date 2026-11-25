import { describe, expect, it } from 'vitest'
import type { TranscriptItem } from '@shared/transcript'
import {
  childObservations,
  EMPTY_RUNNING,
  serverObservations,
  subagentObservations,
  terminalObservations,
  trackRunning
} from './session-running'

const SINCE = 1_000

describe('en cours et terminées (fiche 166)', () => {
  it('fiche 267 : un travail bloqué par un modèle refusé : « bloqué », sans « Arrêter »', () => {
    const [entry] = childObservations(
      [
        {
          id: 'f',
          title: 'Fille',
          status: 'needs-action',
          modelRefused: { name: 'Factice rapide', quota: true }
        }
      ],
      {}
    )
    expect(entry).toMatchObject({ key: 'child:f', blocked: true })
    expect(entry?.stop).toBeUndefined()
    // Un accord à donner (sans refus de modèle) : toujours arrêtable.
    expect(
      childObservations([{ id: 'g', title: 'G', status: 'needs-action' }], {})[0]?.stop
    ).toEqual({ kind: 'child', childId: 'g' })
  })

  it('ce qui n’est plus observé a fini maintenant ; la durée part du premier coup d’œil', () => {
    const child = childObservations([{ id: 'f', title: 'Fille', status: 'busy' }], {})
    let state = trackRunning(EMPTY_RUNNING, child, 2_000, SINCE)
    expect(state.running).toEqual([
      {
        key: 'child:f',
        kind: 'child',
        label: 'Fille',
        childId: 'f',
        startedAt: 2_000,
        stop: { kind: 'child', childId: 'f' }
      }
    ])
    state = trackRunning(state, child, 5_000, SINCE)
    expect(state.running[0]?.startedAt).toBe(2_000)
    // La fille a fini son tour : elle n'est plus observée.
    const idle = childObservations([{ id: 'f', title: 'Fille', status: 'ready' }], {})
    state = trackRunning(state, idle, 9_000, SINCE)
    expect(state.running).toEqual([])
    expect(state.finished).toEqual([
      {
        key: 'child:f',
        kind: 'child',
        label: 'Fille',
        childId: 'f',
        startedAt: 2_000,
        endedAt: 9_000
      }
    ])
    // Elle reprend : de nouveau en cours, plus dans les terminées.
    state = trackRunning(state, child, 10_000, SINCE)
    expect(state.running).toHaveLength(1)
    expect(state.finished).toEqual([])
  })

  it('terminal : seulement pendant qu’une commande tourne, sous son nom, depuis son début', () => {
    const idle = { id: '1', title: 'projet', cwd: '/p', busy: false, startedAt: 1_500 }
    // Shell à l'invite : rien en cours.
    expect(terminalObservations([idle])).toEqual([])
    let state = trackRunning(EMPTY_RUNNING, terminalObservations([idle]), 2_000, SINCE)
    expect(state).toEqual(EMPTY_RUNNING)
    // `sleep 30` lancé : en cours, nommé, durée depuis le début de la commande (pas du shell).
    const sleeping = {
      ...idle,
      title: 'sleep',
      busy: true,
      command: { name: 'sleep', startedAt: 4_000 }
    }
    state = trackRunning(state, terminalObservations([sleeping]), 4_200, SINCE)
    expect(state.running).toEqual([
      {
        key: 'terminal:1:4000',
        kind: 'terminal',
        label: 'sleep',
        startedAt: 4_000,
        stop: { kind: 'terminal', tabId: '1' }
      }
    ])
    // Retour à l'invite : disparaît, sans aller dans « Terminées ».
    state = trackRunning(state, terminalObservations([idle]), 9_000, SINCE)
    expect(state).toEqual(EMPTY_RUNNING)
    // Commande suivante : une autre ligne, avec son propre début ; shell fini : plus rien.
    const vim = { ...sleeping, title: 'vim', command: { name: 'vim', startedAt: 10_000 } }
    state = trackRunning(state, terminalObservations([vim]), 10_100, SINCE)
    expect(state.running.map((e) => [e.key, e.label, e.startedAt])).toEqual([
      ['terminal:1:10000', 'vim', 10_000]
    ])
    expect(terminalObservations([{ ...vim, exitCode: 0 }])).toEqual([])
    state = trackRunning(state, [], 11_000, SINCE)
    expect(state).toEqual(EMPTY_RUNNING)
  })

  it('serveur arrêté : terminé ; arrêtable tant qu’il tourne', () => {
    const servers = serverObservations([
      { name: 'web', status: 'running', url: 'u', command: 'c', startedAt: 1_200 },
      { name: 'api', status: 'exited', url: 'u', command: 'c', startedAt: 1_100, endedAt: 1_900 }
    ])
    const state = trackRunning(EMPTY_RUNNING, servers, 2_000, SINCE)
    expect(state.running.map((e) => [e.key, e.stop])).toEqual([
      ['server:web', { kind: 'server', name: 'web' }]
    ])
    expect(state.finished).toEqual([
      { key: 'server:api', kind: 'server', label: 'api', startedAt: 1_100, endedAt: 1_900 }
    ])
  })

  it('fini avant le lancement de l’app : pas compté', () => {
    const old = serverObservations([
      { name: 'web', status: 'exited', url: 'u', command: 'c', startedAt: 100, endedAt: 500 }
    ])
    expect(trackRunning(EMPTY_RUNNING, old, 2_000, SINCE).finished).toEqual([])
  })

  it('sous-agents en arrière-plan : ni arrêt (ACP n’en a pas), ni ceux de premier plan', () => {
    const tool = (id: string, run: object): TranscriptItem => ({
      kind: 'tool',
      id: 1,
      toolCallId: id,
      title: 'task',
      status: 'in_progress',
      content: [],
      locations: [],
      subagent: { task: `Explorer ${id}` },
      subagentRun: run
    })
    const items = [
      tool('a', { background: true, startedAt: 1_500 }),
      tool('b', { background: true, startedAt: 1_200, endedAt: 1_800 }),
      tool('c', { startedAt: 1_300 })
    ]
    const state = trackRunning(EMPTY_RUNNING, subagentObservations(items), 2_000, SINCE)
    expect(state.running).toEqual([
      { key: 'subagent:a', kind: 'subagent', label: 'Explorer a', startedAt: 1_500 }
    ])
    expect(state.finished.map((e) => e.key)).toEqual(['subagent:b'])
  })
})

describe('participants d’un tour de table (fiche 285, B2)', () => {
  it('marqués pour l’icône du tour, pas celle d’une fille', () => {
    const [entry] = childObservations(
      [
        {
          id: 'p',
          title: 'Alpha',
          status: 'busy',
          role: { name: 'participant', label: 'Participant', icon: 'users', color: 'graphite' },
          roundtable: { id: 'rt', active: true, state: 'working' }
        }
      ],
      {}
    )
    expect(entry?.roundtable).toBe(true)
  })

  it('G3 (recette) : la réplique repart de son propre début, pas de celui de l’avis', () => {
    const seat = (since: number, status: 'busy' | 'ready') =>
      childObservations(
        [
          {
            id: 'p',
            title: 'Alpha',
            status,
            roundtable: { id: 'rt', active: true, state: 'working', since }
          }
        ],
        {}
      )
    let state = trackRunning(EMPTY_RUNNING, seat(2_000, 'busy'), 3_000, SINCE)
    expect(state.running[0]?.startedAt).toBe(2_000)
    state = trackRunning(state, seat(2_000, 'ready'), 60_000, SINCE)
    expect(state.running).toEqual([])
    // La réplique part bien plus tard : le chronomètre part de là.
    state = trackRunning(state, seat(170_000, 'busy'), 171_000, SINCE)
    expect(state.running[0]?.startedAt).toBe(170_000)
  })

  it('une entrée finie qui repart, sans début connu : son chronomètre repart de maintenant', () => {
    const child = (status: 'busy' | 'ready') =>
      childObservations([{ id: 'f', title: 'Import', status }], {})
    let state = trackRunning(EMPTY_RUNNING, child('busy'), 2_000, SINCE)
    state = trackRunning(state, child('ready'), 5_000, SINCE)
    state = trackRunning(state, child('busy'), 9_000, SINCE)
    expect(state.running[0]?.startedAt).toBe(9_000)
  })
})
