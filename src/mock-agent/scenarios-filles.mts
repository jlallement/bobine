/**
 * Scénarios de la mère tech lead (fiche 160) : une fille lancée avec un modèle et une raison,
 * vérifiée, corrigée par `message_child`, puis recommandée ; une fille bavarde dont le compte rendu
 * reste borné. Rangés à part : le catalogue de `scenarios.mts` est déjà long.
 */
import type { Scenario, Step } from './scenario.mts'

/** Fichiers modifiés par `fille-bavarde` : bien plus que ceux qu'un compte rendu cite. */
export const CHATTY_FILES = 30
/**
 * Fin de la longue réponse de `fille-bavarde` : n'atteint jamais la mère par le compte rendu, seulement
 * quand elle la demande par `child_status` `full` (fiche 247).
 */
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
      'Je recommande de fusionner « Import CSV » : à toi de la fusionner depuis sa carte.'
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

/**
 * Fiche 264 : un travail proposé par `start_child`, sans rien dire de plus (la carte de groupe le
 * montre). `role` : un rôle de l'Équipe.
 */
const work = (title: string, prompt: string, role?: string): Step[] => [
  {
    kind: 'mcp-tool',
    tool: 'start_child',
    args: { title, prompt, ...(role ? { role } : {}) },
    onResult: () => []
  }
]

/** Les trois travaux de la maquette D (fiche 264) : un rôle qui écrit, un sans rôle, un avis. */
const GROUP_WORKS = {
  sort: 'Tri des articles par rayon',
  tests: 'Tests de la sauvegarde locale',
  a11y: 'Relire l’accessibilité de l’écran'
} as const

/** Réveil de la mère des trois travaux : elle recommande les deux branches, sans fusionner. */
const groupWake: Step[] = [
  {
    kind: 'mcp-tool',
    tool: 'recommend_merge',
    args: { child: GROUP_WORKS.sort, ready: true, note: 'Tri relu, tests verts.' },
    onResult: () => [
      {
        kind: 'mcp-tool',
        tool: 'recommend_merge',
        args: { child: GROUP_WORKS.tests, ready: true, note: 'Tests relus.' },
        onResult: () => [
          {
            kind: 'text',
            text: 'Les trois travaux ont répondu. Je recommande de fusionner le tri et les tests ; l’avis sur l’accessibilité est à appliquer ensuite.'
          }
        ]
      }
    ]
  }
]

export const childScenarios: Record<string, Scenario> = {
  'travaux-groupe': {
    description:
      'Carte de groupe (fiche 264, maquette D) : trois `start_child` à la fois — « Tri des articles par rayon » (Architecte front, écrit `src/rayons.js`), « Tests de la sauvegarde locale » (sans rôle, écrit `test/stockage.test.js`), « Relire l’accessibilité de l’écran » (Expert UX/UI, long avis) ; au réveil, `recommend_merge` des deux branches',
    steps: [
      {
        kind: 'when-prompt',
        includes: WAKE,
        then: groupWake,
        else: [
          { kind: 'text', text: 'Je peux découper la suite en trois travaux indépendants :' },
          {
            kind: 'parallel',
            branches: [
              work(
                GROUP_WORKS.sort,
                'Ajoute un tri par rayon.\n/scenario rayons',
                'front-architect'
              ),
              work(GROUP_WORKS.tests, 'Teste la sauvegarde locale.\n/scenario tests-stockage'),
              work(GROUP_WORKS.a11y, 'Relis l’accessibilité.\n/scenario avis-long', 'ux-ui-expert')
            ]
          },
          { kind: 'text', text: '\n\nJe m’arrête là : je serai réveillé quand ils auront fini.' }
        ]
      }
    ]
  },
  rayons: {
    description:
      'Travail qui écrit (fiche 264) : crée `src/rayons.js` (tri par rayon), puis le résume ; à committer par l’essai',
    steps: [
      {
        kind: 'edit-file',
        path: 'src/rayons.js',
        content: "export const RAYONS = ['Frais', 'Épicerie', 'Maison', 'Autre']\n"
      },
      {
        kind: 'text',
        text: 'Les articles ont maintenant un rayon (Frais, Épicerie, Maison, Autre) ; la liste est groupée par rayon, dans cet ordre.'
      }
    ]
  },
  'tests-stockage': {
    description:
      'Travail qui écrit, sans rôle (fiche 264) : crée `test/stockage.test.js`, puis le résume ; à committer par l’essai',
    steps: [
      {
        kind: 'edit-file',
        path: 'test/stockage.test.js',
        content: "test('sauvegarde locale', () => expect(load(save([]))).toEqual([]))\n"
      },
      { kind: 'text', text: 'Deux tests de la sauvegarde locale ajoutés.' }
    ]
  },
  'fusion-trois': {
    description:
      'Trois `start_child` à la fois (fiches 120, 264) : « Import CSV » (`modifications`), « Page d’aide » et « Notes de version » (`echo`) ; au réveil, dit qu’ils ont fini',
    steps: [
      {
        kind: 'when-prompt',
        includes: WAKE,
        then: [{ kind: 'text', text: 'Les trois travaux ont fini : à vous de fusionner.' }],
        else: [
          {
            kind: 'parallel',
            branches: [
              work('Import CSV', 'Ajoute l’import.\n/scenario modifications'),
              work('Page d’aide', 'Écris la page.\n/scenario echo Page d’aide'),
              work('Notes de version', 'Rédige les notes.\n/scenario echo Notes de version')
            ]
          },
          { kind: 'text', text: 'Trois travaux proposés.' }
        ]
      }
    ]
  },
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
      'Mère d’une fille bavarde (fiche 160) : la lance (`start_child`) ; au réveil, dit si le compte rendu reçu est borné (fichiers comptés, pas la fin de la réponse), puis lit la réponse entière par `child_status` `full` comme le compte rendu l’y invite (fiche 247)',
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
                    text: 'Compte rendu borné : 8 fichiers cités, les autres comptés, le début du récapitulatif seulement. '
                  },
                  // Fiche 247 (D11) : le compte rendu coupé dit comment lire la suite ; la mère la lit.
                  {
                    kind: 'when-prompt',
                    includes: 'call child_status with {"child": ',
                    then: [
                      {
                        kind: 'mcp-tool',
                        tool: 'child_status',
                        args: { child: 'Relevé bavard', full: true },
                        onResult: (text) => [
                          {
                            kind: 'text',
                            text: text.includes(CHATTY_END)
                              ? `Suite lue par child_status : réponse entière, jusqu’à ${CHATTY_END}.`
                              : 'Suite introuvable par child_status.'
                          }
                        ]
                      }
                    ],
                    else: [{ kind: 'text', text: 'Rien ne dit comment lire la suite.' }]
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
