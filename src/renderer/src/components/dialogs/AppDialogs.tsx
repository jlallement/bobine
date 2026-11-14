import { useState } from 'react'
import type { BranchPreview, ConversationSummary } from '@shared/agent'
import type { UserCommand } from '@shared/user-commands'
import type { Conversations } from '../../useConversations'
import { BranchDialog } from './BranchDialog'
import { ChildDialog } from '../sidebar/ChildDialog'
import { ReviewDialog } from '../panel/ReviewDialog'
import { DeleteDialog } from '../sidebar/ConversationMenu'
import { ResumeDialog } from './ResumeDialog'
import { SearchDialog } from './SearchDialog'
import { RolesHost } from '../roles/RolesHost'
import {
  SettingsDialog,
  type AgentPageRequest,
  type AgentSubPage,
  type SettingsSection
} from '../settings/SettingsDialog'

/** Message à modifier ou réessayer (fiche 023), quand des fichiers ont changé depuis ce point. */
export interface BranchRequest {
  itemId: number
  text: string
  preview: BranchPreview
}

/**
 * Dialogues de la fenêtre principale ouverts : réglages (⌘,) et recherche (⌘K, fiche 027), reprise
 * d'une session (fiche 055), suppression d'une conversation, branche d'un message (fiche 023),
 * conversation fille (fiche 097).
 */
export function useAppDialogs() {
  const [settingsSection, setSettingsSection] = useState<SettingsSection | null>(null)
  // Onglet de Réglages › Serveurs MCP demandé par le menu ⚙ (fiche 099) ; sinon « Bobine ».
  const [mcpTab, setMcpTab] = useState<string | undefined>(undefined)
  // Page d'agent demandée hors des réglages (« Gérer » d'une carte, fiche 215) ; `seq` la redemande.
  const [agentRequest, setAgentRequest] = useState<AgentPageRequest | undefined>(undefined)
  // Chaque ⌘K ouvre une recherche neuve (`key`).
  const [searchKey, setSearchKey] = useState<number | null>(null)
  const [resuming, setResuming] = useState(false)
  // Suppression demandée depuis la barre latérale ou le titre : une seule confirmation.
  const [deleting, setDeleting] = useState<ConversationSummary | null>(null)
  const [branching, setBranching] = useState<BranchRequest | null>(null)
  // « Lancer en parallèle… » (fiche 097) : la mère de la future fille.
  const [launching, setLaunching] = useState<ConversationSummary | null>(null)
  // « Faire relire… » (fiche 177) : la conversation dont le travail est relu.
  const [reviewing, setReviewing] = useState<ConversationSummary | null>(null)
  return {
    settingsSection,
    setSettingsSection: (section: SettingsSection | null) => {
      setMcpTab(undefined)
      setSettingsSection(section)
    },
    mcpTab,
    openMcpSettings: (tab?: string) => {
      setMcpTab(tab)
      setSettingsSection('mcp')
    },
    agentRequest,
    /** Ouvre Réglages › Agents à la page de cet agent (`sub` : une de ses sous-pages). */
    openAgentPage: (profileId: string, sub?: AgentSubPage) => {
      setMcpTab(undefined)
      setAgentRequest((current) => ({
        profileId,
        ...(sub ? { sub } : {}),
        seq: (current?.seq ?? 0) + 1
      }))
      setSettingsSection('agents')
    },
    searchKey,
    openSearch: () => setSearchKey(Date.now()),
    closeSearch: () => setSearchKey(null),
    resuming,
    setResuming,
    deleting,
    setDeleting,
    branching,
    setBranching,
    launching,
    setLaunching,
    reviewing,
    setReviewing
  }
}

export type AppDialogsState = ReturnType<typeof useAppDialogs>

interface Props {
  dialogs: AppDialogsState
  conversations: Conversations
  projectCommands: UserCommand[]
  /** Conversation trouvée par son contenu : ⌘F s'y ouvre sur ces mots (fiche 086). */
  onFindIn: (target: { id: string; query: string }) => void
  /** « Mon activité » (fiche 144), depuis la recherche des réglages. */
  onOpenActivity: () => void
}

