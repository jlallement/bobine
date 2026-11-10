/**
 * Scénarios aux limites (fiche 139) : très gros contenus, textes difficiles, commandes annoncées
 * en cours de session. Aucun n'est un relevé de Bob ou d'OpenCode : des formes plausibles. Les
 * pannes du réseau (`reseau-coupe`, `limite-debit`) sont avec celles de la fiche 142, dans
 * `scenarios.mts`. Rangés à part : le catalogue de `scenarios.mts` est déjà long.
 */
import type { Scenario, Step, StepLimit } from './scenario.mts'

/**
 * Travail d'un tour (fiche 209) : une étape par requête au modèle. Avec la limite par défaut (3),
 * le troisième message est coupé en pleine phrase.
 */
const STEP_LIMIT_WORK: Step[] = [
  { kind: 'text', text: 'Je regarde les entités du projet. ' },
  {
    kind: 'update',
    update: {
      sessionUpdate: 'tool_call',
      toolCallId: 'call_limit_read',
      title: 'Lecture de Commande.java',
      kind: 'read',
      status: 'completed',
      locations: [{ path: '{cwd}/Commande.java' }]
    }
  },
  {
    kind: 'text',
    text: 'Il faut passer de PanacheEntity à PanacheEntityBase : je commence par l’entité Commande, puis je mettrai à jour les dépôts.'
  },
  { kind: 'text', text: 'Terminé.' }
]

/** Reprise demandée (« Continue… ») : deux étapes, puis la fin du tour si la limite le permet. */
const STEP_LIMIT_CONTINUE: Step[] = [
  { kind: 'text', text: 'Je reprends là où je m’étais arrêté. ' },
  { kind: 'text', text: 'Les entités utilisent maintenant PanacheEntityBase.' }
]

const stepLimit = (persistent: boolean): StepLimit => ({
  ...(persistent ? { persistent: true } : {}),
  continueSteps: STEP_LIMIT_CONTINUE
})

/** Lignes du gros diff : plus de 5 000, pour le rendu et l'enregistrement du fil. */
export const HUGE_DIFF_LINES = 6000
/** Sortie de la grosse commande : 1 Mio, en 16 morceaux. */
export const BIG_OUTPUT_BYTES = 1024 * 1024
const BIG_OUTPUT_CHUNKS = 16

const hugeOld = Array.from({ length: HUGE_DIFF_LINES }, (_, i) => `ligne ${i + 1};${i * 7}`).join(
  '\n'
)
const hugeNew = hugeOld.replace(/;(\d+)$/gm, (_, n: string) => `;${Number(n) + 1}`)

/** Une ligne de sortie de 64 octets (63 caractères ASCII et le retour à la ligne). */
const outputLine = (i: number) => `${`test ${i} ok `.padEnd(63, '.')}\n`

function bigOutputChunks(): string[] {
  const perChunk = BIG_OUTPUT_BYTES / BIG_OUTPUT_CHUNKS / 64
  return Array.from({ length: BIG_OUTPUT_CHUNKS }, (_, c) =>
    Array.from({ length: perChunk }, (_, i) => outputLine(c * perChunk + i)).join('')
  )
}

/** Commande au format de l'extension de terminal (`_meta.terminal_*`), comme `commande`. */
export function terminalSteps(id: string, command: string, chunks: string[]): Step[] {
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
    ...chunks.map((data): Step => ({
      kind: 'update',
      update: {
        sessionUpdate: 'tool_call_update',
        toolCallId: id,
        _meta: { terminal_output_delta: { terminal_id: id, data } }
      }
    })),
    {
      kind: 'update',
      update: {
        sessionUpdate: 'tool_call_update',
        toolCallId: id,
        status: 'completed',
        _meta: { terminal_exit: { terminal_id: id, exit_code: 0, signal: null } }
      }
    }
  ]
}

/** Octets d'un PNG lus comme du texte : signature, NUL, caractères de contrôle. */
const BINARY_TEXT = '\u0089PNG\r\n\u001a\n\u0000\u0000\u0000\rIHDR\u0000\u0000\u0000\u0010��'

/** Ligne de 6 000 caractères sans espace (chemin, base64, JSON minifié). */
const LONG_LINE = `data:${'QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVo'.repeat(171)}`

