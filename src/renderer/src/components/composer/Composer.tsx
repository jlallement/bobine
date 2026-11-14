import { History } from 'lucide-react'
import type { RuleFileView } from '@shared/rules'
import type { ConversationAppTools, McpAgentView } from '@shared/mcp'
import {
  useCallback,
  useId,
  useState,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
  type SyntheticEvent,
  useMemo
} from 'react'
import {
  insertMention,
  type ExcludedPaths,
  type PromptAttachment,
  type ScreenCaptureResult,
  type WorkspaceFile
} from '@shared/attachments'
import { useComposerDraft } from '../../useComposerDraft'
import { useCommandMenu } from '../../useCommandMenu'
import { useMentions } from '../../useMentions'
import { useComposerInbox } from '../../useComposerInbox'
import { useTextareaLayout } from '../../useTextareaLayout'
import { composerKeyAction, nextOption } from '../../composer-keys'
import { composerView, type ComposerView } from '../../composer-view'
import { FileMenu, type MentionEntry } from './FileMenu'
import { ComposerAttachments } from './ComposerAttachments'
import { useScreenCapture } from './useScreenCapture'
import { ComposerBar } from './ComposerBar'
import type {
  AgentBlocker,
  AgentCommand,
  AgentConfigureRequest,
  AgentSettingsView,
  AgentSnapshot,
  ControlValue,
  QueuedMessage,
  SessionControl
} from '@shared/agent'
import { BlockerPanel } from './BlockerPanel'
import { refusedTurnText } from '../../turn-auth-text'
import type { ConversationUsage } from '@shared/usage'
import type { UsageActions } from '../../useTurnGuards'
import type { GitBranchInfo } from '../common/Menus'
import { ComposerContext } from './ComposerContext'
import { CommandMenu } from './CommandMenu'
import { QueuedMessages } from './QueuedMessages'
import {
  appCommandOf,
  mergeCommands,
  withCompactCommand,
  type AppCommandName
} from '@shared/app-commands'
import {
  expandCommand,
  toAgentCommands,
  userCommandOf,
  type UserCommand
} from '@shared/user-commands'
import type { ComposerInbox } from '../../useFileDrop'
import { useTranslation } from 'react-i18next'
import { ComposerTip } from '../tips/ComposerTip'
import {
  RoleDestinationFor,
  RoleTokens,
  useRoleCompose,
  useRoleFrame,
  type ComposerRoles
} from '../roles/useRoleCompose'
import { useTipsContext } from '../../useTips'
import i18next from 'i18next'

