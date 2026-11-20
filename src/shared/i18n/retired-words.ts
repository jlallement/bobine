/**
 * Mots retirés de l'interface par le vocabulaire unique du travail délégué (fiche 266, règle 1 de
 * la fiche 260) : ce qu'on confie est un **travail** (« task »), fait par un rôle ou un autre agent,
 * qui rend une **réponse** ; il vient de sa **conversation d'origine**. Liste lue par les essais
 * des textes (`vocabulary.test.ts`) et du guide (`guide-vocabulary.test.ts`) ; « sous-agent » /
 * « subagent », un autre concept, n'y est pas.
 */

/** Mots retirés, en français. */
export const RETIRED_FR: readonly RegExp[] = [
  /(?:^|[^\p{L}])filles?(?![\p{L}])/iu,
  /sous-tâches?/iu,
  /comptes? rendus?/iu,
  /rend(?:re|u)? compte/iu,
  /tâches? proposées?/iu,
  /(?:^|[^\p{L}])mères?(?![\p{L}])/iu,
  /fini son tour/iu,
  /finie, à lire/iu,
  /coût non communiqué/iu,
  /qui l’a lancé/iu
]

/** Mots retirés, en anglais. */
export const RETIRED_EN: readonly RegExp[] = [
  /(?:^|[^\p{L}])child(?:ren)?(?![\p{L}])/iu,
  /(?:^|[^\p{L}])sub-?tasks?(?![\p{L}])/iu,
  /parent conversation/iu,
  /(?:^|[^\p{L}])its report(?![\p{L}])/iu,
  /finished its turn/iu,
  /cost not reported/iu,
  /that started it/iu
]

/** Fin d'un travail : « a répondu », jamais « terminée » ni « finie » (clés des travaux). */
export const WORK_END_FR = /(?:^|[^\p{L}])(?:termin[ée]e?s?|finie?s?)(?![\p{L}])/iu
/** Même chose en anglais : « replied », jamais « finished ». */
export const WORK_END_EN = /(?:^|[^\p{L}])finished(?![\p{L}])/iu
