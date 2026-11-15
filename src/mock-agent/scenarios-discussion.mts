/**
 * Scénarios de l'espace Discussion (fiche 224), d'après les relevés réels du 2026-11-14
 * (`docs/acp.md`) : Bob 2.1.0 lit un document déposé (`kind: read`), puis demande d'écrire un
 * document **sans `locations` dans sa demande** (elles sont dans le `tool_call` qui la précède) ;
 * Bobine l'accorde d'office dans les documents. Une écriture hors du dossier est refusée d'office.
 */
import type { Scenario, Step } from './scenario.mts'

const options = [
  { optionId: 'allow', name: 'Allow once', kind: 'allow_once' },
  { optionId: 'always', name: 'Always allow', kind: 'allow_always' },
  { optionId: 'reject', name: 'Reject', kind: 'reject_once' }
] as const

const done = (toolCallId: string, status: 'completed' | 'failed'): Step => ({
  kind: 'update',
  update: { sessionUpdate: 'tool_call_update', toolCallId, status }
})

/** Écriture comme Bob 2.1.0 : `tool_call` avec l'emplacement, demande sans emplacement. */
function bobEdit(toolCallId: string, path: string, content: string, written: string): Step[] {
  return [
    {
      kind: 'update',
      update: {
        sessionUpdate: 'tool_call',
        toolCallId,
        title: `Updating ${path}`,
        kind: 'edit',
        status: 'pending',
        locations: [{ path }],
        rawInput: { path, operation: 'batch' }
      }
    },
    {
      kind: 'permission',
      toolCall: { toolCallId, title: `Updating ${path}`, kind: 'edit' },
      options: [...options],
      branches: {
        allow: [{ kind: 'write-file', path: written, content }, done(toolCallId, 'completed')],
        always: [{ kind: 'write-file', path: written, content }, done(toolCallId, 'completed')],
        reject: [done(toolCallId, 'failed'), { kind: 'text', text: 'Écriture refusée.\n\n' }]
      }
    }
  ]
}

export const discussionScenarios: Record<string, Scenario> = {
  'discussion-document': {
    description:
      'Espace Discussion (fiche 224) : lit les documents, écrit `Synthèse.md` dans le dossier de la discussion (accordé d’office), puis tente d’écrire hors du dossier (refusé d’office)',
    steps: [
      {
        kind: 'update',
        update: {
          sessionUpdate: 'tool_call',
          toolCallId: 'disc_read',
          title: 'Reading {cwd}',
          kind: 'read',
          status: 'completed',
          locations: [{ path: '{cwd}' }]
        }
      },
      { kind: 'text', text: 'J’ai lu vos documents. Je prépare la synthèse.\n\n' },
      ...bobEdit(
        'disc_write',
        '{cwd}/Synthèse.md',
        '# Synthèse\n\nL’Ouest domine le trimestre.\n',
        'Synthèse.md'
      ),
      ...bobEdit('disc_outside', '{cwd}/../hors-discussion.md', 'hors\n', 'jamais.md'),
      { kind: 'text', text: 'Voici la synthèse : **Synthèse.md**, dans vos documents.' }
    ]
  },
  'discussion-lien-physique': {
    description:
      'Espace Discussion (fiche 230) : demande à modifier `Notes.md` du dossier de la discussion, comme Bob 2.1.0 ; quand ce fichier a d’autres noms (lien physique), Bobine pose la question au lieu de l’accorder d’office',
    steps: [
      ...bobEdit('disc_link', '{cwd}/Notes.md', 'réécrit par l’agent\n', 'Notes.md'),
      { kind: 'text', text: 'Terminé.' }
    ]
  },
  'discussion-commande': {
    description:
      'Espace Discussion (fiche 224, maquette E4) : demande à lancer une commande (`kind: execute`) pour fabriquer un document ; la carte la dit en clair, le détail replié',
    steps: [
      { kind: 'text', text: 'Je prépare le document Word.\n\n' },
      {
        kind: 'permission',
        toolCall: {
          toolCallId: 'disc_cmd',
          title: 'python3 make_report.py "Ventes T3.csv"',
          kind: 'execute',
          status: 'pending',
          rawInput: { command: 'python3 make_report.py "Ventes T3.csv"' }
        },
        options: [...options],
        branches: {
          allow: [done('disc_cmd', 'completed'), { kind: 'text', text: 'Document prêt.' }],
          always: [done('disc_cmd', 'completed'), { kind: 'text', text: 'Document prêt.' }],
          reject: [done('disc_cmd', 'failed'), { kind: 'text', text: 'Commande refusée.' }]
        }
      }
    ]
  }
}