interface Props {
  /** Fichiers déposés sur la conversation, à joindre au message (`useFileDrop`). */
  composerInbox?: ComposerInbox
  snapshot: AgentSnapshot | null
  settings: AgentSettingsView | null
  /** Conversation encore vide (accueil) : l'invite demande quoi faire, pas de répondre. */
  fresh?: boolean
  /** Consommation rapportée par l'agent pour cette conversation. */
  usage?: ConversationUsage
  /** Compaction en un clic, plafond de coût (fiche 157). */
  usageActions?: UsageActions
  autoFocus?: boolean
  /** Branche du worktree de la conversation (fiche 036). */
  branch?: string
  onNewWorktree?: () => void
  /** Branche git du dossier, à côté du dossier (fiche 049) ; un clic ouvre son état. */
  gitBranch?: GitBranchInfo
  /** Conversation du brouillon (fiche 026) : texte gardé en la quittant, retrouvé en y revenant. */
  draftKey?: string
  onSend: (text: string, attachments?: PromptAttachment[]) => void
  /** Commandes personnelles et du projet (fiche 045). */
  userCommands?: UserCommand[]
  /** Fichiers du dossier pour les mentions `@`. */
  onSearchFiles: (query: string) => Promise<WorkspaceFile[]>
  /** Dialogue de choix de fichiers à joindre. */
  onPickFiles: () => Promise<string[]>
  /** Fichiers que l'agent exclut (`.bobignore`…), à confirmer avant de les joindre (fiche 155). */
  onCheckExcluded?: (paths: string[]) => Promise<ExcludedPaths>
  /** Capture d'une zone de l'écran (fiche 062) ; `null` si annulée ; empêchement (fiche 124). */
  onCaptureScreen?: () => Promise<ScreenCaptureResult>
  /** Réglage « Enregistrement de l'écran » de macOS, quand la capture est impossible (fiche 124). */
  onOpenCaptureSettings?: () => Promise<void>
  /** Avertissement affiché dans le fil (pièce jointe refusée…). */
  onWarn: (message: string) => void
  onCancel: () => void
  /** Retire un message de la file d'attente et le rend (pour le modifier). */
  onUnqueue: (messageId: string) => Promise<QueuedMessage | undefined>
  /** Interrompt la réponse et envoie la file d'attente, ce message en premier. */
  onSendNow: (messageId: string) => void
  /** Commande de l'app (`/clear`, `/context`…) : traitée par l'app, pas envoyée telle quelle. */
  onAppCommand: (name: AppCommandName, args: string) => void
  onRestart: () => void
  onConfigure: (request: AgentConfigureRequest) => void
  onChooseWorkspace: () => void
  /** Menu du dossier (fiche 158). */
  onRevealWorkspace?: () => void
  onOpenTerminalHere?: () => void
  onSetControl: (id: string, value: ControlValue) => void
  /** Règles actives (fiche 056) : lues à l'ouverture des réglages de session, ouvertes en aperçu. */
  onLoadRules?: () => Promise<RuleFileView[]>
  onOpenRule?: (rule: RuleFileView) => void
  /** Serveurs MCP de la conversation (fiche 060), dans « Réglages de la session ». */
  onLoadMcp?: () => Promise<McpAgentView | undefined>
  /** Noms des outils de Bobine que reçoit la conversation (fiche 099). */
  onLoadAppTools?: () => Promise<ConversationAppTools>
  /** Réglages › Serveurs MCP, sur cet onglet (« bobine »), sinon celui de l'agent. */
  onOpenMcpSettings?: (tab?: string) => void
  /** Réglages › Consommation (fiche 137). */
  onOpenUsage?: () => void
  /** Conversation en lecture seule : repartir sur une nouvelle avec le même agent et dossier. */
  onContinueInNew: () => void
  /** Actions requises par l'agent avant d'ouvrir la session (Bob : SSO, dossier). */
  onAuthenticate: (methodId: string) => void
  onRetry: () => unknown
  /** Clé d'API saisie dans « Connexion requise » (fiche 022). */
  onUseApiKey: (env: string, value: string) => Promise<void>
  /** Commande du profil lancée dans le terminal de l'app (connexion, licence). */
  onRunStep: (stepId: string) => void
  onTrustForSession: () => void
  onOpenTerminal: () => void
  /** Rôles (fiche 223) : menu `@`, jetons, envoi d'une fille par rôle. */
  roles?: ComposerRoles
}

/** Statuts qui ont leur propre texte d'invite (clé `composer.placeholder.<statut>`). */
const PLACEHOLDER_STATUSES = ['starting', 'busy', 'error', 'exited', 'needs-action'] as const
const hasPlaceholder = (status: string): status is (typeof PLACEHOLDER_STATUSES)[number] =>
  (PLACEHOLDER_STATUSES as readonly string[]).includes(status)

/**
 * Invite de la zone de saisie : selon l'agent, le dossier à choisir, le mode plan (fiche 098), une
 * conversation encore vide, ou répondre.
 */
function placeholderOf(view: ComposerView, fresh: boolean, profileLabel: string | undefined) {
  const { status } = view
  if (view.blocker?.kind === 'workspace') return i18next.t('composer.placeholder.needsFolder')
  const refused = refusedTurnText(view.blocker, 'placeholder')
  if (refused) return refused
  if (hasPlaceholder(status)) return i18next.t(`composer.placeholder.${status}`)
  if (view.planMode) {
    return profileLabel
      ? i18next.t('composer.plan.placeholder', { agent: profileLabel })
      : i18next.t('composer.plan.placeholderDefault')
  }
  if (fresh) return i18next.t('composer.placeholder.new')
  return profileLabel
    ? i18next.t('composer.placeholder.reply', { agent: profileLabel })
    : i18next.t('composer.placeholder.default')
}

