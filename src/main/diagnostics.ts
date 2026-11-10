/**
 * Diagnostic (fiche 061) : l'app, son environnement, les simulateurs, et le groupe d'un agent tiré
 * de son essai (`ConversationManager.checkAgent`). Commandes injectées (testable sans Xcode) ;
 * dossier personnel abrégé en `~` dans ce qui s'affiche (rapport à copier), `$HOME` dans les
 * commandes à taper.
 */
import { existsSync } from 'node:fs'
import { dirname } from 'node:path'
import type { AgentSnapshot } from '@shared/agent'
import type { DiagnosticCheck, DiagnosticGroup } from '@shared/diagnostics'
import type { AgentAnnouncement } from './agent/capabilities'
import type { AgentProfile } from './agent/profiles'
import { checkAxe } from './simulator/axe'
import type { Run } from './simulator/run'
import { SCREEN_RECORDING_SETTINGS, type ScreenAccess } from './screen-capture'
import { Simctl } from './simulator/simctl'
import { t } from 'i18next'
import { messageOf } from '@shared/errors'

/** Essai d'un agent hors de toute conversation (`ConversationManager.checkAgent`). */
export interface AgentCheck {
  /** Dossier où la session d'essai a été ouverte. */
  workspace: string
  /** Chemin de la commande ; absent : introuvable dans le PATH. */
  executable?: string
  /** Ce que l'agent a annoncé à `initialize` ; absent : il n'a pas démarré. */
  announcement?: AgentAnnouncement
  snapshot?: AgentSnapshot
  /**
   * Session d'essai : supprimée chez l'agent, fermée ou gardée (il ne sait pas la supprimer), ou
   * pas ouverte (`skipped`, pour ne rien laisser dans son historique).
   */
  session?: 'deleted' | 'closed' | 'kept' | 'skipped'
}

export interface SystemFacts {
  app: { version: string; electron: string; os: string; packaged: boolean }
  workspace: string
  home: string
  /** Lecture du shell de connexion au démarrage (ou au dernier « Relire le PATH »). */
  shell: { path: string; problem?: string }
  run: Run
  /** `xcrun` du simulateur iOS ; absent : pas de groupe iOS (simulateur absent, fiche 145). */
  xcrun?: string
  /** Binaire d'AXe retenu par l'app ; absent : introuvable. */
  axe?: string
  /** Comment l'obtenir quand il manque (développement : `pnpm fetch-axe`). */
  axeInstallHint?: string
  /** Racine du SDK Android trouvée ; absente : introuvable. */
  androidSdk?: string
  /** Autorisation « Enregistrement de l'écran » (captures, fiche 062), selon macOS. */
  screenAccess?: ScreenAccess
}

/** Chemin affiché : `~` pour le dossier personnel. */
export function tildify(path: string, home: string): string {
  return home && (path === home || path.startsWith(`${home}/`))
    ? `~${path.slice(home.length)}`
    : path
}

/** Chemin dans une commande à taper : entre guillemets, `$HOME` pour le dossier personnel. */
function shellPath(path: string, home: string): string {
  const shown = home && path.startsWith(`${home}/`) ? `$HOME${path.slice(home.length)}` : path
  return `"${shown}"`
}

/** Où en savoir plus quand une vérification échoue. */
const journalHint = () => t('diagnostics.check.logHint')

/** Groupes qui ne dépendent pas d'un agent ; l'ordre d'affichage est celui du renderer. */
export async function systemGroups(facts: SystemFacts): Promise<DiagnosticGroup[]> {
  const { xcrun } = facts
  const ios = xcrun === undefined ? [] : [await iosGroup({ ...facts, xcrun })]
  return [appGroup(facts), environmentGroup(facts), ...ios, androidGroup(facts)]
}

function appGroup(facts: SystemFacts): DiagnosticGroup {
  const { app, home } = facts
  const checks: DiagnosticCheck[] = [
    {
      id: 'version',
      label: t('diagnostics.check.version'),
      level: 'ok',
      detail: t('diagnostics.check.versionDetail', {
        version: app.version,
        kind: t(app.packaged ? 'diagnostics.check.packaged' : 'diagnostics.check.development'),
        electron: app.electron,
        os: app.os
      })
    },
    existsSync(facts.workspace)
      ? {
          id: 'workspace',
          label: t('diagnostics.check.workspace'),
          level: 'ok',
          detail: tildify(facts.workspace, home)
        }
      : {
          id: 'workspace',
          label: t('diagnostics.check.workspace'),
          level: 'warning',
          // Aucun dossier choisi (premier lancement, fiche 093) : pas un dossier disparu.
          detail: facts.workspace
            ? t('diagnostics.check.workspaceMissing', { folder: tildify(facts.workspace, home) })
            : t('diagnostics.check.noWorkspace'),
          fix: t('diagnostics.check.workspaceFix')
        }
  ]
  return { id: 'app', title: 'Bobine', checks }
}

