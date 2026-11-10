/**
 * Fournisseurs de modèles déclarés dans le fichier d'un agent (fiche 104) : lecture et modification,
 * dans le format que son profil déclare (`ProvidersSource`, fiche 140 : `opencode-providers.ts`).
 * Le fichier de l'agent reste la référence ; l'app n'y écrit jamais de clé en clair (`{env:VAR}`,
 * posée au lancement depuis le trousseau).
 *
 * Copie de secours `.bak` avant chaque écriture. Un fichier illisible n'est jamais réécrit.
 */
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import type { ModelProvider, ProviderKeySource } from '@shared/providers'
import type { ProvidersSource } from '../agent/adapters'
import { readConfig } from './mcp-files'
import { pruneRemoved, writeOrRemove } from './config-prune'

export interface ProvidersLocations {
  /** Dossier personnel (remplaçable pour les essais : jamais les vrais fichiers). */
  home: string
  /** `XDG_CONFIG_HOME`, que suivent certains agents. */
  xdgConfigHome?: string
}

/** Fournisseur tel que le fichier le déclare, avant ce que l'app sait de sa clé. */
export interface StoredProvider extends ModelProvider {
  key: ProviderKeySource
  /** Paquet du fournisseur, quand ce n'est pas le point d'accès compatible OpenAI. */
  npm?: string
}

export interface StoredProviders {
  providers: StoredProvider[]
  /** Liste blanche présente : seuls les fournisseurs listés sont proposés. */
  only: boolean
}

export class AgentProvidersConfig {
  private readonly source: ProvidersSource
  private readonly loc: ProvidersLocations

  constructor(source: ProvidersSource, loc: ProvidersLocations) {
    this.source = source
    this.loc = loc
  }

  /** Fichier de l'agent. */
  file(): string {
    return this.source.file(this.loc)
  }

  /** Chemin affiché : `~` pour le dossier personnel. */
  display(): string {
    const file = this.file()
    const home = this.loc.home.replace(/\/+$/, '')
    return file.startsWith(`${home}/`) ? `~${file.slice(home.length)}` : file
  }

  /** Fournisseurs déclarés, ou l'erreur d'un fichier illisible. */
  read(): StoredProviders | { error: string } {
    const config = readConfig(this.file())
    if ('error' in config) return { error: config.error }
    return this.source.parse(config.data)
  }

  /** Ajoute ou remplace un fournisseur (`previousId` : renommage). */
  save(provider: ModelProvider, previousId?: string): void {
    this.edit((text, data) => ({ text: this.source.save(text, data, provider, previousId) }))
  }

  /** Supprime un fournisseur ; ses conteneurs vidés partent aussi, et le fichier s'il est vide. */
  remove(id: string): void {
    this.edit((text, data) => this.source.remove(text, data, id))
  }

  setEnabled(id: string, enabled: boolean): void {
    this.edit((text, data) => ({ text: this.source.setEnabled(text, data, id, enabled) }))
  }

  /** « Seulement ces fournisseurs » : rien d'autre n'est proposé à l'agent. */
  setOnly(only: boolean): void {
    this.edit((text, data) => ({ text: this.source.setOnly(text, data, only) }))
  }

  /** La clé sera lue dans `env` (`{env:VAR}`) : remplace une clé en clair ou absente. */
  useKeyVariable(id: string, env: string): void {
    this.edit((text, data) => ({ text: this.source.useKeyVariable(text, data, id, env) }))
  }

  /** `removed` : entrée retirée, dont les conteneurs vidés partent avec elle (fiche 126). */
  private edit(
    change: (text: string, data: Record<string, unknown>) => { text: string; removed?: string[] }
  ): void {
    const file = this.file()
    const config = readConfig(file)
    if ('error' in config) throw new Error(config.error)
    const { text, removed } = change(config.text || '{}', config.data)
    mkdirSync(dirname(file), { recursive: true })
    writeOrRemove(file, removed ? pruneRemoved(text, removed) : text, { backup: true })
  }
}
