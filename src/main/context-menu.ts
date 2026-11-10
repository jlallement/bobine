/**
 * Menu contextuel natif (fiche 154) : réduit à l'essentiel, sur toutes les fenêtres de l'app.
 * Dans un champ éditable, les suggestions d'orthographe puis Couper / Copier / Coller / Tout
 * sélectionner ; sur une sélection, un lien ou une image, la copie correspondante. Rien d'autre.
 * La construction est une fonction pure (`contextMenuTemplate`), branchée sur Electron à part.
 */
import { Menu, clipboard, type BrowserWindow, type MenuItemConstructorOptions } from 'electron'
import { t } from 'i18next'

/** Ce que l'évènement `context-menu` d'Electron donne, réduit à ce que le menu utilise. */
export interface ContextMenuTarget {
  isEditable: boolean
  selectionText: string
  linkURL: string
  /** Image sous le curseur (`mediaType === 'image'`). */
  hasImage: boolean
  misspelledWord: string
  dictionarySuggestions: readonly string[]
  /** Actions possibles dans le champ (`editFlags`). */
  canCut: boolean
  canCopy: boolean
  canPaste: boolean
  canSelectAll: boolean
}

/** Gestes du menu, injectés : le gabarit reste testable sans Electron. */
export interface ContextMenuActions {
  replaceMisspelling: (word: string) => void
  copyLink: (url: string) => void
  copyImage: () => void
}

/** Nombre maximal de suggestions d'orthographe montrées. */
export const MAX_SUGGESTIONS = 5

const SEPARATOR: MenuItemConstructorOptions = { type: 'separator' }

/** Entrées du menu pour la cible ; vide : pas de menu. */
export function contextMenuTemplate(
  target: ContextMenuTarget,
  actions: ContextMenuActions
): MenuItemConstructorOptions[] {
  const items: MenuItemConstructorOptions[] = []
  if (target.isEditable) {
    if (target.misspelledWord) {
      for (const word of target.dictionarySuggestions.slice(0, MAX_SUGGESTIONS)) {
        items.push({ label: word, click: () => actions.replaceMisspelling(word) })
      }
      if (items.length > 0) items.push(SEPARATOR)
    }
    items.push(
      { label: t('menu.cut'), role: 'cut', enabled: target.canCut },
      { label: t('menu.copy'), role: 'copy', enabled: target.canCopy },
      { label: t('menu.paste'), role: 'paste', enabled: target.canPaste },
      { label: t('menu.selectAll'), role: 'selectAll', enabled: target.canSelectAll }
    )
    return items
  }
  if (target.linkURL) {
    items.push({ label: t('menu.copyLink'), click: () => actions.copyLink(target.linkURL) })
  }
  if (target.hasImage) items.push({ label: t('menu.copyImage'), click: actions.copyImage })
  if (target.selectionText.trim()) {
    items.unshift({ label: t('menu.copy'), role: 'copy' })
  }
  return items
}

/** Branche le menu contextuel sur une fenêtre de l'app (jamais sur une popup d'un site). */
export function attachContextMenu(win: BrowserWindow): void {
  win.webContents.on('context-menu', (_event, params) => {
    const contents = win.webContents
    const template = contextMenuTemplate(
      {
        isEditable: params.isEditable,
        selectionText: params.selectionText,
        linkURL: params.linkURL,
        hasImage: params.mediaType === 'image',
        misspelledWord: params.misspelledWord,
        dictionarySuggestions: params.dictionarySuggestions,
        canCut: params.editFlags.canCut,
        canCopy: params.editFlags.canCopy,
        canPaste: params.editFlags.canPaste,
        canSelectAll: params.editFlags.canSelectAll
      },
      {
        replaceMisspelling: (word) => contents.replaceMisspelling(word),
        copyLink: (url) => clipboard.writeText(url),
        copyImage: () => contents.copyImageAt(params.x, params.y)
      }
    )
    if (template.length > 0) Menu.buildFromTemplate(template).popup({ window: win })
  })
}
