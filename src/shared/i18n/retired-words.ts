/**
 * Mots retirés de l'interface par le vocabulaire unique du travail délégué (fiche 266, règle 1 de
 * la fiche 260) : ce qu'on confie est un **travail** (« task »), fait par un rôle ou un autre agent,
 * qui rend une **réponse**. Liste lue par les essais des textes (`vocabulary.test.ts`) et du guide
 * (`guide-vocabulary.test.ts`) ; « sous-agent » / « subagent », un autre concept, n'y est pas.
 */

/** Mots retirés, en français. */
export const RETIRED_FR: readonly RegExp[] = [
  /\bfilles?\b/i,
  /sous-tâches?/i,
  /comptes? rendus?/i,
  /rend(?:re|u)? compte/i,
  /tâches? proposées?/i,
  /\bmère\b/i,
  /fini son tour/i,
  /finie, à lire/i
]

/** Mots retirés, en anglais. */
export const RETIRED_EN: readonly RegExp[] = [
  /\bchild(?:ren)?\b/i,
  /\bsub-?tasks?\b/i,
  /\bparent conversation\b/i,
  /\bits report\b/i,
  /finished its turn/i
]

/** Texte visible : sans le code entre accents graves (identifiants, `_meta[...]`). */
export const visibleText = (text: string): string => text.replace(/`[^`]*`/g, '')
