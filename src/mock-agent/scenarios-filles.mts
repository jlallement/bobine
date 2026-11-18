/**
 * Scénarios de la mère tech lead (fiche 160) : une fille lancée avec un modèle et une raison,
 * vérifiée, corrigée par `message_child`, puis recommandée ; une fille bavarde dont le compte rendu
 * reste borné. Rangés à part : le catalogue de `scenarios.mts` est déjà long.
 */
import type { Scenario, Step } from './scenario.mts'

/** Fichiers modifiés par `fille-bavarde` : bien plus que ceux qu'un compte rendu cite. */
export const CHATTY_FILES = 30
/** Fin de la longue réponse de `fille-bavarde` : ne doit jamais atteindre la mère. */
export const CHATTY_END = 'MARQUEUR-FIN-DE-REPONSE'

const WAKE = 'have finished their turn'

/** Résultat d'un outil de l'app, cité dans le fil de la mère. */
const said = (lead: string) => (text: string) => [
  { kind: 'text', text: `${lead}\n\n> ${text.split('\n').join('\n> ')}` } as const
]

/** Premier réveil : la mère relit, renvoie une correction, dit que la branche n'est pas prête. */
const review: Step[] = [
  { kind: 'text', text: 'Je relis la branche de « Import CSV » avant de conclure. ' },
  {
    kind: 'mcp-tool',
    tool: 'message_child',
    args: {
      child: 'Import CSV',
      message:
        'Correction demandée.\n/scenario fille-corrigee\n\nIl manque un test du séparateur : ajoute-le.'
    },
    onResult: (sent) => [
      {
        kind: 'mcp-tool',
        tool: 'recommend_merge',
        args: { child: 'Import CSV', ready: false, note: 'Il manque un test du séparateur.' },
        onResult: (text) => said(`Correction envoyée. ${sent}`)(text)
      }
    ]
  }
]

/** Second réveil, après la correction : la mère recommande la fusion, sans fusionner. */
const approve: Step[] = [
  {
    kind: 'mcp-tool',
    tool: 'recommend_merge',
    args: {
      child: 'Import CSV',
      ready: true,
      note: 'Branche relue : le test du séparateur est là, rien hors de src/.'
    },
    onResult: said(
      'Je recommande de fusionner « Import CSV » : à toi de la fusionner depuis « Sous-tâches ».'
    )
  }
]

/** Lancement : un agent inconnu d'abord (erreur claire), puis la fille avec un modèle choisi. */
const launch: Step[] = [
  {
    kind: 'mcp-tool',
    tool: 'start_child',
    args: {
      title: 'Import CSV',
      prompt: 'Consigne de test.\n/scenario modifications',
      agent: 'agent-inconnu'
    },
    onResult: (refused) => [
      { kind: 'text', text: `Agent refusé : ${refused}\n\n` },
      {
        kind: 'mcp-tool',
        tool: 'start_child',
        args: {
          title: 'Import CSV',
          prompt: 'Consigne de test.\n/scenario modifications',
          model: 'factice-precis',
          why: 'import délicat, modèle précis'
        },
        onResult: said('Fille proposée avec le modèle précis. Je m’arrête en attendant.')
      }
    ]
  }
]

/** Une longue réponse : un récapitulatif au début, du détail, puis la fin marquée. */
const chattyReply = [
  'Récapitulatif : 30 fichiers de relevé créés, rien d’autre touché.',
  '',
  ...Array.from({ length: 80 }, (_, i) => `- détail ${i + 1} : une ligne de plus pour rien.`),
  '',
  CHATTY_END
].join('\n')

/**
 * Fiche 240 : la fille dit si elle voit `plan.md`, le travail non commité de sa mère dans les
 * essais. Dans son worktree, elle ne le voit que si la mère l'a commité ; en avis (lecture seule,
 * dossier de la mère), toujours.
 */
const seesPlan: Step[] = [
  {
    kind: 'when-file',
    path: 'plan.md',
    then: [{ kind: 'text', text: 'Récapitulatif : je vois plan.md, le plan de la mère.' }],
    else: [{ kind: 'text', text: 'Récapitulatif : je ne trouve pas plan.md dans mon dossier.' }]
  }
]

