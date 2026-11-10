/**
 * Vue des réglages pour le renderer (agents, dossier, préférences, approbations, clés), tirée du
 * magasin des réglages et des options du gestionnaire. Sortie de `manager.ts` (plafond de lignes).
 */
import type { AgentSettingsView } from '@shared/agent'
import { summarizeProfiles } from '../agent/profiles'
import type { SettingsStore } from '../settings-store'
import { hasFolder } from './agentless'
import type { ConversationManagerOptions } from './manager'
import type { ConversationRecord } from './store'
import { inGitRepo } from './helpers'

export function settingsViewOf(
  active: Pick<ConversationRecord, 'profileId' | 'workspace'>,
  store: SettingsStore,
  options: Pick<
    ConversationManagerOptions,
    'profiles' | 'pathEnv' | 'approvals' | 'quickEntryStatus'
  >
): AgentSettingsView {
  const settings = store.current
  return {
    profiles: summarizeProfiles(options.profiles, options.pathEnv(), settings.agentsSeen),
    profileId: active.profileId,
    workspace: active.workspace,
    recentWorkspaces: settings.recentWorkspaces,
    notifications: store.notificationsEnabled(),
    preferences: store.preferences(),
    inGitRepo: hasFolder(active.workspace) && inGitRepo(active.workspace),
    newConversation: settings.newConversation ?? {},
    approvals: options.approvals?.() ?? { sites: [], commands: [], worktreeSetups: [] },
    rememberedTools: Object.entries(settings.rememberedTools ?? {}).map(([profileId, tools]) => ({
      profileId,
      profileLabel: options.profiles.find((p) => p.id === profileId)?.label ?? profileId,
      tools
    })),
    apiKeys: options.profiles
      .filter((p) => p.apiKeys?.length)
      .map((p) => ({ profileId: p.id, profileLabel: p.label, keys: store.keyInfo(p) })),
    commands: settings.commands ?? [],
    ...(options.quickEntryStatus ? { quickEntry: options.quickEntryStatus() } : {})
  }
}
