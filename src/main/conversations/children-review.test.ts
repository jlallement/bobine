import { execFileSync } from 'node:child_process'
import { mkdtempSync, realpathSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { t } from 'i18next'
import { afterEach, describe, expect, it } from 'vitest'
import { REVIEW_BRIEF_LEAD, type Review } from '@shared/review'
import { childContext, childNews } from '@shared/children'
import { splitRoleBrief } from '@shared/roles'
import { MOCK_AGENT_ENTRY } from '../../mock-agent/testing.mts'
import { REVIEW_BRIEF_LEAD as MOCK_LEAD } from '../../mock-agent/agent.mts'
import type { AgentProfile } from '../agent/profiles'
import { Worktrees } from '../changes/worktrees'
import { gitCommand, queuedGit } from '../git/git-queue'
import { childrenToolsModule } from '../mcp/children-tools'
import { AppToolServer } from '../mcp/tool-server'
import { ChildConversations } from './children'
import { reviewHandlers } from './children-review'
import { ConversationManager } from './manager'

function waitFor(predicate: () => boolean, timeoutMs = 15_000): Promise<void> {
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

const stops: (() => void)[] = []
afterEach(() => {
  for (const stop of stops.splice(0)) stop()
})

/** Dépôt git jetable, gestionnaire sur l'agent factice, filles et relectures branchées. */
async function environment() {
  const root = mkdtempSync(join(tmpdir(), 'relecture-'))
  const repo = realpathSync(mkdtempSync(join(tmpdir(), 'relecture-depot-')))
  const git = (...args: string[]) =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', ...args], {
      cwd: repo,
      encoding: 'utf8'
    }).trim()
  writeFileSync(join(repo, 'README.md'), '# Carnet\n\nVersion 1\n\n## Utilisation\n')
  git('init', '-q', '-b', 'main')
  git('add', '.')
  git('commit', '-q', '-m', 'init')
  const mock = (id: string, scenario: string): AgentProfile => ({
    id,
    label: `Factice ${id}`,
    command: process.execPath,
    args: [MOCK_AGENT_ENTRY, '--scenario', scenario, '--delay', '0', '--store', join(root, 's')],
    env: {},
    childModelChoice: 'ask'
  })
  const toolServer = new AppToolServer()
  await toolServer.start()
  let children: ChildConversations | undefined = undefined
  const run = queuedGit(gitCommand)
  const manager = new ConversationManager({
    profiles: [
      mock('modifs', 'modifications'),
      mock('echo', 'echo'),
      { ...mock('casse', 'echo'), command: join(root, 'agent-introuvable') }
    ],
    toolServer,
    toolModules: [childrenToolsModule(() => children)],
    keepLive: (id) => children?.keepLive(id) ?? false,
    settingsFile: join(root, 'settings.json'),
    conversationsDir: join(root, 'conversations'),
    defaultWorkspace: repo,
    neutralFolder: repo,
    pathEnv: () => process.env['PATH'],
    worktrees: new Worktrees(run),
    agentHome: mkdtempSync(join(tmpdir(), 'maison-vide-'))
  })
  children = new ChildConversations(manager, { run })
  const module = children
  const reviewModule = module.reviews
  manager.subscribe({
    event: (payload) => module.onEvent(payload),
    deleted: (id) => module.forget(id)
  })
  stops.push(() => {
    manager.stopAll()
    toolServer.stop()
  })
  const items = (id: string) => manager.view(id).transcript.items
  const card = (id: string): Review | undefined => {
    const item = items(id).findLast((i) => i.kind === 'review')
    return item?.kind === 'review' ? item : undefined
  }
  /** Conversation de départ (agent `modifications`) : README.md modifié, src/app.js créé. */
  const author = async () => {
    const id = manager.state().activeId
    await manager.startActive()
    await manager.prompt(id, 'Mets à jour le carnet')
    return id
  }
  const idle = (id: string) => waitFor(() => manager.view(id).summary.status === 'ready')
  return { repo, git, manager, children: module, reviews: reviewModule, items, card, author, idle }
}

