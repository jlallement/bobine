/**
 * Recherche dans les réglages (fiche 051) : chaque réglage tel qu'il est affiché (libellé d'une
 * ligne, titre d'une sous-partie, raccourci clavier), sa section et des mots qui y mènent. Un test
 * rend les sections et vérifie qu'aucun libellé affiché ne manque ici. Les libellés passent par les
 * mêmes clés que l'affichage, dans la langue courante (fiche 074).
 */
import i18next, { type ParseKeysWithoutVariables } from 'i18next'
import { hasAllWords, searchWords } from '@shared/conversation-search'
import { INTERFACE_SHORTCUTS, SHORTCUTS } from '@shared/shortcuts'
import type { ProfileSummary } from '@shared/agent'

/**
 * Onglets des réglages (fiche 136), en trois groupes séparés par un espace dans la colonne de
 * gauche : l'app, le travail, le suivi et la maintenance.
 */
export const SETTINGS_GROUPS = [
  ['general', 'appearance', 'notifications', 'shortcuts'],
  ['conversation', 'agents', 'memory', 'mcp', 'commands'],
  ['privacy', 'data', 'diagnostics', 'about']
] as const

export type SettingsSection = (typeof SETTINGS_GROUPS)[number][number]

/**
 * Où mène un résultat : une section des réglages, ou la page « Mon activité » de la fenêtre
 * principale (fiche 144), qui a remplacé Réglages › Consommation et reste trouvée par ses mots.
 */
export type SearchPlace = SettingsSection | 'activity'

/** Nom d'une section des réglages (ou de « Mon activité »), dans la langue courante. */
export const sectionLabel = (section: SearchPlace): string =>
  section === 'activity' ? i18next.t('activity.title') : i18next.t(`settings.section.${section}`)

export interface SettingsEntry {
  section: SearchPlace
  /** Libellé exactement tel qu'il est affiché (pour le retrouver et le mettre en avant). */
  label: string
  /** Autres mots qui y mènent, non affichés. */
  keywords?: string
  /** Où il se trouve dans la section, montré avec elle (l'agent d'une page d'agent). */
  place?: string
  /** Élément à montrer (`data-setting`), quand le libellé seul ne le retrouve pas. */
  target?: string
  /** Page d'agent où il se trouve (identifiant du profil), dans Réglages › Agents (fiche 136). */
  page?: string
}

/** Un réglage : clé de son libellé affiché, clé des mots qui y mènent. */
type IndexedSetting = readonly [SearchPlace, ParseKeysWithoutVariables, ParseKeysWithoutVariables]