const NO_USER_COMMANDS: UserCommand[] = []
const NO_AGENT_COMMANDS: AgentCommand[] = []

/**
 * Commandes « / » de l'agent, personnelles et de l'app (fiches 039, 045) ; l'agent gagne à nom
 * égal. Sa commande de compaction figure sous son vrai nom (`/compress`, fiche 126).
 */
function useCommands(snapshot: AgentSnapshot | null, userCommands: UserCommand[], agent: string) {
  const announced = snapshot?.commands ?? NO_AGENT_COMMANDS
  const compactCommand = snapshot?.compactCommand
  const agentCommands = useMemo(
    () => withCompactCommand(announced, compactCommand, agent),
    [announced, compactCommand, agent]
  )
  const ownCommands = useMemo(() => toAgentCommands(userCommands), [userCommands])
  const commands = useMemo(
    () => mergeCommands(agentCommands, ownCommands, compactCommand),
    [agentCommands, ownCommands, compactCommand]
  )
  return { agentCommands, ownCommands, commands }
}

/** Ce que le menu ⚙ de la barre lit de la conversation : règles, serveurs MCP, outils de Bobine. */
const sessionMenuProps = (props: Props) => ({
  onLoadRules: props.onLoadRules,
  onOpenRule: props.onOpenRule,
  onLoadMcp: props.onLoadMcp,
  onLoadAppTools: props.onLoadAppTools,
  onOpenMcpSettings: props.onOpenMcpSettings,
  onOpenUsage: props.onOpenUsage,
  onRestart: props.onRestart
})

/**
 * Ce qui arrive dans la saisie de l'extérieur : fichiers déposés, suggestion de départ (curseur à
 * la fin, sans envoyer), message repris de la fenêtre rapide, extrait du terminal (ajouté à la
 * suite du texte).
 */
function useInbox(
  inbox: Parameters<typeof useComposerInbox>[0],
  draftKey: Parameters<typeof useComposerInbox>[1],
  c: {
    text: string
    setText: (update: (current: string) => string) => void
    changeText: (value: string, nextCaret?: number) => void
    attachments: Pick<ReturnType<typeof useComposerDraft>['attachments'], 'addFiles' | 'restore'>
    focus: () => void
  }
): void {
  useComposerInbox(inbox, draftKey, {
    files: (files) => {
      void c.attachments.addFiles(files)
      c.focus()
    },
    text: (value) => {
      c.changeText(value, value.length)
      c.focus()
    },
    restore: (value, items) => {
      if (value) {
        const next = c.text.trim() ? `${c.text}\n${value}` : value
        c.changeText(next, next.length)
      }
      c.attachments.restore(items)
      c.focus()
    },
    insert: (value) => {
      c.setText((current) => (current.trim() ? `${current.trimEnd()}\n\n${value}` : value))
      c.focus()
    }
  })
}

