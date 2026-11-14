/**
 * Installer un rôle dans un agent (fiche 223, phase 4, ADR-0047) : aperçu, installer ou mettre à
 * jour, retirer, état. Le format vient du profil (`roleExport`, ADR-0011), l'adaptateur sait où et
 * quoi écrire ; ce module tient les règles :
 *
 * - une entrée que Bobine n'a pas écrite (absente du registre) n'est jamais touchée (`foreign`) ;
 * - une entrée de Bobine modifiée à la main depuis n'est remplacée ou retirée qu'avec
 *   confirmation (`handEdited`) ;
 * - copie de sauvegarde avant toute écriture d'un fichier existant ; écriture d'un coup ;
 * - fichier relu juste avant d'écrire : changé entre-temps (Bob IDE…), tout est refait.
 */
import { serializeRole } from '@shared/roles'
import type {
  RoleExportError,
  RoleExportFormat,
  RoleExportOptions,
  RoleExportPreview,
  RoleExportRemoveResult,
  RoleExportResult,
  RoleExportScope,
  RoleExportState,
  RoleExportStatus,
  RoleExportTarget
} from '@shared/role-export'
import { readTarget, writeTarget } from './files'
import {
  fingerprint,
  type ExportedRole,
  type ExportLocations,
  type RoleExportAdapter
} from './format'
import { recordKey, type RoleExportRecord, type RoleExportRegistry } from './registry'

/** Ce qu'il faut d'un profil. */
export interface ExportProfile {
  id: string
  label: string
  /** Adaptateur du format de l'agent, déclaré dans son profil (ADR-0011). */
  roleExport?: RoleExportAdapter
}

/** Le rôle à installer : ce qui est écrit, et sa définition (empreinte). */
export interface RoleToExport extends ExportedRole {
  /** Portée du rôle dans Bobine : la portée proposée d'abord. */
  scope: 'builtin' | 'user' | 'project'
  /** Fichier Markdown du rôle (`serializeRole`) : son empreinte dit s'il a changé. */
  source: string
}

export interface RoleExportsOptions {
  profiles: () => readonly ExportProfile[]
  locations: ExportLocations
  registry: RoleExportRegistry
  /** Dossier des copies de sauvegarde, dans les données de Bobine. */
  backupDir: string
  /** Essais : appelé entre le calcul et la relecture qui précède l'écriture. */
  beforeWrite?: () => void
  log?: (message: string) => void
}

/** Essais d'écriture quand le fichier change entre la lecture et l'écriture. */
const ATTEMPTS = 3

const reserved = (adapter: RoleExportAdapter, id: string) =>
  adapter.reserved.includes(id.toLowerCase())

export class RoleExports {
  private readonly options: RoleExportsOptions

  constructor(options: RoleExportsOptions) {
    this.options = options
  }

  /** Profils qui savent recevoir un rôle (menu « Installer dans… »). */
  targets(): ExportProfile[] {
    return this.options.profiles().filter((p) => p.roleExport)
  }

  preview(role: RoleToExport, profileId: string, workspace?: string): RoleExportPreview {
    const { profile, adapter } = this.adapterOf(profileId)
    const scopes: RoleExportScope[] = workspace ? ['user', 'project'] : ['user']
    const places = scopes.map((scope) => {
      const place = adapter.place(scope, role.id, this.options.locations, workspace)
      const read = readTarget(place.file, place.root, scope, place.shown)
      return { scope, file: place.shown, exists: !('error' in read) && read.exists }
    })
    return {
      profileId,
      profileLabel: profile.label,
      format: adapter.format,
      id: role.id,
      label: role.label,
      listedAs: adapter.listedAs(role),
      sharedFile: adapter.sharedFile,
      replacesBasePrompt: adapter.replacesBasePrompt,
      readOnly: role.readOnly,
      defaultScope: role.scope === 'project' && workspace ? 'project' : 'user',
      places,
      text: adapter.entryText(role),
      ...(reserved(adapter, role.id) ? { error: { code: 'reserved', detail: role.id } } : {})
    }
  }