const INDEX: readonly IndexedSetting[] = [
  ['general', 'settings.general.you', 'settingsSearch.you'],
  ['general', 'settings.general.firstName.label', 'settingsSearch.firstName'],
  ['general', 'settings.general.language.label', 'settingsSearch.language'],
  ['general', 'settings.general.tips.label', 'settingsSearch.tips'],
  ['general', 'settings.general.mac', 'settingsSearch.mac'],
  ['general', 'settings.general.keepAwake.label', 'settingsSearch.keepAwake'],
  ['general', 'settings.general.quickEntry.label', 'settingsSearch.quickEntry'],
  ['general', 'settings.general.command.label', 'settingsSearch.command'],
  ['general', 'settings.general.editor.label', 'settingsSearch.editor'],
  ['appearance', 'settings.appearance.interface', 'settingsSearch.interface'],
  ['appearance', 'settings.appearance.theme.label', 'settingsSearch.theme'],
  ['appearance', 'settings.appearance.accent.label', 'settingsSearch.accent'],
  ['appearance', 'settings.appearance.thread', 'settingsSearch.thread'],
  ['appearance', 'settings.appearance.conversationFont.label', 'settingsSearch.conversationFont'],
  [
    'appearance',
    'settings.appearance.conversationSize.label',
    'settingsSearch.conversationFontSize'
  ],
  ['appearance', 'settings.appearance.width.label', 'settingsSearch.width'],
  ['appearance', 'settings.appearance.density.label', 'settingsSearch.density'],
  ['appearance', 'settings.appearance.presentation.title', 'settingsSearch.presentation'],
  ['appearance', 'settings.appearance.presentation.label', 'settingsSearch.presentation'],
  ['appearance', 'settings.appearance.code', 'settingsSearch.codeAndTerminal'],
  ['appearance', 'settings.appearance.codeFont.label', 'settingsSearch.codeFont'],
  ['appearance', 'settings.appearance.codeSize.label', 'settingsSearch.codeFontSize'],
  ['appearance', 'settings.appearance.terminalFont.label', 'settingsSearch.terminalFont'],
  ['appearance', 'settings.appearance.terminalSize.label', 'settingsSearch.terminalFontSize'],
  ['notifications', 'settings.notifications.whenDone', 'settingsSearch.whenDone'],
  ['notifications', 'settings.notifications.notifications.label', 'settingsSearch.notifications'],
  ['notifications', 'settings.notifications.dockBounce.label', 'settingsSearch.dockBounce'],
  ['notifications', 'settings.notifications.dockBadge.label', 'settingsSearch.dockBadge'],
  ['notifications', 'settings.notifications.sound', 'settingsSearch.sound'],
  ['notifications', 'settings.notifications.attentionSound.label', 'settingsSearch.attentionSound'],
  ['conversation', 'settings.conversation.newConversation.label', 'settingsSearch.newConversation'],
  ['conversation', 'settings.conversation.agent.label', 'settingsSearch.agent'],
  ['conversation', 'settings.conversation.folder.label', 'settingsSearch.folder'],
  ['conversation', 'settings.conversation.mode.label', 'settingsSearch.mode'],
  ['conversation', 'settings.conversation.children', 'settingsSearch.children'],
  ['conversation', 'settings.conversation.maxChildren.label', 'settingsSearch.maxChildren'],
  ['conversation', 'settings.conversation.childProposals.label', 'settingsSearch.childProposals'],
  ['conversation', 'settings.conversation.maxLive.label', 'settingsSearch.maxLive'],
  ['conversation', 'turnGuards.settings.title', 'turnGuards.search.stalled'],
  ['conversation', 'turnGuards.settings.stalled.label', 'turnGuards.search.stalled'],
  ['conversation', 'turnGuards.settings.cap.label', 'turnGuards.search.cap'],
  ['conversation', 'turnGuards.settings.capAmount.label', 'turnGuards.search.cap'],
  ['conversation', 'turnGuards.settings.capTokens.label', 'turnGuards.search.cap'],
  ['agents', 'settings.agents.agents.label', 'settingsSearch.agents'],
  ['agents', 'customAgents.add', 'settingsSearch.customAgent'],
  ['agents', 'settings.network.label', 'settingsSearch.network'],
  ['agents', 'settings.network.proxy.label', 'settingsSearch.proxy'],
  ['memory', 'settings.memory.enabled.label', 'settingsSearch.memory'],
  ['memory', 'settings.memory.entries', 'settingsSearch.memory'],
  ['agents', 'settings.network.noProxy.label', 'settingsSearch.noProxy'],
  ['agents', 'settings.network.caCerts.label', 'settingsSearch.caCerts'],
  ['mcp', 'settings.section.mcp', 'settingsSearch.mcp'],
  ['commands', 'settings.section.commands', 'settingsSearch.commands'],
  ['commands', 'settings.commands.project.title', 'settingsSearch.projectCommands'],
  ['activity', 'activity.title', 'settingsSearch.usage'],
  ['activity', 'usage.board.byModel', 'settingsSearch.usageByModel'],
  ['activity', 'usage.board.byProject', 'settingsSearch.usageByProject'],
  ['activity', 'usage.board.topConversations', 'settingsSearch.usageConversations'],
  ['activity', 'usage.board.account.quota', 'settingsSearch.quota'],
  ['activity', 'usage.board.account.spend', 'settingsSearch.spend'],
  ['activity', 'usage.spend.today', 'settingsSearch.spend'],
  ['activity', 'usage.spend.week', 'settingsSearch.spend'],
  ['activity', 'usage.spend.month', 'settingsSearch.spend'],
  ['privacy', 'settings.privacy.allowed', 'settingsSearch.allowed'],
  ['privacy', 'settings.privacy.browser', 'settingsSearch.browser'],
  ['privacy', 'settings.privacy.keepCookies.label', 'settingsSearch.keepCookies'],
  ['privacy', 'settings.privacy.browserData.label', 'settingsSearch.browserData'],
  ['data', 'settings.data.backupTitle', 'settingsSearch.backupTitle'],
  ['data', 'settings.data.backup.label', 'settingsSearch.backup'],
  ['data', 'settings.data.restore.label', 'settingsSearch.restore'],
  ['data', 'settings.data.trash.title', 'settingsSearch.trash'],
  ['data', 'settings.data.recentFolders.label', 'settingsSearch.recentFolders'],
  ['data', 'settings.data.orphans.label', 'settingsSearch.orphans'],
  ['data', 'usage.board.reset.title', 'settingsSearch.usageHistory'],
  ['data', 'usage.board.reset.label', 'settingsSearch.usageReset'],
  ['data', 'settings.data.fresh.title', 'settingsSearch.freshTitle'],
  ['data', 'settings.data.fresh.tryLabel', 'settingsSearch.freshTry'],
  ['data', 'settings.data.fresh.agentsLabel', 'settingsSearch.freshAgents'],
  ['data', 'settings.data.fresh.resetLabel', 'settingsSearch.freshReset'],
  ['diagnostics', 'settings.section.diagnostics', 'settingsSearch.diagnostics'],
  ['diagnostics', 'diagnostics.group.environment', 'settingsSearch.environment'],
  ['diagnostics', 'diagnostics.group.ios', 'settingsSearch.ios'],
  ['diagnostics', 'diagnostics.group.android', 'settingsSearch.android'],
  ['diagnostics', 'diagnostics.group.providers', 'settingsSearch.providersGroup'],
  ['diagnostics', 'diagnostics.log.label', 'settingsSearch.log'],
  ['about', 'settings.section.about', 'settingsSearch.about']
]

