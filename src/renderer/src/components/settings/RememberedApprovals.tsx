import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { AgentSettingsView } from '@shared/agent'
import type { ForgottenApproval } from '@shared/approvals'
import { rememberedToolText } from '@shared/permissions'
import { ConfirmRow, useConfirm } from './ConfirmRow'
import { SettingsTitle } from './rows'

/** Une ligne de la liste : ce qui est autorisé, d'où, et de quoi le révoquer. */
interface Allowed {
  key: string
  main: string
  /** Texte d'origine de l'agent, en infobulle, quand `main` en est une traduction. */
  mainTitle?: string
  mono?: boolean
  side?: string
  sideTitle?: string
  revokeLabel: string
  revokeAsk: string
  onRevoke: () => void
  testId: string
}

/** Un groupe de la liste : son titre (« Outils », « Commandes · bobine »), puis ses lignes. */
interface AllowedGroup {
  key: string
  label: string
  testId: string
  items: Allowed[]
}

const folderName = (workspace: string) => workspace.split('/').filter(Boolean).at(-1) ?? workspace

/**
 * Réglages › Confidentialité › Autorisé sans demander (fiches 042, 072, 136) : outils, sites, puis
 * commandes regroupées par dossier, dans une seule liste. Révoquer se confirme dans la ligne, comme
 * une suppression (fiche 126).
 */
export function RememberedApprovals({
  settings,
  onForgetTool,
  onForgetApproval
}: {
  settings: AgentSettingsView
  onForgetTool: (profileId: string, tool: string) => void
  onForgetApproval: (approval: ForgottenApproval) => void
}) {
  const { t } = useTranslation()
  // Une seule confirmation ouverte à la fois, tous groupes confondus.
  const confirm = useConfirm()
  const groups: AllowedGroup[] = [
    {
      key: 'tools',
      label: t('settings.privacy.tools.label'),
      testId: 'settings-remembered-tools',
      // Titre connu de l'app : dit dans la langue de l'interface (fiche 214) ; l'outil retenu reste
      // désigné par le titre exact de l'agent, aussi en infobulle.
      items: settings.rememberedTools.flatMap((agent) =>
        agent.tools.map((title) => {
          const tool = rememberedToolText(title)
          return {
            key: `tool:${agent.profileId}:${title}`,
            main: tool,
            ...(tool !== title ? { mainTitle: title } : {}),
            side: agent.profileLabel,
            revokeLabel: t('settings.privacy.tools.revokeLabel', { tool }),
            revokeAsk: t('settings.privacy.tools.revokeAsk', { tool }),
            onRevoke: () => onForgetTool(agent.profileId, title),
            testId: 'forget-tool'
          }
        })
      )
    },
    {
      key: 'sites',
      label: t('settings.privacy.sites.label'),
      testId: 'settings-approved-sites',
      items: settings.approvals.sites.map((site) => ({
        key: `site:${site}`,
        main: site,
        revokeLabel: t('settings.privacy.sites.revokeLabel', { site }),
        revokeAsk: t('settings.privacy.sites.revokeAsk', { site }),
        onRevoke: () => onForgetApproval({ site }),
        testId: 'forget-site'
      }))
    },
    ...settings.approvals.commands.map(({ workspace, commands }) => ({
      key: `commands:${workspace}`,
      label: t('settings.privacy.commands.label', { folder: folderName(workspace) }),
      testId: 'settings-approved-commands',
      items: commands.map((command) => ({
        key: `command:${workspace}:${command}`,
        main: command,
        mono: true,
        revokeLabel: t('settings.privacy.commands.revokeLabel', { command }),
        revokeAsk: t('settings.privacy.commands.revokeAsk', { command }),
        onRevoke: () => onForgetApproval({ workspace, command }),
        testId: 'forget-command'
      }))
    })),
    // Préparation des worktrees d'un dépôt (fiche 175) : les commandes du fichier, révocables.
    ...(settings.approvals.worktreeSetups ?? []).map(({ root, setup, archive }) => {
      const folder = folderName(root)
      const command = [setup, archive].filter(Boolean).join(' · ')
      return {
        key: `worktree-setup:${root}`,
        label: t('settings.privacy.worktreeSetups.label', { folder }),
        testId: 'settings-approved-worktree-setups',
        items: [
          {
            key: `worktree-setup-item:${root}`,
            main: command,
            mono: true,
            side: root,
            sideTitle: root,
            revokeLabel: t('settings.privacy.worktreeSetups.revokeLabel', { folder }),
            revokeAsk: t('settings.privacy.worktreeSetups.revokeAsk', { folder, command }),
            onRevoke: () => onForgetApproval({ worktreeSetup: root }),
            testId: 'forget-worktree-setup'
          }
        ]
      }
    })
  ].filter((group) => group.items.length > 0)
  return (
    <>
      <SettingsTitle help="settingsPrivacy">{t('settings.privacy.allowed')}</SettingsTitle>
      {groups.length === 0 ? (
        <ul className="settings-list" data-testid="settings-allowed-none">
          <li className="settings-list-empty">
            {t('settings.privacy.none')} {t('settings.privacy.allowedHint')}
          </li>
        </ul>
      ) : (
        <ul className="settings-list" data-testid="settings-allowed">
          {groups.map((group) => (
            <AllowedSection key={group.key} group={group} confirm={confirm} />
          ))}
        </ul>
      )}
    </>
  )
}

/** Un groupe : son titre, puis ses lignes, chacune avec sa confirmation de révocation. */
function AllowedSection({
  group,
  confirm
}: {
  group: AllowedGroup
  confirm: ReturnType<typeof useConfirm>
}): ReactNode {
  const { t } = useTranslation()
  return (
    <>
      <li className="settings-list-group" data-testid={group.testId}>
        {group.label}
      </li>
      {group.items.map((item) => (
        <li key={item.key}>
          <span
            className={`settings-list-main${item.mono ? ' mono' : ''}`}
            title={item.mainTitle ?? item.main}
          >
            {item.main}
          </span>
          {item.side && (
            <span className="settings-list-side" title={item.sideTitle}>
              {item.side}
            </span>
          )}
          <button
            className="icon-button small"
            aria-label={item.revokeLabel}
            aria-expanded={confirm.asking === item.key}
            title={t('settings.privacy.revoke')}
            onClick={() => confirm.ask(item.key)}
            data-testid={item.testId}
          >
            <X size={13} />
          </button>
          {confirm.asking === item.key && (
            <ConfirmRow
              message={item.revokeAsk}
              action={t('settings.privacy.revoke')}
              onConfirm={() => {
                confirm.done()
                item.onRevoke()
              }}
              onCancel={confirm.done}
            />
          )}
        </li>
      ))}
    </>
  )
}
