import type { AgentSettingsView } from '@shared/agent'
import { AboutSettings } from './AboutSettings'
import { AgentPage } from './AgentPage'
import { AgentsSettings, listedAgent } from './AgentsSettings'
import { CustomAgentForm } from './CustomAgentForm'
import { AppearanceSettings } from './AppearanceSettings'
import { CommandsSettings } from './CommandsSettings'
import { ConversationSettings } from './ConversationSettings'
import { DataSettings } from './DataSettings'
import { DiagnosticsSettings } from './DiagnosticsSettings'
import { GeneralSettings } from './GeneralSettings'
import { McpSettings } from './McpSettings'
import { MemorySettings } from './MemorySettings'
import { NotificationsSettings } from './NotificationsSettings'
import { PrivacySettings } from './PrivacySettings'
import type { AgentSubPage, SettingsDialogProps } from './SettingsDialog'
import { ApprovalRulesPage } from './ApprovalRulesPage'
import { ShortcutsSettings } from './ShortcutsSettings'
import { RolesSettings } from '../roles/RolesSettings'
import { basename } from '../common/Menus'

/** Formulaire d'un agent ACP déclaré (fiche 141) : `id` absent, un nouvel agent. */
export interface AgentForm {
  id?: string
}

/**
 * Contenu d'un onglet des réglages (fiche 136) ; dans Agents, la page d'un agent quand `agentPage`
 * en désigne un de la liste, ou le formulaire d'un agent déclaré (`agentForm`). Réglages pas
 * encore reçus du main : seuls les raccourcis et les nouveautés, qui n'en dépendent pas.
 */
export function SettingsBody({
  props,
  settings,
  agentPage,
  onOpenAgent,
  agentSub,
  onAgentSub,
  agentForm,
  onAgentForm
}: {
  props: SettingsDialogProps
  settings: AgentSettingsView | null
  agentPage: string | null
  onOpenAgent: (profileId: string | null) => void
  agentSub: AgentSubPage | null
  onAgentSub: (sub: AgentSubPage | null) => void
  agentForm: AgentForm | null
  onAgentForm: (form: AgentForm | null) => void
}) {
  if (props.section === 'shortcuts') return <ShortcutsSettings />
  if (props.section === 'about') return <AboutSettings />
  if (!settings) return null
  switch (props.section) {
    case 'general':
      return <GeneralSettings settings={settings} onPreferences={props.onPreferences} />
    case 'appearance':
      return (
        <AppearanceSettings
          preferences={settings.preferences}
          onPreferences={props.onPreferences}
        />
      )
    case 'notifications':
      return (
        <NotificationsSettings
          preferences={settings.preferences}
          notifications={settings.notifications}
          {...(props.notificationsBlocked ? { blocked: props.notificationsBlocked } : {})}
          onPreferences={props.onPreferences}
          onNotifications={props.onNotifications}
          onOpenNotificationSettings={props.onOpenNotificationSettings}
        />
      )
    case 'conversation':
      return (
        <ConversationSettings
          settings={settings}
          onPreferences={props.onPreferences}
          onNewConversation={props.onNewConversation}
        />
      )
    case 'agents':
      return (
        <AgentsBody
          props={props}
          settings={settings}
          agentPage={agentPage}
          onOpenAgent={onOpenAgent}
          agentSub={agentSub}
          onAgentSub={onAgentSub}
          agentForm={agentForm}
          onAgentForm={onAgentForm}
        />
      )
    case 'roles': {
      const active = props.activeConversation
      return (
        <RolesSettings
          conversationId={active?.id}
          conversationProfileId={active?.profileId}
          project={active ? basename(active.project ?? active.workspace) : undefined}
          profiles={settings.profiles}
        />
      )
    }
    case 'memory':
      return <MemorySettings settings={settings} onPreferences={props.onPreferences} />
    case 'mcp':
      return (
        <section>
          <McpSettings
            workspace={settings.workspace}
            {...(props.mcpTab ? { initialTab: props.mcpTab } : {})}
            onSection={props.onSection}
          />
        </section>
      )
    case 'commands':
      return (
        <section>
          <CommandsSettings
            commands={settings.commands}
            projectCommands={props.projectCommands}
            workspace={settings.workspace}
            onChange={props.onCommands}
          />
        </section>
      )
    case 'privacy':
      return (
        <PrivacySettings
          settings={settings}
          onPreferences={props.onPreferences}
          onForgetTool={props.onForgetTool}
          onForgetApproval={props.onForgetApproval}
        />
      )
    case 'data':
      return (
        <DataSettings
          recentWorkspaces={settings.recentWorkspaces}
          onBackupHistory={props.onBackupHistory}
          onForgetWorkspace={props.onForgetWorkspace}
        />
      )
    case 'diagnostics':
      return (
        <DiagnosticsSettings
          settings={settings}
          onReloadShellEnv={props.onReloadShellEnv}
          onSection={props.onSection}
          onOpenAgent={(profileId) => {
            onOpenAgent(profileId)
            props.onSection('agents')
          }}
        />
      )
  }
}

/** Agents : la liste, la page de l'agent ouvert, ou le formulaire d'un agent déclaré. */
function AgentsBody({
  props,
  settings,
  agentPage,
  onOpenAgent,
  agentSub,
  onAgentSub,
  agentForm,
  onAgentForm
}: {
  props: SettingsDialogProps
  settings: AgentSettingsView
  agentPage: string | null
  onOpenAgent: (profileId: string | null) => void
  agentSub: AgentSubPage | null
  onAgentSub: (sub: AgentSubPage | null) => void
  agentForm: AgentForm | null
  onAgentForm: (form: AgentForm | null) => void
}) {
  if (agentForm) {
    const declared = settings.profiles.find((p) => p.id === agentForm.id)?.custom
    return (
      <CustomAgentForm
        {...(declared ? { agent: declared } : {})}
        onSave={(draft) =>
          props.onSaveCustomAgent(draft, declared?.id).then((id) => {
            onAgentForm(null)
            onOpenAgent(id)
          })
        }
        onCancel={() => onAgentForm(null)}
      />
    )
  }
  const profile = settings.profiles.find((p) => p.id === agentPage && listedAgent(p))
  if (!profile) {
    return (
      <AgentsSettings
        settings={settings}
        onOpenAgent={onOpenAgent}
        onAddAgent={() => onAgentForm({})}
        onDiagnostics={() => props.onSection('diagnostics')}
      />
    )
  }
  // Approbations pour tous les projets (fiche 215) : sous-page, si le profil en déclare.
  if (agentSub === 'approvals' && profile.approvalRules) {
    return <ApprovalRulesPage profile={profile} />
  }
  const { onRestartAgent } = props
  const declared = profile.custom
  return (
    <AgentPage
      profile={profile}
      settings={settings}
      onOpenApprovals={() => onAgentSub('approvals')}
      onSetApiKey={props.onSetApiKey}
      onRemoveApiKey={props.onRemoveApiKey}
      // « Relancer » : l'agent de la conversation active, quand c'est celui-ci.
      {...(onRestartAgent && settings.profileId === profile.id
        ? { onRestart: onRestartAgent }
        : {})}
      {...(declared
        ? {
            onEdit: () => onAgentForm({ id: declared.id }),
            onRemove: () => {
              props.onRemoveCustomAgent(declared.id)
              onOpenAgent(null)
            }
          }
        : {})}
    />
  )
}
