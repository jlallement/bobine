/**
 * Tour de table de bout en bout côté main (fiche 285, ADR-0072), sur l'agent factice : lancement,
 * indépendance des participants, synthèse anonymisée envoyée au repos, cloisonnement, réplique
 * unique, décision. Aucun vrai agent.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { APP_CONTEXT_OPENINGS } from '@shared/app-context'
import { PARTICIPANT_BRIEF } from '@shared/roundtable-prompts'
import { FAST, PRECISE, motherWithExchange, roundtableEnv, type RoundtableEnv } from './test-env'

const envs: RoundtableEnv[] = []
afterEach(() => {
  for (const env of envs.splice(0)) env.stop()
})

async function setup(options: Parameters<typeof roundtableEnv>[0] = {}) {
  const env = await roundtableEnv(options)
  envs.push(env)
  const mother = await motherWithExchange(env)
  return { env, mother }
}

const QUESTION = 'Quelle piste pour la moyenne de calc.js ?'
/** Image d'un pixel (PNG), jointe à la question. */
const PIXEL =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

/** Verrou de fin de tour de l'agent factice : tant qu'il existe, aucun tour ne finit. */
function lockFile(): string {
  const file = join(mkdtempSync(join(tmpdir(), 'tour-verrou-')), 'verrou')
  writeFileSync(file, '')
  return file
}

