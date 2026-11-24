/**
 * Arguments IPC venus du renderer, vérifiés (sortis de `ipc.ts`, taille bornée, fiche 089) : on ne
 * fait confiance qu'à ce qu'on vérifie.
 */
import type { AgentSessionView, ElicitationAnswer } from '@shared/agent'

function str(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value) throw new Error(`Paramètre invalide : ${name}`)
  return value
}

/** Session choisie dans « Reprendre une session… » (fiche 055). */
export function parseAgentSession(value: unknown): AgentSessionView {
  if (typeof value !== 'object' || value === null) throw new Error('Session invalide')
  const { sessionId, cwd, title, updatedAt } = value as Record<string, unknown>
  return {
    sessionId: str(sessionId, 'sessionId'),
    cwd: str(cwd, 'cwd'),
    ...(typeof title === 'string' && title ? { title } : {}),
    ...(typeof updatedAt === 'string' && updatedAt ? { updatedAt } : {})
  }
}

export function parseElicitationAnswer(value: unknown): ElicitationAnswer {
  if (typeof value !== 'object' || value === null) throw new Error('Réponse invalide')
  const { action, content } = value as Record<string, unknown>
  if (action !== 'accept' && action !== 'decline' && action !== 'cancel') {
    throw new Error('Réponse invalide')
  }
  if (
    content !== undefined &&
    (typeof content !== 'object' || content === null || Array.isArray(content))
  ) {
    throw new Error('Réponse invalide')
  }
  // Le contenu lui-même est validé contre le schéma par l'AgentHost.
  return { action, content: content as Record<string, unknown> | undefined }
}