  /** Installe, ou met à jour une installation de Bobine. */
  install(
    role: RoleToExport,
    target: RoleExportTarget,
    workspace: string | undefined,
    options: RoleExportOptions
  ): RoleExportResult {
    const { profile, adapter } = this.adapterOf(target.profileId)
    if (reserved(adapter, role.id)) return fail({ code: 'reserved', detail: role.id })
    if (target.scope === 'project' && !workspace) return fail({ code: 'noProject' })
    const place = adapter.place(target.scope, role.id, this.options.locations, workspace)
    const error = (e: RoleExportError) => fail({ ...e, file: place.shown })
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      const read = readTarget(place.file, place.root, target.scope, place.shown)
      if ('error' in read) return fail(read.error)
      const entry = adapter.find(read.text, role.id)
      if (entry.kind === 'invalid') return error(entry.error)
      const record = this.options.registry.find(place.file, role.id)
      if (entry.kind === 'present') {
        if (!record) return error({ code: 'foreign', detail: role.id })
        if (entry.fingerprint !== record.written && !options.overwrite) {
          return error({ code: 'handEdited', detail: role.id })
        }
      }
      const put = adapter.put(read.text, role)
      if ('error' in put) return error(put.error)
      this.options.beforeWrite?.()
      const now = readTarget(place.file, place.root, target.scope, place.shown)
      if ('error' in now) return fail(now.error)
      if (now.exists !== read.exists || now.text !== read.text) continue
      if (put.text !== read.text) {
        const written = writeTarget(
          place.file,
          read,
          put.text,
          { dir: this.options.backupDir, format: adapter.format },
          place.shown
        )
        if (written) return fail(written)
      }
      const saved: RoleExportRecord = {
        profileId: profile.id,
        format: adapter.format,
        scope: target.scope,
        ...(target.scope === 'project' && workspace ? { workspace } : {}),
        file: place.file,
        id: role.id,
        written: put.fingerprint ?? adapter.fingerprintOf(role),
        role: fingerprint(role.source),
        readOnly: role.readOnly,
        useInBobine: options.useInBobine,
        at: new Date().toISOString()
      }
      this.options.registry.put(saved)
      this.options.log?.(`Rôle ${role.id} installé dans ${profile.id} (${target.scope})`)
      const status = this.statusOf(saved, role)
      return status ? { ok: true, status } : error({ code: 'unsupported' })
    }
    return error({ code: 'changed' })
  }

  /** Retire l'entrée de Bobine (ou son fichier) ; `force` : même modifiée à la main. */
  remove(key: string, force = false): RoleExportRemoveResult {
    const record = this.options.registry.byKey(key)
    if (!record) return { ok: true }
    const adapter = this.adapterFor(record.format)
    if (!adapter) return { ok: false, error: { code: 'unsupported', detail: record.profileId } }
    const place = adapter.place(record.scope, record.id, this.options.locations, record.workspace)
    const error = (e: RoleExportError): RoleExportRemoveResult => ({
      ok: false,
      error: { ...e, file: place.shown }
    })
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      const read = readTarget(record.file, place.root, record.scope, place.shown)
      if ('error' in read) return { ok: false, error: read.error }
      const entry = adapter.find(read.text, record.id)
      if (entry.kind === 'invalid') return error(entry.error)
      if (entry.kind === 'absent' || read.text === undefined) {
        this.options.registry.forget(record.file, record.id)
        return { ok: true }
      }
      if (entry.fingerprint !== record.written && !force) {
        return error({ code: 'handEdited', detail: record.id })
      }
      const dropped = adapter.drop(read.text, record.id)
      if ('error' in dropped) return error(dropped.error)
      this.options.beforeWrite?.()
      const now = readTarget(record.file, place.root, record.scope, place.shown)
      if ('error' in now) return { ok: false, error: now.error }
      if (now.text !== read.text) continue
      const written = writeTarget(
        record.file,
        read,
        dropped.text,
        { dir: this.options.backupDir, format: adapter.format },
        place.shown
      )
      if (written) return { ok: false, error: written }
      this.options.registry.forget(record.file, record.id)
      this.options.log?.(`Rôle ${record.id} retiré de ${record.profileId} (${record.scope})`)
      return { ok: true }
    }
    return error({ code: 'changed' })
  }

  /** Installations de ce rôle (projet : celles de ce dossier), et où elles en sont. */
  status(role: RoleToExport, workspace?: string): RoleExportStatus[] {
    return this.options.registry
      .all()
      .filter(
        (r) =>
          r.id === role.id &&
          this.adapterFor(r.format) !== undefined &&
          (r.scope === 'user' || r.workspace === workspace)
      )
      .flatMap((r) => this.statusOf(r, role) ?? [])
  }

  /**
   * Mode natif installé pour ce rôle et cet agent avec « lancer dans ce mode » (projet : ce
   * dossier, préféré à l'installation personnelle) ; `undefined` sinon.
   */
  nativeMode(
    profileId: string,
    roleName: string,
    workspace?: string
  ): { id: string; readOnly: boolean } | undefined {
    const mine = this.options.registry
      .all()
      .filter((r) => r.profileId === profileId && r.id === roleName && r.useInBobine)
    const found =
      mine.find((r) => r.scope === 'project' && workspace && r.workspace === workspace) ??
      mine.find((r) => r.scope === 'user')
    return found ? { id: found.id, readOnly: found.readOnly } : undefined
  }

  private statusOf(record: RoleExportRecord, role: RoleToExport): RoleExportStatus | undefined {
    const adapter = this.adapterFor(record.format)
    if (!adapter) return undefined
    const place = adapter.place(record.scope, record.id, this.options.locations, record.workspace)
    const profile = this.options.profiles().find((p) => p.id === record.profileId)
    return {
      key: recordKey(record),
      profileId: record.profileId,
      profileLabel: profile?.label ?? record.profileId,
      format: record.format,
      scope: record.scope,
      file: place.shown,
      id: record.id,
      state: this.stateOf(record, adapter, place, role),
      useInBobine: record.useInBobine
    }
  }

  private stateOf(
    record: RoleExportRecord,
    adapter: RoleExportAdapter,
    place: { root: string; shown: string },
    role: RoleToExport
  ): RoleExportState {
    const read = readTarget(record.file, place.root, record.scope, place.shown)
    if ('error' in read) return 'unreadable'
    const entry = adapter.find(read.text, record.id)
    if (entry.kind === 'invalid') return 'unreadable'
    if (entry.kind === 'absent') return 'missing'
    if (entry.fingerprint !== record.written) return 'handEdited'
    // Changé = ce qui serait écrit aujourd'hui n'est plus ce qui l'a été : un changement d'icône
    // ou de couleur, qui n'entre pas dans l'agent, ne compte pas (l'empreinte du rôle, `role`, est
    // gardée pour le journal du registre).
    return adapter.fingerprintOf(role) !== record.written ? 'roleChanged' : 'upToDate'
  }

  private adapterOf(profileId: string): { profile: ExportProfile; adapter: RoleExportAdapter } {
    const profile = this.options.profiles().find((p) => p.id === profileId)
    if (!profile?.roleExport) throw new Error(`Profil sans installation de rôles : ${profileId}`)
    return { profile, adapter: profile.roleExport }
  }

  /** Adaptateur d'un format, d'après les profils qui le déclarent. */
  private adapterFor(format: RoleExportFormat): RoleExportAdapter | undefined {
    return this.options.profiles().find((p) => p.roleExport?.format === format)?.roleExport
  }
}

const fail = (error: RoleExportError): RoleExportResult => ({ ok: false, error })

/** Le rôle tel qu'il part dans l'agent (un rôle fourni : dans la langue de l'interface). */
export function roleToExport(
  role: Parameters<typeof serializeRole>[0] & { scope: RoleToExport['scope'] }
): RoleToExport {
  return {
    id: role.name,
    label: role.label,
    description: role.description,
    prompt: role.prompt,
    readOnly: role.readOnly,
    scope: role.scope,
    source: serializeRole(role)
  }
}
