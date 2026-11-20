/**
 * Consommation et modèle tels qu'OpenCode 2.3.0 les a rapportés pendant la recette du 2026-11-17
 * (fiche 245). Valeurs copiées des tours réels : `agents.log` (taille et `used/size` de chaque
 * `usage_update`, taille de la réponse à `session/prompt`) et `usage.sqlite` (jetons et coût de
 * chaque tour) du profil de la recette ; forme des messages : traces `__traces__/opencode-2.3.0`.
 *
 * - `usage` de la réponse à `session/prompt` : `inputTokens` **hors cache**, `cachedReadTokens`,
 *   `thoughtTokens` à part, `totalTokens` = leur somme avec la sortie (D6).
 * - `usage_update` : `used`, `size` et un **coût** en dollars calculé par OpenCode d'après ses tarifs,
 *   même avec un abonnement ChatGPT (D8) ; `0` pour les filles.
 * - Modèles en liste plate « fournisseur/Nom » ; une session neuve peut annoncer un autre modèle
 *   courant que celui d'une conversation déjà ouverte (D16).
 */
import type { Scenario } from './scenario.mts'

/** Tour de la mère à 19:54:43Z : 143,6 s, `usage_update 19711/1050000`. */
export const MOTHER_TURN = {
  usage: {
    inputTokens: 28_149,
    outputTokens: 6_906,
    cachedReadTokens: 96_384,
    thoughtTokens: 447,
    totalTokens: 131_886
  },
  cost: 0.007455,
  context: { used: 19_711, size: 1_050_000 }
}

/** Premier tour d'une fille à 20:01:06Z : coût annoncé, mais nul ; `usage_update 7377/400000`. */
export const CHILD_TURN = {
  usage: {
    inputTokens: 5_255,
    outputTokens: 262,
    cachedReadTokens: 29_952,
    thoughtTokens: 77,
    totalTokens: 35_546
  },
  cost: 0,
  context: { used: 7_377, size: 400_000 }
}

/** Les deux modèles de l'essai de l'accueil de la recette (noms de `opencode models`). */
const ASTRA = { value: 'openai/gpt-6.2-astra', name: 'openai/GPT-6.2 Astra' }
const HY4 = { value: 'opencode/hy4-flash-free', name: 'opencode/Hy4 flash Free' }
const LUNA = { value: 'openai/gpt-6-luna', name: 'openai/GPT-6 Luna' }

/**
 * Deuxième `/compact` de l'exploration OpenCode 2.3.0 du 2026-11-19 (fiche 257, `agents.log`,
 * session `…geVZPiMc`) : `usage_update 38271/628000` à la fin du tour d'avant ; puis
 * `compaction_update` `in_progress`, le résumé en morceaux, `compaction_update` `completed` avec le
 * résumé, et une réponse `end_turn` **sans `usage` ni `usage_update`** ; au tour suivant,
 * `usage_update 11965/628000`. Les jetons des tours ne sont pas dans le journal (résumé) : ceux du
 * tour de la mère de la fiche 245, seul le contexte compte ici.
 */
const COMPACTION_SIZE = 628_000
/**
 * Dans la recette, le fil faisait l'essentiel du contexte avant chaque `/compact` (rapport, D2 :
 * « Messages » 20,5k pour 26,1k au premier, « Agent » 4,7k pour 38,3k au second). Une réponse de
 * ≈ 28 000 jetons (≈ 4 caractères par jeton) redonne cette proportion sans rejouer les outils.
 */
const BEFORE_COMPACTION_REPLY =
  'Les deux branches sont prêtes à fusionner.\n\n' +
  '- Fichier relu : tests verts, aucune modification en attente.\n'.repeat(1_800)
const COMPACTION_SUMMARY =
  '## Objective\n- Ajouter un endpoint de rappels à l’API et documenter le projet.\n\n' +
  '## Work State\n### Completed\n- Endpoint `/reminders` et ses tests, README.\n' +
  '### Active\n- Relecture des deux branches avant fusion.\n\n' +
  '## Next Move\n1. Fusionner les deux branches dans main.\n'

/** Modèles nommés avec leur fournisseur, comme OpenCode (fiche 266, D12 et D31). */
const SOL = { value: 'openai/gpt-6.1-sol', name: 'openai/GPT-6.1 Sol' }
const SOL_NEXT = { value: 'openai/gpt-6.2-sol', name: 'openai/GPT-6.2 Sol' }
const SOL_MINI = { value: 'openai/gpt-6-mini', name: 'openai/GPT-6 mini' }
const TIDEPOOL = { value: 'opencode/tidepool-alpha-free', name: 'opencode/Tidepool Alpha Free' }
const PROVIDER_MODELS = [SOL, SOL_NEXT, SOL_MINI, TIDEPOOL]

