import { describe, expect, it } from 'vitest'
import type { AgentEvent, AppToolsState } from './agent'
import { emptyTranscript, reduceTranscript, type TranscriptState } from './transcript'

const appTools = (state: AppToolsState, family = 'ios-simulator'): AgentEvent => ({
  type: 'app-tools',
  family,
  state
})
const run = (events: AgentEvent[], from: TranscriptState = emptyTranscript) =>
  events.reduce(reduceTranscript, from)
const notices = (state: TranscriptState) =>
  state.items.flatMap((i) =>
    i.kind === 'notice'
      ? [{ key: i.message?.key, level: i.level, action: i.action, family: i.appTools }]
      : []
  )

describe('avis des outils apparus avec un projet (fiche 241)', () => {
  it('« à redémarrer » : avis avec l’action, un seul à la fois, toujours le dernier du fil', () => {
    const state = run([
      appTools('pending'),
      { type: 'notice', level: 'info', message: 'entre-temps' },
      appTools('pending')
    ])
    expect(notices(state)).toEqual([
      { key: undefined, level: 'info', action: undefined, family: undefined },
      {
        key: 'transcript.notice.appTools.iosPending',
        level: 'warning',
        action: 'restart-agent',
        family: 'ios-simulator'
      }
    ])
  })

  it('outils reçus ensuite : l’avis laisse la place à une ligne discrète, sans action', () => {
    expect(notices(run([appTools('pending'), appTools('session')]))).toEqual([
      {
        key: 'transcript.notice.appTools.iosSession',
        level: 'info',
        action: undefined,
        family: 'ios-simulator'
      }
    ])
    expect(notices(run([appTools('pending'), appTools('live')])).map((n) => n.key)).toEqual([
      'transcript.notice.appTools.iosLive'
    ])
  })

  it('session ouverte sans avis en attente : rien ; relue en cours de session : ligne discrète', () => {
    expect(run([appTools('session')]).items).toEqual([])
    expect(notices(run([appTools('live', 'android-emulator')]))).toEqual([
      {
        key: 'transcript.notice.appTools.androidLive',
        level: 'info',
        action: undefined,
        family: 'android-emulator'
      }
    ])
  })

  it('familles distinctes : chacune son avis ; famille inconnue : textes généraux', () => {
    const state = run([appTools('pending'), appTools('pending', 'android-emulator')])
    expect(notices(state).map((n) => n.key)).toEqual([
      'transcript.notice.appTools.iosPending',
      'transcript.notice.appTools.androidPending'
    ])
    expect(notices(run([appTools('pending', 'autre')]))[0]?.key).toBe(
      'transcript.notice.appTools.otherPending'
    )
  })
})
