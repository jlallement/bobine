/**
 * Canaux de l'app elle-même (sortis d'`ipc.ts`, fiche 116) : infos, erreurs de l'interface,
 * journal, relance, installation (fiche 073) et fenêtre À propos (fiche 116).
 */
import type { InstalledFonts, IpcHandlers } from '@shared/ipc'
import type { Language } from '@shared/i18n/language'
import { t } from 'i18next'
import { buildInfo, type BuildInfo } from './build-info'
import type { CommandLineStatus, LaunchPrefill } from '@shared/command-line'
import type { FreshStartIpc } from './fresh-start-app'
import { log } from './log'
import type { AppAlerts } from './app-alerts'
import { isAppAlertKind } from '@shared/app-alerts'
import { isHelpTopic, type HelpTarget, type HelpTopic } from '@shared/help-topics'
import type { SelfInstaller } from './self-install'

export interface AppIpcDeps {
  appName: string
  appVersion: string
  electronVersion: string
  platform: string
  /** Date et commit du build (fiche 116) ; lus de `build-info` par défaut. */
  build?: BuildInfo
  /** Langue des fenêtres de macOS pour ce lancement, si l'app la règle (fiche 074). */
  nativeLanguage?: Language
  /** Ouvre le journal de l'app (injecté : Electron). */
  showLog?: () => void
  /** Quitte puis relance l'app (injecté : Electron). */
  relaunch?: () => void
  /** Avis de l'app (fiche 194) et rapport du plantage précédent, montré dans le Finder. */
  alerts?: Pick<AppAlerts, 'list' | 'dismiss'> & { showReport: () => void }
  /** Installation par l'app elle-même (fiche 073). */
  installer?: Pick<SelfInstaller, 'offer' | 'install' | 'dismiss'>
  /** Recommencer à neuf : profil temporaire, réinitialisation (fiche 148). */
  freshStart?: FreshStartIpc
  /** Commande `bobine` du terminal (fiche 158). */
  commandLine?: {
    status: () => CommandLineStatus
    install: () => CommandLineStatus
    uninstall: () => CommandLineStatus
  }
  /** Message de `bobine <dossier> "message"` à remettre à l'interface (fiche 158). */
  takeLaunch?: () => LaunchPrefill | null
  /** Polices installées (fiche 136) ; listes vides par défaut (essais, hors macOS). */
  fonts?: () => Promise<InstalledFonts>
  /** Mode présentation (fiche 159) : lecture et changement. */
  presentation?: { active: () => boolean; set: (active: boolean) => void }
  /** Fenêtre À propos (fiche 116, injectée : fenêtres, agents). */
  about?: {
    technicalInfo: () => string
    close: () => void
    showChangelog: () => void
  }
  /** Fenêtre d'aide (fiche 186, injectée : fenêtres). */
  help?: {
    open: (topic: HelpTopic | null) => void
    target: () => { target: HelpTarget; search: boolean }
    showChangelog: () => void
  }
}

type AppChannels = Extract<
  keyof IpcHandlers,
  `app:${string}` | `about:${string}` | `help:${string}`
>

export function appHandlers(
  deps: AppIpcDeps
): Pick<IpcHandlers, Exclude<AppChannels, 'app:backupHistory'>> {
  const about = () => {
    if (!deps.about) throw new Error(t('ipc.unavailable.about'))
    return deps.about
  }
  const help = () => {
    if (!deps.help) throw new Error(t('ipc.unavailable.help'))
    return deps.help
  }
  const build = deps.build ?? buildInfo()
  const fresh = () => {
    if (!deps.freshStart) throw new Error(t('ipc.unavailable.freshStart'))
    return deps.freshStart
  }
  const commandLine = () => {
    if (!deps.commandLine) throw new Error(t('ipc.unavailable.commandLine'))
    return deps.commandLine
  }
  return {
    'app:getInfo': () => ({
      name: deps.appName,
      version: deps.appVersion,
      electron: deps.electronVersion,
      platform: deps.platform,
      buildDate: build.date,
      commit: build.commit,
      ...(deps.nativeLanguage ? { nativeLanguage: deps.nativeLanguage } : {}),
      ...(deps.freshStart ? { freshStart: deps.freshStart.info } : {})
    }),
    'app:fonts': () => deps.fonts?.() ?? { families: [], monospace: [] },
    'app:presentation': () => deps.presentation?.active() ?? false,
    'app:setPresentation': (active) => {
      if (typeof active !== 'boolean') throw new Error('Paramètre invalide : active')
      deps.presentation?.set(active)
      return undefined
    },
    'app:reportError': (report) => {
      const r = (typeof report === 'object' && report !== null ? report : {}) as Record<
        string,
        unknown
      >
      const text = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '')
      log.error(
        `Interface (${text(r['source'], 40) || '?'}) : ${text(r['message'], 2000) || '(sans message)'}`,
        ...(text(r['stack'], 8000) ? [text(r['stack'], 8000)] : [])
      )
      return undefined
    },
    'app:showLog': () => {
      deps.showLog?.()
      return undefined
    },
    'app:alerts': () => deps.alerts?.list() ?? [],
    'app:dismissAlert': (kind) => {
      if (!isAppAlertKind(kind)) throw new Error('Paramètre invalide : kind')
      deps.alerts?.dismiss(kind)
      return undefined
    },
    'app:showCrashReport': () => {
      deps.alerts?.showReport()
      return undefined
    },
    'app:relaunch': () => {
      deps.relaunch?.()
      return undefined
    },
    'app:installOffer': () => deps.installer?.offer() ?? null,
    'app:install': async (scope) => {
      if (!deps.installer) throw new Error(t('ipc.unavailable.install'))
      await deps.installer.install(scope)
      return undefined
    },
    'app:dismissInstall': () => {
      deps.installer?.dismiss()
      return undefined
    },
    'app:resetPlan': () => fresh().plan(),
    'app:reset': (uninstall) => {
      if (typeof uninstall !== 'boolean') throw new Error('Paramètre invalide : uninstall')
      fresh().reset(uninstall)
      return undefined
    },
    'app:openTemporaryProfile': (freshAgents) => {
      if (typeof freshAgents !== 'boolean') throw new Error('Paramètre invalide : freshAgents')
      fresh().openTemporary(freshAgents)
      return undefined
    },
    'app:takeLaunch': () => deps.takeLaunch?.() ?? null,
    // Indisponible (sources) : `null`, la ligne des Réglages se masque sans erreur au journal.
    'app:commandStatus': () => deps.commandLine?.status() ?? null,
    'app:installCommand': () => commandLine().install(),
    'app:uninstallCommand': () => commandLine().uninstall(),
    'about:technicalInfo': () => about().technicalInfo(),
    'about:close': () => {
      about().close()
      return undefined
    },
    'about:showChangelog': () => {
      about().showChangelog()
      return undefined
    },
    'help:open': (topic) => {
      // Sujet venu du renderer : seulement un de la liste (`HELP_TOPICS`).
      if (topic !== null && !isHelpTopic(topic)) throw new Error('Paramètre invalide : topic')
      help().open(topic)
      return undefined
    },
    'help:target': () => help().target(),
    'help:showChangelog': () => {
      help().showChangelog()
      return undefined
    }
  }
}
