/**
 * Raccourcis clavier de l'app (fiche 027) : source unique pour le menu macOS (main) et la liste
 * des réglages (renderer). Les raccourcis du menu marchent même quand le clavier est dans le
 * terminal ou dans une page du navigateur intégré. Libellés traduits à la lecture (fiche 074).
 */
import { t } from 'i18next'

/** Commande envoyée par le menu au renderer. */
export type MenuCommand =
  | 'new-conversation'
  | 'search'
  | 'resume-session'
  | 'settings'
  | 'shortcuts'
  | 'focus-composer'
  | 'stop'
  | 'toggle-sidebar'
  | 'toggle-panel'
  /** Panneau de droite agrandi à la place de la conversation, ou réduit (fiche 082). */
  | 'maximize-panel'
  /** Chercher dans la conversation ouverte (fiche 086). */
  | 'find'
  | 'find-next'
  | 'find-previous'
  | 'toggle-terminal'
  | 'show-changes'
  | 'previous-conversation'
  | 'next-conversation'
  /** Fenêtre › Mon activité (fiche 144). */
  | 'activity'
  /** Aide › Diagnostic… (fiche 061), sans raccourci. */
  | 'diagnostics'
  /** Conversation › Aparté… (fiche 180) : une question à côté, hors du fil. */
  | 'aside'
  /** Aide › Aide de Bobine (fiche 186) : traitée par le main, qui ouvre la fenêtre d'aide. */
  | 'help'

export interface Shortcut {
  command: MenuCommand
  label: string
  /** Raccourci au format d'Electron. */
  accelerator: string
  /** Raccourci tel qu'on l'affiche. */
  keys: string
  /** Menu où il se trouve. */
  menu: 'app' | 'file' | 'edit' | 'view' | 'conversation' | 'window' | 'help'
}