/** Tous les réglages cherchables, raccourcis clavier compris, dans la langue courante. */
export function settingsIndex(): SettingsEntry[] {
  const t = i18next.t
  const settings = INDEX.map(([section, label, keywords]) => ({
    section,
    label: t(label),
    keywords: t(keywords)
  }))
  const keyword = t('settingsSearch.shortcut')
  const shortcuts = [...SHORTCUTS, ...INTERFACE_SHORTCUTS].map((s): SettingsEntry => ({
    section: 'shortcuts',
    label: s.label,
    keywords: `${keyword} ${s.keys}`
  }))
  // Raccourcis après les notifications, dans l'ordre des sections.
  const conversation = settings.findIndex((e) => e.section === 'conversation')
  return [...settings.slice(0, conversation), ...shortcuts, ...settings.slice(conversation)]
}

/** Clés d'API d'un agent, telles que la vue des réglages les donne (fiche 022). */
type AgentKeys = { profileId: string; keys: readonly { env: string; label: string }[] }

/**
 * La page de chaque agent installé (fiche 136), cherchable comme un réglage : sa connexion et
 * chacune de ses clés d'API, ses fournisseurs de modèles, ce qu'il annonce, ce qui lui est propre
 * (« Propre à IBM Bob », fiche 126) et chacun de ces éléments. Tout vient du profil (ADR-0011).
 */
export function agentEntries(
  profiles: readonly ProfileSummary[],
  apiKeys: readonly AgentKeys[] = []
): SettingsEntry[] {
  const t = i18next.t
  return profiles
    .filter((profile) => profile.available)
    .flatMap((profile) => {
      const on = (label: string, keywords: string, target?: string): SettingsEntry => ({
        section: 'agents',
        label,
        keywords: `${profile.label} ${keywords}`,
        place: profile.label,
        page: profile.id,
        ...(target ? { target } : {})
      })
      const keys = apiKeys.find((k) => k.profileId === profile.id)?.keys ?? []
      return [
        ...(keys.length > 0
          ? [on(t('settings.agents.page.connection'), t('settingsSearch.connection'))]
          : []),
        ...keys.map((key) => on(key.label, t('settingsSearch.apiKey'), `key:${key.env}`)),
        ...(profile.providers
          ? [on(t('settings.providers.label'), t('settingsSearch.providers'))]
          : []),
        on(t('settings.agents.capabilities.title'), t('settingsSearch.announced')),
        on(
          t('settings.agents.capabilities.specific', { agent: profile.label }),
          t('settingsSearch.specific')
        ),
        ...profile.capabilities.specific.map((item, i) =>
          on(item.label, item.detail ?? '', `${profile.id}:${item.id}:${i}`)
        )
      ]
    })
}

/**
 * Réglages qui contiennent tous les mots (libellé, mots-clés ou section), sans casse ni accents ;
 * ceux dont le libellé seul suffit d'abord. `extra` : entrées venues des agents (`agentEntries`).
 */
export function searchSettings(
  query: string,
  extra: readonly SettingsEntry[] = []
): SettingsEntry[] {
  const words = searchWords(query)
  if (words.length === 0) return []
  const found = [...settingsIndex(), ...extra].filter((e) =>
    hasAllWords(`${e.label} ${e.keywords ?? ''} ${sectionLabel(e.section)}`, words)
  )
  return [
    ...found.filter((e) => hasAllWords(e.label, words)),
    ...found.filter((e) => !hasAllWords(e.label, words))
  ]
}
