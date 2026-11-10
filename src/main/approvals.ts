/**
 * Autorisations retenues de l'app (fiche 072), comme Claude Code : sites extérieurs « toujours
 * autorisés » dans le navigateur intégré (sur ce Mac), et commandes « toujours » lancées sans
 * demander dans un dossier (terminal, serveur de dev, compilations). Révocables dans les Réglages.
 *
 * Commandes de préparation des worktrees d'un dépôt (fiche 175) : autorisées par dépôt et par
 * empreinte des commandes de son `.bobine/worktree.json`, gardées avec le texte montré.
 *
 * Fichier à part (`approvals.json`) : un fichier abîmé est mis de côté et rien n'est retenu, sans
 * toucher aux réglages ; l'utilisateur en est prévenu (`damaged`, fiche 196). Les champs inconnus
 * (version plus récente) sont gardés tels quels.
 */
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import type { ApprovalsView } from '@shared/approvals'
import type { SetupApprovals } from './changes/worktree-setup'
import { quarantine, readJson, writeFileAtomic } from './storage'

interface Stored {
  sites: string[]
  /** Commandes par dossier. */
  commands: Record<string, string[]>
  /** Préparation des worktrees, par racine de dépôt (fiche 175). */
  worktreeSetups: Record<string, StoredSetup>
  /** Champs d'une version plus récente (fiche 196), réécrits tels quels. */
  extra?: Record<string, unknown>
}

const KNOWN_KEYS = new Set(['sites', 'commands', 'worktreeSetups'])

interface StoredSetup {
  fingerprint: string
  setup?: string
  archive?: string
}

/** Ce dont les outils ont besoin pour un type d'autorisation retenue. */
export interface SiteMemory {
  has: (site: string) => boolean
  add: (site: string) => void
}

export interface CommandMemory {
  has: (workspace: string, command: string) => boolean
  add: (workspace: string, command: string) => void
}

const MAX_LENGTH = 2000

export class ApprovalStore {
  private readonly file: string
  private readonly listeners = new Set<() => void>()
  private data: Stored
  /** Fichier abîmé mis de côté à la lecture (son nouveau chemin), pour le dire (fiche 196). */
  readonly damaged: string | undefined

  constructor(file: string, onChange?: () => void) {
    this.file = file
    if (onChange) this.listeners.add(onChange)
    const { data, damaged } = load(file)
    this.data = data
    this.damaged = damaged
  }

