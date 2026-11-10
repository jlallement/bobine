/**
 * Catalogue des scénarios de l'agent factice.
 * Pour en ajouter un : une entrée ici + un test dans mock-agent.test.ts + une ligne dans
 * docs/mock-agent.md.
 */
import type { PermissionOption, SessionUpdate, ToolCallUpdate } from '../shared/acp-sdk.mts'
import {
  BOB_EXPIRED_LOGIN,
  BOB_LICENSE_FORM_MESSAGE,
  LICENSE_MESSAGE,
  type Scenario,
  type Step
} from './scenario.mts'
import { childScenarios } from './scenarios-filles.mts'
import { reviewScenarios } from './scenarios-relecture.mts'
import { memoryScenarios } from './scenarios-memoire.mts'
import { limitScenarios } from './scenarios-limites.mts'
import { commandScenarios } from './scenarios-commandes.mts'
import { overflowScenarios } from './scenarios-debordements.mts'
import { failureScenarios } from './scenarios-pannes.mts'
import { turnGuardScenarios } from './scenarios-pendant-tour.mts'

/** Réponse avec des diagrammes (fiche 063). */
const MERMAID = [
  'Voici l’architecture :',
  '',
  '```mermaid',
  'flowchart LR',
  '  UI[Interface] -->|IPC| Main[Processus principal]',
  '  Main -->|ACP| Agent[Agent]',
  '  Main -->|MCP| Outils[Outils de l’app]',
  '```',
  '',
  'Et l’échange d’un message :',
  '',
  '```mermaid',
  'sequenceDiagram',
  '  participant U as Utilisateur',
  '  participant A as Agent',
  '  U->>A: session/prompt',
  '  A-->>U: session/update (texte)',
  '  A-->>U: fin du tour',
  '```',
  '',
  'Celui-ci est faux :',
  '',
  '```mermaid',
  'flowchart LR',
  '  A -->',
  '```'
].join('\n')

const MARKDOWN = `Voici un exemple de réponse **en Markdown**, avec une liste :

1. un premier point ;
2. un second point avec du \`code inline\`.

\`\`\`ts
export function hello(name: string): string {
  return \`Bonjour \${name}\`
}
\`\`\`

Et un tableau :

| Colonne | Valeur |
|---|---|
| a | 1 |
| b | 2 |
`

const PLAN = `## Plan : page de contact

1. Créer \`src/pages/contact.tsx\` avec un formulaire (nom, e-mail, message).
2. Ajouter la route \`/contact\` dans \`src/router.ts\`.
3. Écrire un test du formulaire.
`

/** Scénario `modifications` : de vrais fichiers du dossier de la session (fiche 021). */
const MODIFICATIONS: Step[] = [
  { kind: 'text', text: 'Je mets à jour le README et j’ajoute un point d’entrée. ' },
  { kind: 'edit-file', path: 'README.md', edit: { from: 'Version 1', to: 'Version 2' } },
  {
    kind: 'edit-file',
    path: 'src/app.js',
    content: "export function main() {\n  console.log('bonjour')\n}\n",
    // Comme Bob 2.0.6 : un fichier créé arrive avec un ancien texte vide.
    emptyOldText: true
  },
  {
    kind: 'edit-file',
    path: 'README.md',
    edit: { from: '## Utilisation', to: '## Utilisation\n\nLancer `node src/app.js`.' }
  },
  { kind: 'text', text: 'C’est fait : deux fichiers modifiés.' }
]

/** Commande au format de l'extension de terminal (`_meta.terminal_*`), sortie en plusieurs morceaux. */
function terminalCommand(id: string, command: string, chunks: string[], exitCode: number): Step[] {
  return [
    {
      kind: 'update',
      update: {
        sessionUpdate: 'tool_call',
        toolCallId: id,
        title: command,
        kind: 'execute',
        status: 'in_progress',
        content: [{ type: 'terminal', terminalId: id }],
        rawInput: { command },
        _meta: { terminal_info: { terminal_id: id } }
      }
    },
    ...chunks.flatMap((data): Step[] => [
      { kind: 'pause', ticks: 2 },
      {
        kind: 'update',
        update: {
          sessionUpdate: 'tool_call_update',
          toolCallId: id,
          _meta: { terminal_output_delta: { terminal_id: id, data } }
        }
      }
    ]),
    {
      kind: 'update',
      update: {
        sessionUpdate: 'tool_call_update',
        toolCallId: id,
        status: exitCode === 0 ? 'completed' : 'failed',
        _meta: { terminal_exit: { terminal_id: id, exit_code: exitCode, signal: null } }
      }
    }
  ]
}

/** Connexion refusée comme Bob 2.0.9 tant que le SSO n'est pas refait, puis la réponse. */
const BOB_EXPIRED_STEPS: Step[] = [
  { kind: 'login-required', error: BOB_EXPIRED_LOGIN },
  { kind: 'text', text: 'Reconnecté, je peux répondre.' }
]

const readFile: Step[] = [
  {
    kind: 'update',
    update: {
      sessionUpdate: 'tool_call',
      toolCallId: 'call_read',
      title: 'Lecture de README.md',
      kind: 'read',
      status: 'pending',
      locations: [{ path: '/projet/README.md' }],
      rawInput: { path: '/projet/README.md' }
    }
  },
  { kind: 'pause', ticks: 2 },
  {
    kind: 'update',
    update: { sessionUpdate: 'tool_call_update', toolCallId: 'call_read', status: 'in_progress' }
  },
  { kind: 'pause', ticks: 2 },
  {
    kind: 'update',
    update: {
      sessionUpdate: 'tool_call_update',
      toolCallId: 'call_read',
      status: 'completed',
      content: [
        {
          type: 'content',
          content: { type: 'text', text: '# Mon projet\n\nUn projet d’exemple.' }
        }
      ]
    }
  }
]

const CONFIG_OLD = '{\n  "database": {\n    "host": "localhost"\n  }\n}\n'
const CONFIG_NEW = '{\n  "database": {\n    "host": "db.interne"\n  }\n}\n'

/** Notes créées par le « patch » d'OpenCode (fiche 096) : assez longues pour deux blocs de patch. */
const OPENCODE_NOTES = `# Notes\n\n${['un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze'].map((n) => `- ${n}\n`).join('')}`

const editConfigCompleted: Step = {
  kind: 'update',
  update: {
    sessionUpdate: 'tool_call_update',
    toolCallId: 'call_edit',
    status: 'completed',
    content: [
      { type: 'diff', path: '/projet/config.json', oldText: CONFIG_OLD, newText: CONFIG_NEW }
    ]
  }
}

/** Plan du scénario `plan-fichier` (fiche 040), avant et après les remarques. */
const PLAN_V1 = `# Plan — ajout de goodbye()

## Étapes

1. Ajouter \`goodbye()\` dans \`src/goodbye.js\`, sur le modèle de \`hello()\`.
2. Écrire un test avec un script Node maison.
3. Documenter la fonction dans le README.
`
const PLAN_V2 = `# Plan — ajout de goodbye()

## Étapes

1. Ajouter \`goodbye()\` dans \`src/goodbye.js\`, sur le modèle de \`hello()\`.
2. Écrire un test avec Vitest.
3. Documenter la fonction dans le README, avec un exemple d’utilisation.
`

const editConfigWithPermission: Step[] = [
  {
    kind: 'update',
    update: {
      sessionUpdate: 'tool_call',
      toolCallId: 'call_edit',
      title: 'Modification de config.json',
      kind: 'edit',
      status: 'pending',
      locations: [{ path: '/projet/config.json' }],
      content: [
        { type: 'diff', path: '/projet/config.json', oldText: CONFIG_OLD, newText: CONFIG_NEW }
      ]
    }
  },
  {
    kind: 'permission',
    toolCall: { toolCallId: 'call_edit', title: 'Modification de config.json', kind: 'edit' },
    options: [
      { optionId: 'allow', name: 'Autoriser', kind: 'allow_once' },
      { optionId: 'allow_always', name: 'Toujours autoriser', kind: 'allow_always' },
      { optionId: 'reject', name: 'Refuser', kind: 'reject_once' }
    ],
    branches: {
      allow: [editConfigCompleted, { kind: 'text', text: 'Configuration mise à jour.' }],
      allow_always: [editConfigCompleted, { kind: 'text', text: 'Configuration mise à jour.' }],
      reject: [
        {
          kind: 'update',
          update: { sessionUpdate: 'tool_call_update', toolCallId: 'call_edit', status: 'failed' }
        },
        { kind: 'text', text: 'Entendu, je ne modifie pas la configuration.' }
      ]
    }
  }
]

const plan = (statuses: ('pending' | 'in_progress' | 'completed')[]): Step => ({
  kind: 'update',
  update: {
    sessionUpdate: 'plan',
    entries: ['Analyser le projet', 'Modifier la configuration', 'Vérifier le résultat'].map(
      (content, i) => ({ content, priority: 'medium', status: statuses[i] ?? 'pending' })
    )
  }
})

/** Durée d'un outil « en préparation » (fiche 128) : 3 s au délai de base de 40 ms. */
const PREPARING_TICKS = 75

/** Consigne du sous-agent de Bob, aussi titre de sa ligne dans la base de Bob (fiche 053). */
const BOB_SUBAGENT_TASK = 'Read notes.txt and summarize it in one sentence.'

/** Deux sous-agents de Bob lancés ensemble (fiche 117) : leurs consignes, titres de leurs lignes. */
const BOB_PARALLEL_TASKS = [
  'List the files of the src folder.',
  'Find the TODO comments in the project.'
] as const

/** Un `spawn_subagent` de Bob (format relevé sur Bob 2.0.6, fiche 010). */
const bobSpawn = (toolCallId: string, task: string): Step => ({
  kind: 'update',
  update: {
    sessionUpdate: 'tool_call',
    toolCallId,
    title: `Running subagent: ${task}`,
    kind: 'other',
    status: 'pending',
    rawInput: { description: task, name: 'explore' }
  }
})

const toolStatus = (
  toolCallId: string,
  status: 'in_progress' | 'completed' | 'failed',
  result?: string
): Step => ({
  kind: 'update',
  update: {
    sessionUpdate: 'tool_call_update',
    toolCallId,
    status,
    ...(result ? { content: [{ type: 'content', content: { type: 'text', text: result } }] } : {})
  }
})

const BOB_ALLOW = [
  { optionId: 'allow', name: 'Allow once', kind: 'allow_once' },
  { optionId: 'reject', name: 'Reject', kind: 'reject_once' }
] as const

/** Session du sous-agent d'OpenCode, telle que `session/load` la rejoue (relevé le 2026-10-14). */
/** Rapport final d'un sous-agent lancé en arrière-plan (scénario `sous-agent-arriere-plan`). */
const BACKGROUND_REPORT: SessionUpdate = {
  sessionUpdate: 'agent_message_chunk',
  content: { type: 'text', text: 'Il manque la **date** de la sieste de Gribouille.' }
}

const OPENCODE_CHILD_HISTORY: SessionUpdate[] = [
  {
    sessionUpdate: 'user_message_chunk',
    content: {
      type: 'text',
      text: 'Read the file notes.txt in this folder, then summarize it in exactly one sentence.'
    }
  },
  {
    sessionUpdate: 'tool_call',
    toolCallId: 'call_read_notes',
    title: 'notes.txt',
    kind: 'read',
    status: 'pending',
    locations: [{ path: 'notes.txt' }],
    rawInput: { filePath: 'notes.txt' }
  },
  {
    sessionUpdate: 'tool_call_update',
    toolCallId: 'call_read_notes',
    status: 'completed',
    content: [
      {
        type: 'content',
        content: { type: 'text', text: 'Le chat Gribouille aime dormir au soleil.' }
      }
    ]
  },
  {
    sessionUpdate: 'agent_message_chunk',
    content: {
      type: 'text',
      text: 'Le fichier présente le chat **Gribouille**, qui aime dormir au soleil.'
    }
  }
]

const CHILD = 'sous-agent-exploration'

/**
 * Appels d'outils MCP enchaînés : les arguments de chaque appel peuvent dépendre des résultats
 * précédents (ex. une référence `ref_N` trouvée dans la page).
 */
/** Adresse des pages d'essai du navigateur (servies par la suite e2e). */
const browserBase = () => process.env['MOCK_BROWSER_URL'] ?? 'http://127.0.0.1:9/'
/** Point `[x, y]` dans la réponse d'un outil ; `[0, 0]` sans navigateur (essais du catalogue). */
const pointIn = (text?: string): number[] => {
  const match = /\[(\d+),\s*(\d+)\]/.exec(text ?? '')
  return match ? [Number(match[1]), Number(match[2])] : [0, 0]
}
/** Centre du bouton `#cible` de la page « vue », en pixels CSS (fiche 129). */
const TARGET_CENTER =
  "(() => { const r = document.getElementById('cible').getBoundingClientRect(); return JSON.stringify([Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)]) })()"

const toolChain = (
  calls: { tool: string; args: (results: string[]) => Record<string, unknown> }[],
  done: (results: string[]) => Step[],
  results: string[] = []
): Step[] => {
  const [first, ...rest] = calls
  if (!first) return done(results)
  return [
    {
      kind: 'mcp-tool',
      tool: first.tool,
      args: first.args(results),
      onResult: (text) => toolChain(rest, done, [...results, text])
    }
  ]
}

