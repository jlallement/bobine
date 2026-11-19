/**
 * Actions d'une conversation donnée (celle d'à côté, fiche 036), sur le modèle de celles de
 * l'active (sorties de `useConversations`, fiche 253).
 *
 * Leur identité est stable pour un même id : le volet côte à côte les passe à la zone de saisie, et
 * un objet neuf à chaque rendu annulait l'attente de la recherche `@` (`useMentions`, 120 ms) à
 * chaque morceau reçu : la recherche ne partait jamais tant qu'une conversation affichée écrivait.
 */
import { useCallback, useRef } from 'react'
import type { ControlValue, ElicitationAnswer, QueuedMessage } from '@shared/agent'
import type { PromptAttachment, WorkspaceFile } from '@shared/attachments'

export function besideActions(id: string, fail: (error: unknown) => void) {
  const run = (action: Promise<unknown>) => void action.catch(fail)
  return {
    send: (text: string, attachments: PromptAttachment[] = []) =>
      run(window.api.agent.prompt(id, text, attachments)),
    cancel: () => run(window.api.agent.cancel(id)),
    restart: () => run(window.api.agent.restart(id)),
    sendNow: (messageId: string) => run(window.api.agent.sendNow(id, messageId)),
    unqueue: (messageId: string, edit?: boolean): Promise<QueuedMessage | undefined> =>
      window.api.agent.unqueue(id, messageId, edit).catch((error: unknown) => {
        fail(error)
        return undefined
      }),
    respondPermission: (requestId: string, optionId: string | null) =>
      run(window.api.agent.respondPermission(id, requestId, optionId)),
    respondElicitation: (requestId: string, answer: ElicitationAnswer) =>
      run(window.api.agent.respondElicitation(id, requestId, answer)),
    setControl: (controlId: string, value: ControlValue) =>
      run(window.api.agent.setControl(id, controlId, value)),
    authenticate: (methodId: string) => run(window.api.agent.authenticate(id, methodId)),
    retrySession: () => window.api.agent.retrySession(id).catch(fail),
    useApiKey: (env: string, value: string): Promise<void> =>
      window.api.agent.useApiKey(id, env, value),
    runStep: (stepId: string) => run(window.api.agent.runStep(id, stepId)),
    trustForSession: () => run(window.api.agent.trustForSession(id)),
    openTerminal: () => run(window.api.workspace.openTerminal(id)),
    searchFiles: (query: string): Promise<WorkspaceFile[]> =>
      window.api.workspace.searchFiles(id, query).catch(() => []),
    pickFiles: (): Promise<string[]> =>
      window.api.workspace.pickFiles(id).catch((error: unknown) => {
        fail(error)
        return []
      })
  }
}

export type BesideActions = ReturnType<typeof besideActions>

/**
 * `actionsFor(id)` : le même objet tant que l'id et `fail` ne changent pas. Une seule entrée
 * gardée : le volet d'à côté n'affiche qu'une conversation à la fois.
 */
export function useBesideActions(fail: (error: unknown) => void): (id: string) => BesideActions {
  const last = useRef<{ id: string; fail: typeof fail; actions: BesideActions }>(undefined)
  return useCallback(
    (id: string) => {
      const kept = last.current
      if (kept?.id === id && kept.fail === fail) return kept.actions
      const actions = besideActions(id, fail)
      last.current = { id, fail, actions }
      return actions
    },
    [fail]
  )
}
