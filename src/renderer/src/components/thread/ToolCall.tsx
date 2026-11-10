import type { ToolCallContent, ToolKind } from '../../../../shared/acp-sdk.mts'
import {
  Ban,
  Brain,
  Check,
  ChevronRight,
  FilePenLine,
  FilePlus,
  FileText,
  FolderInput,
  Globe,
  LoaderCircle,
  Search,
  ShieldAlert,
  ShieldX,
  Shuffle,
  SquareTerminal,
  Trash2,
  Wrench,
  Bookmark,
  X,
  ListTodo,
  type LucideIcon
} from 'lucide-react'
import { useContext, useRef, type ReactNode } from 'react'
import type { ToolImage } from '@shared/agent'
import type { ToolPermission, TranscriptItem } from '@shared/transcript'
import { LazyDetails } from '../common/LazyDetails'
import { DiffView } from './DiffView'
import { ZoomableImage } from './ImageZoom'
import { OpenInEditorButton } from './OpenInEditor'
import { PlanApproval } from './PlanApproval'
import { TerminalView } from './TerminalView'
import { CappedText } from './CappedText'
import { StalledNotice } from './StalledNotice'
import type { TerminalState } from '@shared/terminal-output'
import { permissionOptionLabel, rememberableTool } from '@shared/permissions'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { appToolsText, type AppToolGroup } from '@shared/app-tools'
import { prettyJsonOutput } from '@shared/json-output'
import {
  cleanCommand,
  cleanTitle,
  createsFile,
  toolLabel,
  type ToolLabel
} from '@shared/tool-label'
import {
  announcedTitle,
  commandOfTool,
  HINT_CHARS,
  commandFolderOf,
  sameFolder,
  visibleText
} from '@shared/command-view'
import { safeCut } from '@shared/display-cap'
import { useArmedCard } from './useArmedCard'
import { CommandBlock } from './CommandBlock'
import { AgentAlwaysNote, AlwaysScopeNote, PermissionRisks, scopeCovers } from './PermissionRisks'
import { TodosView, ToolArgsView } from './PermissionExtras'
import { PermissionFooter } from './PermissionFooter'
import { GlobalRuleAnswer } from './GlobalRuleSection'
import { AgentCardContext } from './agent-card-context'
import { FileLabelParts } from './FileLabelParts'
import { useDisplayText } from '../../presentation'
import { WorkspaceContext } from './workspace-context'

type ToolItem = Extract<TranscriptItem, { kind: 'tool' }>

export { WorkspaceContext }

/** Infobulle d'un libellé lisible : la cible en entier, puis le titre de l'agent (s'ils disent plus). */
export function labelHint(label: ToolLabel, title: string): string | undefined {
  const parts = [label.detail, title].filter(
    (part, i, all): part is string => !!part && part !== label.text && all.indexOf(part) === i
  )
  return parts.length ? parts.join('\n') : undefined
}

export type RespondPermission = (requestId: string, optionId: string | null) => void

/** Libellé d'une option d'autorisation (genre ACP traduit, sinon nom de l'agent : recette 0.11). */
function optionText(
  t: TFunction,
  option: { kind: string; name: string } | undefined,
  siblings?: readonly { kind: string }[]
): string {
  if (!option) return ''
  const label = permissionOptionLabel(option, siblings)
  return 'key' in label ? t(label.key) : label.text
}

function PermissionOptionText(props: {
  option: { kind: string; name: string }
  siblings?: readonly { kind: string }[]
}) {
  const { t } = useTranslation()
  return <>{optionText(t, props.option, props.siblings)}</>
}

/** Icône d'une carte qui a appelé un outil de l'app, quand son groupe en a une (mémoire). */
const APP_GROUP_ICONS: Partial<Record<AppToolGroup, LucideIcon>> = { memory: Bookmark }

const KIND_ICONS: Record<ToolKind, LucideIcon> = {
  read: FileText,
  edit: FilePenLine,
  delete: Trash2,
  move: FolderInput,
  search: Search,
  execute: SquareTerminal,
  think: Brain,
  fetch: Globe,
  switch_mode: Shuffle,
  other: Wrench
}

