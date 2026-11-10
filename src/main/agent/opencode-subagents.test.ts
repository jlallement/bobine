import { describe, expect, it } from 'vitest'
import {
  openCodeSubagentOf as subagentOf,
  openCodeSubagentSessionId as subagentSessionId
} from './opencode-subagents'

describe('sous-agents d’OpenCode (fiches 010, 078, 140)', () => {
  it('OpenCode 1.19 : rawInput.subagent_type, consigne complète gardée à part', () => {
    expect(
      subagentOf('Read and summarize notes.txt', {
        description: 'Read and summarize notes.txt',
        prompt: 'Read the file notes.txt. Summarize it in one sentence.',
        subagent_type: 'general'
      })
    ).toEqual({
      type: 'general',
      task: 'Read and summarize notes.txt',
      prompt: 'Read the file notes.txt. Summarize it in one sentence.'
    })
    // Premier `tool_call` d'OpenCode : titre « task », rawInput vide → pas encore reconnaissable.
    expect(subagentOf('task', {})).toBeUndefined()
  })

  it('OpenCode 2.0.31 : outil « subagent », type dans rawInput.agent (fiche 078)', () => {
    expect(
      subagentOf('subagent', {
        agent: 'explore',
        description: 'Lire secret.txt et rapporter',
        prompt: 'Lis le fichier secret.txt et rapporte le mot de code.'
      })
    ).toEqual({
      type: 'explore',
      task: 'Lire secret.txt et rapporter',
      prompt: 'Lis le fichier secret.txt et rapporte le mot de code.'
    })
    // `pending` : titre « subagent », rawInput vide → pas encore reconnaissable.
    expect(subagentOf('subagent', {})).toBeUndefined()
    // Un autre outil qui aurait `agent` et `prompt`, sans description ni titre d'OpenCode : non.
    expect(subagentOf('ask_model', { agent: 'x', prompt: 'y' })).toBeUndefined()
  })

  it('autres outils, et forme de Bob : pas un sous-agent d’OpenCode', () => {
    expect(subagentOf('Reading notes.txt', { path: 'notes.txt' })).toBeUndefined()
    expect(subagentOf(undefined, null)).toBeUndefined()
    expect(
      subagentOf('Running subagent: Lire', { description: 'Lire', name: 'explore' })
    ).toBeUndefined()
  })
})

describe('session du sous-agent (fiche 053)', () => {
  it('lue dans la réponse d’OpenCode ; absente sinon ; forme sûre seulement', () => {
    expect(
      subagentSessionId(
        '<task id="ses_ec604fad7ffe1DgSgtJ61m5ICX" state="completed">\n<task_result>ok</task_result>\n</task>'
      )
    ).toBe('ses_ec604fad7ffe1DgSgtJ61m5ICX')
    expect(subagentSessionId('<task_result>Bob</task_result>')).toBeUndefined()
    expect(subagentSessionId('<task id="../../etc" state="x">')).toBeUndefined()
  })

  it('OpenCode 2 : dans la balise <subagent>, ou à part dans rawOutput.metadata', () => {
    expect(
      subagentSessionId('<subagent sessionID="ses_abc" state="completed">\nok\n</subagent>')
    ).toBe('ses_abc')
    // Sous-agent lancé en arrière-plan : la réponse ne contient pas la balise.
    expect(
      subagentSessionId('The subagent is working in the background (sessionID: ses_x).', {
        metadata: { sessionID: 'ses_bg', status: 'running' }
      })
    ).toBe('ses_bg')
    expect(subagentSessionId('', { metadata: { sessionID: '../etc' } })).toBeUndefined()
  })
})
