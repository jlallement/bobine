import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { ConversationEvent } from '@shared/agent'
import { conversationChanges } from '@shared/changes'
import { resolveProfiles } from '../agent/profiles'
import { ConversationManager } from './manager'

/**
 * Redémarrage de l'app sur les mêmes données, par le vrai gestionnaire et l'agent factice tel que
 * l'app le lance (profil `mock` de `resolveProfiles`, mémoire de sessions partagée) : la reprise par
 * `session/load` et son rejeu. Remplace, côté main, les vérifications « après redémarrage » des e2e
 * `replay-changes` (n° 2, 8, 10, 12) et `restart` (n° 2, consommation gardée). Ce qui reste e2e :
 * le vrai lancement d'Electron et l'onglet Modifications dessiné.
 */

async function waitFor(condition: () => boolean, timeoutMs = 10_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (!condition()) {
    if (Date.now() > deadline) throw new Error(`délai dépassé : ${condition.toString()}`)
    await new Promise((r) => setTimeout(r, 20))
  }
}

/** Dossier de données, dossier de travail et mémoire de l'agent factice, gardés entre lancements. */
function environment(scenario: string, env: NodeJS.ProcessEnv = {}) {
  const root = mkdtempSync(join(tmpdir(), 'relance-'))
  const workspace = mkdtempSync(join(tmpdir(), 'relance-ws-'))
  const agentHome = mkdtempSync(join(tmpdir(), 'maison-vide-'))
  const [profile] = resolveProfiles({
    appPath: resolve(__dirname, '..', '..', '..'),
    execPath: process.execPath,
    isPackaged: false,
    env: { BOBINE_AGENT_PROFILE: 'mock', MOCK_AGENT_SCENARIO: scenario, ...env },
    mockStore: join(root, 'mock-store')
  }).filter((p) => p.id === 'mock')
  if (!profile) throw new Error('profil factice absent')
  // Sans délai entre deux envois de l'agent : les essais restent rapides.
  const mock = { ...profile, args: [...profile.args, '--delay', '0'], env: {} }

  /** Un lancement de l'app : un gestionnaire neuf sur les mêmes dossiers. */
  function launch() {
    const events: ConversationEvent[] = []
    const manager = new ConversationManager({
      profiles: [mock],
      settingsFile: join(root, 'settings.json'),
      conversationsDir: join(root, 'conversations'),
      defaultWorkspace: workspace,
      neutralFolder: workspace,
      pathEnv: () => process.env['PATH'],
      emit: (e) => events.push(e),
      emitList: () => {},
      agentHome
    })
    const status = (id: string) => manager.view(id).snapshot?.status
    const ready = (id: string) => waitFor(() => status(id) === 'ready')
    /** Accepte une fois la prochaine demande d'autorisation. */
    const allowOnce = async (id: string) => {
      await waitFor(() => events.some((e) => e.event.type === 'permission-request'))
      const request = events.find((e) => e.event.type === 'permission-request')?.event
      if (request?.type !== 'permission-request') throw new Error('pas de demande')
      const option = request.options.find((o) => o.kind === 'allow_once')
      manager.respondPermission(id, request.requestId, option?.optionId ?? null)
    }
    return { manager, events, status, ready, allowOnce }
  }
  return { root, workspace, launch }
}

/** Un tour joué au premier lancement, puis la conversation rouverte au second (rejeu compris). */
async function liveThenReopened(
  scenario: string,
  prompt: string,
  options: { allow?: boolean; readme?: boolean; loseTranscript?: boolean } = {}
) {
  const env = environment(scenario)
  if (options.readme !== false) {
    writeFileSync(join(env.workspace, 'README.md'), '# Projet\n\nVersion 1\n')
  }
  const first = env.launch()
  const id = first.manager.state().activeId
  await first.manager.startActive()
  const turn = first.manager.prompt(id, prompt)
  if (options.allow) await first.allowOnce(id)
  await turn
  await first.ready(id)
  const live = first.manager.view(id)
  first.manager.stopAll()
  // Fil de l'app perdu : seul le rejeu de `session/load` peut le refaire.
  if (options.loseTranscript) rmSync(join(env.root, 'conversations', `${id}.json`))

  const second = env.launch()
  second.manager.select(id)
  await second.ready(id)
  if (options.loseTranscript) {
    await waitFor(
      () => second.manager.view(id).transcript.items.length >= live.transcript.items.length
    )
  }
  const reopened = second.manager.view(id)
  second.manager.stopAll()
  return { live, reopened, events: second.events, workspace: env.workspace }
}

/** Fichiers et totaux de l'onglet Modifications › Conversation (chemins, diffs, création). */
const changes = (view: { transcript: { items: Parameters<typeof conversationChanges>[0] } }) =>
  conversationChanges(view.transcript.items)
