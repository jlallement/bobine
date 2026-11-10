/**
 * Menus de la zone de saisie : dossier, réglages de session (l'agent : `composer/AgentMenu.tsx`).
 * Logique d'accessibilité fournie par Radix (ADR-0005), style par styles.css.
 */
import * as Dropdown from '@radix-ui/react-dropdown-menu'
import * as Tooltip from '@radix-ui/react-tooltip'
import {
  Check,
  ChevronRight,
  ClipboardList,
  FileText,
  Copy,
  Folder,
  FolderOpen,
  Globe,
  FolderPlus,
  GitBranch,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  SquareTerminal,
  Wrench
} from 'lucide-react'
import { createContext, useContext, useRef, useState, type ReactNode } from 'react'
import { isPlanMode } from '@shared/plan-doc'
import type { RuleFileView } from '@shared/rules'
import { APP_TOOLS_SERVER_NAME, type ConversationAppTools, type McpAgentView } from '@shared/mcp'
import { formatTokens } from '@shared/usage'
import { mcpKey, mcpStatus, testMcpServers, useMcpStatuses } from '../../mcp-status'
import { BOBINE_TAB, McpDot } from '../settings/McpSettings'
import type {
  AgentConfigureRequest,
  AgentSettingsView,
  ControlValue,
  SessionControl
} from '@shared/agent'
import { useTranslation } from 'react-i18next'
import { useDisplayPath } from '../../presentation'
import { platformFeatures } from '../../platform-features'
import i18next from 'i18next'
import { SHORTCUTS, type MenuCommand } from '@shared/shortcuts'

/** Dernier segment d'un chemin, pour un libellé court. */
export const basename = (path: string) => path.split('/').filter(Boolean).at(-1) ?? path

/** Dernier appui de la souris (ou du doigt), pour reconnaître le focus qu'un menu rend en se fermant. */
let lastPointerDown = 0
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', () => (lastPointerDown = Date.now()), true)
}

/**
 * Focus rendu à un bouton juste après un clic (un menu qui se ferme rend le focus à son bouton),
 * sans clavier ni souris dessus : pas d'infobulle. Sans prise en charge de `:focus-visible` (jsdom
 * des essais), rien n'est filtré.
 */
function focusWithoutIntent(element: HTMLElement): boolean {
  if (document.activeElement !== element || Date.now() - lastPointerDown > 800) return false
  if (typeof CSS === 'undefined' || !CSS.supports?.('selector(:focus-visible)')) return false
  return !element.matches(':focus-visible') && !element.matches(':hover')
}

/**
 * Info-bulle sur un élément interactif. Elle ne prend jamais le pointeur (styles.css) : ouverte
 * par-dessus la zone de saisie, elle y avalait le clic suivant (fiche 092).
 */
export function Tip({
  label,
  side,
  className,
  command,
  children
}: {
  label: string
  /** Commande du menu : son raccourci suit le nom, plus discret (fiche 185, P9). */
  command?: MenuCommand
  /** Côté de l'infobulle (au-dessus par défaut) ; à droite pour un élément de menu. */
  side?: 'top' | 'right' | 'bottom' | 'left'
  /** Style spécifique du contenu, sans changer le déclencheur ni les autres infobulles. */
  className?: string
  children: ReactNode
}) {
  const keys = command && SHORTCUTS.find((shortcut) => shortcut.command === command)?.keys
  const trigger = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  // Une infobulle suit le survol ou le focus au clavier, pas un focus rendu par un menu qui se
  // ferme : elle recouvrait ce qu'on venait d'ouvrir (fiche 185, F7).
  const onOpenChange = (next: boolean) => {
    const element = trigger.current
    if (next && element && focusWithoutIntent(element)) return
    setOpen(next)
  }
  return (
    <Tooltip.Root
      delayDuration={400}
      disableHoverableContent
      open={open}
      onOpenChange={onOpenChange}
    >
      <Tooltip.Trigger asChild ref={trigger}>
        {children}
      </Tooltip.Trigger>
      {/* Sans texte, pas d'infobulle : l'élément garde la même enveloppe (un menu ouvert ne se
          referme pas quand son infobulle apparaît, fiche 097). */}
      {label && (
        <Tooltip.Portal>
          <Tooltip.Content
            className={className ? `tooltip ${className}` : 'tooltip'}
            sideOffset={6}
            {...(side ? { side } : {})}
          >
            {label}
            {keys && <span className="tooltip-keys">{keys}</span>}
          </Tooltip.Content>
        </Tooltip.Portal>
      )}
    </Tooltip.Root>
  )
}

