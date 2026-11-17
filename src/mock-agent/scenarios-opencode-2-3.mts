/**
 * Sous-agents d'OpenCode 2.3.0 (relevé le 2026-11-16, `opencode acp`, modèle gratuit
 * opencode/big-pickle) : ils tournent **toujours** en arrière-plan.
 *
 * - L'outil `subagent` rend la main aussitôt : `completed`, `rawOutput.metadata: { sessionID,
 *   status: "running" }`, texte « The subagent is working in the background (sessionID: …). You
 *   will receive a <subagent> message when it goes idle… » (plus de `<subagent …>…</subagent>`).
 * - Son travail est relayé dans le flux du parent (`_meta["opencode/child-session"]`) tant qu'un
 *   tour du parent est en cours ; après la fin du tour, plus rien n'en arrive.
 * - Quand il a fini, OpenCode le rapporte au parent, qui répond **de lui-même**, hors de tout
 *   `session/prompt` : des `agent_message_chunk` sans fin de tour ni `usage_update`. Au rechargement
 *   (`session/load`), ce rapport n'est pas rejoué ; la réponse du parent l'est, en message à part.
 * - Plusieurs sous-agents tournent en même temps, chacun dans sa session.
 *
 * Les deux sous-agents qui rapportent après le tour, l'un après l'autre, assemblent deux relevés
 * (lancement en parallèle ; réponse hors tour) : le parent répond ici une fois, après le second.
 */
import type { SessionUpdate } from '../shared/acp-sdk.mts'
import type { Scenario, Step } from './scenario.mts'

/** Session du parent dans les marques `opencode/child-session` (comme `sous-agent-opencode2`). */
const PARENT = 'ses_parent'

interface Background {
  /** Suffixe des identifiants (carte `call_<id>`, session `ses_mock_<id>`). */
  id: string
  /** Description donnée par le parent : titre de la session du sous-agent. */
  description: string
  file: string
  word: string
  /** Fin de sa session, après le lancement (remplacé par `--arriere-plan-ms`). */
  afterMs: number
}

const sessionOf = (b: Background) => `ses_mock_${b.id}`
const cardOf = (b: Background) => `call_${b.id}`
const promptOf = (b: Background) => `Lis le fichier ${b.file} et rapporte le mot de code.`

/** Lancement : carte annoncée sans rien, puis avec sa consigne (comme 2.0.32). */
const launch = (b: Background): Step[] => [
  {
    kind: 'update',
    update: {
      sessionUpdate: 'tool_call',
      toolCallId: cardOf(b),
      title: 'subagent',
      kind: 'think',
      status: 'pending',
      rawInput: {}
    }
  },
  {
    kind: 'update',
    update: {
      sessionUpdate: 'tool_call_update',
      toolCallId: cardOf(b),
      title: 'subagent',
      kind: 'think',
      status: 'in_progress',
      rawInput: { agent: 'explore', description: b.description, prompt: promptOf(b) }
    }
  }
]

/** Outil rendu aussitôt : le sous-agent travaille en arrière-plan (texte de la 2.3.0). */
const returned = (b: Background): Step => ({
  kind: 'update',
  update: {
    sessionUpdate: 'tool_call_update',
    toolCallId: cardOf(b),
    status: 'completed',
    content: [
      {
        type: 'content',
        content: {
          type: 'text',
          text: `The subagent is working in the background (sessionID: ${sessionOf(b)}). You will receive a <subagent> message when it goes idle, and again after each later round of work.\nDO NOT sleep, poll, proactively check on its progress, or duplicate this subagent's work.`
        }
      }
    ],
    rawOutput: { metadata: { sessionID: sessionOf(b), status: 'running', truncated: false } }
  }
})

const readCall = (b: Background): SessionUpdate => ({
  sessionUpdate: 'tool_call',
  toolCallId: `read_${b.id}`,
  title: 'read',
  kind: 'read',
  status: 'pending',
  rawInput: { path: b.file },
  locations: [{ path: b.file }]
})

const readDone = (b: Background): SessionUpdate => ({
  sessionUpdate: 'tool_call_update',
  toolCallId: `read_${b.id}`,
  status: 'completed',
  content: [
    {
      type: 'content',
      content: {
        type: 'text',
        text: `Read file ${b.file}, lines 1-1\n1: Le mot de code est ${b.word}.`
      }
    }
  ],
  rawOutput: { metadata: { truncated: false } }
})

/**
 * Sa session telle que `session/load` la rejoue : d'abord la lecture en cours, puis, `afterMs`
 * plus tard, sa réponse. La consigne commence comme celle de la 2.3.0.
 */