function environmentGroup(facts: SystemFacts): DiagnosticGroup {
  const { shell } = facts
  const check: DiagnosticCheck = shell.problem
    ? {
        id: 'shell-path',
        label: t('diagnostics.check.shellPath'),
        level: 'warning',
        detail: shell.problem,
        fix: t('diagnostics.check.shellPathFix'),
        action: 'reload-shell-env'
      }
    : {
        id: 'shell-path',
        label: t('diagnostics.check.shellPath'),
        level: 'ok',
        detail: t('diagnostics.check.shellPathFrom', { path: shell.path })
      }
  return {
    id: 'environment',
    title: t('diagnostics.group.environment'),
    checks: [check, ...(facts.screenAccess ? [screenCheck(facts.screenAccess)] : [])]
  }
}

/** Autorisation d'enregistrer l'écran, pour les captures jointes aux messages (fiche 062). */
function screenCheck(access: NonNullable<SystemFacts['screenAccess']>): DiagnosticCheck {
  const base = { id: 'screen-recording', label: t('diagnostics.check.screen') }
  if (access === 'granted')
    return { ...base, level: 'ok', detail: t('diagnostics.check.screenGranted') }
  if (access === 'not-determined' || access === 'unknown') {
    return {
      ...base,
      level: 'optional',
      detail: t('diagnostics.check.screenNotDetermined')
    }
  }
  return {
    ...base,
    level: 'warning',
    detail: t('diagnostics.check.screenDenied'),
    fix: t('diagnostics.check.screenFix'),
    command: `open "${SCREEN_RECORDING_SETTINGS}"`
  }
}

async function iosGroup(facts: SystemFacts & { xcrun: string }): Promise<DiagnosticGroup> {
  const { run, home } = facts
  const checks: DiagnosticCheck[] = []
  const selected = await run('xcode-select', ['-p'], { timeoutMs: 10_000 })
  const developer = selected.code === 0 ? selected.stdout.toString('utf8').trim() : ''
  let xcode = false
  if (!developer) {
    checks.push({
      id: 'xcode',
      label: 'Xcode',
      level: 'optional',
      detail: t('diagnostics.check.xcodeMissing'),
      fix: t('diagnostics.check.xcodeMissingFix')
    })
  } else if (developer.includes('/CommandLineTools')) {
    checks.push({
      id: 'xcode',
      label: 'Xcode',
      level: 'warning',
      detail: t('diagnostics.check.xcodeCltOnly', { path: tildify(developer, home) }),
      fix: t('diagnostics.check.xcodeCltOnlyFix'),
      command: 'sudo xcode-select -s /Applications/Xcode.app'
    })
  } else {
    xcode = true
    const version = await run(facts.xcrun, ['xcodebuild', '-version'], { timeoutMs: 20_000 })
    const name = version.code === 0 ? version.stdout.toString('utf8').split('\n')[0]?.trim() : ''
    checks.push({
      id: 'xcode',
      label: 'Xcode',
      level: 'ok',
      detail: `${name || 'Xcode'} · ${tildify(developer, home)}`
    })
  }
  if (xcode) checks.push(await simulatorsCheck(facts))
  checks.push(await axeCheck(facts))
  return { id: 'ios', title: t('diagnostics.group.ios'), checks }
}

async function simulatorsCheck(facts: SystemFacts & { xcrun: string }): Promise<DiagnosticCheck> {
  try {
    const devices = await new Simctl(facts.run, facts.xcrun).devices()
    const booted = devices.filter((d) => d.state === 'Booted').length
    if (devices.length === 0) {
      return {
        id: 'simulators',
        label: t('diagnostics.check.simulators'),
        level: 'warning',
        detail: t('diagnostics.check.noSimulator'),
        fix: t('diagnostics.check.noSimulatorFix')
      }
    }
    return {
      id: 'simulators',
      label: t('diagnostics.check.simulators'),
      level: 'ok',
      detail: booted
        ? t('diagnostics.check.simulatorsBooted', {
            count: devices.length,
            booted: t('diagnostics.check.booted', { count: booted })
          })
        : t('diagnostics.check.simulatorsAvailable', { count: devices.length })
    }
  } catch (error) {
    return {
      id: 'simulators',
      label: t('diagnostics.check.simulators'),
      level: 'warning',
      detail: messageOf(error),
      fix: t('diagnostics.check.simulatorsFix')
    }
  }
}

