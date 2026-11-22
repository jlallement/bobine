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

/** Codes de Windows pour un fichier tenu ouvert par un autre (lecteur, antivirus, indexation). */
const BUSY_CODES = new Set(['EPERM', 'EACCES', 'EBUSY'])
/** Attentes entre deux essais de remplacement : un peu plus de 3 s en tout, puis l'erreur. */
const BUSY_WAITS_MS = [10, 20, 40, 80, 160, 320, 640, 1000, 1000]

export interface ReplaceFileDeps {
  platform?: NodeJS.Platform
  rename?: (from: string, to: string) => void
  /** Attente synchrone (le stockage de l'agent factice est synchrone). */
  wait?: (ms: number) => void
}

const waitSync = (ms: number) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)

/**
 * Remplace `to` par `from`. Sous Windows, remplacer un fichier qu'un autre processus a ouvert
 * à cet instant (un autre agent factice qui relit le dossier pour `session/list`, l'antivirus
 * qui inspecte le fichier tout juste écrit) échoue en `EPERM`/`EACCES`/`EBUSY` le temps qu'il le
 * referme : nouvel essai borné, comme graceful-fs. Ailleurs, le renommage n'est pas gêné par un
 * lecteur : l'erreur est rendue telle quelle.
 */
export function replaceFile(from: string, to: string, deps: ReplaceFileDeps = {}): void {
  const { platform = process.platform, rename = renameSync, wait = waitSync } = deps
  for (let attempt = 0; ; attempt++) {
    try {
      rename(from, to)
      return
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      const delay = BUSY_WAITS_MS[attempt]
      if (platform !== 'win32' || !code || !BUSY_CODES.has(code) || delay === undefined) throw error
      wait(delay)
    }
  }
}

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
    // Temporaire propre au processus : deux agents factices sur le même dossier (relance, fille)
    // n'écrivent jamais dans le même.
    const tmp = `${file}.${process.pid}.tmp`
    writeFileSync(tmp, JSON.stringify(session))
    try {
      replaceFile(tmp, file)
    } catch (error) {
      rmSync(tmp, { force: true })
      throw error
    }
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
