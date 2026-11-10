import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { methods, RequestError } from '../shared/acp-sdk.mts'
import type {
  RequestPermissionRequest,
  SessionNotification,
  SessionUpdate
} from '../shared/acp-sdk.mts'
import { networkPending, pollTool, scenarios } from './scenarios.mts'
import { LONG_WORD } from './scenarios-debordements.mts'
import { splitIntoChunks, type Step } from './scenario.mts'
import {
  MOCK_COMMANDS,
  MOCK_CONTEXT_SIZE,
  MOCK_TURN_COST,
  LOGIN_MARKER,
  SSO_AUTH_METHOD,
  UNTRUSTED_WORKSPACE_CODE
} from './agent.mts'
import { agentText, initialize, playTurn, withMockAgent, type MockAgentRun } from './testing.mts'

const CWD = '/tmp/projet'

/** Lance l'agent sur un scénario et joue un tour de prompt. */
function runScenario(run: MockAgentRun, prompt = 'Bonjour') {
  return withMockAgent(run, async (ctx) => {
    await initialize(ctx)
    return ctx.buildSession(CWD).withSession((session) => playTurn(session, prompt))
  })
}

const ofType = <K extends SessionUpdate['sessionUpdate']>(updates: SessionUpdate[], kind: K) =>
  updates.filter((u): u is Extract<SessionUpdate, { sessionUpdate: K }> => u.sessionUpdate === kind)

describe('splitIntoChunks', () => {
  it('découpe sans perdre de caractère', () => {
    const text = 'Un  texte\navec des   espaces\n\net des lignes.'
    const chunks = splitIntoChunks(text, 2)
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.join('')).toBe(text)
  })
})

/**
 * Joue des étapes sans processus : `answers` donne la réponse de chaque appel d'outil MCP, dans
 * l'ordre. Rend les outils appelés, les pauses et le texte final.
 */
function walk(steps: Step[], answers: string[]) {
  const trace: string[] = []
  const queue = [...steps]
  for (let step = queue.shift(); step; step = queue.shift()) {
    if (step.kind === 'mcp-tool') {
      trace.push(step.tool)
      queue.unshift(...step.onResult(answers.shift() ?? 'Aucune réponse.'))
    } else if (step.kind === 'pause') trace.push('pause')
    else if (step.kind === 'text') trace.push(step.text)
  }
  return trace
}

describe('pollTool (attente d’un état, fiche 106)', () => {
  const pending = 'req_1  GET … Fetch  http://127.0.0.1:1/api\n\nCorps d’une réponse : …'
  const done = 'req_1  GET 500 Fetch  http://127.0.0.1:1/api\n\nCorps d’une réponse : …'
  const poll = (timeoutMs?: number) =>
    pollTool(
      { tool: 'browser_network', args: { url_pattern: '/api' } },
      (text) => !networkPending(text),
      (text) => [{ kind: 'text', text: `fin : ${text.split(' ')[3]}` }],
      timeoutMs
    )

  it('networkPending : aucune requête ou statut « … » ; statut, échec ou erreur terminent', () => {
    expect(networkPending('Aucune requête.')).toBe(true)
    expect(networkPending(pending)).toBe(true)
    expect(networkPending(done)).toBe(false)
    expect(networkPending('req_1  GET ÉCHEC Fetch  http://x/api  (net::ERR)')).toBe(false)
    expect(networkPending('Aucun serveur MCP HTTP fourni par le client.')).toBe(false)
  })

  it('relit le journal, une pause entre deux appels, jusqu’au statut', () => {
    expect(walk(poll(), ['Aucune requête.', pending, done])).toEqual([
      'browser_network',
      'pause',
      'browser_network',
      'pause',
      'browser_network',
      'fin : 500'
    ])
  })

  it('délai écoulé : rend la dernière réponse, même sans statut', () => {
    expect(walk(poll(0), [pending, pending])).toEqual(['browser_network', 'fin : …'])
  })
})

describe('terminal (lecture de la sortie)', () => {
  const steps = scenarios.terminal?.steps
  if (!steps) throw new Error('Missing terminal scenario')

  it('relit après le prompt de démarrage jusqu’au résultat de la commande', () => {
    const started = 'Started in terminal tab 2.'
    const output = 'Terminal tab 2 (idle):\nbonjour du terminal 42'
    expect(
      walk(steps, [
        started,
        'Terminal tab 2 (idle):\necho "bonjour du terminal $((6*7))"',
        output,
        'tab 2: shell'
      ])
    ).toEqual([
      'Je lance la commande dans le terminal. ',
      'terminal_run',
      'terminal_read',
      'pause',
      'terminal_read',
      'terminal_list',
      `Lancement : ${started}\n\nÉcran :\n${output}\n\nOnglets :\ntab 2: shell`
    ])
  })

  it('ne répète pas une erreur d’outil comme une sortie encore en cours', () => {
    const trace = walk(steps, [
      'Started in terminal tab 2.',
      'No terminal tab is open.',
      'No terminal tab is open.'
    ])
    expect(trace.filter((item) => item === 'terminal_read')).toHaveLength(1)
    expect(trace.at(-1)).toContain('Écran :\nNo terminal tab is open.')
  })
})