describe('tour de table : lancer et recueillir (fiche 285, lot 1)', () => {
  it('chaque participant est une fille en lecture seule, sans worktree, qui reçoit question, consigne et dernier échange, jamais un autre avis', async () => {
    const { env, mother } = await setup({ lead: 'echo' })
    const result = await env.roundtables.start(mother, {
      question: QUESTION,
      participants: [FAST, PRECISE],
      attachments: [{ kind: 'image', name: 'schema.png', mimeType: 'image/png', data: PIXEL }]
    })
    expect(result).toEqual({ ok: true, roundtableId: expect.any(String) })
    const rt = env.rt(mother)
    expect(rt).toMatchObject({
      question: QUESTION,
      withLastExchange: true,
      attachments: ['schema.png'],
      phase: 'collecting'
    })
    expect(rt.synthesizer).toMatchObject({ profileId: 'lead', label: 'Factice lead' })
    expect(rt.seats.map((s) => [s.label, s.agentLabel, s.readOnly])).toEqual([
      // Modèles jamais vus chez cet agent : leur identifiant, pas le nom envoyé par le renderer.
      ['factice-rapide', 'Factice panel', 'enforced'],
      ['factice-precis', 'Factice panel', 'enforced']
    ])
    await env.waitFor(() => env.rt(mother).phase === 'synthesized', 'synthèse rendue')
    // La bulle de la question vient de l'élément du tour : aucun message de plus dans le fil.
    expect(
      env
        .users(mother)
        .filter((u) => !u.from)
        .map((u) => u.text)
    ).toEqual(['Quelle moyenne pour calc.js ?'])

    for (const seat of env.rt(mother).seats) {
      const childId = seat.childId ?? ''
      const child = env.manager.state().conversations.find((c) => c.id === childId)
      // Une fille ordinaire de la mère, rôle « Participant » figé, dans son dossier.
      expect(child).toMatchObject({
        startedFrom: { id: mother },
        workspace: env.repo,
        role: { name: 'participant', readOnly: true, mcp: [] }
      })
      expect(child?.branch).toBeUndefined()
      const first = env.users(childId)[0]?.text ?? ''
      expect(first.startsWith(QUESTION)).toBe(true)
      expect(first).toContain('<bobine_role name="participant">')
      expect(first).toContain(PARTICIPANT_BRIEF.split('\n')[0])
      expect(first).toMatch(/<bobine_roundtable_context_[0-9a-f]{8}>/)
      expect(first).toContain('Quelle moyenne pour calc.js ?')
      const reply = env.replies(childId).join('\n')
      expect(reply).toContain('autres avis : aucun')
      expect(reply).toContain('lecture seule : oui')
      expect(reply).toContain('pièces jointes : 1')
      expect(seat.state).toBe('answered')
    }
    // Chaque modèle a bien répondu avec le sien (modèle strict).
    const answers = env.rt(mother).seats.map((s) => env.replies(s.childId ?? '').join('\n'))
    expect(answers[0]).toContain('la piste A')
    expect(answers[1]).toContain('la piste B')
    // Le lancement de chaque participant porte la clé du tour (carte du renderer).
    const starts = env.items(mother).filter((i) => i.kind === 'child-started')
    expect(starts.map((i) => i.kind === 'child-started' && i.card)).toEqual([
      rt.roundtableId,
      rt.roundtableId
    ])
  })

  it('nom du modèle : celui que l’agent annonce (modèles vus), jamais celui du renderer ; question trop longue refusée', async () => {
    const { env, mother } = await setup()
    await env.roundtables.start(mother, { question: QUESTION, participants: [FAST, PRECISE] })
    await env.waitFor(() => env.rt(mother).phase === 'synthesized', 'premier tour fini')
    await env.roundtables.start(mother, { question: 'Encore ?', participants: [FAST, PRECISE] })
    expect(env.rt(mother).seats.map((s) => [s.label, s.model?.name])).toEqual([
      ['Factice rapide', 'Factice rapide'],
      ['Factice précis', 'Factice précis']
    ])
    await env.waitFor(() => env.rt(mother).phase === 'synthesized', 'second tour fini')
    expect(
      await env.roundtables.start(mother, {
        question: 'x'.repeat(8_001),
        participants: [FAST, PRECISE]
      })
    ).toEqual({ ok: false, error: 'question' })
  })

  it('la synthèse part seule au repos, avis anonymisés par lettres, sans nom de modèle ni d’agent', async () => {
    const { env, mother } = await setup({ lead: 'echo' })
    await env.roundtables.start(mother, { question: QUESTION, participants: [FAST, PRECISE] })
    await env.waitFor(() => env.rt(mother).phase === 'synthesized', 'synthèse rendue')
    const asked = env.users(mother).find((u) => u.from?.kind === 'roundtable')
    expect(asked?.from).toMatchObject({
      kind: 'roundtable',
      id: env.rt(mother).roundtableId,
      step: 'synthesis'
    })
    // Ce que l'agent a reçu (l'agent factice `echo` le répète) : contexte caché compris.
    const received = env.replies(mother).at(-1) ?? ''
    expect(received).toMatch(
      /<bobine_roundtable_[0-9a-f]{8} step="synthesis" answered="2" absent="0">/
    )
    expect(received).toContain('participant="A" outcome="answered"')
    expect(received).toContain('participant="B" outcome="answered"')
    expect(received).toContain('la piste A')
    expect(received).toContain('la piste B')
    // Après l'en-tête de `echo` (réglages de sa propre session) : tout ce que l'agent a reçu.
    const sent = received.slice(received.indexOf("J'ai reçu"))
    for (const name of ['factice-rapide', 'factice-precis', 'Factice rapide', 'Factice panel']) {
      expect(sent).not.toContain(name)
    }
    const synthesis = env.rt(mother).synthesis
    expect(synthesis).toMatchObject({ state: 'answered', count: 2 })
    // Ce que l'agent a communiqué du tour (jetons de l'agent factice), rien d'estimé.
    expect(synthesis?.usage?.total).toBeGreaterThan(0)
  })

  it('cloisonnement : les participants ne partent ni avec le message suivant, ni dans les outils de la mère', async () => {
    const { env, mother } = await setup({ lead: 'echo' })
    await env.roundtables.start(mother, { question: QUESTION, participants: [FAST, PRECISE] })
    await env.waitFor(() => env.rt(mother).phase === 'synthesized', 'synthèse rendue')
    // `child_status`, `message_child`, `recommend_merge` : aucun participant.
    expect(env.children.children(mother)).toEqual([])
    expect(env.children.status(mother)).toEqual([])
    await env.manager.prompt(mother, 'Et maintenant ?')
    const received = env.replies(mother).at(-1) ?? ''
    expect(received).not.toContain(APP_CONTEXT_OPENINGS.childNews)
    expect(received).not.toContain('la piste A')
  })

  it('un second tour est refusé tant que le premier n’a pas rendu sa synthèse ; pas de tour depuis un participant', async () => {
    const { env, mother } = await setup({ panel: ['--verrou-fin-de-tour', lockFile()] })
    await env.roundtables.start(mother, { question: QUESTION, participants: [FAST, PRECISE] })
    expect(
      await env.roundtables.start(mother, { question: 'Encore', participants: [FAST, PRECISE] })
    ).toEqual({ ok: false, error: 'running' })
    expect(env.roundtables.options(mother).refused).toBe('running')
    const child = env.seatChild(mother, 'A')
    expect(
      await env.roundtables.start(child, {
        question: 'Depuis un travail',
        participants: [FAST, PRECISE]
      })
    ).toEqual({ ok: false, error: 'task' })
  })
})

