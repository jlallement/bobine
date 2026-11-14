/**
 * Touches de la zone de saisie (fiche 089, sorti de `Composer`) : ce que fait une touche selon
 * l'état des menus `@` et « / », de l'agent et du texte. Une seule action par touche ; toute action
 * autre que `none` empêche le comportement par défaut du navigateur.
 *
 * - Menus ouverts (hors composition IME) : ↑ ↓ changent l'élément surligné, Tab ou Entrée le
 *   choisissent (Tab complète une commande sans l'envoyer), Échap referme le menu.
 * - Entrée envoie, Maj+Entrée insère un retour à la ligne (sauf composition IME en cours).
 * - Échap arrête la réponse ; ↑ dans une zone vide reprend le dernier message en attente.
 * - Maj+Tab passe au mode suivant, comme dans Claude Code.
 * - Historique de la saisie (fiche 227), après tout le reste : ↑ dans une saisie vide reprend le
 *   dernier message envoyé ; dans un message repris non modifié, ↑ depuis sa première ligne
 *   affichée passe au précédent (rien sur le premier), ↓ depuis sa dernière au suivant (après le
 *   dernier : saisie vide) ; ailleurs, les flèches déplacent le curseur. Échap le quitte et vide
 *   la saisie, avant d'arrêter la réponse.
 */

export interface ComposerKey {
  key: string
  shift: boolean
  /** Composition IME en cours (saisie du japonais…) : Entrée la valide, n'envoie rien. */
  composing: boolean
  /** ⌥, ⌃ ou ⌘ tenue (⌘↑ : début du texte) : jamais pour l'historique. */
  modified?: boolean
}

/** Historique de la saisie de la conversation (fiche 227). */
export interface ComposerHistoryState {
  /** Messages envoyés gardés. */
  count: number
  /** Message repris affiché, non modifié (0 : le plus ancien) ; `undefined` : hors historique. */
  index: number | undefined
  /** Saisie vide : ni texte, ni jeton de rôle, ni pièce jointe. */
  blank: boolean
  /** Curseur sur la première / la dernière ligne affichée du texte (replis compris). */
  firstLine: boolean
  lastLine: boolean
}

export interface ComposerMenuState {
  open: boolean
  /** Éléments proposés. */
  count: number
  /** Élément surligné. */
  active: number
}

export interface ComposerKeyState {
  mentions: ComposerMenuState
  commands: ComposerMenuState
  busy: boolean
  /** Zone de saisie vide. */
  empty: boolean
  hasQueued: boolean
  /** Un mode à choisir, agent prêt. */
  canCycleMode: boolean
  /** Absent : pas d'historique (saisie rapide). */
  history?: ComposerHistoryState
}

export type ComposerKeyAction =
  | { kind: 'none' }
  /** Touche absorbée sans autre effet (flèche dans un menu vide). */
  | { kind: 'prevent' }
  | { kind: 'mention-move'; index: number }
  | { kind: 'mention-pick' }
  | { kind: 'mention-dismiss' }
  | { kind: 'command-move'; index: number }
  | { kind: 'command-pick'; complete: boolean }
  | { kind: 'command-dismiss' }
  | { kind: 'submit' }
  | { kind: 'cancel' }
  | { kind: 'edit-last-queued' }
  | { kind: 'next-mode' }
  /** Message `index` de l'historique repris ; `from` : la flèche (où poser le curseur). */
  | { kind: 'history-move'; index: number; from: 'up' | 'down' }
  /** Hors de l'historique, saisie vidée. */
  | { kind: 'history-exit' }

type MenuAction = { kind: 'move'; index: number } | { kind: 'prevent' | 'pick' | 'dismiss' }

/** Touche dans un menu ouvert ; `undefined` : la touche n'est pas pour le menu. */
function menuAction(key: ComposerKey, menu: ComposerMenuState): MenuAction | undefined {
  if (key.key === 'ArrowDown' || key.key === 'ArrowUp') {
    if (menu.count === 0) return { kind: 'prevent' }
    const step = key.key === 'ArrowDown' ? 1 : menu.count - 1
    return { kind: 'move', index: (menu.active + step) % menu.count }
  }
  const picked = menu.active >= 0 && menu.active < menu.count
  if ((key.key === 'Tab' || key.key === 'Enter') && !key.shift && picked) return { kind: 'pick' }
  if (key.key === 'Escape') return { kind: 'dismiss' }
  return undefined
}

export function composerKeyAction(key: ComposerKey, state: ComposerKeyState): ComposerKeyAction {
  if (state.mentions.open && !key.composing) {
    const action = menuAction(key, state.mentions)
    if (action?.kind === 'move') return { kind: 'mention-move', index: action.index }
    if (action?.kind === 'pick') return { kind: 'mention-pick' }
    if (action?.kind === 'dismiss') return { kind: 'mention-dismiss' }
    if (action) return { kind: 'prevent' }
  }
  if (state.commands.open && !key.composing) {
    const action = menuAction(key, state.commands)
    if (action?.kind === 'move') return { kind: 'command-move', index: action.index }
    if (action?.kind === 'pick') return { kind: 'command-pick', complete: key.key === 'Tab' }
    if (action?.kind === 'dismiss') return { kind: 'command-dismiss' }
    if (action) return { kind: 'prevent' }
  }
  if (key.key === 'Enter' && !key.shift && !key.composing) return { kind: 'submit' }
  const history = historyAction(key, state)
  if (history?.kind === 'history-exit' && key.key === 'Escape') return history
  if (key.key === 'Escape' && state.busy) return { kind: 'cancel' }
  if (key.key === 'ArrowUp' && state.empty && state.hasQueued) return { kind: 'edit-last-queued' }
  if (history) return history
  if (key.key === 'Tab' && key.shift && state.canCycleMode) return { kind: 'next-mode' }
  return { kind: 'none' }
}

/** Flèche ou Échap pour l'historique de la saisie ; `undefined` : la touche n'est pas pour lui. */
function historyAction(
  key: ComposerKey,
  { history: h }: ComposerKeyState
): ComposerKeyAction | undefined {
  if (!h || key.composing || key.shift || key.modified) return undefined
  const move = (index: number, from: 'up' | 'down') =>
    ({ kind: 'history-move', index, from }) as const
  if (h.index === undefined) {
    // Entrée dans l'historique : par ↑ seulement, saisie vide, au moins un message envoyé.
    return key.key === 'ArrowUp' && h.blank && h.count > 0 ? move(h.count - 1, 'up') : undefined
  }
  if (key.key === 'Escape') return { kind: 'history-exit' }
  // Lignes d'abord : ailleurs que sur la première (↑) ou la dernière ligne (↓), le curseur bouge.
  if (key.key === 'ArrowUp' && h.firstLine) {
    return h.index > 0 ? move(h.index - 1, 'up') : { kind: 'prevent' }
  }
  if (key.key === 'ArrowDown' && h.lastLine) {
    return h.index < h.count - 1 ? move(h.index + 1, 'down') : { kind: 'history-exit' }
  }
  return undefined
}

/** Option suivante d'un réglage à choix (Maj+Tab : mode suivant, en boucle). */
export function nextOption(control: {
  currentValue: unknown
  options: readonly { value: string }[]
}): string | undefined {
  const index = control.options.findIndex((o) => o.value === control.currentValue)
  return control.options[(index + 1) % control.options.length]?.value
}
