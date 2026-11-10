import { Bug, LoaderCircle, RotateCw } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { AgentSettingsView } from '@shared/agent'
import {
  diagnosticReport,
  diagnosticSummary,
  groupLevel,
  type CheckLevel,
  type DiagnosticAction,
  type DiagnosticCheck,
  type DiagnosticGroup
} from '@shared/diagnostics'
import type { AppInfo } from '@shared/ipc'
import { issueUrl } from '@shared/issue-url'
import type { McpAgentView } from '@shared/mcp'
import {
  mcpGroup,
  orderGroups,
  pendingAgentGroup,
  pendingProvidersGroup,
  pendingSystem
} from '../../diagnostics-view'
import { mcpStatus, testMcpServers, useMcpStatuses } from '../../mcp-status'
import type { SettingsSection } from '../../settings-search'
import { CopyButton } from '../common/CopyButton'
import { errorSummary } from './McpSettings'
import { useTranslation } from 'react-i18next'
import i18next from 'i18next'
import { LogSettings } from './LogSettings'
import { ipcErrorText } from '../../ipc-errors'

/**
 * Essais en cours, par agent : un second appel (double effet du mode strict en développement,
 * clics répétés) attend le même essai au lieu de relancer l'agent.
 */
const inFlight = new Map<string, Promise<DiagnosticGroup>>()

function agentDiagnostic(profileId: string, trySession: boolean): Promise<DiagnosticGroup> {
  const key = `${profileId}:${trySession}`
  const running = inFlight.get(key)
  if (running) return running
  const started = window.api.diagnostics
    .agent(profileId, trySession)
    .finally(() => inFlight.delete(key))
  inFlight.set(key, started)
  return started
}

function LevelDot({ level }: { level: CheckLevel }) {
  const { t } = useTranslation()
  if (level === 'pending') return <LoaderCircle size={12} className="spin diag-dot-spin" />
  return (
    <span
      className={`diag-dot ${level}`}
      role="img"
      aria-label={t(`diagnostics.level.${level}`)}
      title={t(`diagnostics.level.${level}`)}
    />
  )
}

/**
 * Réglages › Diagnostic (fiche 061) : tout ce dont l'app dépend, vérifié à l'ouverture et sur
 * demande, avec la marche à suivre. Les agents sont essayés hors conversation ; rien n'est demandé
 * à un modèle.
 */