describe('agent factice', () => {
  it('initialize annonce les capacités images et contexte intégré', async () => {
    const init = await withMockAgent({ scenario: 'demo' }, initialize)
    expect(init.agentCapabilities?.promptCapabilities?.image).toBe(true)
    expect(init.agentCapabilities?.promptCapabilities?.embeddedContext).toBe(true)
    expect(init.authMethods ?? []).toEqual([])
  })

  it('streaming-texte : plusieurs morceaux qui reconstituent le Markdown', async () => {
    const turn = await runScenario({ scenario: 'streaming-texte' })
    expect(turn.stopReason).toBe('end_turn')
    expect(ofType(turn.updates, 'agent_message_chunk').length).toBeGreaterThan(5)
    expect(agentText(turn.updates)).toContain('```ts')
  })

  it('pensee : réflexion avant la réponse', async () => {
    const turn = await runScenario({ scenario: 'pensee' })
    expect(turn.updates[0]?.sessionUpdate).toBe('agent_thought_chunk')
    expect(agentText(turn.updates)).toContain('réponse')
  })

  it('appel-outil : pending → in_progress → completed', async () => {
    const turn = await runScenario({ scenario: 'appel-outil' })
    expect(ofType(turn.updates, 'tool_call')[0]).toMatchObject({ kind: 'read', status: 'pending' })
    expect(ofType(turn.updates, 'tool_call_update').map((u) => u.status)).toEqual([
      'in_progress',
      'completed'
    ])
  })

  it('permission accordée : diff appliqué', async () => {
    const asked: string[] = []
    const turn = await runScenario({
      scenario: 'permission',
      onPermission: (req) => {
        asked.push(...req.options.map((o) => o.optionId))
        return { outcome: { outcome: 'selected', optionId: 'allow' } }
      }
    })
    expect(asked).toEqual(['allow', 'allow_always', 'reject'])
    const done = ofType(turn.updates, 'tool_call_update').at(-1)
    expect(done?.status).toBe('completed')
    expect(done?.content?.[0]).toMatchObject({ type: 'diff', path: '/projet/config.json' })
    expect(agentText(turn.updates)).toContain('mise à jour')
  })

  it('permission refusée : outil en échec, pas de diff appliqué', async () => {
    const turn = await runScenario({
      scenario: 'permission',
      onPermission: () => ({ outcome: { outcome: 'selected', optionId: 'reject' } })
    })
    expect(ofType(turn.updates, 'tool_call_update').at(-1)?.status).toBe('failed')
    expect(agentText(turn.updates)).toContain('ne modifie pas')
  })

  it('permission annulée par le client : tour annulé', async () => {
    const turn = await runScenario({ scenario: 'permission' })
    expect(turn.stopReason).toBe('cancelled')
  })

  it('diff : contenu de type diff avec ancien et nouveau texte', async () => {
    const turn = await runScenario({ scenario: 'diff' })
    const diff = ofType(turn.updates, 'tool_call_update')[0]?.content?.[0]
    expect(diff).toMatchObject({ type: 'diff' })
    expect(diff && 'newText' in diff ? diff.newText : '').toContain('db.interne')
  })

  it('conflits : la consigne de résolution réécrit README.md sans marqueurs (fiche 110)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mock-conflits-'))
    writeFileSync(
      join(dir, 'README.md'),
      '<<<<<<< HEAD\nVersion 2\n=======\nVersion 3\n>>>>>>> main\n'
    )
    const turn = await withMockAgent({ scenario: 'conflits' }, async (ctx) => {
      await initialize(ctx)
      return ctx
        .buildSession(dir)
        .withSession((session) =>
          playTurn(
            session,
            'Merging `main` into `bobine/x` left conflicts in these files:\n- README.md'
          )
        )
    })
    expect(agentText(turn.updates)).toContain('Conflit résolu')
    expect(readFileSync(join(dir, 'README.md'), 'utf8')).not.toContain('<<<<<<<')
    // Un autre message : le scénario « modifications » ordinaire.
    const other = await runScenario({ scenario: 'conflits' }, 'Fais les modifications')
    expect(agentText(other.updates)).toContain('deux fichiers modifiés')
  })

  it('plan : le plan progresse jusqu’à tout terminé', async () => {
    const turn = await runScenario({ scenario: 'plan' })
    const plans = ofType(turn.updates, 'plan')
    expect(plans).toHaveLength(4)
    expect(plans.at(-1)?.entries.every((e) => e.status === 'completed')).toBe(true)
  })

  it('sous-agent : annonce la session enfant et ses updates arrivent sur la connexion', async () => {
    const all: SessionNotification[] = []
    const turn = await runScenario({ scenario: 'sous-agent', onUpdate: (n) => all.push(n) })
    const announces = ofType(turn.updates, 'subagent_update')
    expect(announces[0]).toMatchObject({
      sessionId: 'sous-agent-exploration',
      title: 'Exploration'
    })
    expect(announces.at(-1)?.state).toMatchObject({ state: 'idle', stopReason: 'end_turn' })
    const childUpdates = all.filter((n) => n.sessionId === 'sous-agent-exploration')
    expect(childUpdates.some((n) => n.update.sessionUpdate === 'tool_call')).toBe(true)
  })

  it('echo : décrit le texte et l’image reçus', async () => {
    const turn = await runScenario({ scenario: 'echo' }, [
      { type: 'text', text: 'Regarde ça' },
      { type: 'image', mimeType: 'image/png', data: 'iVBORw0KGgo=' }
    ] as never)
    const text = agentText(turn.updates)
    expect(text).toContain('2 bloc(s)')
    expect(text).toContain('Regarde ça')
    expect(text).toContain('image/png')
  })

  it('lent : session/cancel arrête le tour avec stopReason cancelled', async () => {
    const turn = await withMockAgent({ scenario: 'lent', delayMs: 20 }, async (ctx) => {
      await initialize(ctx)
      return ctx.buildSession(CWD).withSession((session) => {
        let sent = false
        return playTurn(session, 'Vas-y', () => {
          if (sent) return
          sent = true
          void ctx.notify(methods.agent.session.cancel, { sessionId: session.sessionId })
        })
      })
    })
    expect(turn.stopReason).toBe('cancelled')
    expect(ofType(turn.updates, 'agent_message_chunk').length).toBeLessThan(20)
  })

  it('outil-en-preparation : pending {} le temps du patch, puis les emplacements, puis terminé (fiche 128)', async () => {
    const turn = await withMockAgent(
      { scenario: 'outil-en-preparation', delayMs: 10 },
      async (ctx) => {
        await initialize(ctx)
        return ctx.buildSession(CWD).withSession((session) => playTurn(session, 'Patch'))
      }
    )
    const [start] = ofType(turn.updates, 'tool_call')
    expect(start).toMatchObject({ title: 'patch', kind: 'edit', status: 'pending', rawInput: {} })
    const updates = ofType(turn.updates, 'tool_call_update')
    expect(updates.map((u) => u.status)).toEqual(['in_progress', 'completed'])
    expect(updates[0]?.locations).toEqual([{ path: `${CWD}/notes.md` }])
  })

  it('outil-en-preparation-interrompu : reste annoncé jusqu’à session/cancel', async () => {
    const turn = await withMockAgent(
      { scenario: 'outil-en-preparation-interrompu', delayMs: 10 },
      async (ctx) => {
        await initialize(ctx)
        return ctx.buildSession(CWD).withSession((session) => {
          let sent = false
          return playTurn(session, 'Patch', (update) => {
            if (sent || update.sessionUpdate !== 'tool_call') return
            sent = true
            void ctx.notify(methods.agent.session.cancel, { sessionId: session.sessionId })
          })
        })
      }
    )
    expect(turn.stopReason).toBe('cancelled')
    expect(ofType(turn.updates, 'tool_call')).toHaveLength(1)
    expect(ofType(turn.updates, 'tool_call_update')).toHaveLength(0)
  })

  it('shell-en-preparation : shell annoncé avec {cwd} seul, puis sa commande et une sortie JSON', async () => {
    const turn = await withMockAgent(
      { scenario: 'shell-en-preparation', delayMs: 10 },
      async (ctx) => {
        await initialize(ctx)
        return ctx.buildSession(CWD).withSession((session) => playTurn(session, 'Lance'))
      }
    )
    const [start] = ofType(turn.updates, 'tool_call')
    expect(start).toMatchObject({
      title: 'shell',
      kind: 'execute',
      status: 'pending',
      rawInput: { cwd: CWD }
    })
    const updates = ofType(turn.updates, 'tool_call_update')
    expect(updates[0]).toMatchObject({
      status: 'in_progress',
      rawInput: { command: 'node results.js' }
    })
    const output = updates.at(-1)?.content?.[0]
    expect(output).toMatchObject({ type: 'content', content: { type: 'text' } })
    const json =
      output?.type === 'content' && output.content.type === 'text' ? output.content.text : ''
    expect(JSON.parse(json)).toHaveLength(2)
  })

  it('erreur : le prompt échoue avec le message de l’agent', async () => {
    await expect(runScenario({ scenario: 'erreur' })).rejects.toThrow('Erreur simulée')
  })

  it('budget-depasse : « Internal error », la cause dans data.details (comme Bob)', async () => {
    await expect(runScenario({ scenario: 'budget-depasse' })).rejects.toMatchObject({
      message: expect.stringMatching(/^Internal error/),
      data: { details: expect.stringMatching(/^BudgetExceededError: \{"title":"Budget Exceeded"/) }
    })
  })

  it('refus : stopReason refusal', async () => {
    expect((await runScenario({ scenario: 'refus' })).stopReason).toBe('refusal')
  })

  it('/scenario <nom> change de scénario pour un tour', async () => {
    const turn = await runScenario({ scenario: 'demo' }, '/scenario refus')
    expect(turn.stopReason).toBe('refusal')
  })

  it('/scenario seul liste les scénarios', async () => {
    const text = agentText((await runScenario({ scenario: 'demo' }, '/scenario')).updates)
    for (const name of Object.keys(scenarios)) expect(text).toContain(name)
  })

  it('set_mode émet current_mode_update', async () => {
    const all: SessionNotification[] = []
    await withMockAgent({ scenario: 'demo', onUpdate: (n) => all.push(n) }, async (ctx) => {
      await initialize(ctx)
      const session = await ctx.buildSession(CWD).start()
      expect(session.modes?.currentModeId).toBe('code')
      await ctx.request(methods.agent.session.setMode, {
        sessionId: session.sessionId,
        modeId: 'ask'
      })
      session.dispose()
    })
    expect(all.map((n) => n.update)).toContainEqual({
      sessionUpdate: 'current_mode_update',
      currentModeId: 'ask'
    })
  })
})