/**
 * Appel d'outil MCP répété, une courte pause entre deux appels, jusqu'à ce que `settled` accepte
 * la réponse ou que `timeoutMs` soit écoulé depuis la première : comme un agent qui relit un état
 * en cours (ex. une requête réseau pas encore terminée). La dernière réponse va à `then`.
 */
export const pollTool = (
  call: { tool: string; args: Record<string, unknown> },
  settled: (text: string) => boolean,
  then: (text: string) => Step[],
  timeoutMs = 10_000
): Step[] => {
  const attempt = (deadline?: number): Step[] => [
    {
      kind: 'mcp-tool',
      tool: call.tool,
      args: call.args,
      onResult: (text) => {
        // L'échéance part de la première réponse : les étapes sont construites au chargement.
        const end = deadline ?? Date.now() + timeoutMs
        if (settled(text) || Date.now() >= end) return then(text)
        return [{ kind: 'pause', ticks: 2 }, ...attempt(end)]
      }
    }
  ]
  return attempt()
}

/**
 * Journal réseau (`browser_network`) encore en attente : aucune requête, ou une requête sans statut
 * (« … »). Toute autre réponse (statut, échec, outil absent ou refusé) met fin à l'attente.
 */
export const networkPending = (text: string) =>
  text === 'Aucune requête.' || /^\S+ {2}[A-Z]+ … /m.test(text)

/** Une fille proposée (`start_child`) ; la décision de l'utilisateur est dite dans le fil. */
const proposeChild = (title: string): Step => ({
  kind: 'mcp-tool',
  tool: 'start_child',
  args: { title, prompt: 'Consigne de test.\n/scenario streaming-texte' },
  onResult: (text) => [{ kind: 'text', text: `\n\n${title} : ${text}` }]
})

/** `chantiers` (fiche 118) : les deux filles proposées, puis la fin du tour. */
const proposeChantiers = (why: string): Step[] =>
  toolChain(
    [
      {
        tool: 'start_child',
        args: () => ({
          title: 'Fenêtre À propos',
          prompt: 'Consigne de test.\n/scenario streaming-texte'
        })
      },
      {
        tool: 'start_child',
        args: () => ({
          title: 'Essais plus courts',
          prompt: 'Consigne de test.\n/scenario streaming-texte'
        })
      }
    ],
    (results) => [
      {
        kind: 'text',
        text: `Deux chantiers indépendants (${why}) : je les ai proposés en conversations filles.\n\n${results.map((r) => `- ${r}`).join('\n')}`
      }
    ]
  )

const refIn = (text: string | undefined) => /ref_\d+/.exec(text ?? '')?.[0] ?? 'ref_absente'

/**
 * Long fil (fiche 047) : 30 étapes de 10 outils terminés (lectures, recherches, commandes), comme
 * une longue session de Bob, pour mesurer le rendu d'un fil chargé.
 */
function longThread(): Step[] {
  const kinds = ['read', 'search', 'execute'] as const
  return Array.from({ length: 30 }, (_, step): Step[] => [
    { kind: 'text', text: `Étape ${step + 1} : je continue. ` },
    ...Array.from({ length: 10 }, (_, i): Step => {
      const kind = kinds[(step + i) % kinds.length] ?? 'read'
      const n = step * 10 + i + 1
      return {
        kind: 'update',
        update: {
          sessionUpdate: 'tool_call',
          toolCallId: `call_long_${n}`,
          // Titres et `rawInput` comme OpenCode 2 (fiche 107) : le nom nu de l'outil, la commande.
          title: kind === 'read' ? 'read' : kind === 'search' ? 'grep' : `npm test -- module-${n}`,
          kind,
          status: 'completed',
          locations: kind === 'read' ? [{ path: `{cwd}/src/module-${n}.ts` }] : [],
          rawInput:
            kind === 'read'
              ? { filePath: `{cwd}/src/module-${n}.ts` }
              : kind === 'search'
                ? { pattern: `fonction${n}`, path: '{cwd}/src' }
                : { command: `npm test -- module-${n}`, description: 'Tests du module' },
          content: [
            {
              type: 'content',
              content: { type: 'text', text: `Résultat ${n}\n${'ligne de sortie\n'.repeat(20)}` }
            }
          ]
        }
      }
    })
  ]).flat()
}

/**
 * Sous-agent lancé en arrière-plan, comme OpenCode 2.0.32 (fiche 122) : son outil rend la main
 * aussitôt ; sa session finit `afterMs` plus tard, après le tour.
 */
const backgroundSubagent = (afterMs: number, id = 'fond'): Step[] => [
  {
    kind: 'update',
    update: {
      sessionUpdate: 'tool_call',
      toolCallId: `call_${id}`,
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
      toolCallId: `call_${id}`,
      title: 'subagent',
      kind: 'think',
      status: 'in_progress',
      rawInput: {
        agent: 'general',
        description: 'Audit de notes.txt',
        prompt: 'Relis notes.txt et dis ce qui manque, sans rien modifier.'
      }
    }
  },
  // Sa session : d'abord une lecture en cours, puis, `afterMs` plus tard, son rapport.
  {
    kind: 'child-session',
    sessionId: `ses_mock_${id}`,
    history: OPENCODE_CHILD_HISTORY.slice(0, 2),
    later: {
      afterMs,
      history: [...OPENCODE_CHILD_HISTORY.slice(0, 3), BACKGROUND_REPORT]
    }
  },
  {
    kind: 'update',
    update: {
      sessionUpdate: 'tool_call_update',
      toolCallId: `call_${id}`,
      status: 'completed',
      content: [
        {
          type: 'content',
          content: {
            type: 'text',
            text: `The subagent is working in the background (sessionID: ses_mock_${id}). You will be notified automatically when it finishes.`
          }
        }
      ],
      rawOutput: {
        metadata: { sessionID: `ses_mock_${id}`, status: 'running', truncated: false }
      }
    }
  },
  { kind: 'text', text: 'Le sous-agent relit notes.txt en arrière-plan.' }
]