export const SHORTCUTS: readonly Shortcut[] = [
  {
    command: 'new-conversation',
    get label() {
      return t('shortcuts.menu.new-conversation')
    },
    accelerator: 'CmdOrCtrl+N',
    keys: '⌘N',
    menu: 'file'
  },
  {
    command: 'search',
    get label() {
      return t('shortcuts.menu.search')
    },
    accelerator: 'CmdOrCtrl+K',
    keys: '⌘K',
    menu: 'file'
  },
  {
    command: 'resume-session',
    get label() {
      return t('shortcuts.menu.resume-session')
    },
    accelerator: 'CmdOrCtrl+Shift+O',
    keys: '⇧⌘O',
    menu: 'file'
  },
  {
    command: 'settings',
    get label() {
      return t('shortcuts.menu.settings')
    },
    accelerator: 'CmdOrCtrl+,',
    keys: '⌘,',
    menu: 'app'
  },
  {
    command: 'focus-composer',
    get label() {
      return t('shortcuts.menu.focus-composer')
    },
    accelerator: 'CmdOrCtrl+L',
    keys: '⌘L',
    menu: 'conversation'
  },
  {
    command: 'stop',
    get label() {
      return t('shortcuts.menu.stop')
    },
    accelerator: 'CmdOrCtrl+.',
    keys: '⌘.',
    menu: 'conversation'
  },
  {
    command: 'aside',
    get label() {
      return t('shortcuts.menu.aside')
    },
    accelerator: 'CmdOrCtrl+Shift+A',
    keys: '⇧⌘A',
    menu: 'conversation'
  },
  {
    command: 'previous-conversation',
    get label() {
      return t('shortcuts.menu.previous-conversation')
    },
    accelerator: 'Alt+CmdOrCtrl+Up',
    keys: '⌥⌘↑',
    menu: 'conversation'
  },
  {
    command: 'next-conversation',
    get label() {
      return t('shortcuts.menu.next-conversation')
    },
    accelerator: 'Alt+CmdOrCtrl+Down',
    keys: '⌥⌘↓',
    menu: 'conversation'
  },
  {
    command: 'find',
    get label() {
      return t('shortcuts.menu.find')
    },
    accelerator: 'CmdOrCtrl+F',
    keys: '⌘F',
    menu: 'edit'
  },
  {
    command: 'find-next',
    get label() {
      return t('shortcuts.menu.find-next')
    },
    accelerator: 'CmdOrCtrl+G',
    keys: '⌘G',
    menu: 'edit'
  },
  {
    command: 'find-previous',
    get label() {
      return t('shortcuts.menu.find-previous')
    },
    accelerator: 'CmdOrCtrl+Shift+G',
    keys: '⇧⌘G',
    menu: 'edit'
  },
  {
    command: 'toggle-sidebar',
    get label() {
      return t('shortcuts.menu.toggle-sidebar')
    },
    accelerator: 'CmdOrCtrl+B',
    keys: '⌘B',
    menu: 'view'
  },
  {
    command: 'toggle-panel',
    get label() {
      return t('shortcuts.menu.toggle-panel')
    },
    accelerator: 'CmdOrCtrl+J',
    keys: '⌘J',
    menu: 'view'
  },
  {
    command: 'maximize-panel',
    get label() {
      return t('shortcuts.menu.maximize-panel')
    },
    accelerator: 'CmdOrCtrl+Shift+J',
    keys: '⇧⌘J',
    menu: 'view'
  },
  {
    command: 'toggle-terminal',
    get label() {
      return t('shortcuts.menu.toggle-terminal')
    },
    accelerator: 'Ctrl+`',
    keys: '⌃`',
    menu: 'view'
  },
  {
    command: 'show-changes',
    get label() {
      return t('shortcuts.menu.show-changes')
    },
    accelerator: 'CmdOrCtrl+Shift+D',
    keys: '⇧⌘D',
    menu: 'view'
  },
  {
    command: 'activity',
    get label() {
      return t('shortcuts.menu.activity')
    },
    accelerator: 'CmdOrCtrl+Shift+U',
    keys: '⇧⌘U',
    menu: 'window'
  },
  {
    command: 'help',
    get label() {
      return t('shortcuts.menu.help')
    },
    // ⇧⌘/ sur un clavier américain : macOS l'affiche ⌘?.
    accelerator: 'CmdOrCtrl+?',
    keys: '⌘?',
    menu: 'help'
  },
  {
    command: 'shortcuts',
    get label() {
      return t('shortcuts.menu.shortcuts')
    },
    accelerator: 'CmdOrCtrl+/',
    keys: '⌘/',
    menu: 'help'
  }
]

/** Raccourcis gérés par l'interface elle-même (zone de saisie, cartes…), pour la liste. */
export const INTERFACE_SHORTCUTS: readonly { keys: string; label: string }[] = [
  {
    keys: '↩',
    get label() {
      return t('shortcuts.interface.send.label')
    }
  },
  {
    keys: '⇧↩',
    get label() {
      return t('shortcuts.interface.newline.label')
    }
  },
  {
    keys: '⇧⇥',
    get label() {
      return t('shortcuts.interface.mode.label')
    }
  },
  {
    get keys() {
      return t('shortcuts.interface.escape.keys')
    },
    get label() {
      return t('shortcuts.interface.escape.label')
    }
  },
  {
    keys: '/',
    get label() {
      return t('shortcuts.interface.commands.label')
    }
  },
  {
    keys: '@',
    get label() {
      return t('shortcuts.interface.mention.label')
    }
  },
  {
    keys: '↑',
    get label() {
      return t('shortcuts.interface.recall.label')
    }
  },
  {
    get keys() {
      return t('shortcuts.interface.choice.keys')
    },
    get label() {
      return t('shortcuts.interface.choice.label')
    }
  }
]

export const isMenuCommand = (value: unknown): value is MenuCommand =>
  SHORTCUTS.some((s) => s.command === value)
