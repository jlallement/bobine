/**
 * Ce que Bobine sait faire avec un agent (fiche 054, ADR-0011) : ce que l'agent annonce à
 * `initialize` et que l'app utilise (retenu d'un lancement à l'autre), et ce que son profil sait de
 * lui en propre. La seconde liste est tirée des champs du profil : un réglage déclaré ne peut pas y
 * manquer. Chaque repère (`id`) figure dans la matrice de `docs/agents.md` (vérifié par un test).
 */
import type { InitializeResponse } from '../../shared/acp-sdk.mts'
import type { AgentCapabilitiesView, CapabilityItem } from '@shared/agent'
import type { AgentProfile } from './profiles'
import { t } from 'i18next'

/** Annonce d'un agent à `initialize`, telle que l'app la retient (`settings.json`). */
export interface AgentAnnouncement {
  name?: string
  version?: string
  /** Date du démarrage (ISO). */
  seenAt: string
  load: boolean
  resume: boolean
  delete: boolean
  image: boolean
  embeddedContext: boolean
  mcpHttp: boolean
  /** `session/list` (fiche 055) ; absent dans une annonce retenue avant la fiche : inconnu. */
  list?: boolean
  /** Autres dossiers (`additionalDirectories`, fiche 179) ; absent : annonce plus ancienne. */
  additionalDirectories?: boolean
}

const FLAGS = ['load', 'resume', 'delete', 'image', 'embeddedContext', 'mcpHttp'] as const

export function announcementOf(init: InitializeResponse, seenAt: string): AgentAnnouncement {
  const caps = init.agentCapabilities
  const name = init.agentInfo?.title ?? init.agentInfo?.name ?? undefined
  const version = init.agentInfo?.version || undefined
  return {
    ...(name ? { name } : {}),
    ...(version ? { version } : {}),
    seenAt,
    load: caps?.loadSession === true,
    resume: !!caps?.sessionCapabilities?.resume,
    delete: !!caps?.sessionCapabilities?.delete,
    image: caps?.promptCapabilities?.image === true,
    embeddedContext: caps?.promptCapabilities?.embeddedContext === true,
    mcpHttp: caps?.mcpCapabilities?.http === true,
    list: !!caps?.sessionCapabilities?.list,
    additionalDirectories: !!caps?.sessionCapabilities?.additionalDirectories
  }
}

/** Même annonce, à la date près : inutile de réécrire les réglages. */
export function sameAnnouncement(a: AgentAnnouncement | undefined, b: AgentAnnouncement): boolean {
  return (
    !!a &&
    a.name === b.name &&
    a.version === b.version &&
    a.list === b.list &&
    a.additionalDirectories === b.additionalDirectories &&
    FLAGS.every((f) => a[f] === b[f])
  )
}

/** Annonce relue des réglages ; `undefined` si elle est mal formée. */
export function parseAnnouncement(raw: unknown): AgentAnnouncement | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const r = raw as Record<string, unknown>
  if (typeof r['seenAt'] !== 'string' || !FLAGS.every((f) => typeof r[f] === 'boolean')) {
    return undefined
  }
  const text = (v: unknown) => (typeof v === 'string' && v ? v : undefined)
  const name = text(r['name'])
  const version = text(r['version'])
  return {
    ...(name ? { name } : {}),
    ...(version ? { version } : {}),
    seenAt: r['seenAt'],
    ...(Object.fromEntries(FLAGS.map((f) => [f, r[f]])) as Record<(typeof FLAGS)[number], boolean>),
    ...(typeof r['list'] === 'boolean' ? { list: r['list'] } : {}),
    ...(typeof r['additionalDirectories'] === 'boolean'
      ? { additionalDirectories: r['additionalDirectories'] }
      : {})
  }
}