export const consumptionScenarios: Record<string, Scenario> = {
  'cout-nul-payant': {
    description:
      'Modèle payant connecté par abonnement, comme OpenCode et GPT-6.1 Sol (recette du 19 novembre, D12) : usage_update annonce un coût nul ; l’app dit « coût inconnu », jamais « gratuit » (fiche 266)',
    steps: [{ kind: 'text', text: 'C’est fait : le carnet est rangé par rayon.' }],
    session: { models: { options: PROVIDER_MODELS, start: SOL.value } },
    turnUsage: { usage: MOTHER_TURN.usage, cost: 0, context: { used: 18_400, size: 400_000 } }
  },
  'connexion-a-faire-fournisseur': {
    description:
      'Modèle d’un fournisseur non connecté (D31, fiche 266) : avec openai/GPT-6.2 Sol, le message est refusé (authRequired) ; les autres modèles openai sont marqués « connexion sans doute à faire », pas Tidepool Alpha Free ni le modèle choisi',
    session: {
      expiredLogin: 'terminal',
      models: { options: PROVIDER_MODELS, start: SOL_NEXT.value }
    },
    steps: [
      {
        kind: 'when-model',
        model: SOL_NEXT.value,
        then: [{ kind: 'login-required' }, { kind: 'text', text: 'Reconnecté, je peux répondre.' }],
        else: [{ kind: 'text', text: 'Ce modèle est connecté, je peux répondre.' }]
      }
    ]
  },
  'contexte-opencode': {
    description:
      'Tour d’OpenCode 2.3.0 avant un /compact (fiche 257) : usage_update 38271/628000 ; /compact joue ensuite compaction-opencode',
    // Un seul morceau : un texte de cette taille découpé en mots ralentirait les essais.
    steps: [
      {
        kind: 'update',
        update: {
          sessionUpdate: 'agent_message_chunk',
          content: { type: 'text', text: BEFORE_COMPACTION_REPLY }
        }
      }
    ],
    turnUsage: {
      usage: MOTHER_TURN.usage,
      cost: 0,
      context: { used: 38_271, size: COMPACTION_SIZE }
    },
    compactWith: 'compaction-opencode'
  },
  'compaction-opencode': {
    description:
      '/compact comme OpenCode 2.3.0 (fiche 257) : compaction_update et résumé, puis fin de tour sans usage ni usage_update',
    steps: [
      {
        kind: 'update',
        update: {
          sessionUpdate: 'compaction_update',
          compactionId: 'msg_compact',
          status: 'in_progress'
        }
      },
      {
        kind: 'update',
        update: {
          sessionUpdate: 'compaction_summary_chunk',
          compactionId: 'msg_compact',
          content: { type: 'text', text: COMPACTION_SUMMARY }
        }
      },
      {
        kind: 'update',
        update: {
          sessionUpdate: 'compaction_update',
          compactionId: 'msg_compact',
          status: 'completed',
          summary: [{ type: 'text', text: COMPACTION_SUMMARY }]
        }
      }
    ],
    withoutUsage: true
  },
  'apres-compaction-opencode': {
    description:
      'Tour d’OpenCode 2.3.0 qui suit un /compact (fiche 257) : le contexte est enfin chiffré, usage_update 11965/628000',
    steps: [{ kind: 'text', text: 'Le dernier commit de main est la fusion des deux branches.' }],
    turnUsage: {
      usage: MOTHER_TURN.usage,
      cost: 0,
      context: { used: 11_965, size: COMPACTION_SIZE }
    }
  },
  'jetons-opencode': {
    description:
      'Consommation d’un tour comme OpenCode 2.3.0 (fiche 245) : entrée hors cache, cache et réflexion à part, total = leur somme ; coût en dollars annoncé par usage_update',
    steps: [{ kind: 'text', text: 'Plan prêt : API, page web et application iOS.' }],
    turnUsage: MOTHER_TURN
  },
  'jetons-opencode-fille': {
    description:
      'Tour d’une fille comme OpenCode 2.3.0 (fiche 245) : jetons comptés, coût annoncé mais nul',
    steps: [{ kind: 'text', text: 'Avis rendu.' }],
    turnUsage: CHILD_TURN
  },
  'essai-autre-modele': {
    description:
      'Modèles en liste plate comme OpenCode (fiche 245, D16) : une session neuve annonce opencode/Hy4 flash Free ; GPT-6.2 Astra et GPT-6 Luna sont proposés',
    steps: [{ kind: 'text', text: 'OK' }],
    session: { models: { options: [ASTRA, LUNA, HY4], start: HY4.value } }
  },
  'essai-modele-absent': {
    description:
      'Comme essai-autre-modele, mais seul opencode/Hy4 flash Free est proposé (fiche 245, D16) : le modèle de la conversation ne peut pas être appliqué',
    steps: [{ kind: 'text', text: 'OK' }],
    session: { models: { options: [HY4], start: HY4.value } }
  }
}
