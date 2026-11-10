import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { AgentEvent } from '@shared/agent'
import { emptyTranscript, noticeText, reduceTranscript } from '@shared/transcript'
import { MOCK_AGENT_ENTRY } from '../../mock-agent/testing.mts'
import { AgentHost } from './agent-host'
import type { AgentProfile } from './profiles'
import { versionCheck } from './version-check'
import { hostOptions } from '../conversations/host-options'
import type { ConversationRecord } from '../conversations/store'
import { SettingsStore } from '../settings-store'

const profile = {
  label: 'Agent X',
  testedVersions: ['1.19', '2.2.5'],
  minVersion: { version: '1.0', reason: 'casse documentée' }
}
const init = (version: string | undefined, protocolVersion = 1) => ({
  protocolVersion,
  // Version vide : comme un agent qui n'en dit rien (`agentInfo.version` est requis par le SDK).
  agentInfo: { name: 'x', version: version ?? '' }
})

describe('version annoncée : refus ou avis (fiche 198)', () => {
  it('protocole plus récent : refus, mettre l’app à jour', () => {
    const check = versionCheck(profile, init('2.2.5', 2))
    expect(check.refused).toBe(
      'Agent X 2.2.5 est trop récent pour cette version de Bobine (protocole ACP 2, Bobine connaît le 1). Mettez Bobine à jour, puis Relancer.'
    )
    expect(check.logged).toContain('protocole ACP 2')
    expect(check.notice).toBeUndefined()
  })

  it('protocole plus ancien : refus, mettre l’agent à jour ; nom seul sans version', () => {
    expect(versionCheck(profile, init(undefined, 0)).refused).toBe(
      'Agent X est trop ancien pour cette version de Bobine (protocole ACP 0, Bobine connaît le 1). Mettez Agent X à jour, puis Relancer.'
    )
  })

  it('sous le plancher documenté : refus, raison au journal seulement', () => {
    const check = versionCheck(profile, init('0.9.0'))
    expect(check.refused).toBe(
      'Agent X 0.9.0 est trop ancien pour cette version de Bobine (il faut au moins la 1.0). Mettez Agent X à jour, puis Relancer.'
    )
    expect(check.logged).toContain('casse documentée')
  })

  it('plus récente : avis gris avec lien, une clé par version majeure.mineure', () => {
    const first = versionCheck(profile, init('2.3.0'))
    expect(first.refused).toBeUndefined()
    expect(first.notice?.key).toBe('newer:2.3')
    expect(versionCheck(profile, init('2.3.1')).notice?.key).toBe('newer:2.3')
    expect(versionCheck(profile, init('2.4.0-beta.1')).notice?.key).toBe('newer:2.4')
    expect(first.notice?.event).toEqual({
      type: 'notice',
      level: 'info',
      message: {
        key: 'agentHost.version.newer',
        params: { named: 'Agent X 2.3.0', newest: '2.2.5' }
      },
      link: 'diagnostics'
    })
  })

  it('plus ancienne que les essayées : avertissement, une clé par version', () => {
    const check = versionCheck(profile, init('1.18.31'))
    expect(check.refused).toBeUndefined()
    expect(check.notice?.key).toBe('older:1.18.31')
    expect(check.notice?.event.level).toBe('warning')
    if (!check.notice) throw new Error('avis attendu')
    const item = reduceTranscript(emptyTranscript, check.notice.event).items[0]
    expect(item?.kind === 'notice' && noticeText(item).replace(/\u00a0/g, ' ')).toBe(
      'Agent X 1.18.31 est plus ancien que les versions essayées avec Bobine (à partir de 1.19). Il devrait fonctionner ; en cas de problème, mettez Agent X à jour.'
    )
  })

  it('version bizarre : affichée et retenue normalisée, bornée', () => {
    const check = versionCheck(profile, init(`v3.0.0-rc.1\n${'x'.repeat(5000)}`))
    expect(check.notice?.key).toBe('newer:3.0')
    const message = check.notice?.event.message
    expect(typeof message === 'object' && message.params?.['named']).toBe('Agent X 3.0.0-rc.1')
    const older = versionCheck(profile, init(`1.2.3-${'y'.repeat(5000)}`))
    expect(older.notice?.key.length).toBeLessThanOrEqual('older:'.length + 40)
    const refused = versionCheck(profile, init('0.1.0\nstack trace…'))
    expect(refused.refused).toContain('Agent X 0.1.0 est trop ancien')
    expect(refused.logged).not.toContain('\n')
  })

  it('essayée, correctif d’une branche essayée, entre deux, illisible : rien', () => {
    for (const version of ['2.2.5', '2.2.6', '1.19.5', '2.0.1', 'dev', undefined]) {
      expect(versionCheck(profile, init(version)), String(version)).toEqual({})
    }
  })
})

/** Agent factice réel, avec le profil de l'app (versions essayées 0.1.0, plancher 0.0.5). */
function mockProfile(scenario: string, store?: string): AgentProfile {
  return {
    id: 'mock',
    label: 'Agent factice',
    command: process.execPath,
    args: [
      MOCK_AGENT_ENTRY,
      '--scenario',
      scenario,
      '--delay',
      '0',
      ...(store ? ['--store', store] : [])
    ],
    env: {},
    testedVersions: ['0.1.0'],
    minVersion: { version: '0.0.5', reason: 'essai' }
  }
}

