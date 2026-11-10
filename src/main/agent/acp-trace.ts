/**
 * Traces ACP nettoyées (fiche 139) : les échanges JSON-RPC d'une connexion, un message par ligne
 * (NDJSON), enregistrés par les sondes (`pnpm bob-probe --traces`, `pnpm opencode-probe --traces`)
 * dans `src/main/agent/__traces__/<agent>-<version>/`, puis rejoués par `trace-replay.ts`.
 *
 * Nettoyées : secrets masqués (`log-redact`), dossiers jetables et dossier personnel remplacés par
 * des noms stables (`<dossier>`, `<home>`, `<maison>`). Une trace ne contient donc ni clé, ni jeton,
 * ni chemin de l'utilisateur.
 *
 * Sans alias (`@shared`) : les scripts des sondes le chargent sous Node, sans bundler.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { AnyMessage, Stream } from '../../shared/acp-sdk.mts'
import { redact } from '../log-redact.ts'
import { stablePaths } from './probe-report.ts'

/** Qui a écrit le message : l'app (le client) ou l'agent. */
export type TraceSide = 'client' | 'agent'

/** Première ligne d'une trace : d'où elle vient. */
export interface TraceHeader {
  agent: string
  version: string
  /** Date du relevé (AAAA-MM-JJ). */
  recordedAt: string
  /** Sondage ou parcours enregistré. */
  name: string
  /**
   * Trace rebâtie à la main d'après un journal (`agents.log` résumé : JSON coupé, identifiants
   * raccourcis), pas enregistrée telle quelle : le dire, et d'où elle vient.
   */
  reconstituted?: { from: string; note: string }
}

export interface TraceLine {
  from: TraceSide
  /** Millisecondes depuis le début de la trace. */
  t: number
  msg: AnyMessage
}

export interface Trace {
  header: TraceHeader
  lines: TraceLine[]
}

/**
 * Valeur nettoyée : secrets masqués et chemins remplacés sur le JSON entier, pour que les champs
 * nommés comme des secrets (`apiKey`, `BOB_API_KEY`…) le soient aussi, comme dans le journal.
 */
export function sanitize<T>(value: T, paths: Record<string, string>): T {
  const masks = { maison: homedir(), ...paths }
  const text = redact(stablePaths(JSON.stringify(value), masks))
  try {
    return JSON.parse(text) as T
  } catch {
    // Masque qui aurait cassé le JSON (secret à cheval sur un échappement) : texte par texte.
    const clean = (v: unknown): unknown => {
      if (typeof v === 'string') return redact(stablePaths(v, masks))
      if (Array.isArray(v)) return v.map(clean)
      if (v !== null && typeof v === 'object')
        return Object.fromEntries(Object.entries(v).map(([k, child]) => [k, clean(child)]))
      return v
    }
    return clean(value) as T
  }
}

/** Trace en NDJSON : l'en-tête, puis une ligne par message. */
export function formatTrace(trace: Trace): string {
  return [{ trace: trace.header }, ...trace.lines].map((l) => JSON.stringify(l)).join('\n') + '\n'
}

export function parseTrace(text: string): Trace {
  const [first, ...rest] = text
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as unknown)
  const header = (first as { trace?: TraceHeader } | undefined)?.trace
  if (!header) throw new Error('Trace sans en-tête')
  return { header, lines: rest as TraceLine[] }
}

/** Enregistre les messages d'une connexion, nettoyés au fil de l'eau. */
export class TraceRecorder {
  private readonly lines: TraceLine[] = []
  private readonly started = Date.now()
  private readonly header: TraceHeader
  private readonly paths: Record<string, string>

  constructor(header: TraceHeader, paths: Record<string, string>) {
    this.header = header
    this.paths = paths
  }

  note(from: TraceSide, msg: AnyMessage): void {
    this.lines.push({ from, t: Date.now() - this.started, msg: sanitize(msg, this.paths) })
  }

  /** Le flux de messages de la connexion, avec chaque message noté au passage. */
  tap(stream: Stream): Stream {
    const readable = stream.readable.pipeThrough(
      new TransformStream<AnyMessage, AnyMessage>({
        transform: (msg, controller) => {
          this.note('agent', msg)
          controller.enqueue(msg)
        }
      })
    )
    const outgoing = new TransformStream<AnyMessage, AnyMessage>({
      transform: (msg, controller) => {
        this.note('client', msg)
        controller.enqueue(msg)
      }
    })
    void outgoing.readable.pipeTo(stream.writable).catch(() => {})
    return { readable, writable: outgoing.writable }
  }

  trace(): Trace {
    return { header: this.header, lines: [...this.lines] }
  }

  /** Écrit la trace dans `<dossier>/<agent>-<version>/<nom>.ndjson` ; rend le chemin. */
  save(root: string, version = this.header.version): string {
    const header = { ...this.header, version }
    const dir = join(root, `${header.agent}-${version}`)
    mkdirSync(dir, { recursive: true })
    const file = join(dir, `${traceFileName(header.name)}.ndjson`)
    writeFileSync(file, formatTrace({ header, lines: [...this.lines] }))
    return file
  }
}

/**
 * Traces d'une sonde (`--traces`) : une par connexion à l'agent, nommée d'après le sondage en
 * cours, écrites à la fin sous la version de l'agent (connue seulement après `initialize`).
 */
export class ProbeTraces {
  /** Sondage en cours : nom des traces des connexions qu'il ouvre. */
  current = 'sonde'
  private readonly recorders: TraceRecorder[] = []
  private readonly names = new Map<string, number>()
  private readonly agent: string
  private readonly enabled: boolean

  constructor(agent: string, enabled: boolean) {
    this.agent = agent
    this.enabled = enabled
  }

  /** Le flux de la connexion, enregistré si les traces sont demandées. */
  connection(stream: Stream, paths: Record<string, string>): Stream {
    if (!this.enabled) return stream
    const count = (this.names.get(this.current) ?? 0) + 1
    this.names.set(this.current, count)
    const name = count === 1 ? this.current : `${this.current} ${count}`
    const recorder = new TraceRecorder(
      { agent: this.agent, version: 'inconnue', recordedAt: today(), name },
      paths
    )
    this.recorders.push(recorder)
    return recorder.tap(stream)
  }

  /** Écrit les traces sous `root` ; rend leurs chemins. */
  save(root: string, version: string): string[] {
    return this.recorders.map((r) => r.save(root, version))
  }
}

const today = () => new Date().toISOString().slice(0, 10)

/** Nom de fichier d'un sondage : minuscules, sans accent, mots reliés par des tirets. */
export function traceFileName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
