import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Expected } from './opencode-probe'
import type { SessionUpdate } from '../../shared/acp-sdk.mts'
import {
  acceptedExpectations,
  asksUser,
  comparable,
  contractChecks,
  diffObservations,
  parentCards,
  watchNotes
} from './opencode-probe'

/** Réponses d'OpenCode 2.3.0 enregistrées par `pnpm opencode-probe --accept`. */
const recorded = JSON.parse(
  readFileSync(join(__dirname, '../../../scripts/opencode-probe.expected.json'), 'utf8')
) as Expected

describe('sonde de suivi d’OpenCode (fiche 078)', () => {
  it('OpenCode 2.3.0 enregistré : le contrat de l’app tient, rien à signaler', () => {
    expect(recorded.opencodeVersion).toBe('2.3.0')
    expect(contractChecks(recorded.observations).filter((c) => !c.ok)).toEqual([])
    expect(watchNotes(recorded.observations)).toEqual([])
  })

  it('le jour où OpenCode envoie un `plan` ACP : signalé, avec les fiches concernées', () => {
    const changed = structuredClone(recorded.observations)
    changed['liste de tâches'] = { plan: true, todoTools: [] }
    changed['flux'] = { plan: true, unknown: [] }
    const notes = watchNotes(changed)
    expect(notes).toHaveLength(1)
    expect(notes[0]).toContain('`plan` ACP')
    expect(diffObservations(recorded.observations, changed)).toContain(
      'liste de tâches.plan : false → true'
    )
  })

  it('outil de liste de tâches, subagent_update, mise à jour inconnue : signalés', () => {
    const changed = structuredClone(recorded.observations)
    changed['liste de tâches'] = { plan: false, todoTools: ['todowrite'] }
    changed['sous-agent'] = { ...changed['sous-agent'], subagentUpdate: true }
    changed['flux'] = { plan: false, unknown: ['nouveau_type'] }
    const notes = watchNotes(changed).join('\n')
    expect(notes).toContain('todowrite')
    expect(notes).toContain('subagent_update')
    expect(notes).toContain('nouveau_type')
  })

  it('format du sous-agent changé : contrat rompu ; outil non appelé : à relancer', () => {
    const broken = structuredClone(recorded.observations)
    broken['sous-agent'] = { ...broken['sous-agent'], called: true, childMarker: false }
    const failed = contractChecks(broken).filter((c) => !c.ok)
    expect(failed.map((c) => c.unverified ?? false)).toEqual([false])
    expect(failed[0]?.label).toContain('opencode/child-session')

    const lazy = structuredClone(recorded.observations)
    lazy['sous-agent'] = { called: false }
    const unverified = contractChecks(lazy).filter((c) => !c.ok)
    expect(unverified.length).toBeGreaterThan(0)
    expect(unverified.every((c) => c.unverified)).toBe(true)
  })

  it('sans modèle (--offline) : seuls les sondages gratuits sont vérifiés', () => {
    const offline = Object.fromEntries(
      Object.entries(recorded.observations).filter(([k]) =>
        ['initialize', 'session/new', 'session/list', 'session/load, resume, delete'].includes(k)
      )
    )
    const checks = contractChecks(offline)
    expect(checks.every((c) => c.ok)).toBe(true)
    expect(checks.map((c) => c.label).join(' ')).not.toContain('questionnaire')
  })

  it('outils de l’app (fiche 079) : par le titre ou le code d’une carte en cours ; sinon contrat rompu et signalé', () => {
    const check = (observations: typeof recorded.observations) =>
      contractChecks(observations).find((c) => c.label.startsWith('outils de l’app rattachés'))
    expect(recorded.observations['outils de l’app']).toMatchObject({
      via: 'code',
      citedByRunningCard: true
    })
    expect(check(recorded.observations)?.ok).toBe(true)
    const direct = structuredClone(recorded.observations)
    direct['outils de l’app'] = { called: true, via: 'title', citedByRunningCard: false }
    expect(check(direct)?.ok).toBe(true)
    const lost = structuredClone(recorded.observations)
    lost['outils de l’app'] = { called: true, via: 'none', citedByRunningCard: false }
    expect(check(lost)?.ok).toBe(false)
    expect(watchNotes(lost).some((n) => n.includes('fiche 079'))).toBe(true)
  })

  it('outils nommés par execute (fiche 293) : rien tant que la sonde n’a pas tourné ; puis « serveur.outil » exigé', () => {
    const check = (observations: typeof recorded.observations) =>
      contractChecks(observations).find((c) => c.label.includes('fiche 293'))
    // Pas encore relevé avec un modèle : aucune vérification (ni verte, ni rouge).
    expect(recorded.observations['outils de l’app']?.['calledTools']).toBeUndefined()
    expect(check(recorded.observations)).toBeUndefined()
    const named = structuredClone(recorded.observations)
    named['outils de l’app'] = {
      ...named['outils de l’app'],
      calledTools: [{ server: 'bobine', tool: 'browser_screenshot' }]
    }
    expect(check(named)?.ok).toBe(true)
    // Plus de serveur dans le nom (`browser_screenshot` seul) : contrat rompu.
    const bare = structuredClone(named)
    bare['outils de l’app'] = {
      ...bare['outils de l’app'],
      calledTools: [{ tool: 'browser_screenshot' }]
    }
    expect(check(bare)?.ok).toBe(false)
    const none = structuredClone(named)
    none['outils de l’app'] = { ...none['outils de l’app'], calledTools: [] }
    expect(check(none)?.ok).toBe(false)
  })

  it('erreurs des appels d’execute (fiche 122) : état noté dans toolCalls[] ; absent, contrat rompu', () => {
    const check = (observations: typeof recorded.observations) =>
      contractChecks(observations).find((c) => c.label.includes('fiche 122'))
    expect(check(recorded.observations)?.ok).toBe(true)
    const gone = structuredClone(recorded.observations)
    gone['outils de l’app'] = { called: true, via: 'code', citedByRunningCard: true }
    expect(check(gone)?.ok).toBe(false)
    // Appelé par le titre de sa propre carte : rien à lire dans `execute`.
    const direct = structuredClone(recorded.observations)
    direct['outils de l’app'] = { called: true, via: 'title', citedByRunningCard: false }
    expect(check(direct)).toBeUndefined()
  })

  it('modifications rejouées (fiche 096) : patch gardé et diff refait ; sinon rompu, ou signalé si OpenCode garde le diff', () => {
    const check = (observations: typeof recorded.observations) =>
      contractChecks(observations).find((c) => c.label.includes('fiche 096'))
    expect(recorded.observations['modifications rejouées']).toMatchObject({
      patchKept: true,
      diffLost: true,
      rebuilt: true
    })
    expect(check(recorded.observations)?.ok).toBe(true)
    const gone = structuredClone(recorded.observations)
    gone['modifications rejouées'] = {
      edited: true,
      patchKept: false,
      diffLost: true,
      rebuilt: false
    }
    expect(check(gone)).toMatchObject({ ok: false })
    expect(check(gone)?.unverified).toBeUndefined()
    const kept = structuredClone(recorded.observations)
    kept['modifications rejouées'] = {
      edited: true,
      patchKept: true,
      diffLost: false,
      rebuilt: true
    }
    expect(watchNotes(kept).some((n) => n.includes('fiche 096'))).toBe(true)
  })

  it('fichier créé par write (fiche 202) : compté en direct et rouvert ; sinon rompu ; pas sondé, rien', () => {
    const check = (observations: typeof recorded.observations) =>
      contractChecks(observations).find((c) => c.label.includes('fiche 202'))
    // Sondé sur 2.3.0 : vert ; pas sondé (référence plus ancienne) : rien.
    expect(check(recorded.observations)?.ok).toBe(true)
    const unprobed = structuredClone(recorded.observations)
    delete unprobed['création (autorisée d’office)']
    expect(check(unprobed)).toBeUndefined()
    const with202 = (live: boolean, replayed: boolean, created = true) => {
      const o = structuredClone(recorded.observations)
      o['création (autorisée d’office)'] = {
        created,
        live: { rebuilt: live },
        replayed: { rebuilt: replayed }
      }
      return o
    }
    expect(check(with202(true, true))?.ok).toBe(true)
    expect(check(with202(true, false))).toMatchObject({ ok: false })
    expect(check(with202(true, false))?.unverified).toBeUndefined()
    expect(check(with202(false, false, false))?.unverified).toBe(true)
  })

  it('`--offline --accept` ne remplace que les sondages gratuits (fiche 172)', () => {
    const offline = { initialize: { agent: 'OpenCode' }, 'session/new': { commands: ['goal'] } }
    const run = { version: '9.9.9', date: '2026-11-05', model: 'm', offline: true }
    const merged = acceptedExpectations(recorded, run, offline)
    expect(merged.opencodeVersion).toBe(recorded.opencodeVersion)
    expect(merged.model).toBe(recorded.model)
    expect(merged.offline).toEqual({ opencodeVersion: '9.9.9', recordedAt: '2026-11-05' })
    expect(merged.observations['session/new']).toEqual({ commands: ['goal'] })
    expect(merged.observations['sous-agent']).toEqual(recorded.observations['sous-agent'])
    // Passage complet (ou premier enregistrement) : tout est remplacé, sans `offline`.
    const full = acceptedExpectations(merged, { ...run, offline: false }, offline)
    expect(full).toEqual({
      opencodeVersion: '9.9.9',
      recordedAt: '2026-11-05',
      model: 'm',
      observations: offline
    })
    expect(acceptedExpectations(undefined, run, offline).offline).toBeUndefined()
  })

  describe('OpenCode 2.3.0 : sous-agents toujours en arrière-plan (fiche 232)', () => {
    const label = (start: string) => (c: { label: string }) => c.label.startsWith(start)

    it('suivi jusqu’à sa fin : en arrière-plan ou réponse dans le résultat ; sinon contrat rompu', () => {
      const check = (sub: Record<string, unknown>) => {
        const o = structuredClone(recorded.observations)
        o['sous-agent'] = { ...o['sous-agent'], called: true, ...sub }
        return contractChecks(o).find(label('sous-agent suivi jusqu’à sa fin'))
      }
      expect(check({ background: true, resultTag: null })?.ok).toBe(true)
      expect(check({ background: false, resultTag: 'subagent' })?.ok).toBe(true)
      expect(check({ background: false, resultTag: null })).toMatchObject({ ok: false })
      expect(check({ background: false, resultTag: null })?.unverified).toBeUndefined()
    })

    it('rien de relayé pendant le tour (course) : à relancer, pas un contrat rompu', () => {
      const o = structuredClone(recorded.observations)
      o['sous-agent'] = {
        ...o['sous-agent'],
        called: true,
        childRelayed: false,
        childMarker: null,
        childTitleIsDescription: null
      }
      expect(contractChecks(o).find(label('travail du sous-agent rangé'))).toMatchObject({
        ok: false,
        unverified: true
      })
      o['sous-agents en parallèle'] = { called: true, distinctSessions: true, routed: null }
      expect(contractChecks(o).find(label('sous-agents en parallèle'))).toMatchObject({
        unverified: true
      })
      o['sous-agents en parallèle'] = { called: true, distinctSessions: true, routed: false }
      expect(contractChecks(o).find(label('sous-agents en parallèle'))).toMatchObject({ ok: false })
      expect(contractChecks(o).find(label('sous-agents en parallèle'))?.unverified).toBeUndefined()
    })

    it('faits d’une course jamais comparés aux attentes ; les autres, si', () => {
      const before = { 'sous-agent': { childRelayed: true, childMarker: true, background: true } }
      const after = { 'sous-agent': { childRelayed: false, childMarker: null, background: false } }
      expect(diffObservations(comparable(before), comparable(after))).toEqual([
        'sous-agent.background : true → false'
      ])
    })

    it('question d’un sous-agent : par ask_user de l’app (pas d’outil question) ; sinon à relancer ou rompu', () => {
      const check = (sub: Record<string, unknown>) => {
        const o = structuredClone(recorded.observations)
        o['question (texte libre)'] ??= { asked: false }
        o['question d’un sous-agent'] = { called: true, ...sub }
        return contractChecks(o).find(label('question d’un sous-agent'))
      }
      const asked = { asked: true, parentAsked: false, recognized: true, elicited: false }
      expect(check(asked)?.ok).toBe(true)
      // Le sous-agent ne l'a pas posée, ou le parent l'a posée lui-même : le modèle, pas l'app.
      expect(check({ ...asked, asked: false })).toMatchObject({ ok: false, unverified: true })
      expect(check({ ...asked, parentAsked: true })).toMatchObject({ ok: false, unverified: true })
      // Questionnaire non reconnu : contrat rompu.
      expect(check({ ...asked, recognized: false })?.unverified).toBeUndefined()
      expect(check({ ...asked, recognized: false })?.ok).toBe(false)
      // Un jour l'outil `question` pour un sous-agent : écart aux attentes, pas contrat rompu.
      expect(check({ ...asked, elicited: true })?.ok).toBe(true)
      expect(diffObservations({ q: { elicited: false } }, { q: { elicited: true } })).toEqual([
        'q.elicited : false → true'
      ])
    })

    describe('qui a posé la question : le parent ou son sous-agent ?', () => {
      const card = (u: Record<string, unknown>) =>
        ({ sessionUpdate: 'tool_call', status: 'completed', ...u }) as SessionUpdate
      const parentAsked = (updates: SessionUpdate[]) =>
        [...parentCards(updates).values()].some(asksUser)
      const spawn = card({
        toolCallId: 'call_sub',
        title: 'subagent',
        kind: 'think',
        rawInput: {
          agent: 'general',
          description: 'Couleur',
          prompt: 'Utilise ask_user de bobine.'
        }
      })

      it('appel MCP direct du parent (titre seul, sans le nom dans l’entrée) : vu, sondage à relancer', () => {
        for (const title of [
          'bobine_ask_user',
          'mcp__bobine__ask_user',
          'Running Ask User (bobine)'
        ]) {
          const direct = card({ toolCallId: 'call_q', title, rawInput: { question: 'Couleur ?' } })
          expect(parentAsked([spawn, direct])).toBe(true)
        }
        const o = structuredClone(recorded.observations)
        o['question d’un sous-agent'] = {
          called: true,
          asked: true,
          recognized: true,
          parentAsked: true,
          elicited: false
        }
        expect(
          contractChecks(o).find((c) => c.label.startsWith('question d’un sous-agent'))
        ).toMatchObject({ ok: false, unverified: true })
      })

      it('code d’execute du parent qui cite ask_user : vu ; carte du sous-agent ou travail relayé : non', () => {
        const viaCode = card({
          toolCallId: 'call_x',
          title: 'execute',
          rawInput: { code: 'await tools.bobine.ask_user({ question: "?" })' }
        })
        expect(parentAsked([spawn, viaCode])).toBe(true)
        const relayed = card({
          toolCallId: 'ses_child:call_x',
          title: 'execute',
          rawInput: { code: 'await tools.bobine.ask_user({ question: "?" })' },
          _meta: { 'opencode/child-session': { id: 'ses_child', parentID: 'ses_parent' } }
        })
        expect(parentAsked([spawn, relayed])).toBe(false)
        // Un autre outil dont le nom contient ask_user n'est pas `ask_user`.
        expect(asksUser({ title: 'execute', rawInput: { code: 'tools.x.ask_users()' } })).toBe(
          false
        )
      })

      it('trace enregistrée sur 2.3.0 : la question vient du sous-agent, pas du parent', () => {
        const updates = readFileSync(
          join(
            __dirname,
            '__traces__/opencode-2.3.0/questions-choix-texte-libre-plusieurs-refus-sous-agent-6.ndjson'
          ),
          'utf8'
        )
          .split('\n')
          .filter(Boolean)
          .map(
            (line) =>
              JSON.parse(line) as { msg?: { method?: string; params?: { update?: SessionUpdate } } }
          )
          .flatMap((l) =>
            l.msg?.method === 'session/update' && l.msg.params?.update ? [l.msg.params.update] : []
          )
        expect(updates.some((u) => JSON.stringify(u).includes('ask_user'))).toBe(true)
        expect(parentAsked(updates)).toBe(false)
        expect(recorded.observations['question d’un sous-agent']).toMatchObject({
          parentAsked: false
        })
      })
    })
  })
})
