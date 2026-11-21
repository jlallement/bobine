/**
 * Vue des fichiers (fiche 271) : l'agent modifie un fichier suivi (diff ACP, point « modifié » dans
 * l'arbre), écrit une sortie ignorée par git (`build/`) et un `.env` aux valeurs factices, puis
 * répond avec un lien `fichier:ligne` (ouvert dans l'onglet Fichiers, à la ligne).
 */
import type { Scenario } from './scenario.mts'

const APP_OLD = 'export const a = 1\n'
const APP_NEW =
  'export const a = 1\n\nexport function somme(x: number, y: number) {\n  return x + y\n}\n'

export const filesScenarios: Record<string, Scenario> = {
  fichiers: {
    description:
      'Modifie src/app.ts (diff), écrit build/rapport.txt (ignoré), .env (valeurs factices) et liste.js, puis cite src/app.ts:3 en lien et `liste.js:2` en code (fiche 271)',
    steps: [
      { kind: 'write-file', path: 'src/app.ts', content: APP_NEW },
      { kind: 'write-file', path: 'build/rapport.txt', content: 'Rapport de build\n' },
      { kind: 'write-file', path: '.env', content: 'BOBINE_TEST_TOKEN=factice-0000\n' },
      { kind: 'write-file', path: 'liste.js', content: 'const liste = []\nliste.push(1)\n' },
      {
        kind: 'update',
        update: {
          sessionUpdate: 'tool_call',
          toolCallId: 'call_files_edit',
          title: 'Edit src/app.ts',
          kind: 'edit',
          status: 'completed',
          locations: [{ path: 'src/app.ts' }],
          content: [{ type: 'diff', path: 'src/app.ts', oldText: APP_OLD, newText: APP_NEW }]
        }
      },
      {
        kind: 'text',
        // Chemin sans dossier en code (`liste.js:2`) : un lien de fichier comme l'autre (fiche 271).
        text:
          'La fonction est dans [src/app.ts:3](src/app.ts:3) ; le rapport est dans `build/`. ' +
          'La ligne ajoutée est `liste.js:2`.'
      }
    ]
  }
}