/** Icône de la ligne d'un outil : de l'app, liste de tâches (fiche 214), création de fichier (203), genre. */
function ToolIcon({ item }: { item: ToolItem }) {
  const Icon =
    (item.appTool && APP_GROUP_ICONS[item.appTool.group]) ??
    (item.todos ? ListTodo : createsFile(item) ? FilePlus : KIND_ICONS[item.toolKind ?? 'other'])
  return <Icon size={15} className="tool-icon" />
}

function ToolState({ item, waiting }: { item: ToolItem; waiting: boolean }) {
  const { t } = useTranslation()
  if (waiting) {
    return (
      <span className="tool-state waiting">
        <ShieldAlert size={14} /> {t('toolCall.state.waiting')}
      </span>
    )
  }
  switch (item.status) {
    case 'pending':
    case 'in_progress':
      return (
        <span className="tool-state" aria-label={t('toolCall.state.running')}>
          <LoaderCircle size={14} className="spin" />
        </span>
      )
    case 'completed':
      return (
        <span className="tool-state completed" aria-label={t('toolCall.state.completed')}>
          <Check size={15} />
        </span>
      )
    case 'failed':
      return (
        <span className="tool-state failed">
          <X size={14} /> {t('toolCall.state.failed')}
        </span>
      )
    case 'refused':
      return (
        <span className="tool-state refused">
          <ShieldX size={14} /> {t('toolCall.state.refused')}
        </span>
      )
    case 'cancelled':
      return (
        <span className="tool-state cancelled">
          <Ban size={13} /> {t('toolCall.state.cancelled')}
        </span>
      )
  }
}

export function ToolCall({
  item,
  terminal,
  onRespond,
  hideImages = false
}: {
  item: ToolItem
  /** Sortie de la commande, si l'agent la transmet par l'extension de terminal. */
  terminal?: TerminalState
  onRespond: RespondPermission
  /** Dans un groupe d'outils (fiche 047) : les captures sont montrées par le groupe. */
  hideImages?: boolean
}) {
  const workspace = useContext(WorkspaceContext)
  // Mode présentation (fiche 159) : le dossier personnel en `~` jusque dans les infobulles.
  const show = useDisplayText()
  const { t } = useTranslation()
  // Sortie du mode plan : le plan à valider remplace l'autorisation générique.
  if (item.toolKind === 'switch_mode' && item.permission) {
    return (
      <div data-testid="tool" data-status={item.status}>
        <PlanApproval item={item} onRespond={onRespond} />
      </div>
    )
  }
  const waiting = item.permission?.state === 'pending'
  // Outil de l'app : ce qu'il fait en clair (fiche 047), le titre de l'agent en infobulle ;
  // plusieurs outils appelés par du code (fiche 079) : leurs libellés à la suite. Outil de
  // l'agent : ce qu'il a fait et sur quoi (fiche 107), la cible entière et le titre en infobulle.
  const appTitle = appToolsText(item)
  const label = !appTitle ? toolLabel(item, workspace) : undefined
  // Commande que lance l'outil (0.11, M1) : entière en infobulle de la ligne, toujours.
  const command = !appTitle ? commandOfTool(item) : undefined
  const commandHint = command
    ? commandTip(show(command.text), t('toolCall.command.hintMore'))
    : undefined
  const title = appTitle ? (
    <span title={show(item.title)}>{show(appTitle)}</span>
  ) : label ? (
    <span
      title={commandHint ?? labelHint(label, item.title)?.replace(/.+/s, show)}
      className={label.file && !label.code ? 'tool-file-label' : undefined}
      data-testid="tool-label"
    >
      {label.file && !label.code ? (
        <FileLabelParts file={label.file} />
      ) : label.code ? (
        // Commande : la première ligne de la commande entière (`\r` seul compris, rendu ␍),
        // nettoyée comme le libellé (fiche 125) ; sinon le libellé.
        <code>{show(firstLine(command ? cleanCommand(command.text, workspace) : label.text))}</code>
      ) : (
        show(label.text)
      )}
    </span>
  ) : (
    // Titre brut de l'agent, chemins du dossier rendus relatifs (fiche 125) ; entier en infobulle.
    <span
      title={
        commandHint ??
        (cleanTitle(item.title, workspace) !== item.title ? show(item.title) : undefined)
      }
    >
      {item.toolKind === 'execute' ? (
        <code>{show(firstLine(cleanTitle(item.title, workspace)))}</code>
      ) : (
        show(cleanTitle(item.title, workspace))
      )}
    </span>
  )
  const row = (
    <>
      <ToolIcon item={item} />
      <span className="tool-title">{title}</span>
      <ToolState item={item} waiting={waiting} />
    </>
  )
  const hasDetails = item.content.length > 0 || item.locations.length > 0 || !!terminal || !!command

  return (
    // `data-kind` : genre ACP de l'outil, lu par le pilote de Bobine (fiche 206).
    <div
      data-testid="tool"
      data-status={waiting ? 'waiting' : item.status}
      data-kind={item.toolKind}
    >
      {hasDetails && !waiting ? (
        <LazyDetails
          className="tool"
          summary={
            <summary className="tool-row">
              {row}
              <ChevronRight size={14} className="chevron tool-icon" />
            </summary>
          }
        >
          <div className="tool-details">
            {command && (
              <CommandBlock
                command={command}
                workspace={workspace}
                locations={item.locations}
                announced={announcedTitle(item)}
              />
            )}
            <ToolDetails
              item={item}
              terminal={terminal}
              folder={command && commandFolder(item, command.cwd, workspace)}
            />
          </div>
        </LazyDetails>
      ) : (
        <div className="tool tool-row">{row}</div>
      )}
      {terminal && (item.status === 'in_progress' || item.status === 'pending') && (
        <StalledNotice toolCallId={item.toolCallId} terminal={terminal} />
      )}
      {!hideImages && item.images && item.images.length > 0 && <ToolImages images={item.images} />}
      {item.permission && (
        <PermissionView item={item} permission={item.permission} onRespond={onRespond} />
      )}
    </div>
  )
}

