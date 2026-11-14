import type { RoleView } from '@shared/roles'
import { describe, expect, it } from 'vitest'
import type { ConversationSummary } from '@shared/agent'
import type { ChildDecision, ChildProposal } from '@shared/children'
import type { ChildChoices, ChildStatus } from '../conversations/children'
import {
  childrenToolsModule,
  PARENT_MESSAGE_CHARS,
  resolveChoice,
  type ChildTools
} from './children-tools'
import type { AppTool, ToolContext, ToolResult } from './tools'

const summary = (id: string, extra: Partial<ConversationSummary> = {}): ConversationSummary => ({
  id,
  title: id,
  profileId: 'mock',
  profileLabel: 'Factice',
  workspace: `/depot/${id}`,
  updatedAt: '2026-10-21T00:00:00Z',
  status: 'ready',
  draft: false,
  ...extra
})

/** Agents et modèles connus : la mère sur `mock`, OpenCode disponible, Bob absent. */
const CHOICES: ChildChoices = {
  profileId: 'mock',
  profiles: [
    { id: 'mock', label: 'Factice', available: true },
    { id: 'opencode', label: 'OpenCode', available: true },
    { id: 'bob', label: 'IBM Bob', available: false, reason: 'introuvable' }
  ],
  model: {
    id: 'model',
    name: 'Modèle',
    category: 'model',
    type: 'select',
    currentValue: 'factice-rapide',
    options: [
      { value: 'factice-rapide', name: 'Factice rapide' },
      { value: 'factice-precis', name: 'Factice précis' }
    ]
  }
}

const textOf = (result: ToolResult) =>
  result.content.map((c) => (c.type === 'text' ? c.text : '')).join('\n')

/**
 * Faux module des filles : une mère `m`, ses filles `f1` (« Import CSV ») et `f2`, et ce que les
 * outils lui demandent. `answer` : décision sur la carte de propositions (`'late'` : tardive).
 */
function setup(
  options: {
    role?: 'mother' | 'child' | 'reviewer' | undefined
    capacity?: { inRepo: boolean; active: number; max: number }
    answer?: ChildDecision | 'late'
    motherGone?: boolean
    /** Carte de propositions tenue ouverte par l'essai. */
    propose?: ToolContext['proposeChild']
    /** Rôles actifs de la mère (fiche 223). */
    roles?: RoleView[]
    choices?: ChildChoices
  } = {}
) {
  const calls: unknown[][] = []
  const told: string[] = []
  const asked: ChildProposal[] = []
  let onLate: ((decision: ChildDecision) => void) | undefined
  const children = [
    summary('f1', { title: 'Import CSV', status: 'busy', startedFrom: { id: 'm', title: 'm' } }),
    summary('f2', { startedFrom: { id: 'm', title: 'm' } })
  ]
  const host: ChildTools = {
    reviews: { report: async (id) => `rapport de ${id}` },
    role: () => ('role' in options ? options.role : 'mother'),
    summary: (id) =>
      id === 'm'
        ? summary('m', { title: 'Carnet' })
        : summary(id, options.motherGone ? {} : { startedFrom: { id: 'm', title: 'Carnet' } }),
    capacity: () => options.capacity ?? { inRepo: true, active: 0, max: 5 },
    start: async (id, request, by) => {
      calls.push(['start', id, request, by])
      return summary('f3', { title: request.title ?? '', branch: 'bobine/x' })
    },
    children: () => children,
    status: (): ChildStatus[] => [
      {
        id: 'f1',
        title: 'Import CSV',
        state: 'running',
        branch: 'bobine/a',
        files: [{ path: 'src/import.ts', added: 40, removed: 2 }],
        fileCount: 1,
        added: 40,
        removed: 2,
        excerpt: 'Les tests passent.'
      }
    ],
    messageChild: (motherId, child, text) => {
      calls.push(['messageChild', motherId, child.id, text])
      return child.status === 'busy' ? 'queued' : 'sent'
    },
    messageParent: (child, mother, text) => {
      calls.push(['messageParent', child.id, mother.id, text])
      return 'sent'
    },
    choices: () => options.choices ?? CHOICES,
    recommend: (motherId, child, ready, note) => {
      calls.push(['recommend', motherId, child.id, ready, note])
    },
    rolesFor: () => options.roles ?? [],
    findRole: (_id, name) => {
      const role = (options.roles ?? []).find((r) => r.name === name)
      if (!role) throw new Error(`unknown ${name}`)
      return role
    }
  }
  const context: ToolContext = {
    workspace: '/depot/m',
    // Une fille : `f2`, fille de `m`.
    conversationId: options.role === 'child' ? 'f2' : 'm',
    ask: async () => null,
    proposeChild: async (proposal, late) => {
      asked.push(proposal)
      onLate = late
      if (options.propose) return options.propose(proposal, late)
      return options.answer ?? { action: 'start' }
    },
    tellAgent: (text) => told.push(text)
  }
  const tools = childrenToolsModule(() => host).tools(context)
  const tool = (name: string): AppTool => {
    const found = tools.find((x) => x.definition.name === name)
    if (!found) throw new Error(`outil absent : ${name}`)
    return found
  }
  return { tools, tool, calls, told, asked, late: (decision: ChildDecision) => onLate?.(decision) }
}

