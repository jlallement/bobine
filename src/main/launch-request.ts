/**
 * `bobine <dossier> ["premier message"]` (fiche 158) : lecture des arguments du premier lancement
 * et de ceux d'une seconde instance (`second-instance`), puis remise à l'interface. Pur, sans
 * Electron : le dossier est vérifié et la conversation créée par l'appelant.
 */
import { resolve } from 'node:path'
import type { LaunchPrefill } from '@shared/command-line'

export interface LaunchRequest {
  /** Dossier absolu demandé (non vérifié). */
  folder: string
  /** Premier message : posé dans la zone de saisie, jamais envoyé tout seul. */
  message?: string
}

/**
 * Les arguments de l'utilisateur dans un `argv` : après l'exécutable, et sans le chemin de l'app
 * quand Electron la lance depuis les sources (`electron . …`, `process.defaultApp`). Ce chemin est
 * le premier argument qui n'est pas une option, pas forcément le deuxième : dans l'`argv` d'une
 * seconde instance, Chromium place les options en tête.
 */
export function userArguments(argv: readonly string[], defaultApp: boolean): string[] {
  const rest = argv.slice(1)
  if (!defaultApp) return rest
  const app = rest.findIndex((arg) => !arg.startsWith('-'))
  return app < 0 ? rest : [...rest.slice(0, app), ...rest.slice(app + 1)]
}

/**
 * Réglage AppKit passé en argument (`-ApplePersistenceIgnoreState YES`, `-NSQuitAlwaysKeepsWindows
 * NO`) : un seul tiret, un nom en majuscule, puis sa valeur dans l'argument suivant. Les essais de
 * bout en bout s'en servent pour qu'aucune alerte « rouvrir les fenêtres » ne bloque l'app.
 */
const APPKIT_DEFAULT = /^-[A-Z][A-Za-z0-9]*$/

/**
 * Demande de lancement : le premier argument qui n'est pas une option est le dossier (relatif à
 * `cwd`), les suivants forment le message. Toute option (`--profil-temporaire`, `--reinitialiser`,
 * `--user-data-dir=…`, drapeaux de Chromium, `-psn_…` de macOS) est ignorée, un réglage AppKit
 * avec sa valeur ; `--` rend le reste littéral. Sans dossier, rien à faire (un simple relancement
 * ramène la fenêtre).
 */
export function parseLaunchArgs(args: readonly string[], cwd: string): LaunchRequest | undefined {
  const positional: string[] = []
  let literal = false
  for (let i = 0; i < args.length; i++) {
    const arg = args[i] ?? ''
    if (!literal && arg === '--') literal = true
    else if (!literal && APPKIT_DEFAULT.test(arg)) i++
    else if (literal || !arg.startsWith('-')) positional.push(arg)
  }
  const [folder, ...rest] = positional
  if (!folder?.trim()) return undefined
  const message = rest.join(' ').trim()
  return { folder: resolve(cwd, folder), ...(message ? { message } : {}) }
}

/** Ce dont le contrôleur a besoin de l'app (injecté : Electron, gestionnaire de conversations). */
export interface LaunchDeps {
  isFolder: (path: string) => boolean
  /** Nouvelle conversation dans ce dossier (même parcours que « Choisir un dossier ») ; son id. */
  openConversation: (folder: string) => Promise<string>
  /** Fenêtre au premier plan (rouverte si elle était fermée). */
  focus: () => void
  /** L'interface est prête : affiche la conversation et pose le message. */
  show: (prefill: LaunchPrefill, open: boolean) => void
  /** Dossier introuvable, ou conversation impossible. */
  fail: (folder: string, error?: unknown) => void
}

/**
 * Remet les demandes `bobine …` à l'app. Une demande qui arrive avant que l'app soit montée
 * (premier lancement, ou `second-instance` pendant le démarrage) attend `attach`. Le message
 * d'une demande arrivée avant que l'interface soit prête attend qu'elle le réclame (`take`) ;
 * ensuite il lui est envoyé directement. Il n'est jamais envoyé à l'agent.
 */
export class LaunchController {
  private deps: LaunchDeps | undefined
  private waiting: LaunchRequest[] = []
  private held: LaunchPrefill | undefined
  private rendererReady = false

  request(request: LaunchRequest): void {
    if (this.deps) void this.run(this.deps, request)
    else this.waiting.push(request)
  }

  attach(deps: LaunchDeps): void {
    this.deps = deps
    for (const request of this.waiting.splice(0)) void this.run(deps, request)
  }

  /** L'interface se monte : rend le message en attente (une fois) et se met à écouter. */
  take(): LaunchPrefill | null {
    this.rendererReady = true
    const held = this.held
    this.held = undefined
    return held ?? null
  }

  /** La fenêtre est fermée : la suivante devra réclamer à son tour. */
  windowClosed(): void {
    this.rendererReady = false
  }

  private async run(deps: LaunchDeps, { folder, message }: LaunchRequest): Promise<void> {
    if (!deps.isFolder(folder)) {
      deps.focus()
      deps.fail(folder)
      return
    }
    try {
      const id = await deps.openConversation(folder)
      deps.focus()
      const prefill = { id, text: message ?? '' }
      if (this.rendererReady) deps.show(prefill, true)
      else if (message) this.held = prefill
    } catch (error) {
      deps.focus()
      deps.fail(folder, error)
    }
  }
}