/** Ligne repliée : la première ligne d'une commande, « … » s'il y en a d'autres (0.11, M1). */
function firstLine(text: string): string {
  const end = text.search(/\r?\n/)
  // Caractères invisibles rendus visibles, `\r` seul compris (␍).
  return visibleText(end === -1 ? text : `${text.slice(0, end)} …`)
}

/** Infobulle d'une commande : entière, invisibles rendus visibles, au plus 4 Ko puis `more`. */
function commandTip(text: string, more: string): string {
  const shown = visibleText(text)
  return shown.length > HINT_CHARS ? `${shown.slice(0, safeCut(shown, HINT_CHARS))}${more}` : shown
}

/** Captures renvoyées par un outil de l'app : visibles sans déplier la carte. */
export function ToolImages({ images }: { images: ToolImage[] }) {
  return (
    <div className="tool-images" data-testid="tool-images">
      {images.map((image, i) => (
        <ToolImageView key={i} image={image} />
      ))}
    </div>
  )
}

/** Capture d'un outil : en grand au clic, glissable vers le Finder (fiche 156). */
function ToolImageView({ image }: { image: ToolImage }) {
  const { t } = useTranslation()
  return <ZoomableImage image={image} className="tool-image" alt={t('toolCall.image.alt')} />
}

/**
 * Dossier où tourne une commande, absolu et sûr (`commandFolderOf`) : le sien, résolu s'il est
 * relatif et confirmé par un emplacement, sinon celui de la conversation ; rien au moindre doute.
 */
const commandFolder = (item: ToolItem, cwd: string | undefined, workspace: string | undefined) =>
  commandFolderOf(cwd, workspace, item.locations)?.resolved

function ToolDetails({
  item,
  terminal,
  folder
}: {
  item: ToolItem
  terminal?: TerminalState | undefined
  /**
   * Dossier de la commande, déjà dit dans sa barre (fiche 203) : un emplacement d'un outil
   * `execute` qui le désigne (OpenCode l'envoie) n'est pas répété ; un autre reste affiché.
   */
  folder?: string | undefined
}) {
  const locations =
    item.toolKind === 'execute' && folder
      ? item.locations.filter((loc) => loc.line != null || !sameFolder(loc.path, folder))
      : item.locations
  // Un diff affiche déjà le chemin du fichier : inutile de le répéter.
  const showLocations = locations.length > 0 && !item.content.some((c) => c.type === 'diff')
  const show = useDisplayText()
  return (
    <>
      {showLocations && (
        <div className="tool-locations">
          {locations.map((loc) => (
            <span key={`${loc.path}:${loc.line ?? ''}`} className="tool-location">
              <code>
                {show(loc.path)}
                {loc.line != null ? `:${loc.line}` : ''}
              </code>
              <OpenInEditorButton path={loc.path} line={loc.line} />
            </span>
          ))}
        </div>
      )}
      {item.content.map((content, i) => (
        <ToolContent key={i} content={content} execute={item.toolKind === 'execute'} />
      ))}
      {terminal && <TerminalView terminal={terminal} />}
    </>
  )
}

