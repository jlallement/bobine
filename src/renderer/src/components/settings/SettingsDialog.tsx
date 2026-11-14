import * as Dialog from '@radix-ui/react-dialog'
import {
  Bell,
  Bookmark,
  Bot,
  ChevronLeft,
  HardDrive,
  Keyboard,
  MessagesSquare,
  Palette,
  Plug,
  Search,
  Settings,
  Shield,
  Sparkles,
  SquareSlash,
  Stethoscope,
  Users,
  X
} from 'lucide-react'
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import { EmptyState } from '../common/EmptyState'
import type { AgentSettingsView, ConversationSummary, NewConversationDefaults } from '@shared/agent'
import { type Preferences } from '@shared/preferences'
import type { UserCommand } from '@shared/user-commands'
import type { CustomAgentDraft } from '@shared/custom-agents'
import type { ForgottenApproval } from '@shared/approvals'
import {
  agentEntries,
  searchSettings,
  sectionLabel,
  SETTINGS_GROUPS,
  type SettingsEntry,
  type SettingsSection
} from '../../settings-search'
import { useTranslation } from 'react-i18next'
import { listedAgent } from './AgentsSettings'
import { SettingsBody, type AgentForm } from './SettingsBody'
import { ReadOnlyLine, useProfileStatus } from '../common/Profile'

/** Pages qui restent utilisables en lecture seule : rien n'y change le profil (fiche 196). */
const READ_ONLY_PAGES: ReadonlySet<SettingsSection> = new Set(['data', 'diagnostics', 'about'])
import { PaneBoundary } from '../common/SafeBoundary'

export type { SettingsSection } from '../../settings-search'

/** Sous-page de la page d'un agent (fiche 215 : ses approbations pour tous les projets). */
export type AgentSubPage = 'approvals'

/** Page d'agent demandée de l'extérieur des réglages ; `seq` change à chaque demande. */
export interface AgentPageRequest {
  profileId: string
  sub?: AgentSubPage
  seq: number
}

const SECTION_ICONS: Record<SettingsSection, ReactNode> = {
  general: <Settings size={15} />,
  appearance: <Palette size={15} />,
  notifications: <Bell size={15} />,
  shortcuts: <Keyboard size={15} />,
  conversation: <MessagesSquare size={15} />,
  agents: <Bot size={15} />,
  roles: <Users size={15} />,
  memory: <Bookmark size={15} />,
  mcp: <Plug size={15} />,
  commands: <SquareSlash size={15} />,
  privacy: <Shield size={15} />,
  data: <HardDrive size={15} />,
  diagnostics: <Stethoscope size={15} />,
  about: <Sparkles size={15} />
}

/**
 * Amène un réglage trouvé par la recherche à l'écran et le fait ressortir un instant (fiche 051) :
 * ligne, titre de sous-partie ou raccourci dont le libellé est exactement celui de l'index. Dans un
 * « Avancé » replié, il le déplie d'abord (fiche 136).
 */
function revealSetting(body: HTMLElement, entry: SettingsEntry): void {
  const candidates = body.querySelectorAll<HTMLElement>(
    '.settings-row-label, h2, h3, .shortcuts td:first-child'
  )
  const marked = entry.target
    ? body.querySelector<HTMLElement>(`[data-setting="${CSS.escape(entry.target)}"]`)
    : null
  const found = marked ?? [...candidates].find((el) => el.textContent?.trim() === entry.label)
  const target = marked ?? found?.closest<HTMLElement>('.settings-row, tr, li') ?? found
  if (!target) return
  const details = target.closest('details')
  if (details) details.open = true
  target.scrollIntoView({ block: 'center' })
  target.classList.remove('settings-flash')
  // Relancer l'animation si le même réglage est demandé deux fois de suite.
  void target.offsetWidth
  target.classList.add('settings-flash')
  target.addEventListener('animationend', () => target.classList.remove('settings-flash'), {
    once: true
  })
}

