/**
 * Pannes d'agent de la barre V1 (fiche 187, point 10 ; fiche 195) : mort par signal, flot sur
 * stderr, connexion coupée alors que le processus vit. Les pannes au démarrage (`initialize`,
 * `session/new`, `session/load`) passent par l'option `--panne`, pas par un scénario : elles
 * arrivent avant le premier message. Aucune n'est un relevé de Bob ou d'OpenCode.
 */
import type { Scenario, Step } from './scenario.mts'

/** Un outil commencé, comme avant un plantage réel. */
const TOOL_STARTED: Step[] = [
  { kind: 'text', text: 'Je lance la commande… ' },
  {
    kind: 'update',
    update: {
      sessionUpdate: 'tool_call',
      toolCallId: 'call_failure',
      title: 'Compiler le projet',
      kind: 'execute',
      status: 'in_progress'
    }
  },
  { kind: 'pause', ticks: 2 }
]

/** Durée du `sleep` lancé par `plantage-avec-enfant` : reconnaissable dans `ps` (essais). */
export const CHILD_SLEEP = '31.7'
/** Durées des `sleep` mis en arrière-plan par `arriere-plan` et `arriere-plan-detache`. */
export const BACKGROUND_SLEEP = '41.3'
export const DETACHED_SLEEP = '41.4'

export const failureScenarios: Record<string, Scenario> = {
  'plantage-signal': {
    description: 'Commence un outil puis le processus est tué par SIGKILL (mort sans un mot)',
    steps: [...TOOL_STARTED, { kind: 'signal', signal: 'SIGKILL' }]
  },
  'plantage-avec-enfant': {
    description:
      'Lance une commande (`sleep 31.7`) puis le processus est tué par SIGKILL : la commande ne doit pas survivre',
    steps: [
      ...TOOL_STARTED,
      { kind: 'spawn', command: 'sleep', args: [CHILD_SLEEP] },
      { kind: 'pause', ticks: 2 },
      { kind: 'signal', signal: 'SIGKILL' }
    ]
  },
  'arriere-plan': {
    description:
      'Met une commande longue (`sleep 41.3`) en arrière-plan dans son groupe, puis finit son tour : arrêtée avec l’agent (fiche 195, M3)',
    steps: [
      { kind: 'spawn', command: 'sleep', args: [BACKGROUND_SLEEP] },
      { kind: 'text', text: 'Background process started. La commande continue en arrière-plan.' }
    ]
  },
  'arriere-plan-detache': {
    description:
      'Détache lui-même une commande longue (`sleep 41.4`, nouvelle session) puis finit son tour : hors du groupe, Bobine ne l’arrête pas (fiche 195, M3)',
    steps: [
      { kind: 'spawn', command: 'sleep', args: [DETACHED_SLEEP], detached: true },
      { kind: 'text', text: 'Background process started (détaché). La commande continue seule.' }
    ]
  },
  'plantage-segfault': {
    description: 'Commence un outil puis le processus meurt par SIGSEGV (plantage natif)',
    steps: [...TOOL_STARTED, { kind: 'signal', signal: 'SIGSEGV' }]
  },
  'flot-stderr': {
    description: 'Écrit 20 000 lignes sur stderr (≈ 4 Mo) pendant le tour, puis répond normalement',
    steps: [
      { kind: 'stderr-flood', lines: 20_000, bytes: 200 },
      { kind: 'text', text: 'Réponse après le flot sur la sortie d’erreur.' }
    ]
  },
  'connexion-coupee': {
    description:
      'Commence à répondre, puis ferme stdout sans s’arrêter (connexion coupée, processus vivant)',
    steps: [{ kind: 'text', text: 'Je commence… ' }, { kind: 'close-stdout' }]
  }
}
