/**
 * Fenêtre rapide (fiche 062) : raccourci global qui l'ouvre depuis n'importe quelle app. Un
 * raccourci global prend la touche dans toutes les apps : ⌥⌘B par défaut, qui ne prive de rien
 * (⌥Espace tape l'espace insécable sur un clavier français).
 */
import { t } from 'i18next'
export const QUICK_SHORTCUTS = {
  off: {
    get label() {
      return t('quick.shortcut.off')
    },
    accelerator: '',
    keys: ''
  },
  'alt-cmd-b': { label: '⌥⌘B', accelerator: 'Alt+Command+B', keys: '⌥⌘B' },
  'alt-space': {
    get label() {
      return t('quick.shortcut.altSpace')
    },
    accelerator: 'Alt+Space',
    get keys() {
      return t('quick.shortcut.altSpace')
    }
  },
  'shift-alt-space': {
    get label() {
      return t('quick.shortcut.shiftAltSpace')
    },
    accelerator: 'Shift+Alt+Space',
    get keys() {
      return t('quick.shortcut.shiftAltSpace')
    }
  }
} as const

export type QuickShortcut = keyof typeof QUICK_SHORTCUTS

export const DEFAULT_QUICK_SHORTCUT: QuickShortcut = 'alt-cmd-b'

export function isQuickShortcut(value: unknown): value is QuickShortcut {
  return typeof value === 'string' && Object.hasOwn(QUICK_SHORTCUTS, value)
}

/** État du raccourci global, tel que les réglages l'affichent. */
export interface QuickEntryStatus {
  shortcut: QuickShortcut
  /** macOS l'a refusé : une autre app l'utilise déjà. */
  refused: boolean
}

/** Ce que la fenêtre rapide affiche : où partira le message. */
export interface QuickEntryInfo {
  agentLabel: string
  workspace: string
}
