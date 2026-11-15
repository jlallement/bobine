/**
 * Menu de l'app dessiné par Bobine hors macOS (fiche 145, variante D) : le main construit le menu
 * Linux (`main/menu.ts`), en tire ce modèle sérialisé et l'envoie au renderer, qui le dessine
 * derrière le bouton ☰. Un clic renvoie l'`id` au main (`app:menuInvoke`), qui n'accepte que ceux
 * du modèle courant. Une seule source : la liste des entrées n'existe qu'une fois, dans `menu.ts`.
 */
import type { KeyNames } from './shortcuts'

export type AppMenuItem =
  | { kind: 'separator' }
  | {
      kind: 'item'
      id: string
      label: string
      /** Accélérateur d'Electron (`CmdOrCtrl+Shift+U`), affiché par `acceleratorKeys`. */
      accelerator?: string
      enabled: boolean
      /** Case à cocher (mode présentation) : son état. */
      checked?: boolean
    }
  | { kind: 'submenu'; id: string; label: string; items: AppMenuItem[] }

/** Identifiants des entrées qu'on peut déclencher (sous-menus compris), pour `app:menuInvoke`. */
export function appMenuIds(items: readonly AppMenuItem[]): Set<string> {
  const ids = new Set<string>()
  const walk = (list: readonly AppMenuItem[]) => {
    for (const item of list) {
      if (item.kind === 'item' && item.enabled) ids.add(item.id)
      if (item.kind === 'submenu') walk(item.items)
    }
  }
  walk(items)
  return ids
}

/** Touches d'Electron, telles qu'on les écrit sous Linux. */
const KEYS: Record<string, string> = {
  Plus: '+',
  Up: '↑',
  Down: '↓',
  Left: '←',
  Right: '→'
}

/**
 * Accélérateur d'Electron tel qu'on l'affiche hors macOS : `CmdOrCtrl+Shift+U` → `Ctrl+Maj+U`,
 * `Alt+CommandOrControl+B` → `Ctrl+Alt+B`, `Alt+Space` → `Alt+Espace`. Ordre : Ctrl, Alt, Maj.
 */
export function acceleratorKeys(accelerator: string, names: KeyNames & { space: string }): string {
  const parts = accelerator.split('+')
  // `CmdOrCtrl++` n'existe pas (Electron écrit `Plus`) : la dernière partie est la touche.
  const key = parts.pop() ?? ''
  const mods = new Set(parts.map((part) => part.toLowerCase()))
  const ctrl = ['cmdorctrl', 'commandorcontrol', 'cmd', 'command', 'ctrl', 'control'].some((m) =>
    mods.has(m)
  )
  return [
    ctrl ? names.ctrl : null,
    mods.has('alt') || mods.has('option') ? names.alt : null,
    mods.has('shift') ? names.shift : null,
    key === 'Space' ? names.space : (KEYS[key] ?? key)
  ]
    .filter((part): part is string => part !== null)
    .join('+')
}

/** Canaux du menu ☰ (fiche 145), rangés avec `IpcInvokeContract`. */
export interface AppMenuIpcContract {
  /** Modèle du menu ☰ ; `null` sur macOS, où le menu est celui du système. */
  'app:menu': { args: []; result: AppMenuItem[] | null }
  /** Entrée choisie : seuls les identifiants du modèle courant sont acceptés. */
  'app:menuInvoke': { args: [id: string]; result: undefined }
}

export const APP_MENU_CHANNELS = ['app:menu', 'app:menuInvoke'] as const