/** Ce que l'agent annonce et que l'app utilise, avec ce que ça change. */
function announcedItems(a: AgentAnnouncement): CapabilityItem[] {
  return [
    {
      id: 'reopen',
      label: t('capabilities.reopen.label'),
      supported: a.load || a.resume,
      detail: a.load
        ? t('capabilities.reopen.load')
        : a.resume
          ? t('capabilities.reopen.resume')
          : t('capabilities.reopen.none')
    },
    ...(a.list === undefined
      ? []
      : [
          {
            id: 'list',
            label: t('capabilities.list.label'),
            supported: a.list,
            detail: a.list ? t('capabilities.list.yes') : t('capabilities.list.no')
          }
        ]),
    {
      id: 'delete',
      label: t('capabilities.delete.label'),
      supported: a.delete,
      detail: a.delete ? t('capabilities.delete.yes') : t('capabilities.delete.no')
    },
    {
      id: 'images',
      label: t('capabilities.images.label'),
      supported: a.image,
      ...(a.image ? {} : { detail: t('capabilities.images.no') })
    },
    {
      id: 'embedded-files',
      label: t('capabilities.embeddedFiles.label'),
      supported: a.embeddedContext,
      detail: a.embeddedContext
        ? t('capabilities.embeddedFiles.yes')
        : t('capabilities.embeddedFiles.no')
    },
    {
      id: 'app-tools',
      label: t('capabilities.appTools.label'),
      supported: a.mcpHttp,
      ...(a.mcpHttp ? {} : { detail: t('capabilities.appTools.no') })
    },
    ...(a.additionalDirectories === undefined
      ? []
      : [
          {
            id: 'additional-directories',
            label: t('capabilities.additionalDirectories.label'),
            supported: a.additionalDirectories,
            detail: a.additionalDirectories
              ? t('capabilities.additionalDirectories.yes')
              : t('capabilities.additionalDirectories.no')
          }
        ])
  ]
}

/**
 * Fichiers de l'agent que Bobine lit ou modifie (règles, exclusions, serveurs MCP, règles
 * d'approbation, fournisseurs), sortis de `specificItems` (complexité bornée, fiche 089).
 */
function fileItems(profile: AgentProfile): CapabilityItem[] {
  const items: CapabilityItem[] = []
  if (profile.rules) {
    items.push({
      id: 'rules-files',
      label: t('capabilities.rulesFiles.label'),
      detail: profile.rules.summary()
    })
  }
  if (profile.exclusions) {
    items.push({
      id: 'ignore-files',
      label: t('capabilities.ignoreFiles.label'),
      detail: profile.exclusions.summary()
    })
  }
  if (profile.mcpConfig) {
    items.push({
      id: 'mcp-files',
      label: t('capabilities.mcpFiles.label'),
      detail: t('capabilities.mcpFiles.detail', { files: profile.mcpConfig.summary() })
    })
  }
  // Un repère par format de règles d'approbation (`ApprovalRulesSource.id`), comme pour les coûts.
  if (profile.approvalRules?.id === 'bob-settings') {
    items.push({
      id: 'approval-rules',
      label: t('capabilities.approvalRules.label'),
      detail: t('capabilities.approvalRules.bob')
    })
  }
  if (profile.providers) {
    items.push({
      id: 'model-providers',
      label: t('capabilities.modelProviders.label'),
      detail: t('capabilities.modelProviders.detail')
    })
  }
  return items
}

/** Repères des sources de coûts et de quota du profil (`CostSource.id`, `QuotaSource.id`). */
function costAndQuotaItems(profile: AgentProfile): CapabilityItem[] {
  const items: CapabilityItem[] = []
  // Un repère par source de coûts (`CostSource.id`) : une nouvelle source a ses propres textes.
  if (profile.costSource?.id === 'bob-db') {
    items.push({
      id: 'cost-bob-db',
      label: t('capabilities.costBobDb.label'),
      detail: t('capabilities.costBobDb.detail')
    })
    if (profile.costSource.subagents) {
      items.push({
        id: 'subagent-cost-bob-db',
        label: t('capabilities.subagentCost.label'),
        detail: t('capabilities.subagentCost.detail')
      })
    }
  }
  // Un repère par source de quota (`QuotaSource.id`), comme pour les coûts.
  if (profile.quotaSource?.id === 'bob-status') {
    items.push({
      id: 'quota-bob-status',
      label: t('capabilities.quotaBobStatus.label'),
      detail: t('capabilities.quotaBobStatus.detail')
    })
  }
  return items
}

