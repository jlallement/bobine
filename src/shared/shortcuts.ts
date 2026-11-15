/**
 * Raccourcis clavier de l'app (fiche 027) : source unique pour le menu (main) et la liste des
 * réglages (renderer). Les raccourcis du menu marchent même quand le clavier est dans le terminal ou
 * dans une page du navigateur intégré. Libellés traduits à la lecture (fiche 074).
 *
 * Notation (fiche 145) : les raccourcis s'écrivent ici comme sur macOS (⇧⌘U) ; hors macOS
 * (capacité `commandKey` absente), le renderer les affiche à la façon de Linux (Ctrl+Maj+U) par
 * `displayKeys`, seul endroit qui convertit : listes de raccourcis, textes traduits (post-traitement
 * `keyNotation`), pages de l'aide. Les accélérateurs `CmdOrCtrl` font déjà Ctrl hors macOS.
 */
import { t, type PostProcessorModule } from 'i18next'

/** Noms des touches de modification hors macOS, dans la langue de l'interface. */
export interface KeyNames {
  ctrl: string
  alt: string
  shift: string
}

/** Touches de macOS en tête d'un raccourci, et ce qui suit : `-clic`, ou ` Entrée`. */
const MAC_KEYS = /([⌃⌥⇧⌘]+)(-(?=\p{L})| (?=\p{L}))?/gu

/**
 * Raccourcis d'un texte à la façon de Linux (pur) : ⇧⌘U → Ctrl+Maj+U, ⌥⌘↑ → Ctrl+Alt+↑, ⌃` →
 * Ctrl+`, ⌘ Entrée → Ctrl+Entrée, ⌥-clic → Alt-clic. ⌘ et ⌃ donnent Ctrl. `null` : tel quel.
 */
export function formatKeys(text: string, names: KeyNames | null): string {
  if (!names) return text
  return text.replace(MAC_KEYS, (_, mods: string, after: string | undefined) => {
    const parts = [
      /[⌘⌃]/.test(mods) ? names.ctrl : null,
      mods.includes('⌥') ? names.alt : null,
      mods.includes('⇧') ? names.shift : null
    ].filter((part): part is string => part !== null)
    return parts.join('+') + (after === '-' ? '-' : '+')
  })
}

/** Notation du renderer, réglée une fois au démarrage (`setKeyNotation`) ; macOS par défaut. */
let commandKey = true

export function setKeyNotation(command: boolean): void {
  commandKey = command
}

/** Raccourcis d'un texte dans la notation de la plateforme. */
export function displayKeys(text: string): string {
  if (commandKey || !/[⌃⌥⇧⌘]/.test(text)) return text
  return formatKeys(text, { ctrl: t('keys.ctrl'), alt: t('keys.alt'), shift: t('keys.shift') })
}

