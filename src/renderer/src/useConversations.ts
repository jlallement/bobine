import { rememberAgentLabels } from './components/panel/useCommitDraft'
import type { ForgottenApproval } from '@shared/approvals'
import { descendants, type ChildLaunchState } from '@shared/children'
import type { PromptAttachment, WorkspaceFile } from '@shared/attachments'
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import type {
  AgentConfigureRequest,
  AgentSessionView,
  AgentSettingsView,
  AgentSnapshot,
  ControlValue,
  ConversationEvent,
  ConversationsState,
  ConversationSummary,
  ConversationView,
  ElicitationAnswer,
  NewConversationDefaults,
  PromptRequest,
  QueuedMessage,
  DeleteOptions
} from '@shared/agent'
import type { AttentionDetails, AttentionState, NotificationStatus } from '@shared/attention'
import type { PanelTab } from '@shared/panel'
import type { Preferences } from '@shared/preferences'
import type { UserCommand } from '@shared/user-commands'
import type { CustomAgentDraft } from '@shared/custom-agents'
import type { ExportFormat } from '@shared/export'
import { reduceTranscript, type TranscriptState } from '@shared/transcript'
import { t } from 'i18next'
import { ipcErrorText } from './ipc-errors'
import { forgetView } from './changes-view-memory'
import { useBesideActions } from './beside-actions'

/**
 * Lectures passées au dialogue de suppression, dépendances de ses effets : stables d'un rendu à
 * l'autre (fiche 253). Neuves à chaque rendu, chaque morceau reçu relançait la lecture et
 * abandonnait la précédente : l'état du worktree pouvait ne jamais s'afficher.
 */
const worktreeStatus = (id: string) => window.api.conversations.worktreeStatus(id)
const family = (id: string) => window.api.conversations.family(id)

export interface Conversation {
  snapshot: AgentSnapshot | null
  transcript: TranscriptState
  /** Dernier évènement compris (vue puis évènements reçus depuis, sans trou). */
  seq?: number
}

export interface State {
  list: ConversationSummary[]
  activeId: string | null
  /** Conversations déjà chargées dans l'UI (les autres le seront à la sélection). */
  loaded: Record<string, Conversation>
  settings: AgentSettingsView | null
  /** Dernier onglet du panneau demandé par l'agent de la conversation active (`seq` : nouveauté). */
  panelRequest: { tab: PanelTab; seq: number } | null
  /** Conversations qui attendent l'utilisateur (pastilles, fiche 024). */
  attention: AttentionState
  /** Ce qu'attend chaque conversation : raison et détail pour son infobulle (fiche 149). */
  attentionDetails: AttentionDetails
  childLaunches: ChildLaunchState
  /** Identité visuelle conservée lors du remplacement d'une ligne de préparation sous le pointeur. */
  childLaunchRows: Record<string, string>
  /** Refus des notifications par macOS (app non signée). */
  notificationStatus: NotificationStatus
}

