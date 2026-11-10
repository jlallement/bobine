import { useCallback, useEffect, useRef, useState } from 'react'
import type { ProfileSummary } from '@shared/agent'
import type { AgentReadiness, FolderHints, ReadinessLevel } from '@shared/onboarding'
import { ipcErrorText } from '../../ipc-errors'

/** Les étapes de l'accueil, dans l'ordre (verdict UX du 2026-11-07 : l'essai termine). */
export const ONBOARDING_STEPS = ['agent', 'connect', 'folder', 'trial'] as const
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number]

/** Essai en cours, fini, ou pas encore lancé. */
export type CheckState =
  | { status: 'idle' }
  | {
      status: 'running'
      level: ReadinessLevel
      started: number
      /** Connexion lancée par l'agent (SSO dans le navigateur) avant l'essai (fiche 207). */
      authenticating: boolean
    }
  | { status: 'done'; level: ReadinessLevel; result: AgentReadiness }

/**
 * État de l'accueil du premier lancement (fiche 188) : montré ou non (demandé une fois au main),
 * agents proposés, essai en cours. Fini ou passé : la marque est posée et l'accueil disparaît.
 * Sortir par la barre latérale (autre conversation, page de l'app) vaut « Passer l'accueil ».
 */
export function useOnboarding(options: { conversationId: string | null; pageOpen: boolean }) {
  const [visible, setVisible] = useState(false)
  const [agents, setAgents] = useState<ProfileSummary[]>([])
  const [trialFolder, setTrialFolder] = useState('')
  const [check, setCheck] = useState<CheckState>({ status: 'idle' })
  const [hints, setHints] = useState<FolderHints | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Conversation de l'accueil : celle affichée quand il s'ouvre.
  const home = useRef<string | null>(null)
  const run = useRef(0)

  useEffect(() => {
    let alive = true
    window.api.onboarding.state().then(
      (state) => {
        if (!alive || !state.due) return
        setAgents(state.agents)
        setTrialFolder(state.trialFolder)
        setVisible(true)
      },
      () => {}
    )
    return () => {
      alive = false
    }
  }, [])

  const finish = useCallback((outcome: 'finished' | 'skipped') => {
    run.current++
    setVisible(false)
    setCheck({ status: 'idle' })
    window.api.onboarding.finish(outcome).catch(() => {})
    // Suggestions de la première conversation, d'après son dossier.
    const id = home.current
    if (outcome === 'finished' && id) {
      window.api.onboarding.hints(id).then(setHints, () => {})
    }
  }, [])

  // Sortie par la barre latérale : autre conversation ou page de l'app.
  const { conversationId, pageOpen } = options
  useEffect(() => {
    if (!visible) return
    if (home.current === null && conversationId) home.current = conversationId
    if (pageOpen || (home.current && conversationId && conversationId !== home.current)) {
      finish('skipped')
    }
  }, [visible, conversationId, pageOpen, finish])

  const start = useCallback(
    (profileId: string, level: ReadinessLevel, authenticate?: string) => {
      const id = home.current ?? conversationId
      if (!id) return
      const mine = ++run.current
      setError(null)
      setCheck({ status: 'running', level, started: Date.now(), authenticating: !!authenticate })
      window.api.onboarding
        .check({ conversationId: id, profileId, level, ...(authenticate ? { authenticate } : {}) })
        .then(
          (result) => {
            if (run.current === mine) setCheck({ status: 'done', level, result })
          },
          (failure: unknown) => {
            if (run.current !== mine) return
            setCheck({
              status: 'done',
              level,
              result: { state: 'failed', message: ipcErrorText(failure) }
            })
          }
        )
    },
    [conversationId]
  )

  const clearHints = useCallback(() => setHints(null), [])
  const rebind = useCallback(() => {
    home.current = null
  }, [])

  const cancel = useCallback(() => {
    window.api.onboarding.cancel().catch(() => {})
  }, [])

  /** Oublie l'essai affiché (retour à une étape, autre agent) ; annule celui en cours. */
  const reset = useCallback(() => {
    run.current++
    window.api.onboarding.cancel().catch(() => {})
    setCheck({ status: 'idle' })
  }, [])

  /** « Chercher à nouveau » : le PATH du shell relu, puis les agents. */
  const refreshAgents = useCallback(async (): Promise<ProfileSummary[]> => {
    try {
      await window.api.settings.reloadShellEnv()
    } catch (failure) {
      setError(ipcErrorText(failure))
    }
    const state = await window.api.onboarding.state()
    setAgents(state.agents)
    return state.agents
  }, [])

  return {
    visible,
    agents,
    /** Où le dossier d'essai serait créé, tel qu'à montrer. */
    trialFolder,
    check,
    hints,
    error,
    setError,
    /** Conversation de l'accueil (son dossier, son terminal), lue au moment de l'action. */
    homeId: () => home.current ?? conversationId,
    start,
    cancel,
    reset,
    finish,
    refreshAgents,
    /**
     * Avant de reconfigurer la conversation de l'accueil (agent, dossier) : celle qui s'affiche
     * ensuite devient la sienne, sans compter comme une sortie.
     */
    rebind,
    /** Les suggestions ne servent qu'à la première conversation. */
    clearHints
  }
}

export type OnboardingController = ReturnType<typeof useOnboarding>