/** Post-traitement i18next : les raccourcis des textes traduits dans la notation de la plateforme. */
export const keyNotation: PostProcessorModule = {
  type: 'postProcessor',
  name: 'keyNotation',
  process: (value) => displayKeys(value)
}

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
  /** Présentation › Espace Code / Espace Discussion (fiche 224). */
  | 'space-code'
  | 'space-discussion'

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
    command: 'space-code',
    get label() {
      return t('shortcuts.menu.space-code')
    },
    accelerator: 'CmdOrCtrl+1',
    get keys() {
      return displayKeys('⌘1')
    },
    menu: 'view'
  },
  {
    command: 'space-discussion',
    get label() {
      return t('shortcuts.menu.space-discussion')
    },
    accelerator: 'CmdOrCtrl+2',
    get keys() {
      return displayKeys('⌘2')
    },
    menu: 'view'
  },
  {
    command: 'new-conversation',
    get label() {
      return t('shortcuts.menu.new-conversation')
    },
    accelerator: 'CmdOrCtrl+N',
    get keys() {
      return displayKeys('⌘N')
    },
    menu: 'file'
  },
  {
    command: 'search',
    get label() {
      return t('shortcuts.menu.search')
    },
    accelerator: 'CmdOrCtrl+K',
    get keys() {
      return displayKeys('⌘K')
    },
    menu: 'file'
  },
  {
    command: 'resume-session',
    get label() {
      return t('shortcuts.menu.resume-session')
    },
    accelerator: 'CmdOrCtrl+Shift+O',
    get keys() {
      return displayKeys('⇧⌘O')
    },
    menu: 'file'
  },
  {
    command: 'settings',
    get label() {
      return t('shortcuts.menu.settings')
    },
    accelerator: 'CmdOrCtrl+,',
    get keys() {
      return displayKeys('⌘,')
    },
    menu: 'app'
  },
  {
    command: 'focus-composer',
    get label() {
      return t('shortcuts.menu.focus-composer')
    },
    accelerator: 'CmdOrCtrl+L',
    get keys() {
      return displayKeys('⌘L')
    },
    menu: 'conversation'
  },
  {
    command: 'stop',
    get label() {
      return t('shortcuts.menu.stop')
    },
    accelerator: 'CmdOrCtrl+.',
    get keys() {
      return displayKeys('⌘.')
    },
    menu: 'conversation'
  },
  {
    command: 'aside',
    get label() {
      return t('shortcuts.menu.aside')
    },
    accelerator: 'CmdOrCtrl+Shift+A',
    get keys() {
      return displayKeys('⇧⌘A')
    },
    menu: 'conversation'
  },
  {
    command: 'previous-conversation',
    get label() {
      return t('shortcuts.menu.previous-conversation')
    },
    accelerator: 'Alt+CmdOrCtrl+Up',
    get keys() {
      return displayKeys('⌥⌘↑')
    },
    menu: 'conversation'
  },
  {
    command: 'next-conversation',
    get label() {
      return t('shortcuts.menu.next-conversation')
    },
    accelerator: 'Alt+CmdOrCtrl+Down',
    get keys() {
      return displayKeys('⌥⌘↓')
    },
    menu: 'conversation'
  },
  {
    command: 'find',
    get label() {
      return t('shortcuts.menu.find')
    },
    accelerator: 'CmdOrCtrl+F',
    get keys() {
      return displayKeys('⌘F')
    },
    menu: 'edit'
  },
  {
    command: 'find-next',
    get label() {
      return t('shortcuts.menu.find-next')
    },
    accelerator: 'CmdOrCtrl+G',
    get keys() {
      return displayKeys('⌘G')
    },
    menu: 'edit'
  },
  {
    command: 'find-previous',
    get label() {
      return t('shortcuts.menu.find-previous')
    },
    accelerator: 'CmdOrCtrl+Shift+G',
    get keys() {
      return displayKeys('⇧⌘G')
    },
    menu: 'edit'
  },
  {
    command: 'toggle-sidebar',
    get label() {
      return t('shortcuts.menu.toggle-sidebar')
    },
    accelerator: 'CmdOrCtrl+B',
    get keys() {
      return displayKeys('⌘B')
    },
    menu: 'view'
  },
  {
    command: 'toggle-panel',
    get label() {
      return t('shortcuts.menu.toggle-panel')
    },
    accelerator: 'CmdOrCtrl+J',
    get keys() {
      return displayKeys('⌘J')
    },
    menu: 'view'
  },
  {
    command: 'maximize-panel',
    get label() {
      return t('shortcuts.menu.maximize-panel')
    },
    accelerator: 'CmdOrCtrl+Shift+J',
    get keys() {
      return displayKeys('⇧⌘J')
    },
    menu: 'view'
  },
  {
    command: 'toggle-terminal',
    get label() {
      return t('shortcuts.menu.toggle-terminal')
    },
    accelerator: 'Ctrl+`',
    get keys() {
      return displayKeys('⌃`')
    },
    menu: 'view'
  },
  {
    command: 'show-changes',
    get label() {
      return t('shortcuts.menu.show-changes')
    },
    accelerator: 'CmdOrCtrl+Shift+D',
    get keys() {
      return displayKeys('⇧⌘D')
    },
    menu: 'view'
  },
  {
    command: 'activity',
    get label() {
      return t('shortcuts.menu.activity')
    },
    accelerator: 'CmdOrCtrl+Shift+U',
    get keys() {
      return displayKeys('⇧⌘U')
    },
    menu: 'window'
  },
  {
    command: 'help',
    get label() {
      return t('shortcuts.menu.help')
    },
    // ⇧⌘/ sur un clavier américain : macOS l'affiche ⌘?.
    accelerator: 'CmdOrCtrl+?',
    get keys() {
      return displayKeys('⌘?')
    },
    menu: 'help'
  },
  {
    command: 'shortcuts',
    get label() {
      return t('shortcuts.menu.shortcuts')
    },
    accelerator: 'CmdOrCtrl+/',
    get keys() {
      return displayKeys('⌘/')
    },
    menu: 'help'
  }
]

/** Raccourcis gérés par l'interface elle-même (zone de saisie, cartes…), pour la liste. */
export const INTERFACE_SHORTCUTS: readonly { keys: string; label: string }[] = [
  {
    get keys() {
      return displayKeys('↩')
    },
    get label() {
      return t('shortcuts.interface.send.label')
    }
  },
  {
    get keys() {
      return displayKeys('⇧↩')
    },
    get label() {
      return t('shortcuts.interface.newline.label')
    }
  },
  {
    get keys() {
      return displayKeys('⇧⇥')
    },
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
    get keys() {
      return displayKeys('/')
    },
    get label() {
      return t('shortcuts.interface.commands.label')
    }
  },
  {
    get keys() {
      return displayKeys('@')
    },
    get label() {
      return t('shortcuts.interface.mention.label')
    }
  },
  {
    get keys() {
      return displayKeys('↑')
    },
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