describe('relecture avant fusion (fiche 177)', () => {
  it('consigne de l’app reconnue par l’agent factice', () => {
    expect(MOCK_LEAD).toBe(REVIEW_BRIEF_LEAD)
  })

  it('relit le non commité dans le même dossier ; remarques par `report_findings`, code cité', async () => {
    const env = await environment()
    const author = await env.author()
    const reviewer = await env.reviews.start(author)
    // Fille de la conversation relue, dans son dossier, sans worktree ni branche.
    expect(reviewer.startedFrom?.id).toBe(author)
    expect(reviewer.reviewOf?.id).toBe(author)
    expect(reviewer.workspace).toBe(env.repo)
    expect(reviewer.branch).toBeUndefined()
    expect(env.children.role(reviewer.id)).toBe('reviewer')
    expect(env.card(author)).toMatchObject({ status: 'running', scope: 'uncommitted', files: 2 })
    await waitFor(() => env.items(reviewer.id).some((i) => i.kind === 'user'))
    // Fiche 265 : le rôle Code reviewer, en lecture seule ; sa consigne de relecture est dans le
    // bloc du rôle (repliée dans son fil), jamais affichée comme la demande.
    expect(reviewer.role).toMatchObject({ name: 'code-reviewer', readOnly: true })
    const first = env.items(reviewer.id).find((i) => i.kind === 'user')
    const opening = splitRoleBrief(first?.kind === 'user' ? first.text : '')
    expect(opening.request).toBe(t('review.ask.uncommitted', { count: 2 }))
    expect(opening.brief).toContain(REVIEW_BRIEF_LEAD)
    expect(opening.brief).toContain('git diff HEAD')
    expect(opening.request).not.toContain(REVIEW_BRIEF_LEAD)
    // Dans le fil où la relecture est demandée : la bulle « @Code reviewer Relis … » qui nomme
    // la conversation relue, puis le lancement qui la nomme (carte-réponse, fiche 263).
    const bubble = env.items(author).find((i) => i.kind === 'role-request')
    expect(bubble).toMatchObject({
      text: t('review.ask.uncommitted', { count: 2 }),
      works: [{ childId: reviewer.id, role: { name: 'code-reviewer', readOnly: true } }],
      review: { of: author }
    })
    const started = env.items(author).find((i) => i.kind === 'child-started')
    expect(started).toMatchObject({
      childId: reviewer.id,
      request: bubble?.kind === 'role-request' ? bubble.requestId : 'x'
    })
    expect(started?.kind === 'child-started' && started.branch).toBeFalsy()
    expect(env.card(author)?.authorId).toBe(author)

    await waitFor(() => env.card(author)?.status === 'reported')
    await env.idle(reviewer.id)
    const review = env.card(author)
    expect(review?.findings).toHaveLength(2)
    expect(review?.findings[0]).toMatchObject({
      id: `${reviewer.id}:1`,
      file: 'src/app.js',
      line: 2,
      severity: 'high',
      code: "  console.log('bonjour')"
    })
    expect(review?.findings[1]).toMatchObject({ line: 1, endLine: 3, severity: 'low' })
    expect(review?.findings[1]?.code.split('\n')).toHaveLength(3)
    expect(review?.summary).toBe('Une erreur à corriger avant de fusionner.')
    // Dossier inchangé : rien de signalé ; une seule carte de relecture dans ce fil.
    expect(review?.changed).toBeUndefined()
    expect(env.items(author).filter((i) => i.kind === 'review')).toHaveLength(1)
    // Sa réponse, comme celle de tout travail qui a sa carte : entière, et transmise avec le
    // prochain message, ses remarques jointes (« Demander à … de corriger »).
    await waitFor(() =>
      env.items(author).some((i) => i.kind === 'child-report' && i.childId === reviewer.id)
    )
    const report = env.items(author).find((i) => i.kind === 'child-report')
    expect(report?.kind === 'child-report' && report.reply).toContain('Deux remarques rendues')
    const context = childContext(childNews(env.items(author)), env.items(author), reviewer.id)
    expect(context).toContain('Structured review findings')
    expect(context).toContain('[high] src/app.js:2 — Le message est écrit en dur')
    expect(context).toContain('[low] src/app.js:1-3')
    // La réponse de l'outil arrive dans le fil du relecteur.
    const reply = env.items(reviewer.id).findLast((i) => i.kind === 'agent')
    expect(reply?.kind === 'agent' && reply.text).toContain('2 finding(s) delivered')
    // Pas d'avis en double du garde-fou des rôles en lecture seule : la relecture a le sien.
    expect(
      env
        .items(reviewer.id)
        .some((i) => i.kind === 'notice' && i.message?.key === 'roles.notice.watchFailed')
    ).toBe(false)
  })

  it('« Répondre à Code reviewer » : même conversation, empreinte reprise au départ du tour', async () => {
    const env = await environment()
    const author = await env.author()
    const reviewer = await env.reviews.start(author)
    await waitFor(() =>
      env.items(author).some((i) => i.kind === 'child-report' && i.childId === reviewer.id)
    )
    await env.idle(reviewer.id)
    await env.reviews.settled(reviewer.id)
    // L'auteur corrige entre deux tours du relecteur : ce n'est pas le relecteur qui écrit.
    writeFileSync(join(env.repo, 'src', 'app.js'), 'export const corrige = true\n')
    // La suite relit sans rien écrire (l'agent factice de ce profil écrirait sinon).
    const again = 'Relis à nouveau\n/scenario relecture-vide'
    expect(env.children.reply(author, reviewer.id, again)).toBe('sent')
    await waitFor(
      () => env.items(author).filter((i) => i.kind === 'child-report').length === 2,
      20_000
    )
    await env.idle(reviewer.id)
    await env.reviews.settled(reviewer.id)
    // Bulle de suite dans le fil de l'auteur ; la suite part au même relecteur.
    expect(
      env.items(author).some((i) => i.kind === 'role-request' && i.followUp && i.text === again)
    ).toBe(true)
    expect(
      env
        .items(reviewer.id)
        .filter((i) => i.kind === 'user')
        .map((i) => i.kind === 'user' && i.text)
    ).toContain(again)
    await waitFor(() => env.card(author)?.status === 'reported')
    expect(env.card(author)?.changed).toBeUndefined()
  })

  it('un relecteur qui écrit dans le dossier est signalé ; un relecteur muet aussi', async () => {
    const env = await environment()
    const author = await env.author()
    const writer = await env.reviews.start(author, { focus: '/scenario relecture-modifie' })
    await waitFor(() => env.card(author)?.changed === true)
    expect(
      env
        .items(writer.id)
        .some((i) => i.kind === 'notice' && i.message?.key === 'review.notice.changed')
    ).toBe(true)
    await env.idle(writer.id)
    // Une relecture de plus : le fichier écrit compte désormais parmi les modifications.
    const mute = await env.reviews.start(author, { focus: '/scenario relecture-muette' })
    await waitFor(
      () => env.card(author)?.reviewId === mute.id && env.card(author)?.status === 'silent'
    )
    // Relecture rendue en texte libre : gardée sur la carte, pour ne pas la perdre.
    expect(env.card(author)?.reply).toBe('J’ai relu : ça me semble correct.')
  })

  it('la fille d’une mère est relue par sa sœur, sur sa branche depuis son départ', async () => {
    const env = await environment()
    const mother = env.manager.state().activeId
    await env.manager.startActive()
    await env.manager.prompt(mother, 'Prépare le travail')
    const child = await env.children.start(mother, { text: 'Consigne', profileId: 'modifs' })
    await waitFor(() => env.items(child.id).some((i) => i.kind === 'agent'))
    await env.idle(child.id)
    const reviewer = await env.reviews.start(child.id, { profileId: 'echo' })
    expect(reviewer.startedFrom?.id).toBe(mother)
    expect(reviewer.profileId).toBe('echo')
    expect(reviewer.workspace).toBe(child.workspace)
    const review = env.card(child.id)
    expect(review).toMatchObject({ scope: 'branch', baseBranch: 'main', files: 2 })
    expect(review?.base).toBe(env.git('rev-parse', '--short=7', 'HEAD'))
    // Fiche 265 : demandée dans le fil de la mère — la bulle nomme la branche et le travail relu,
    // la carte de relecture y est aussi (celle du fil du travail donne les remarques de diff).
    const bubble = env.items(mother).find((i) => i.kind === 'role-request')
    expect(bubble).toMatchObject({
      text: t('review.ask.branch', { branch: child.branch ?? '' }),
      review: { of: child.id }
    })
    expect(env.card(mother)).toMatchObject({ reviewId: reviewer.id, authorId: child.id })
    await waitFor(() => env.card(child.id)?.status === 'reported')
    await waitFor(() => env.card(mother)?.status === 'reported')
    expect(env.card(mother)?.findings).toEqual(env.card(child.id)?.findings)
    // Sa réponse arrive chez la mère, comme celle de tout travail qui a sa carte.
    await waitFor(() =>
      env.items(mother).some((i) => i.kind === 'child-report' && i.childId === reviewer.id)
    )
  })

  it('relecteur qui ne démarre pas : dit sur ses cartes ; « Relancer » repart avec sa consigne', async () => {
    const env = await environment()
    const author = await env.author()
    const reviewer = await env.reviews.start(author, { profileId: 'casse' })
    await waitFor(() => env.card(author)?.status === 'failed', 20_000)
    // Comme tout travail : une réponse en erreur dans le fil de la mère (carte « en erreur »).
    const reports = () =>
      env
        .items(author)
        .filter(
          (i) => i.kind === 'child-report' && i.childId === reviewer.id && i.outcome === 'error'
        )
    expect(reports()).toHaveLength(1)
    // « Relancer » (la même demande) : le premier message refait, jamais la demande seule.
    expect(env.children.reply(author, reviewer.id, 'Relis les modifications')).toBe('sent')
    await waitFor(() => reports().length === 2, 20_000)
    expect(env.items(reviewer.id).some((i) => i.kind === 'user')).toBe(false)
  })

  it('relecture d’avant (sans lancement chez la mère) : ni compte rendu ni « Répondre »', async () => {
    const env = await environment()
    const author = await env.author()
    const reviewer = await env.reviews.start(author)
    await waitFor(() => env.card(author)?.status === 'reported')
    await env.idle(reviewer.id)
    // Une conversation d'avant la fiche 265 : ni bulle ni lancement dans le fil de l'auteur.
    const before = env.items(author).filter((i) => i.kind === 'child-report').length
    const view = env.manager.view(author)
    view.transcript.items.splice(
      0,
      view.transcript.items.length,
      ...view.transcript.items.filter(
        (i) => i.kind !== 'child-started' && i.kind !== 'role-request'
      )
    )
    expect(() => env.children.reply(author, reviewer.id, 'Encore')).toThrow(
      t('workCard.error.gone')
    )
    expect(env.items(author).filter((i) => i.kind === 'child-report')).toHaveLength(before)
  })

  it('refus clairs : rien à relire, relecteur relu, `report_findings` hors du dossier', async () => {
    const env = await environment()
    const author = await env.author()
    env.git('add', '.')
    env.git('commit', '-q', '-m', 'travail')
    await expect(env.reviews.start(author)).rejects.toThrow(t('review.error.nothing'))
    writeFileSync(join(env.repo, 'nouveau.txt'), 'a\nb\n')
    const reviewer = await env.reviews.start(author, { focus: '/scenario relecture-vide' })
    await expect(env.reviews.start(reviewer.id)).rejects.toThrow(t('review.error.reviewer'))
    // Un relecteur ne lance pas de fille, ni par `start_child` ni par `@rôle` (fiche 223) : il est
    // toujours rattaché (`startedFrom`), le refus « un seul niveau » vaut.
    expect(reviewer.startedFrom).toBeDefined()
    await expect(
      env.children.start(reviewer.id, { text: 'Relis', role: 'code-reviewer' })
    ).rejects.toThrow(t('children.error.oneLevel'))
    await expect(
      env.reviews.report(reviewer.id, {
        findings: [
          {
            file: '../ailleurs.txt',
            line: 1,
            severity: 'high',
            category: 'correctness',
            title: 'x',
            why: 'y'
          }
        ]
      })
    ).rejects.toThrow('inside the reviewed folder')
    await expect(env.reviews.report(author, { findings: [] })).rejects.toThrow(
      t('review.error.notReviewer')
    )
    await waitFor(() => env.card(author)?.status === 'reported')
    expect(env.card(author)?.findings).toEqual([])
  })

  it('IPC : arguments vérifiés, module absent refusé', async () => {
    const start = async (_id: string) => ({}) as never
    const handlers = reviewHandlers({ start })
    expect(() => handlers['conversation:startReview']('', {})).toThrow('id')
    expect(() =>
      handlers['conversation:startReview']('c', { focus: 3 } as unknown as { focus: string })
    ).toThrow('focus')
    expect(() => reviewHandlers(undefined)['conversation:startReview']('c', {})).toThrow()
  })
})
