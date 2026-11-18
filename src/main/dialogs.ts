/**
 * Dialogues natifs de l'app (sortis de `index.ts`, fiche 093) : joindre des fichiers, choisir le
 * dossier de travail, enregistrer l'export d'une conversation. Rattachés à la fenêtre active.
 */
import { join } from 'node:path'
import { app, BrowserWindow, dialog } from 'electron'
import { t } from 'i18next'
import { TEMPORARY_SWITCH } from './fresh-start'
import { log } from './log'
import { withExtension } from '@shared/export'

export async function chooseFiles(defaultPath: string): Promise<string[]> {
  const options = {
    title: t('dialogs.attach.title'),
    buttonLabel: t('dialogs.attach.button'),
    defaultPath,
    properties: ['openFile', 'multiSelections'] as ('openFile' | 'multiSelections')[]
  }
  const parent = BrowserWindow.getFocusedWindow()
  const result = parent
    ? await dialog.showOpenDialog(parent, options)
    : await dialog.showOpenDialog(options)
  return result.canceled ? [] : result.filePaths
}

/**
 * Réponse du premier choix de dossier, sans la fenêtre de macOS (`BOBINE_PRESET_FOLDER`, pilote,
 * fiche 206) : `pnpm pilote lancer --dossier <d>` sur un profil neuf passe l'étape « Où
 * travailler ? » de l'accueil par « Choisir… », que le pilote ne sait pas conduire dans la fenêtre
 * de macOS. Une seule fois : les choix suivants ouvrent la vraie fenêtre.
 *
 * Crochet d'essai : suivi **seulement sur un profil temporaire** (`--profil-temporaire`, fiche
 * 148), celui du pilote. Ailleurs (profil de l'utilisateur, app installée), la variable est
 * ignorée, et dite une fois au journal (niveau Détaillé). Pur, testé.
 */
export function takePresetFolder(env: NodeJS.ProcessEnv, temporaryProfile: boolean): string | null {
  const folder = env['BOBINE_PRESET_FOLDER']?.trim()
  delete env['BOBINE_PRESET_FOLDER']
  if (!folder) return null
  if (!temporaryProfile) {
    log.debug('BOBINE_PRESET_FOLDER ignorée : profil temporaire seulement (--profil-temporaire)')
    return null
  }
  return folder
}

export async function chooseDirectory(
  labels: { title: string; buttonLabel: string } = {
    title: t('dialogs.workspace.title'),
    buttonLabel: t('dialogs.workspace.button')
  }
): Promise<string | null> {
  const preset = takePresetFolder(process.env, app.commandLine.hasSwitch(TEMPORARY_SWITCH))
  if (preset) return preset
  const options = {
    ...labels,
    properties: ['openDirectory', 'createDirectory'] as ('openDirectory' | 'createDirectory')[]
  }
  const parent = BrowserWindow.getFocusedWindow()
  const result = parent
    ? await dialog.showOpenDialog(parent, options)
    : await dialog.showOpenDialog(options)
  return result.canceled ? null : (result.filePaths[0] ?? null)
}

/** Dialogue d'enregistrement de l'export d'une conversation (fiche 043). */
export async function saveFile(
  defaultName: string,
  format: 'markdown' | 'json'
): Promise<string | null> {
  const options = {
    title: t('dialogs.export.title'),
    buttonLabel: t('dialogs.export.button'),
    defaultPath: join(app.getPath('documents'), defaultName),
    filters:
      format === 'json'
        ? [{ name: 'JSON', extensions: ['json'] }]
        : [{ name: 'Markdown', extensions: ['md'] }]
  }
  const parent = BrowserWindow.getFocusedWindow()
  const result = parent
    ? await dialog.showSaveDialog(parent, options)
    : await dialog.showSaveDialog(options)
  if (result.canceled || !result.filePath) return null
  // Une seule extension, même si le nom saisi la portait déjà (fiche 247, D14).
  return withExtension(result.filePath, format === 'json' ? 'json' : 'md')
}

/** « Enregistrer sous » de l'export de la consommation (fiche 137), dans Documents. */
export async function saveCsv(defaultName: string): Promise<string | null> {
  const options = {
    title: t('dialogs.usageExport.title'),
    buttonLabel: t('dialogs.export.button'),
    defaultPath: join(app.getPath('documents'), defaultName),
    filters: [{ name: 'CSV', extensions: ['csv'] }]
  }
  const parent = BrowserWindow.getFocusedWindow()
  const result = parent
    ? await dialog.showSaveDialog(parent, options)
    : await dialog.showSaveDialog(options)
  return result.canceled || !result.filePath ? null : withExtension(result.filePath, 'csv')
}
