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

export const consumptionScenarios: Record<string, Scenario> = {
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
