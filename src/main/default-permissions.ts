/**
 * Permissions de la session Electron par défaut (fiche 138) : celle des fenêtres de l'app et de ce
 * qu'elles affichent (aperçu HTML). Sans gestionnaire, Electron accorde tout ce qu'une page demande ;
 * le navigateur intégré a déjà le sien (partitions de `browser-manager.ts`, tout refusé). Ici, tout
 * est refusé sauf ce que l'app utilise vraiment, et seulement pour la page de l'app elle-même :
 * - `clipboard-sanitized-write` : boutons « Copier » (`navigator.clipboard.writeText`).
 * Coller une image passe par l'évènement `paste` (aucune permission) ; les notifications et les sons
 * viennent du main, pas des API web.
 */
import { pathToFileURL } from 'node:url'
import { app, session } from 'electron'
import { log } from './log'
import { RENDERER_FILE } from './renderer-windows'

/** Ce que la page de l'app peut obtenir. */
export const APP_PERMISSIONS: ReadonlySet<string> = new Set(['clipboard-sanitized-write'])

/** Où vit la page de l'app : le fichier construit, ou le serveur de développement. */
export interface AppPage {
  file: string
  devUrl?: string
}

/** L'adresse est-elle celle de la page de l'app (vue secondaire `#quick` comprise) ? */
export function isAppPage(url: string, page: AppPage): boolean {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if (parsed.protocol === 'file:') {
    parsed.hash = ''
    parsed.search = ''
    return parsed.href === pathToFileURL(page.file).href
  }
  if (!page.devUrl) return false
  try {
    return parsed.origin === new URL(page.devUrl).origin
  } catch {
    return false
  }
}

/** Accordée seulement si l'app s'en sert et que la page de l'app la demande, hors cadre. */
export function allowPermission(
  permission: string,
  requestingUrl: string,
  isMainFrame: boolean,
  page: AppPage
): boolean {
  return APP_PERMISSIONS.has(permission) && isMainFrame && isAppPage(requestingUrl, page)
}

/** Pose les deux gestionnaires sur la session par défaut (après `app.whenReady`). */
export function restrictDefaultPermissions(): void {
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  const page: AppPage = { file: RENDERER_FILE, ...(!app.isPackaged && devUrl ? { devUrl } : {}) }
  const s = session.defaultSession
  s.setPermissionRequestHandler((_contents, permission, callback, details) => {
    const allowed = allowPermission(permission, details.requestingUrl, details.isMainFrame, page)
    if (!allowed) log.info(`Permission refusée : ${permission} (${details.requestingUrl})`)
    callback(allowed)
  })
  s.setPermissionCheckHandler((_contents, permission, _origin, details) =>
    allowPermission(permission, details.requestingUrl ?? '', details.isMainFrame, page)
  )
}
