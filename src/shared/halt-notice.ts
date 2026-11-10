/**
 * Avis du fil quand l'agent s'arrête ou échoue (sorti de `transcript.ts`, fiche 194, pour tenir son
 * plafond de taille) : le code du message, avec le détail du statut s'il y en a un.
 */
import type { Message } from './i18n/message'

export function haltMessage(status: 'exited' | 'error', detail: string | undefined): Message {
  const exited = status === 'exited'
  if (!detail) return { key: exited ? 'transcript.notice.exited' : 'transcript.notice.failed' }
  return {
    key: exited ? 'transcript.notice.exitedDetail' : 'transcript.notice.failedDetail',
    params: { detail }
  }
}
