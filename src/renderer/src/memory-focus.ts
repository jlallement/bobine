/**
 * Souvenir à montrer à l'ouverture de Réglages › Mémoire (fiche 182) : posé par « Voir » d'une
 * carte décidée, lu une fois par l'écran.
 */
let focus: string | undefined

export function focusMemory(name: string | undefined): void {
  focus = name
}

export function takeMemoryFocus(): string | undefined {
  const name = focus
  focus = undefined
  return name
}
