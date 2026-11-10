import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Expected } from './opencode-probe'
import {
  acceptedExpectations,
  contractChecks,
  diffObservations,
  watchNotes
} from './opencode-probe'

/** Réponses d'OpenCode 2.0.32 enregistrées par `pnpm opencode-probe --accept`. */
const recorded = JSON.parse(
  readFileSync(join(__dirname, '../../../scripts/opencode-probe.expected.json'), 'utf8')
) as Expected

describe('sonde de suivi d’OpenCode (fiche 078)', () => {
  it('OpenCode 2.0.32 enregistré : le contrat de l’app tient, rien à signaler', () => {
    expect(recorded.opencodeVersion).toBe('2.0.32')
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
    expect(check(recorded.observations)).toBeUndefined()
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
})
