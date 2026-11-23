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

/**
 * Séquence réelle de l'exploration du 2026-11-19 (fiche 255, `agents.log`, OpenCode 2.3.0 et
 * GPT-6.1 Sol, 19:37:02 → 19:38:26 UTC) : le sous-agent `explore` est lancé, son premier outil
 * relayé (« shell », jamais fini dans le tour), trois morceaux de réponse, `end_turn` en 10 s ; il
 * travaille encore 1 min 17 (ici `EXPLORE.afterMs`), puis le parent répond hors tour (446 car., en
 * deux morceaux), sans mise à jour de la carte, sans `usage_update`, sans fin de tour.
 */
const EXPLORE = {
  card: 'call_explore',
  session: 'ses_mock_explore',
  description: 'Inventaire des endpoints REST',
  prompt: 'Liste les endpoints REST du projet (méthode, chemin, classe).',
  afterMs: 4000
}

const exploreShell = (status: 'pending' | 'completed'): SessionUpdate =>
  status === 'pending'
    ? {
        sessionUpdate: 'tool_call',
        toolCallId: 'shell_explore',
        title: 'shell',
        kind: 'execute',
        status: 'pending',
        rawInput: {}
      }
    : {
        sessionUpdate: 'tool_call_update',
        toolCallId: 'shell_explore',
        status: 'completed',
        content: [
          {
            type: 'content',
            content: { type: 'text', text: 'src/main/java/fr/carnetmaison/resource/…' }
          }
        ]
      }

const exploreSteps: Step[] = [
  {
    kind: 'update',
    update: {
      sessionUpdate: 'tool_call',
      toolCallId: EXPLORE.card,
      title: 'subagent',
      kind: 'think',
      status: 'pending',
      rawInput: {}
    }
  },
  // `in_progress` deux fois, comme dans le journal (19:37:05,633 et ,648).
  ...[1, 2].map((): Step => ({
    kind: 'update',
    update: {
      sessionUpdate: 'tool_call_update',
      toolCallId: EXPLORE.card,
      title: 'subagent',
      kind: 'think',
      status: 'in_progress',
      rawInput: { agent: 'explore', description: EXPLORE.description, prompt: EXPLORE.prompt }
    }
  })),
  {
    kind: 'child-session',
    sessionId: EXPLORE.session,
    history: [
      { sessionUpdate: 'user_message_chunk', content: { type: 'text', text: EXPLORE.prompt } },
      exploreShell('pending')
    ],
    later: {
      afterMs: EXPLORE.afterMs,
      history: [
        { sessionUpdate: 'user_message_chunk', content: { type: 'text', text: EXPLORE.prompt } },
        exploreShell('pending'),
        exploreShell('completed'),
        {
          sessionUpdate: 'agent_message_chunk',
          content: {
            type: 'text',
            text: '7 endpoints REST : 4 dans EntretienResource, 3 dans AppareilResource.'
          }
        }
      ]
    }
  },
  {
    kind: 'update',
    update: {
      sessionUpdate: 'tool_call_update',
      toolCallId: EXPLORE.card,
      status: 'completed',
      content: [
        {
          type: 'content',
          content: {
            type: 'text',
            text: `The subagent is working in the background (sessionID: ${EXPLORE.session}). You will receive a <subagent> message when it goes idle, and again after each later round of work.\nDO NOT sleep, poll, proactively check on its progress, or duplicate this subagent's work.`
          }
        }
      ],
      rawOutput: { metadata: { sessionID: EXPLORE.session, status: 'running', truncated: false } }
    }
  },
  {
    kind: 'opencode-child',
    child: { id: EXPLORE.session, parentId: PARENT, title: EXPLORE.description },
    steps: [{ kind: 'update', update: exploreShell('pending') }]
  },
  {
    kind: 'text',
    text: 'J’ai lancé un sous-agent **explore** pour inventorier les endpoints REST. Je te fais le résumé dès qu’il a fini.'
  },
  {
    kind: 'after-turn',
    afterMs: EXPLORE.afterMs + 500,
    steps: [
      { kind: 'text', text: 'Résumé en 5 lignes :\n\n- 7 endpoints REST' },
      {
        kind: 'text',
        text: ', 4 pour les entretiens et 3 pour les appareils.\n- Validation par Bean Validation.\n- Erreurs en 400 avec le détail des champs.\n- Pas d’authentification.\n- Tests REST par Testcontainers.'
      }
    ]
  }
]

/**
 * OpenCode 2.3.0 qui ne joint pas son modèle (relevé du 2026-11-23, proxy injoignable
 * `HTTPS_PROXY=http://proxy.exem21ple.test:3128`, `opencode/big-pickle`) : aucune erreur au tour,
 * il réessaie sans fin (2, 4, 7, 16, 26 s, puis toutes les 30 s) en n'envoyant que des
 * `session_info_update` : `_meta["opencode/retry"]` à `null`, puis la tentative suivante, son heure
 * et l'erreur (`provider.transport`, « Can't reach opencode.ai… »). Ici une tentative toutes les
 * 10 pauses (0,4 s au délai par défaut), pendant 10 min au plus, jusqu'à l'annulation.
 */
const RETRY_FOREVER: Step[] = Array.from({ length: 1500 }, (_, i): Step[] => [
  {
    kind: 'update',
    update: { sessionUpdate: 'session_info_update', _meta: { 'opencode/retry': null } }
  },
  {
    kind: 'update',
    update: {
      sessionUpdate: 'session_info_update',
      _meta: {
        'opencode/retry': {
          attempt: i + 2,
          nextRetryAt: '2026-11-23T14:13:39.979Z',
          error: {
            type: 'provider.transport',
            message:
              "Can't reach opencode.ai. Check the network connection. (getaddrinfo ENOTFOUND proxy.exem21ple.test)"
          }
        }
      }
    }
  },
  { kind: 'pause', ticks: 10 }
]).flat()

export const openCode23Scenarios: Record<string, Scenario> = {
  'reseau-injoignable-2-3': {
    description:
      'OpenCode 2.3.0 sans accès à son modèle (proxy injoignable) : réessaie sans fin, mises à jour d’état seules, jamais de contenu ni d’erreur',
    steps: RETRY_FOREVER
  },
  'sous-agent-hors-tour-explo-2-3': {
    description:
      'Séquence réelle d’OpenCode 2.3.0 (exploration du 2026-11-19, fiche 255) : sous-agent explore en arrière-plan, tour fini en quelques secondes, puis sa fin et la réponse du parent hors tour, en deux morceaux',
    // Un autre message pendant que le sous-agent travaille (19:41:36 dans le journal) : réponse
    // courte, dans son propre tour.
    steps: [
      {
        kind: 'when-prompt',
        includes: 'où en est',
        then: [
          { kind: 'text', text: 'Le sous-agent travaille encore ; je te résume dès qu’il a fini.' }
        ],
        else: exploreSteps
      }
    ]
  },
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
