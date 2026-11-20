import i18next from 'i18next'
import type { SessionControl } from '@shared/agent'

/** Catégories ACP connues, nommées dans la langue de l'interface (fiche 272). */
const KNOWN = ['model', 'mode', 'thought_level'] as const

/**
 * Nom d'un réglage de session : celui de sa catégorie ACP quand elle est connue (« Modèle »,
 * « Mode »), traduit ; sinon le nom donné par l'agent, tel quel (ADR-0014). Générique : la
 * catégorie vient du protocole, jamais d'un agent en particulier (recette : « Model », « Session
 * Mode » dans l'interface française).
 */
export function controlName(control: Pick<SessionControl, 'name' | 'category'>): string {
  const category = KNOWN.find((c) => c === control.category)
  return category ? i18next.t(`controlCategory.${category}`) : control.name
}
