/**
 * Ouverture du profil au lancement (fiches 196, 197), avant que quoi que ce soit ne le lise :
 * restauration demandée, version du format (lecture seule si plus récent), marque de version,
 * fichiers temporaires balayés, corbeille purgée, messages non enregistrés au dernier arrêt.
 * Puis, une fois les fichiers lus, les avis de ce qui a été mis de côté ou refait.
 *
 * N'importe pas `electron` : testable sous Vitest.
 */
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import i18next from 'i18next'
import type { Message } from '@shared/i18n/message'
import { log } from './log'
import { applyPendingRestore } from './conversations/restore'
import { ConversationTrash } from './conversations/trash'
import { checkProfile, markProfile } from './profile-format'
import { plainError, type ProfileStatusStore } from './profile-status'
import { setReadOnlyProfile, sweepTempFiles, writeFileAtomic } from './storage'

/** Messages non enregistrés au dernier arrêt (arrêt du Mac, signal) : dits au lancement suivant. */
export const UNSAVED_FILE = 'non-enregistre-au-dernier-arret.json'
/** Fichiers écrits même en lecture seule : le registre des processus des agents (fiche 138). */
const READ_ONLY_EXEMPT = ['agents.pids']

export function openProfile(
  userData: string,
  appVersion: string,
  status: ProfileStatusStore,
  now = new Date()
): void {
  const restore = applyPendingRestore(userData, appVersion, now)
  if (restore.kind === 'restored') {
    status.add(
      'success',
      { key: 'profile.notice.restored', params: { date: longDate(restore.createdAt) } },
      { path: restore.keptIn }
    )
  } else if (restore.kind === 'interrupted') {
    status.add('warning', { key: 'profile.notice.restoreInterrupted' })
  } else if (restore.kind === 'failed') {
    status.add(
      'error',
      { key: 'profile.notice.restoreFailed', params: { reason: plainError(restore.cause) } },
      { detail: restore.error }
    )
  }
  const check = checkProfile(userData, appVersion)
  if (check.kind !== 'ok') {
    log.warn(
      check.kind === 'newer'
        ? `Profil au format ${check.formatVersion} (Bobine ${check.app ?? '?'}), cette version lit le format 1 : lecture seule`
        : 'Marque de version du profil illisible : lecture seule, par prudence'
    )
    setReadOnlyProfile(userData, READ_ONLY_EXEMPT)
    status.readOnly = check.kind
    return
  }
  if (check.writtenBy) {
    log.info(
      `Profil écrit en dernier par Bobine ${check.writtenBy}, plus récente : champs inconnus gardés`
    )
  }
  try {
    markProfile(userData, appVersion)
  } catch (error) {
    log.warn('Marque de version du profil non écrite :', error)
  }
  const conversations = join(userData, 'conversations')
  const swept = sweepTempFiles([userData, conversations, join(conversations, '.trash')])
  if (swept) log.info(`Fichiers temporaires retirés : ${swept}`)
  new ConversationTrash(conversations).purge(now)
  reportUnsavedAtQuit(userData, status)
}

/** Les fichiers lus, ce qui a été mis de côté ou retrouvé, dit une fois. */
export function reportDamage(
  status: ProfileStatusStore,
  found: {
    settings?: string | undefined
    approvals?: string | undefined
    history: readonly string[]
    recovered?: { count: number; rebuilt: boolean } | undefined
  }
): void {
  // Mis de côté (`.corrupt-…`) ou laissé en place, protégé (lecture impossible, trop de copies).
  const setAside = (path: string) => path.includes('.corrupt-')
  const kept = [found.settings, found.approvals, ...found.history].filter(
    (path): path is string => path !== undefined && !setAside(path)
  )
  if (found.settings && setAside(found.settings)) {
    status.add('warning', { key: 'profile.notice.settingsDamaged' }, { path: found.settings })
  }
  if (found.approvals && setAside(found.approvals)) {
    status.add('warning', { key: 'profile.notice.approvalsDamaged' }, { path: found.approvals })
  }
  const history = found.history.filter(setAside)
  if (history.length > 0) {
    status.add(
      'warning',
      { key: 'profile.notice.historyDamaged', params: { count: history.length } },
      { path: history[0] }
    )
  }
  if (kept.length > 0) {
    status.add(
      'warning',
      { key: 'profile.notice.unreadable', params: { count: kept.length } },
      { path: kept[0] }
    )
  }
  if (found.recovered) {
    const { count, rebuilt } = found.recovered
    status.add('info', {
      key: rebuilt ? 'profile.notice.indexRebuilt' : 'profile.notice.found',
      params: { count }
    })
  }
}

/**
 * Fermeture sans alerte possible (arrêt du Mac, signal) avec des conversations non enregistrées :
 * noté pour le lancement suivant, au mieux (le disque est peut-être encore plein).
 */
export function noteUnsavedAtQuit(
  userData: string,
  titles: readonly string[],
  error: unknown
): void {
  try {
    const reason = plainError(error).key
    writeFileAtomic(join(userData, UNSAVED_FILE), JSON.stringify({ titles, reason }))
  } catch (failure) {
    log.error('Conversations non enregistrées en quittant :', titles, failure)
  }
}

function reportUnsavedAtQuit(userData: string, status: ProfileStatusStore): void {
  const file = join(userData, UNSAVED_FILE)
  if (!existsSync(file)) return
  try {
    const raw = JSON.parse(readFileSync(file, 'utf8')) as { titles?: unknown; reason?: unknown }
    const titles = Array.isArray(raw.titles)
      ? raw.titles.filter((t): t is string => typeof t === 'string')
      : []
    if (titles.length > 0) {
      const reason: Message = {
        key:
          raw.reason === 'profile.error.diskFull' ? 'profile.error.diskFull' : 'profile.error.other'
      }
      status.add('error', {
        key: 'profile.notice.unsavedAtQuit',
        params: { count: titles.length, names: namesOf(titles), reason }
      })
    }
  } catch (error) {
    log.warn('Note des conversations non enregistrées illisible :', error)
  }
  rmSync(file, { force: true })
}

/** « A », « A » et « B », « A », « B » et « C », ou « N conversations ». */
export function namesOf(titles: readonly string[]): Message {
  const [a = '', b = '', c = ''] = titles
  if (titles.length === 1) return { key: 'profile.names.one', params: { a } }
  if (titles.length === 2) return { key: 'profile.names.two', params: { a, b } }
  if (titles.length === 3) return { key: 'profile.names.three', params: { a, b, c } }
  return { key: 'profile.names.count', params: { count: titles.length } }
}

/** Date lisible dans la langue de l'app (« 7 novembre 2026 à 01:04 »). */
export function longDate(iso: string): string {
  const date = new Date(iso)
  if (isNaN(date.getTime())) return iso
  return date.toLocaleString(i18next.language || 'fr', { dateStyle: 'long', timeStyle: 'short' })
}
