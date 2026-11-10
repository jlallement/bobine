/**
 * Niveau du journal (fiche 080), partagé entre le main et les Réglages : Normal (`main.log`
 * seul), Détaillé (en plus, chaque échange avec les agents dans `agents.log`), Trace (en plus, des
 * extraits de leur contenu, secrets masqués ; jamais enregistré, jusqu'au prochain lancement).
 */
export type Verbosity = 'normal' | 'detailed' | 'trace'
export const VERBOSITIES: readonly Verbosity[] = ['normal', 'detailed', 'trace']
export const isVerbosity = (value: unknown): value is Verbosity =>
  typeof value === 'string' && (VERBOSITIES as readonly string[]).includes(value)

/** Ce que les Réglages affichent du journal. */
export interface LogStatus {
  level: Verbosity
  /** `BOBINE_LOG` impose le niveau : le réglage n'y peut rien. */
  imposed: boolean
  /** Taille des journaux en cours, en octets. */
  sizes: { main: number; agents: number }
}