export interface SettingsDialogProps {
  open: boolean
  section: SettingsSection
  /** Onglet de Serveurs MCP à ouvrir (fiche 099) : « Bobine » par défaut. */
  mcpTab?: string
  /** Page d'agent à ouvrir (« Gérer » d'une carte de commande, fiche 215). */
  agentRequest?: AgentPageRequest
  onSection: (section: SettingsSection) => void
  onOpenChange: (open: boolean) => void
  settings: AgentSettingsView | null
  notificationsBlocked?: string
  onPreferences: (change: Partial<Preferences>) => void
  onNotifications: (enabled: boolean) => void
  onOpenNotificationSettings: () => void
  onForgetWorkspace: (workspace: string) => void
  onForgetTool: (profileId: string, tool: string) => void
  /** Site ou commande « toujours autorisés » à oublier (fiche 072). */
  onForgetApproval: (approval: ForgottenApproval) => void
  onSetApiKey: (profileId: string, env: string, value: string) => Promise<void>
  onRemoveApiKey: (profileId: string, env: string) => void
  /** Ajoute ou modifie un agent ACP déclaré (fiche 141) ; rend son identifiant, rejette si refusé. */
  onSaveCustomAgent: (draft: CustomAgentDraft, id?: string) => Promise<string>
  onRemoveCustomAgent: (id: string) => void
  onNewConversation: (defaults: NewConversationDefaults) => void
  /** Relit le PATH du shell de connexion (fiche 043) ; rejette avec la raison. */
  onReloadShellEnv: () => Promise<void>
  /** Sauvegarde de l'historique (fiche 043) : dossier créé, ou `null` si annulé. */
  onBackupHistory: () => Promise<string | null>
  /** Ouvre « Mon activité » (fiche 144), trouvée par la recherche ; les réglages se ferment. */
  onOpenActivity: () => void
  /** Relance l'agent de la conversation active (« Relancer » de la page de son agent, fiche 136). */
  onRestartAgent?: () => void
  /** Commandes « / » du projet de la conversation active (fiche 045). */
  projectCommands: UserCommand[]
  onCommands: (commands: UserCommand[]) => void
  /** Conversation affichée (fiche 223) : son projet pour Réglages › Rôles. */
  activeConversation?: Pick<
    ConversationSummary,
    'id' | 'profileId' | 'workspace' | 'project'
  > | null
}