export function DiagnosticsSettings({
  settings,
  onReloadShellEnv,
  onSection,
  onOpenAgent
}: {
  settings: AgentSettingsView
  onReloadShellEnv: () => Promise<void>
  onSection: (section: SettingsSection) => void
  /** Ouvre la page d'un agent dans Réglages › Agents (fiche 136). */
  onOpenAgent: (profileId: string) => void
}) {
  const { t } = useTranslation()
  const [system, setSystem] = useState<DiagnosticGroup[] | null>(null)
  const [agents, setAgents] = useState<Record<string, DiagnosticGroup>>({})
  const [mcp, setMcp] = useState<McpAgentView[] | 'loading' | 'error'>('loading')
  // Fournisseurs de modèles (fiche 104) : testés côté main, une ligne par fournisseur activé.
  const [providers, setProviders] = useState<DiagnosticGroup | null>(null)
  // Vérification en cours : une vérification relancée, ou la page refermée, ignore ses résultats.
  const current = useRef<{ cancelled: boolean } | null>(null)
  // Version pour l'issue GitHub (« Signaler un problème », fiche 105).
  const [info, setInfo] = useState<AppInfo | null>(null)
  useEffect(() => {
    void window.api.app.getInfo().then(setInfo, () => undefined)
  }, [])
  useMcpStatuses()
  const profiles = settings.profiles

  const checkAgent = useCallback(
    (token: { cancelled: boolean }, profileId: string, label: string, trySession: boolean) => {
      void agentDiagnostic(profileId, trySession).then(
        (group) => {
          if (!token.cancelled) setAgents((prev) => ({ ...prev, [profileId]: group }))
        },
        (e: unknown) => {
          if (token.cancelled) return
          setAgents((prev) => ({
            ...prev,
            [profileId]: {
              id: `agent:${profileId}`,
              title: label,
              checks: [
                {
                  id: 'start',
                  label: i18next.t('diagnostics.view.trial'),
                  level: 'error',
                  detail: ipcErrorText(e)
                }
              ]
            }
          }))
        }
      )
    },
    []
  )

  /** Lance les vérifications ; l'état n'est touché qu'à l'arrivée des résultats. */
  const launch = useCallback(
    (list: AgentSettingsView['profiles'], retestMcp: boolean) => {
      if (current.current) current.current.cancelled = true
      const token = { cancelled: false }
      current.current = token
      void window.api.diagnostics.system().then(
        (groups) => {
          if (!token.cancelled) setSystem(groups)
        },
        (e: unknown) => {
          if (token.cancelled) return
          setSystem([
            {
              id: 'app',
              title: 'Bobine',
              checks: [
                {
                  id: 'system',
                  label: i18next.t('diagnostics.view.checks'),
                  level: 'error',
                  detail: ipcErrorText(e)
                }
              ]
            }
          ])
        }
      )
      for (const profile of list) checkAgent(token, profile.id, profile.label, false)
      void window.api.providers.diagnose().then(
        (group) => {
          if (!token.cancelled) setProviders(group)
        },
        (e: unknown) => {
          if (token.cancelled) return
          setProviders({
            ...pendingProvidersGroup(),
            checks: [
              {
                id: 'list',
                label: i18next.t('diagnostics.providers.label'),
                level: 'error',
                detail: ipcErrorText(e)
              }
            ]
          })
        }
      )
      void window.api.mcp.list().then(
        (views) => {
          if (token.cancelled) return
          const installed = views.filter((v) =>
            list.some((p) => p.id === v.profileId && p.available)
          )
          setMcp(installed)
          void (async () => {
            for (const view of installed) {
              await testMcpServers(view.profileId, view.servers, !retestMcp)
            }
          })()
        },
        () => {
          if (!token.cancelled) setMcp('error')
        }
      )
      return token
    },
    [checkAgent]
  )

  // À l'ouverture : les agents d'alors (un essai réécrit leur annonce, donc les réglages).
  const [opening] = useState(profiles)
  useEffect(() => {
    const token = launch(opening, false)
    return () => {
      token.cancelled = true
    }
  }, [launch, opening])

  const rerun = (retestMcp: boolean) => {
    setSystem(null)
    setAgents({})
    setMcp('loading')
    setProviders(null)
    launch(profiles, retestMcp)
  }

  const groups = orderGroups([
    ...(system ?? pendingSystem()),
    ...profiles.map((p) => agents[p.id] ?? pendingAgentGroup(p.id, p.label)),
    mcpGroup(mcp, mcpStatus, errorSummary),
    providers ?? pendingProvidersGroup()
  ])
  const busy = groups.some((g) => g.checks.some((c) => c.level === 'pending'))

  const act = (group: DiagnosticGroup, action: DiagnosticAction) => {
    switch (action) {
      case 'reload-shell-env':
        void onReloadShellEnv()
          .catch(() => undefined)
          .finally(() => rerun(false))
        return
      case 'try-session': {
        const profile = profiles.find((p) => `agent:${p.id}` === group.id)
        if (!profile || !current.current) return
        setAgents((prev) => ({
          ...prev,
          [profile.id]: pendingAgentGroup(profile.id, profile.label)
        }))
        checkAgent(current.current, profile.id, profile.label, true)
        return
      }
      case 'open-agents-settings': {
        // La page de l'agent du groupe (sa connexion), ou celle du seul agent à fournisseurs.
        const withProviders = profiles.filter((p) => p.available && p.providers)
        const profile =
          profiles.find((p) => `agent:${p.id}` === group.id) ??
          (withProviders.length === 1 ? withProviders[0] : undefined)
        return profile && profile.available ? onOpenAgent(profile.id) : onSection('agents')
      }
      case 'open-mcp-settings':
        return onSection('mcp')
    }
  }

  return (
    <section data-testid="diagnostics">
      <div className="diag-head">
        <div className="diag-summary" data-testid="diagnostics-summary">
          <LevelDot level={busy ? 'pending' : worst(groups)} />
          {diagnosticSummary(groups)}
        </div>
        <button
          type="button"
          className="btn small"
          disabled={busy}
          onClick={() => rerun(true)}
          data-testid="diagnostics-rerun"
        >
          <RotateCw size={13} /> {t('diagnostics.rerun')}
        </button>
        <CopyButton
          text={() => diagnosticReport(groups, new Date())}
          label={t('diagnostics.copyReport')}
          testId="diagnostics-copy"
        />
        {info && (
          <a
            className="btn small"
            href={
              issueUrl({
                version: info.version,
                report: diagnosticReport(groups, new Date()),
                truncatedNote: t('diagnostics.reportIssueTruncated')
              }).url
            }
            target="_blank"
            rel="noreferrer"
            title={t('diagnostics.reportIssueHint')}
            data-testid="diagnostics-report-issue"
          >
            <Bug size={13} /> {t('diagnostics.reportIssue')}
          </a>
        )}
      </div>
      <LogSettings />
      {groups.map((group) => (
        <div key={group.id} className="diag-group" data-testid={`diag-group-${group.id}`}>
          <h3 className="diag-group-title">
            <LevelDot level={groupLevel(group)} />
            {group.title}
          </h3>
          <ul className="settings-list diag-list">
            {group.checks.map((check) => (
              <CheckRow key={check.id} check={check} onAction={(a) => act(group, a)} />
            ))}
          </ul>
        </div>
      ))}
      <p className="settings-row-hint">{t('diagnostics.privacy')}</p>
    </section>
  )
}

function worst(groups: readonly DiagnosticGroup[]): CheckLevel {
  const levels = groups.map(groupLevel)
  if (levels.includes('error')) return 'error'
  if (levels.includes('warning')) return 'warning'
  return 'ok'
}

function CheckRow({
  check,
  onAction
}: {
  check: DiagnosticCheck
  onAction: (action: DiagnosticAction) => void
}) {
  const { t } = useTranslation()
  return (
    <li
      className={`diag-check ${check.level}`}
      data-testid="diag-check"
      data-id={check.id}
      data-level={check.level}
    >
      <LevelDot level={check.level} />
      <div className="diag-check-body">
        <div className="diag-check-line">
          <span className="diag-check-label">{check.label}</span>
          <span className="diag-check-detail">{check.detail}</span>
        </div>
        {check.fix && <div className="diag-fix">{check.fix}</div>}
        {check.command && (
          <div className="diag-command">
            <code>{check.command}</code>
            <CopyButton text={() => check.command ?? ''} label={t('diagnostics.copyCommand')} />
          </div>
        )}
      </div>
      {check.action && (
        <button
          type="button"
          className="btn small"
          onClick={() => check.action && onAction(check.action)}
          data-testid={`diag-action-${check.action}`}
        >
          {t(`diagnostics.action.${check.action}`)}
        </button>
      )}
    </li>
  )
}