/** Rend le focus à la zone de saisie : fourni à ses menus par la barre et la ligne du dossier. */
export const ComposerFocus = createContext<(() => void) | undefined>(undefined)

/**
 * Focus après la fermeture d'un menu ou d'une liste de la zone de saisie (fiche 092). Après un
 * choix, il revient à la saisie : Radix le rendrait à la puce, dont l'infobulle s'ouvrirait. Échap
 * et un clic ailleurs gardent le comportement de Radix (focus rendu à la puce au clavier, laissé là
 * où l'on a cliqué), comme une fenêtre ouverte par l'élément choisi (réglages…), qui le garde.
 */
export function useReturnFocus() {
  const focusComposer = useContext(ComposerFocus)
  const dismissed = useRef(false)
  return {
    onEscapeKeyDown: () => {
      dismissed.current = true
    },
    onInteractOutside: () => {
      dismissed.current = true
    },
    onCloseAutoFocus: (event: Event) => {
      const chosen = !dismissed.current
      dismissed.current = false
      if (!chosen || !focusComposer) return
      const active = document.activeElement
      if (active && active !== document.body && !active.closest('.composer-dock')) return
      event.preventDefault()
      focusComposer()
    }
  }
}

export function MenuContent({
  children,
  align = 'start',
  testId
}: {
  children: ReactNode
  align?: 'start' | 'end'
  testId?: string
}) {
  const returnFocus = useReturnFocus()
  return (
    <Dropdown.Portal>
      <Dropdown.Content
        className="menu"
        side="top"
        align={align}
        sideOffset={8}
        collisionPadding={12}
        data-testid={testId}
        {...returnFocus}
      >
        {children}
      </Dropdown.Content>
    </Dropdown.Portal>
  )
}

export function ItemText({ title, description }: { title: string; description?: string }) {
  return (
    <span className="menu-text">
      <div className="menu-title">{title}</div>
      {description && <div className="menu-desc">{description}</div>}
    </span>
  )
}

/* ----- Dossier de travail ----- */