export const childScenarios: Record<string, Scenario> = {
  'voit-le-plan': {
    description:
      'Dit si `plan.md` est dans le dossier de la session : une fille partie d’un dossier modifié le voit-elle ? (fiche 240)',
    steps: seesPlan
  },
  'tache-plan': {
    description:
      'Propose une conversation fille (`start_child`) qui dira si elle voit `plan.md`, puis finit son tour (fiche 240)',
    steps: [
      {
        kind: 'when-prompt',
        includes: WAKE,
        then: [{ kind: 'text', text: 'La fille a rendu son compte rendu.' }],
        else: [
          {
            kind: 'mcp-tool',
            tool: 'start_child',
            args: { title: 'API et tests', prompt: 'Écris l’API.\n/scenario voit-le-plan' },
            onResult: said('Tâche proposée.')
          }
        ]
      }
    ]
  },
  'filles-modele': {
    description:
      'Modèle de fille suggéré (fiche 160) : `start_child` avec `model: factice-precis` et une raison. Profil sans choix de modèle (`MOCK_CHILD_MODEL=none`, comme Bob) : ignoré, carte sans modèle ; sinon, carte où l’utilisateur confirme ou change le modèle',
    steps: [
      {
        kind: 'mcp-tool',
        tool: 'start_child',
        args: {
          title: 'Relecture',
          prompt: 'Consigne de test.\n/scenario streaming-texte',
          model: 'factice-precis',
          why: 'relecture fine'
        },
        onResult: said('Modèle suggéré pour la fille.')
      }
    ]
  },
  'filles-tech-lead': {
    description:
      'Mère tech lead (fiche 160) : `start_child` avec un agent inconnu (erreur), puis avec un modèle et une raison ; au réveil, correction par `message_child` et `recommend_merge` « pas prête » ; au réveil suivant, recommandation « prête » (la fusion reste à l’utilisateur)',
    steps: [
      {
        kind: 'when-prompt',
        includes: 'Correction faite',
        then: approve,
        else: [{ kind: 'when-prompt', includes: WAKE, then: review, else: launch }]
      }
    ]
  },
  'fille-corrigee': {
    description:
      'Fille corrigée (fiche 160) : ajoute un test (`test/separateur.test.js`) puis commence sa réponse par « Correction faite »',
    steps: [
      {
        kind: 'edit-file',
        path: 'test/separateur.test.js',
        content: "test('séparateur', () => expect(parse('a;b')).toEqual(['a', 'b']))\n"
      },
      { kind: 'text', text: 'Correction faite : test du séparateur ajouté.' }
    ]
  },
  'fille-bavarde': {
    description: `Fille bavarde (fiche 160) : ${CHATTY_FILES} fichiers créés et une très longue réponse terminée par ${CHATTY_END} ; son compte rendu doit rester borné`,
    steps: [
      ...Array.from({ length: CHATTY_FILES }, (_, i): Step => ({
        kind: 'edit-file',
        path: `releve/fichier-${String(i + 1).padStart(2, '0')}.md`,
        content: `# Relevé ${i + 1}\n`
      })),
      { kind: 'text', text: chattyReply }
    ]
  },
  'filles-bavarde': {
    description:
      'Mère d’une fille bavarde (fiche 160) : la lance (`start_child`) ; au réveil, dit si le compte rendu reçu est borné (fichiers comptés, pas la fin de la réponse)',
    steps: [
      {
        kind: 'when-prompt',
        includes: WAKE,
        then: [
          {
            kind: 'when-prompt',
            includes: CHATTY_END,
            then: [{ kind: 'text', text: 'Compte rendu non borné : la fin de la réponse est là.' }],
            else: [
              {
                kind: 'when-prompt',
                includes: `and ${CHATTY_FILES - 8} more`,
                then: [
                  {
                    kind: 'text',
                    text: 'Compte rendu borné : 8 fichiers cités, les autres comptés, le début du récapitulatif seulement.'
                  }
                ],
                else: [{ kind: 'text', text: 'Compte rendu inattendu.' }]
              }
            ]
          }
        ],
        else: [
          {
            kind: 'mcp-tool',
            tool: 'start_child',
            args: { title: 'Relevé bavard', prompt: 'Consigne de test.\n/scenario fille-bavarde' },
            onResult: said('Fille proposée.')
          }
        ]
      }
    ]
  }
}
