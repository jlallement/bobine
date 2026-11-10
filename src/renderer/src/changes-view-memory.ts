/**
 * Vue de l'onglet Modifications choisie, par conversation (fiche 185, F5), le temps de la session
 * de l'app : le panneau replié faute de place puis rouvert revient sur la même vue. `seq` : la
 * dernière demande d'ouverture servie (une demande ne vaut qu'une fois).
 */
export interface ChosenView<View extends string = string> {
  view: View
  seq: number
}

const chosen = new Map<string, ChosenView>()

export const chosenView = <View extends string>(id: string) =>
  chosen.get(id) as ChosenView<View> | undefined

export function rememberView(id: string, value: ChosenView): void {
  chosen.set(id, value)
}

/** Conversation supprimée : rien à garder. */
export function forgetView(id: string): void {
  chosen.delete(id)
}