const names = (view: Parameters<typeof changes>[0]) => changes(view).map((c) => basename(c.path))
/** Ce que montre la vue « Conversation » : nom, création, totaux, ou « sans totaux » (`unknown`). */
const shown = (view: Parameters<typeof changes>[0]) =>
  changes(view).map((c) => [basename(c.path), c.created, c.added, c.removed, !!c.unknown])
/**
 * Fil gardé : les modifications rouvertes sont celles d'avant, à l'identique. Fil refait par le
 * rejeu : mêmes fichiers et mêmes totaux (un fichier créé puis complété peut y garder ses blocs).
 */
function expectSameChanges(
  reopened: Parameters<typeof changes>[0],
  live: Parameters<typeof changes>[0],
  rebuilt: boolean
): void {
  if (rebuilt) expect(shown(reopened)).toEqual(shown(live))
  else expect(changes(reopened)).toEqual(changes(live))
}

describe('après redémarrage de l’app : la conversation rouverte par session/load', () => {
  it.each([false, true])(
    'patch d’OpenCode (fil perdu : %s) : mêmes fichiers et totaux qu’en direct, diff refait depuis le patch',
    async (loseTranscript) => {
      const { live, reopened, events } = await liveThenReopened(
        'patch-opencode',
        'Applique le patch',
        { loseTranscript }
      )
      expect(names(live)).toEqual(['notes.md', 'calc.js', 'README.md'])
      expect(changes(live).map((c) => [c.added, c.removed])).toEqual([
        [16, 0],
        [3, 0],
        [1, 1]
      ])
      expectSameChanges(reopened, live, loseTranscript)
      const readme = changes(reopened).find((c) => c.path.endsWith('README.md'))
      expect(readme?.diffs).toEqual([
        { oldText: '# Projet\n\nVersion 1\n', newText: '# Projet\n\nVersion 2\n' }
      ])
      // Fil perdu : refait par le rejeu de l'agent (remise à zéro, puis l'échange rejoué).
      if (loseTranscript) expect(events.some((e) => e.event.type === 'reset')).toBe(true)
    }
  )

  it.each([false, true])(
    'write d’OpenCode qui réécrit (fil perdu : %s) : README.md compte toujours, sans totaux inventés',
    async (loseTranscript) => {
      const { live, reopened } = await liveThenReopened(
        'reecriture-opencode',
        'Réécris le README',
        {
          loseTranscript
        }
      )
      expect(names(live).sort()).toEqual(['README.md', 'nouveau.txt'])
      // Réécrit sans diff (« Wrote file successfully ») : compté, sans totaux.
      expect(shown(live).find(([name]) => name === 'README.md')).toEqual([
        'README.md',
        false,
        0,
        0,
        true
      ])
      expectSameChanges(reopened, live, loseTranscript)
    }
  )

  it.each([false, true])(
    'write d’OpenCode qui crée, avec et sans autorisation (fil perdu : %s) : mêmes créations et totaux',
    async (loseTranscript) => {
      const { live, reopened } = await liveThenReopened('ecriture-opencode', 'Écris les fichiers', {
        allow: true,
        loseTranscript
      })
      expect(names(live).sort()).toEqual(['README.md', 'autorise.txt', 'nouveau.txt'])
      expect(
        changes(live)
          .filter((c) => c.created)
          .map((c) => basename(c.path))
          .sort()
      ).toEqual(['autorise.txt', 'nouveau.txt'])
      expectSameChanges(reopened, live, loseTranscript)
    }
  )

  it('fichier créé par Bob (diff oldText "") : toujours « Création » une fois le fichier sur le disque', async () => {
    const { live, reopened, workspace } = await liveThenReopened(
      'creation-bob',
      'Crée notes/alpha.txt',
      { allow: true, readme: false }
    )
    // À la réouverture, le fichier existe : la décision prise à la demande est gardée.
    expect(existsSync(join(workspace, 'notes', 'alpha.txt'))).toBe(true)
    const created = (view: typeof live) => changes(view).map((c) => [basename(c.path), c.created])
    expect(created(live)).toEqual([['alpha.txt', true]])
    expect(created(reopened)).toEqual([['alpha.txt', true]])
  })

  it('consommation de la conversation gardée : jetons, tours et coût relus', async () => {
    const { live, reopened } = await liveThenReopened('patch-opencode', 'Applique le patch')
    expect(live.summary.usage).toMatchObject({ turns: 1, cost: { currency: 'USD' } })
    expect(live.summary.usage?.total).toBeGreaterThan(0)
    expect(reopened.summary.usage).toEqual(live.summary.usage)
  })
})
