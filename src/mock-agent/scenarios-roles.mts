/**
 * Scénarios des rôles (fiche 223) : une mère qui délègue à un rôle ou nomme un rôle inconnu ; une
 * fille en lecture seule qui demande à écrire (refus de Bobine) ou qui écrit sans demander, comme
 * OpenCode réglé par défaut (le garde-fou de Bobine le voit). Le mode natif se vérifie avec `echo`
 * (mode de la session et message reçu).
 */
import { FREE_USAGE_LIMIT, type Scenario, type Step } from './scenario.mts'

/** Résultat d'un outil de l'app, cité dans le fil. */
const said = (lead: string) => (text: string) => [
  { kind: 'text', text: `${lead}\n\n> ${text.split('\n').join('\n> ')}` } as const
]

/** Une lecture annoncée puis finie (`tool_call` puis `completed`) : l'activité de la carte. */
const read = (id: string, path: string): Step[] => [
  {
    kind: 'update',
    update: {
      sessionUpdate: 'tool_call',
      toolCallId: id,
      title: `Lecture de ${path}`,
      kind: 'read',
      status: 'in_progress',
      locations: [{ path }],
      rawInput: { path }
    }
  },
  { kind: 'pause', ticks: 3 },
  {
    kind: 'update',
    update: { sessionUpdate: 'tool_call_update', toolCallId: id, status: 'completed' }
  }
]

/**
 * Avis long d'un rôle de conseil (fiche 263) : deux lectures, puis une réponse en Markdown de plus
 * de dix lignes (titres, listes, code) — la carte-réponse la replie, « Lire la suite » la déplie.
 */
const LONG_ADVICE = [
  '### Direction : « Le carnet de courses calme »',
  '',
  'L’appli fonctionne, mais elle ressemble à un formulaire. Je propose un carnet : une seule colonne, beaucoup d’air, et la coche comme geste principal.',
  '',
  '#### Palette',
  '',
  '- Papier `#f6f1e7` en fond, encre `#2f3a2f` pour le texte.',
  '- Sauge `#7a9a6b` pour la coche et l’ajout, rien d’autre en couleur.',
  '',
  '#### Mise en page',
  '',
  '- Champ d’ajout en haut, collé, toujours visible ; Entrée ajoute.',
  '- Articles cochés barrés et descendus en bas, sous « Dans le panier ».',
  '- Compteur discret « 4 sur 11 » sous le titre, au lieu du badge actuel.',
  '',
  '#### Typographie et détails',
  '',
  '- Une seule police, 17 px, interligne large ; cibles de 44 px sur mobile.',
  '- Transitions de 150 ms au plus, aucune si les animations sont réduites.',
  '',
  '```css',
  ':root { --paper: #f6f1e7; --ink: #2f3a2f; --sage: #7a9a6b; }',
  '```',
  '',
  'FIN-DE-L-AVIS'
].join('\n')

/**
 * Commande longue d'un travail (recette N4, fiche 267 ; vue avec DeepSeek) : un `node - <<'JS'` de
 * dix lignes, titre de l'outil compris — la carte n'en montre que la première ligne, coupée.
 */
export const LONG_COMMAND = [
  "node - <<'JS'",
  'function lum(hex){',
  '  const n = parseInt(hex.slice(1), 16)',
  '  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => v / 255)',
  '  return c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))',
  '}',
  "const pairs = [['#2f3a2f', '#f6f1e7'], ['#7a9a6b', '#f6f1e7']]",
  'for (const [a, b] of pairs) console.log(a, b, ratio(lum(a), lum(b)).toFixed(2))',
  'JS'
].join('\n')

export const roleScenarios: Record<string, Scenario> = {
  'commande-longue': {
    description:
      'Travail qui lance une commande de dix lignes (recette N4, fiche 267) : l’outil reste en cours ≈ 6 s (la carte n’en montre que la première ligne, la commande entière en infobulle), puis une réponse courte',
    steps: [
      {
        kind: 'update',
        update: {
          sessionUpdate: 'tool_call',
          toolCallId: 'commande_longue',
          title: LONG_COMMAND,
          kind: 'execute',
          status: 'in_progress',
          rawInput: { command: LONG_COMMAND }
        }
      },
      { kind: 'pause', ticks: 150 },
      {
        kind: 'update',
        update: {
          sessionUpdate: 'tool_call_update',
          toolCallId: 'commande_longue',
          status: 'completed'
        }
      },
      { kind: 'text', text: 'Contrastes calculés : 9,8:1 et 3,4:1.' }
    ]
  },
  'quota-gratuit': {
    description:
      'Quota gratuit épuisé (recette N3, fiche 267, comme OpenCode 2.3.0) : avec factice-rapide (modèle par défaut), le message est refusé par l’erreur exacte relevée (-32603 « Internal error: Free usage limit reached… ») ; factice-precis répond',
    steps: [
      {
        kind: 'when-model',
        model: 'factice-rapide',
        then: [FREE_USAGE_LIMIT],
        else: [{ kind: 'text', text: 'Ce modèle a encore du quota, je peux répondre.' }]
      }
    ]
  },
  'avis-long': {
    description:
      'Avis long d’un rôle (fiche 263) : deux lectures, puis une réponse en Markdown de plus de dix lignes, qui finit par `FIN-DE-L-AVIS` ; une suite « Et les contrastes ? » : une lecture et une réponse courte ; « Vérifie la base » : le tour échoue ; la mère qui reçoit la réponse (`<child_conversations>`) : « C’est appliqué… »',
    steps: [
      {
        kind: 'when-prompt',
        includes: '<child_conversations>',
        then: [
          ...read('applique_lecture', 'src/style.css'),
          {
            kind: 'text',
            text: 'C’est appliqué : fond papier, coche sauge, champ d’ajout collé en haut, articles cochés regroupés sous « Dans le panier ».'
          }
        ],
        else: [
          {
            // Une demande qui échoue (carte « en erreur », fiche 263) : le tour finit en erreur.
            kind: 'when-prompt',
            includes: 'Vérifie la base',
            then: [{ kind: 'fail', message: 'Base injoignable : connexion refusée (simulée).' }],
            else: [
              {
                kind: 'when-prompt',
                includes: 'Et les contrastes',
                then: [
                  ...read('avis_contraste', 'src/style.css'),
                  {
                    kind: 'text',
                    text: 'Contrastes vérifiés : l’encre sur le papier passe AA (9,8:1), la sauge sur le papier aussi pour les grands textes (3,4:1). Pour la coche seule, foncer la sauge en `#5f7f52`.'
                  }
                ],
                else: [
                  ...read('avis_lecture_1', 'src/style.css'),
                  ...read('avis_lecture_2', 'src/main.ts'),
                  { kind: 'text', text: LONG_ADVICE }
                ]
              }
            ]
          }
        ]
      }
    ]
  },
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