export function Composer(props: Props) {
  const { t } = useTranslation()
  const { snapshot, settings, onSend, onCancel, draftKey } = props
  const view = composerView(snapshot, settings)
  const { status, busy, queued, locked, controls, modeControl, agentLabel, blocker } = view
  // Brouillon (fiches 026, 155) : texte et pièces jointes.
  const { text, setText, attachments } = useComposerDraft({
    draftKey,
    caps: snapshot?.promptCapabilities,
    agentName: view.agentName,
    onWarn: props.onWarn,
    checkExcluded: props.onCheckExcluded
  })
  const { textarea, placeCaret } = useTextareaLayout(text)
  const tips = useTipsContext()
  // Après un choix dans un menu de la barre, le focus revient ici (fiche 092).
  const focusInput = useCallback(() => textarea.current?.focus(), [textarea])
  const planHintId = useId()
  const hasContent = text.trim().length > 0 || attachments.items.length > 0
  const canSend = view.canSendNow && hasContent

  const userCommands = props.userCommands ?? NO_USER_COMMANDS
  const { agentCommands, ownCommands, commands } = useCommands(snapshot, userCommands, agentLabel)
  const commandMenu = useCommandMenu(text, commands)

  // Mentions `@` : fichiers du dossier proposés pendant la saisie, joints au message.
  const [caret, setCaret] = useState(0)
  const mentions = useMentions({
    text,
    caret,
    commandMenuOpen: commandMenu.open,
    blocked: status === 'needs-action' || status === 'read-only',
    onSearchFiles: props.onSearchFiles,
    ...(props.roles ? { roles: { list: props.roles.list, canCreate: !!props.roles.onCreate } } : {})
  })
  // Rôles (fiche 223) : jetons posés par le menu `@`, ligne « Partira à… ».
  const roleCompose = useRoleCompose({
    roles: props.roles,
    draftKey,
    menuOpen: mentions.open,
    onWarn: props.onWarn,
    focus: focusInput
  })
  const roleView = roleCompose.view(text)
  const roleFrame = useRoleFrame(roleView.targets)

  const changeText = (value: string, nextCaret?: number) => {
    setText(value)
    commandMenu.textChanged(value)
    mentions.textChanged()
    if (nextCaret !== undefined) {
      setCaret(nextCaret)
      placeCaret(nextCaret)
    }
  }
  const trackCaret = (event: SyntheticEvent<HTMLTextAreaElement>) =>
    setCaret(event.currentTarget.selectionStart)

  const pickEntry = (entry: MentionEntry) => {
    const { mention } = mentions
    if (!mention) return
    if (entry.kind !== 'context' && entry.kind !== 'file') {
      roleCompose.pick(entry, { mention, text, changeText, mentions })
      return textarea.current?.focus()
    }
    const inserted = entry.kind === 'context' ? entry.mention.name : entry.file.relative
    const next = insertMention(text, mention, inserted)
    changeText(next.text, next.caret)
    if (entry.kind === 'context') attachments.addContext(entry.mention.source)
    else attachments.addPath(entry.file.path)
    textarea.current?.focus()
  }

  const onPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    if (attachments.paste(event.clipboardData)) event.preventDefault()
  }
  /** Texte collé remis dans la saisie, au curseur (fiche 155). */
  const putBack = (value: string) => {
    const next = text.slice(0, caret) + value + text.slice(caret)
    changeText(next, caret + value.length)
    textarea.current?.focus()
  }
  // Fichiers déposés, suggestion de départ, message repris de la fenêtre rapide, extrait du terminal.
  useInbox(props.composerInbox, draftKey, {
    text,
    setText,
    changeText,
    attachments,
    focus: focusInput
  })
  const screenCapture = useScreenCapture({
    onCaptureScreen: props.onCaptureScreen,
    onOpenSettings: props.onOpenCaptureSettings,
    onCaptured: attachments.addCaptured,
    onWarn: props.onWarn,
    focus: () => textarea.current?.focus()
  })
  const pickFiles = async () => {
    await attachments.addPaths(await props.onPickFiles())
    textarea.current?.focus()
  }

  /** Choix d'une commande : complétée si elle attend un argument, sinon envoyée telle quelle. */
  const pickCommand = (command: AgentCommand, complete: boolean) => {
    if (complete || command.hint || (command.source !== 'app' && status !== 'ready')) {
      changeText(`/${command.name} `)
      textarea.current?.focus()
      return
    }
    if (command.source === 'app') props.onAppCommand(command.name as AppCommandName, '')
    else if (command.source === 'user' || command.source === 'project') {
      const own = userCommandOf(`/${command.name}`, userCommands, agentCommands)
      if (own) onSend(expandCommand(own.command.prompt, ''))
    } else onSend(`/${command.name}`)
    changeText('')
  }

  /** Message en attente remis dans la zone de saisie, à la suite du texte en cours. */
  const editQueued = async (id: string) => {
    const message = await props.onUnqueue(id)
    if (!message) return
    const next = text.trim() ? `${text}\n${message.text}` : message.text
    changeText(next, next.length)
    attachments.restore(message.attachments)
    textarea.current?.focus()
  }

  const submit = (event?: FormEvent) => {
    event?.preventDefault()
    // Message pour des rôles (fiche 223) : une fille par rôle, rien à la conversation ; un `@nom`
    // inconnu fait relire les rôles, puis l'envoi ordinaire s'il n'en nomme aucun.
    if (
      status !== 'read-only' &&
      roleCompose.submit(text, attachments.items.length, changeText, sendToConversation)
    ) {
      return
    }
    sendToConversation()
  }
  const sendToConversation = () => {
    // Commande personnelle ou du projet (fiche 045) : la consigne développée part à l'agent.
    const own = userCommandOf(text, userCommands, agentCommands)
    if (own) {
      if (!canSend) return
      onSend(expandCommand(own.command.prompt, own.args), attachments.toSend())
      changeText('')
      attachments.clear()
      return
    }
    const appCommand = appCommandOf(text, agentCommands, ownCommands)
    if (appCommand && status !== 'read-only' && status !== 'needs-action') {
      props.onAppCommand(appCommand.name, appCommand.args)
      changeText('', 0)
      return
    }
    if (!canSend) return
    onSend(text, attachments.toSend())
    // Message tapé par l'utilisateur : compté pour l'astuce « Planifier… » (fiche 191).
    tips?.noteSent?.(snapshot?.info.workspace, text)
    attachments.clear()
    changeText('', 0)
  }

  // Touches de la zone de saisie : `composer-keys.ts`.
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) =>
    composerKeyDown(event, {
      ...{ roleCompose, mentions, commandMenu, busy, text, queued, modeControl, status },
      ...{ pickEntry, pickCommand, submit, onCancel, editQueued },
      setControl: props.onSetControl
    })

  if (status === 'read-only') {
    return <ReadOnlyBanner detail={snapshot?.detail} onContinueInNew={props.onContinueInNew} />
  }

  // L'agent attend une action (connexion, dossier) : le panneau s'affiche au-dessus de la zone de
  // saisie, qui garde le choix de l'agent et du dossier pour pouvoir en changer.

  return (
    <div className="composer-dock">
      {blocker && snapshot && (
        <ComposerBlocker
          props={props}
          blocker={blocker}
          agentLabel={agentLabel}
          workspace={snapshot.info.workspace}
          modelControl={view.modelControl}
        />
      )}
      {commandMenu.open && (
        <CommandMenu
          items={commandMenu.matches}
          active={commandMenu.active}
          agentLabel={view.profileLabel}
          agentLabels={view.installedAgents}
          onHover={commandMenu.setActive}
          onPick={(command) => pickCommand(command, false)}
        />
      )}
      {mentions.open && (
        <FileMenu
          items={mentions.entries}
          active={mentions.active}
          workspaceName={snapshot?.info.workspace.split('/').filter(Boolean).at(-1) ?? ''}
          onHover={mentions.setActive}
          onPick={pickEntry}
          {...(props.roles ? { roles: roleCompose.menu(mentions.mention?.query) ?? {} } : {})}
        />
      )}
      {/* Astuces de la saisie (fiche 191), sur son bord haut. */}
      <ComposerTip
        busy={busy}
        hasText={text.trim().length > 0}
        usage={props.usage}
        onTryAside={() => {
          props.onAppCommand('btw', text.trim())
          changeText('')
        }}
      />
      <form
        className={`composer${roleFrame.className}`}
        style={roleFrame.style}
        onSubmit={submit}
        data-plan={view.planMode || undefined}
      >
        <QueuedMessages
          items={queued}
          busy={busy}
          onSendNow={props.onSendNow}
          onEdit={(id) => void editQueued(id)}
          onRemove={(id) => void props.onUnqueue(id)}
        />
        <ComposerAttachments
          attachments={attachments}
          agentLabel={agentLabel}
          onPutBack={putBack}
        />
        <RoleTokens roles={roleView.tokens} onRemove={roleView.remove} />
        {commandMenu.pendingHint && (
          <div className="command-pending" data-testid="command-hint">
            /{commandMenu.typed} <span>{commandMenu.pendingHint}</span>
          </div>
        )}
        <textarea
          ref={textarea}
          value={text}
          onChange={(e) => changeText(e.target.value, e.target.selectionStart)}
          onKeyDown={onKeyDown}
          onKeyUp={trackCaret}
          onClick={trackCaret}
          onPaste={onPaste}
          placeholder={placeholderOf(view, !!props.fresh, snapshot?.info.profileLabel)}
          aria-describedby={view.planMode ? planHintId : undefined}
          rows={1}
          disabled={!!blocker}
          autoFocus={props.autoFocus}
          data-testid="composer-input"
        />
        <ComposerBar
          settings={settings}
          profileId={snapshot?.info.profileId ?? settings?.profileId}
          pending={!snapshot}
          status={status}
          blocked={!!blocker}
          locked={locked}
          canSend={roleView.targets.length > 0 ? roleView.ready && !blocker : canSend}
          hasContent={hasContent}
          controls={controls}
          modeControl={modeControl}
          modelControl={view.modelControl}
          agentLabel={agentLabel}
          usage={props.usage}
          {...(props.usageActions ? { usageActions: props.usageActions } : {})}
          conversationId={props.draftKey}
          fresh={!!props.fresh}
          onPickFiles={() => void pickFiles()}
          onCaptureScreen={screenCapture.capture}
          onCancel={onCancel}
          onConfigure={props.onConfigure}
          onFocusInput={focusInput}
          onSetControl={props.onSetControl}
          {...sessionMenuProps(props)}
        />
      </form>
      {screenCapture.problem}
      {view.planMode && roleView.targets.length === 0 && (
        <PlanHint id={planHintId} nextMode={view.nextModeName} />
      )}
      <RoleDestinationFor
        targets={roleView.targets}
        empty={roleView.empty}
        sending={roleView.sending}
        roles={props.roles}
        profileId={snapshot?.info.profileId ?? settings?.profileId}
        agentLabel={agentLabel}
        fresh={!!props.fresh}
      />
      <ComposerContext
        settings={settings}
        locked={locked}
        branch={props.branch}
        gitBranch={props.gitBranch}
        onConfigure={props.onConfigure}
        onChooseWorkspace={props.onChooseWorkspace}
        onNewWorktree={props.onNewWorktree}
        {...(props.onRevealWorkspace ? { onRevealWorkspace: props.onRevealWorkspace } : {})}
        {...(props.onOpenTerminalHere ? { onOpenTerminalHere: props.onOpenTerminalHere } : {})}
        onFocusInput={focusInput}
      />
      {(status === 'error' || status === 'exited') && (
        <div className="composer-status error">
          <span>{status === 'exited' ? t('composer.exited') : t('composer.failedToStart')}</span>
          <button className="link-button" onClick={props.onRestart} data-testid="restart">
            {t('composer.restart')}
          </button>
        </div>
      )}
    </div>
  )
}