/** Réglages de l'app (fiche 027), comme ceux de Claude Desktop : ⌘, ou la roue dentée. */
export function SettingsDialog(props: SettingsDialogProps) {
  const { t } = useTranslation()
  const { settings } = props
  const { readOnly } = useProfileStatus()
  // Recherche (fiche 051) : les résultats remplacent la section tant que le champ n'est pas vide.
  const [query, setQuery] = useState('')
  const [reveal, setReveal] = useState<{ entry: SettingsEntry; seq: number } | null>(null)
  // Page d'agent ouverte dans Réglages › Agents (fiche 136) ; `null` : la liste.
  const [agentPage, setAgentPageState] = useState<string | null>(null)
  // Sous-page de la page d'agent (fiche 215) ; revient à la page quand l'agent change.
  const [agentSub, setAgentSub] = useState<AgentSubPage | null>(null)
  const setAgentPage = (page: string | null) => {
    setAgentSub(null)
    setAgentPageState(page)
  }
  // Page demandée de l'extérieur (« Gérer » d'une carte) : appliquée une fois par demande.
  const [seenRequest, setSeenRequest] = useState<AgentPageRequest | undefined>(undefined)
  if (props.agentRequest && props.agentRequest !== seenRequest) {
    setSeenRequest(props.agentRequest)
    setAgentPageState(props.agentRequest.profileId)
    setAgentSub(props.agentRequest.sub ?? null)
  }
  // Formulaire d'un agent ACP déclaré (fiche 141), par-dessus la liste ou la page de l'agent.
  const [agentForm, setAgentForm] = useState<AgentForm | null>(null)
  const searchInput = useRef<HTMLInputElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const searching = query.trim() !== ''
  const results = searching
    ? searchSettings(query, agentEntries(settings?.profiles ?? [], settings?.apiKeys ?? []))
    : []
  const openSection = (section: SettingsSection) => {
    setQuery('')
    setAgentPage(null)
    setAgentForm(null)
    props.onSection(section)
  }
  const openResult = (entry: SettingsEntry) => {
    setQuery('')
    if (entry.section === 'activity') return props.onOpenActivity()
    setReveal((current) => ({ entry, seq: (current?.seq ?? 0) + 1 }))
    setAgentPage(entry.page ?? null)
    setAgentForm(null)
    props.onSection(entry.section)
  }
  // Autre section ou autre page : elle s'affiche depuis son début.
  useEffect(() => {
    if (body.current) body.current.scrollTop = 0
  }, [props.section, agentPage, agentSub, agentForm])
  // Une fois la section (et la page) du réglage affichée : l'amener à l'écran, la faire ressortir.
  useEffect(() => {
    if (!reveal || searching || !body.current) return
    if (props.section !== reveal.entry.section || (reveal.entry.page ?? null) !== agentPage) return
    revealSetting(body.current, reveal.entry)
  }, [reveal, searching, props.section, agentPage])
  const agent =
    props.section === 'agents' && agentPage
      ? settings?.profiles.find((p) => p.id === agentPage && listedAgent(p))
      : undefined
  const form = props.section === 'agents' ? agentForm : null
  const formAgent = form?.id ? settings?.profiles.find((p) => p.id === form.id) : undefined
  return (
    <Dialog.Root
      open={props.open}
      onOpenChange={(open) => {
        if (!open) setQuery('')
        props.onOpenChange(open)
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className="dialog settings-dialog"
          data-testid="settings"
          // Échap referme d'abord une confirmation dans une ligne (fiche 126) ou un souvenir déplié
          // (fiche 182), puis vide la recherche ; les réglages se ferment au suivant.
          onEscapeKeyDown={(event) => {
            if (
              document.activeElement?.closest('.confirm-row, .restore-confirm, .memory-entry.open')
            ) {
              return event.preventDefault()
            }
            if (!searching) return
            event.preventDefault()
            setQuery('')
          }}
          onKeyDown={(event) => {
            if (event.metaKey && event.key.toLowerCase() === 'f') {
              event.preventDefault()
              searchInput.current?.focus()
              searchInput.current?.select()
            }
          }}
        >
          <nav className="settings-nav" aria-label={t('settings.nav.label')}>
            <Dialog.Title className="settings-title">{t('settings.title')}</Dialog.Title>
            <label className="settings-search">
              <Search size={14} />
              <input
                ref={searchInput}
                type="search"
                value={query}
                placeholder={t('settings.search.placeholder')}
                aria-label={t('settings.search.label')}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  const first = results[0]
                  if (e.key === 'Enter' && first) openResult(first)
                }}
                data-testid="settings-search"
              />
            </label>
            {SETTINGS_GROUPS.map((group, i) => (
              <Fragment key={group[0]}>
                {i > 0 && <div className="settings-nav-gap" aria-hidden />}
                {group.map((id) => (
                  <button
                    key={id}
                    className={`settings-nav-item${id === props.section && !searching ? ' active' : ''}`}
                    aria-current={id === props.section && !searching}
                    onClick={() => openSection(id)}
                    data-testid={`settings-${id}`}
                  >
                    {SECTION_ICONS[id]}
                    {sectionLabel(id)}
                  </button>
                ))}
              </Fragment>
            ))}
          </nav>
          <div className="settings-main">
            {/* En-tête fixe : seul le contenu dessous défile (et sa barre de défilement). */}
            <header className="settings-header">
              {(agent || form) && !searching && (
                <button
                  className="settings-crumb"
                  onClick={() =>
                    form
                      ? setAgentForm(null)
                      : agentSub && agent
                        ? setAgentSub(null)
                        : setAgentPage(null)
                  }
                  aria-label={
                    agentSub && agent && !form ? agent.label : t('settings.agents.page.backLabel')
                  }
                  data-testid="settings-agent-back"
                >
                  <ChevronLeft size={15} aria-hidden />
                  {agentSub && agent && !form ? agent.label : t('settings.agents.page.back')}
                </button>
              )}
              <h2 className="settings-heading" data-testid="settings-heading">
                {searching
                  ? t('settings.search.heading')
                  : form
                    ? formAgent
                      ? t('customAgents.form.editTitle', { agent: formAgent.label })
                      : t('customAgents.form.newTitle')
                    : agentSub && agent
                      ? t('approvalRules.page.title')
                      : (agent?.label ?? sectionLabel(props.section))}
              </h2>
              <Dialog.Close className="icon-button settings-close" aria-label={t('settings.close')}>
                <X size={16} />
              </Dialog.Close>
            </header>
            <div className="settings-body" ref={body}>
              <Dialog.Description className="sr-only">
                {t('settings.description')}
              </Dialog.Description>
              {searching && <SearchResults query={query} results={results} onOpen={openResult} />}
              {readOnly && <ReadOnlyLine className="settings-readonly" />}
              {!searching && (
                // Une page qui ne s'affiche pas n'emporte pas les réglages (fiche 194).
                <PaneBoundary
                  what="page"
                  resetKey={`${props.section}:${agentPage ?? ''}:${agentSub ?? ''}`}
                >
                  {/* Lecture seule (fiche 196) : changements refusés, sauf Données et Diagnostic. */}
                  <fieldset
                    className="settings-fieldset"
                    disabled={readOnly && !READ_ONLY_PAGES.has(props.section)}
                  >
                    <SettingsBody
                      props={props}
                      settings={settings}
                      agentPage={agentPage}
                      onOpenAgent={setAgentPage}
                      agentSub={agentSub}
                      onAgentSub={setAgentSub}
                      agentForm={form}
                      onAgentForm={setAgentForm}
                    />
                  </fieldset>
                </PaneBoundary>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/** Résultats de la recherche : réglage, section et explication ; un clic y mène. */
function SearchResults({
  query,
  results,
  onOpen
}: {
  query: string
  results: SettingsEntry[]
  onOpen: (entry: SettingsEntry) => void
}) {
  const { t } = useTranslation()
  return (
    <section data-testid="settings-results">
      {results.length === 0 ? (
        <EmptyState
          level={3}
          icon={Search}
          title={t('settings.search.empty', { query: query.trim() })}
          text={t('settings.search.emptyHint')}
          testId="settings-no-result"
        />
      ) : (
        <ul className="settings-results">
          {results.map((r) => (
            <li key={`${r.section}:${r.target ?? r.label}`}>
              <button
                className="settings-result"
                onClick={() => onOpen(r)}
                data-testid="settings-result"
              >
                <span className="settings-result-label">{r.label}</span>
                <span className="settings-result-section">
                  {r.place ? `${sectionLabel(r.section)} › ${r.place}` : sectionLabel(r.section)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