describe('tour de table : la synthèse attend le repos (fiche 285, lot 2)', () => {
  it('un message de l’utilisateur pendant le recueil part sans les avis ; la synthèse attend la fin de sa réponse', async () => {
    const lock = lockFile()
    rmSync(lock)
    const { env, mother } = await setup({ lead: 'echo', leadArgs: ['--verrou-fin-de-tour', lock] })
    // Le premier échange est fait ; la réponse suivante de la mère est tenue par le verrou.
    writeFileSync(lock, '')
    await env.roundtables.start(mother, { question: QUESTION, participants: [FAST, PRECISE] })
    const answer = env.manager.prompt(mother, 'Pendant ce temps')
    await env.waitFor(
      () => env.rt(mother).phase === 'synthesizing',
      'tous ont répondu, synthèse attendue'
    )
    expect(env.rt(mother).synthesis?.state).toBe('waiting')
    expect(env.users(mother).some((u) => u.from?.kind === 'roundtable')).toBe(false)
    rmSync(lock)
    await answer
    await env.waitFor(() => env.rt(mother).phase === 'synthesized', 'synthèse rendue')
    // La réponse au message de l'utilisateur n'a reçu aucun avis.
    const replies = env.replies(mother)
    expect(replies.at(-2)).toContain('Pendant ce temps')
    expect(replies.at(-2)).not.toContain('la piste')
  })
})