/** Ce que les touches de la saisie lisent et déclenchent (`composerKeyDown`). */
interface KeyContext {
  roleCompose: { removeLast: () => boolean }
  mentions: ReturnType<typeof useMentions>
  commandMenu: ReturnType<typeof useCommandMenu>
  busy: boolean
  text: string
  queued: readonly { id: string }[]
  modeControl: SessionControl | undefined
  status: string
  pickEntry: (entry: MentionEntry) => void
  pickCommand: (command: AgentCommand, complete: boolean) => void
  submit: (event?: FormEvent) => void
  onCancel: () => void
  editQueued: (id: string) => Promise<void>
  setControl: (id: string, value: ControlValue) => void
}

/** Touches de la zone de saisie (`composer-keys.ts`), sorti de `Composer` (taille bornée). */
function composerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>, c: KeyContext): unknown {
  const { mentions, commandMenu, queued, modeControl } = c
  // Retour arrière en tête de la saisie : le dernier jeton de rôle part d'un coup (fiche 223).
  const input = event.currentTarget
  if (event.key === 'Backspace' && input.selectionStart === 0 && input.selectionEnd === 0) {
    if (c.roleCompose.removeLast()) return event.preventDefault()
  }
  const action = composerKeyAction(
    { key: event.key, shift: event.shiftKey, composing: event.nativeEvent.isComposing },
    {
      mentions: { open: mentions.open, count: mentions.entries.length, active: mentions.active },
      commands: {
        open: commandMenu.open,
        count: commandMenu.matches.length,
        active: commandMenu.active
      },
      busy: c.busy,
      empty: !c.text,
      hasQueued: queued.length > 0,
      canCycleMode: !!modeControl && c.status === 'ready'
    }
  )
  if (action.kind === 'none') return
  event.preventDefault()
  switch (action.kind) {
    case 'mention-move':
      return mentions.setActive(action.index)
    case 'mention-pick': {
      const picked = mentions.entries[mentions.active]
      return picked && c.pickEntry(picked)
    }
    case 'mention-dismiss':
      return mentions.dismiss()
    case 'command-move':
      return commandMenu.setActive(action.index)
    case 'command-pick': {
      const picked = commandMenu.matches[commandMenu.active]
      return picked && c.pickCommand(picked, action.complete)
    }
    case 'command-dismiss':
      return commandMenu.dismiss()
    case 'submit':
      return c.submit(event)
    case 'cancel':
      return c.onCancel()
    case 'edit-last-queued': {
      const lastQueued = queued.at(-1)
      return lastQueued && void c.editQueued(lastQueued.id)
    }
    case 'next-mode': {
      const next = modeControl && nextOption(modeControl)
      return modeControl && next && c.setControl(modeControl.id, next)
    }
  }
}