export const scenarios: Record<string, Scenario> = {
  'streaming-texte': {
    description: 'Réponse Markdown (liste, code, tableau) envoyée en streaming',
    steps: [{ kind: 'text', text: MARKDOWN }]
  },
  mermaid: {
    description: 'Diagrammes Mermaid (fiche 063) : organigramme, séquence, puis un bloc invalide',
    steps: [{ kind: 'text', text: MERMAID }]
  },
  pensee: {
    description: 'Réflexion (agent_thought_chunk) puis réponse',
    steps: [
      { kind: 'thought', text: 'L’utilisateur veut un exemple. Je vais répondre simplement.' },
      { kind: 'text', text: 'Voici ma réponse après réflexion.' }
    ]
  },
  'appel-outil': {
    description: 'Appel d’outil de lecture : pending → in_progress → completed',
    steps: [
      { kind: 'text', text: 'Je lis le README. ' },
      ...readFile,
      { kind: 'text', text: 'C’est un projet d’exemple.' }
    ]
  },
  permission: {
    description: 'Modification de fichier soumise à permission (autoriser / toujours / refuser)',
    steps: [
      { kind: 'text', text: 'Je dois modifier la configuration. ' },
      ...editConfigWithPermission
    ]
  },
  diff: {
    description: 'Modification de fichier avec diff, sans permission',
    steps: [
      {
        kind: 'update',
        update: {
          sessionUpdate: 'tool_call',
          toolCallId: 'call_edit',
          title: 'Modification de config.json',
          kind: 'edit',
          status: 'in_progress',
          locations: [{ path: '/projet/config.json' }]
        }
      },
      editConfigCompleted,
      { kind: 'text', text: 'Fichier modifié.' }
    ]
  },
  plan: {
    description: 'Plan en trois étapes qui progresse',
    steps: [
      plan(['in_progress']),
      { kind: 'pause', ticks: 3 },
      plan(['completed', 'in_progress']),
      { kind: 'pause', ticks: 3 },
      plan(['completed', 'completed', 'in_progress']),
      { kind: 'pause', ticks: 3 },
      plan(['completed', 'completed', 'completed']),
      { kind: 'text', text: 'Plan terminé.' }
    ]
  },
  'sous-agent': {
    description: 'Un sous-agent (session enfant) explore le code pendant que le parent attend',
    steps: [
      { kind: 'text', text: 'Je délègue l’exploration à un sous-agent. ' },
      {
        kind: 'update',
        update: {
          sessionUpdate: 'subagent_update',
          sessionId: CHILD,
          title: 'Exploration',
          description: 'Explore la structure du projet',
          state: { state: 'running' }
        }
      },
      {
        kind: 'child',
        sessionId: CHILD,
        steps: [...readFile, { kind: 'text', text: 'Structure analysée.' }]
      },
      {
        kind: 'update',
        update: {
          sessionUpdate: 'subagent_update',
          sessionId: CHILD,
          state: { state: 'idle', stopReason: 'end_turn' }
        }
      },
      { kind: 'text', text: 'Le sous-agent a terminé : le projet est simple.' }
    ]
  },
  'sous-agent-bob': {
    description:
      'Comme Bob 2.0.6 : spawn_subagent demande une autorisation, puis seul le résultat arrive',
    steps: [
      {
        kind: 'update',
        update: {
          sessionUpdate: 'tool_call',
          toolCallId: 'subagent_1',
          title: `Running subagent: ${BOB_SUBAGENT_TASK}`,
          kind: 'other',
          status: 'pending',
          rawInput: {
            description: BOB_SUBAGENT_TASK,
            name: 'explore'
          }
        }
      },
      {
        kind: 'permission',
        toolCall: { toolCallId: 'subagent_1' },
        options: [
          { optionId: 'allow', name: 'Allow once', kind: 'allow_once' },
          { optionId: 'reject', name: 'Reject', kind: 'reject_once' }
        ],
        branches: {
          allow: [
            {
              kind: 'update',
              update: {
                sessionUpdate: 'tool_call_update',
                toolCallId: 'subagent_1',
                status: 'in_progress'
              }
            },
            // Base de Bob (`--bob-db`) : ligne du sous-agent, coût réécrit à chaque dépense.
            { kind: 'bob-subagent', id: 'mock_subagent_1', title: BOB_SUBAGENT_TASK },
            { kind: 'pause', ticks: 10 },
            { kind: 'bob-subagent', id: 'mock_subagent_1', cost: 0.0021 },
            { kind: 'pause', ticks: 70 },
            { kind: 'bob-subagent', id: 'mock_subagent_1', cost: 0.0058, done: true },
            {
              kind: 'update',
              update: {
                sessionUpdate: 'tool_call_update',
                toolCallId: 'subagent_1',
                status: 'completed',
                content: [
                  {
                    type: 'content',
                    content: {
                      type: 'text',
                      text: '<task_result>\nThe folder tests **Bobine** sub-agents; the cat Gribouille likes to sleep in the sun.\n</task_result>'
                    }
                  }
                ]
              }
            },
            { kind: 'text', text: 'Le sous-agent a lu le fichier : il parle du chat Gribouille.' }
          ],
          reject: [
            {
              kind: 'update',
              update: {
                sessionUpdate: 'tool_call_update',
                toolCallId: 'subagent_1',
                status: 'failed'
              }
            },
            { kind: 'text', text: 'Je lis le fichier moi-même.' }
          ]
        }
      }
    ]
  },
  'sous-agents-paralleles': {
    description:
      'Deux sous-agents de Bob lancés ensemble : deux autorisations, coûts dans la base de Bob, fins décalées',
    steps: [
      { kind: 'text', text: 'Je lance deux sous-agents en parallèle. ' },
      bobSpawn('subagent_a', BOB_PARALLEL_TASKS[0]),
      bobSpawn('subagent_b', BOB_PARALLEL_TASKS[1]),
      {
        kind: 'permission',
        toolCall: { toolCallId: 'subagent_a' },
        options: [...BOB_ALLOW],
        branches: {
          allow: [
            toolStatus('subagent_a', 'in_progress'),
            { kind: 'bob-subagent', id: 'mock_subagent_a', title: BOB_PARALLEL_TASKS[0] },
            {
              kind: 'permission',
              toolCall: { toolCallId: 'subagent_b' },
              options: [...BOB_ALLOW],
              branches: {
                allow: [
                  toolStatus('subagent_b', 'in_progress'),
                  { kind: 'bob-subagent', id: 'mock_subagent_b', title: BOB_PARALLEL_TASKS[1] },
                  { kind: 'pause', ticks: 10 },
                  { kind: 'bob-subagent', id: 'mock_subagent_a', cost: 0.0021 },
                  { kind: 'bob-subagent', id: 'mock_subagent_b', cost: 0.0012 },
                  { kind: 'pause', ticks: 60 },
                  { kind: 'bob-subagent', id: 'mock_subagent_a', cost: 0.0041, done: true },
                  toolStatus(
                    'subagent_a',
                    'completed',
                    '<task_result>\nThe src folder holds **three** files: main.ts, app.ts and util.ts.\n</task_result>'
                  ),
                  { kind: 'pause', ticks: 40 },
                  { kind: 'bob-subagent', id: 'mock_subagent_b', cost: 0.0037, done: true },
                  toolStatus(
                    'subagent_b',
                    'completed',
                    '<task_result>\nTwo TODO comments, both in app.ts.\n</task_result>'
                  ),
                  { kind: 'text', text: 'Trois fichiers dans src, deux TODO dans app.ts.' }
                ],
                reject: [
                  toolStatus('subagent_b', 'failed'),
                  { kind: 'pause', ticks: 20 },
                  { kind: 'bob-subagent', id: 'mock_subagent_a', cost: 0.0041, done: true },
                  toolStatus(
                    'subagent_a',
                    'completed',
                    '<task_result>\nThe src folder holds three files.\n</task_result>'
                  ),
                  { kind: 'text', text: 'Je cherche les TODO moi-même.' }
                ]
              }
            }
          ],
          reject: [
            toolStatus('subagent_a', 'failed'),
            toolStatus('subagent_b', 'failed'),
            { kind: 'text', text: 'Je fais les deux recherches moi-même.' }
          ]
        }
      }
    ]
  },
  'sous-agent-opencode': {
    description:
      'Comme OpenCode 1.19 : outil task (kind think), rawInput.subagent_type, résultat <task>',
    steps: [
      {
        kind: 'update',
        update: {
          sessionUpdate: 'tool_call',
          toolCallId: 'call_task',
          title: 'task',
          kind: 'think',
          status: 'pending',
          rawInput: {}
        }
      },
      {
        kind: 'update',
        update: {
          sessionUpdate: 'tool_call_update',
          toolCallId: 'call_task',
          title: 'Read and summarize notes.txt',
          kind: 'think',
          status: 'in_progress',
          rawInput: {
            description: 'Read and summarize notes.txt',
            prompt:
              'Read the file notes.txt in this folder, then summarize it in exactly one sentence.',
            subagent_type: 'general'
          }
        }
      },
      { kind: 'pause', ticks: 10 },
      // Session du sous-agent, rechargeable par `session/load` (OpenCode 1.19, fiche 053).
      { kind: 'child-session', sessionId: 'ses_mock_enfant', history: OPENCODE_CHILD_HISTORY },
      {
        kind: 'update',
        update: {
          sessionUpdate: 'tool_call_update',
          toolCallId: 'call_task',
          status: 'completed',
          content: [
            {
              type: 'content',
              content: {
                type: 'text',
                text: '<task id="ses_mock_enfant" state="completed">\n<task_result>\nLe fichier présente le chat **Gribouille**, qui aime dormir au soleil.\n</task_result>\n</task>'
              }
            }
          ]
        }
      },
      { kind: 'text', text: 'Résumé : le fichier parle du chat Gribouille.' }
    ]
  },
  'sous-agent-opencode2': {
    description:
      'Comme OpenCode 2.0.31 : outil subagent, travail du sous-agent relayé (_meta opencode/child-session), résultat <subagent>',
    steps: [
      {
        kind: 'update',
        update: {
          sessionUpdate: 'tool_call',
          toolCallId: 'call_sub',
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
          toolCallId: 'call_sub',
          title: 'subagent',
          kind: 'think',
          status: 'in_progress',
          rawInput: {
            agent: 'explore',
            description: 'Lire notes.txt et résumer',
            prompt: 'Lis le fichier notes.txt de ce dossier, puis résume-le en une phrase.'
          }
        }
      },
      {
        kind: 'opencode-child',
        child: {
          id: 'ses_mock_enfant2',
          parentId: 'ses_parent',
          title: 'Lire notes.txt et résumer'
        },
        steps: [
          { kind: 'thought', text: 'Je cherche notes.txt, puis je le lis.' },
          {
            kind: 'update',
            update: {
              sessionUpdate: 'tool_call',
              toolCallId: 'call_glob',
              title: 'glob',
              kind: 'search',
              status: 'pending',
              rawInput: {}
            }
          },
          {
            kind: 'update',
            update: {
              sessionUpdate: 'tool_call_update',
              toolCallId: 'call_glob',
              title: 'glob',
              kind: 'search',
              status: 'in_progress',
              rawInput: { pattern: '**/notes.txt' }
            }
          },
          { kind: 'pause', ticks: 5 },
          {
            kind: 'update',
            update: {
              sessionUpdate: 'tool_call_update',
              toolCallId: 'call_glob',
              status: 'completed',
              content: [{ type: 'content', content: { type: 'text', text: 'notes.txt' } }],
              rawOutput: { metadata: { count: 1, truncated: false } }
            }
          },
          {
            kind: 'update',
            update: {
              sessionUpdate: 'tool_call',
              toolCallId: 'call_read',
              title: 'read',
              kind: 'read',
              status: 'pending',
              rawInput: {}
            }
          },
          {
            kind: 'update',
            update: {
              sessionUpdate: 'tool_call_update',
              toolCallId: 'call_read',
              title: 'read',
              kind: 'read',
              status: 'in_progress',
              locations: [{ path: 'notes.txt' }],
              rawInput: { path: 'notes.txt' }
            }
          },
          { kind: 'pause', ticks: 5 },
          {
            kind: 'update',
            update: {
              sessionUpdate: 'tool_call_update',
              toolCallId: 'call_read',
              status: 'completed',
              content: [
                {
                  type: 'content',
                  content: {
                    type: 'text',
                    text: 'Read file notes.txt, lines 1-1\n1: Le chat Gribouille aime dormir au soleil.'
                  }
                }
              ],
              rawOutput: { metadata: { truncated: false } }
            }
          },
          {
            kind: 'text',
            text: 'Le fichier présente le chat **Gribouille**, qui aime dormir au soleil.'
          }
        ]
      },
      // Session du sous-agent, rechargeable par `session/load` (OpenCode 2 aussi, fiche 078).
      { kind: 'child-session', sessionId: 'ses_mock_enfant2', history: OPENCODE_CHILD_HISTORY },
      {
        kind: 'update',
        update: {
          sessionUpdate: 'tool_call_update',
          toolCallId: 'call_sub',
          status: 'completed',
          content: [
            {
              type: 'content',
              content: {
                type: 'text',
                text: '<subagent sessionID="ses_mock_enfant2" state="completed">\nLe fichier présente le chat **Gribouille**, qui aime dormir au soleil.\n</subagent>'
              }
            }
          ],
          rawOutput: {
            metadata: { sessionID: 'ses_mock_enfant2', status: 'completed', truncated: false }
          }
        }
      },
      { kind: 'text', text: 'Résumé : le fichier parle du chat Gribouille.' }
    ]
  },
  'sous-agent-arriere-plan': {
    description:
      'Comme OpenCode 2.0.32 : sous-agent lancé en arrière-plan, outil rendu aussitôt (metadata.status "running") ; sa session finit 4 s plus tard, après le tour (fiche 122)',
    steps: backgroundSubagent(4000)
  },
  'sous-agent-arriere-plan-lent': {
    description:
      'Comme sous-agent-arriere-plan, mais sa session finit 12 s plus tard : le temps d’envoyer un autre message avant sa fin (D25, fiche 127)',
    steps: backgroundSubagent(12_000, 'fond_lent')
  },
  'question-opencode2': {
    description:
      'Comme OpenCode 2.0.31 : outil question → élicitation (q0 et q0_custom), réponse renvoyée au modèle',
    steps: [
      {
        kind: 'update',
        update: {
          sessionUpdate: 'tool_call',
          toolCallId: 'call_question',
          title: 'question',
          kind: 'other',
          status: 'pending',
          rawInput: {}
        }
      },
      {
        kind: 'update',
        update: {
          sessionUpdate: 'tool_call_update',
          toolCallId: 'call_question',
          title: 'question',
          kind: 'other',
          status: 'in_progress',
          rawInput: {
            questions: [
              {
                question: 'Quel langage préfères-tu ?',
                header: 'Langage préféré',
                options: [
                  { label: 'TypeScript', description: 'JavaScript typé, idéal pour le web' },
                  { label: 'Rust', description: 'Système, performance et sécurité mémoire' },
                  { label: 'Go', description: 'Simplicité et concurrence' }
                ]
              }
            ]
          }
        }
      },
      {
        kind: 'elicitation',
        toolCallId: 'call_question',
        message: 'Questions',
        // Forme exacte relevée sur OpenCode 2.0.31 (`packages/cli/src/acp/elicitation.ts`).
        schema: {
          type: 'object',
          properties: {
            q0: {
              type: 'string',
              title: 'Langage préféré',
              description: 'Quel langage préfères-tu ?',
              oneOf: [
                {
                  const: 'TypeScript',
                  title: 'TypeScript',
                  description: 'JavaScript typé, idéal pour le web'
                },
                {
                  const: 'Rust',
                  title: 'Rust',
                  description: 'Système, performance et sécurité mémoire'
                },
                { const: 'Go', title: 'Go', description: 'Simplicité et concurrence' }
              ]
            },
            q0_custom: {
              type: 'string',
              title: 'Langage préféré (other)',
              description: 'Type your own answer'
            }
          },
          required: []
        } as never,
        onAccept: (content) => [
          {
            kind: 'update',
            update: {
              sessionUpdate: 'tool_call_update',
              toolCallId: 'call_question',
              status: 'completed',
              content: [
                {
                  type: 'content',
                  content: {
                    type: 'text',
                    text: `User has answered your questions: "Quel langage préfères-tu ?"="${String(content['q0_custom'] ?? content['q0'] ?? '')}". You can now continue with the user's answers in mind.`
                  }
                }
              ]
            }
          },
          {
            kind: 'text',
            text: `Langage choisi : ${String(content['q0_custom'] ?? content['q0'] ?? '—')}.`
          }
        ],
        onDecline: [{ kind: 'text', text: 'Pas de réponse : je continue avec TypeScript.' }]
      }
    ]
  },
  tableaux: {
    description: 'Tableaux Markdown : alignements, puis un tableau large (beaucoup de colonnes)',
    steps: [
      {
        kind: 'text',
        text: [
          'Voici le récapitulatif des fichiers modifiés :',
          '',
          '| Fichier | Lignes | Statut | Rôle |',
          '|:--------|-------:|:------:|:-----|',
          '| `src/main/index.ts` | 42 | ✅ | Démarrage de l’app |',
          '| `src/renderer/App.tsx` | 128 | ⚠️ | Interface principale |',
          '| `README.md` | 7 | ✅ | Documentation |',
          '',
          'Et la comparaison détaillée des options :',
          '',
          '| Option | Description | Avantages | Inconvénients | Coût estimé | Délai | Risque | Recommandation |',
          '|---|---|---|---|---|---|---|---|',
          '| A — refonte complète | Réécrire le module de synchronisation en partant de zéro avec une nouvelle architecture | Code propre, testable, documenté | Long, risque de régressions | 12 jours | 3 semaines | Élevé | Non |',
          '| B — correctifs ciblés | Corriger les trois bugs identifiés sans toucher à la structure | Rapide, peu risqué | Dette technique conservée | 2 jours | 1 semaine | Faible | Oui, à court terme |',
          '',
          'Je recommande l’option B.'
        ].join('\n')
      }
    ]
  },
  echo: {
    description: 'Décrit le contenu reçu (texte, images, fichiers)',
    steps: [{ kind: 'echo' }]
  },
  'contexte-recu': {
    description:
      'Décrit le contexte caché reçu avant le message : échange repris après une bascule d’agent (fiche 108) ou une branche (fiche 023)',
    steps: [{ kind: 'context' }]
  },
  dossiers: {
    description:
      'Dit le dossier de travail et les autres dossiers reçus à l’ouverture de la session (`additionalDirectories`, avec `--dossiers-en-plus`, fiche 179), et la ligne de contexte de l’app sur ces dossiers si le message en a une',
    steps: [{ kind: 'folders' }]
  },
  aparte: {
    description:
      'Question en aparté (fiche 180) : décrit la consigne, le fil joint ou non et le mode ; joué d’office pour un aparté',
    steps: [{ kind: 'aside' }]
  },
  'lien-html': {
    description: 'Réponse avec un lien vers une page HTML du dossier (site/index.html, fiche 064)',
    steps: [{ kind: 'text', text: 'La page est prête : [ouvrir la page](site/index.html).' }]
  },
  'liens-fichiers': {
    description:
      'Réponse avec des liens vers des fichiers du dossier (plan.md, code, exécutable, dossier) et un lien web (fiche 052)',
    steps: [
      {
        kind: 'text',
        text:
          'J’ai préparé [le plan](plan.md) ; le point d’entrée est [src/app.ts:3](src/app.ts:3).\n\n' +
          'Le script [outil.command](outil.command) est prêt, la documentation est dans [docs](docs).\n\n' +
          'Voir aussi [la page du projet](https://example.com).'
      }
    ]
  },
  'liens-web': {
    description:
      'Réponse avec une adresse locale (http://localhost:3000, navigateur intégré) et une adresse du web (navigateur du Mac) (fiche 154)',
    steps: [
      {
        kind: 'text',
        text:
          'L’app tourne sur [localhost](http://localhost:3000/essai), la doc est sur ' +
          '[example.org](http://example.org/doc).'
      }
    ]
  },
  'mise-en-forme': {
    description:
      'Réponse très mise en forme, comme celles de Bob : titres, traits, citation, listes, émojis (fiche 070)',
    steps: [
      {
        kind: 'text',
        text: [
          'Voici un long message pour toi :',
          '',
          '---',
          '',
          '# 🌍 Un voyage à travers les idées',
          '',
          'Il y a quelque chose de fascinant dans le fait de s’asseoir devant un écran blanc et de se demander : *par où commencer ?* Le début est toujours le moment le plus **vertigineux**.',
          '',
          '---',
          '',
          '## 🔭 Sur la curiosité',
          '',
          'La curiosité est peut-être la qualité la plus sous-estimée. Elle avance doucement, d’une question vers une autre.',
          '',
          '> Ne pas savoir n’est pas une faiblesse : c’est le point de départ.',
          '',
          '### Trois habitudes',
          '',
          '1. Poser une question de plus que nécessaire.',
          '2. Lire le code avant de le juger :',
          '   - commencer par les tests ;',
          '   - puis `src/main/index.ts`.',
          '3. Noter ce qu’on a appris.',
          '',
          '- [x] Relire la fiche',
          '- [ ] Lancer `pnpm e2e`',
          '',
          '#### Pour aller plus loin',
          '',
          'Un dernier mot, en **gras** et en *italique*, avec un [lien](https://example.com).'
        ].join('\n')
      }
    ]
  },
  'code-colore': {
    description:
      'Blocs de code colorés : TypeScript, JSON, HTML, shell et diff, pour la coloration syntaxique (fiche 134)',
    steps: [
      {
        kind: 'text',
        text: [
          'Voici quelques blocs de code :',
          '',
          '```ts',
          '// Lit la configuration, avec une valeur par défaut.',
          "import { readFile } from 'node:fs/promises'",
          '',
          'interface Config {',
          '  port: number',
          '  name: string',
          '}',
          '',
          'export async function load(path: string): Promise<Config> {',
          "  const text = await readFile(path, 'utf8')",
          '  const config = JSON.parse(text) as Partial<Config>',
          "  return { port: config.port ?? 8080, name: config.name ?? 'bobine' }",
          '}',
          '```',
          '',
          '```json',
          '{ "port": 3000, "debug": true, "tags": ["a", "b"] }',
          '```',
          '',
          '```html',
          '<button class="primary" disabled>Envoyer</button>',
          '```',
          '',
          '```bash',
          '# Lance les essais',
          'pnpm test --run && echo "ok: $?"',
          '```',
          '',
          '```diff',
          '- const port = 8080',
          '+ const port = Number(process.env.PORT ?? 8080)',
          '```'
        ].join('\n')
      }
    ]
  },
  'fil-long': {
    description:
      'Long fil : 300 appels d’outils terminés en 30 étapes (mesure du rendu, fiche 047)',
    steps: [...longThread(), { kind: 'text', text: 'Terminé.' }]
  },
  lent: {
    description: 'Longue réponse lente, pour tester le bouton Stop',
    steps: [{ kind: 'text', text: 'Je réfléchis longuement… '.repeat(200) }]
  },
  'attend-stop': {
    description: 'Commence à répondre puis attend Stop : seule l’annulation finit le tour',
    steps: [
      { kind: 'text', text: 'Je réfléchis longuement… '.repeat(20) },
      // L'annulation du tour coupe cette pause : pas de course avec la fin de la réponse.
      { kind: 'pause', ticks: 100_000 }
    ]
  },
  erreur: {
    description: 'Commence à répondre puis échoue avec une erreur interne',
    steps: [
      { kind: 'text', text: 'Je commence… ' },
      { kind: 'fail', message: 'Erreur simulée par l’agent factice' }
    ]
  },
  'reseau-instable': {
    description:
      'Panne réseau passagère (fiche 142) : « fetch failed » deux fois (cause ECONNRESET), puis répond',
    steps: [
      {
        kind: 'flaky',
        failures: 2,
        fail: {
          kind: 'fail',
          data: { details: 'TypeError: fetch failed', cause: 'read ECONNRESET' }
        },
        then: [{ kind: 'text', text: 'Réseau revenu : voici la réponse complète.' }]
      }
    ]
  },
  'reseau-coupe': {
    description:
      'Réseau coupé en plein flux (fiches 139, 142) : texte et lecture en cours, puis, sans pause, chaque tentative échoue, « getaddrinfo ENOTFOUND » sur la sortie d’erreur seulement ; le processus reste vivant',
    steps: [
      { kind: 'text', text: 'Je regarde le dépôt avant de répondre… ' },
      {
        kind: 'update',
        update: {
          sessionUpdate: 'tool_call',
          toolCallId: 'call_net_read',
          title: 'read',
          kind: 'read',
          status: 'in_progress',
          locations: [{ path: '{cwd}/README.md' }],
          rawInput: { path: '{cwd}/README.md' }
        }
      },
      {
        kind: 'update',
        update: {
          sessionUpdate: 'tool_call_update',
          toolCallId: 'call_net_read',
          content: [{ type: 'content', content: { type: 'text', text: '# Projet' } }]
        }
      },
      // Coupure : l'outil en cours et l'erreur partent ensemble, sans pause.
      { kind: 'fail', stderr: 'Error: getaddrinfo ENOTFOUND api.modele.example' }
    ]
  },
  'limite-debit': {
    description: 'Limite de débit (fiche 142) : « 429 Too Many Requests » une fois, puis répond',
    steps: [
      {
        kind: 'flaky',
        failures: 1,
        fail: { kind: 'fail', message: '429 Too Many Requests', data: { status: 429 } },
        then: [{ kind: 'text', text: 'Limite levée : voici la réponse.' }]
      }
    ]
  },
  'budget-depasse': {
    description:
      'Échoue comme Bob quand le budget de bobcoins est épuisé (cause dans data.details)',
    steps: [
      {
        kind: 'fail',
        data: {
          details: `BudgetExceededError: ${JSON.stringify({
            title: 'Budget Exceeded',
            description:
              'Oh no! It looks like you’ve gone over your budget allowance of 50 Bobcoins.'
          })}`
        }
      }
    ]
  },
  'titres-bob': {
    description:
      'Titres bruts comme Bob 2.0.6 : « Applying diff to <chemin absolu> », « cd <dossier> && npm test », « Updating todo list » (fiche 125)',
    steps: bobRawTitles()
  },
  'liste-taches': {
    description:
      'Comme Bob 2.0.6 : chaque mise à jour de la liste de tâches demande une autorisation (« Updating todo list »)',
    steps: [
      {
        kind: 'permission',
        toolCall: {
          toolCallId: 'todo_1',
          title: 'Updating todo list',
          kind: 'other',
          status: 'pending'
        },
        options: [
          { optionId: 'allow', name: 'Allow once', kind: 'allow_once' },
          { optionId: 'always', name: 'Always allow', kind: 'allow_always' },
          { optionId: 'reject', name: 'Reject', kind: 'reject_once' }
        ],
        branches: Object.fromEntries([
          [
            'reject',
            [
              {
                kind: 'update',
                update: {
                  sessionUpdate: 'tool_call_update',
                  toolCallId: 'todo_1',
                  status: 'failed'
                }
              },
              { kind: 'text', text: 'Je continue sans liste de tâches.' }
            ] as Step[]
          ],
          ...['allow', 'always'].map((id) => [
            id,
            [
              {
                kind: 'update',
                update: {
                  sessionUpdate: 'tool_call_update',
                  toolCallId: 'todo_1',
                  status: 'completed'
                }
              },
              {
                kind: 'update',
                update: {
                  sessionUpdate: 'plan',
                  entries: [
                    { content: 'Préparer', priority: 'medium', status: 'completed' },
                    { content: 'Terminer', priority: 'medium', status: 'in_progress' }
                  ]
                }
              },
              { kind: 'text', text: 'Liste de tâches à jour.' }
            ] as Step[]
          ])
        ]) as Record<string, Step[]>
      }
    ]
  },
  plantage: {
    description: 'Commence un outil puis le processus s’arrête net (plantage en plein tour)',
    steps: [
      { kind: 'text', text: 'Je lance la commande… ' },
      {
        kind: 'update',
        update: {
          sessionUpdate: 'tool_call',
          toolCallId: 'call_crash',
          title: 'Compiler le projet',
          kind: 'execute',
          status: 'in_progress'
        }
      },
      { kind: 'pause', ticks: 2 },
      { kind: 'crash', code: 3, stderr: 'panic: plantage simulé par l’agent factice' }
    ]
  },
  muet: {
    description: 'Commence à répondre puis ne répond plus, même à Stop (agent figé)',
    steps: [{ kind: 'hang', text: 'Je commence… ' }]
  },
  bavard: {
    description: 'Écrit une ligne de journal sur stdout (hors protocole) puis répond normalement',
    steps: [
      { kind: 'stdout-noise', text: '[info] journal écrit au mauvais endroit' },
      { kind: 'text', text: 'Réponse malgré le bruit.' }
    ]
  },
  refus: {
    description: 'Le modèle refuse de répondre (stopReason: refusal)',
    steps: [{ kind: 'text', text: 'Je ne peux pas faire ça.' }],
    stopReason: 'refusal'
  },
  'bob-auth-requise': {
    description: 'Bob sans clé API : authenticate (SSO simulé) requis avant session/new',
    session: { requireAuth: true },
    steps: [{ kind: 'text', text: 'Authentifié, je peux travailler.' }]
  },
  'sso-sans-retour': {
    description:
      'Comme bob-auth-requise, mais authenticate ne répond jamais (SSO fini dans le navigateur, rien ne revient) ; un agent relancé est connecté (fiche 207)',
    session: { requireAuth: true, ssoNeverAnswers: true },
    steps: [{ kind: 'text', text: 'Authentifié, je peux travailler.' }]
  },
  'bob-workspace-non-approuve': {
    description:
      'Bob refuse un dossier non approuvé (approbation : --trust ou fichier .mock-agent-trusted)',
    session: { untrustedWorkspace: true },
    steps: [{ kind: 'text', text: 'Dossier approuvé, je peux travailler.' }]
  },
  'bob-licence-requise': {
    description:
      'Bob dont la licence IBM n’est pas acceptée (-32600) ; acceptée : fichier .mock-agent-license',
    session: { requireLicense: true },
    steps: [{ kind: 'text', text: 'Licence acceptée, je peux travailler.' }]
  },
  'bob-licence-formulaire': {
    description:
      'Bob 2.0.9 : licence demandée au message par un formulaire (case à cocher) ; refusée : -32600',
    steps: [
      {
        kind: 'elicitation',
        message: BOB_LICENSE_FORM_MESSAGE,
        schema: {
          type: 'object',
          properties: {
            accept: { type: 'boolean', title: 'I accept the IBM license agreement' }
          },
          required: ['accept']
        },
        onAccept: (content) =>
          content['accept'] === true
            ? [{ kind: 'text', text: 'Licence acceptée, je peux travailler.' }]
            : [{ kind: 'fail', code: -32600, message: `Invalid request: ${LICENSE_MESSAGE}` }],
        onDecline: [{ kind: 'fail', code: -32600, message: `Invalid request: ${LICENSE_MESSAGE}` }]
      }
    ]
  },
  'premier-essai': {
    description:
      'Message d’essai du premier lancement (fiche 188) : répond d’un mot, coût annoncé en fin de tour',
    steps: [{ kind: 'text', text: 'OK' }]
  },
  'premier-essai-outil': {
    description:
      'Message d’essai du premier lancement (fiche 188) : demande tout de suite un outil, que l’essai doit refuser',
    steps: [
      {
        kind: 'permission',
        toolCall: { toolCallId: 'call_essai', title: 'Écriture de essai.txt', kind: 'edit' },
        options: [
          { optionId: 'allow', name: 'Autoriser', kind: 'allow_once' },
          { optionId: 'reject', name: 'Refuser', kind: 'reject_once' }
        ],
        branches: {
          allow: [{ kind: 'text', text: 'ESSAI-OUTIL-AUTORISE' }],
          reject: [{ kind: 'text', text: 'Entendu.' }]
        }
      }
    ]
  },
  'connexion-terminal': {
    description:
      'Connexion à faire dans un terminal, comme opencode-login (authenticate ne fait rien)',
    session: { terminalLogin: true },
    steps: [{ kind: 'text', text: 'Connecté depuis le terminal, je peux travailler.' }]
  },
  'connexion-expiree': {
    description:
      'Connexion expirée en cours de conversation, comme OpenCode 2.2.5 : la session s’ouvre, le message est refusé (authRequired) tant que la connexion n’est pas refaite dans un terminal',
    session: { expiredLogin: 'terminal' },
    steps: [{ kind: 'login-required' }, { kind: 'text', text: 'Reconnecté, je peux répondre.' }]
  },
  'connexion-expiree-outil': {
    description:
      'Comme connexion-expiree, mais le refus arrive après un appel d’outil (lecture du README) : le tour avait commencé',
    session: { expiredLogin: 'terminal' },
    steps: [
      { kind: 'text', text: 'Je lis le README. ' },
      ...readFile,
      { kind: 'login-required' },
      { kind: 'text', text: 'Reconnecté, je peux répondre.' }
    ]
  },
  'connexion-expiree-sso': {
    description:
      'Comme connexion-expiree, mais la connexion se refait par SSO (authenticate, comme Bob) : rien de documenté chez Bob, essais seulement',
    session: { expiredLogin: 'sso' },
    steps: [{ kind: 'login-required' }, { kind: 'text', text: 'Reconnecté, je peux répondre.' }]
  },
  'connexion-expiree-bob': {
    description:
      'Comme connexion-expiree-sso, avec l’erreur exacte de Bob 2.0.9 (sonde, fiche 200) : -32603 « Internal error », data.details « ApiKeyError: … Invalid or expired API key. »',
    session: { expiredLogin: 'sso' },
    steps: BOB_EXPIRED_STEPS
  },
  'connexion-expiree-bob-tour': {
    description:
      'Comme connexion-expiree-bob, à choisir en cours de conversation (`/scenario`) : avec `--sso`, la méthode SSO est annoncée dès le lancement (grille de conformité, fiche 200)',
    steps: BOB_EXPIRED_STEPS
  },
  'connexion-expiree-echo': {
    description:
      'Comme connexion-expiree, puis décrit le message reçu (ce que l’app renvoie et joint après la reconnexion)',
    session: { expiredLogin: 'terminal' },
    steps: [{ kind: 'login-required' }, { kind: 'echo' }]
  },
  'connexion-expiree-rouverture': {
    description:
      'Comme connexion-expiree, mais la réouverture de la session (session/load) est refusée elle aussi tant que la connexion n’est pas refaite',
    session: { expiredLogin: 'terminal', reopenNeedsLogin: true },
    steps: [{ kind: 'login-required' }, { kind: 'text', text: 'Reconnecté, je peux répondre.' }]
  },
  'connexion-expiree-modele': {
    description:
      'Modèle d’un fournisseur non connecté (fiche 210, comme OpenCode 2.2.5) : avec factice-rapide (modèle par défaut), le message est refusé (-32000 « provider authentication required ») tant que la connexion n’est pas refaite ; factice-precis répond',
    session: { expiredLogin: 'terminal' },
    steps: [
      {
        kind: 'when-model',
        model: 'factice-rapide',
        then: [{ kind: 'login-required' }, { kind: 'text', text: 'Reconnecté, je peux répondre.' }],
        else: [{ kind: 'text', text: 'Ce modèle est connecté, je peux répondre.' }]
      }
    ]
  },
  'connexion-expiree-modele-aucun': {
    description:
      'Comme connexion-expiree-modele, mais aucun modèle ne répond tant que la connexion n’est pas refaite : changer de modèle ramène la carte, avec le nouveau modèle',
    session: { expiredLogin: 'terminal' },
    steps: [{ kind: 'login-required' }, { kind: 'text', text: 'Reconnecté, je peux répondre.' }]
  },
  'connexion-expiree-autre': {
    description:
      'Refus -32000 au message, sans indice de connexion dans le texte : erreur de tour ordinaire, pas de carte de connexion',
    session: { expiredLogin: 'terminal' },
    steps: [{ kind: 'fail', code: -32000, message: 'Quota exceeded for this workspace' }]
  },
  'bob-premiere-connexion': {
    description: 'Premier lancement de Bob : dossier à approuver, PUIS connexion SSO (ordre réel)',
    session: { untrustedWorkspace: true, requireAuth: true },
    steps: [{ kind: 'text', text: 'Dossier approuvé et connecté : je peux travailler.' }]
  },
  questions: {
    description:
      'Questions à choix (comme AskUserQuestion de Claude Code) : choix unique, multiple, « Autre »',
    steps: [
      {
        kind: 'update',
        update: {
          sessionUpdate: 'tool_call',
          toolCallId: 'call_ask',
          title: 'AskUserQuestion',
          kind: 'other',
          status: 'pending'
        }
      },
      {
        kind: 'elicitation',
        toolCallId: 'call_ask',
        message: 'Please answer the following questions.',
        // Forme produite par claude-agent-acp 0.89.1 (askUserQuestionsToCreateRequest), sans ses
        // aperçus en `_meta` (plus lus, fiche 140).
        schema: {
          type: 'object',
          properties: {
            question_0: {
              type: 'string',
              title: 'Style',
              description: 'Quel style pour la page d’accueil ?',
              oneOf: [
                {
                  const: 'Sobre',
                  title: 'Sobre',
                  description: 'Peu de couleurs, beaucoup d’espace'
                },
                {
                  const: 'Coloré',
                  title: 'Coloré',
                  description: 'Couleurs vives, illustrations'
                }
              ]
            },
            question_0_custom: {
              type: 'string',
              title: 'Other',
              description:
                'Type your own answer, or add a note to the option you chose above (optional).'
            },
            question_1: {
              type: 'array',
              title: 'Pages',
              description: 'Quelles pages faut-il créer ?',
              items: {
                anyOf: [
                  { const: 'Accueil', title: 'Accueil' },
                  { const: 'Tarifs', title: 'Tarifs', description: 'Grille des offres' },
                  { const: 'Contact', title: 'Contact' }
                ]
              }
            },
            question_1_custom: {
              type: 'string',
              title: 'Other',
              description: 'Type your own answer to add to your selection above (optional).'
            }
          }
        } as never,
        onAccept: (content) => [
          {
            kind: 'update',
            update: {
              sessionUpdate: 'tool_call_update',
              toolCallId: 'call_ask',
              status: 'completed'
            }
          },
          {
            kind: 'text',
            text: `Réponses reçues — style : ${String(content['question_0'] ?? content['question_0_custom'] ?? '—')}${
              content['question_0'] && content['question_0_custom']
                ? ` (${String(content['question_0_custom'])})`
                : ''
            } ; pages : ${
              [
                ...((content['question_1'] as string[] | undefined) ?? []),
                ...(content['question_1_custom'] ? [String(content['question_1_custom'])] : [])
              ].join(', ') || '—'
            }.`
          }
        ],
        onDecline: [
          {
            kind: 'update',
            update: {
              sessionUpdate: 'tool_call_update',
              toolCallId: 'call_ask',
              status: 'completed'
            }
          },
          { kind: 'text', text: 'Questions passées : je choisis moi-même.' }
        ]
      }
    ]
  },
  'plan-a-valider': {
    description:
      'Fin du mode plan (comme ExitPlanMode de Claude Code) : plan à valider ou à reprendre',
    steps: [
      { kind: 'thought', text: 'Le plan est prêt, je demande la validation.' },
      {
        kind: 'update',
        update: {
          sessionUpdate: 'tool_call',
          toolCallId: 'call_plan',
          title: 'Ready to code?',
          kind: 'switch_mode',
          status: 'pending',
          content: [{ type: 'content', content: { type: 'text', text: PLAN } }]
        }
      },
      {
        kind: 'permission',
        toolCall: {
          toolCallId: 'call_plan',
          title: 'Ready to code?',
          kind: 'switch_mode',
          content: [{ type: 'content', content: { type: 'text', text: PLAN } }]
        },
        // Options proposées par claude-agent-acp 0.89.1 (buildExitPlanModePermissionOptions).
        options: [
          { optionId: 'exit_plan_auto', name: 'Yes, and use auto mode', kind: 'allow_always' },
          {
            optionId: 'exit_plan_default',
            name: 'Yes, manually approve edits',
            kind: 'allow_once'
          },
          { optionId: 'reject', name: 'No, keep planning', kind: 'reject_once' }
        ],
        branches: {
          exit_plan_auto: [
            {
              kind: 'update',
              update: { sessionUpdate: 'current_mode_update', currentModeId: 'code' }
            },
            { kind: 'text', text: 'Plan approuvé : je passe à l’action.' }
          ],
          exit_plan_default: [
            {
              kind: 'update',
              update: { sessionUpdate: 'current_mode_update', currentModeId: 'code' }
            },
            { kind: 'text', text: 'Plan approuvé : je demanderai avant chaque modification.' }
          ],
          reject: [
            { kind: 'text', text: 'D’accord, je continue à planifier. Que faut-il changer ?' }
          ]
        }
      }
    ]
  },
  'question-plan': {
    description:
      'Question obligatoire (format générique), puis plan à valider dans rawInput.plan (fiche 140)',
    steps: [
      {
        kind: 'elicitation',
        toolCallId: 'call_input',
        message: 'The agent needs your input to continue.',
        // Ancienne forme de codex-acp 2.2.2 (2026-10-11) ramenée au format générique : question
        // dans `description`, en-tête dans `title`, « Autre » en `<clé>_custom` (fiche 140).
        schema: {
          type: 'object',
          properties: {
            shell: {
              title: 'Shell',
              description: 'Which shell should hello.sh use?',
              type: 'string',
              oneOf: [
                {
                  const: 'bash (Recommended)',
                  title: 'bash (Recommended)',
                  description: 'Use a Bash shebang.'
                },
                { const: 'zsh', title: 'zsh', description: 'Use a Zsh shebang.' },
                {
                  const: 'None of the above',
                  title: 'None of the above',
                  description: 'Provide a different answer in the note field.'
                }
              ]
            },
            shell_custom: {
              type: 'string',
              title: 'Additional answer or note'
            }
          },
          required: ['shell']
        } as never,
        onAccept: (content) => [
          { kind: 'text', text: `Shell retenu : ${String(content['shell'])}. ` },
          {
            kind: 'permission',
            toolCall: {
              toolCallId: 'plan-review:1-plan',
              kind: 'switch_mode',
              status: 'pending',
              title: 'Implement this plan?',
              rawInput: {
                plan: '1. Créer `hello.sh` (Bash).\n2. Vérifier que `bash hello.sh` affiche « Hello ».\n'
              }
            },
            options: [
              { optionId: 'implement_plan', name: 'Yes, implement this plan', kind: 'allow_once' },
              {
                optionId: 'revise_plan',
                name: 'No, and tell the agent what to do differently',
                kind: 'reject_once'
              }
            ],
            branches: {
              implement_plan: [{ kind: 'text', text: 'Je mets le plan en œuvre.' }],
              revise_plan: [{ kind: 'text', text: 'Que faut-il changer ?' }]
            }
          }
        ],
        onDecline: [{ kind: 'text', text: 'Question passée.' }]
      }
    ]
  },
  compaction: {
    description: 'L’agent résume la conversation pour libérer du contexte (compaction_update)',
    steps: [
      { kind: 'text', text: 'La conversation devient longue : je la résume. ' },
      {
        kind: 'update',
        update: {
          sessionUpdate: 'compaction_update',
          compactionId: 'compact-1',
          status: 'in_progress'
        }
      },
      { kind: 'pause', ticks: 3 },
      {
        kind: 'update',
        update: {
          sessionUpdate: 'compaction_summary_chunk',
          compactionId: 'compact-1',
          content: { type: 'text', text: 'L’utilisateur construit une page de contact ; ' }
        }
      },
      {
        kind: 'update',
        update: {
          sessionUpdate: 'compaction_summary_chunk',
          compactionId: 'compact-1',
          content: { type: 'text', text: 'le formulaire et la route sont faits.' }
        }
      },
      {
        kind: 'update',
        update: {
          sessionUpdate: 'compaction_update',
          compactionId: 'compact-1',
          status: 'completed'
        }
      },
      { kind: 'update', update: { sessionUpdate: 'usage_update', used: 3200, size: 200_000 } },
      { kind: 'text', text: 'Résumé terminé : contexte libéré.' }
    ]
  },
  'compaction-texte': {
    description: 'Résumé de la conversation envoyé en texte, sans compaction_update (comme Bob)',
    steps: [
      { kind: 'text', text: 'Compressing context…\n\n' },
      {
        kind: 'text',
        text: '## État\n- Page de contact faite\n- Reste : les tests du formulaire'
      }
    ]
  },
  'contexte-plein': {
    description: 'Le contexte est presque plein (jauge en alerte)',
    steps: [
      { kind: 'update', update: { sessionUpdate: 'usage_update', used: 190_000, size: 200_000 } },
      { kind: 'text', text: 'Attention : le contexte est presque plein.' }
    ]
  },
  'question-bob': {
    description:
      'Bob pose une question avec l’outil ask_user fourni par l’app (serveur MCP), puis utilise la réponse',
    steps: [
      { kind: 'text', text: 'Il me faut une précision. ' },
      {
        kind: 'ask-user',
        args: {
          question: 'Quel shell veux-tu utiliser pour ton script hello ?',
          options: [
            { label: 'bash', description: 'Bourne Again Shell' },
            { label: 'zsh', description: 'Z Shell' }
          ],
          multiSelect: false
        },
        onResult: (text) => [{ kind: 'text', text: `Résultat de l’outil : ${text}` }]
      }
    ]
  },
  navigateur: {
    description:
      'Pilote le navigateur intégré sur la page MOCK_BROWSER_URL : saisit un nom, valide, lit le résultat, capture',
    steps: [
      { kind: 'text', text: 'J’ouvre la page dans le navigateur. ' },
      ...toolChain(
        [
          {
            tool: 'browser_navigate',
            args: () => ({ url: process.env['MOCK_BROWSER_URL'] ?? 'http://127.0.0.1:9/' })
          },
          { tool: 'browser_find', args: () => ({ query: 'Nom' }) },
          { tool: 'browser_click', args: (r) => ({ ref: refIn(r[1]) }) },
          { tool: 'browser_type', args: () => ({ text: 'Ada' }) },
          { tool: 'browser_read_page', args: () => ({}) },
          {
            tool: 'browser_click',
            args: (r) => ({ ref: refIn(r[4]?.split('\n').find((l) => l.includes('Valider'))) })
          },
          { tool: 'browser_get_page_text', args: () => ({}) },
          { tool: 'browser_screenshot', args: () => ({ scale: 0.5 }) }
        ],
        (results) => [
          {
            kind: 'text',
            text: `Texte de la page :\n\n${results[6]?.split('\n').slice(2).join('\n') ?? ''}`
          }
        ]
      )
    ]
  },
  'navigateur-vue': {
    description:
      'Ouvre MOCK_BROWSER_URL + "vue" (page longue, bouton `#cible`) dans le navigateur intégré (fiche 129)',
    steps: [
      { kind: 'text', text: 'J’ouvre la page longue. ' },
      ...toolChain(
        [{ tool: 'browser_navigate', args: () => ({ url: `${browserBase()}vue` }) }],
        () => [{ kind: 'text', text: 'Page ouverte.' }]
      )
    ]
  },
  'navigateur-clic': {
    description:
      'Clique au centre du bouton `#cible` par coordonnées CSS (page zoomée ou non), capture, puis dit les clics reçus et la fenêtre (fiche 129)',
    steps: [
      { kind: 'text', text: 'Je clique sur le bouton. ' },
      ...toolChain(
        [
          { tool: 'browser_javascript', args: () => ({ code: TARGET_CENTER }) },
          { tool: 'browser_click', args: (r) => ({ coordinate: pointIn(r[0]) }) },
          { tool: 'browser_screenshot', args: () => ({}) },
          {
            tool: 'browser_javascript',
            args: () => ({
              code: "'Clics : ' + (window.clics || 0) + ' · fenêtre : ' + innerWidth + '×' + innerHeight"
            })
          }
        ],
        (r) => [{ kind: 'text', text: `${r[3]}\n\n${r[2]?.split('\n').at(-1) ?? ''}` }]
      )
    ]
  },
  'navigateur-mobile': {
    description:
      'Impose un écran mobile (`browser_resize`), clique sur `#cible`, fait défiler la page, puis demande une autorisation (le tour reste ouvert, la taille aussi) ; la taille s’annule à la fin du tour (fiche 129)',
    steps: [
      { kind: 'text', text: 'J’essaie la page en mobile. ' },
      ...toolChain(
        [
          { tool: 'browser_resize', args: () => ({ preset: 'mobile' }) },
          { tool: 'browser_javascript', args: () => ({ code: TARGET_CENTER }) },
          { tool: 'browser_click', args: (r) => ({ coordinate: pointIn(r[1]) }) },
          { tool: 'browser_scroll', args: () => ({ direction: 'down', amount: 20 }) },
          {
            tool: 'browser_javascript',
            args: () => ({
              code: "'Mobile : ' + innerWidth + '×' + innerHeight + ' · clics : ' + (window.clics || 0) + ' · défilé : ' + (scrollY > 0)"
            })
          }
        ],
        (r) => [
          { kind: 'text', text: `${r[0]}\n\n${r[4]}\n\n` },
          {
            kind: 'permission',
            toolCall: { toolCallId: 'call_mobile', title: 'Garder l’écran mobile', kind: 'other' },
            options: [
              { optionId: 'allow', name: 'Autoriser', kind: 'allow_once' },
              { optionId: 'reject', name: 'Refuser', kind: 'reject_once' }
            ],
            branches: {
              allow: [{ kind: 'text', text: 'Fin du tour.' }],
              reject: [{ kind: 'text', text: 'Fin du tour.' }]
            }
          }
        ]
      )
    ]
  },
  popup: {
    description:
      'Clique sur un bouton de MOCK_BROWSER_URL + "popup" qui ouvre une fenêtre de connexion (fiche 072)',
    steps: [
      { kind: 'text', text: 'Je clique sur « Se connecter ». ' },
      ...toolChain(
        [
          {
            tool: 'browser_navigate',
            args: () => ({
              url: `${process.env['MOCK_BROWSER_URL'] ?? 'http://127.0.0.1:9/'}popup`
            })
          },
          { tool: 'browser_click', args: () => ({ coordinate: [60, 60] }) }
        ],
        (results) => [
          {
            kind: 'text',
            text: results[1]?.includes('ask the user to click')
              ? 'Fenêtre de connexion bloquée : cliquez vous-même sur « Se connecter ».'
              : `Aucune fenêtre bloquée : ${results[1] ?? ''}`
          }
        ]
      )
    ]
  },
  telechargement: {
    description:
      'Clique sur « Exporter » de MOCK_BROWSER_URL + "export" (téléchargement d’un CSV), puis dit ce que l’utilisateur a décidé (fiche 094)',
    steps: [
      { kind: 'text', text: 'Je clique sur « Exporter ». ' },
      ...toolChain(
        [
          {
            tool: 'browser_navigate',
            args: () => ({
              url: `${process.env['MOCK_BROWSER_URL'] ?? 'http://127.0.0.1:9/'}export`
            })
          },
          { tool: 'browser_click', args: () => ({ coordinate: [60, 60] }) }
        ],
        (clicked) => [
          {
            kind: 'text',
            text: clicked[1]?.includes('Save dialog')
              ? 'Décision laissée à l’utilisateur. '
              : `Pas de note sur le téléchargement : ${clicked[1] ?? ''} `
          },
          // Le temps que l'utilisateur réponde à « Enregistrer sous » (joué par l'e2e).
          { kind: 'pause', ticks: 40 },
          ...toolChain([{ tool: 'browser_tabs', args: () => ({ action: 'list' }) }], (later) => {
            const saved = /the user saved the download (.+) to (.+)\./.exec(later[0] ?? '')
            return [
              {
                kind: 'text',
                text: saved
                  ? `Enregistré par l’utilisateur : ${saved[2]}`
                  : later[0]?.includes('the user cancelled the download')
                    ? 'Annulé par l’utilisateur.'
                    : `Pas encore de décision : ${later[0] ?? ''}`
              }
            ]
          })
        ]
      )
    ]
  },
  'boite-page': {
    description:
      'Clique sur « Supprimer » de MOCK_BROWSER_URL + "confirm", qui ouvre une boîte `confirm()` : l’outil rend la main, l’outil suivant aussi ; après une pause, il apprend la réponse de l’utilisateur (fiche 097)',
    steps: [
      { kind: 'text', text: 'Je clique sur « Supprimer ». ' },
      ...toolChain(
        [
          {
            tool: 'browser_navigate',
            args: () => ({
              url: `${process.env['MOCK_BROWSER_URL'] ?? 'http://127.0.0.1:9/'}confirm`
            })
          },
          { tool: 'browser_click', args: () => ({ coordinate: [60, 60] }) },
          { tool: 'browser_javascript', args: () => ({ code: 'document.title' }) }
        ],
        (first) => [
          {
            kind: 'text',
            text: first[1]?.includes('confirm dialog')
              ? `Boîte de la page ouverte ; outil suivant : ${first[2]?.includes('blocks the page') ? 'refusé tout de suite' : (first[2] ?? '')}. `
              : `Pas de boîte signalée : ${first[1] ?? ''} `
          },
          // Le temps que l'utilisateur réponde à la boîte (joué par l'e2e).
          { kind: 'pause', ticks: 100 },
          ...toolChain(
            [{ tool: 'browser_javascript', args: () => ({ code: 'document.title' }) }],
            (later) => [
              {
                kind: 'text',
                text: later[0]?.includes('the user answered')
                  ? `Réponse de l’utilisateur reçue : ${later[0]}`
                  : `Pas encore de réponse : ${later[0] ?? ''}`
              }
            ]
          )
        ]
      )
    ]
  },
  'planche-contact': {
    description:
      'Filme la page MOCK_BROWSER_URL + "anime" pendant un clic qui fait glisser un carré (`browser_filmstrip`, fiche 075)',
    steps: [
      { kind: 'text', text: 'Je filme le carré pendant le clic. ' },
      ...toolChain(
        [
          {
            tool: 'browser_navigate',
            args: () => ({
              url: `${process.env['MOCK_BROWSER_URL'] ?? 'http://127.0.0.1:9/'}anime`
            })
          },
          {
            tool: 'browser_filmstrip',
            args: () => ({
              actions: [{ tool: 'browser_click', args: { coordinate: [300, 300] } }],
              duration_ms: 1200,
              frames: 6
            })
          }
        ],
        (r) => [{ kind: 'text', text: `Planche :\n\n${r[1] ?? '(rien)'}` }]
      )
    ]
  },
  'outils-mcp': {
    description:
      'Liste les outils que le serveur MCP de l’app déclare (`tools/list`), sans les appeler (fiche 109)',
    steps: [
      {
        kind: 'mcp-list',
        onResult: (names) => [{ kind: 'text', text: `Outils du serveur MCP : ${names}` }]
      }
    ]
  },
  'outils-execute-erreur': {
    description:
      'Comme OpenCode 2.0.32 (relevé de la recette, fiche 122) : carte `execute` dite « completed » dont l’appel de preview_start est en erreur dans rawOutput.metadata.toolCalls[]',
    steps: [
      { kind: 'text', text: 'Je lance le serveur de développement. ' },
      {
        kind: 'update',
        update: {
          sessionUpdate: 'tool_call',
          toolCallId: 'call_exec_err',
          title: 'execute',
          kind: 'other',
          status: 'pending',
          rawInput: {}
        }
      },
      {
        kind: 'update',
        update: {
          sessionUpdate: 'tool_call_update',
          toolCallId: 'call_exec_err',
          title: 'execute',
          kind: 'other',
          status: 'in_progress',
          rawInput: { code: 'return await tools.bobine.preview_start({ name: "web" })' }
        }
      },
      { kind: 'pause', ticks: 2 },
      {
        kind: 'update',
        update: {
          sessionUpdate: 'tool_call_update',
          toolCallId: 'call_exec_err',
          status: 'completed',
          content: [
            {
              type: 'content',
              content: {
                type: 'text',
                text: 'No launch configuration in this project. Create .bob/launch.json with the command that starts the dev server and its port, then call preview_start again.'
              }
            }
          ],
          rawOutput: {
            metadata: {
              toolCalls: [{ tool: 'bobine.preview_start', status: 'error' }],
              error: true,
              truncated: false
            }
          }
        }
      },
      { kind: 'text', text: 'Il manque le fichier de lancement.' }
    ]
  },
  'outils-execute': {
    description:
      'Comme OpenCode 2 : une seule carte `execute` dont le code ouvre la page MOCK_BROWSER_URL + "anime", la capture et la filme (fiche 079)',
    steps: [
      { kind: 'text', text: 'Je passe par du code. ' },
      {
        kind: 'code-mode',
        calls: [
          {
            tool: 'browser_navigate',
            args: { url: `${process.env['MOCK_BROWSER_URL'] ?? 'http://127.0.0.1:9/'}anime` }
          },
          { tool: 'browser_screenshot', args: { scale: 0.5 } },
          {
            tool: 'browser_filmstrip',
            args: {
              actions: [{ tool: 'browser_click', args: { coordinate: [300, 300] } }],
              duration_ms: 1000,
              frames: 4
            }
          }
        ],
        onResult: (text) => [{ kind: 'text', text: `Code fini :\n\n${text.slice(0, 200)}` }]
      }
    ]
  },
  'debogage-web': {
    description:
      'Débogue la page MOCK_BROWSER_URL + "debug" : console, réseau, JavaScript, mobile sombre, onglets',
    steps: [
      { kind: 'text', text: 'Je débogue la page. ' },
      ...toolChain(
        [
          {
            tool: 'browser_navigate',
            args: () => ({
              url: `${process.env['MOCK_BROWSER_URL'] ?? 'http://127.0.0.1:9/'}debug`
            })
          },
          { tool: 'browser_console', args: () => ({ only_errors: true }) }
        ],
        (first) =>
          // La page lance `fetch('/api')` au chargement : on attend sa réponse avant d'en lire le
          // statut et le corps (machine chargée : sinon « GET … », fiche 106).
          pollTool(
            { tool: 'browser_network', args: { url_pattern: '/api' } },
            (text) => !networkPending(text),
            (network) =>
              toolChain(
                [
                  {
                    tool: 'browser_network',
                    args: () => ({ request_id: network.split(/\s+/)[0] ?? 'absente' })
                  },
                  {
                    tool: 'browser_javascript',
                    args: () => ({ code: "document.querySelectorAll('li').length" })
                  },
                  {
                    tool: 'browser_resize',
                    args: () => ({ preset: 'mobile', color_scheme: 'dark' })
                  },
                  {
                    tool: 'browser_javascript',
                    args: () => ({
                      code: "innerWidth + ' px, sombre : ' + matchMedia('(prefers-color-scheme: dark)').matches"
                    })
                  },
                  {
                    tool: 'browser_resize',
                    args: () => ({ preset: 'desktop', color_scheme: 'auto' })
                  },
                  {
                    tool: 'browser_tabs',
                    args: () => ({
                      action: 'new',
                      url: process.env['MOCK_BROWSER_URL'] ?? 'http://127.0.0.1:9/'
                    })
                  }
                ],
                (r) => [
                  {
                    kind: 'text',
                    text: [
                      `Console : ${first[1]}`,
                      `Réseau : ${network.split('\n')[0]}`,
                      `Corps : ${r[0]}`,
                      `Éléments de liste : ${r[1]}`,
                      `Mobile : ${r[3]}`,
                      `Onglets :\n${r[5]}`
                    ].join('\n\n')
                  }
                ]
              )
          )
      )
    ]
  },
  'planche-ios': {
    description:
      'Filme le simulateur iOS pendant un balayage vers le haut (`ios_filmstrip`, planche contact, fiche 075)',
    steps: [
      { kind: 'text', text: 'Je filme le défilement. ' },
      ...toolChain(
        [
          {
            tool: 'ios_filmstrip',
            args: () => ({
              actions: [{ tool: 'ios_swipe', args: { from: [200, 600], to: [200, 200] } }],
              duration_ms: 1000,
              frames: 6
            })
          }
        ],
        (r) => [{ kind: 'text', text: `Planche :\n\n${r[0] ?? '(rien)'}` }]
      )
    ]
  },
  'planche-android': {
    description:
      'Filme l’émulateur Android pendant un balayage vers le haut (`android_filmstrip`, planche contact, fiche 076)',
    steps: [
      { kind: 'text', text: 'Je filme le défilement. ' },
      ...toolChain(
        [
          {
            tool: 'android_filmstrip',
            args: () => ({
              actions: [{ tool: 'android_swipe', args: { from: [200, 600], to: [200, 200] } }],
              duration_ms: 1000,
              frames: 6
            })
          }
        ],
        (r) => [{ kind: 'text', text: `Planche :\n\n${r[0] ?? '(rien)'}` }]
      )
    ]
  },
  simulateur: {
    description:
      'Pilote le simulateur iOS : lance l’app, lit l’écran, touche un bouton, saisit « Zoé », capture',
    steps: [
      { kind: 'text', text: 'Je teste l’app iOS. ' },
      ...toolChain(
        [
          { tool: 'ios_devices', args: () => ({}) },
          { tool: 'ios_launch', args: () => ({ bundle_id: 'fr.bobine.demo' }) },
          { tool: 'ios_describe', args: () => ({}) },
          {
            tool: 'ios_tap',
            args: (r) => ({ ref: refIn(r[2]?.split('\n').find((l) => l.includes('Ajouter'))) })
          },
          { tool: 'ios_type', args: () => ({ text: 'Zoé' }) },
          { tool: 'ios_screenshot', args: () => ({}) }
        ],
        (r) => [
          {
            kind: 'text',
            text: `Appareils : ${r[0]}\n\nLancement : ${r[1]}\n\nToucher : ${r[3]}\n\nSaisie : ${r[4]}\n\nCapture : ${r[5]}`
          }
        ]
      )
    ]
  },
  android: {
    description:
      'Pilote l’émulateur Android : lance l’app, lit l’écran, touche « Ajouter un », saisit « Ada », capture',
    steps: [
      { kind: 'text', text: 'Je teste l’app Android. ' },
      ...toolChain(
        [
          { tool: 'android_devices', args: () => ({}) },
          { tool: 'android_launch', args: () => ({ package: 'fr.bobine.demo' }) },
          { tool: 'android_describe', args: () => ({}) },
          {
            tool: 'android_tap',
            args: (r) => ({ ref: refIn(r[2]?.split('\n').find((l) => l.includes('Ajouter'))) })
          },
          { tool: 'android_type', args: () => ({ text: 'Ada' }) },
          { tool: 'android_screenshot', args: () => ({}) }
        ],
        (r) => [
          {
            kind: 'text',
            text: `Appareils : ${r[0]}\n\nLancement : ${r[1]}\n\nToucher : ${r[3]}\n\nCapture : ${r[5]}`
          }
        ]
      )
    ]
  },
  terminal: {
    description:
      'Lance une commande dans le terminal à côté de la conversation (terminal_run), puis lit l’écran',
    steps: [
      { kind: 'text', text: 'Je lance la commande dans le terminal. ' },
      {
        kind: 'mcp-tool',
        tool: 'terminal_run',
        args: { command: 'echo "bonjour du terminal $((6*7))"' },
        // Le prompt du shell peut précéder la sortie de la commande : relire comme un agent.
        onResult: (started) =>
          pollTool(
            { tool: 'terminal_read', args: { wait_for_output_ms: 1500, lines: 20 } },
            (text) => text.includes('bonjour du terminal 42') || !text.startsWith('Terminal tab '),
            (screen) =>
              toolChain([{ tool: 'terminal_list', args: () => ({}) }], ([tabs]) => [
                {
                  kind: 'text',
                  text: `Lancement : ${started}\n\nÉcran :\n${screen}\n\nOnglets :\n${tabs}`
                }
              ])
          )
      }
    ]
  },
  'terminal-refus': {
    description:
      'Demande une commande dans le terminal (terminal_run) ; refusée, la carte dit « refusé » même si l’agent la dit finie, comme OpenCode (fiche 122)',
    steps: [
      { kind: 'text', text: 'Je lance les tests dans le terminal. ' },
      {
        kind: 'mcp-tool',
        tool: 'terminal_run',
        args: { command: 'npm test -- --refus' },
        onResult: (text) => [{ kind: 'text', text: `Réponse de l’outil : ${text}` }]
      }
    ]
  },
  'terminal-refusee-partout': {
    description:
      'Tente « node --version » par le terminal de l’app (terminal_run), comme Bob après un « Refuser partout » : refusée par les règles de l’agent, sans question (fiche 215, recette QA)',
    steps: [
      { kind: 'text', text: 'Je passe par le terminal de Bobine. ' },
      {
        kind: 'mcp-tool',
        tool: 'terminal_run',
        args: { command: 'node --version' },
        onResult: (text) => [{ kind: 'text', text: `Réponse de l’outil : ${text}` }]
      }
    ]
  },
  'lancer-app': {
    description:
      'Lance le serveur « web » du fichier de lancement (preview_start), lit son journal et la page',
    steps: [
      { kind: 'text', text: 'Je lance l’app. ' },
      ...toolChain(
        [
          { tool: 'preview_start', args: () => ({ name: 'web' }) },
          { tool: 'preview_logs', args: () => ({ name: 'web' }) },
          { tool: 'browser_get_page_text', args: () => ({}) }
        ],
        (results) => [
          {
            kind: 'text',
            text: `Démarrage : ${results[0] ?? ''}\n\nJournal :\n${results[1] ?? ''}\n\nPage : ${results[2] ?? ''}`
          }
        ]
      )
    ]
  },
  'outil-app': {
    description:
      'Appelle l’outil « screenshot » fourni par l’app (serveur MCP), comme Bob ; pour tester le socle',
    steps: [
      { kind: 'text', text: 'Je prends une capture. ' },
      {
        kind: 'mcp-tool',
        tool: 'screenshot',
        args: {},
        onResult: (text) => [{ kind: 'text', text: `Résultat de l’outil : ${text}` }]
      }
    ]
  },
  filles: {
    description:
      'Lance deux conversations filles avec `start_child` (accord de l’utilisateur), puis finit son tour ; réveillé quand elles ont fini, fait le point (fiche 097)',
    steps: [
      {
        kind: 'when-prompt',
        includes: 'child conversations you started or messaged have finished',
        then: [
          {
            kind: 'text',
            text: 'Mes conversations filles ont fini : leurs comptes rendus sont arrivés. Branches à fusionner dans l’ordre : l’import, puis la page d’aide.'
          }
        ],
        else: toolChain(
          [
            {
              tool: 'start_child',
              args: () => ({
                title: 'Import CSV',
                prompt: 'Consigne de test.\n/scenario modifications'
              })
            },
            {
              tool: 'start_child',
              args: () => ({
                title: 'Page d’aide',
                prompt: 'Consigne de test.\n/scenario streaming-texte'
              })
            }
          ],
          (results) => [
            {
              kind: 'text',
              text: `J’ai lancé deux conversations filles :\n\n${results.map((r) => `- ${r}`).join('\n')}\n\nJe m’arrête là : je serai réveillé quand elles auront fini.`
            }
          ]
        )
      }
    ]
  },
  'filles-refus': {
    description:
      'Demande une conversation fille (`start_child`) ; refusée, l’agent fait le travail lui-même ; « Faire ici », il le fait dans cette conversation (fiches 097, 112)',
    steps: [
      {
        kind: 'mcp-tool',
        tool: 'start_child',
        args: { title: 'Page d’aide', prompt: 'Consigne de test.\n/scenario streaming-texte' },
        onResult: (text) => [
          {
            kind: 'text',
            text: /refused/.test(text)
              ? `Conversation fille refusée : je fais la page d’aide moi-même.\n\n> ${text}`
              : /do this task yourself/.test(text)
                ? `Je fais la page d’aide ici, dans cette conversation.\n\n> ${text}`
                : `Résultat de l’outil : ${text}`
          }
        ]
      }
    ]
  },
  'filles-plafond': {
    description:
      'Lance trois conversations filles qui attendent un accord (`/scenario permission`) : au-delà du plafond réglé, `start_child` répond une erreur (fiche 097, ADR-0020)',
    steps: toolChain(
      [1, 2, 3].map((n) => ({
        tool: 'start_child',
        args: () => ({ title: `En-tête ${n}`, prompt: 'Consigne de test.\n/scenario permission' })
      })),
      (results) => [
        {
          kind: 'text',
          text: `Résultats :\n\n${results.map((r, i) => `${i + 1}. ${r}`).join('\n')}`
        }
      ]
    )
  },
  'filles-rafale': {
    description:
      'Un long relevé (le fil défile), puis trois `start_child` lancés en parallèle, comme OpenCode : « Liste à lire », puis « Tests serveur » ≈ 2,4 s après, puis « Application mobile » ≈ 4,8 s après, chacune annoncée par une ligne de texte ; la carte « Tâches proposées » grandit pendant que les premières attendent (fiche 124)',
    steps: [
      {
        kind: 'update',
        update: {
          sessionUpdate: 'agent_message_chunk',
          content: {
            type: 'text',
            text: `Relevé du dépôt :\n\n${Array.from({ length: 30 }, (_, i) => `- point ${i + 1} : à reprendre.`).join('\n')}\n\nTrois chantiers indépendants, je les propose en conversations filles.`
          }
        }
      },
      {
        kind: 'parallel',
        branches: [
          [proposeChild('Liste à lire')],
          [
            { kind: 'pause', ticks: 60 },
            { kind: 'text', text: '\n\nAutre chantier, indépendant : les essais du serveur.' },
            proposeChild('Tests serveur')
          ],
          [
            { kind: 'pause', ticks: 120 },
            { kind: 'text', text: '\n\nEt un troisième : l’application mobile.' },
            proposeChild('Application mobile')
          ]
        ]
      },
      { kind: 'text', text: '\n\nLes trois propositions ont leur réponse.' }
    ]
  },
  chantiers: {
    description:
      'Deux chantiers indépendants : propose deux conversations filles (`start_child`) seulement s’il a reçu le contexte de session `<bobine_capabilities>` ou la demande de `/split`, sinon les fait lui-même (fiche 118)',
    steps: [
      {
        kind: 'when-prompt',
        includes: '<child_conversations_request>',
        then: proposeChantiers('/split'),
        else: [
          {
            kind: 'when-prompt',
            includes: '<bobine_capabilities>',
            then: proposeChantiers('contexte de session'),
            else: [
              {
                kind: 'text',
                text: 'Je fais les deux chantiers moi-même, l’un après l’autre : la fenêtre À propos, puis les essais plus courts.'
              }
            ]
          }
        ]
      }
    ]
  },
  'fille-message': {
    description:
      'La mère lance une fille, puis lui écrit (`message_child`) ; la fille, reconnue à sa consigne, écrit à sa mère (`message_parent`) (fiche 097)',
    steps: [
      {
        kind: 'when-prompt',
        includes: 'Tu es la conversation fille',
        then: [
          {
            kind: 'mcp-tool',
            tool: 'message_parent',
            args: { message: 'Faut-il aussi accepter la virgule comme séparateur ?' },
            onResult: (text) => [
              { kind: 'text', text: `Question posée à la conversation mère. ${text}` },
              // Le message de la mère attend dans la file pendant ce temps (essais e2e).
              { kind: 'pause', ticks: 75 },
              { kind: 'text', text: ' Je m’arrête en attendant sa réponse.' }
            ]
          }
        ],
        else: [
          {
            kind: 'mcp-tool',
            tool: 'start_child',
            args: {
              title: 'Séparateur CSV',
              prompt:
                'Consigne de test.\n/scenario fille-message\n\nTu es la conversation fille : demande à ta mère quels séparateurs accepter.'
            },
            onResult: (started) => {
              const id = /\(id: ([^,)]+)/.exec(started)?.[1] ?? 'inconnue'
              return [
                {
                  kind: 'mcp-tool',
                  tool: 'message_child',
                  args: { child: id, message: 'Accepte aussi le point-virgule comme séparateur.' },
                  onResult: (text) => [
                    { kind: 'text', text: `Fille lancée, puis consigne précisée. ${text}` }
                  ]
                }
              ]
            }
          }
        ]
      }
    ]
  },
  commande: {
    description:
      'Commande dont la sortie arrive en morceaux, en couleurs (extension de terminal de Codex / Claude Code)',
    steps: [
      ...terminalCommand(
        'term-1',
        'npm test',
        [
          '> projet@1.0.0 test\n',
          '\u001b[32m✓\u001b[39m addition (2 ms)\n',
          '\u001b[32m✓\u001b[39m soustraction (1 ms)\n',
          '\u001b[1mTests :\u001b[22m 2 réussis\n'
        ],
        0
      ),
      { kind: 'text', text: 'Les tests passent.' }
    ]
  },
  'commande-echec': {
    description: 'Commande qui échoue (code de sortie 2), sortie en rouge',
    steps: [
      ...terminalCommand('term-2', 'npm run lint', ['\u001b[31m✗ 3 erreurs\u001b[39m\n'], 2),
      { kind: 'text', text: 'Le lint échoue.' }
    ]
  },
  'elicitation-url': {
    description: 'L’agent demande d’ouvrir une page web (élicitation en mode URL)',
    steps: [
      { kind: 'text', text: 'Il faut autoriser l’accès au dépôt. ' },
      {
        kind: 'elicitation',
        message: 'Autorisez l’accès à votre dépôt dans le navigateur.',
        url: 'https://example.com/autoriser',
        onAccept: () => [{ kind: 'text', text: 'Merci, accès autorisé.' }],
        onDecline: [{ kind: 'text', text: 'Accès refusé, je m’arrête là.' }]
      }
    ]
  },
  'bob-elicitation': {
    description: 'Un outil MCP demande une information via un formulaire (élicitation)',
    steps: [
      { kind: 'text', text: 'Pour déployer, j’ai besoin de précisions. ' },
      {
        kind: 'elicitation',
        message: 'Sur quel environnement déployer ?',
        schema: {
          type: 'object',
          properties: {
            environnement: {
              type: 'string',
              title: 'Environnement',
              enum: ['dev', 'recette', 'prod']
            },
            instances: {
              type: 'integer',
              title: 'Nombre d’instances',
              minimum: 1,
              maximum: 10,
              default: 2
            },
            contact: {
              type: 'string',
              title: 'E-mail de contact',
              format: 'email',
              description: 'Prévenu en cas d’échec'
            },
            regions: {
              type: 'array',
              title: 'Régions',
              items: {
                anyOf: [
                  { const: 'eu', title: 'Europe' },
                  { const: 'us', title: 'États-Unis' }
                ]
              },
              minItems: 1
            },
            confirmer: { type: 'boolean', title: 'Je confirme le déploiement' }
          },
          required: ['environnement', 'confirmer']
        },
        onAccept: (content) => [
          { kind: 'text', text: `Déploiement sur ${String(content['environnement'])} lancé.` }
        ],
        onDecline: [{ kind: 'text', text: 'Déploiement annulé.' }]
      }
    ]
  },
  'plan-fichier': {
    description:
      'Mode plan à la manière de Bob : plan écrit dans plan.md, réécrit aux remarques, exécuté ensuite',
    steps: [
      {
        kind: 'when-prompt',
        includes: 'Remarques sur le plan',
        then: [
          { kind: 'text', text: 'Je relis le plan et je le mets à jour. ' },
          { kind: 'edit-file', path: 'plan.md', content: PLAN_V2 },
          {
            kind: 'text',
            text: 'Plan mis à jour dans plan.md : tests avec Vitest, exemple ajouté.'
          }
        ],
        else: [
          {
            kind: 'when-prompt',
            includes: 'Exécute le plan',
            then: [
              {
                kind: 'edit-file',
                path: 'src/goodbye.js',
                content: "export const goodbye = () => 'au revoir'\n"
              },
              { kind: 'text', text: 'Plan exécuté : goodbye() ajoutée.' }
            ],
            else: [
              { kind: 'text', text: 'Je regarde le projet, puis j’écris le plan. ' },
              { kind: 'edit-file', path: 'plan.md', content: PLAN_V1, emptyOldText: true },
              { kind: 'text', text: 'Le plan est dans plan.md. Des remarques avant de commencer ?' }
            ]
          }
        ]
      }
    ]
  },
  modifications: {
    description:
      'Modifie de vrais fichiers du dossier (README.md, src/app.js) : récapitulatif des modifications',
    steps: MODIFICATIONS
  },
  conflits: {
    description:
      'Fiche 110 : sur la consigne de résolution de conflits de l’app (« left conflicts »), réécrit README.md sans marqueurs, sans committer ; sinon joue « modifications »',
    steps: [
      {
        kind: 'when-prompt',
        includes: 'left conflicts',
        then: [
          {
            kind: 'text',
            text: 'Je résous le conflit dans README.md en gardant les deux versions. '
          },
          {
            kind: 'edit-file',
            path: 'README.md',
            content: '# Démo\n\nVersion 2 et 3\n\n## Utilisation\n\nLancer `node src/app.js`.\n'
          },
          { kind: 'text', text: 'Conflit résolu, je ne committe pas.' }
        ],
        else: MODIFICATIONS
      }
    ]
  },
  'patch-opencode': {
    description:
      'Comme OpenCode 2.0.32 : outil « patch » (crée notes.md et src/calc.js, puis complète notes.md et modifie README.md s’il existe) ; au rejeu, diffs des fichiers modifiés absents, seul rawOutput.metadata.files[].patch reste (fiche 096)',
    steps: [
      { kind: 'text', text: 'Je crée les notes et la calculette. ' },
      {
        kind: 'opencode-patch',
        files: [
          { path: 'notes.md', content: OPENCODE_NOTES },
          { path: 'src/calc.js', content: 'export function add(a, b) {\n  return a + b\n}\n' }
        ]
      },
      { kind: 'text', text: 'Puis je complète les notes et le README. ' },
      {
        kind: 'opencode-patch',
        files: [
          { path: 'notes.md', edit: { from: '- deux\n', to: '- deux\n- deux et demi\n' } },
          { path: 'notes.md', edit: { from: '- douze\n', to: '- douze\n- treize\n' } },
          { path: 'README.md', edit: { from: 'Version 1', to: 'Version 2' } }
        ]
      },
      { kind: 'text', text: 'C’est fait.' }
    ]
  },
  'ecriture-opencode': {
    description:
      'Comme OpenCode 2.2.5 : write crée nouveau.txt sans diff (« Created file successfully »), un patch modifie README.md s’il existe (« Version 1 » → « Version 2 », avec diff), puis write crée autorise.txt après une demande d’autorisation, seule à porter le diff (fiche 202)',
    steps: [
      { kind: 'text', text: 'Je crée le fichier. ' },
      { kind: 'opencode-write', path: 'nouveau.txt', content: 'bonjour\n' },
      {
        kind: 'opencode-patch',
        files: [{ path: 'README.md', edit: { from: 'Version 1', to: 'Version 2' } }]
      },
      { kind: 'opencode-write', path: 'autorise.txt', content: 'accordé\n', ask: true },
      { kind: 'text', text: 'C’est fait.' }
    ]
  },
  'outil-en-preparation': {
    description:
      'Comme OpenCode : outil « patch » annoncé en pending avec rawInput {} pendant 3 s (le modèle écrit le patch), puis in_progress avec ses emplacements, puis terminé (fiche 128). Le délai de 3 s suppose le délai de base de 40 ms',
    steps: [
      { kind: 'text', text: 'Je prépare la modification. ' },
      {
        kind: 'update',
        update: {
          sessionUpdate: 'tool_call',
          toolCallId: 'patch_prep',
          title: 'patch',
          kind: 'edit',
          status: 'pending',
          rawInput: {}
        }
      },
      { kind: 'pause', ticks: PREPARING_TICKS },
      {
        kind: 'update',
        update: {
          sessionUpdate: 'tool_call_update',
          toolCallId: 'patch_prep',
          status: 'in_progress',
          locations: [{ path: '{cwd}/notes.md' }],
          rawInput: { patchText: '*** Begin Patch\n*** Update File: notes.md\n*** End Patch' }
        }
      },
      { kind: 'pause', ticks: 25 },
      {
        kind: 'update',
        update: {
          sessionUpdate: 'tool_call_update',
          toolCallId: 'patch_prep',
          status: 'completed',
          content: [
            {
              type: 'content',
              content: { type: 'text', text: 'Success. Updated the following files:\nM notes.md' }
            }
          ]
        }
      },
      { kind: 'text', text: 'C’est fait.' }
    ]
  },
  'outil-en-preparation-interrompu': {
    description:
      'Comme outil-en-preparation, mais le patch reste annoncé (pending, rawInput {}) jusqu’à ce qu’on interrompe le tour (Échap) : la carte garde le nom de son genre, « Modification · interrompu » (fiche 128)',
    steps: [
      { kind: 'text', text: 'Je prépare la modification. ' },
      {
        kind: 'update',
        update: {
          sessionUpdate: 'tool_call',
          toolCallId: 'patch_prep_stop',
          title: 'patch',
          kind: 'edit',
          status: 'pending',
          rawInput: {}
        }
      },
      // Attend l'interruption : l'annulation du tour coupe cette pause.
      { kind: 'pause', ticks: 100_000 }
    ]
  },
  'shell-en-preparation': {
    description:
      'Outil « shell » annoncé en pending avec seulement {cwd} pendant 3 s, puis sa commande, puis une sortie JSON dont les chaînes ont des retours à la ligne (fiche 128, D6)',
    steps: [
      {
        kind: 'update',
        update: {
          sessionUpdate: 'tool_call',
          toolCallId: 'shell_prep',
          title: 'shell',
          kind: 'execute',
          status: 'pending',
          rawInput: { cwd: '{cwd}' }
        }
      },
      { kind: 'pause', ticks: PREPARING_TICKS },
      {
        kind: 'update',
        update: {
          sessionUpdate: 'tool_call_update',
          toolCallId: 'shell_prep',
          status: 'in_progress',
          rawInput: { command: 'node results.js', cwd: '{cwd}' }
        }
      },
      { kind: 'pause', ticks: 2 },
      {
        kind: 'update',
        update: {
          sessionUpdate: 'tool_call_update',
          toolCallId: 'shell_prep',
          status: 'completed',
          content: [
            {
              type: 'content',
              content: {
                type: 'text',
                text: JSON.stringify([
                  { status: 'fulfilled', value: 'ligne 1\nligne 2' },
                  { status: 'rejected', reason: 'dit "non"' }
                ])
              }
            }
          ]
        }
      },
      { kind: 'text', text: 'Terminé.' }
    ]
  },
  demo: {
    description: 'Démonstration complète : réflexion, plan, outil, permission, diff, texte',
    steps: [
      {
        kind: 'thought',
        text: 'Je commence par regarder le projet, puis je proposerai une modification.'
      },
      plan(['in_progress']),
      { kind: 'text', text: 'Je regarde d’abord le projet. ' },
      ...readFile,
      plan(['completed', 'in_progress']),
      ...editConfigWithPermission,
      plan(['completed', 'completed', 'completed']),
      { kind: 'text', text: '\n\nTerminé. Tapez `/scenario` pour voir les autres scénarios.' }
    ]
  },
  // Scénarios aux limites (fiche 139) : pannes du réseau, gros contenus, textes difficiles.
  ...limitScenarios,
  ...commandScenarios,
  // Débordements horizontaux du fil (fiche 173).
  ...overflowScenarios,
  ...failureScenarios,
  // Pendant le tour (fiche 157) : commande silencieuse, coût qui monte, jetons sans coût.
  ...turnGuardScenarios,
  // Mère tech lead (fiche 160) : modèle choisi, compte rendu borné, correction, recommandation.
  ...childScenarios,
  ...reviewScenarios,
  ...memoryScenarios
}