const TRICKY_TEXT = [
  'Emoji : 👩🏽‍💻 🏳️‍🌈 🇫🇷 1️⃣ ❤️‍🔥 (séquences ZWJ, drapeaux, touches).',
  '',
  'De droite à gauche : مرحبا بالعالم — שלום עולם — et un mélange : le fichier `config.json` في المجلد.',
  '',
  `Très longue ligne : ${LONG_LINE}`,
  '',
  '```text',
  LONG_LINE,
  '```'
].join('\n')

/**
 * Réponse avec un bloc de code de 200 lignes sans langage, envoyé par morceaux de 5 lignes (fiche
 * 192) : la coloration ne doit pas deviner le langage du bloc à chaque morceau.
 */
const UNTAGGED_CODE_LINES = Array.from(
  { length: 200 },
  (_, i) => `function etape${i}(valeur) { return valeur * ${i} + ${i % 7} }\n`
)
const untaggedCodeSteps: Step[] = [
  { kind: 'text', text: 'Voici le module complet :\n\n' },
  ...Array.from({ length: 40 }, (_, c): Step[] => [
    {
      kind: 'update',
      update: {
        sessionUpdate: 'agent_message_chunk',
        content: {
          type: 'text',
          text: `${c === 0 ? '```\n' : ''}${UNTAGGED_CODE_LINES.slice(c * 5, c * 5 + 5).join('')}`
        }
      }
    },
    { kind: 'pause', ticks: 1 }
  ]).flat(),
  { kind: 'text', text: '```\n\nLe module est prêt.' }
]