/** Rappel du mode Plan sous la zone de saisie (fiche 098) : la couleur n'est pas le seul signal. */
/**
 * Carte d'action au-dessus de la zone de saisie ; le réglage du modèle sert à la carte d'un modèle
 * refusé faute de connexion (fiche 210).
 */
function ComposerBlocker({
  props,
  blocker,
  agentLabel,
  workspace,
  modelControl
}: {
  props: Props
  blocker: AgentBlocker
  agentLabel: string
  workspace: string
  modelControl: SessionControl | undefined
}) {
  return (
    <BlockerPanel
      blocker={blocker}
      agentLabel={agentLabel}
      workspace={workspace}
      onAuthenticate={props.onAuthenticate}
      onRetry={props.onRetry}
      onUseApiKey={props.onUseApiKey}
      onRunStep={props.onRunStep}
      onTrustForSession={props.onTrustForSession}
      onOpenTerminal={props.onOpenTerminal}
      onChooseWorkspace={props.onChooseWorkspace}
      {...(modelControl ? { modelControl } : {})}
      onSetControl={props.onSetControl}
    />
  )
}

function PlanHint(props: { id: string; nextMode: string | undefined }) {
  const { t } = useTranslation()
  return (
    <div className="composer-plan-hint" id={props.id} data-testid="plan-hint">
      {props.nextMode
        ? t('composer.plan.hint', { mode: props.nextMode })
        : t('composer.plan.hintNoNext')}
    </div>
  )
}

/** Conversation en lecture seule : repartir sur une nouvelle avec le même agent et dossier. */
function ReadOnlyBanner(props: { detail: string | undefined; onContinueInNew: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="composer-dock">
      <div className="readonly-banner" data-testid="read-only">
        <History size={18} className="pc-icon" />
        <div className="readonly-text">
          <div className="pc-title">{t('composer.readOnly.title')}</div>
          <div className="pc-sub">{props.detail}</div>
        </div>
        <button className="btn primary" onClick={props.onContinueInNew}>
          {t('composer.readOnly.continue')}
        </button>
      </div>
    </div>
  )
}
