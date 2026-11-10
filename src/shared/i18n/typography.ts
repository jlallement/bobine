/**
 * Typographie du français appliquée aux textes affichés (fiche 126), en post-traitement d'i18next
 * plutôt que dans `fr.json` : elle vaut ainsi pour les valeurs insérées et pour tout nouveau texte.
 * - Espace insécable avant `: ; ? ! % »` et après `«` : « » » ou « : » ne commence plus une ligne
 *   (recette C1). On écrit `fr.json` avec des espaces ordinaires.
 * - « de » et « que » s'élident devant une voyelle (« Fichier d’OpenCode », « qu’IBM Bob ») : les
 *   textes de `fr.json` sont justes, ce sont les noms insérés qui demandent l'élision.
 * `e2e/lib.mjs` (`L`) refait la même chose : à garder identique.
 */
import type { PostProcessorModule } from 'i18next'

const NBSP = ' '

/**
 * « de » ou « que », mot entier, devant un nom qui commence par une voyelle majuscule (agent,
 * fournisseur, app) : pas devant un nom de fichier (« Modification de index.html » reste).
 */
const ELISION = /(?<![\p{L}\p{N}_’'])(de|que) (?=[AEIOUYÀÂÆÉÈÊËÎÏÔŒÛÜ])/gu

/** Espaces insécables seulement (texte libre, comme les pages du guide, fiche 186). */
export const frenchSpaces = (text: string): string =>
  text.replace(/ ([:;?!%»])/g, `${NBSP}$1`).replace(/« /g, `«${NBSP}`)

/** Texte français mis en forme : élisions, puis espaces insécables. */
export const frenchTypography = (text: string): string =>
  text
    .replace(ELISION, (_, word: string) => (word === 'de' ? 'd’' : 'qu’'))
    .replace(/ ([:;?!%»])/g, `${NBSP}$1`)
    .replace(/« /g, `«${NBSP}`)

/** Post-traitement i18next, en français seulement. */
export const typography: PostProcessorModule = {
  type: 'postProcessor',
  name: 'typography',
  process(value, _key, options, translator) {
    const language =
      (options as { lng?: string }).lng ?? (translator as { language?: string }).language
    return language?.startsWith('fr') ? frenchTypography(value) : value
  }
}