/** Genres d'outils qui ont leur propre question (clé `toolCall.permission.question.<genre>`). */
const QUESTION_KINDS = ['edit', 'delete', 'move', 'execute', 'fetch'] as const
const hasQuestion = (kind: ToolKind): kind is (typeof QUESTION_KINDS)[number] =>
  (QUESTION_KINDS as readonly ToolKind[]).includes(kind)

/**
 * Réponse donnée à une demande d'autorisation, avec le même libellé que le bouton choisi (portée
 * déclarée par le profil, fiche 214) et la règle écrite pour tous les projets (fiche 215).
 */
function PermissionAnswer({
  state,
  requestId,
  scoped
}: {
  state: { optionId: string; name: string; kind: string }
  requestId: string
  scoped: boolean
}) {
  const { t } = useTranslation()
  const allowed = state.kind.startsWith('allow')
  return (
    <div
      className={`permission-answer ${allowed ? 'allowed' : 'rejected'}`}
      data-testid="permission-answer"
    >
      {allowed ? <Check size={14} /> : <X size={14} />}{' '}
      {state.kind === 'allow_always' && scoped ? (
        t('toolCall.permission.alwaysConversation')
      ) : (
        <PermissionOptionText option={state} />
      )}
      <GlobalRuleAnswer requestId={requestId} />
    </div>
  )
}