export function WorkspaceMenu({
  settings,
  disabled,
  branch,
  onConfigure,
  onChooseWorkspace,
  onNewWorktree,
  onReveal,
  onOpenTerminal
}: {
  settings: AgentSettingsView
  disabled: boolean
  /** Branche du worktree de la conversation (fiche 036) : montrée à la place du dossier. */
  branch?: string
  onConfigure: (request: AgentConfigureRequest) => void
  onChooseWorkspace: () => void
  /** Nouvelle conversation dans un worktree git (si le dossier est dans un dépôt). */
  onNewWorktree?: () => void
  /** Montre le dossier dans le gestionnaire de fichiers (fiche 158). */
  onReveal?: () => void
  /** Ouvre le panneau terminal de Bobine dans ce dossier (fiche 158). */
  onOpenTerminal?: () => void
}) {
  const { t } = useTranslation()
  const displayPath = useDisplayPath()
  const finder = platformFeatures().finder
  // Pas encore de dossier (fiche 093) : la puce invite à en choisir un, la liste n'en montre pas.
  const workspaces =
    !settings.workspace || settings.recentWorkspaces.includes(settings.workspace)
      ? settings.recentWorkspaces
      : [settings.workspace, ...settings.recentWorkspaces]
  return (
    <Dropdown.Root modal={false}>
      <Tip
        label={
          branch
            ? t('workspaceMenu.worktreeTip', { branch, workspace: displayPath(settings.workspace) })
            : displayPath(settings.workspace) || t('workspaceMenu.none')
        }
      >
        <Dropdown.Trigger className="chip" disabled={disabled} data-testid="workspace-menu">
          {branch ? <GitBranch size={15} /> : <Folder size={15} />}
          <span className="chip-label">
            {branch ?? (basename(settings.workspace) || t('workspaceMenu.none'))}
          </span>
        </Dropdown.Trigger>
      </Tip>
      <MenuContent testId="workspace-menu-content">
        <div className="menu-label">{t('workspaceMenu.title')}</div>
        {workspaces.map((workspace) => (
          <Dropdown.Item
            key={workspace}
            className="menu-item"
            onSelect={() => {
              if (workspace !== settings.workspace) onConfigure({ workspace })
            }}
            data-testid="workspace-option"
          >
            <Folder size={16} className="menu-icon" />
            <ItemText title={basename(workspace)} description={displayPath(workspace)} />
            {workspace === settings.workspace && <Check size={16} className="menu-check" />}
          </Dropdown.Item>
        ))}
        <Dropdown.Separator className="menu-separator" />
        <Dropdown.Item
          className="menu-item"
          onSelect={onChooseWorkspace}
          data-testid="workspace-choose"
        >
          <FolderPlus size={16} className="menu-icon" />
          <ItemText title={t('workspaceMenu.choose')} />
        </Dropdown.Item>
        {settings.inGitRepo && onNewWorktree && (
          <Dropdown.Item
            className="menu-item"
            onSelect={onNewWorktree}
            data-testid="workspace-worktree"
          >
            <GitBranch size={16} className="menu-icon" />
            <ItemText
              title={t('workspaceMenu.worktree')}
              description={t('workspaceMenu.worktreeHint')}
            />
          </Dropdown.Item>
        )}
        {settings.workspace && (
          <>
            <Dropdown.Separator className="menu-separator" />
            {onReveal && (
              <Dropdown.Item
                className="menu-item"
                onSelect={onReveal}
                data-testid="workspace-reveal"
              >
                <FolderOpen size={16} className="menu-icon" />
                <ItemText
                  title={t(finder ? 'workspaceMenu.revealFinder' : 'workspaceMenu.revealFiles')}
                />
              </Dropdown.Item>
            )}
            <Dropdown.Item
              className="menu-item"
              onSelect={() => void navigator.clipboard.writeText(settings.workspace)}
              data-testid="workspace-copy-path"
            >
              <Copy size={16} className="menu-icon" />
              <ItemText title={t('workspaceMenu.copyPath')} />
            </Dropdown.Item>
            {onOpenTerminal && (
              <Dropdown.Item
                className="menu-item"
                onSelect={onOpenTerminal}
                data-testid="workspace-terminal"
              >
                <SquareTerminal size={16} className="menu-icon" />
                <ItemText title={t('workspaceMenu.openTerminal')} />
              </Dropdown.Item>
            )}
          </>
        )}
      </MenuContent>
    </Dropdown.Root>
  )
}

/** Branche git du dossier de la conversation (fiche 049). */
export interface GitBranchInfo {
  name: string
  /** Fichiers modifiés, ajoutés, supprimés ou non suivis. */
  dirty: number
  ahead: number
  behind: number
  /** Ouvre l'état du dépôt (onglet « Modifications », vue git). */
  onOpen: () => void
}

/** Puce de la branche, à côté du dossier : un point quand il y a des modifications non commitées. */
export function BranchChip({ branch }: { branch: GitBranchInfo }) {
  const { t } = useTranslation()
  const details = [
    branch.dirty > 0 && t('branchChip.dirty', { count: branch.dirty }),
    branch.ahead > 0 && t('branchChip.ahead', { count: branch.ahead }),
    branch.behind > 0 && t('branchChip.behind', { count: branch.behind })
  ].filter(Boolean)
  return (
    <Tip label={[t('branchChip.branch', { name: branch.name }), ...details].join(' · ')}>
      <button
        className="chip"
        onClick={branch.onOpen}
        data-testid="git-branch"
        data-dirty={branch.dirty > 0 ? 'true' : undefined}
      >
        <GitBranch size={15} />
        <span className="chip-label git-branch-name">{branch.name}</span>
        {branch.dirty > 0 && <span className="git-dot" aria-label={t('branchChip.dirtyDot')} />}
      </button>
    </Tip>
  )
}

/* ----- Réglages de session ----- */

export const valueLabel = (control: SessionControl) =>
  control.type === 'boolean'
    ? control.currentValue
      ? i18next.t('sessionSettings.on')
      : i18next.t('sessionSettings.off')
    : (control.options.find((o) => o.value === control.currentValue)?.name ??
      String(control.currentValue))