describe('tour de table : réplique et décision (fiche 285, lot 3)', () => {
  it('la synthèse et sa lettre vont à chaque participant, puis la décision part seule ; une seule réplique', async () => {
    const { env, mother } = await setup()
    await env.roundtables.start(mother, { question: QUESTION, participants: [FAST, PRECISE] })
    await env.waitFor(() => env.rt(mother).phase === 'synthesized', 'synthèse rendue')
    expect(env.replies(mother).at(-1)).toContain('Avis reçus : A, B')
    const id = env.rt(mother).roundtableId
    env.roundtables.rebuttal(mother, id)
    await env.waitFor(() => env.rt(mother).phase === 'decided', 'décision rendue', 20_000)
    for (const seat of env.rt(mother).seats) {
      const childId = seat.childId ?? ''
      const sent = env.users(childId).at(-1)?.text ?? ''
      expect(sent).toContain(`You are participant ${seat.letter}`)
      expect(sent).toMatch(/<bobine_roundtable_synthesis_[0-9a-f]{8}>/)
      // La synthèse seule : jamais les avis des autres.
      expect(sent).not.toContain('<bobine_opinion')
      expect(seat.rebuttal).toMatchObject({ state: 'answered', stance: 'maintains' })
      // Avis et réplique désignés sans ambiguïté : le compte rendu dont `askedAt` est le leur.
      const reports = env
        .items(mother)
        .flatMap((i) => (i.kind === 'child-report' && i.childId === childId ? [i] : []))
      expect(reports.find((r) => r.askedAt === seat.askedAt)?.reply).toContain('la piste')
      expect(reports.find((r) => r.askedAt === seat.rebuttal?.askedAt)?.reply).toContain(
        'Position : maintenue'
      )
      expect(seat.askedAt).not.toBe(seat.rebuttal?.askedAt)
      expect(env.replies(childId).at(-1)).toContain('autres avis : aucun')
    }
    const verdict = env.users(mother).at(-1)
    expect(verdict?.from).toMatchObject({ kind: 'roundtable', id, step: 'verdict' })
    expect(env.replies(mother).at(-1)).toContain('Ce qui a changé après la réplique')
    expect(env.replies(mother).at(-1)).toContain('Répliques reçus : A, B')
    expect(env.rt(mother).verdict).toMatchObject({ state: 'answered', count: 2 })
    expect(() => env.roundtables.rebuttal(mother, id)).toThrow(/Une seule réplique/)
    // Tour fini : plus rien en mémoire.
    expect(env.roundtables.tracked()).toEqual({ tours: 0, seats: 0 })
  })

  it('réplique en file derrière des messages de l’utilisateur : jamais fusionnée, reconnue par sa provenance', async () => {
    const lock = lockFile()
    rmSync(lock)
    const { env, mother } = await setup({ panel: ['--verrou-fin-de-tour', lock] })
    await env.roundtables.start(mother, { question: QUESTION, participants: [FAST, PRECISE] })
    await env.waitFor(() => env.rt(mother).phase === 'synthesized', 'synthèse rendue')
    const id = env.rt(mother).roundtableId
    const [a, b] = env.rt(mother).seats.map((s) => s.childId ?? '')
    // L'utilisateur écrit dans la conversation de A : un tour tenu, puis un message en file.
    writeFileSync(lock, '')
    void env.manager.prompt(a ?? '', 'Une question à part')
    await env.waitFor(
      () => env.manager.view(a ?? '').snapshot?.status === 'busy',
      'participant A occupé'
    )
    void env.manager.prompt(a ?? '', 'Et une autre')
    env.roundtables.rebuttal(mother, id)
    await env.waitFor(
      () => (env.manager.view(a ?? '').snapshot?.queued.length ?? 0) === 2,
      'réplique en file, à part'
    )
    const queued = env.manager.view(a ?? '').snapshot?.queued ?? []
    expect(queued.map((q) => q.from?.kind ?? 'user')).toEqual(['user', 'roundtable'])
    rmSync(lock)
    await env.waitFor(() => env.rt(mother).phase === 'decided', 'décision rendue', 20_000)
    const sent = env
      .users(a ?? '')
      .find((u) => u.from?.kind === 'roundtable' && u.from.step === 'rebuttal')
    expect(sent?.from).toMatchObject({ kind: 'roundtable', id, step: 'rebuttal' })
    expect(sent?.text).toContain('You are participant')
    expect(env.users(b ?? '').at(-1)?.from).toMatchObject({ step: 'rebuttal' })
  })

  it('tour arrêté pendant que la réplique attend en file : elle est retirée, elle ne part pas', async () => {
    const lock = lockFile()
    rmSync(lock)
    const { env, mother } = await setup({ panel: ['--verrou-fin-de-tour', lock] })
    await env.roundtables.start(mother, { question: QUESTION, participants: [FAST, PRECISE] })
    await env.waitFor(() => env.rt(mother).phase === 'synthesized', 'synthèse rendue')
    const id = env.rt(mother).roundtableId
    const a = env.rt(mother).seats[0]?.childId ?? ''
    writeFileSync(lock, '')
    void env.manager.prompt(a, 'Une question à part')
    await env.waitFor(() => env.manager.view(a).snapshot?.status === 'busy', 'participant A occupé')
    env.roundtables.rebuttal(mother, id)
    await env.waitFor(
      () => (env.manager.view(a).snapshot?.queued.length ?? 0) === 1,
      'réplique en file'
    )
    await env.roundtables.stop(mother, id)
    expect(env.manager.view(a).snapshot?.queued ?? []).toEqual([])
    // Le tour de l'utilisateur dans cette conversation n'est pas arrêté par le tour de table.
    expect(env.manager.view(a).snapshot?.status).toBe('busy')
    rmSync(lock)
    await env.waitFor(
      () => env.manager.view(a).snapshot?.status === 'ready',
      'participant A au repos'
    )
    expect(
      env.users(a).some((u) => u.from?.kind === 'roundtable' && u.from.step === 'rebuttal')
    ).toBe(false)
  })

  it('un tour d’une autre conversation, ou une place inexistante, ne se pilote pas', async () => {
    const { env, mother } = await setup()
    await env.roundtables.start(mother, { question: QUESTION, participants: [FAST, PRECISE] })
    const id = env.rt(mother).roundtableId
    const other = (await env.manager.create({ profileId: 'lead' })).summary.id
    expect(() => env.roundtables.synthesize(other, id)).toThrow(/n’existe pas/)
    await expect(env.roundtables.stop(mother, 'inconnu')).rejects.toThrow(/n’existe pas/)
    await env.waitFor(() => env.rt(mother).phase === 'synthesized', 'synthèse rendue')
    await expect(env.roundtables.stop(mother, id, 'E')).rejects.toThrow(/n’existe pas/)
  })
})
