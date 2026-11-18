/**
 * Scénarios de la demande de message de commit (fiche 246, ADR-0056), joués d'office quand le
 * message contient `<bobine_commit_message>` : `MOCK_AGENT_COMMIT` choisit lequel
 * (`message-commit` par défaut). Réponse normale, lente au-delà du délai, refus, erreur, et un agent
 * qui tente d'écrire et de lancer une commande malgré la consigne (la session est en lecture seule).
 */
import type { Scenario, Step } from './scenario.mts'

/** Tentative d'écriture dans le dossier : écrit pour de vrai seulement si l'app l'autorise. */
const tryWrite: Step[] = [
  {
    kind: 'update',
    update: {
      sessionUpdate: 'tool_call',
      toolCallId: 'call_commit_edit',
      title: 'Edit README.md',
      kind: 'edit',
      status: 'pending',
      locations: [{ path: 'README.md' }],
      content: [
        { type: 'diff', path: 'README.md', oldText: null, newText: 'written by the agent\n' }
      ]
    }
  },
  {
    kind: 'permission',
    toolCall: { toolCallId: 'call_commit_edit', title: 'Edit README.md', kind: 'edit' },
    options: [
      { optionId: 'allow', name: 'Allow', kind: 'allow_once' },
      { optionId: 'allow_always', name: 'Always allow', kind: 'allow_always' },
      { optionId: 'reject', name: 'Reject', kind: 'reject_once' }
    ],
    branches: {
      allow: [{ kind: 'write-file', path: 'README.md', content: 'written by the agent\n' }],
      allow_always: [{ kind: 'write-file', path: 'README.md', content: 'written by the agent\n' }],
      reject: [
        {
          kind: 'update',
          update: {
            sessionUpdate: 'tool_call_update',
            toolCallId: 'call_commit_edit',
            status: 'failed'
          }
        }
      ]
    }
  },
  {
    kind: 'update',
    update: {
      sessionUpdate: 'tool_call',
      toolCallId: 'call_commit_cmd',
      title: 'touch pwned.txt',
      kind: 'execute',
      status: 'pending',
      rawInput: { command: 'touch pwned.txt' }
    }
  },
  {
    kind: 'permission',
    toolCall: { toolCallId: 'call_commit_cmd', title: 'touch pwned.txt', kind: 'execute' },
    options: [
      { optionId: 'allow', name: 'Allow', kind: 'allow_once' },
      { optionId: 'reject', name: 'Reject', kind: 'reject_once' }
    ],
    branches: {
      allow: [{ kind: 'write-file', path: 'pwned.txt', content: '' }],
      reject: [
        {
          kind: 'update',
          update: {
            sessionUpdate: 'tool_call_update',
            toolCallId: 'call_commit_cmd',
            status: 'failed'
          }
        }
      ]
    }
  }
]

export const commitScenarios: Record<string, Scenario> = {
  'message-commit': {
    description:
      'Demande de message de commit (fiche 246) : répond un message Conventional Commits tiré des fichiers reçus, et dit ce qu’il a reçu (notes, demande de départ, contenus retenus, lignes masquées) ; joué d’office pour cette demande',
    steps: [{ kind: 'commit-message' }]
  },
  'message-commit-lent': {
    description:
      'Demande de message de commit qui ne répond jamais, même à `session/cancel` (au-delà du délai de Bobine, fiche 246) ; `MOCK_AGENT_COMMIT=message-commit-lent`',
    steps: [{ kind: 'hang' }]
  },
  'message-commit-refus': {
    description:
      'Demande de message de commit refusée (`stopReason: refusal`, fiche 246) ; `MOCK_AGENT_COMMIT=message-commit-refus`',
    steps: [{ kind: 'text', text: 'I can’t help with that.' }],
    stopReason: 'refusal'
  },
  'message-commit-erreur': {
    description:
      'Demande de message de commit en erreur (JSON-RPC « Internal error », fiche 246) ; `MOCK_AGENT_COMMIT=message-commit-erreur`',
    steps: [{ kind: 'fail', message: 'model overloaded' }]
  },
  'message-commit-ecriture': {
    description:
      'Demande de message de commit : tente d’écrire README.md puis de lancer `touch pwned.txt` (écrits seulement si l’app l’accorde), puis répond le message (fiche 246) ; `MOCK_AGENT_COMMIT=message-commit-ecriture`',
    steps: [...tryWrite, { kind: 'commit-message' }]
  }
}
