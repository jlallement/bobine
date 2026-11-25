/**
 * Tour de table, corrections de la recette fonctionnelle et de la revue UX (fiche 285), sur
 * l'agent factice : arrêt cohérent, fiches des participants, corbeille, étiquette de la synthèse,
 * erreurs typées, durée après « Relancer », titres lisibles.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { bobDbCosts } from '../agent/bob-costs'
import { deleteConversation } from '../conversations/family-delete'
import { roundtableHandlers } from './ipc'
import {
  FAST,
  PRECISE,
  choice,
  motherWithExchange,
  roundtableEnv,
  type EnvOptions,
  type RoundtableEnv
} from './test-env'

const envs: RoundtableEnv[] = []
afterEach(() => {
  for (const env of envs.splice(0)) env.stop()
})

async function setup(options: EnvOptions = {}) {
  const env = await roundtableEnv(options)
  envs.push(env)
  const mother = await motherWithExchange(env)
  return { env, mother }
}

const QUESTION = 'Quelle piste pour la moyenne de calc.js ?'

function lockFile(): string {
  const file = join(mkdtempSync(join(tmpdir(), 'tour-verrou-')), 'verrou')
  writeFileSync(file, '')
  return file
}

const summaryOf = (env: RoundtableEnv, id: string | undefined) =>
  env.manager.state().conversations.find((c) => c.id === id)

describe('arrêt du tour (B5a)', () => {
  it('« arrêt en cours », puis « arrêté » seulement une fois les participants arrêtés et marqués', async () => {
    const lock = lockFile()
    const { env, mother } = await setup({
      profiles: (mock) => [mock('lent', 'avis-participant', ['--verrou-fin-de-tour', lock])]
    })
    await env.roundtables.start(mother, {
      question: QUESTION,
      participants: [choice('lent', 'factice-rapide'), choice('lent', 'factice-precis')]
    })
    await env.waitFor(
      () => env.rt(mother).seats.every((s) => s.state === 'working'),
      'participants au travail'
    )
    const seen: { phase: string; stopping: boolean; busy: boolean; marked: boolean }[] = []
    env.manager.subscribe({
      event: ({ conversationId, event }) => {
        if (conversationId !== mother || event.type !== 'roundtable') return
        const children = event.roundtable.seats.map((s) => summaryOf(env, s.childId))
        seen.push({
          phase: event.roundtable.phase,
          stopping: !!event.roundtable.stopping,
          busy: children.some((c) => c?.status === 'busy'),
          marked: children.every((c) => c?.roundtable?.state === 'stopped')
        })
      }
    })
    await env.roundtables.stop(mother, env.rt(mother).roundtableId)
    expect(seen[0]).toMatchObject({ phase: 'collecting', stopping: true })
    // Au moment où la carte dit « arrêté », plus aucun participant ne travaille, et leurs fiches
    // le disent déjà.
    expect(seen.find((s) => s.phase === 'stopped')).toEqual({
      phase: 'stopped',
      stopping: false,
      busy: false,
      marked: true
    })
    expect(env.rt(mother).seats.every((s) => s.stopped === 'roundtable-stopped')).toBe(true)
    rmSync(lock)
  })
})

describe('fiches des participants (M7, B5b)', () => {
  it('participant au modèle refusé : jamais « fini » ; tour en cours dit, puis plus en cours', async () => {
    const { env, mother } = await setup({ panel: ['--refuser-modele', 'factice-precis'] })
    await env.roundtables.start(mother, {
      question: QUESTION,
      participants: [FAST, PRECISE, choice('panel', 'autre-absent')]
    })
    const id = env.rt(mother).roundtableId
    const refused = () => env.rt(mother).seats.find((s) => s.model?.value === 'factice-precis')
    await env.waitFor(() => refused()?.state === 'error', 'modèle refusé')
    expect(summaryOf(env, refused()?.childId)?.roundtable).toEqual({
      id,
      active: true,
      state: 'error'
    })
    await env.waitFor(() => env.rt(mother).phase === 'insufficient', 'un seul avis')
    // Recueil fini : la barre latérale peut le ranger ; l'état d'erreur reste.
    expect(summaryOf(env, refused()?.childId)?.roundtable).toEqual({
      id,
      active: false,
      state: 'error'
    })
    const answered = env.rt(mother).seats.find((s) => s.state === 'answered')
    expect(summaryOf(env, answered?.childId)?.roundtable?.state).toBe('answered')
  })
})

describe('corbeille et restauration (S1, S2)', () => {
  it('rien de figé dans le tour : participant à la corbeille ou restauré avec la famille, son avis reste', async () => {
    const { env, mother } = await setup()
    await env.roundtables.start(mother, { question: QUESTION, participants: [FAST, PRECISE] })
    await env.waitFor(() => env.rt(mother).phase === 'synthesized', 'synthèse rendue')
    const [a] = env.rt(mother).seats.map((s) => s.childId ?? '')
    // Un participant seul à la corbeille, puis restauré.
    await env.manager.delete(a ?? '', { fromAgent: false })
    expect(
      env.rt(mother).seats.every((s) => s.removed === undefined && s.state === 'answered')
    ).toBe(true)
    env.manager.restoreFromTrash(a ?? '')
    expect(summaryOf(env, a)?.roundtable?.state).toBe('answered')
    // La conversation d'origine et sa famille à la corbeille, puis restaurées.
    await deleteConversation(env.manager, mother, { fromAgent: false, children: 'delete' })
    expect(summaryOf(env, a)).toBeUndefined()
    env.manager.restoreFromTrash(mother)
    expect(summaryOf(env, a)).toBeDefined()
    expect(
      env.rt(mother).seats.every((s) => s.removed === undefined && s.state === 'answered')
    ).toBe(true)
  })
})

describe('étiquette de la synthèse (S3)', () => {
  it('agent et modèle relevés au départ de la synthèse, pas au lancement', async () => {
    const { env, mother } = await setup()
    await env.roundtables.start(mother, { question: QUESTION, participants: [FAST, PRECISE] })
    // Modèle de la conversation changé pendant le recueil.
    await env.manager.setControl(mother, 'model', 'factice-precis')
    await env.waitFor(() => env.rt(mother).phase === 'synthesized', 'synthèse rendue')
    expect(env.rt(mother).synthesizer.model).toBe('Factice rapide')
    expect(env.rt(mother).synthesis?.by).toEqual({
      profileId: 'lead',
      label: 'Factice lead',
      model: 'Factice précis'
    })
  })
})

describe('erreurs typées et petits défauts (M1, M11, M12, titres)', () => {
  it('question trop longue par l’IPC : l’erreur `question`, même au-delà de la borne du contrat', async () => {
    const { env, mother } = await setup()
    const handlers = roundtableHandlers(env.roundtables)
    for (const length of [8_001, 100_001]) {
      expect(
        await handlers['roundtable:start'](mother, {
          question: 'x'.repeat(length),
          participants: [FAST, PRECISE]
        })
      ).toEqual({ ok: false, error: 'question' })
    }
  })

  it('conversation archivée : le refus d’un geste parle du tour en cours, pas d’un lancement', async () => {
    const { env, mother } = await setup()
    await env.roundtables.start(mother, { question: QUESTION, participants: [FAST, PRECISE] })
    await env.waitFor(() => env.rt(mother).phase === 'synthesized', 'synthèse rendue')
    env.manager.setArchived(mother, true)
    expect(() => env.roundtables.rebuttal(mother, env.rt(mother).roundtableId)).toThrow(
      /continuer son tour de table/
    )
  })

  it('« Relancer » : la durée repart de la nouvelle tentative ; titre et libellé lisibles, sans préfixe', async () => {
    const { env, mother } = await setup({
      panel: ['--scenario-par-modele', 'factice-precis=avis-erreur']
    })
    await env.roundtables.start(mother, { question: QUESTION, participants: [FAST, PRECISE] })
    await env.waitFor(() => env.rt(mother).phase === 'insufficient', 'pas de synthèse')
    const failed = env.rt(mother).seats.find((s) => s.state === 'error')
    const first = failed?.startedAt ?? 0
    await new Promise((resolve) => setTimeout(resolve, 20))
    await env.roundtables.relaunch(mother, env.rt(mother).roundtableId, failed?.letter ?? 'A')
    const again = env.rt(mother).seats.find((s) => s.letter === failed?.letter)
    expect(again?.startedAt).toBeGreaterThan(first)
    // Nom lu dans la session du participant : « Factice précis », pas « factice-precis ».
    expect(again?.label).toBe('Factice précis')
    expect(summaryOf(env, failed?.childId)?.title).toBe('Factice précis')
  })
})

describe('plafond de la conversation d’un participant (S5)', () => {
  it('avis complet quand le plafond se déclenche : il a répondu et entre dans la synthèse', async () => {
    const { env, mother } = await setup({ lead: 'echo' })
    // Plafond bas, figé au premier message de chaque participant (la conversation d'origine a
    // déjà le sien, aucun).
    env.manager.settings.setPreferences({ costCapEnabled: true, costCapAmount: 0.01 })
    await env.roundtables.start(mother, { question: QUESTION, participants: [FAST, PRECISE] })
    await env.waitFor(() => env.rt(mother).phase === 'synthesized', 'synthèse rendue')
    expect(env.rt(mother).seats.map((s) => s.state)).toEqual(['answered', 'answered'])
    expect(env.replies(mother).at(-1)).toContain('answered="2" absent="0"')
  })

  it('coût lu après la réponse (comme Bob, `--cout-bob`) : l’avis compte ; la réplique retenue montre un libellé', async () => {
    const bobDb = join(mkdtempSync(join(tmpdir(), 'tour-bob-')), 'bob.db')
    const { env, mother } = await setup({
      profiles: (mock) => [
        {
          ...mock('bob', 'avis-participant', ['--bob-db', bobDb, '--cout-bob'], {
            childModelChoice: undefined
          }),
          costSource: bobDbCosts(bobDb)
        }
      ]
    })
    env.manager.settings.setPreferences({ costCapEnabled: true, costCapAmount: 0.01 })
    await env.roundtables.start(mother, {
      question: QUESTION,
      participants: [FAST, choice('bob')]
    })
    await env.waitFor(() => env.rt(mother).phase === 'synthesized', 'synthèse rendue')
    const bob = env.rt(mother).seats.find((s) => s.profileId === 'bob')
    expect(bob?.state).toBe('answered')
    // Son coût (0,0125) est relu après la réponse : la réplique est retenue par son plafond.
    await env.waitFor(
      () => (summaryOf(env, bob?.childId)?.usage?.cost?.amount ?? 0) > 0.01,
      'coût de Bob relu',
      15_000
    )
    env.roundtables.rebuttal(mother, env.rt(mother).roundtableId)
    await env.waitFor(
      () => env.rt(mother).seats.find((s) => s.profileId === 'bob')?.rebuttal?.held === true,
      'réplique retenue'
    )
    const card = env.items(bob?.childId ?? '').findLast((i) => i.kind === 'cost-cap')
    expect(card?.kind === 'cost-cap' && card.held).toBe('Réplique du tour de table')
  }, 30_000)

  it('question retenue par le plafond : place « retenue », pas un aller-retour invisible ; « Continuer » reprend l’avis', async () => {
    const lock = lockFile()
    const { env, mother } = await setup({
      profiles: (mock) => [
        mock('lent', 'avis-participant', ['--verrou-fin-de-tour', lock]),
        mock('demarre', 'avis-participant', ['--demarrage-lent', '600'])
      ]
    })
    await env.roundtables.start(mother, {
      question: QUESTION,
      participants: [choice('lent', 'factice-rapide'), choice('demarre', 'factice-rapide')]
    })
    const id = env.rt(mother).roundtableId
    const seat = () => env.rt(mother).seats.find((s) => s.profileId === 'demarre')
    // Arrêté pendant son lancement, puis sa conversation au-delà de son plafond.
    await env.roundtables.stop(mother, id, seat()?.letter)
    const childId = seat()?.childId ?? ''
    env.manager.post(childId, { type: 'usage-report', cost: { amount: 1, currency: 'USD' } })
    env.costCap.setCap(childId, { limit: 0.01, unit: 'USD' })
    await env.roundtables.relaunch(mother, id, seat()?.letter ?? 'A')
    await env.waitFor(() => seat()?.held === true, 'question retenue')
    expect(seat()?.state).toBe('waiting')
    expect(env.rt(mother).phase).toBe('collecting')
    const card = env.items(childId).findLast((i) => i.kind === 'cost-cap')
    expect(card?.kind === 'cost-cap' && card.held).toBe('Question du tour de table')
    env.costCap.answer(childId, card?.id ?? 0, 'continue')
    await env.waitFor(() => seat()?.state === 'answered', 'avis repris après « Continuer »')
    expect(seat()?.held).toBeUndefined()
    rmSync(lock)
    await env.waitFor(() => env.rt(mother).phase === 'synthesized', 'synthèse rendue')
  })

  it('synthèse retenue : la carte montre « Demande de synthèse du tour de table », jamais la consigne', async () => {
    const { env, mother } = await setup()
    env.costCap.setCap(mother, { limit: 0.001, unit: 'USD' })
    await env.roundtables.start(mother, { question: QUESTION, participants: [FAST, PRECISE] })
    await env.waitFor(() => env.rt(mother).synthesis?.state === 'held', 'synthèse retenue')
    const card = env.items(mother).findLast((i) => i.kind === 'cost-cap')
    expect(card?.kind === 'cost-cap' && card.held).toBe('Demande de synthèse du tour de table')
  })
})

describe('contre-revue : question retenue puis arrêt (N1, N12)', () => {
  it('question retenue, place arrêtée : « Continuer » ne l’envoie plus ; un message tapé garde son texte sur la carte', async () => {
    const lock = lockFile()
    const { env, mother } = await setup({
      profiles: (mock) => [
        mock('lent', 'avis-participant', ['--verrou-fin-de-tour', lock]),
        mock('demarre', 'avis-participant', ['--demarrage-lent', '600'])
      ]
    })
    await env.roundtables.start(mother, {
      question: QUESTION,
      participants: [choice('lent', 'factice-rapide'), choice('demarre', 'factice-rapide')]
    })
    const id = env.rt(mother).roundtableId
    const seat = () => env.rt(mother).seats.find((s) => s.profileId === 'demarre')
    await env.roundtables.stop(mother, id, seat()?.letter)
    const childId = seat()?.childId ?? ''
    env.manager.post(childId, { type: 'usage-report', cost: { amount: 1, currency: 'USD' } })
    env.costCap.setCap(childId, { limit: 0.01, unit: 'USD' })
    await env.roundtables.relaunch(mother, id, seat()?.letter ?? 'A')
    await env.waitFor(() => seat()?.held === true, 'question retenue')
    const card = env.items(childId).findLast((i) => i.kind === 'cost-cap')
    // La place est arrêtée pendant que sa question attend « Continuer ».
    await env.roundtables.stop(mother, id, seat()?.letter)
    env.costCap.answer(childId, card?.id ?? 0, 'continue')
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(env.users(childId)).toEqual([])
    expect(seat()?.state).toBe('stopped')
    // Un message tapé par l'utilisateur dans cette conversation, retenu : son texte, pas un libellé.
    env.costCap.setCap(childId, { limit: 0.01, unit: 'USD' })
    void env.manager.prompt(childId, 'Ma propre question')
    await env.waitFor(
      () => env.items(childId).filter((i) => i.kind === 'cost-cap').length === 2,
      'message tapé retenu'
    )
    const typed = env.items(childId).findLast((i) => i.kind === 'cost-cap')
    expect(typed?.kind === 'cost-cap' && typed.held).toBe('Ma propre question')
    rmSync(lock)
  })
})