describe('simulations de Bob', () => {
  it('bob-auth-requise : session/new exige authenticate', async () => {
    const result = await withMockAgent({ scenario: 'bob-auth-requise' }, async (ctx) => {
      const init = await initialize(ctx)
      expect(init.authMethods?.map((m) => m.id)).toEqual([SSO_AUTH_METHOD])

      const refused = await ctx
        .buildSession(CWD)
        .start()
        .catch((e: unknown) => e)
      expect(refused).toBeInstanceOf(RequestError)
      expect((refused as RequestError).code).toBe(RequestError.authRequired().code)

      await ctx.request(methods.agent.authenticate, { methodId: SSO_AUTH_METHOD })
      return ctx.buildSession(CWD).withSession((session) => playTurn(session, 'Bonjour'))
    })
    expect(agentText(result.updates)).toContain('Authentifié')
  })

  it('sso-sans-retour : authenticate ne répond jamais ; un agent relancé est connecté (fiche 207)', async () => {
    const launched = mkdtempSync(join(tmpdir(), 'mock-sso-'))
    const run = { scenario: 'sso-sans-retour', cwd: launched }
    const answered = await withMockAgent(run, async (ctx) => {
      await initialize(ctx)
      const waiting = ctx.request(methods.agent.authenticate, { methodId: SSO_AUTH_METHOD })
      const timeout = new Promise((resolve) => setTimeout(() => resolve('sans réponse'), 300))
      return Promise.race([waiting.then(() => 'répondu'), timeout])
    })
    expect(answered).toBe('sans réponse')
    expect(existsSync(join(launched, LOGIN_MARKER))).toBe(true)
    const result = await withMockAgent(run, async (ctx) => {
      await initialize(ctx)
      return ctx.buildSession(CWD).withSession((session) => playTurn(session, 'Bonjour'))
    })
    expect(agentText(result.updates)).toContain('Authentifié')
  })

  it('bob-workspace-non-approuve : session/new échoue avec une explication', async () => {
    const error = await withMockAgent({ scenario: 'bob-workspace-non-approuve' }, async (ctx) => {
      await initialize(ctx)
      return ctx
        .buildSession(CWD)
        .start()
        .catch((e: unknown) => e)
    })
    expect(error).toBeInstanceOf(RequestError)
    expect((error as RequestError).code).toBe(UNTRUSTED_WORKSPACE_CODE)
    expect((error as RequestError).message).toContain('--trust')
  })

  it('bob-elicitation : le formulaire accepté oriente la réponse', async () => {
    const turn = await runScenario({
      scenario: 'bob-elicitation',
      onElicitation: (req) => {
        expect(req.message).toContain('environnement')
        return { action: 'accept', content: { environnement: 'recette', confirmer: true } }
      }
    })
    expect(agentText(turn.updates)).toContain('Déploiement sur recette lancé')
  })

  it('bob-elicitation : le formulaire refusé annule le déploiement', async () => {
    const turn = await runScenario({ scenario: 'bob-elicitation' })
    expect(agentText(turn.updates)).toContain('Déploiement annulé')
  })

  it('bob-licence-formulaire : case cochée, le tour continue (Bob 2.0.9, fiche 163)', async () => {
    const turn = await runScenario({
      scenario: 'bob-licence-formulaire',
      onElicitation: (req) => {
        expect(req.message).toContain('IBM license agreement')
        return { action: 'accept', content: { accept: true } }
      }
    })
    expect(agentText(turn.updates)).toContain('Licence acceptée')
  })

  it('bob-licence-formulaire : formulaire refusé, le tour échoue en -32600 licence', async () => {
    const error = await runScenario({ scenario: 'bob-licence-formulaire' }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(RequestError)
    expect((error as RequestError).code).toBe(-32600)
    expect((error as RequestError).message).toContain('license agreement is required')
  })

  it('--mode-depart : mode de départ lu dans _meta à session/new, inconnu refusé', async () => {
    const [plan, unknown] = await withMockAgent(
      { scenario: 'streaming-texte', args: ['--mode-depart', 'bob/mode'] },
      async (ctx) => {
        await initialize(ctx)
        const open = (mode: string) =>
          ctx.request(methods.agent.session.new, {
            cwd: CWD,
            mcpServers: [],
            _meta: { 'bob/mode': mode }
          })
        return [await open('plan'), await open('agent').catch((e: unknown) => e)]
      }
    )
    expect((plan as { modes?: { currentModeId: string } }).modes?.currentModeId).toBe('plan')
    expect((unknown as RequestError).code).toBe(RequestError.invalidParams().code)
  })
})

describe('commandes « / »', () => {
  it('annoncées après session/new ; /aide liste les scénarios, /demo joue la démo', async () => {
    const all: SessionNotification[] = []
    const [aide, demo] = await withMockAgent(
      { scenario: 'streaming-texte', onUpdate: (n) => all.push(n) },
      async (ctx) => {
        await initialize(ctx)
        return ctx
          .buildSession(CWD)
          .withSession(async (session) => [
            await playTurn(session, '/aide'),
            await playTurn(session, '/demo')
          ])
      }
    )
    const announce = all.find((n) => n.update.sessionUpdate === 'available_commands_update')
    expect(announce?.update).toEqual({
      sessionUpdate: 'available_commands_update',
      availableCommands: MOCK_COMMANDS
    })
    expect(agentText(aide.updates)).toContain('Scénarios disponibles')
    expect(demo.updates.some((u) => u.sessionUpdate === 'plan')).toBe(true)
  })
})

describe('consommation', () => {
  it('chaque tour rapporte usage_update (avec coût) et usage', async () => {
    const turn = await runScenario({ scenario: 'streaming-texte' })
    const update = turn.updates.find((u) => u.sessionUpdate === 'usage_update')
    expect(update).toMatchObject({
      size: MOCK_CONTEXT_SIZE,
      cost: { amount: MOCK_TURN_COST, currency: 'USD' }
    })
  })

  it('compaction : résumé en morceaux puis contexte libéré', async () => {
    const turn = await runScenario({ scenario: 'compaction' })
    const kinds = turn.updates.map((u) => u.sessionUpdate)
    expect(kinds).toContain('compaction_summary_chunk')
    const contexts = turn.updates.flatMap((u) =>
      u.sessionUpdate === 'usage_update' ? [u.used] : []
    )
    expect(contexts[0]).toBe(3200)
    expect(contexts.at(-1)).toBeGreaterThan(3200)
  })
})

describe('formes de Claude Code', () => {
  it('questions : élicitation liée à l’appel d’outil, réponses relayées', async () => {
    const turn = await runScenario({
      scenario: 'questions',
      onElicitation: (req) => {
        expect('toolCallId' in req && req.toolCallId).toBe('call_ask')
        return {
          action: 'accept',
          content: { question_0: 'Sobre', question_0_custom: 'bleu', question_1: ['Accueil'] }
        }
      }
    })
    expect(agentText(turn.updates)).toContain('style : Sobre (bleu) ; pages : Accueil')
  })

  it('plan-a-valider : « continuer à planifier » ne change pas de mode', async () => {
    const turn = await runScenario({
      scenario: 'plan-a-valider',
      onPermission: (req) => {
        expect(req.toolCall.kind).toBe('switch_mode')
        return { outcome: { outcome: 'selected', optionId: 'reject' } }
      }
    })
    expect(agentText(turn.updates)).toContain('je continue à planifier')
    expect(turn.updates.some((u) => u.sessionUpdate === 'current_mode_update')).toBe(false)
  })

  it('plan-a-valider : plan approuvé → mode code', async () => {
    const turn = await runScenario({
      scenario: 'plan-a-valider',
      onPermission: () => ({ outcome: { outcome: 'selected', optionId: 'exit_plan_auto' } })
    })
    expect(turn.updates).toContainEqual({
      sessionUpdate: 'current_mode_update',
      currentModeId: 'code'
    })
  })
})

/** Scénarios dont le tour échoue par une erreur JSON-RPC (voulue). */
const FAILING_TURNS = new Set([
  'erreur',
  'budget-depasse',
  'bob-licence-formulaire',
  'reseau-instable',
  'reseau-coupe',
  'limite-debit'
])

describe('catalogue', () => {
  // `plantage` et `muet` ne finissent jamais leur tour : testés à part (pannes, fiche 041) ;
  // `outil-en-preparation-interrompu` attend l'interruption (fiche 128).
  const failing = new Set([
    'plantage',
    'muet',
    'outil-en-preparation-interrompu',
    // Pannes de la fiche 195 : testées par l'hôte d'agent.
    'plantage-signal',
    'plantage-segfault',
    'plantage-avec-enfant',
    // Laissent un `sleep` derrière eux : essayés par l'hôte d'agent (fiche 195, M3).
    'arriere-plan',
    'arriere-plan-detache',
    'connexion-coupee',
    // Refuse le message tant que le SSO n'est pas refait (fiche 200) : essayé par l'hôte d'agent
    // et la grille de conformité.
    'connexion-expiree-bob-tour'
  ])
  it.each(Object.entries(scenarios).filter(([name, s]) => !s.session && !failing.has(name)))(
    '%s se joue sans erreur inattendue',
    async (name) => {
      const run = runScenario({
        scenario: name,
        onPermission: (req) => ({
          outcome: { outcome: 'selected', optionId: req.options[0]?.optionId ?? '' }
        }),
        onElicitation: () => ({ action: 'accept', content: { environnement: 'dev' } })
      })
      if (FAILING_TURNS.has(name)) await expect(run).rejects.toThrow()
      else expect((await run).stopReason).toMatch(/end_turn|refusal/)
    }
  )
})

describe('scénarios aux limites (fiche 139)', () => {
  it('diff-geant : un diff de plus de 5 000 lignes', async () => {
    const turn = await runScenario({ scenario: 'diff-geant' })
    const [call] = ofType(turn.updates, 'tool_call')
    const diff = call?.content?.[0]
    expect(diff?.type).toBe('diff')
    if (diff?.type !== 'diff') return
    expect(diff.oldText?.split('\n').length).toBeGreaterThan(5000)
    expect(diff.newText).not.toBe(diff.oldText)
  })

  it('fichier-binaire : octets bruts dans la sortie et dans le diff', async () => {
    const turn = await runScenario({ scenario: 'fichier-binaire' })
    expect(JSON.stringify(turn.updates)).toContain('\\u0000')
  })

  it('sortie-1mo : 1 Mio de sortie de terminal, puis le code de sortie', async () => {
    const turn = await runScenario({ scenario: 'sortie-1mo' })
    const output = ofType(turn.updates, 'tool_call_update')
      .map((u) => {
        const delta = (u._meta as { terminal_output_delta?: { data: string } } | undefined)
          ?.terminal_output_delta
        return delta?.data ?? ''
      })
      .join('')
    expect(output.length).toBe(1024 * 1024)
    expect(ofType(turn.updates, 'tool_call_update').at(-1)).toMatchObject({ status: 'completed' })
  })

  it('commandes-en-cours : de nouvelles commandes « / » annoncées pendant le tour', async () => {
    const announced: string[][] = []
    await runScenario({
      scenario: 'commandes-en-cours',
      onUpdate: (n) => {
        if (n.update.sessionUpdate === 'available_commands_update')
          announced.push(n.update.availableCommands.map((c) => c.name))
      }
    })
    expect(announced).toHaveLength(2)
    expect(announced[1]).toContain('revue')
  })

  it('debordements : mot sans espace, code, tableau, diff, terminal, image et sous-agent', async () => {
    const { updates } = await runScenario({ scenario: 'debordements' })
    const text = agentText(updates)
    expect(text).toContain(LONG_WORD)
    expect(text).toContain('```mermaid')
    expect(text).toContain('| Colonne |')
    const tools = updates.flatMap((u) =>
      u.sessionUpdate === 'tool_call' ? [u.kind ?? 'other'] : []
    )
    expect(tools).toEqual(expect.arrayContaining(['edit', 'search', 'other', 'execute', 'think']))
  })

  it('textes-limites : emoji, droite à gauche et ligne de plus de 5 000 caractères', async () => {
    const text = agentText((await runScenario({ scenario: 'textes-limites' })).updates)
    expect(text).toContain('👩🏽‍💻')
    expect(text).toContain('مرحبا')
    expect(text).toContain('שלום')
    expect(Math.max(...text.split('\n').map((l) => l.length))).toBeGreaterThan(5000)
  })

  it('--sans-plan : aucun plan ne part, le tour passe', async () => {
    const turn = await runScenario({ scenario: 'plan', args: ['--sans-plan'] })
    expect(ofType(turn.updates, 'plan')).toEqual([])
    expect(turn.stopReason).toBe('end_turn')
  })

  it('--demarrage-lent : initialize répond après le délai', async () => {
    const started = Date.now()
    await withMockAgent({ args: ['--demarrage-lent', '300'] }, initialize)
    expect(Date.now() - started).toBeGreaterThanOrEqual(300)
  })
})

describe('pannes réseau simulées (fiche 142)', () => {
  /** Joue `times` fois le même message dans la même session : l'erreur ou le texte de chaque tour. */
  const turns = (scenario: string, times: number) =>
    withMockAgent({ scenario }, async (ctx) => {
      await initialize(ctx)
      return ctx.buildSession(CWD).withSession(async (session) => {
        const results: unknown[] = []
        for (let i = 0; i < times; i++) {
          results.push(
            await playTurn(session, 'Bonjour').then(
              (turn) => agentText(turn.updates),
              (error: unknown) => error
            )
          )
        }
        return results
      })
    })

  it('reseau-instable : deux « fetch failed », puis la réponse', async () => {
    const [first, second, third] = await turns('reseau-instable', 3)
    expect(first).toMatchObject({ data: { details: 'TypeError: fetch failed' } })
    expect(second).toMatchObject({ data: { cause: 'read ECONNRESET' } })
    expect(third).toBe('Réseau revenu : voici la réponse complète.')
  })

  it('limite-debit : 429 une fois, puis la réponse', async () => {
    const [first, second] = await turns('limite-debit', 2)
    expect(first).toMatchObject({
      message: 'Internal error: 429 Too Many Requests',
      data: { status: 429 }
    })
    expect(second).toBe('Limite levée : voici la réponse.')
  })

  it('reseau-coupe : outil en cours, puis l’erreur, la cause n’étant que sur la sortie d’erreur', async () => {
    const updates: SessionUpdate[] = []
    const error = await withMockAgent(
      { scenario: 'reseau-coupe', onUpdate: (n) => updates.push(n.update) },
      async (ctx) => {
        await initialize(ctx)
        return ctx.buildSession(CWD).withSession((session) =>
          playTurn(session, 'Bonjour').then(
            () => undefined,
            (e: unknown) => e
          )
        )
      }
    )
    expect(error).toMatchObject({ message: expect.stringMatching(/^Internal error/), code: -32603 })
    expect(ofType(updates, 'tool_call')[0]).toMatchObject({ status: 'in_progress' })
  })
})

describe('pannes simulées (fiche 041)', () => {
  it('plantage : le processus s’arrête en plein tour, sans réponse au prompt', async () => {
    await expect(runScenario({ scenario: 'plantage' })).rejects.toThrow(/connection closed/i)
  })
})

describe('historique des sessions', () => {
  const storeArgs = () => ['--store', mkdtempSync(join(tmpdir(), 'mock-store-'))]

  /** Ouvre une session, joue un tour, et renvoie son identifiant (l'agent est ensuite arrêté). */
  async function sessionWithOneTurn(args: string[], scenario = 'streaming-texte') {
    return withMockAgent({ scenario, args }, async (ctx) => {
      await initialize(ctx)
      return ctx.buildSession(CWD).withSession(async (session) => {
        await playTurn(session, 'Première question')
        return session.sessionId
      })
    })
  }

  it('annonce loadSession et list / resume / close / delete', async () => {
    const init = await withMockAgent({ args: storeArgs() }, initialize)
    expect(init.agentCapabilities?.loadSession).toBe(true)
    expect(Object.keys(init.agentCapabilities?.sessionCapabilities ?? {}).sort()).toEqual([
      'close',
      'delete',
      'list',
      'resume'
    ])
  })

  it('session/load dans un NOUVEAU processus rejoue l’échange, messages utilisateur compris', async () => {
    const args = storeArgs()
    const sessionId = await sessionWithOneTurn(args)
    const replayed: SessionNotification[] = []
    await withMockAgent({ args, onUpdate: (n) => replayed.push(n) }, async (ctx) => {
      await initialize(ctx)
      const loaded = await ctx.request(methods.agent.session.load, {
        sessionId,
        cwd: CWD,
        mcpServers: []
      })
      expect(loaded.modes?.currentModeId).toBe('code')
    })
    const updates = replayed.filter((n) => n.sessionId === sessionId).map((n) => n.update)
    expect(updates[0]).toEqual({
      sessionUpdate: 'user_message_chunk',
      content: { type: 'text', text: 'Première question' }
    })
    expect(agentText(updates)).toContain('```ts')
  })

  it('session/resume reprend sans rejeu, et on peut continuer l’échange', async () => {
    const args = storeArgs()
    const sessionId = await sessionWithOneTurn(args)
    const replayed: SessionNotification[] = []
    await withMockAgent(
      { scenario: 'refus', args, onUpdate: (n) => replayed.push(n) },
      async (ctx) => {
        await initialize(ctx)
        await ctx.request(methods.agent.session.resume, { sessionId, cwd: CWD })
        expect(replayed).toEqual([])
        const response = await ctx.request(methods.agent.session.prompt, {
          sessionId,
          prompt: [{ type: 'text', text: 'Suite' }]
        })
        expect(response.stopReason).toBe('refusal')
      }
    )
  })

  it('session/list filtre par dossier ; session/delete efface ; session inconnue refusée', async () => {
    const args = storeArgs()
    const sessionId = await sessionWithOneTurn(args)
    await withMockAgent({ args }, async (ctx) => {
      await initialize(ctx)
      const listed = await ctx.request(methods.agent.session.list, { cwd: CWD })
      expect(listed.sessions.map((s) => s.sessionId)).toEqual([sessionId])
      expect(
        (await ctx.request(methods.agent.session.list, { cwd: '/ailleurs' })).sessions
      ).toEqual([])
      await ctx.request(methods.agent.session.delete, { sessionId })
      expect((await ctx.request(methods.agent.session.list, {})).sessions).toEqual([])
      await expect(
        ctx.request(methods.agent.session.load, { sessionId, cwd: CWD, mcpServers: [] })
      ).rejects.toThrow()
    })
  })

  it('--titres : l’agent propose un titre après le premier message', async () => {
    const turn = await withMockAgent({ args: [...storeArgs(), '--titres'] }, async (ctx) => {
      await initialize(ctx)
      return ctx.buildSession(CWD).withSession((s) => playTurn(s, 'Renommer les fichiers'))
    })
    expect(turn.updates).toContainEqual({
      sessionUpdate: 'session_info_update',
      title: 'Factice : Renommer les fichiers'
    })
  })

  it('--sans-historique : aucune capacité de reprise, load refusé', async () => {
    const args = [...storeArgs(), '--sans-historique']
    const init = await withMockAgent({ args }, initialize)
    expect(init.agentCapabilities?.loadSession).toBe(false)
    expect(init.agentCapabilities?.sessionCapabilities).toEqual({})
    const sessionId = await sessionWithOneTurn(args)
    await withMockAgent({ args }, async (ctx) => {
      await initialize(ctx)
      await expect(
        ctx.request(methods.agent.session.load, { sessionId, cwd: CWD, mcpServers: [] })
      ).rejects.toThrow()
    })
  })

  it('ecriture-opencode : write comme OpenCode 2.2.5, sans diff à la fin ; le diff seulement dans l’autorisation (fiche 202)', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'mock-write-'))
    writeFileSync(join(cwd, 'README.md'), '# Projet\n\nVersion 1\n')
    const permissions: RequestPermissionRequest[] = []
    const turn = await withMockAgent(
      {
        scenario: 'ecriture-opencode',
        args: storeArgs(),
        onPermission: (request) => {
          permissions.push(request)
          return { outcome: { outcome: 'selected', optionId: 'once' } }
        }
      },
      async (ctx) => {
        await initialize(ctx)
        return ctx.buildSession(cwd).withSession((s) => playTurn(s, 'Écris'))
      }
    )
    expect(readFileSync(join(cwd, 'nouveau.txt'), 'utf8')).toBe('bonjour\n')
    expect(readFileSync(join(cwd, 'autorise.txt'), 'utf8')).toBe('accordé\n')
    const writes = ofType(turn.updates, 'tool_call_update').filter(
      (u) => u.toolCallId.startsWith('write_') && u.status === 'completed'
    )
    // Comme OpenCode 2.2.5 : un seul texte, ni diff ni `metadata.files`.
    expect(writes.map((u) => u.content)).toEqual([
      [
        {
          type: 'content',
          content: { type: 'text', text: 'Created file successfully: nouveau.txt' }
        }
      ],
      [
        {
          type: 'content',
          content: { type: 'text', text: 'Created file successfully: autorise.txt' }
        }
      ]
    ])
    expect(writes.map((u) => u.rawOutput)).toEqual([
      { metadata: { truncated: false } },
      { metadata: { truncated: false } }
    ])
    expect(permissions.map((p) => p.toolCall.content)).toEqual([
      [{ type: 'diff', path: join(cwd, 'autorise.txt'), oldText: null, newText: 'accordé\n' }]
    ])
  })

  it('patch-opencode : diffs en direct ; au rejeu, ceux des fichiers modifiés manquent, le patch reste (fiche 096)', async () => {
    const args = storeArgs()
    const cwd = mkdtempSync(join(tmpdir(), 'mock-patch-'))
    writeFileSync(join(cwd, 'README.md'), '# Projet\n\nVersion 1\n')
    const completed = (updates: SessionUpdate[]) =>
      ofType(updates, 'tool_call_update').filter((u) => u.status === 'completed')
    const diffPaths = (u: Extract<SessionUpdate, { sessionUpdate: 'tool_call_update' }>) =>
      (u.content ?? []).flatMap((c) => (c.type === 'diff' ? [c.path.slice(cwd.length + 1)] : []))
    const { sessionId, live } = await withMockAgent(
      { scenario: 'patch-opencode', args },
      async (ctx) => {
        await initialize(ctx)
        return ctx.buildSession(cwd).withSession(async (session) => {
          const turn = await playTurn(session, 'Patch')
          return { sessionId: session.sessionId, live: turn.updates }
        })
      }
    )
    expect(readFileSync(join(cwd, 'README.md'), 'utf8')).toBe('# Projet\n\nVersion 2\n')
    expect(readFileSync(join(cwd, 'notes.md'), 'utf8')).toContain('- deux\n- deux et demi\n')
    expect(ofType(live, 'tool_call').map((u) => [u.title, u.kind])).toEqual([
      ['patch', 'edit'],
      ['patch', 'edit']
    ])
    expect(completed(live).map(diffPaths)).toEqual([
      ['notes.md', 'src/calc.js'],
      ['notes.md', 'README.md']
    ])
    const files = (completed(live)[1]?.rawOutput as { metadata: { files: unknown[] } }).metadata
      .files
    expect(files).toEqual([
      expect.objectContaining({ file: 'notes.md', additions: 2, deletions: 0, status: 'modified' }),
      expect.objectContaining({ file: 'README.md', additions: 1, deletions: 1, status: 'modified' })
    ])
    expect(files[1]).toMatchObject({
      patch: expect.stringMatching(new RegExp(`^Index: ${join(cwd, 'README.md')}\\n`))
    })

    const replayed: SessionNotification[] = []
    await withMockAgent({ args, onUpdate: (n) => replayed.push(n) }, async (ctx) => {
      await initialize(ctx)
      await ctx.request(methods.agent.session.load, { sessionId, cwd, mcpServers: [] })
    })
    const again = completed(replayed.map((n) => n.update))
    // Comme OpenCode : un fichier créé garde son diff, un fichier modifié le perd.
    expect(again.map(diffPaths)).toEqual([['notes.md', 'src/calc.js'], []])
    expect(again[1]?.rawOutput).toEqual(completed(live)[1]?.rawOutput)
  })
})

