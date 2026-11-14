/**
 * Registre des rôles installés dans les agents (fiche 223, phase 4, ADR-0047), dans les données de
 * Bobine : ce que Bobine a écrit, où, et son empreinte. C'est lui qui dit qu'une entrée est à
 * Bobine : une entrée absente du registre n'est jamais touchée. Un registre illisible est mis de
 * côté par `readJson` et repart vide — Bobine ne touche alors plus rien de ce qu'elle avait écrit
 * (sûr : l'utilisateur voit « déjà présent » et peut retirer l'entrée à la main).
 */
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import {
  ROLE_EXPORT_FORMATS,
  type RoleExportFormat,
  type RoleExportScope
} from '@shared/role-export'
import { readJson, writeFileAtomic } from '../../storage'
import { fingerprint } from './format'

export interface RoleExportRecord {
  profileId: string
  format: RoleExportFormat
  scope: RoleExportScope
  /** Dossier du projet (portée projet). */
  workspace?: string
  /** Fichier écrit (chemin complet). */
  file: string
  /** Identifiant du mode ou de l'agent : le nom du rôle. */
  id: string
  /** Empreinte de l'entrée telle que Bobine l'a écrite. */
  written: string
  /** Empreinte du rôle (son fichier Markdown) au moment de l'installation. */
  role: string
  /** Installé en lecture seule (droits de l'agent). */
  readOnly: boolean
  /** Dans Bobine, lancer ce rôle dans ce mode quand la session l'a. */
  useInBobine: boolean
  /** Date de la dernière écriture (ISO). */
  at: string
}

/** Clé d'une installation, donnée au renderer à la place d'un chemin. */
export const recordKey = (record: Pick<RoleExportRecord, 'file' | 'id'>): string =>
  fingerprint(`${record.file}\0${record.id}`)

const isString = (value: unknown): value is string => typeof value === 'string' && value !== ''

function parseRecord(value: unknown): RoleExportRecord | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const r = value as Record<string, unknown>
  const ok =
    isString(r['profileId']) &&
    ROLE_EXPORT_FORMATS.includes(r['format'] as RoleExportFormat) &&
    (r['scope'] === 'user' || (r['scope'] === 'project' && isString(r['workspace']))) &&
    isString(r['file']) &&
    isString(r['id']) &&
    isString(r['written']) &&
    isString(r['role']) &&
    typeof r['readOnly'] === 'boolean' &&
    typeof r['useInBobine'] === 'boolean' &&
    isString(r['at'])
  return ok ? (r as unknown as RoleExportRecord) : undefined
}

export class RoleExportRegistry {
  private readonly file: string

  constructor(file: string) {
    this.file = file
  }

  /** Installations connues ; relu à chaque fois (petit fichier, rare). */
  all(): RoleExportRecord[] {
    const read = readJson(this.file)
    if (!read.ok) return []
    const list = (read.value as { exports?: unknown } | null)?.exports
    if (!Array.isArray(list)) return []
    return list.flatMap((value) => parseRecord(value) ?? [])
  }

  find(file: string, id: string): RoleExportRecord | undefined {
    return this.all().find((r) => r.file === file && r.id === id)
  }

  byKey(key: string): RoleExportRecord | undefined {
    return this.all().find((r) => recordKey(r) === key)
  }

  /** Ajoute ou remplace l'installation de ce fichier et de cet identifiant. */
  put(record: RoleExportRecord): void {
    this.save([
      ...this.all().filter((r) => !(r.file === record.file && r.id === record.id)),
      record
    ])
  }

  forget(file: string, id: string): void {
    this.save(this.all().filter((r) => !(r.file === file && r.id === id)))
  }

  private save(exports: RoleExportRecord[]): void {
    mkdirSync(dirname(this.file), { recursive: true })
    writeFileAtomic(this.file, `${JSON.stringify({ version: 1, exports }, null, 2)}\n`, {
      mode: 0o600
    })
  }
}