  /** Prévient `listener` à chaque changement (les Réglages ouverts suivent) ; rend le désabonnement. */
  onChange(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  readonly sites: SiteMemory = {
    has: (site) => this.data.sites.includes(site),
    add: (site) => {
      if (!site || site.length > MAX_LENGTH || this.data.sites.includes(site)) return
      this.data = { ...this.data, sites: [...this.data.sites, site] }
      this.save()
    }
  }

  readonly commands: CommandMemory = {
    has: (workspace, command) => this.data.commands[workspace]?.includes(command) === true,
    add: (workspace, command) => {
      if (!workspace || !command || command.length > MAX_LENGTH) return
      const list = this.data.commands[workspace] ?? []
      if (list.includes(command)) return
      this.data = {
        ...this.data,
        commands: { ...this.data.commands, [workspace]: [...list, command] }
      }
      this.save()
    }
  }

  readonly worktreeSetups: SetupApprovals = {
    approved: (root, fingerprint) => this.data.worktreeSetups[root]?.fingerprint === fingerprint,
    approve: (root, fingerprint, config) => {
      if (!root || !fingerprint) return
      const entry: StoredSetup = {
        fingerprint,
        ...(config.setup ? { setup: config.setup.slice(0, MAX_LENGTH) } : {}),
        ...(config.archive ? { archive: config.archive.slice(0, MAX_LENGTH) } : {})
      }
      this.data = { ...this.data, worktreeSetups: { ...this.data.worktreeSetups, [root]: entry } }
      this.save()
    }
  }

  forgetWorktreeSetup(root: string): void {
    const { [root]: _gone, ...rest } = this.data.worktreeSetups
    this.data = { ...this.data, worktreeSetups: rest }
    this.save()
  }

  forgetSite(site: string): void {
    this.data = { ...this.data, sites: this.data.sites.filter((s) => s !== site) }
    this.save()
  }

  forgetCommand(workspace: string, command: string): void {
    const list = (this.data.commands[workspace] ?? []).filter((c) => c !== command)
    const commands = Object.fromEntries(
      Object.entries({ ...this.data.commands, [workspace]: list }).filter(([, l]) => l.length > 0)
    )
    this.data = { ...this.data, commands }
    this.save()
  }

  view(): ApprovalsView {
    return {
      sites: [...this.data.sites].sort(),
      commands: Object.entries(this.data.commands)
        .map(([workspace, commands]) => ({ workspace, commands: [...commands] }))
        .sort((a, b) => a.workspace.localeCompare(b.workspace)),
      worktreeSetups: Object.entries(this.data.worktreeSetups)
        .map(([root, { setup, archive }]) => ({
          root,
          ...(setup ? { setup } : {}),
          ...(archive ? { archive } : {})
        }))
        .sort((a, b) => a.root.localeCompare(b.root))
    }
  }

  private save(): void {
    mkdirSync(dirname(this.file), { recursive: true })
    const { extra, ...known } = this.data
    writeFileAtomic(this.file, JSON.stringify({ ...extra, ...known }, null, 2) + '\n')
    for (const listener of [...this.listeners]) listener()
  }
}

const strings = (value: unknown): string[] =>
  Array.isArray(value)
    ? [
        ...new Set(
          value.filter(
            (v): v is string => typeof v === 'string' && v !== '' && v.length <= MAX_LENGTH
          )
        )
      ]
    : []

function load(file: string): { data: Stored; damaged?: string } {
  const read = readJson(file)
  const empty: Stored = { sites: [], commands: {}, worktreeSetups: {} }
  if (!read.ok) {
    return read.reason === 'missing'
      ? { data: empty }
      : { data: empty, damaged: read.movedTo ?? file }
  }
  if (typeof read.value !== 'object' || read.value === null || Array.isArray(read.value)) {
    // JSON valide mais pas des autorisations : mis de côté, sinon la prochaine écriture l'efface.
    return { data: empty, damaged: quarantine(file) ?? file }
  }
  return { data: parseStored(read.value as Record<string, unknown>) }
}

function parseStored(obj: Record<string, unknown>): Stored {
  const commands: Record<string, string[]> = {}
  if (typeof obj['commands'] === 'object' && obj['commands'] !== null) {
    for (const [workspace, list] of Object.entries(obj['commands'])) {
      const valid = strings(list)
      if (workspace && valid.length) commands[workspace] = valid
    }
  }
  const extra = Object.fromEntries(Object.entries(obj).filter(([key]) => !KNOWN_KEYS.has(key)))
  return {
    sites: strings(obj['sites']),
    commands,
    worktreeSetups: loadSetups(obj['worktreeSetups']),
    ...(Object.keys(extra).length ? { extra } : {})
  }
}

function loadSetups(raw: unknown): Record<string, StoredSetup> {
  if (typeof raw !== 'object' || raw === null) return {}
  const result: Record<string, StoredSetup> = {}
  const text = (v: unknown) =>
    typeof v === 'string' && v && v.length <= MAX_LENGTH ? v : undefined
  for (const [root, value] of Object.entries(raw)) {
    const entry = (typeof value === 'object' && value !== null ? value : {}) as Record<
      string,
      unknown
    >
    const fingerprint = text(entry['fingerprint'])
    if (!root || !fingerprint) continue
    const setup = text(entry['setup'])
    const archive = text(entry['archive'])
    result[root] = { fingerprint, ...(setup ? { setup } : {}), ...(archive ? { archive } : {}) }
  }
  return result
}