/** Les dialogues de la fenêtre principale, ouverts d'après `useAppDialogs`. */
export function AppDialogs({
  dialogs,
  conversations: c,
  projectCommands,
  onFindIn,
  onOpenActivity
}: Props) {
  const { settingsSection, searchKey, resuming, deleting, branching, launching, reviewing } =
    dialogs
  return (
    <>
      <SettingsDialog
        open={settingsSection !== null}
        section={settingsSection ?? 'general'}
        {...(dialogs.mcpTab ? { mcpTab: dialogs.mcpTab } : {})}
        {...(dialogs.agentRequest ? { agentRequest: dialogs.agentRequest } : {})}
        onSection={dialogs.setSettingsSection}
        onOpenChange={(open) => !open && dialogs.setSettingsSection(null)}
        settings={c.settings}
        {...(c.notificationStatus.blocked
          ? { notificationsBlocked: c.notificationStatus.blocked }
          : {})}
        onPreferences={c.setPreferences}
        projectCommands={projectCommands}
        onCommands={c.setCommands}
        activeConversation={c.activeSummary}
        onNotifications={c.setNotifications}
        onOpenNotificationSettings={c.openNotificationSettings}
        onForgetWorkspace={c.forgetWorkspace}
        onForgetTool={c.forgetTool}
        onForgetApproval={c.forgetApproval}
        onSetApiKey={c.setApiKey}
        onRemoveApiKey={c.removeApiKey}
        onSaveCustomAgent={c.saveCustomAgent}
        onRemoveCustomAgent={c.removeCustomAgent}
        onNewConversation={c.setNewConversation}
        onReloadShellEnv={c.reloadShellEnv}
        onBackupHistory={c.backupHistory}
        onRestartAgent={c.restart}
        onOpenActivity={() => {
          dialogs.setSettingsSection(null)
          onOpenActivity()
        }}
      />
      {/* Assistant de création d'un rôle et « Confier à… » (fiche 223), d'où qu'ils viennent. */}
      <RolesHost active={c.activeSummary} profiles={c.settings?.profiles ?? []} />
      {searchKey !== null && (
        <SearchDialog
          key={searchKey}
          open
          onOpenChange={(open) => !open && dialogs.closeSearch()}
          conversations={c.list}
          activeId={c.activeId}
          onSelect={(id, query) => {
            c.select(id)
            if (query) onFindIn({ id, query })
          }}
        />
      )}
      {resuming && c.settings && (
        <ResumeDialog
          profiles={c.settings.profiles}
          profileId={c.activeSummary?.profileId ?? c.settings.profileId}
          workspace={c.activeSummary?.workspace ?? c.settings.workspace}
          onClose={() => dialogs.setResuming(false)}
          onResume={async (profileId, session) => {
            await c.resumeSession(profileId, session)
          }}
        />
      )}
      {deleting && (
        <DeleteDialog
          key={deleting.id}
          conversation={deleting}
          onWorktreeStatus={c.worktreeStatus}
          onClose={() => dialogs.setDeleting(null)}
          onConfirm={(options) => {
            void c.remove(deleting.id, options)
            dialogs.setDeleting(null)
          }}
        />
      )}
      {launching && (
        <ChildDialog
          key={launching.id}
          mother={launching}
          profiles={c.settings?.profiles ?? []}
          onClose={() => dialogs.setLaunching(null)}
        />
      )}
      {reviewing && (
        <ReviewDialog
          key={reviewing.id}
          author={reviewing}
          profiles={c.settings?.profiles ?? []}
          onClose={() => dialogs.setReviewing(null)}
        />
      )}
      {branching && (
        <BranchDialog
          preview={branching.preview}
          onClose={() => dialogs.setBranching(null)}
          onConfirm={(options) => {
            const { itemId, text } = branching
            dialogs.setBranching(null)
            void c.branch(itemId, text, options)
          }}
        />
      )}
    </>
  )
}
