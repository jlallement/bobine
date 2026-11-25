/**
 * Tour de table, corrections de la recette fonctionnelle et de la revue UX (fiche 285), sur
 * l'agent factice : arrêt cohérent, fiches des participants, corbeille, étiquette de la synthèse,
 * erreurs typées, durée après « Relancer », titres lisibles.
 */
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { t } from 'i18next'
import { afterEach, describe, expect, it } from 'vitest'
import { bobDbCosts } from '../agent/bob-costs'
import { deleteConversation } from '../conversations/family-delete'
import { opinionDigest } from '@shared/roundtable-prompts'
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
  // Arbitre au coût lu après coup (comme Bob) : le coût du premier échange est relu avant le tour.
  // Sans quoi une étape qui part avant cette relecture compte aussi l'échange d'avant : une course
  // du produit (fiche 285), que ces essais ne visent pas ; le délai d'un dépôt git la masquait.
  if (options.leadArgs?.includes('--cout-bob')) {
    await env.waitFor(
      () =>
        (env.manager.state().conversations.find((c) => c.id === mother)?.usage?.cost?.amount ?? 0) >
        0,
      'coût du premier échange relu',
      15_000
    )
  }
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
    // Le tour reste ouvert tant que le participant lent est tenu (verrou) : « en cours » est
    // garanti par construction, pas par la vitesse des autres.
    const lock = lockFile()
    const { env, mother } = await setup({
      panel: ['--refuser-modele', 'factice-precis'],
      profiles: (mock) => [mock('lent', 'avis-participant', ['--verrou-fin-de-tour', lock])]
    })
    await env.roundtables.start(mother, {
      question: QUESTION,
      participants: [choice('lent', 'factice-rapide'), PRECISE, choice('panel', 'autre-absent')]
    })
    const id = env.rt(mother).roundtableId
    const refused = () => env.rt(mother).seats.find((s) => s.model?.value === 'factice-precis')
    await env.waitFor(() => refused()?.state === 'error', 'modèle refusé')
    await env.waitFor(
      () => summaryOf(env, refused()?.childId)?.roundtable?.state === 'error',
      'fiche de la place en erreur'
    )
    expect(env.rt(mother).phase).toBe('collecting')
    expect(summaryOf(env, refused()?.childId)?.roundtable).toEqual({
      since: expect.any(Number),
      id,
      active: true,
      state: 'error'
    })
    rmSync(lock)
    await env.waitFor(() => env.rt(mother).phase === 'insufficient', 'un seul avis')
    // Recueil fini : la barre latérale peut le ranger ; l'état d'erreur reste.
    expect(summaryOf(env, refused()?.childId)?.roundtable).toEqual({
      since: expect.any(Number),
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
    // Recueil tenu par le verrou : le modèle change avant le départ de la synthèse, à coup sûr.
    const lock = lockFile()
    const { env, mother } = await setup({ panel: ['--verrou-fin-de-tour', lock] })
    await env.roundtables.start(mother, { question: QUESTION, participants: [FAST, PRECISE] })
    // Modèle de la conversation changé pendant le recueil.
    await env.manager.setControl(mother, 'model', 'factice-precis')
    rmSync(lock)
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
    const startLock = lockFile()
    const { env, mother } = await setup({
      profiles: (mock) => [
        mock('lent', 'avis-participant', ['--verrou-fin-de-tour', lock]),
        // « Démarre » tant que ce verrou existe : arrêtée pendant son lancement par construction.
        mock('demarre', 'avis-participant', ['--verrou-demarrage', startLock])
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
    // « Relancer » attend la fin du premier lancement, tenu par le verrou.
    const relaunched = env.roundtables.relaunch(mother, id, seat()?.letter ?? 'A')
    rmSync(startLock)
    await relaunched
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
    const startLock = lockFile()
    const { env, mother } = await setup({
      profiles: (mock) => [
        mock('lent', 'avis-participant', ['--verrou-fin-de-tour', lock]),
        // « Démarre » tant que ce verrou existe : arrêtée pendant son lancement par construction.
        mock('demarre', 'avis-participant', ['--verrou-demarrage', startLock])
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
    // « Relancer » attend la fin du premier lancement, tenu par le verrou.
    const relaunched = env.roundtables.relaunch(mother, id, seat()?.letter ?? 'A')
    rmSync(startLock)
    await relaunched
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

describe('contre-revue : tests qui prouvent', () => {
  it('jeton : un ancien lancement qui échoue après son départ ne met pas en erreur la relance', async () => {
    const lock = lockFile()
    const { env, mother } = await setup({
      profiles: (mock) => [mock('lent', 'avis-participant', ['--verrou-fin-de-tour', lock])]
    })
    const failures: ((error: unknown) => void)[] = []
    const start = env.children.start.bind(env.children)
    env.children.start = async (motherId, request, by) => {
      if (request.launchFailed) failures.push(request.launchFailed)
      return start(motherId, request, by)
    }
    await env.roundtables.start(mother, {
      question: QUESTION,
      participants: [choice('lent', 'factice-rapide'), choice('lent', 'factice-precis')]
    })
    const id = env.rt(mother).roundtableId
    const first = env.rt(mother).seats[0]
    await env.waitFor(() => env.rt(mother).seats[0]?.state === 'working', 'question partie')
    await env.roundtables.stop(mother, id, first?.letter)
    await env.roundtables.relaunch(mother, id, first?.letter ?? 'A')
    // Relancée : en attente ou déjà au travail selon la vitesse de l'agent, jamais en erreur.
    expect(['waiting', 'working']).toContain(env.rt(mother).seats[0]?.state)
    // L'ancien lancement (le premier) échoue maintenant, pendant la relance.
    failures[0]?.(new Error('ancien tour en échec'))
    expect(env.rt(mother).seats[0]?.state).not.toBe('error')
    rmSync(lock)
  })

  it('modèle relu au départ de la question : un écart met la place en erreur, sa question n’est pas suivie', async () => {
    const startLock = lockFile()
    const { env, mother } = await setup({
      profiles: (mock) => [mock('demarre', 'avis-participant', ['--verrou-demarrage', startLock])]
    })
    await env.roundtables.start(mother, {
      question: QUESTION,
      participants: [FAST, choice('demarre', 'factice-rapide')]
    })
    const seat = () => env.rt(mother).seats.find((s) => s.profileId === 'demarre')
    expect(seat()?.state).toBe('waiting')
    // Ce que pose l'hôte si la question part avec un autre modèle que celui vérifié.
    env.manager.post(seat()?.childId ?? '', {
      type: 'user-message',
      text: QUESTION,
      model: { id: 'factice-precis', name: 'Factice précis' }
    })
    expect(seat()).toMatchObject({ state: 'error', error: 'model-not-applied' })
    rmSync(startLock)
  })

  it('participant mis à la corbeille pendant le recueil puis restauré : la synthèse ne le dit pas supprimé', async () => {
    const lock = lockFile()
    const { env, mother } = await setup({
      lead: 'echo',
      profiles: (mock) => [mock('lent', 'avis-participant', ['--verrou-fin-de-tour', lock])]
    })
    await env.roundtables.start(mother, {
      question: QUESTION,
      participants: [FAST, PRECISE, choice('lent', 'factice-rapide')]
    })
    const slow = () => env.rt(mother).seats.find((s) => s.profileId === 'lent')
    await env.waitFor(() => slow()?.state === 'working', 'participant lent au travail')
    const childId = slow()?.childId ?? ''
    await env.manager.delete(childId, { fromAgent: false })
    env.manager.restoreFromTrash(childId)
    await env.waitFor(() => env.rt(mother).phase === 'synthesized', 'synthèse rendue')
    const received = env.replies(mother).at(-1) ?? ''
    expect(received).not.toContain('its conversation was deleted')
    expect(received).toContain('stopped by the user')
    rmSync(lock)
  })
})

describe('recette réelle : arbitre en lecture seule pendant l’étape (S1)', () => {
  it('demande d’écriture pendant la synthèse : refusée d’office ; après, une carte ordinaire', async () => {
    const { env, mother } = await setup({ lead: 'arbitre-demande-ecrire' })
    await env.roundtables.start(mother, { question: QUESTION, participants: [FAST, PRECISE] })
    await env.waitFor(() => env.rt(mother).phase === 'synthesized', 'synthèse rendue')
    expect(env.replies(mother).at(-1)).toContain('Écriture refusée.')
    expect(existsSync(join(env.repo, 'notes-arbitre.md'))).toBe(false)
    expect(env.roundtables.stepActive(mother)).toBe(false)
    // Hors de l'étape, la conversation redevient normale : la demande attend l'utilisateur.
    void env.manager.prompt(mother, 'Prends des notes')
    await env.waitFor(
      () =>
        env.events.some(
          (e) => e.conversationId === mother && e.event.type === 'permission-request'
        ),
      'carte d’autorisation ordinaire'
    )
    const request = env.events.findLast(
      (e) => e.conversationId === mother && e.event.type === 'permission-request'
    )?.event
    if (request?.type !== 'permission-request') throw new Error('pas de demande')
    env.manager.respondPermission(mother, request.requestId, 'allow')
    await env.waitFor(
      () => env.replies(mother).at(-1)?.includes('Écriture acceptée.') ?? false,
      'écriture acceptée hors étape'
    )
  })

  it('écriture sans demander pendant la synthèse : l’étape dit le dossier changé et le fichier', async () => {
    const { env, mother } = await setup({
      git: true,
      lead: 'arbitre-ecrit'
    })
    await env.roundtables.start(mother, { question: QUESTION, participants: [FAST, PRECISE] })
    await env.waitFor(() => env.rt(mother).phase === 'synthesized', 'synthèse rendue')
    await env.roundtables.stepFolderChecked(mother)
    await env.waitFor(() => !!env.rt(mother).synthesis?.changedFolder, 'dossier changé dit')
    expect(env.rt(mother).synthesis).toMatchObject({
      state: 'answered',
      changedFolder: true,
      changedFiles: ['notes-arbitre.md']
    })
  })

  it('synthèse sans écriture : rien n’est signalé', async () => {
    const { env, mother } = await setup({ git: true })
    await env.roundtables.start(mother, { question: QUESTION, participants: [FAST, PRECISE] })
    await env.waitFor(() => env.rt(mother).phase === 'synthesized', 'synthèse rendue')
    await env.roundtables.stepFolderChecked(mother)
    expect(env.rt(mother).synthesis?.changedFolder).toBeUndefined()
  })
})

describe('recette réelle : l’arbitre n’est jamais participant', () => {
  it('lancement refusé, options qui le disent, et contrôle au départ de la synthèse', async () => {
    // Recueil tenu par le verrou : le changement de modèle précède le départ de la synthèse.
    const lock = lockFile()
    const { env, mother } = await setup({ panel: ['--verrou-fin-de-tour', lock] })
    const handlers = roundtableHandlers(env.roundtables)
    const options = await handlers['roundtable:options'](mother)
    expect(options.arbiter).toEqual({ profileId: 'lead', model: 'factice-rapide' })
    expect(
      await env.roundtables.start(mother, {
        question: QUESTION,
        participants: [FAST, choice('lead', 'factice-rapide')]
      })
    ).toEqual({ ok: false, error: 'selection', problem: 'arbiter' })
    // Un autre modèle du même agent participe ; puis la conversation passe à ce modèle.
    await env.roundtables.start(mother, {
      question: QUESTION,
      participants: [FAST, choice('lead', 'factice-precis')]
    })
    await env.manager.setControl(mother, 'model', 'factice-precis')
    rmSync(lock)
    await env.waitFor(() => env.rt(mother).phase === 'interrupted', 'synthèse refusée')
    expect(env.rt(mother).synthesis).toMatchObject({
      state: 'failed',
      detail: t('roundtable.error.arbiter')
    })
    expect(env.users(mother).some((u) => u.from?.kind === 'roundtable')).toBe(false)
  })
})

describe('recette réelle : arbitre sans choix de modèle', () => {
  it('l’agent est indisponible dans le menu, avec sa raison, et refusé au lancement', async () => {
    const { env, mother } = await setup({ leadProfile: { childModelChoice: undefined } })
    const options = await roundtableHandlers(env.roundtables)['roundtable:options'](mother)
    expect(options.agents.find((a) => a.profileId === 'lead')).toMatchObject({
      available: false,
      reason: t('roundtable.error.selection.arbiter')
    })
    expect(options.agents.find((a) => a.profileId === 'panel')?.available).toBe(true)
    expect(
      await env.roundtables.start(mother, {
        question: QUESTION,
        participants: [FAST, choice('lead')]
      })
    ).toEqual({ ok: false, error: 'selection', problem: 'arbiter' })
  })
})

describe('recette réelle : agents des participants libérés (G1)', () => {
  it('arrêtés à la synthèse, rouverts pour la réplique avec leur modèle, arrêtés à la décision', async () => {
    const { env, mother } = await setup()
    await env.roundtables.start(mother, { question: QUESTION, participants: [FAST, PRECISE] })
    await env.waitFor(() => env.rt(mother).phase === 'synthesized', 'synthèse rendue')
    const children = env.rt(mother).seats.map((s) => s.childId ?? '')
    const released = () => children.every((id) => env.manager.view(id).snapshot === null)
    await env.waitFor(released, 'agents libérés après la synthèse')
    env.roundtables.rebuttal(mother, env.rt(mother).roundtableId)
    await env.waitFor(() => env.rt(mother).phase === 'decided', 'décision rendue', 20_000)
    // Réplique rendue par la session reprise, avec le modèle affiché (relu à son départ).
    for (const seat of env.rt(mother).seats)
      expect(seat.rebuttal).toMatchObject({ state: 'answered', stance: 'maintains' })
    await env.waitFor(released, 'agents libérés après la décision')
  })

  it('tour arrêté : les agents des participants sont libérés aussi', async () => {
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
    await env.roundtables.stop(mother, env.rt(mother).roundtableId)
    const children = env.rt(mother).seats.map((s) => s.childId ?? '')
    await env.waitFor(
      () => children.every((id) => env.manager.view(id).snapshot === null),
      'agents libérés après l’arrêt'
    )
  })
})

describe('recette réelle : étiquettes lisibles (C1)', () => {
  it('nom de modèle court sur l’arbitre et l’étiquette de la synthèse, sans préfixe de fournisseur', async () => {
    const { env, mother } = await setup({ leadProfile: { env: { MOCK_MODELS: 'long' } } })
    await env.roundtables.start(mother, { question: QUESTION, participants: [FAST, PRECISE] })
    await env.waitFor(() => env.rt(mother).phase === 'synthesized', 'synthèse rendue')
    expect(env.rt(mother).synthesizer.model).toBe('Factice rapide')
    expect(env.rt(mother).synthesis?.by).toEqual({
      profileId: 'lead',
      label: 'Factice lead',
      model: 'Factice rapide'
    })
  })
})

describe('recette réelle : chronomètre de la réplique (G3)', () => {
  it('la fiche du participant dit le début de la réplique, pas celui de son avis', async () => {
    const lock = join(mkdtempSync(join(tmpdir(), 'tour-verrou-')), 'verrou')
    const { env, mother } = await setup({
      profiles: (mock) => [mock('lent', 'avis-participant', ['--verrou-fin-de-tour', lock])]
    })
    await env.roundtables.start(mother, {
      question: QUESTION,
      participants: [choice('lent', 'factice-rapide'), choice('lent', 'factice-precis')]
    })
    await env.waitFor(() => env.rt(mother).phase === 'synthesized', 'synthèse rendue')
    const childId = env.seatChild(mother, 'A')
    const opinionStart = env.rt(mother).seats.find((s) => s.letter === 'A')?.startedAt
    expect(summaryOf(env, childId)?.roundtable?.since).toBe(opinionStart)
    writeFileSync(lock, '')
    env.roundtables.rebuttal(mother, env.rt(mother).roundtableId)
    await env.waitFor(
      () => env.rt(mother).seats.every((s) => s.rebuttal?.state === 'working'),
      'répliques au travail'
    )
    const askedAt = env.rt(mother).seats.find((s) => s.letter === 'A')?.rebuttal?.askedAt
    expect(askedAt).toBeGreaterThan(opinionStart ?? Infinity)
    expect(summaryOf(env, childId)?.roundtable?.since).toBe(askedAt)
    rmSync(lock)
    await env.waitFor(() => env.rt(mother).phase === 'decided', 'décision rendue', 20_000)
  })
})

describe('contre-revue : réplique envoyée au repos (N7)', () => {
  it('participant occupé à la demande de réplique : empreinte avant l’envoi, l’écriture est vue', async () => {
    const lock = join(mkdtempSync(join(tmpdir(), 'tour-verrou-')), 'verrou')
    const { env, mother } = await setup({
      git: true,
      profiles: (mock) => [
        mock('ecrit', 'participant-ecrit-replique', ['--verrou-fin-de-tour', lock], {
          writesWithoutAsking: true
        })
      ]
    })
    await env.roundtables.start(mother, {
      question: QUESTION,
      participants: [choice('ecrit', 'factice-rapide'), FAST]
    })
    await env.waitFor(() => env.rt(mother).phase === 'synthesized', 'synthèse rendue')
    const letter = env.rt(mother).seats.find((s) => s.profileId === 'ecrit')?.letter ?? 'A'
    const childId = env.seatChild(mother, letter)
    // Le participant qui écrit travaille (message tapé par l'utilisateur) quand la réplique est demandée.
    writeFileSync(lock, '')
    void env.manager.prompt(childId, 'Et une autre piste ?')
    await env.waitFor(() => summaryOf(env, childId)?.status === 'busy', 'participant occupé')
    env.roundtables.rebuttal(mother, env.rt(mother).roundtableId)
    // Pas en file d'attente : la réplique attend son repos (l'empreinte se prendra avant l'envoi).
    // Absence d'une file : aucun évènement à attendre, une courte pause laisse partir un envoi.
    // eslint-disable-next-line no-restricted-syntax -- vérifier qu'aucun message n'est mis en file
    await new Promise((resolve) => setTimeout(resolve, 300))
    expect(env.manager.view(childId).snapshot?.queued ?? []).toHaveLength(0)
    expect(env.rt(mother).seats.find((s) => s.letter === letter)?.rebuttal?.state).toBe('waiting')
    rmSync(lock)
    await env.waitFor(() => env.rt(mother).phase === 'decided', 'décision rendue', 20_000)
    await env.children.watchSettled(childId)
    const seat = env.rt(mother).seats.find((s) => s.letter === letter)
    expect(seat?.rebuttal).toMatchObject({ state: 'answered', changedFolder: true })
  })
})

describe('contre-recette : participant au coût lu après coup libéré (N1)', () => {
  it('agent arrêté dès son coût lu, sans attendre l’échéance', async () => {
    const bobDb = join(mkdtempSync(join(tmpdir(), 'tour-bob-')), 'bob.db')
    const { env, mother } = await setup({
      // Échéance hors de portée de l'essai : seule la lecture du coût peut libérer l'agent.
      lateCostMs: 120_000,
      profiles: (mock) => [
        {
          ...mock('bob', 'avis-participant', ['--bob-db', bobDb, '--cout-bob'], {
            childModelChoice: undefined
          }),
          costSource: bobDbCosts(bobDb)
        }
      ]
    })
    await env.roundtables.start(mother, { question: QUESTION, participants: [FAST, choice('bob')] })
    await env.waitFor(() => env.rt(mother).phase === 'synthesized', 'synthèse rendue')
    const bob = env.rt(mother).seats.find((s) => s.profileId === 'bob')?.childId ?? ''
    await env.waitFor(
      () => (summaryOf(env, bob)?.usage?.cost?.amount ?? 0) > 0,
      'coût de Bob relu',
      15_000
    )
    await env.waitFor(() => env.manager.view(bob).snapshot === null, 'agent de Bob libéré', 8_000)
  }, 30_000)
})

describe('contre-recette : coût d’une synthèse en échec (N3)', () => {
  it('le total de l’étape compte la tentative en erreur, coût lu après coup compris', async () => {
    const bobDb = join(mkdtempSync(join(tmpdir(), 'tour-bob-')), 'bob.db')
    const { env, mother } = await setup({
      lead: 'synthese-erreur-serveur',
      leadArgs: ['--bob-db', bobDb, '--cout-bob'],
      leadProfile: { costSource: bobDbCosts(bobDb) }
    })
    await env.roundtables.start(mother, { question: QUESTION, participants: [FAST, PRECISE] })
    await env.waitFor(() => env.rt(mother).synthesis?.state === 'failed', 'synthèse en échec')
    expect(env.rt(mother).synthesis?.detail).toContain('Request Failed')
    // Coût de la tentative en échec, écrit par l'agent après sa réponse.
    await env.waitFor(
      () => env.rt(mother).synthesis?.usage?.cost?.amount === 0.0125,
      'coût de la tentative en échec',
      15_000
    )
    env.roundtables.synthesize(mother, env.rt(mother).roundtableId)
    await env.waitFor(() => env.rt(mother).phase === 'synthesized', 'synthèse relancée rendue')
    await env.waitFor(
      () => env.rt(mother).synthesis?.usage?.cost?.amount === 0.025,
      'coût des deux tentatives',
      15_000
    )
    // Comme la conversation : son premier échange (0,0125) et les deux tentatives.
    expect(summaryOf(env, mother)?.usage?.cost?.amount).toBe(0.0375)
  }, 45_000)
})

describe('coût tardif d’une tentative en échec, relance immédiate', () => {
  async function bobLead(lead: string) {
    const bobDb = join(mkdtempSync(join(tmpdir(), 'tour-bob-')), 'bob.db')
    return setup({
      lead,
      leadArgs: ['--bob-db', bobDb, '--cout-bob'],
      leadProfile: { costSource: bobDbCosts(bobDb) }
    })
  }

  it('synthèse relancée avant la relecture du coût de l’échec : rien n’est perdu ni compté deux fois', async () => {
    const { env, mother } = await bobLead('synthese-erreur-serveur')
    await env.roundtables.start(mother, { question: QUESTION, participants: [FAST, PRECISE] })
    await env.waitFor(() => env.rt(mother).synthesis?.state === 'failed', 'synthèse en échec')
    // Relancée tout de suite, sans attendre la relecture du coût de la tentative en échec.
    env.roundtables.synthesize(mother, env.rt(mother).roundtableId)
    // Le relevé tardif tombe entre le geste et le départ de la nouvelle tentative (la course) ;
    // l'agent le redira ensuite lui-même (relevé en double).
    env.manager.post(mother, {
      type: 'usage-report',
      cost: { amount: 0.025, currency: 'bobcoins' }
    })
    await env.waitFor(() => env.rt(mother).phase === 'synthesized', 'synthèse relancée rendue')
    await env.waitFor(
      () => summaryOf(env, mother)?.usage?.cost?.amount === 0.0375,
      'coût de la conversation',
      15_000
    )
    await env.waitFor(
      () => env.rt(mother).synthesis?.usage?.cost?.amount === 0.025,
      'coût des deux tentatives',
      15_000
    )
  }, 45_000)

  it('décision relancée avant la relecture du coût de l’échec : même chose', async () => {
    const { env, mother } = await bobLead('decision-erreur-serveur')
    await env.roundtables.start(mother, { question: QUESTION, participants: [FAST, PRECISE] })
    await env.waitFor(() => env.rt(mother).phase === 'synthesized', 'synthèse rendue')
    // Le coût de la synthèse relu d'abord : la course étudiée ici est celle de la décision.
    await env.waitFor(
      () => env.rt(mother).synthesis?.usage?.cost?.amount === 0.0125,
      'coût de la synthèse',
      15_000
    )
    env.roundtables.rebuttal(mother, env.rt(mother).roundtableId)
    await env.waitFor(() => env.rt(mother).verdict?.state === 'failed', 'décision en échec', 20_000)
    env.roundtables.decide(mother, env.rt(mother).roundtableId)
    env.manager.post(mother, {
      type: 'usage-report',
      cost: { amount: 0.0375, currency: 'bobcoins' }
    })
    await env.waitFor(() => env.rt(mother).phase === 'decided', 'décision relancée rendue')
    // Échange, synthèse, deux tentatives de décision : 4 × 0,0125.
    await env.waitFor(
      () => summaryOf(env, mother)?.usage?.cost?.amount === 0.05,
      'coût de la conversation',
      15_000
    )
    await env.waitFor(
      () => env.rt(mother).verdict?.usage?.cost?.amount === 0.025,
      'coût des deux tentatives de décision',
      15_000
    )
    expect(env.rt(mother).synthesis?.usage?.cost?.amount).toBe(0.0125)
  }, 60_000)
})

describe('recette de la 1.2.0-beta.1 : le coût d’« Appliquer » reste hors du tour (S-B1)', () => {
  const bobOptions = (bobDb: string): EnvOptions => ({
    lead: 'arbitre-applique-comme-bob',
    leadArgs: ['--bob-db', bobDb, '--cout-bob'],
    leadProfile: { costSource: bobDbCosts(bobDb) }
  })
  const newBobDb = () => join(mkdtempSync(join(tmpdir(), 'tour-bob-')), 'bob.db')
  async function bobArbiter(bobDb = newBobDb()) {
    return { ...(await setup(bobOptions(bobDb))), bobDb }
  }
  const cost = (env: RoundtableEnv, id: string) => summaryOf(env, id)?.usage?.cost?.amount

  it('décision rendue, puis « Appliquer » qui dépense en plein tour : la décision garde son coût', async () => {
    const { env, mother } = await bobArbiter()
    await env.roundtables.start(mother, { question: QUESTION, participants: [FAST, PRECISE] })
    await env.waitFor(() => env.rt(mother).phase === 'synthesized', 'synthèse rendue')
    await env.waitFor(() => cost(env, mother) === 0.025, 'coût de la synthèse relu', 15_000)
    env.roundtables.rebuttal(mother, env.rt(mother).roundtableId)
    await env.waitFor(() => env.rt(mother).phase === 'decided', 'décision rendue', 20_000)
    await env.waitFor(() => cost(env, mother) === 0.0375, 'coût de la décision relu', 15_000)
    expect(env.rt(mother).verdict?.usage?.cost?.amount).toBe(0.0125)
    // « Demander à … de l'appliquer » : un message ordinaire, qui dépense en plein tour.
    await env.manager.prompt(mother, 'Applique ta recommandation du tour de table.')
    await env.waitFor(() => cost(env, mother) === 0.35, 'coût de l’application relu', 15_000)
    expect(env.rt(mother).synthesis?.usage?.cost?.amount).toBe(0.0125)
    expect(env.rt(mother).verdict?.usage?.cost?.amount).toBe(0.0125)
  }, 45_000)

  it('synthèse sans réplique, puis un message ordinaire : la synthèse garde son coût', async () => {
    const { env, mother } = await bobArbiter()
    await env.roundtables.start(mother, { question: QUESTION, participants: [FAST, PRECISE] })
    await env.waitFor(() => env.rt(mother).phase === 'synthesized', 'synthèse rendue')
    await env.waitFor(() => cost(env, mother) === 0.025, 'coût de la synthèse relu', 15_000)
    await env.manager.prompt(mother, 'Applique la recommandation.')
    await env.waitFor(() => cost(env, mother) === 0.3375, 'coût du message relu', 15_000)
    expect(env.rt(mother).synthesis?.usage?.cost?.amount).toBe(0.0125)
  }, 45_000)

  it('après un redémarrage de l’app, « Appliquer » n’ajoute rien au tour', async () => {
    const first = await bobArbiter()
    const { mother, bobDb } = first
    await first.env.roundtables.start(mother, { question: QUESTION, participants: [FAST, PRECISE] })
    await first.env.waitFor(() => first.env.rt(mother).phase === 'synthesized', 'synthèse rendue')
    await first.env.waitFor(() => cost(first.env, mother) === 0.025, 'coût relu', 15_000)
    first.env.stop()
    await first.env.manager.settled()
    const env = await roundtableEnv({
      ...bobOptions(bobDb),
      root: first.env.root,
      repo: first.env.repo
    })
    envs.push(env)
    await env.manager.prompt(mother, 'Applique la recommandation.')
    await env.waitFor(() => cost(env, mother) === 0.3375, 'coût du message relu', 15_000)
    expect(env.rt(mother).synthesis?.usage?.cost?.amount).toBe(0.0125)
  }, 45_000)
})

describe('recette de la 1.2.0-beta.1 : avis long sans réponse courte (G-B4)', () => {
  it('l’avis réel compte et donne le début de son texte à sa ligne', async () => {
    const { env, mother } = await setup({
      panel: ['--scenario-par-modele', 'factice-precis=avis-long-sans-reponse-courte']
    })
    await env.roundtables.start(mother, { question: QUESTION, participants: [FAST, PRECISE] })
    await env.waitFor(() => env.rt(mother).phase === 'synthesized', 'synthèse rendue')
    const seat = env.rt(mother).seats.find((s) => s.model?.value === 'factice-precis')
    const reply = env.replies(seat?.childId ?? '').join('\n')
    expect(reply.length).toBeGreaterThan(3000)
    const digest = opinionDigest(reply)
    expect(digest).toMatchObject({ followed: false })
    expect(digest.excerpt?.startsWith('Let me first explore')).toBe(true)
  })
})

describe('recette de la 1.2.0-beta.1 : commande lancée par l’arbitre pendant la synthèse (G-B2)', () => {
  it('lancée sans demander : l’étape le dit', async () => {
    const { env, mother } = await setup({ lead: 'arbitre-commande' })
    await env.roundtables.start(mother, { question: QUESTION, participants: [FAST, PRECISE] })
    await env.waitFor(() => env.rt(mother).phase === 'synthesized', 'synthèse rendue')
    expect(env.rt(mother).synthesis?.ranCommand).toBe(true)
  })

  it('demandée puis refusée d’office (agent qui demande, comme Bob) : jamais partie, rien n’est dit', async () => {
    const { env, mother } = await setup({ lead: 'arbitre-demande-commande' })
    await env.roundtables.start(mother, { question: QUESTION, participants: [FAST, PRECISE] })
    await env.waitFor(() => env.rt(mother).phase === 'synthesized', 'synthèse rendue')
    expect(env.replies(mother).at(-1)).toContain('Avis reçus')
    const refused = env.items(mother).find((i) => i.kind === 'tool' && i.title === 'npm test')
    expect(refused?.kind === 'tool' && refused.status).toBe('failed')
    expect(env.rt(mother).synthesis?.ranCommand).toBeUndefined()
  })

  it('aucune commande pendant l’étape : rien n’est dit', async () => {
    const { env, mother } = await setup()
    await env.roundtables.start(mother, { question: QUESTION, participants: [FAST, PRECISE] })
    await env.waitFor(() => env.rt(mother).phase === 'synthesized', 'synthèse rendue')
    expect(env.rt(mother).synthesis?.ranCommand).toBeUndefined()
  })
})
