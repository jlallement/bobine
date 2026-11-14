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
  }
}
