import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Expected } from './bob-probe'
import {
  APPROVAL_FORMAT_PROBE,
  approvalObservation,
  contractChecks,
  diffObservations,
  PROBE_APPROVAL,
  stablePaths
} from './bob-probe'

/** Réponses de Bob 2.0.9 enregistrées par `pnpm bob-probe --accept`. */
const recorded = JSON.parse(
  readFileSync(join(__dirname, '../../../scripts/bob-probe.expected.json'), 'utf8')
) as Expected

describe('sonde du contrat de Bob (fiche 048)', () => {
  it('chemins jetables remplacés, les plus longs d’abord', () => {
    expect(
      stablePaths('Workspace "/tmp/h/projet" is not trusted (/tmp/h)', {
        home: '/tmp/h',
        dossier: '/tmp/h/projet'
      })
    ).toBe('Workspace "<dossier>" is not trusted (<home>)')
  })

  it('Bob 2.1.0 enregistré : le contrat de l’app tient', () => {
    expect(recorded.bobVersion).toBe('2.1.0')
    expect(contractChecks(recorded.observations).filter((c) => !c.ok)).toEqual([])
  })

  it('Bob 2.0.6 (refus à session/new, sans sondage 2.0.9) : le contrat tient aussi (fiche 163)', () => {
    const old = structuredClone(recorded.observations)
    delete old['session/new : dossier refusé (Don’t trust), clé']
    delete old['licence au premier message (formulaire refusé), clé']
    old['refus au tour : clé refusée (licence acceptée sur ce Mac)'] = { skipped: 'non sondé' }
    old['session/new : dossier non approuvé'] = {
      code: -32600,
      message: 'Invalid request: Workspace "<dossier>" is not trusted. Pass --trust to trust…'
    }
    old['session/new : clé, licence non acceptée'] = {
      code: -32600,
      message: 'Invalid request: A license agreement is required. Review it with --show-license…'
    }
    expect(contractChecks(old).filter((c) => !c.ok)).toEqual([])
  })

  it('licence ni à session/new ni par formulaire : contrat rompu', () => {
    const changed = structuredClone(recorded.observations)
    changed['licence au premier message (formulaire refusé), clé'] = {
      form: null,
      prompt: { stopReason: 'end_turn' }
    }
    expect(
      contractChecks(changed)
        .filter((c) => !c.ok)
        .map((c) => c.label)
    ).toEqual(['licence à accepter reconnue (panneau « Licence », ou formulaire puis explication)'])
  })

  it('connexion expirée au message (fiche 200) : un autre refus casse le contrat ; sauté, non vérifié', () => {
    const name = 'refus au tour : clé refusée (licence acceptée sur ce Mac)'
    const label = 'connexion expirée au message reconnue (-32603 « Invalid or expired API key »)'
    const changed = structuredClone(recorded.observations)
    changed[name] = {
      sessionNew: { opened: true },
      prompt: { code: -32603, message: 'Internal error', data: { details: 'Unauthorized' } }
    }
    expect(contractChecks(changed).find((c) => c.label === label)?.ok).toBe(false)
    changed[name] = { skipped: 'licence de Bob pas encore acceptée sur ce Mac' }
    expect(contractChecks(changed).find((c) => c.label === label)).toMatchObject({
      ok: true,
      unverified: true
    })
  })

  it('un message ou une capacité qui change : contrat rompu et écart nommé', () => {
    const changed = structuredClone(recorded.observations)
    changed['session/new : dossier refusé (Don’t trust), clé'] = {
      code: -32602,
      message: 'Workspace "<dossier>" requires approval.'
    }
    const init = changed['initialize'] as { mcp: { http: boolean }; sessionCapabilities: string[] }
    init.mcp.http = false
    init.sessionCapabilities = ['list']
    const broken = contractChecks(changed)
      .filter((c) => !c.ok)
      .map((c) => c.label)
    expect(broken).toEqual([
      'outils de l’app par MCP HTTP (navigateur, simulateurs, ask_user)',
      '« Relancer » reprend la session (session/resume)',
      'suppression chez l’agent (session/delete)',
      'dossier non approuvé reconnu (panneau « Faire confiance »)'
    ])
    const changes = diffObservations(recorded.observations, changed)
    expect(changes).toContain('initialize.mcp.http : true → false')
    expect(changes).toContain(
      'session/new : dossier refusé (Don’t trust), clé.code : -32600 → -32602'
    )
    expect(diffObservations(recorded.observations, recorded.observations)).toEqual([])
  })

  it('nouveau sondage, valeur disparue, base de Bob absente', () => {
    expect(diffObservations({ a: { x: 1 } }, { a: {}, b: { y: true } })).toEqual([
      'a : nouveau → {}',
      'a.x : 1 → disparu',
      'b.y : nouveau → true'
    ])
    const withoutDb = { ...recorded.observations, 'base locale (coûts)': { absent: true } }
    expect(contractChecks(withoutDb).every((c) => c.ok)).toBe(true)
    const oldSchema = { ...recorded.observations, 'base locale (coûts)': { columns: ['id'] } }
    expect(contractChecks(oldSchema).some((c) => !c.ok)).toBe(true)
  })

  describe('règles d’approbation (fiche 215)', () => {
    const FORMAT = 'règles d’approbation écrites comme Bobine, gardées par Bob (types documentés)'
    const check = (observations: Record<string, Record<string, unknown>>, label: string) =>
      contractChecks({ ...recorded.observations, ...observations }).find((c) => c.label === label)

    it('Bob 2.1.0 enregistré : relevés et conformes ; pas encore relevés : non vérifiés', () => {
      expect(check({}, FORMAT)).toEqual({ label: FORMAT, ok: true })
      const older = Object.fromEntries(
        Object.entries(recorded.observations).filter(([name]) => name !== APPROVAL_FORMAT_PROBE)
      )
      const checks = contractChecks(older)
      expect(checks.find((c) => c.label === FORMAT)).toMatchObject({ ok: true, unverified: true })
    })

    it('section gardée par Bob, ses clés ajoutées (forbiddenApprovalGroups…) : le contrat tient', () => {
      const settings = {
        telemetry: { enabled: false },
        approval: { ...PROBE_APPROVAL, forbiddenApprovalGroups: [], autoApprovalEnabled: true }
      }
      const observed = approvalObservation(settings)
      expect(observed).toEqual({
        keys: {
          allowedExecutors: 'object[]',
          allowed_permissions: 'string[]',
          autoApprovalEnabled: 'boolean',
          forbiddenApprovalGroups: '[]',
          outsideWorkspaceAllowed: 'boolean',
          permissionOptions: 'object[]'
        },
        kept: true
      })
      expect(check({ [APPROVAL_FORMAT_PROBE]: observed }, FORMAT)).toEqual({
        label: FORMAT,
        ok: true
      })
    })

    it('liste par défaut effacée, clé renommée, type changé ou section disparue : rompu', () => {
      const lost = structuredClone(PROBE_APPROVAL)
      const entry = lost.allowedExecutors[0]
      if (entry) entry.approvedCommands = ['bobine-sonde']
      const renamed: Record<string, unknown> = { ...PROBE_APPROVAL }
      renamed['allowedPermissions'] = renamed['allowed_permissions']
      delete renamed['allowed_permissions']
      const retyped = { ...PROBE_APPROVAL, outsideWorkspaceAllowed: 'non' }
      for (const approval of [lost, renamed, retyped]) {
        const observed = approvalObservation({ approval })
        expect(check({ [APPROVAL_FORMAT_PROBE]: observed }, FORMAT)?.ok).toBe(false)
      }
      expect(approvalObservation({ telemetry: {} })).toEqual({ approval: 'undefined' })
      expect(check({ [APPROVAL_FORMAT_PROBE]: approvalObservation({}) }, FORMAT)?.ok).toBe(false)
    })
  })
})
