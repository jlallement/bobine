/**
 * Scénarios des rôles (fiche 223) : une mère qui délègue à un rôle ou nomme un rôle inconnu ; une
 * fille en lecture seule qui demande à écrire (refus de Bobine) ou qui écrit sans demander, comme
 * OpenCode réglé par défaut (le garde-fou de Bobine le voit). Le mode natif se vérifie avec `echo`
 * (mode de la session et message reçu).
 */
import type { Scenario } from './scenario.mts'

/** Résultat d'un outil de l'app, cité dans le fil. */
const said = (lead: string) => (text: string) => [
  { kind: 'text', text: `${lead}\n\n> ${text.split('\n').join('\n> ')}` } as const
]

export const roleScenarios: Record<string, Scenario> = {
  'roles-delegue': {
    description:
      'Délègue à un rôle (fiche 223) : `start_child` avec `role: security-expert` ; la fille joue `echo` (elle dit ce qu’elle a reçu)',
    steps: [
      {
        kind: 'mcp-tool',
        tool: 'start_child',
        args: {
          title: 'Audit sécurité',
          prompt: 'Audite le module de connexion.\n/scenario echo',
          role: 'security-expert'
        },
        onResult: said('Rôle proposé.')
      }
    ]
  },
  'roles-inconnu': {
    description:
      'Rôle inconnu (fiche 223) : `start_child` avec `role: astronaute`, refusé avec la liste des rôles connus, cité dans le fil',
    steps: [
      {
        kind: 'mcp-tool',
        tool: 'start_child',
        args: { title: 'Mission', prompt: 'Va sur la Lune.\n/scenario echo', role: 'astronaute' },
        onResult: said('Rôle refusé.')
      }
    ]
  },
  'role-ecrit-avec-demande': {
    description:
      'Fille en lecture seule qui demande à écrire `notes.md` (`kind: edit`, comme Bob) : refusée par Bobine, elle le dit',
    steps: [
      {
        kind: 'permission',
        toolCall: { toolCallId: 'role_edit', title: 'Writing file notes.md', kind: 'edit' },
        options: [
          { optionId: 'allow', name: 'Allow once', kind: 'allow_once' },
          { optionId: 'allow_always', name: 'Always allow', kind: 'allow_always' },
          { optionId: 'reject', name: 'Reject', kind: 'reject_once' }
        ],
        branches: {
          allow: [
            { kind: 'write-file', path: 'notes.md', content: 'écrit malgré la lecture seule\n' },
            { kind: 'text', text: 'Écriture acceptée.' }
          ],
          allow_always: [
            { kind: 'write-file', path: 'notes.md', content: 'écrit malgré la lecture seule\n' },
            { kind: 'text', text: 'Écriture acceptée.' }
          ],
          reject: [
            {
              kind: 'update',
              update: {
                sessionUpdate: 'tool_call_update',
                toolCallId: 'role_edit',
                status: 'failed'
              }
            },
            { kind: 'text', text: 'Écriture refusée : je reste en lecture seule.' }
          ]
        }
      }
    ]
  },
  'role-ecrit-sans-demander': {
    description:
      'Fille en lecture seule qui écrit `notes-role.md` sans rien demander, comme OpenCode réglé par défaut : Bobine le voit à la fin du tour',
    steps: [
      { kind: 'write-file', path: 'notes-role.md', content: 'écrit sans demander\n' },
      { kind: 'text', text: 'Fichier écrit sans demander.' }
    ]
  },
  'role-ecrit-sans-genre': {
    description:
      'Fille en lecture seule : outil annoncé `kind: edit`, puis une demande d’autorisation **sans** `kind` (forme permise par ACP) ; Bobine retient le genre annoncé et refuse',
    steps: [
      {
        kind: 'update',
        update: {
          sessionUpdate: 'tool_call',
          toolCallId: 'role_edit_bare',
          title: 'Writing file notes.md',
          kind: 'edit',
          status: 'pending'
        }
      },
      {
        kind: 'permission',
        toolCall: { toolCallId: 'role_edit_bare' },
        options: [
          { optionId: 'allow', name: 'Allow once', kind: 'allow_once' },
          { optionId: 'reject', name: 'Reject', kind: 'reject_once' }
        ],
        branches: {
          allow: [
            { kind: 'write-file', path: 'notes.md', content: 'écrit malgré la lecture seule\n' },
            { kind: 'text', text: 'Écriture acceptée.' }
          ],
          reject: [
            {
              kind: 'update',
              update: {
                sessionUpdate: 'tool_call_update',
                toolCallId: 'role_edit_bare',
                status: 'failed'
              }
            },
            { kind: 'text', text: 'Écriture refusée : je reste en lecture seule.' }
          ]
        }
      }
    ]
  }
}
