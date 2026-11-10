/**
 * Débordements horizontaux du fil (fiche 173) : tout ce qui peut être plus large que la colonne
 * de la conversation. Le fil ne doit jamais défiler de côté : le texte coupe ses mots trop longs,
 * les blocs qui en ont besoin (code, diff, tableau, terminal) défilent dans leur propre cadre.
 * Aucun n'est un relevé de Bob ou d'OpenCode : des formes plausibles, poussées à l'extrême.
 */
import type { Scenario, Step } from './scenario.mts'
import { terminalSteps } from './scenarios-limites.mts'

/** Mot de 400 caractères sans espace ni ponctuation où couper. */
export const LONG_WORD = 'Anticonstitutionnellement'.repeat(16)
const LONG_URL = `https://exemple.test/${'chemin/'.repeat(30)}fichier.html?${'cle=valeur&'.repeat(20)}fin=1`
const LONG_PATH = `/Users/dev/projets/${'dossier-tres-profond/'.repeat(14)}module-avec-un-nom-interminable.ts`
const LONG_CODE_LINE = `const configuration = { ${Array.from({ length: 40 }, (_, i) => `option${i}: ${i}`).join(', ')} }`

/** Image de 2 400 × 160 (SVG en base64), plus large que n'importe quelle fenêtre. */
const WIDE_IMAGE = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="2400" height="160"><rect width="2400" height="160" fill="#6a8caf"/><text x="20" y="90" font-size="48" fill="#fff">Image de 2400 px de large</text></svg>'
).toString('base64')

const TEXT = [
  `## Un titre très long qui ne contient qu’un seul mot : ${LONG_WORD.slice(0, 160)}`,
  '',
  `Mot sans espace : ${LONG_WORD}`,
  '',
  `Lien nu : ${LONG_URL}`,
  '',
  `Lien Markdown : [${LONG_URL}](${LONG_URL})`,
  '',
  `Chemin : ${LONG_PATH} et en code \`${LONG_PATH}\``,
  '',
  '```ts',
  LONG_CODE_LINE,
  '```',
  '',
  '| Colonne | Une cellule sans espace | Autre | Encore | Toujours | Fin |',
  '|---|---|---|---|---|---|',
  `| a | ${LONG_WORD.slice(0, 120)} | ${LONG_PATH} | valeur | valeur | valeur |`,
  '',
  '1. Une liste avec un bloc de code dedans :',
  '',
  '   ```sh',
  `   ${LONG_CODE_LINE}`,
  '   ```',
  '',
  '   - et une sous-liste avec un mot : ' + LONG_WORD.slice(0, 200),
  '',
  '> Citation : ' + LONG_URL,
  '',
  '```mermaid',
  'flowchart LR',
  `  ${Array.from({ length: 16 }, (_, i) => `N${i}[Étape numéro ${i} du traitement]`).join(' --> ')}`,
  '```',
  '',
  'Fin des débordements.'
].join('\n')

/** Douze fichiers modifiés en un tour : « Modifications 12 », un compte à deux chiffres (fiche 185, D25). */
const TWELVE_EDITS: Step[] = Array.from({ length: 12 }, (_, i) => ({
  kind: 'update' as const,
  update: {
    sessionUpdate: 'tool_call' as const,
    toolCallId: `call_edit_${i}`,
    title: `Modification de module-${i + 1}.ts`,
    kind: 'edit' as const,
    status: 'completed' as const,
    locations: [{ path: `/projet/src/module-${i + 1}.ts` }],
    content: [
      {
        type: 'diff' as const,
        path: `/projet/src/module-${i + 1}.ts`,
        oldText: `export const valeur = ${i}\n`,
        newText: `export const valeur = ${i + 1}\n`
      }
    ]
  }
}))

export const overflowScenarios: Record<string, Scenario> = {
  'douze-fichiers': {
    description:
      'Douze fichiers modifiés en un tour : compte à deux chiffres dans l’onglet Modifications (fiche 185)',
    steps: [...TWELVE_EDITS, { kind: 'text', text: 'Douze fichiers modifiés.' }]
  },
  debordements: {
    description:
      'Contenus plus larges que la colonne : mots, liens et chemins sans espace, code, tableau, liste avec code, Mermaid, diff, terminal, image, titre d’outil et sous-agent (outil `task` d’OpenCode) (fiche 173)',
    steps: [
      {
        kind: 'update',
        update: {
          sessionUpdate: 'tool_call',
          toolCallId: 'call_wide_edit',
          title: `Modification de ${LONG_PATH}`,
          kind: 'edit',
          status: 'completed',
          locations: [{ path: LONG_PATH }],
          content: [
            {
              type: 'diff',
              path: LONG_PATH,
              oldText: `${LONG_CODE_LINE}\nexport default configuration\n`,
              newText: `${LONG_CODE_LINE.replace('option0: 0', 'option0: 1')}\nexport default configuration\n`
            }
          ]
        }
      },
      {
        kind: 'update',
        update: {
          sessionUpdate: 'tool_call',
          toolCallId: 'call_wide_title',
          title: `grep ${LONG_WORD}`,
          kind: 'search',
          status: 'completed',
          rawInput: { pattern: LONG_WORD },
          content: [{ type: 'content', content: { type: 'text', text: LONG_URL } }]
        }
      },
      {
        kind: 'update',
        update: {
          sessionUpdate: 'tool_call',
          toolCallId: 'call_wide_image',
          title: 'Capture d’écran',
          kind: 'other',
          status: 'completed',
          content: [
            {
              type: 'content',
              content: { type: 'image', data: WIDE_IMAGE, mimeType: 'image/svg+xml' }
            }
          ]
        }
      },
      ...terminalSteps('term-wide', `ls -la ${LONG_PATH}`, [
        `${'colonne '.repeat(60)}\n${LONG_URL}\n`
      ]),
      ...subagent(),
      { kind: 'text', text: TEXT }
    ]
  }
}

/**
 * Un sous-agent à la façon d'OpenCode 1.19 (outil `task`, comme `sous-agent-opencode`) : titre,
 * consigne et résultat trop larges, dans la carte du sous-agent.
 */
function subagent(): Step[] {
  return [
    {
      kind: 'update',
      update: {
        sessionUpdate: 'tool_call',
        toolCallId: 'call_wide_task',
        title: `Explore ${LONG_PATH}`,
        kind: 'think',
        status: 'in_progress',
        rawInput: {
          description: `Explore ${LONG_PATH}`,
          prompt: `Cherche ${LONG_WORD} dans ${LONG_URL}`,
          subagent_type: 'general'
        }
      }
    },
    {
      kind: 'update',
      update: {
        sessionUpdate: 'tool_call_update',
        toolCallId: 'call_wide_task',
        status: 'completed',
        content: [
          {
            type: 'content',
            content: {
              type: 'text',
              text: `<task id="ses_wide" state="completed">\n<task_result>\nTrouvé : ${LONG_WORD}\n\n\`\`\`\n${LONG_CODE_LINE}\n\`\`\`\n</task_result>\n</task>`
            }
          }
        ]
      }
    }
  ]
}