/** Options d'un réglage « liste », avec ses groupes éventuels. */
function SelectOptions({
  control,
  onChange
}: {
  control: SessionControl
  onChange: (value: ControlValue) => void
}) {
  const groups = [...new Set(control.options.map((o) => o.group))]
  return (
    <Dropdown.RadioGroup
      value={String(control.currentValue)}
      onValueChange={(value) => onChange(value)}
    >
      {groups.map((group) => (
        <div key={group ?? ''}>
          {group && <div className="menu-label">{group}</div>}
          {control.options
            .filter((o) => o.group === group)
            .map((option) => (
              <Dropdown.RadioItem
                key={option.value}
                value={option.value}
                className="menu-item"
                data-testid={`control-${control.id}-${option.value}`}
              >
                <ItemText title={option.name} description={option.description} />
                <Dropdown.ItemIndicator>
                  <Check size={16} className="menu-check" />
                </Dropdown.ItemIndicator>
              </Dropdown.RadioItem>
            ))}
        </div>
      ))}
    </Dropdown.RadioGroup>
  )
}

/** Puce dédiée au mode d'autonomie (réglage de catégorie `mode`), comme le sélecteur de Claude. */
export function ModeChip({
  control,
  disabled,
  onSetControl,
  className
}: {
  control: SessionControl
  disabled: boolean
  onSetControl: (id: string, value: ControlValue) => void
  /** Classe ajoutée à la puce (style discret de l'onglet « Session », fiche 166). */
  className?: string
}) {
  const { t } = useTranslation()
  const value = valueLabel(control)
  // Replié, il ne garde que son icône (fiche 092) : le mode plan a la sienne.
  const plan = isPlanMode({ id: String(control.currentValue), name: value })
  return (
    <Dropdown.Root modal={false}>
      <Tip label={t('sessionSettings.modeTip', { name: control.name, value })}>
        <Dropdown.Trigger
          className={`chip mode-chip${className ? ` ${className}` : ''}`}
          disabled={disabled}
          data-testid="mode-chip"
          data-plan={plan ? 'true' : undefined}
        >
          {plan ? <ClipboardList size={15} /> : <ShieldCheck size={15} />}
          <span className="chip-label">{value}</span>
        </Dropdown.Trigger>
      </Tip>
      <MenuContent testId="mode-menu-content">
        <div className="menu-label">{control.name}</div>
        <SelectOptions control={control} onChange={(v) => onSetControl(control.id, v)} />
      </MenuContent>
    </Dropdown.Root>
  )
}

/** Portée d'une règle, en clair. */
function ruleScope(rule: RuleFileView): string {
  const scope =
    rule.scope === 'project' ? i18next.t('rules.scope.project') : i18next.t('rules.scope.personal')
  return rule.mode ? i18next.t('rules.scopeWithMode', { scope, mode: rule.mode }) : scope
}

