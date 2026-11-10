/**
 * Sessions d'essai du premier lancement (fiche 188), notées avant le message d'essai et oubliées
 * une fois supprimées chez l'agent. Tant qu'elles sont notées, « Reprendre une session » ne les
 * propose pas, et leur suppression est retentée au lancement suivant (app quittée pendant l'essai,
 * agent qui n'a pas répondu à `session/delete`). Écriture atomique, à chaque changement.
 */
import { readJson, writeFileAtomic } from '../storage'

export interface TrialSession {
  profileId: string
  sessionId: string
  /** Suppressions ratées au lancement (au-delà de `MAX_ATTEMPTS`, la session est oubliée). */
  attempts?: number
}

/** Tentatives de suppression au lancement, après quoi la session est oubliée. */
export const MAX_ATTEMPTS = 3

/** Au-delà, les plus anciennes sont oubliées (un journal ne grossit jamais sans fin). */
const MAX_SESSIONS = 50

export class TrialSessions {
  private sessions: TrialSession[]
  private readonly file: string

  constructor(file: string) {
    this.file = file
    const read = readJson(file)
    this.sessions = read.ok && Array.isArray(read.value) ? read.value.filter(isTrialSession) : []
  }

  add(session: TrialSession): void {
    if (this.has(session)) return
    this.sessions = [...this.sessions, session].slice(-MAX_SESSIONS)
    this.save()
  }

  remove(session: TrialSession): void {
    if (!this.has(session)) return
    this.sessions = this.sessions.filter((s) => !same(s, session))
    this.save()
  }

  /** Suppression ratée : une tentative de plus ; oubliée après `MAX_ATTEMPTS`. */
  failed(session: TrialSession): void {
    const found = this.sessions.find((s) => same(s, session))
    if (!found) return
    const attempts = (found.attempts ?? 0) + 1
    this.sessions =
      attempts >= MAX_ATTEMPTS
        ? this.sessions.filter((s) => s !== found)
        : this.sessions.map((s) => (s === found ? { ...s, attempts } : s))
    this.save()
  }

  /** Sessions encore notées de cet agent. */
  ids(profileId: string): string[] {
    return this.sessions.filter((s) => s.profileId === profileId).map((s) => s.sessionId)
  }

  /** Agents qui ont des sessions d'essai à supprimer. */
  profiles(): string[] {
    return [...new Set(this.sessions.map((s) => s.profileId))]
  }

  private has(session: TrialSession): boolean {
    return this.sessions.some((s) => same(s, session))
  }

  private save(): void {
    writeFileAtomic(this.file, JSON.stringify(this.sessions) + '\n')
  }
}

const same = (a: TrialSession, b: TrialSession) =>
  a.profileId === b.profileId && a.sessionId === b.sessionId

function isTrialSession(value: unknown): value is TrialSession {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v['profileId'] === 'string' &&
    typeof v['sessionId'] === 'string' &&
    (v['attempts'] === undefined || typeof v['attempts'] === 'number')
  )
}