export const limitScenarios: Record<string, Scenario> = {
  'code-sans-langage': {
    description:
      'Réponse avec un bloc de code de 200 lignes sans langage, en 40 morceaux de 5 lignes (fiche 192)',
    steps: untaggedCodeSteps
  },
  // Versions de l'agent (fiche 198) : le profil de l'agent factice a essayé 0.1.0, plancher 0.0.5.
  'version-plus-recente': {
    description:
      'Annonce la version 0.2.0, plus récente que celles essayées : avis une fois (fiche 198)',
    announce: { version: '0.2.0' },
    steps: [{ kind: 'text', text: 'Bonjour, je suis une version plus récente.' }]
  },
  'version-plus-ancienne': {
    description:
      'Annonce la version 0.0.8, plus ancienne que celles essayées : avertissement une fois (fiche 198)',
    announce: { version: '0.0.8' },
    steps: [{ kind: 'text', text: 'Bonjour, je suis une version plus ancienne.' }]
  },
  'version-trop-ancienne': {
    description:
      'Annonce la version 0.0.1, sous le plancher du profil : démarrage refusé, expliqué (fiche 198)',
    announce: { version: '0.0.1' },
    steps: [{ kind: 'text', text: 'Ce texte ne doit jamais s’afficher.' }]
  },
  'protocole-absent': {
    description:
      'Répond à initialize sans version du protocole ACP : tolérée, l’agent démarre (fiche 198)',
    announce: { protocolVersion: null },
    steps: [{ kind: 'text', text: 'Bonjour, je ne dis pas ma version du protocole.' }]
  },
  'protocole-incompatible': {
    description:
      'Répond à initialize avec la version 2 du protocole ACP : démarrage refusé, expliqué (fiche 198)',
    announce: { protocolVersion: 2 },
    steps: [{ kind: 'text', text: 'Ce texte ne doit jamais s’afficher.' }]
  },
  'diff-geant': {
    description: `Modification d’un fichier de ${HUGE_DIFF_LINES} lignes : un diff de plus de 5 000 lignes (fiche 139)`,
    steps: [
      {
        kind: 'update',
        update: {
          sessionUpdate: 'tool_call',
          toolCallId: 'call_huge_diff',
          title: 'Modification de donnees.csv',
          kind: 'edit',
          status: 'in_progress',
          locations: [{ path: '{cwd}/donnees.csv' }],
          content: [{ type: 'diff', path: 'donnees.csv', oldText: hugeOld, newText: hugeNew }]
        }
      },
      {
        kind: 'update',
        update: {
          sessionUpdate: 'tool_call_update',
          toolCallId: 'call_huge_diff',
          status: 'completed'
        }
      },
      { kind: 'text', text: `Toutes les lignes de donnees.csv sont décalées (${HUGE_DIFF_LINES}).` }
    ]
  },
  'fichier-binaire': {
    description:
      'Fichier binaire : lecture dont la sortie contient des octets bruts (NUL, contrôles), puis création d’un binaire en diff (fiche 139)',
    steps: [
      {
        kind: 'update',
        update: {
          sessionUpdate: 'tool_call',
          toolCallId: 'call_bin_read',
          title: 'read',
          kind: 'read',
          status: 'in_progress',
          locations: [{ path: '{cwd}/logo.png' }],
          rawInput: { path: '{cwd}/logo.png' }
        }
      },
      {
        kind: 'update',
        update: {
          sessionUpdate: 'tool_call_update',
          toolCallId: 'call_bin_read',
          status: 'completed',
          content: [{ type: 'content', content: { type: 'text', text: BINARY_TEXT } }]
        }
      },
      {
        kind: 'update',
        update: {
          sessionUpdate: 'tool_call',
          toolCallId: 'call_bin_write',
          title: 'Création de icone.ico',
          kind: 'edit',
          status: 'completed',
          locations: [{ path: '{cwd}/icone.ico' }],
          content: [{ type: 'diff', path: 'icone.ico', oldText: null, newText: BINARY_TEXT }]
        }
      },
      { kind: 'text', text: 'logo.png est une image : je ne la modifie pas.' }
    ]
  },
  'sortie-1mo': {
    description:
      'Commande dont la sortie fait 1 Mio (16 morceaux de 64 Kio, 16 384 lignes), code 0 (fiche 139)',
    steps: [
      ...terminalSteps('term-big', 'npm test -- --verbose', bigOutputChunks()),
      { kind: 'text', text: 'Les 16 384 tests passent.' }
    ]
  },
  'commandes-en-cours': {
    description:
      'Commandes « / » annoncées de nouveau en cours de session (available_commands_update pendant le tour) : `/revue` s’ajoute (fiche 139)',
    steps: [
      { kind: 'text', text: 'Je charge une nouvelle commande. ' },
      {
        kind: 'update',
        update: {
          sessionUpdate: 'available_commands_update',
          availableCommands: [
            { name: 'scenario', description: 'Joue un scénario de l’agent factice pour ce tour' },
            { name: 'aide', description: 'Liste les scénarios disponibles' },
            { name: 'demo', description: 'Démonstration complète' },
            { name: 'revue', description: 'Relit les modifications', input: { hint: 'fichier' } }
          ]
        }
      },
      { kind: 'text', text: 'La commande `/revue` est disponible.' }
    ]
  },
  'textes-limites': {
    description:
      'Textes difficiles : emoji (ZWJ, drapeaux), écrit de droite à gauche (arabe, hébreu, mélangé), lignes de 6 000 caractères sans espace, dans le texte, la réflexion et un titre d’outil (fiche 139)',
    steps: [
      { kind: 'thought', text: 'Je teste 👩🏽‍💻 et مرحبا dans la réflexion.' },
      {
        kind: 'update',
        update: {
          sessionUpdate: 'tool_call',
          toolCallId: 'call_tricky',
          title: 'grep « 🏳️‍🌈 שלום »',
          kind: 'search',
          status: 'completed',
          rawInput: { pattern: '🏳️‍🌈 שלום' },
          content: [{ type: 'content', content: { type: 'text', text: LONG_LINE } }]
        }
      },
      { kind: 'text', text: TRICKY_TEXT }
    ]
  },
  'limite-etapes-session': {
    description:
      'Limite d’étapes comptée sur toute la session, comme Bob 2.0.9 (fiche 209) : à `--max-etapes` (défaut 3) le tour s’arrête en `max_turn_requests`, message coupé ; ensuite chaque message est refusé aussitôt, sans aucune mise à jour ; seule une relance de l’agent puis `session/load` remet le compte à zéro',
    steps: STEP_LIMIT_WORK,
    session: { stepLimit: stepLimit(false) }
  },
  'limite-etapes-tenace': {
    description:
      'Comme `limite-etapes-session`, mais le compte survit à la relance de l’agent : rouvrir la session ne suffit pas, seule une session neuve repart de zéro (fiche 209)',
    steps: STEP_LIMIT_WORK,
    session: { stepLimit: stepLimit(true) }
  }
}