export const DEFAULT_SCENARIO = 'demo'

/**
 * Trois autorisations l'une après l'autre, titrées comme Bob 2.0.6 (relevé dans son journal, fiche
 * 125) : une modification au chemin absolu, une commande précédée d'un `cd` vers le dossier, une
 * liste de tâches à cases. Chaque accord passe à la suivante.
 */
function bobRawTitles(): Step[] {
  const options: PermissionOption[] = [
    { optionId: 'allow', name: 'Allow once', kind: 'allow_once' },
    { optionId: 'reject', name: 'Reject', kind: 'reject_once' }
  ]
  const asks: ToolCallUpdate[] = [
    {
      toolCallId: 'bob_diff',
      title: 'Applying diff to {cwd}/src/books.js',
      kind: 'edit',
      status: 'pending',
      rawInput: { path: '{cwd}/src/books.js', diff: '<<<<<<< SEARCH' }
    },
    {
      toolCallId: 'bob_test',
      title: 'cd {cwd} && npm test 2>&1',
      kind: 'execute',
      status: 'pending',
      rawInput: { command: 'cd {cwd} && npm test 2>&1' }
    },
    {
      toolCallId: 'bob_todo',
      title: 'Updating todo list',
      kind: 'other',
      status: 'pending',
      rawInput: { todos: '\n[-] Read AGENTS.md\n[ ] Run npm test\n[ ] Commit\n' }
    }
  ]
  return asks.reduceRight<Step[]>(
    (next, toolCall) => [
      {
        kind: 'permission',
        toolCall,
        options,
        branches: {
          allow: [
            {
              kind: 'update',
              update: {
                sessionUpdate: 'tool_call_update',
                toolCallId: toolCall.toolCallId,
                status: 'completed'
              }
            },
            ...next
          ],
          reject: [{ kind: 'text', text: 'Refusé.' }]
        }
      }
    ],
    [{ kind: 'text', text: 'Les trois outils sont passés.' }]
  )
}