/** Ce que le profil sait de l'agent en propre (ADR-0011), fonctions d'abord. */
export function specificItems(profile: AgentProfile): CapabilityItem[] {
  const items: CapabilityItem[] = []
  const name = profile.label
  items.push(...costAndQuotaItems(profile))
  if (profile.subagentFormat) {
    items.push({
      id: 'subagent-calls',
      label: t('capabilities.subagentCalls.label'),
      detail: profile.subagentFormat.summary()
    })
  }
  if (profile.subagentReplay) {
    items.push({
      id: 'subagent-replay',
      label: t('capabilities.subagentReplay.label'),
      detail: t('capabilities.subagentReplay.detail', { agent: name })
    })
  }
  if (profile.subagentStream) {
    items.push({
      id: 'subagent-live',
      label: t('capabilities.subagentLive.label'),
      detail: t('capabilities.subagentLive.detail', { agent: name })
    })
  }
  if (profile.subagentStream?.background && profile.subagentReplay) {
    items.push({
      id: 'subagent-background',
      label: t('capabilities.subagentBackground.label'),
      detail: t('capabilities.subagentBackground.detail', { agent: name })
    })
  }
  if (profile.diffSource) {
    items.push({
      id: 'replay-diffs',
      label: t('capabilities.replayDiffs.label'),
      detail: t('capabilities.replayDiffs.detail', { agent: name })
    })
  }
  if (profile.toolStatus?.id === 'opencode-tool-calls') {
    items.push({
      id: 'execute-errors',
      label: t('capabilities.executeErrors.label'),
      detail: t('capabilities.executeErrors.detail', { agent: name })
    })
  }
  if (profile.childModelChoice) {
    items.push({
      id: 'child-model',
      label: t('capabilities.childModel.label'),
      detail: t('capabilities.childModel.detail', { agent: name })
    })
  }
  if (profile.emptySessionTitle) {
    items.push({
      id: 'hidden-empty-sessions',
      label: t('capabilities.hiddenEmptySessions.label'),
      detail: t('capabilities.hiddenEmptySessions.detail', { agent: name })
    })
  }
  if (profile.initialModeMeta) {
    items.push({
      id: 'start-mode',
      label: t('capabilities.startMode.label'),
      detail: t('capabilities.startMode.detail', {
        agent: name,
        key: profile.initialModeMeta.key
      })
    })
  }
  if (profile.logFiles) {
    items.push({
      id: 'agent-log',
      label: t('capabilities.agentLog.label'),
      detail: t('capabilities.agentLog.detail', { agent: name, path: profile.logFiles })
    })
  }
  if (profile.alwaysScope) {
    items.push({
      id: 'always-scope',
      label: t('capabilities.alwaysScope.label'),
      detail: t('capabilities.alwaysScope.detail', { agent: name })
    })
  }
  if (profile.compactCommand) {
    items.push({
      id: 'compact-command',
      label: t('capabilities.compactCommand.label'),
      detail: t('capabilities.compactCommand.detail', { command: profile.compactCommand })
    })
  }
  items.push(...fileItems(profile))
  for (const key of profile.apiKeys ?? []) {
    items.push({
      id: 'api-key',
      label: t('capabilities.apiKey.label'),
      detail: t('capabilities.apiKey.detail', { env: key.env })
    })
  }
  const licenseSteps = new Set(profile.license?.steps ?? [])
  for (const [id, step] of Object.entries(profile.terminalSteps ?? {})) {
    if (licenseSteps.has(id)) continue
    items.push({
      id: 'terminal-login',
      label: t('capabilities.terminalLogin.label'),
      detail: `\`${step.command}\``
    })
  }
  const labelled = Object.keys(profile.authMethodLabels ?? {})
  if (labelled.length > 0) {
    items.push({
      id: 'auth-method-labels',
      label: t('capabilities.authMethodLabels.label'),
      detail: t('capabilities.authMethodLabels.detail', {
        agent: name,
        methods: labelled.join(', ')
      })
    })
  }
  if (profile.license) {
    const step = profile.license.steps.map((id) => profile.terminalSteps?.[id]).find(Boolean)
    items.push({
      id: 'license',
      label: t('capabilities.license.label'),
      detail: step
        ? t('capabilities.license.inTerminal', { command: step.command })
        : t('capabilities.license.detail')
    })
  }
  if (profile.testedVersions?.length) {
    items.push({
      id: 'tested-versions',
      label: t('capabilities.testedVersions.label'),
      detail: t('capabilities.testedVersions.detail', {
        versions: profile.testedVersions.join(', ')
      })
    })
  }
  if (profile.trust?.flag) {
    items.push({
      id: 'folder-trust',
      label: t('capabilities.folderTrust.label'),
      detail: t(
        profile.trust.remembered
          ? 'capabilities.folderTrust.remembered'
          : 'capabilities.folderTrust.session',
        { agent: name, flag: profile.trust.flag }
      )
    })
  }
  return items
}

export function describeCapabilities(
  profile: AgentProfile,
  announcement: AgentAnnouncement | undefined
): AgentCapabilitiesView {
  return {
    ...(announcement
      ? {
          announced: {
            ...(announcement.name ? { name: announcement.name } : {}),
            ...(announcement.version ? { version: announcement.version } : {}),
            seenAt: announcement.seenAt,
            items: announcedItems(announcement)
          }
        }
      : {}),
    specific: specificItems(profile)
  }
}
