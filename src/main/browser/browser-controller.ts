/**
 * Ce que l'IPC demande au navigateur intégré (sorti de `ipc.ts`, fiche 094) ; mis en place par
 * `browser-setup.ts`.
 */
import type { ImageAttachment } from '@shared/attachments'
import type { BrowserBounds, BrowserGo, BrowserState, BrowserZoom } from '@shared/browser'
import type { PageFreeze, PageLayerTheme, PagePin } from '@shared/page-notes'

export interface BrowserController {
  show: (conversationId: string, bounds: BrowserBounds) => void
  hide: () => void
  navigate: (conversationId: string, input: string) => Promise<void>
  /** Page ouverte par l'app dans un nouvel onglet (aperçu HTML, fiche 064). */
  openTab?: (conversationId: string, url: string) => Promise<void>
  /** Image de la page affichée, prête à joindre (fiche 066) ; `null` sans page. */
  capture?: (conversationId: string) => Promise<ImageAttachment | null>
  /** « Effacer les données du navigateur » (fiche 072). */
  clearData?: () => Promise<void>
  /** Branche (fiche 094) : elle reprend la page de l'originale. */
  inherit?: (conversationId: string, fromId: string) => void
  /** « Afficher dans le Finder » un fichier téléchargé et enregistré (fiche 094). */
  showDownload?: (conversationId: string, path: string) => void
  go: (conversationId: string, action: BrowserGo) => Promise<void>
  state: (conversationId: string) => BrowserState | null
  selectTab: (conversationId: string, tabId: string) => void
  closeTab: (conversationId: string, tabId: string) => void
  /** Zoom de la page de l'onglet actif (fiche 129). */
  zoom?: (conversationId: string, action: BrowserZoom) => void
  /** La page reprend la largeur du panneau : fin de la taille imposée par l'agent (fiche 129). */
  clearEmulation?: (conversationId: string) => Promise<void>
  /** Page figée le temps d'écrire une remarque (fiches 132, 146) ; `null` sans page. */
  freeze?: (conversationId: string) => Promise<PageFreeze | null>
  /** Capture propre d'une remarque, sans ce que l'app dessine dans la page (fiche 146). */
  noteShot?: (conversationId: string) => Promise<PageFreeze | null>
  /** Mode Annoter sur la page vivante (fiche 146). */
  annotate?: (conversationId: string, on: boolean, theme?: PageLayerTheme) => Promise<void>
  /** Épingles dessinées dans la page (fiche 146). */
  pagePins?: (conversationId: string, pins: PagePin[]) => Promise<void>
}