/**
 * Hôte d'une conversation, branché comme dans l'app (`hostOptions`) sur des réglages partagés ;
 * sans réglages : hôte nu, comme celui du Diagnostic.
 */
function start(
  scenario: string,
  settings?: SettingsStore,
  session: { store?: string; workspace?: string; reopen?: string } = {}
) {
  const workspace = session.workspace ?? mkdtempSync(join(tmpdir(), 'version-ws-'))
  const events: AgentEvent[] = []
  const emit = (e: AgentEvent) => void events.push(e)
  const profile = mockProfile(scenario, session.store)
  const record = { id: 'c1', workspace } as ConversationRecord
  const reopen = session.reopen ? { sessionId: session.reopen } : undefined
  const host = new AgentHost(
    settings
      ? hostOptions({ profile, record, app: {}, settings, items: () => [], emit, reopen })
      : { profile, workspace, emit, ...(reopen ? { reopen } : {}) }
  )
  const notices = () =>
    events
      .reduce(reduceTranscript, emptyTranscript)
      .items.flatMap((i) => (i.kind === 'notice' ? [{ level: i.level, text: noticeText(i) }] : []))
  return { host, notices, events }
}

const newSettings = () =>
  new SettingsStore({ initial: { recentWorkspaces: [] }, save: () => {}, profiles: [] })

describe('agent factice : versions annoncées (fiche 198)', () => {
  it('version plus récente : avis une seule fois, l’agent répond', async () => {
    const settings = newSettings()
    const first = start('version-plus-recente', settings)
    await first.host.start()
    expect(first.host.snapshot().status).toBe('ready')
    expect(first.notices()).toEqual([
      {
        level: 'info',
        text: 'Agent factice 0.2.0 est plus récent que les versions essayées avec Bobine (jusqu’à 0.1.0).'
      }
    ])
    await first.host.prompt('Bonjour')
    await first.host.stop()

    // Autre conversation, même agent et même version : rien.
    const second = start('version-plus-recente', settings)
    await second.host.start()
    expect(second.notices()).toEqual([])
    await second.host.stop()
  })

  it('version plus ancienne : avertissement, jamais bloquant', async () => {
    const { host, notices } = start('version-plus-ancienne', newSettings())
    await host.start()
    expect(host.snapshot().status).toBe('ready')
    expect(notices()).toMatchObject([{ level: 'warning' }])
    await host.stop()
  })

  it('hôte nu (Diagnostic) : aucun avis', async () => {
    const { host, notices } = start('version-plus-recente')
    await host.start()
    expect(notices()).toEqual([])
    await host.stop()
  })

  it('sous le plancher : démarrage refusé, expliqué, sans sortie d’erreur', async () => {
    const { host, notices } = start('version-trop-ancienne', newSettings())
    await host.start()
    const snapshot = host.snapshot()
    expect(snapshot.status).toBe('error')
    expect(snapshot.detail).toBe(
      'Agent factice 0.0.1 est trop ancien pour cette version de Bobine (il faut au moins la 0.0.5). Mettez Agent factice à jour, puis Relancer.'
    )
    expect(notices()).toEqual([
      { level: 'error', text: `L’agent n’a pas pu démarrer. ${snapshot.detail}` }
    ])
  })

  it('protocole incompatible : démarrage refusé, expliqué', async () => {
    const { host } = start('protocole-incompatible', newSettings())
    await host.start()
    expect(host.snapshot()).toMatchObject({
      status: 'error',
      detail:
        'Agent factice 0.1.0 est trop récent pour cette version de Bobine (protocole ACP 2, Bobine connaît le 1). Mettez Bobine à jour, puis Relancer.'
    })
  })

  it('réouverture sans fil gardé : l’avis survit au rejeu de session/load', async () => {
    const store = mkdtempSync(join(tmpdir(), 'version-store-'))
    const workspace = mkdtempSync(join(tmpdir(), 'version-ws-'))
    // Session créée par un hôte nu (aucun avis réservé).
    const first = start('version-plus-recente', undefined, { store, workspace })
    await first.host.start()
    await first.host.prompt('Première question')
    const sessionId = first.host.currentSessionId
    await first.host.stop()
    expect(sessionId).toBeTruthy()

    const settings = newSettings()
    const again = start('version-plus-recente', settings, {
      store,
      workspace,
      ...(sessionId ? { reopen: sessionId } : {})
    })
    await again.host.start()
    expect(again.host.snapshot().status).toBe('ready')
    // Le fil a été recommencé par le rejeu (`reset`), puis l'avis est arrivé.
    const kinds = again.events.map((e) => e.type)
    expect(kinds.indexOf('reset')).toBeGreaterThanOrEqual(0)
    expect(kinds.indexOf('reset')).toBeLessThan(kinds.indexOf('notice'))
    expect(again.notices().map((n) => n.level)).toEqual(['info'])
    expect(settings.current.versionNotices?.['mock']).toEqual(['newer:0.2'])
    await again.host.stop()
  })

  it('protocole absent de la réponse : toléré, l’agent démarre et répond', async () => {
    const { host, notices } = start('protocole-absent', newSettings())
    await host.start()
    expect(host.snapshot().status).toBe('ready')
    await host.prompt('Bonjour')
    expect(notices()).toEqual([])
    await host.stop()
  })
})
