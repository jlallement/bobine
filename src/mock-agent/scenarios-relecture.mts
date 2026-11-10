/**
 * Scénarios du relecteur (fiche 177) : l'agent factice reçoit la consigne de relecture de l'app
 * (« Code review request from Bobine. », reconnue par `pickScenario`) et rend ses remarques par
 * l'outil `report_findings` du serveur MCP de l'app, comme le ferait un vrai modèle.
 */
import type { Scenario, Step } from './scenario.mts'

/** Ce que l'outil a répondu, cité dans le fil du relecteur. */
const said = (lead: string) => (text: string) => [
  { kind: 'text', text: `${lead}\n\n> ${text.split('\n').join('\n> ')}` } as const
]

/**
 * Remarques sur ce que laisse le scénario `modifications` (src/app.js créé, README.md modifié) :
 * une haute sur une ligne, une mineure sur une plage.
 */
const FINDINGS = [
  {
    file: 'src/app.js',
    line: 2,
    severity: 'high',
    category: 'correctness',
    title: 'Le message est écrit en dur',
    why: 'main() affiche toujours « bonjour » : le nom passé en argument est ignoré. Lire process.argv[2].'
  },
  {
    file: 'src/app.js',
    line: 1,
    endLine: 3,
    severity: 'low',
    category: 'simplification',
    title: 'Fonction exportée jamais importée',
    why: 'main() n’est utilisée nulle part : l’appeler directement suffit.'
  }
]

const report = (findings: unknown[], summary: string, lead: string): Step => ({
  kind: 'mcp-tool',
  tool: 'report_findings',
  args: { findings, summary },
  onResult: said(lead)
})

export const reviewScenarios: Record<string, Scenario> = {
  relecture: {
    description:
      'Relecteur (fiche 177) : lit la consigne de relecture, puis rend deux remarques sur src/app.js par `report_findings` (aucune si la consigne ne cite pas ce fichier)',
    steps: [
      { kind: 'text', text: 'Je relis le diff, sans rien modifier. ' },
      {
        kind: 'when-prompt',
        includes: 'src/app.js',
        then: [
          report(
            FINDINGS,
            'Une erreur à corriger avant de fusionner.',
            'Deux remarques rendues : une à corriger avant de fusionner.'
          )
        ],
        else: [report([], 'Rien à signaler.', 'Rien à signaler.')]
      }
    ]
  },
  'relecture-vide': {
    description: 'Relecteur (fiche 177) : rien à signaler, `report_findings` avec une liste vide',
    steps: [report([], 'Rien à signaler : le diff est correct.', 'Relu : rien à signaler.')]
  },
  'relecture-muette': {
    description:
      'Relecteur (fiche 177) : répond en texte libre sans appeler `report_findings` (carte « sans remarques structurées »)',
    steps: [{ kind: 'text', text: 'J’ai relu : ça me semble correct.' }]
  },
  'relecture-modifie': {
    description:
      'Relecteur fautif (fiche 177) : crée un fichier dans le dossier relu, puis rend une remarque ; l’app le signale',
    steps: [
      { kind: 'edit-file', path: 'relecture.txt', content: 'Je n’aurais pas dû écrire ici.\n' },
      report([FINDINGS[0]], 'Une erreur.', 'Une remarque rendue.')
    ]
  }
}