async function axeCheck(facts: SystemFacts): Promise<DiagnosticCheck> {
  const { run, home, axe } = facts
  const base = { id: 'axe', label: t('diagnostics.check.axe') }
  const check = await checkAxe(run, axe || undefined)
  if (!check.ok) {
    if (check.problem === 'missing') {
      return {
        ...base,
        level: 'optional',
        detail: t('diagnostics.check.axeMissing'),
        fix: facts.axeInstallHint ?? t('diagnostics.check.axeMissingFix')
      }
    }
    return {
      ...base,
      level: 'warning',
      detail:
        check.problem === 'too-old'
          ? t('diagnostics.check.axeTooOld', { version: check.version ?? '?' })
          : check.detail
            ? t('diagnostics.check.axeSilentDetail', { detail: check.detail })
            : t('diagnostics.check.axeSilent'),
      fix: facts.axeInstallHint ?? t('diagnostics.check.axeTooOldFix')
    }
  }
  const where = axe ? ` · ${tildify(axe, home)}` : ''
  // Attribut posé par un téléchargement dans un navigateur : macOS peut bloquer le binaire.
  const quarantined =
    !!axe &&
    (await run('xattr', ['-p', 'com.apple.quarantine', axe], { timeoutMs: 5_000 })).code === 0
  if (quarantined && axe) {
    return {
      ...base,
      level: 'warning',
      detail: t('diagnostics.check.axeQuarantine', { version: check.version, where }),
      fix: t('diagnostics.check.axeQuarantineFix'),
      command: `xattr -dr com.apple.quarantine ${shellPath(dirname(axe), home)}`
    }
  }
  return { ...base, level: 'ok', detail: `${check.version}${where}` }
}

function androidGroup(facts: SystemFacts): DiagnosticGroup {
  const check: DiagnosticCheck = facts.androidSdk
    ? {
        id: 'sdk',
        label: t('diagnostics.check.androidSdk'),
        level: 'ok',
        detail: tildify(facts.androidSdk, facts.home)
      }
    : {
        id: 'sdk',
        label: t('diagnostics.check.androidSdk'),
        level: 'optional',
        detail: t('diagnostics.check.androidSdkMissing'),
        fix: t('diagnostics.check.androidSdkMissingFix')
      }
  return { id: 'android', title: t('diagnostics.group.android'), checks: [check] }
}

/** Groupe d'un agent : commande, démarrage, session d'essai dans le dossier courant. */
export function agentGroup(
  profile: AgentProfile,
  check: AgentCheck,
  context: { home: string; anotherInstalled: boolean }
): DiagnosticGroup {
  const { home } = context
  const group = (checks: DiagnosticCheck[]): DiagnosticGroup => ({
    id: `agent:${profile.id}`,
    title: profile.label,
    checks
  })
  if (!check.executable) {
    return group([
      {
        id: 'command',
        label: t('diagnostics.agent.command'),
        level: context.anotherInstalled ? 'optional' : 'error',
        detail: t('diagnostics.agent.commandMissing', { command: profile.command }),
        fix: `${profile.installHint ? `${profile.installHint} ` : ''}${t('diagnostics.agent.alreadyInstalled')}`,
        action: 'reload-shell-env'
      }
    ])
  }
  const checks: DiagnosticCheck[] = [
    {
      id: 'command',
      label: t('diagnostics.agent.command'),
      level: 'ok',
      detail: tildify(check.executable, home)
    }
  ]
  const { announcement, snapshot } = check
  if (!announcement) {
    checks.push({
      id: 'start',
      label: t('diagnostics.agent.start'),
      level: 'error',
      detail: snapshot?.detail ?? t('diagnostics.agent.noAnswer'),
      fix: journalHint()
    })
    return group(checks)
  }
  const name = announcement.name ?? profile.label
  checks.push({
    id: 'start',
    label: t('diagnostics.agent.start'),
    level: 'ok',
    detail: announcement.version
      ? `${name} ${announcement.version}`
      : t('diagnostics.agent.noVersion', { name })
  })
  const untested = untestedVersion(profile, announcement.version)
  if (untested) checks.push(untested)
  checks.push(...sessionChecks(profile, check, home))
  return group(checks)
}

/** La version annoncée fait partie de celles que l'app a vérifiées (`1.19` vaut pour `1.19.3`). */
export function isTestedVersion(tested: readonly string[], version: string): boolean {
  const v = version.replace(/^v/, '')
  return tested.some((t) => v === t || v.startsWith(`${t}.`))
}