export function SessionSettingsMenu({
  controls,
  agentLabel,
  disabled,
  onSetControl,
  onLoadRules,
  onOpenRule,
  onLoadMcp,
  onLoadAppTools,
  onOpenMcpSettings,
  onRestartAgent
}: {
  controls: SessionControl[]
  agentLabel: string
  disabled: boolean
  onSetControl: (id: string, value: ControlValue) => void
  /** Règles actives de la conversation (fiche 056), lues à l'ouverture du menu. */
  onLoadRules?: () => Promise<RuleFileView[]>
  onOpenRule?: (rule: RuleFileView) => void
  /** Serveurs MCP de l'agent pour ce dossier (fiche 060), lus et testés à l'ouverture. */
  onLoadMcp?: () => Promise<McpAgentView | undefined>
  /** Outils de Bobine que reçoit la conversation (fiches 099, 109), lus à l'ouverture. */
  onLoadAppTools?: () => Promise<ConversationAppTools>
  /** Réglages › Serveurs MCP : sur cet onglet, sinon celui de l'agent de la conversation. */
  onOpenMcpSettings?: (tab?: string) => void
  /** Redémarre l'agent : ses outils suivent alors les réglages (fiche 109). */
  onRestartAgent?: () => void
}) {
  const { t } = useTranslation()
  const [rules, setRules] = useState<RuleFileView[] | 'loading' | 'error'>('loading')
  const [mcp, setMcp] = useState<McpAgentView | null>(null)
  const [appTools, setAppTools] = useState<ConversationAppTools | null>(null)
  const [open, setOpen] = useState(false)
  /** Ouverture en cours : une plus récente (ou une fermeture) l'annule. */
  const opening = useRef(0)
  useMcpStatuses()
  return (
    // Non modal : ses éléments ouvrent les Réglages ou un document ; un menu modal laisserait la
    // page sans clic possible une fois la fenêtre refermée.
    <Dropdown.Root
      modal={false}
      open={open}
      onOpenChange={(next) => {
        const ticket = ++opening.current
        if (!next) return setOpen(false)
        // Affiché une fois les règles et les serveurs MCP lus (au plus 300 ms), à sa taille : un
        // menu qui grandit après coup passe un instant sur le bouton puis saute de l'autre côté
        // de la zone de saisie, et le relâché du clic qui l'a ouvert choisissait alors la ligne
        // qui se trouvait sous le pointeur.
        const show = () => {
          if (opening.current === ticket) setOpen(true)
        }
        void Promise.allSettled([
          onLoadRules?.().then(setRules, () => setRules('error')),
          onLoadMcp?.().then(
            (view) => {
              setMcp(view ?? null)
              if (view) void testMcpServers(view.profileId, view.servers, true)
            },
            () => setMcp(null)
          ),
          onLoadAppTools?.().then(setAppTools, () => setAppTools(null))
        ]).then(show)
        setTimeout(show, 300)
      }}
    >
      <Tip label={t('sessionSettings.label')}>
        <Dropdown.Trigger
          className="icon-button"
          disabled={disabled}
          data-testid="session-settings"
        >
          <SlidersHorizontal size={17} />
        </Dropdown.Trigger>
      </Tip>
      <MenuContent testId="session-settings-content">
        <div className="menu-label">{t('sessionSettings.title', { agent: agentLabel })}</div>
        {controls.length === 0 && (
          <div className="menu-item" aria-disabled>
            <ItemText title={t('sessionSettings.none')} />
          </div>
        )}
        {controls.map((control) =>
          control.type === 'boolean' ? (
            <Dropdown.CheckboxItem
              key={control.id}
              className="menu-item"
              checked={control.currentValue === true}
              onCheckedChange={(checked) => onSetControl(control.id, checked)}
              onSelect={(e) => e.preventDefault()}
              data-testid={`control-${control.id}`}
            >
              <ItemText title={control.name} description={control.description} />
              <Dropdown.ItemIndicator>
                <Check size={16} className="menu-check" />
              </Dropdown.ItemIndicator>
            </Dropdown.CheckboxItem>
          ) : (
            <Dropdown.Sub key={control.id}>
              <Dropdown.SubTrigger className="menu-item" data-testid={`control-${control.id}`}>
                <ItemText title={control.name} />
                <span className="menu-value">{valueLabel(control)}</span>
                <ChevronRight size={15} className="menu-icon" />
              </Dropdown.SubTrigger>
              <Dropdown.Portal>
                <Dropdown.SubContent className="menu" sideOffset={6} collisionPadding={12}>
                  <SelectOptions control={control} onChange={(v) => onSetControl(control.id, v)} />
                </Dropdown.SubContent>
              </Dropdown.Portal>
            </Dropdown.Sub>
          )
        )}
        {onLoadMcp && (
          <SessionMcpSection
            mcp={mcp}
            appTools={appTools}
            onOpen={onOpenMcpSettings}
            onRestart={onRestartAgent}
          />
        )}
        {onLoadRules && (
          <>
            <Dropdown.Separator className="menu-separator" />
            <div className="menu-label">{t('rules.title')}</div>
            {rules === 'loading' && (
              <div className="menu-item" aria-disabled>
                <ItemText title="…" />
              </div>
            )}
            {rules === 'error' && (
              <div className="menu-item" aria-disabled>
                <ItemText title={t('rules.unreadable')} />
              </div>
            )}
            {Array.isArray(rules) && rules.length === 0 && (
              <div className="menu-item" aria-disabled data-testid="rules-none">
                <ItemText title={t('rules.none')} description={t('rules.noneHint')} />
              </div>
            )}
            {Array.isArray(rules) &&
              rules.map((rule) => (
                <Dropdown.Item
                  key={rule.path}
                  className="menu-item"
                  onSelect={() => onOpenRule?.(rule)}
                  title={rule.path}
                  data-testid="rule-item"
                >
                  {rule.url ? (
                    <Globe size={15} className="menu-icon" />
                  ) : (
                    <FileText size={15} className="menu-icon" />
                  )}
                  <span className="menu-text">
                    <div className="menu-title rule-label">{rule.label}</div>
                    <div className="menu-desc">{ruleScope(rule)}</div>
                  </span>
                </Dropdown.Item>
              ))}
          </>
        )}
      </MenuContent>
    </Dropdown.Root>
  )
}