type Action =
  | { type: 'list'; state: ConversationsState }
  | { type: 'view'; view: ConversationView }
  | { type: 'event'; payload: ConversationEvent }
  | { type: 'settings'; settings: AgentSettingsView }
  | { type: 'attention'; attention: AttentionState }
  | { type: 'attentionDetails'; details: AttentionDetails }
  | { type: 'childLaunches'; launches: ChildLaunchState }
  | { type: 'notificationStatus'; status: NotificationStatus }
  | { type: 'notice'; message: string; level?: 'info' | 'error'; title?: string }

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'list':
      return { ...state, list: action.state.conversations, activeId: action.state.activeId }
    case 'view': {
      const { view } = action
      // Vue et évènements arrivent par des voies distinctes : une vue plus ancienne que ce qui
      // est déjà affiché (évènements reçus avant elle) ne le remplace pas.
      const current = state.loaded[view.summary.id]
      if (current?.seq !== undefined && view.seq !== undefined && view.seq < current.seq) {
        return state
      }
      return {
        ...state,
        loaded: {
          ...state.loaded,
          [view.summary.id]: {
            snapshot: view.snapshot,
            transcript: view.transcript,
            ...(view.seq !== undefined ? { seq: view.seq } : {})
          }
        }
      }
    }
    case 'event': {
      const { conversationId, event } = action.payload
      if (event.type === 'panel-open' && conversationId === state.activeId) {
        state = {
          ...state,
          panelRequest: { tab: event.tab, seq: (state.panelRequest?.seq ?? 0) + 1 }
        }
      }
      const conversation = state.loaded[conversationId]
      if (!conversation) return state // Pas encore affichée : son contenu viendra avec sa vue.
      const { seq } = action.payload
      // Déjà compris dans la vue chargée (arrivée avant lui) : appliqué deux fois, un morceau de
      // réponse s'afficherait en double.
      if (seq !== undefined && conversation.seq !== undefined && seq <= conversation.seq) {
        return state
      }
      return {
        ...state,
        loaded: {
          ...state.loaded,
          [conversationId]: {
            snapshot: event.type === 'status' ? event.snapshot : conversation.snapshot,
            transcript: reduceTranscript(conversation.transcript, event),
            ...(seq !== undefined
              ? { seq }
              : conversation.seq !== undefined
                ? { seq: conversation.seq }
                : {})
          }
        }
      }
    }
    case 'settings':
      return { ...state, settings: action.settings }
    case 'attention':
      return { ...state, attention: action.attention }
    case 'attentionDetails':
      return { ...state, attentionDetails: action.details }
    case 'childLaunches':
      return action.launches.revision < state.childLaunches.revision
        ? state
        : {
            ...state,
            childLaunches: action.launches,
            childLaunchRows: {
              ...state.childLaunchRows,
              ...Object.fromEntries(
                action.launches.entries.flatMap((launch) =>
                  launch.conversationId
                    ? [[`child-launch:${launch.id}`, launch.conversationId]]
                    : []
                )
              )
            }
          }
    case 'notificationStatus':
      return { ...state, notificationStatus: action.status }
    case 'notice': {
      // Erreur d'appel côté UI : affichée dans la conversation active, sans dire la fin du tour
      // (`local`).
      if (!state.activeId) return state
      return reducer(state, {
        type: 'event',
        payload: {
          conversationId: state.activeId,
          event: {
            type: 'notice',
            level: action.level ?? 'error',
            message: action.message,
            ...(action.title ? { title: action.title } : {}),
            local: true
          }
        }
      })
    }
  }
}

/** Ce que rend `useConversations`, pour les hooks qui en reçoivent une partie. */
export type Conversations = ReturnType<typeof useConversations>

/** Autorisation retenue oubliée, par le canal de son genre (fiches 072, 175, 269). */
function forgetOne(approval: ForgottenApproval): Promise<AgentSettingsView> {
  if ('site' in approval) return window.api.settings.forgetSite(approval.site)
  if ('certificate' in approval) return window.api.settings.forgetCertificate(approval.certificate)
  if ('worktreeSetup' in approval) {
    return window.api.settings.forgetWorktreeSetup(approval.worktreeSetup)
  }
  return window.api.settings.forgetCommand(approval.workspace, approval.command)
}

/** Conversations, conversation active et réglages, synchronisés avec le main via `window.api`. */
/**
 * Suppressions finies côté main dont la liste sans elles n'est pas encore arrivée (fiche 277,
 * `parcours-deleguer` 6). La réponse de `conversation:delete` et les évènements poussés par le
 * main (`conversations:changed`, `agent:event`) ne suivent pas la même voie : la réponse peut
 * arriver avant eux. Libérées à la réponse, l'arrêt de l'agent encore en route relançait une
 * lecture de la conversation supprimée, toujours affichée (« Conversation inconnue »). Elles
 * restent donc tues jusqu'à la liste qui ne les a plus.
 */