/** Autorisation d'un outil ; `body` : son détail, à la place de celui de l'outil (sous-agent). */
export function PermissionView({
  item,
  permission,
  onRespond,
  body
}: {
  item: ToolItem
  permission: ToolPermission
  onRespond: RespondPermission
  body?: ReactNode
}) {
  const { t } = useTranslation()
  const workspace = useContext(WorkspaceContext)
  const agent = useContext(AgentCardContext)
  const card = useRef<HTMLDivElement>(null)
  const { armed, accepts } = useArmedCard(card)
  const { state } = permission
  if (state === 'cancelled') {
    return (
      <div className="permission-answer" data-testid="permission-answer">
        <Ban size={13} /> {t('toolCall.permission.cancelled')}
      </div>
    )
  }
  if (state !== 'pending') {
    return (
      <PermissionAnswer
        state={state}
        requestId={permission.requestId}
        scoped={!!agent?.alwaysScope}
      />
    )
  }
  const command = appToolsText(item) ? undefined : commandOfTool(item)
  const risks = permission.risks ?? []
  // Carte à risque (fiche 211) : « Toujours autoriser » n'est pas offert (l'option reste dans le
  // protocole) ; une fois, ou refuser.
  const shown = permission.options.filter((o) => risks.length === 0 || o.kind !== 'allow_always')
  const always = shown.find((o) => o.kind === 'allow_always')
  const remembered = always && rememberableTool({ title: item.title, kind: item.toolKind })
  // « Toujours » retenu par l'agent, portée déclarée par son profil (fiche 214) : le bouton la dit.
  const scope = !remembered && always ? agent?.alwaysScope : undefined
  const agentName = agent?.name ?? t('toolCall.permission.theAgent')
  return (
    <div
      className="permission-card"
      ref={card}
      data-testid="permission"
      data-armed={armed ? '' : undefined}
    >
      <div className="pc-head">
        <ShieldAlert size={18} className="pc-icon" />
        <div>
          <div className="pc-title">
            {item.subagent
              ? t('toolCall.permission.question.subagent')
              : item.todos
                ? t('toolCall.permission.question.todos')
                : createsFile(item)
                  ? t('toolCall.permission.question.create')
                  : t(
                      hasQuestion(item.toolKind ?? 'other')
                        ? `toolCall.permission.question.${item.toolKind as (typeof QUESTION_KINDS)[number]}`
                        : 'toolCall.permission.question.other'
                    )}
          </div>
          <div className="pc-sub">{t('toolCall.permission.waiting')}</div>
        </div>
      </div>
      {body ? (
        <div className="pc-body">{body}</div>
      ) : (
        (command ||
          item.content.length > 0 ||
          item.locations.length > 0 ||
          item.todos ||
          item.args) && (
          <div className="pc-body">
            {/* Tâches et arguments, tels que l'agent les envoie (fiche 214). */}
            {item.todos && <TodosView todos={item.todos} />}
            {!item.todos && item.args && <ToolArgsView args={item.args} />}
            {/* La commande entière, à lire avant d'accepter (0.11, M1). */}
            {command && (
              <CommandBlock
                command={command}
                workspace={workspace}
                locations={item.locations}
                announced={announcedTitle(item)}
              />
            )}
            {(item.content.length > 0 || item.locations.length > 0) && (
              <ToolDetails
                item={item}
                folder={command && commandFolder(item, command.cwd, workspace)}
              />
            )}
          </div>
        )
      )}
      <PermissionRisks risks={risks} />
      <div className="pc-actions">
        {shown.map((option) => (
          <button
            key={option.optionId}
            className={`btn ${
              option.kind === 'allow_once'
                ? 'primary'
                : option.kind.startsWith('reject')
                  ? 'ghost'
                  : ''
            }`}
            data-kind={option.kind}
            title={option.name}
            onClick={(event) => {
              // Clic réel trop tôt après l'apparition ou un défilement : pas une décision.
              if (accepts(event)) onRespond(permission.requestId, option.optionId)
            }}
          >
            {scope && option.kind === 'allow_always' ? (
              t('toolCall.permission.alwaysConversation')
            ) : (
              <PermissionOptionText option={option} siblings={permission.options} />
            )}
          </button>
        ))}
      </div>
      {remembered ? (
        <div className="pc-note" data-testid="permission-remember-note">
          {t('toolCall.permission.rememberNote', {
            // Retenu par l'app (fiche 042) : elle dit sa portée exacte, l'outil et l'agent.
            name: item.todos
              ? t('toolCall.permission.rememberTodos')
              : `« ${visibleText(remembered)} »`,
            agent: agentName
          })}
        </div>
      ) : (
        always &&
        (scope && scopeCovers(scope, item.toolKind) ? (
          <AlwaysScopeNote scope={scope} kind={item.toolKind} agent={agentName} />
        ) : (
          <AgentAlwaysNote />
        ))
      )}
      {/* Carte à risque : « Toujours » manque, la carte dit pourquoi (fiche 214). */}
      {risks.length > 0 && permission.options.some((o) => o.kind === 'allow_always') && (
        <div className="pc-note" data-testid="permission-risk-no-always">
          {t('toolCall.permission.riskNoAlways')}
        </div>
      )}
      {/* Pied de carte : règles pour tous les projets de l'agent (fiche 215), absentes sinon. */}
      <PermissionFooter
        item={item}
        permission={permission}
        command={command?.text}
        risky={risks.length > 0}
        accepts={accepts}
        onRespond={onRespond}
      />
    </div>
  )
}

function ToolContent({ content, execute }: { content: ToolCallContent; execute: boolean }) {
  switch (content.type) {
    case 'content':
      // Sortie de commande en texte (Bob, OpenCode) : même affichage qu'un terminal.
      if (content.content.type === 'text' && execute) {
        // Sortie en JSON (D6) : indentée, de vrais retours à la ligne dans les chaînes (fiche 128).
        const json = prettyJsonOutput(content.content.text)
        if (json) return <CappedText text={json} className="tool-output" testId="tool-json" />
        return <TerminalView terminal={{ output: content.content.text }} />
      }
      if (content.content.type === 'image') {
        return <ToolImageView image={content.content} />
      }
      return content.content.type === 'text' ? (
        <CappedText text={content.content.text} className="tool-output" />
      ) : (
        <p className="tool-output muted">[{content.content.type}]</p>
      )
    case 'diff':
      return <DiffView path={content.path} oldText={content.oldText} newText={content.newText} />
    case 'terminal':
      // Affiché une seule fois, depuis l'état du terminal (voir `terminal`).
      return null
  }
}