describe('limite d’étapes de la session (fiche 209)', () => {
  const storeArgs = () => ['--store', mkdtempSync(join(tmpdir(), 'mock-store-'))]

  /** Ouvre une session, l'épuise (tour coupé, puis « Continue » refusé) et rend son identifiant. */
  async function exhausted(scenario: string, args: string[]) {
    return withMockAgent({ scenario, args }, async (ctx) => {
      await initialize(ctx)
      return ctx.buildSession(CWD).withSession(async (session) => {
        const first = await playTurn(session, 'Passe à PanacheEntityBase')
        expect(first.stopReason).toBe('max_turn_requests')
        // Message coupé en pleine phrase : la fin de la troisième étape n'est jamais venue.
        const text = agentText(first.updates)
        expect(text).toContain('PanacheEntityBase')
        expect(text).not.toContain('dépôts.')
        const refused = await playTurn(session, 'Continue')
        expect(refused).toEqual({ updates: [], stopReason: 'max_turn_requests' })
        return session.sessionId
      })
    })
  }

  /** Recharge la session dans un nouveau processus et demande de continuer. */
  async function continueAfterReload(scenario: string, args: string[], sessionId: string) {
    return withMockAgent({ scenario, args }, async (ctx) => {
      await initialize(ctx)
      await ctx.request(methods.agent.session.load, { sessionId, cwd: CWD, mcpServers: [] })
      const reply = await ctx.request(methods.agent.session.prompt, {
        sessionId,
        prompt: [{ type: 'text', text: 'Continue là où tu t’es arrêté.' }]
      })
      return reply.stopReason
    })
  }

  it('limite-etapes-session : refus immédiat sans mise à jour, remis à zéro par une relance puis session/load', async () => {
    const args = storeArgs()
    const sessionId = await exhausted('limite-etapes-session', args)
    expect(await continueAfterReload('limite-etapes-session', args, sessionId)).toBe('end_turn')
  })

  it('limite-etapes-session : session/load dans le MÊME processus ne remet rien à zéro (comme Bob)', async () => {
    const stop = await withMockAgent(
      { scenario: 'limite-etapes-session', args: [...storeArgs(), '--max-etapes', '2'] },
      async (ctx) => {
        await initialize(ctx)
        const { sessionId } = await ctx.request(methods.agent.session.new, {
          cwd: CWD,
          mcpServers: []
        })
        const prompt = (text: string) =>
          ctx.request(methods.agent.session.prompt, { sessionId, prompt: [{ type: 'text', text }] })
        expect((await prompt('Travaille')).stopReason).toBe('max_turn_requests')
        await ctx.request(methods.agent.session.load, { sessionId, cwd: CWD, mcpServers: [] })
        return (await prompt('Continue')).stopReason
      }
    )
    expect(stop).toBe('max_turn_requests')
  })

  it('limite-etapes-tenace : la relance ne remet pas le compte à zéro', async () => {
    const args = storeArgs()
    const sessionId = await exhausted('limite-etapes-tenace', args)
    expect(await continueAfterReload('limite-etapes-tenace', args, sessionId)).toBe(
      'max_turn_requests'
    )
  })
})
