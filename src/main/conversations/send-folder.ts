/**
 * Dossier d'une conversation au moment d'envoyer (fiche 272, recette : l'agent tournait dans un
 * dossier déplacé, sans un mot). Discussion : son dossier est recréé s'il a disparu. Autre espace :
 * l'envoi est refusé seulement si le dossier n'existe plus (`ENOENT`, `ENOTDIR`, ou plus un
 * dossier) ; une autre erreur (droits, partage réseau lent) laisse passer : l'agent dira. La
 * lecture est asynchrone et bornée : un partage réseau muet ne fige pas l'app.
 */
import { stat } from 'node:fs/promises'
import { t } from 'i18next'
import { hasFolder } from './agentless'
import { ensureDiscussionFolder } from './discussion-space'
import type { ConversationRecord } from './store'

/** Au-delà, le dossier est présumé là (partage réseau lent) : l'envoi n'attend pas plus. */
export const FOLDER_CHECK_MS = 2000

/** Le dossier n'existe plus : `true` ; il existe, ou on ne sait pas (délai, droits) : `false`. */
export async function folderGone(
  folder: string,
  timeoutMs = FOLDER_CHECK_MS,
  statOf: (path: string) => Promise<{ isDirectory: () => boolean }> = stat
): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined
  const late = new Promise<'late'>((resolve) => {
    timer = setTimeout(() => resolve('late'), timeoutMs)
    timer.unref?.()
  })
  try {
    const found = await Promise.race([statOf(folder), late])
    return found === 'late' ? false : !found.isDirectory()
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    return code === 'ENOENT' || code === 'ENOTDIR'
  } finally {
    clearTimeout(timer)
  }
}

/** Avant l'envoi : recrée le dossier d'une discussion, refuse un dossier disparu. */
export async function guardSendFolder(
  record: Pick<ConversationRecord, 'id' | 'space' | 'workspace'>,
  conversationsDir: string
): Promise<void> {
  if (record.space === 'discussion') {
    ensureDiscussionFolder(conversationsDir, record)
    return
  }
  if (!hasFolder(record.workspace) || !(await folderGone(record.workspace))) return
  throw new Error(t('conversations.error.folderGoneAtSend', { folder: record.workspace }))
}