/**
 * Section « Serveurs MCP » du menu (fiches 060, 099) : d'abord les outils de Bobine, ceux que la
 * conversation reçoit vraiment, puis les serveurs de l'agent pour ce dossier.
 */
function SessionMcpSection({
  mcp,
  appTools,
  onOpen,
  onRestart
}: {
  mcp: McpAgentView | null
  appTools: ConversationAppTools | null
  onOpen: ((tab?: string) => void) | undefined
  onRestart: (() => void) | undefined
}) {
  const { t } = useTranslation()
  return (
    <>
      <Dropdown.Separator className="menu-separator" />
      <div className="menu-label">{t('sessionSettings.mcp.title')}</div>
      <Dropdown.Item
        className="menu-item"
        onSelect={() => onOpen?.(BOBINE_TAB)}
        title={appTools?.names.length ? appTools.names.join(', ') : undefined}
        data-testid="session-app-tools"
        {...(appTools ? { 'data-count': appTools.names.length } : {})}
      >
        <Wrench size={15} className="menu-icon" />
        <span className="menu-text">
          <div className="menu-title">
            {APP_TOOLS_SERVER_NAME}
            <span className="menu-title-aside"> · {t('sessionSettings.mcp.builtIn')}</span>
          </div>
          <div className="menu-desc">
            {appTools &&
              `${t('sessionSettings.mcp.appTools', { count: appTools.names.length })} · ${
                appTools.tokens > 0
                  ? `${t('sessionSettings.mcp.appToolsTokens', { tokens: formatTokens(appTools.tokens) })} · `
                  : ''
              }`}
            {t('sessionSettings.mcp.appToolsShow')}
          </div>
        </span>
      </Dropdown.Item>
      {appTools?.next !== undefined && (
        // Réglages changés depuis l'ouverture de la session (fiche 109) : rien ne change avant le
        // prochain démarrage de l'agent, que l'on peut lancer d'ici.
        <Dropdown.Item
          className="menu-item"
          disabled={!onRestart}
          onSelect={() => onRestart?.()}
          data-testid="session-app-tools-next"
        >
          <RotateCcw size={15} className="menu-icon" />
          <ItemText
            title={t('sessionSettings.mcp.appToolsNext', { count: appTools.next })}
            description={t('sessionSettings.mcp.appToolsRestart')}
          />
        </Dropdown.Item>
      )}
      {(!mcp || mcp.servers.length === 0) && (
        <Dropdown.Item
          className="menu-item"
          onSelect={() => onOpen?.()}
          data-testid="session-mcp-none"
        >
          <ItemText
            title={t('sessionSettings.mcp.none')}
            description={t('sessionSettings.mcp.noneHint')}
          />
        </Dropdown.Item>
      )}
      {mcp?.servers.map((server) => {
        const status = mcpStatus(mcpKey(mcp.profileId, server))
        return (
          <Dropdown.Item
            key={`${server.scope}:${server.name}`}
            className="menu-item"
            onSelect={() => onOpen?.()}
            title={
              status && status !== 'testing'
                ? status.ok
                  ? t('sessionSettings.mcp.toolsTip', { tools: status.tools.join(', ') })
                  : status.error
                : undefined
            }
            data-testid="session-mcp"
            data-state={
              !server.enabled
                ? 'off'
                : status === undefined || status === 'testing'
                  ? 'testing'
                  : status.ok
                    ? 'ok'
                    : 'error'
            }
          >
            <span className="menu-icon session-mcp-dot">
              <McpDot server={server} status={status} />
            </span>
            <span className="menu-text">
              <div className="menu-title">{server.name}</div>
              <div className="menu-desc">
                {!server.enabled
                  ? t('sessionSettings.mcp.disabled')
                  : status === undefined || status === 'testing'
                    ? t('sessionSettings.mcp.testing')
                    : status.ok
                      ? t('sessionSettings.mcp.tools', { count: status.tools.length })
                      : t('sessionSettings.mcp.error')}
                {' · '}
                {server.scope === 'global'
                  ? t('sessionSettings.mcp.global')
                  : t('sessionSettings.mcp.folder')}
              </div>
            </span>
          </Dropdown.Item>
        )
      })}
    </>
  )
}