describe('outils des conversations filles (fiche 097, étape 2)', () => {
  it('une mère reçoit start_child, message_child et child_status ; une fille, message_parent', () => {
    const names = (role: 'mother' | 'child' | 'reviewer' | undefined) =>
      setup({ role }).tools.map((x) => x.definition.name)
    expect(names('mother')).toEqual([
      'start_child',
      'message_child',
      'child_status',
      'recommend_merge'
    ])
    expect(names('child')).toEqual(['message_parent'])
    // Relecteur (fiche 177) : rendre ses remarques, rien d'autre.
    expect(names('reviewer')).toEqual(['report_findings'])
    expect(names(undefined)).toEqual([])
    expect(childrenToolsModule(() => undefined).tools({} as ToolContext)).toEqual([])
    // Autorisés d'office ; descriptions en anglais, qui disent aussi quand ne pas s'en servir.
    const start = setup().tool('start_child')
    expect(start.autoAllow).toBe(true)
    expect(start.definition.description).toMatch(/Do it yourself for a question, reading or search/)
    expect(start.definition.inputSchema).toMatchObject({ required: ['title', 'prompt'] })
  })

  it('start_child : carte de propositions, puis la fille, lancée par l’agent', async () => {
    const s = setup()
    const result = await s.tool('start_child').call({ title: 'Page d’aide', prompt: 'Écris-la' })
    expect(s.asked).toEqual([{ title: 'Page d’aide', prompt: 'Écris-la' }])
    expect(s.calls).toEqual([['start', 'm', { text: 'Écris-la', title: 'Page d’aide' }, 'agent']])
    expect(textOf(result)).toContain('started (id: f3, branch: bobine/x)')
    expect(textOf(result)).toContain('you will be woken up')
  })

  it('« Lancer » avec un autre agent ou un autre modèle (fiche 112) : passés à la fille', async () => {
    const s = setup({
      answer: { action: 'start', profileId: 'opencode', model: { controlId: 'model', value: 'q' } }
    })
    await s.tool('start_child').call({ title: 'Relecture', prompt: 'Relis' })
    expect(s.calls).toEqual([
      [
        'start',
        'm',
        {
          text: 'Relis',
          title: 'Relecture',
          profileId: 'opencode',
          model: { controlId: 'model', value: 'q' }
        },
        'agent'
      ]
    ])
  })

  it('« Faire ici » (fiche 112) : la consigne revient à l’agent, aucune fille', async () => {
    const s = setup({ answer: { action: 'here' } })
    const result = await s.tool('start_child').call({ title: 'Aide', prompt: 'Écris la page' })
    expect(result.isError).toBeUndefined()
    expect(textOf(result)).toContain('do this task yourself, now, in this conversation')
    expect(textOf(result)).toContain('The task:\nÉcris la page')
    expect(s.calls).toEqual([])
  })

  it('start_child refusé : résultat clair, aucune fille', async () => {
    const s = setup({ answer: { action: 'refuse' } })
    const result = await s.tool('start_child').call({ title: 'Aide', prompt: 'Écris' })
    expect(result.isError).toBeUndefined()
    expect(textOf(result)).toContain('The user refused to start the child conversation "Aide"')
    expect(s.calls).toEqual([])
  })

  it('start_child au-delà du plafond ou hors dépôt : erreur, sans carte', async () => {
    const full = setup({ capacity: { inRepo: true, active: 2, max: 2 } })
    const result = await full.tool('start_child').call({ title: 'Aide', prompt: 'Écris' })
    expect(result.isError).toBe(true)
    expect(textOf(result)).toContain('2 child conversation(s) are already running')
    expect(textOf(result)).toContain('Settings › Conversation › Running child conversations')
    expect(full.asked).toEqual([])
    const loose = setup({ capacity: { inRepo: false, active: 0, max: 5 } })
    expect(textOf(await loose.tool('start_child').call({ title: 'A', prompt: 'B' }))).toContain(
      'not in a git repository'
    )
    await expect(setup().tool('start_child').call({ title: ' ', prompt: 'B' })).rejects.toThrow(
      'title'
    )
  })

  it('plafond vérifié avant la carte ; une carte en attente prend une place', async () => {
    // Plafond 2, aucune fille en cours : l'agent appelle start_child trois fois à la fois.
    const answers: ((decision: ChildDecision) => void)[] = []
    const s = setup({
      capacity: { inRepo: true, active: 0, max: 2 },
      propose: () => new Promise((resolve) => answers.push(resolve))
    })
    const call = (title: string) => s.tool('start_child').call({ title, prompt: 'Fais' })
    const first = call('Un')
    const second = call('Deux')
    const third = await call('Trois')
    // La troisième n'a pas de carte : refusée tout de suite, en citant le réglage.
    expect(third.isError).toBe(true)
    expect(textOf(third)).toContain("and 2 more wait(s) for the user's approval")
    expect(textOf(third)).toContain('Running child conversations, 2')
    expect(s.asked.map((a) => a.title)).toEqual(['Un', 'Deux'])
    // Une proposition refusée libère sa place.
    answers[1]?.({ action: 'refuse' })
    await second
    answers[0]?.({ action: 'start' })
    expect(textOf(await first)).toContain('started')
    const again = s.tool('start_child').call({ title: 'Trois', prompt: 'Fais' })
    expect(s.asked).toHaveLength(3)
    answers[2]?.({ action: 'refuse' })
    await again
  })

  it('réponse tardive : lancée, la fille démarre ; « Faire ici » ou refusée, l’agent en est informé', async () => {
    const s = setup({ answer: 'late' })
    const result = await s.tool('start_child').call({ title: 'Aide', prompt: 'Écris' })
    expect(textOf(result)).toContain('End your turn now')
    s.late({ action: 'start' })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(s.calls).toEqual([['start', 'm', { text: 'Écris', title: 'Aide' }, 'agent']])
    expect(s.told).toEqual([])

    const here = setup({ answer: 'late' })
    await here.tool('start_child').call({ title: 'Aide', prompt: 'Écris' })
    here.late({ action: 'here' })
    expect(here.calls).toEqual([])
    expect(here.told[0]).toContain(
      'About the child conversation "Aide": the user wants you to do this task yourself'
    )
    expect(here.told[0]).toContain('The task:\nÉcris')

    const refused = setup({ answer: 'late' })
    await refused.tool('start_child').call({ title: 'Aide', prompt: 'Écris' })
    refused.late({ action: 'refuse' })
    expect(refused.calls).toEqual([])
    expect(refused.told[0]).toContain('I refused to start the child conversation "Aide"')
  })

  it('message_child : par identifiant ou par titre ; inconnue, la liste des filles', async () => {
    const s = setup()
    const queued = await s.tool('message_child').call({ child: 'import csv', message: 'Virgule' })
    expect(textOf(queued)).toContain('queued for the child conversation "Import CSV"')
    const sent = await s.tool('message_child').call({ child: 'f2', message: 'Bonjour' })
    expect(textOf(sent)).toContain('Message sent to the child conversation "f2"')
    expect(s.calls).toEqual([
      ['messageChild', 'm', 'f1', 'Virgule'],
      ['messageChild', 'm', 'f2', 'Bonjour']
    ])
    const unknown = await s.tool('message_child').call({ child: 'x', message: 'Bonjour' })
    expect(unknown.isError).toBe(true)
    expect(textOf(unknown)).toContain('"Import CSV" (id: f1), "f2" (id: f2)')
  })

  it('child_status : une ligne par fille, en anglais', async () => {
    const result = await setup().tool('child_status').call({})
    expect(textOf(result)).toBe(
      '- "Import CSV" (id: f1): working; branch bobine/a; 1 file(s) changed (+40 −2): src/import.ts.\n  Start of its last reply:\n  > Les tests passent.'
    )
  })

  it('start_child choisit agent et modèle (fiche 160) : validés, proposés sur la carte', async () => {
    const s = setup()
    await s.tool('start_child').call({
      title: 'Relecture',
      prompt: 'Relis',
      model: 'Factice précis',
      why: 'relecture fine'
    })
    expect(s.asked).toEqual([
      {
        title: 'Relecture',
        prompt: 'Relis',
        model: { controlId: 'model', value: 'factice-precis' },
        why: 'relecture fine'
      }
    ])
    // Le choix de l'utilisateur sur la carte l'emporte (ici, « Lancer » sans changer : rien).
    expect(s.calls).toEqual([['start', 'm', { text: 'Relis', title: 'Relecture' }, 'agent']])
    const other = setup()
    await other.tool('start_child').call({ title: 'A', prompt: 'B', agent: 'opencode' })
    expect(other.asked[0]).toMatchObject({ profileId: 'opencode' })
    // L'aide de l'argument cite les agents disponibles, pas ceux qui manquent.
    const help = JSON.stringify(other.tool('start_child').definition.inputSchema)
    expect(help).toContain('Available: mock (Factice), opencode (OpenCode). Yours: mock.')
    expect(help).not.toContain('bob (IBM Bob)')
  })

  it('agent ou modèle inconnus : erreur claire avec les valeurs possibles, sans carte', async () => {
    const s = setup()
    const unknown = await s.tool('start_child').call({ title: 'A', prompt: 'B', agent: 'gpt' })
    expect(unknown.isError).toBe(true)
    expect(textOf(unknown)).toBe(
      'Unknown agent "gpt". Available agents: mock (Factice), opencode (OpenCode). Omit `agent` to keep yours.'
    )
    expect(s.asked).toEqual([])
    expect(resolveChoice(CHOICES, 'IBM Bob', undefined)).toContain(
      'The agent "IBM Bob" is not available (introuvable).'
    )
    expect(resolveChoice(CHOICES, undefined, 'turbo')).toBe(
      'Unknown model "turbo". Models of your agent: factice-rapide, factice-precis.'
    )
    expect(resolveChoice(CHOICES, 'opencode', 'factice-precis')).toContain(
      'A model can only be chosen for your own agent (mock)'
    )
    // Profil sans choix de modèle pour une fille (comme Bob) : modèle refusé, clairement.
    expect(resolveChoice({ ...CHOICES, model: undefined }, undefined, 'x')).toContain(
      "Your agent's profile does not allow choosing the model of a child conversation"
    )
    // … et pas d'argument `model` à son outil : l'agent n'essaie pas (vrai Bob : un « échec »).
    const schema = (choices?: ChildChoices) =>
      setup(choices ? { choices } : {}).tool('start_child').definition.inputSchema
    expect(schema()).toHaveProperty('properties.model')
    expect(schema({ ...CHOICES, model: undefined })).not.toHaveProperty('properties.model')
    // Passé quand même (vrai Bob 2.0.6) : ignoré, la fille part sans, l'agent est averti.
    const bob = setup({ choices: { ...CHOICES, model: undefined } })
    const ignored = await bob
      .tool('start_child')
      .call({ title: 'A', prompt: 'B', model: 'claude-3-5-haiku', why: 'léger' })
    expect(ignored.isError).toBeUndefined()
    expect(bob.asked[0]).not.toHaveProperty('model')
    expect(textOf(ignored)).toMatch(/^`model` was ignored: your agent's profile does not allow/)
    // L'agent de la mère, nommé : rien à changer.
    expect(resolveChoice(CHOICES, 'Factice', 'FACTICE-RAPIDE')).toEqual({
      model: { controlId: 'model', value: 'factice-rapide' }
    })
    await expect(
      setup().tool('start_child').call({ title: 'A', prompt: 'B', agent: 3 })
    ).rejects.toThrow('agent')
  })

  it('recommend_merge : posé pour la fille, ne fusionne rien (fiche 160)', async () => {
    const s = setup()
    const tool = s.tool('recommend_merge')
    expect(tool.definition.description).toContain('This does not merge anything')
    expect(tool.definition.inputSchema).toMatchObject({ required: ['child', 'ready', 'note'] })
    const ready = await tool.call({ child: 'Import CSV', ready: true, note: 'Tests relus.' })
    expect(textOf(ready)).toContain('"Import CSV" is recommended for merging')
    expect(textOf(ready)).toContain('do not merge it yourself')
    const missing = await tool.call({ child: 'f2', ready: false, note: 'Tests manquants.' })
    expect(textOf(missing)).toContain('is not ready to merge')
    expect(s.calls).toEqual([
      ['recommend', 'm', 'f1', true, 'Tests relus.'],
      ['recommend', 'm', 'f2', false, 'Tests manquants.']
    ])
    const unknown = await tool.call({ child: 'x', ready: true, note: 'ok' })
    expect(unknown.isError).toBe(true)
    await expect(tool.call({ child: 'f1', ready: 'oui', note: 'ok' })).rejects.toThrow('ready')
  })

  it('commande « / » en tête d’une consigne ou d’un message : refusée (fiche 160)', async () => {
    const s = setup()
    const start = await s
      .tool('start_child')
      .call({ title: 'A', prompt: '  /model gpt-5\nFais-le' })
    expect(start.isError).toBe(true)
    expect(textOf(start)).toContain('`prompt` starts with a command (/model)')
    expect(s.asked).toEqual([])
    const message = await s.tool('message_child').call({ child: 'f1', message: '/compact' })
    expect(message.isError).toBe(true)
    expect(textOf(message)).toContain('`message` starts with a command (/compact)')
    expect(s.calls).toEqual([])
    // Une barre oblique ailleurs que tout au début reste du texte.
    await s.tool('message_child').call({ child: 'f1', message: 'Regarde src/a.ts et /tmp' })
    expect(s.calls).toEqual([['messageChild', 'm', 'f1', 'Regarde src/a.ts et /tmp']])
  })

  it('message_parent borné : un long message (un diff collé) est coupé et le dit', async () => {
    const s = setup({ role: 'child' })
    const long = `${'+ ligne ajoutée\n'.repeat(1000)}`
    await s.tool('message_parent').call({ message: long })
    const sent = String(s.calls[0]?.[3])
    expect(sent.length).toBeLessThan(PARENT_MESSAGE_CHARS + 60)
    expect(sent).toMatch(new RegExp(`… \\(cut: ${long.trim().length} characters in all\\)$`))
    await s.tool('message_parent').call({ message: 'Court.' })
    expect(s.calls[1]?.[3]).toBe('Court.')
  })

  it('start_child en positif (fiche 223) : quand déléguer d’abord, les exclusions ensuite', () => {
    const start = setup().tool('start_child').definition.description
    const at = (text: string) => {
      const index = start.indexOf(text)
      expect(index, text).toBeGreaterThanOrEqual(0)
      return index
    }
    const exclusions = at('Do it yourself for')
    for (const text of [
      'several independent tasks',
      'follow separately',
      'a review or an audit by a fresh pair of eyes'
    ]) {
      expect(at(text)).toBeLessThan(exclusions)
    }
    // Plus de renvoi vers les sous-agents de l'agent pour un travail séparé ; générique.
    expect(start).not.toContain('with your own sub-agents')
    expect(start).not.toMatch(/\bBob\b|OpenCode/)
  })

  it('le compte rendu n’est pas une preuve : les descriptions le disent', () => {
    const s = setup()
    const start = s.tool('start_child').definition.description
    expect(start).toContain('not proof')
    expect(start).toContain('Never merge a branch yourself')
    expect(s.tool('message_child').definition.description).toContain('keeps its context')
  })

  it('message_parent : vers la mère, ou une erreur si elle n’est plus là', async () => {
    const s = setup({ role: 'child' })
    const result = await s.tool('message_parent').call({ message: 'Virgule aussi ?' })
    expect(s.calls).toEqual([['messageParent', 'f2', 'm', 'Virgule aussi ?']])
    expect(textOf(result)).toContain('sent to your parent conversation "Carnet"')
    const orphan = setup({ role: 'child', motherGone: true })
    const gone = await orphan.tool('message_parent').call({ message: 'Allô ?' })
    expect(gone.isError).toBe(true)
    expect(orphan.calls).toEqual([])
  })
})

describe('start_child avec un rôle (fiche 223)', () => {
  const role = (name: string, extra: Partial<RoleView> = {}): RoleView => ({
    name,
    label: name,
    icon: 'bot',
    color: 'blue',
    description: `Quand ${name}`,
    readOnly: false,
    prompt: 'p',
    scope: 'builtin',
    enabled: true,
    ...extra
  })
  const ROLES = [
    role('security-expert', { readOnly: true, color: 'orange', icon: 'shield-check' }),
    role('flutter-expert', { agent: 'opencode' }),
    role('fast', { model: 'factice-precis' }),
    role('ailleurs', { agent: 'bob', model: 'factice-precis' })
  ]

  it('la description et l’argument `role` citent les rôles actifs ; sans rôle, ni l’un ni l’autre', () => {
    const start = setup({ roles: ROLES }).tool('start_child').definition
    expect(start.description).toContain('- security-expert: Quand security-expert (read-only)')
    expect(JSON.stringify(start.inputSchema)).toContain('Roles: security-expert, flutter-expert')
    const plain = setup().tool('start_child').definition
    expect(plain.description).not.toContain('Roles:')
    expect(JSON.stringify(plain.inputSchema)).not.toContain('"role"')
  })

  it('rôle inconnu : refusé avec la liste des rôles connus, sans carte', async () => {
    const s = setup({ roles: ROLES })
    const result = await s.tool('start_child').call({ title: 'T', prompt: 'P', role: 'astronaute' })
    expect(result.isError).toBe(true)
    expect(textOf(result)).toContain('Unknown role "astronaute". Roles: security-expert,')
    expect(s.asked).toEqual([])
    expect(s.calls).toEqual([])
  })

  it('délègue à un rôle : sa pastille sur la carte, son nom à la fille, la lecture seule dite', async () => {
    const s = setup({ roles: ROLES })
    const result = await s
      .tool('start_child')
      .call({ title: 'Audit', prompt: 'Audite', role: 'security-expert' })
    expect(s.asked).toEqual([
      {
        title: 'Audit',
        prompt: 'Audite',
        role: {
          name: 'security-expert',
          label: 'security-expert',
          icon: 'shield-check',
          color: 'orange',
          readOnly: true
        }
      }
    ])
    expect(s.calls).toEqual([
      ['start', 'm', { text: 'Audite', title: 'Audit', role: 'security-expert' }, 'agent']
    ])
    expect(textOf(result)).toContain('read-only role "security-expert", in this folder')
  })

  it('agent et modèle du rôle repris quand le profil le permet, sinon une note', async () => {
    const withAgent = setup({ roles: ROLES })
    await withAgent.tool('start_child').call({ title: 'F', prompt: 'P', role: 'flutter-expert' })
    expect(withAgent.asked[0]?.profileId).toBe('opencode')
    // `agent` passé par la mère l'emporte.
    const mine = setup({ roles: ROLES })
    await mine
      .tool('start_child')
      .call({ title: 'F', prompt: 'P', role: 'flutter-expert', agent: 'mock' })
    expect(mine.asked[0]?.profileId).toBeUndefined()
    const withModel = setup({ roles: ROLES })
    await withModel.tool('start_child').call({ title: 'F', prompt: 'P', role: 'fast' })
    expect(withModel.asked[0]?.model).toEqual({ controlId: 'model', value: 'factice-precis' })
    const unavailable = setup({ roles: ROLES })
    const result = await unavailable
      .tool('start_child')
      .call({ title: 'F', prompt: 'P', role: 'ailleurs' })
    expect(result.isError).toBeFalsy()
    expect(unavailable.asked[0]?.profileId).toBeUndefined()
    expect(textOf(result)).toContain('The role\'s agent "bob" is not available here')
  })
})
