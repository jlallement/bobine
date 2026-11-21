/**
 * Garde du ✕ des onglets du panneau (fiche 272, recette : un double clic fermait l'onglet). En
 * panneau serré, l'onglet activé s'élargit pour montrer son ✕ (après, jamais sous le pointeur : la
 * marge de `styles.css`) ; le second clic d'un double clic (`detail` > 1) ne ferme jamais. Un clic
 * simple ou le clavier (`detail` 0) ferment, même juste après l'activation.
 */
export function mayCloseTab(click: { detail: number }): boolean {
  return click.detail <= 1
}
