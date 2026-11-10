import { describe, expect, it } from 'vitest'
import type { AgentEvent } from './agent'
import { activityLabel, currentActivity, currentStepId, elapsedLabel } from './activity'
import { emptyTranscript, reduceTranscript } from './transcript'
import { SUBAGENT_META } from './subagent'

const items = (...events: AgentEvent[]) => events.reduce(reduceTranscript, emptyTranscript).items
const user: AgentEvent = { type: 'user-message', text: 'Vas-y' }
const chunk = (sessionUpdate: 'agent_message_chunk' | 'agent_thought_chunk'): AgentEvent => ({
  type: 'update',
  update: { sessionUpdate, content: { type: 'text', text: 'x' } }
})

describe('activité de l’agent', () => {
  it('rien encore, réflexion, texte, outil en cours, outil fini', () => {
    expect(currentActivity(items(user))).toEqual({ kind: 'thinking' })
    expect(currentActivity(items(user, chunk('agent_thought_chunk')))).toEqual({ kind: 'thinking' })
    expect(currentActivity(items(user, chunk('agent_message_chunk')))).toEqual({ kind: 'writing' })
    const tool: AgentEvent = {
      type: 'update',
      update: {
        sessionUpdate: 'tool_call',
        toolCallId: 't',
        title: 'npm test',
        status: 'in_progress'
      }
    }
    expect(currentActivity(items(user, chunk('agent_message_chunk'), tool))).toEqual({
      kind: 'tool',
      title: 'npm test'
    })
    const done: AgentEvent = {
      type: 'update',
      update: { sessionUpdate: 'tool_call_update', toolCallId: 't', status: 'completed' }
    }
    expect(currentActivity(items(user, tool, done))).toEqual({ kind: 'thinking' })
    // Le tour précédent ne compte pas.
    expect(currentActivity(items(user, chunk('agent_message_chunk'), user))).toEqual({
      kind: 'thinking'
    })
  })

  it('outil en cours : le libellé de sa carte (sous-agent, outil de l’app), pas le titre brut', () => {
    const subagent: AgentEvent = {
      type: 'update',
      update: {
        sessionUpdate: 'tool_call',
        toolCallId: 's',
        title: 'Running subagent: Lis les trois fichiers',
        status: 'in_progress',
        rawInput: { description: 'Lis les trois fichiers', name: 'explore' },
        _meta: { [SUBAGENT_META]: { subagent: { task: 'Lis les trois fichiers' } } }
      }
    }
    expect(currentActivity(items(user, subagent))).toEqual({
      kind: 'tool',
      title: 'Sous-agent\u00a0: Lis les trois fichiers'
    })
    const appTool: AgentEvent = {
      type: 'tool-app',
      toolCallId: 's',
      appTool: { label: 'Capture du navigateur', group: 'browser' }
    }
    const plain: AgentEvent = {
      type: 'update',
      update: {
        sessionUpdate: 'tool_call',
        toolCallId: 's',
        title: 'Running Screenshot',
        status: 'in_progress'
      }
    }
    expect(currentActivity(items(user, plain, appTool))).toMatchObject({
      title: 'Capture du navigateur'
    })
  })

  it('autorisation ou question en attente : passe avant le reste', () => {
    const permission: AgentEvent = {
      type: 'permission-request',
      requestId: 'p',
      toolCall: { toolCallId: 't', title: 'Écrire', status: 'pending' },
      options: [{ optionId: 'ok', name: 'OK', kind: 'allow_once' }]
    }
    expect(currentActivity(items(user, permission))).toEqual({ kind: 'permission' })
    const question: AgentEvent = {
      type: 'elicitation-request',
      requestId: 'q',
      prompt: { mode: 'form', message: 'Choix ?', schema: { type: 'object', properties: {} } }
    }
    expect(currentActivity(items(user, chunk('agent_message_chunk'), question))).toEqual({
      kind: 'question'
    })
  })

  it('libellé d’un outil : sans ponctuation en double', () => {
    expect(activityLabel({ kind: 'tool', title: 'Sous-agent : Lis le fichier.' })).toBe(
      'Sous-agent : Lis le fichier…'
    )
  })

  it('libellés et durée', () => {
    expect(activityLabel({ kind: 'tool', title: 'npm test' })).toBe('npm test…')
    expect(activityLabel({ kind: 'permission' })).toBe('Attend votre accord')
    expect(elapsedLabel(8_400)).toBe('8 s')
    expect(elapsedLabel(65_000)).toBe('1 min 05')
  })
})

describe('outil en préparation et étape en cours (fiche 128)', () => {
  const patch: AgentEvent = {
    type: 'update',
    update: {
      sessionUpdate: 'tool_call',
      toolCallId: 'p',
      title: 'patch',
      kind: 'edit',
      status: 'pending',
      rawInput: {}
    }
  }

  it('un patch annoncé sans cible n’est jamais « patch »', () => {
    const activity = currentActivity(items(user, patch))
    expect(activity).toEqual({ kind: 'tool', title: 'Prépare une modification…' })
    expect(activityLabel(activity)).toBe('Prépare une modification…')
    // Avec la cible, comme avant.
    const located: AgentEvent = {
      type: 'update',
      update: {
        sessionUpdate: 'tool_call_update',
        toolCallId: 'p',
        status: 'in_progress',
        locations: [{ path: 'src/a.ts' }]
      }
    }
    expect(currentActivity(items(user, patch, located))).toEqual({
      kind: 'tool',
      title: 'Modification de src/a.ts'
    })
  })

  it('l’étape change à chaque nouvel élément d’activité, pas à chaque morceau de texte', () => {
    expect(currentStepId(items(user))).toBe(-1)
    const withThought = items(user, chunk('agent_thought_chunk'))
    const thoughtStep = currentStepId(withThought)
    expect(thoughtStep).toBeGreaterThan(-1)
    // Un morceau de plus dans la même réflexion : même étape.
    expect(
      currentStepId(items(user, chunk('agent_thought_chunk'), chunk('agent_thought_chunk')))
    ).toBe(thoughtStep)
    const text = items(user, chunk('agent_thought_chunk'), chunk('agent_message_chunk'))
    expect(currentStepId(text)).not.toBe(thoughtStep)
    const tool = items(user, chunk('agent_message_chunk'), patch)
    expect(currentStepId(tool)).not.toBe(currentStepId(items(user, chunk('agent_message_chunk'))))
    // Le tour précédent ne compte pas.
    expect(currentStepId(items(user, patch, user))).toBe(-1)
  })
})
