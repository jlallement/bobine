/**
 * Mémoire des sessions de l'agent factice, sur disque : permet de tester `session/load`
 * (rejeu de l'échange) et `session/resume` après redémarrage de l'agent, comme avec Codex ou Bob.
 */
import { mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { SessionUpdate } from '../shared/acp-sdk.mts'

export interface StoredSession {
  sessionId: string
  cwd: string
  title?: string
  updatedAt: string
  modeId: string
  model: string
  verbose: boolean
  /** Échange complet, messages de l'utilisateur compris (`user_message_chunk`), pour le rejeu. */
  history: SessionUpdate[]
  /** Session d'un sous-agent : absente de `session/list`, comme chez OpenCode 1.19 (fiche 053). */
  parentId?: string
  /** Consommation simulée : jetons dans le contexte et coût cumulé. */
  contextUsed?: number
  cost?: number
  /** Étapes déjà faites, pour une limite d'étapes qui survit à la relance (fiche 209). */
  stepsUsed?: number
}

const SAFE_ID = /^[\w-]+$/

export class SessionStore {
  private readonly dir: string

  constructor(dir: string) {
    this.dir = dir
    mkdirSync(dir, { recursive: true })
  }

  private file(sessionId: string): string {
    if (!SAFE_ID.test(sessionId)) throw new Error(`Identifiant de session invalide : ${sessionId}`)
    return join(this.dir, `${sessionId}.json`)
  }

  save(session: StoredSession): void {
    const file = this.file(session.sessionId)
    writeFileSync(`${file}.tmp`, JSON.stringify(session))
    renameSync(`${file}.tmp`, file)
  }

  load(sessionId: string): StoredSession | undefined {
    try {
      return JSON.parse(readFileSync(this.file(sessionId), 'utf8')) as StoredSession
    } catch {
      return undefined
    }
  }

  delete(sessionId: string): void {
    rmSync(this.file(sessionId), { force: true })
  }

  list(cwd?: string | null): StoredSession[] {
    return readdirSync(this.dir)
      .filter((name) => name.endsWith('.json'))
      .flatMap((name) => {
        const session = this.load(name.slice(0, -'.json'.length))
        return session && !session.parentId && (!cwd || session.cwd === cwd) ? [session] : []
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }
}