function useSettledDeletes(
  setRemoving: (update: (current: ReadonlySet<string>) => ReadonlySet<string>) => void
) {
  const deleted = useRef(new Set<string>())
  /** Dernière liste reçue du main (`conversations:changed`, ou lecture au montage). */
  const latest = useRef<ConversationsState | null>(null)
  return useMemo(() => {
    const release = () => {
      const list = latest.current
      if (!list) return
      const gone = [...deleted.current].filter(
        (id) => id !== list.activeId && !list.conversations.some((c) => c.id === id)
      )
      if (!gone.length) return
      for (const id of gone) deleted.current.delete(id)
      window.api.conversations.removing(gone, false)
      setRemoving((current) => new Set([...current].filter((c) => !gone.includes(c))))
    }
    return {
      /** Liste reçue ; `initial` : lecture au montage, sans remplacer une liste déjà poussée. */
      seen: (list: ConversationsState, initial = false) => {
        if (!initial || !latest.current) latest.current = list
        release()
      },
      /** Suppression faite côté main : libérées dès qu'une liste ne les a plus. */
      done: (ids: readonly string[]) => {
        for (const id of ids) deleted.current.add(id)
        release()
      }
    }
  }, [setRemoving])
}

export function useConversations() {
  const [state, dispatch] = useReducer(reducer, {
    list: [],
    activeId: null,
    loaded: {},
    settings: null,
    panelRequest: null,
    attention: {},
    attentionDetails: {},
    childLaunches: { revision: 0, entries: [] },
    childLaunchRows: {},
    notificationStatus: {}
  })
  const fail = useCallback(
    (error: unknown) => dispatch({ type: 'notice', message: ipcErrorText(error) }),
    []
  )
  const showView = useCallback((view: ConversationView) => dispatch({ type: 'view', view }), [])
  /**
   * Conversations dont la suppression est en cours (recette rc.4) : le main les retire avant que la
   * liste ne change d'active, et l'arrêt de leur agent fait relire git et les commandes du projet ;
   * ces lectures tombaient sur « Conversation inconnue ». `queryId` les tait jusqu'à la fin.
   */
  const [removing, setRemoving] = useState<ReadonlySet<string>>(() => new Set())
  const settled = useSettledDeletes(setRemoving)
  // Nom de l'agent de chaque conversation, pour le message de commit rédigé (fiche 246).
  useEffect(() => rememberAgentLabels(state.list), [state.list])

  useEffect(() => {
    const offEvent = window.api.agent.onEvent((payload) => dispatch({ type: 'event', payload }))
    const offList = window.api.conversations.onChanged((list) => {
      dispatch({ type: 'list', state: list })
      settled.seen(list)
      // La conversation active (donc son agent et son dossier) a pu changer.
      void window.api.settings.get().then((settings) => dispatch({ type: 'settings', settings }))
    })
    const offAttention = window.api.attention.onChanged((attention) =>
      dispatch({ type: 'attention', attention })
    )
    const offDetails = window.api.attention.onDetails((details) =>
      dispatch({ type: 'attentionDetails', details })
    )
    const offLaunches = window.api.conversations.onChildLaunches((launches) =>
      dispatch({ type: 'childLaunches', launches })
    )
    void window.api.conversations
      .childLaunches()
      .then((launches) => dispatch({ type: 'childLaunches', launches }))
      .catch(fail)
    // Clic sur une notification macOS : sa conversation s'affiche.
    const offOpen = window.api.app.onOpenConversation((id) => {
      window.api.conversations.select(id).then(showView).catch(fail)
    })
    // Réglages changés (thème, police…) : par ce client ou un autre (fiche 027).
    const offSettings = window.api.settings.onChanged((settings) =>
      dispatch({ type: 'settings', settings })
    )
    const offStatus = window.api.attention.onNotificationStatus((status) =>
      dispatch({ type: 'notificationStatus', status })
    )
    void window.api.attention.get().then((attention) => dispatch({ type: 'attention', attention }))
    void window.api.attention
      .details()
      .then((details) => dispatch({ type: 'attentionDetails', details }))
    void window.api.attention
      .notificationStatus()
      .then((status) => dispatch({ type: 'notificationStatus', status }))
    void (async () => {
      const list = await window.api.conversations.get()
      settled.seen(list, true)
      dispatch({ type: 'list', state: list })
      showView(await window.api.conversations.view(list.activeId))
      dispatch({ type: 'settings', settings: await window.api.settings.get() })
    })().catch(fail)
    return () => {
      offEvent()
      offList()
      offAttention()
      offDetails()
      offLaunches()
      offOpen()
      offStatus()
      offSettings()
    }
  }, [fail, showView, settled])

  const { activeId } = state
  const withActive = useCallback(
    // La promesse rendue (erreur déjà signalée) : « Réessayer » attend sa fin (recette 0.9, D10).
    (run: (id: string) => Promise<unknown>): Promise<unknown> | undefined =>
      activeId ? run(activeId).catch(fail) : undefined,
    [activeId, fail]
  )

  const actionsFor = useBesideActions(fail)

  /** Fichiers du dossier de la conversation (mentions `@`) ; stable tant que la conversation l'est. */
  const searchFiles = useCallback(
    async (query: string): Promise<WorkspaceFile[]> =>
      activeId ? window.api.workspace.searchFiles(activeId, query).catch(() => []) : [],
    [activeId]
  )

  return {
    ...state,
    active: activeId ? (state.loaded[activeId] ?? null) : null,
    /** Conversation active à interroger en tâche de fond (git, commandes) ; `null` pendant sa suppression. */
    queryId: activeId && !removing.has(activeId) ? activeId : null,
    activeSummary: state.list.find((c) => c.id === activeId) ?? null,
    select: (id: string) => {
      window.api.conversations.select(id).then(showView).catch(fail)
    },
    /** Reprend une session gardée par l'agent (fiche 055) ; rejette si elle ne peut pas l'être. */
    resumeSession: (profileId: string, session: AgentSessionView) =>
      window.api.conversations.resumeSession(profileId, session).then(showView),
    /** Nouvelle conversation : l'actuelle reste dans l'historique. */
    create: (request: AgentConfigureRequest = {}) => {
      window.api.conversations.create(request).then(showView).catch(fail)
    },
    /** Autre agent / dossier : reconfigure une conversation vide, sinon en ouvre une nouvelle. */
    configure: (request: AgentConfigureRequest) =>
      withActive((id) => window.api.agent.configure(id, request).then(showView)),
    chooseWorkspace: () =>
      withActive(async (id) => {
        const workspace = await window.api.workspace.choose()
        if (workspace) showView(await window.api.agent.configure(id, { workspace }))
      }),
    send: (text: string, attachments: PromptAttachment[] = [], options?: PromptRequest) =>
      withActive((id) => window.api.agent.prompt(id, text, attachments, options)),
    searchFiles,
    /** Dialogue de choix de fichiers à joindre. */
    pickFiles: async (): Promise<string[]> => {
      if (!activeId) return []
      return window.api.workspace.pickFiles(activeId).catch((error: unknown) => {
        fail(error)
        return []
      })
    },
    /** Information affichée dans le fil, sans rien envoyer à l'agent (`/context`, `/help`…). */
    info: (message: string, title?: string) =>
      dispatch({ type: 'notice', message, level: 'info', ...(title ? { title } : {}) }),
    /** Message d'avertissement affiché dans le fil (ex. pièce jointe refusée). */
    warn: (message: string) => fail(new Error(message)),
    /** Retire un message de la file d'attente et le rend (pour le modifier). */
    unqueue: async (messageId: string, edit?: boolean): Promise<QueuedMessage | undefined> => {
      if (!activeId) return undefined
      return window.api.agent.unqueue(activeId, messageId, edit).catch((error: unknown) => {
        fail(error)
        return undefined
      })
    },
    /** Interrompt la réponse et envoie la file d'attente, ce message en premier. */
    sendNow: (messageId: string) => withActive((id) => window.api.agent.sendNow(id, messageId)),
    cancel: () => withActive((id) => window.api.agent.cancel(id)),
    /** Renvoie tout de suite un message en panne réseau (fiche 142). */
    retryTurn: () => withActive((id) => window.api.agent.retryTurn(id)),
    restart: () => withActive((id) => window.api.agent.restart(id)),
    respondPermission: (requestId: string, optionId: string | null) =>
      withActive((id) => window.api.agent.respondPermission(id, requestId, optionId)),
    respondElicitation: (requestId: string, answer: ElicitationAnswer) =>
      withActive((id) => window.api.agent.respondElicitation(id, requestId, answer)),
    authenticate: (methodId: string) =>
      withActive((id) => window.api.agent.authenticate(id, methodId)),
    retrySession: () => withActive((id) => window.api.agent.retrySession(id)),
    /** Clé d'API saisie dans « Connexion requise » ; l'erreur revient au panneau. */
    useApiKey: (env: string, value: string): Promise<void> =>
      activeId
        ? window.api.agent.useApiKey(activeId, env, value)
        : Promise.reject(new Error(t('conversations.none'))),
    runStep: (stepId: string) => withActive((id) => window.api.agent.runStep(id, stepId)),
    trustForSession: () => withActive((id) => window.api.agent.trustForSession(id)),
    openTerminal: () => withActive((id) => window.api.workspace.openTerminal(id)),
    setControl: (controlId: string, value: ControlValue) =>
      withActive((id) => window.api.agent.setControl(id, controlId, value)),
    openNotificationSettings: () => {
      window.api.attention.openNotificationSettings().catch(fail)
    },
    setPreferences: (change: Partial<Preferences>) => {
      window.api.settings
        .setPreferences(change)
        .then((settings) => dispatch({ type: 'settings', settings }))
        .catch(fail)
    },
    /** Commandes « / » personnelles (fiche 045) : liste entière. */
    setCommands: (commands: UserCommand[]) => {
      window.api.settings
        .setCommands(commands)
        .then((settings) => dispatch({ type: 'settings', settings }))
        .catch(fail)
    },
    /** Réglages d'une nouvelle conversation : agent, dossier, mode. */
    setNewConversation: (defaults: NewConversationDefaults) => {
      window.api.settings
        .setNewConversation(defaults)
        .then((settings) => dispatch({ type: 'settings', settings }))
        .catch(fail)
    },
    /** Un outil n'est plus autorisé d'office pour cet agent (fiche 042). */
    /** Clé d'API d'un agent (Réglages, fiche 022) ; l'erreur revient au formulaire. */
    setApiKey: (profileId: string, env: string, value: string): Promise<void> =>
      window.api.settings
        .setApiKey(profileId, env, value)
        .then((settings) => dispatch({ type: 'settings', settings })),
    removeApiKey: (profileId: string, env: string) => {
      window.api.settings
        .removeApiKey(profileId, env)
        .then((settings) => dispatch({ type: 'settings', settings }))
        .catch(fail)
    },
    /** Agent ACP déclaré (fiche 141) ; l'erreur revient au formulaire. */
    saveCustomAgent: (draft: CustomAgentDraft, id?: string): Promise<string> =>
      window.api.settings.saveCustomAgent(draft, id).then((saved) => {
        dispatch({ type: 'settings', settings: saved.settings })
        return saved.id
      }),
    removeCustomAgent: (id: string) => {
      window.api.settings
        .removeCustomAgent(id)
        .then((settings) => dispatch({ type: 'settings', settings }))
        .catch(fail)
    },
    forgetTool: (profileId: string, tool: string) => {
      window.api.settings
        .forgetTool(profileId, tool)
        .then((settings) => dispatch({ type: 'settings', settings }))
        .catch(fail)
    },
    /** Site ou commande « toujours autorisés » oubliés (fiche 072). */
    forgetApproval: (approval: ForgottenApproval) => {
      forgetOne(approval)
        .then((settings) => dispatch({ type: 'settings', settings }))
        .catch(fail)
    },
    /** Relit le PATH du shell de connexion (fiche 043) ; l'erreur revient au dialogue. */
    reloadShellEnv: (): Promise<void> =>
      window.api.settings
        .reloadShellEnv()
        .then((settings) => dispatch({ type: 'settings', settings })),
    forgetWorkspace: (workspace: string) => {
      window.api.settings
        .forgetWorkspace(workspace)
        .then((settings) => dispatch({ type: 'settings', settings }))
        .catch(fail)
    },
    setNotifications: (enabled: boolean) => {
      window.api.settings
        .setNotifications(enabled)
        .then((settings) => dispatch({ type: 'settings', settings }))
        .catch(fail)
    },
    rename: (id: string, title: string) => {
      window.api.conversations.rename(id, title).catch(fail)
    },
    /** Ouvre une conversation à côté de l'active (vue côte à côte, fiche 036). */
    openBeside: (id: string) => {
      window.api.conversations.open(id).then(showView).catch(fail)
    },
    releaseBeside: (id: string) => {
      window.api.conversations.release(id).catch(() => {})
    },
    /**
     * Actions d'une conversation donnée (celle d'à côté), sur le modèle de celles de l'active ;
     * même objet d'un rendu à l'autre pour un même id (fiche 253).
     */
    actionsFor,
    /** Fichiers modifiés depuis un message de la conversation active, avant d'en repartir. */
    branchPreview: (itemId: number) =>
      activeId
        ? window.api.conversations.branchPreview(activeId, itemId)
        : Promise.reject(new Error(t('conversations.none'))),
    /** Repartir d'un message avec un nouveau texte : la branche devient la conversation affichée. */
    branch: (itemId: number, text: string, options: { restoreFiles?: boolean } = {}) =>
      withActive((id) => window.api.conversations.branch(id, itemId, text, options).then(showView)),
    /** Nouvelle conversation dans un worktree git, depuis le dossier de la conversation active. */
    createWorktree: () =>
      withActive((id) => window.api.conversations.createWorktree(id).then(showView)),
    worktreeStatus,
    /** Descendance d'une conversation, pour la confirmation de suppression (fiche 228). */
    family,
    /** Archive une conversation, ou la ressort (une nouvelle conversation remplace l'active). */
    archive: (id: string, archived: boolean) => {
      window.api.conversations
        .archive(id, archived)
        .then(async (list) => {
          if (list.activeId !== activeId) {
            showView(await window.api.conversations.view(list.activeId))
          }
        })
        .catch(fail)
    },
    pin: (id: string, pinned: boolean) => {
      window.api.conversations.pin(id, pinned).catch(fail)
    },
    /** Export d'une conversation (fiche 043) : le fichier écrit est dit dans le fil. */
    exportConversation: (id: string, format: ExportFormat) => {
      window.api.conversations
        .export(id, format)
        .then((path) => {
          if (path)
            dispatch({
              type: 'notice',
              message: t('conversations.exported', { path }),
              level: 'info'
            })
        })
        .catch(fail)
    },
    /** Sauvegarde de l'historique (Réglages) ; l'erreur revient au dialogue. */
    backupHistory: (): Promise<string | null> => window.api.app.backupHistory(),
    remove: (id: string, options: DeleteOptions = {}) => {
      forgetView(id)
      const ids = [
        id,
        ...(options.children === 'delete' ? descendants(state.list, id).map((c) => c.id) : [])
      ]
      setRemoving((current) => new Set([...current, ...ids]))
      // Plus aucun appel vers elles ne part au main d'ici la fin (preload, chasse rc.4) : toutes les
      // lectures du renderer (outils de Bobine, plan de fusion…), pas seulement git et commandes.
      window.api.conversations.removing(ids, true)
      // Refusée : de nouveau interrogées tout de suite. Faite : libérées par la liste sans elles.
      const release = () => {
        window.api.conversations.removing(ids, false)
        setRemoving((current) => new Set([...current].filter((c) => !ids.includes(c))))
      }
      window.api.conversations
        .delete(id, options)
        .then(
          async (list) => {
            settled.done(ids)
            showView(await window.api.conversations.view(list.activeId))
          },
          (error: unknown) => {
            release()
            throw error
          }
        )
        .catch(fail)
    }
  }
}