const childSession = (b: Background): Step => {
  const prompt: SessionUpdate = {
    sessionUpdate: 'user_message_chunk',
    content: {
      type: 'text',
      text: `You are a subagent spawned by another session.\n${promptOf(b)}`
    }
  }
  return {
    kind: 'child-session',
    sessionId: sessionOf(b),
    history: [prompt, readCall(b)],
    later: {
      afterMs: b.afterMs,
      history: [
        prompt,
        readCall(b),
        readDone(b),
        {
          sessionUpdate: 'agent_message_chunk',
          content: { type: 'text', text: `Le mot de code de \`${b.file}\` est **${b.word}**.` }
        }
      ]
    }
  }
}

/** Son travail relayé pendant le tour du parent : la lecture, commencée, jamais finie ici. */
const relayed = (b: Background): Step => ({
  kind: 'opencode-child',
  child: { id: sessionOf(b), parentId: PARENT, title: b.description },
  steps: [{ kind: 'update', update: readCall(b) }]
})

const SECRET: Background = {
  id: 'kangourou',
  description: 'Lire secret.txt',
  file: 'secret.txt',
  word: 'KANGOUROU',
  afterMs: 4000
}

const PAIR: [Background, Background] = [
  {
    id: 'secret',
    description: 'Lire secret.txt',
    file: 'secret.txt',
    word: 'KANGOUROU',
    afterMs: 3000
  },
  { id: 'autre', description: 'Lire autre.txt', file: 'autre.txt', word: 'ZEBRE', afterMs: 5000 }
]

export const openCode23Scenarios: Record<string, Scenario> = {
  'sous-agent-arriere-plan-2-3': {
    description:
      'Comme OpenCode 2.3.0 : sous-agent toujours en arrière-plan, son travail relayé pendant le tour seulement ; 4 s après, sa session finit et le parent répond de lui-même, hors tour',
    steps: [
      ...launch(SECRET),
      childSession(SECRET),
      returned(SECRET),
      relayed(SECRET),
      {
        kind: 'text',
        text: 'J’ai lancé un sous-agent **explore** pour lire `secret.txt`. Je te transmettrai le mot de code dès que j’aurai son retour.'
      },
      {
        kind: 'after-turn',
        afterMs: SECRET.afterMs + 500,
        steps: [{ kind: 'text', text: 'Le mot de code est **KANGOUROU**.' }]
      }
    ]
  },
  'sous-agents-arriere-plan-2-3': {
    description:
      'Comme OpenCode 2.3.0 : deux sous-agents lancés ensemble en arrière-plan, chacun dans sa session ; ils finissent 3 s et 5 s après, puis le parent répond de lui-même, hors tour',
    steps: [
      ...PAIR.flatMap(launch),
      ...PAIR.map(childSession),
      ...PAIR.map(returned),
      ...PAIR.map(relayed),
      {
        kind: 'text',
        text: 'J’ai lancé deux sous-agents en parallèle, un par fichier. Je te donne les deux mots de code dès que j’ai leurs rapports.'
      },
      {
        kind: 'after-turn',
        afterMs: PAIR[1].afterMs + 500,
        steps: [
          {
            kind: 'text',
            text: 'Les deux mots de code :\n\n- `secret.txt` : **KANGOUROU**\n- `autre.txt` : **ZEBRE**'
          }
        ]
      }
    ]
  },
  'sous-agents-deux-rapports-2-3': {
    description:
      'Comme OpenCode 2.3.0 (essai réel du 2026-11-16) : deux sous-agents en arrière-plan ; le parent répond hors tour à chaque rapport, deux messages rapprochés (messageId différents, rien d’autre entre eux)',
    steps: [
      ...PAIR.flatMap(launch),
      ...PAIR.map(childSession),
      ...PAIR.map(returned),
      {
        kind: 'text',
        messageId: 'msg_lancement',
        text: 'Les deux sous-agents « explore » sont lancés en parallèle.'
      },
      {
        kind: 'after-turn',
        afterMs: PAIR[1].afterMs + 500,
        steps: [
          {
            kind: 'text',
            messageId: 'msg_premier_rapport',
            text: 'Premier mot reçu ; j’attends le rapport du second sous-agent.'
          },
          {
            kind: 'text',
            messageId: 'msg_second_rapport',
            text: '- `secret.txt` : **KANGOUROU**\n- `autre.txt` : **ZEBRE**'
          }
        ]
      }
    ]
  }
}
