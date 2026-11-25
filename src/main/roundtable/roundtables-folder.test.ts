/**
 * Dossier changé pendant un tour de table (passe de contrôle du 2026-11-25, S1) : un fait du tour,
 * une marque de place seulement quand l'écart est attribuable, aucun bandeau par participant dans
 * la conversation d'origine, une seule mention dans la demande de synthèse.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { choice, motherWithExchange, roundtableEnv, type RoundtableEnv } from './test-env'

const envs: RoundtableEnv[] = []
afterEach(() => {
  for (const env of envs.splice(0)) env.stop()
})

const QUESTION = 'Quelle piste pour la moyenne de calc.js ?'

function lockFile(): string {
  const file = join(mkdtempSync(join(tmpdir(), 'tour-verrou-')), 'verrou')
  writeFileSync(file, '')
  return file
}

/** Participants qui travaillent tous en même temps (tour tenu jusqu'au retrait du verrou). */
async function overlapping(scenario: string, others: number) {
  const lock = lockFile()
  const env = await roundtableEnv({
    profiles: (mock) => [
      mock('ecrit', scenario, ['--verrou-fin-de-tour', lock], { writesWithoutAsking: true }),
      mock('autre', 'avis-participant', ['--verrou-fin-de-tour', lock], {
        writesWithoutAsking: true
      }),
      mock('trois', 'avis-participant', ['--verrou-fin-de-tour', lock], {
        writesWithoutAsking: true
      })
    ]
  })
  envs.push(env)
  const mother = await motherWithExchange(env)
  const pool = [
    choice('autre', 'factice-rapide'),
    choice('autre', 'factice-precis'),
    choice('trois', 'factice-rapide'),
    choice('trois', 'factice-precis')
  ]
  await env.roundtables.start(mother, {
    question: QUESTION,
    participants: [choice('ecrit', 'factice-rapide'), ...pool.slice(0, others)]
  })
  await env.waitFor(
    () => env.rt(mother).seats.every((s) => s.state === 'working'),
    'tous au travail en même temps'
  )
  rmSync(lock)
  await env.waitFor(() => env.rt(mother).phase === 'synthesized', 'synthèse rendue', 20_000)
  const writer = env.rt(mother).seats.find((s) => s.profileId === 'ecrit')
  return { env, mother, writer }
}

const folderNotices = (env: RoundtableEnv, id: string) =>
  env
    .items(id)
    .filter(
      (i) =>
        i.kind === 'notice' &&
        typeof i.message === 'object' &&
        i.message.key === 'roles.notice.childFolderChanged'
    )

describe('dossier changé pendant un tour de table (passe de contrôle, S1)', () => {
  it('un écrivain par son outil, quatre autres : une marque de tour, seul l’écrivain marqué', async () => {
    const { env, mother, writer } = await overlapping('participant-ecrit', 4)
    const rt = env.rt(mother)
    expect(rt.folderChanged).toEqual({ collecting: ['note-participant.md'] })
    expect(rt.seats.filter((s) => s.changedFolder).map((s) => s.letter)).toEqual([writer?.letter])
    expect(folderNotices(env, mother)).toEqual([])
    // Une seule mention à l'arbitre, qui nomme l'écrivain.
    const reply = env.replies(mother).at(-1) ?? ''
    expect(reply).toContain('dossier changé : oui')
  }, 40_000)

  it('écriture hors de tout outil, d’autres au travail : marque du tour, personne d’accusé', async () => {
    const { env, mother } = await overlapping('participant-ecrit-cache', 1)
    const rt = env.rt(mother)
    expect(rt.folderChanged).toEqual({ collecting: ['note-cachee.md'] })
    expect(rt.seats.some((s) => s.changedFolder)).toBe(false)
    expect(folderNotices(env, mother)).toEqual([])
  }, 40_000)

  it('réplique : le dossier changé pendant la réplique est une marque à part', async () => {
    const env = await roundtableEnv({
      profiles: (mock) => [
        mock('ecrit', 'participant-ecrit-replique', [], { writesWithoutAsking: true }),
        mock('autre', 'avis-participant', [], { writesWithoutAsking: true })
      ]
    })
    envs.push(env)
    const mother = await motherWithExchange(env)
    await env.roundtables.start(mother, {
      question: QUESTION,
      participants: [choice('ecrit', 'factice-rapide'), choice('autre', 'factice-rapide')]
    })
    await env.waitFor(() => env.rt(mother).phase === 'synthesized', 'synthèse rendue')
    expect(env.rt(mother).folderChanged).toBeUndefined()
    env.roundtables.rebuttal(mother, env.rt(mother).roundtableId)
    await env.waitFor(() => env.rt(mother).phase === 'decided', 'décision rendue', 20_000)
    expect(env.rt(mother).folderChanged).toEqual({ rebuttal: ['note-replique.md'] })
    expect(env.replies(mother).at(-1)).toContain('dossier changé : oui')
    expect(folderNotices(env, mother)).toEqual([])
  }, 40_000)
})

describe('attribution et « Synthétiser sans attendre » (échec e2e macOS du 2026-11-25)', () => {
  it('l’écrivain reste marqué après la synthèse sans attendre, et la demande le nomme', async () => {
    const lock = lockFile()
    const env = await roundtableEnv({
      lead: 'echo',
      profiles: (mock) => [
        mock('ecrit', 'participant-ecrit', [], { writesWithoutAsking: true }),
        mock('lent', 'avis-participant', ['--verrou-fin-de-tour', lock], {
          writesWithoutAsking: true
        })
      ]
    })
    envs.push(env)
    const mother = await motherWithExchange(env)
    await env.roundtables.start(mother, {
      question: QUESTION,
      participants: [
        choice('ecrit', 'factice-rapide'),
        choice('panel', 'factice-rapide'),
        choice('lent', 'factice-rapide')
      ]
    })
    const writer = () => env.rt(mother).seats.find((s) => s.profileId === 'ecrit')
    await env.waitFor(
      () =>
        !!writer()?.changedFolder &&
        env.rt(mother).seats.filter((s) => s.state === 'answered').length === 2,
      'écrivain marqué, deux avis'
    )
    // Le lent travaille encore : « Synthétiser sans attendre » l'arrête.
    env.roundtables.synthesize(mother, env.rt(mother).roundtableId)
    await env.waitFor(() => env.rt(mother).phase === 'synthesized', 'synthèse rendue', 20_000)
    rmSync(lock)
    const slow = env.rt(mother).seats.find((s) => s.profileId === 'lent')
    expect(slow).toMatchObject({ state: 'stopped', stopped: 'early-synthesis' })
    expect(slow?.changedFolder).toBeUndefined()
    expect(writer()?.changedFolder).toBe(true)
    expect(env.replies(mother).at(-1)).toContain(
      `The folder changed during the roundtable: note-participant.md. Attributable to Participant ${writer()?.letter}.`
    )
  }, 40_000)
})