/** Avertissement quand l'agent annonce une version que l'app n'a pas vérifiée (fiche 140). */
function untestedVersion(
  profile: AgentProfile,
  version: string | undefined
): DiagnosticCheck | undefined {
  const tested = profile.testedVersions
  if (!tested?.length || !version || isTestedVersion(tested, version)) return undefined
  return {
    id: 'version',
    label: t('diagnostics.agent.version'),
    level: 'warning',
    detail: t('diagnostics.agent.untestedVersion', { versions: tested.join(', ') }),
    fix: t('diagnostics.agent.untestedVersionFix', { agent: profile.label })
  }
}

function sessionChecks(profile: AgentProfile, check: AgentCheck, home: string): DiagnosticCheck[] {
  const snapshot = check.snapshot
  const where = tildify(check.workspace, home)
  if (snapshot?.status === 'ready' && check.session === 'skipped') {
    return [
      {
        id: 'session',
        label: t('diagnostics.agent.session'),
        level: 'optional',
        detail: t('diagnostics.agent.sessionSkipped', { agent: profile.label }),
        action: 'try-session'
      }
    ]
  }
  if (snapshot?.status === 'ready') {
    const model = snapshot.controls.find((c) => c.category === 'model' && c.type === 'select')
    const kept = check.session === 'closed' || check.session === 'kept'
    const checks: DiagnosticCheck[] = [
      {
        id: 'session',
        label: t('diagnostics.agent.session'),
        level: 'ok',
        detail: t(kept ? 'diagnostics.agent.sessionReadyKept' : 'diagnostics.agent.sessionReady', {
          where
        })
      }
    ]
    if (model?.type === 'select') {
      const current = model.options.find((o) => o.value === model.currentValue)?.name
      checks.push(
        model.options.length === 0
          ? {
              id: 'models',
              label: t('diagnostics.agent.models'),
              level: 'warning',
              detail: t('diagnostics.agent.noModels'),
              fix: t('diagnostics.agent.noModelsFix', { agent: profile.label })
            }
          : {
              id: 'models',
              label: t('diagnostics.agent.models'),
              level: 'ok',
              detail: current
                ? t('diagnostics.agent.modelsDefault', { count: model.options.length, current })
                : t('diagnostics.agent.modelsCount', { count: model.options.length })
            }
      )
    }
    return checks
  }
  const blocker = snapshot?.status === 'needs-action' ? snapshot.blocker : undefined
  if (blocker?.kind === 'trust') {
    return [
      {
        id: 'trust',
        label: t('diagnostics.agent.folder'),
        level: 'warning',
        detail: t('diagnostics.agent.untrusted', { where, agent: profile.label }),
        fix: t('diagnostics.agent.untrustedFix', {
          choice: t(blocker.trustRemembered ? 'blocker.trust.remembered' : 'blocker.trust.session')
        })
      }
    ]
  }
  if (blocker?.kind === 'auth') {
    const inApp = blocker.methods
      .filter((m) => !m.step)
      .map((m) => t('diagnostics.agent.quotedMethod', { name: m.name }))
    const step = blocker.methods.find((m) => m.step)?.step
    const ways = [
      inApp.length
        ? t('diagnostics.agent.authInApp', {
            methods: inApp.join(` ${t('diagnostics.agent.or')} `)
          })
        : '',
      step ? t('diagnostics.agent.authTerminal') : '',
      blocker.apiKey ? t('diagnostics.agent.authApiKey') : ''
    ].filter(Boolean)
    return [
      {
        id: 'auth',
        label: t('diagnostics.agent.auth'),
        level: 'error',
        detail: t('diagnostics.agent.notSignedIn'),
        fix: t('diagnostics.agent.authFix', {
          ways: ways.join(`, ${t('diagnostics.agent.or')} `)
        }),
        ...(step ? { command: step.command } : {}),
        ...(blocker.apiKey ? { action: 'open-agents-settings' as const } : {})
      }
    ]
  }
  if (blocker?.kind === 'license') {
    const step = blocker.steps[0]
    return [
      {
        id: 'license',
        label: t('diagnostics.agent.license'),
        level: 'error',
        detail: t('diagnostics.agent.licenseToAccept'),
        fix: t('diagnostics.agent.licenseFix'),
        ...(step ? { command: step.command } : {})
      }
    ]
  }
  return [
    {
      id: 'session',
      label: t('diagnostics.agent.session'),
      level: 'error',
      detail: snapshot?.detail
        ? t('diagnostics.agent.sessionFailedDetail', { where, detail: snapshot.detail })
        : t('diagnostics.agent.sessionFailed', { where }),
      fix: journalHint()
    }
  ]
}
