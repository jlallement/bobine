import { spawnSync } from 'node:child_process'
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  checkConfiguration,
  cliArgs,
  describe as describePlan,
  entitlementKeys,
  notarytoolAuth,
  REQUIRED_ENTITLEMENTS,
  shellAssignments,
  signingPlan,
  type SigningPlan
} from './signing.mts'

const ROOT = join(import.meta.dirname, '..')

/** Fichier .p8 factice : APPLE_API_KEY est un chemin, vérifié. */
function fakeKey(): string {
  const path = join(mkdtempSync(join(tmpdir(), 'signing-')), 'AuthKey_TEST.p8')
  writeFileSync(path, '-----BEGIN PRIVATE KEY-----\nfaux\n-----END PRIVATE KEY-----\n')
  return path
}

/** Environnement du test sans les variables de signature de la machine (s'il y en a). */
const cleanEnv = () =>
  Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^(CSC_|APPLE_)/.test(name)))

/** Arguments de `notarytool` d'un plan qui doit avoir des identifiants de notarisation. */
function authOf(plan: SigningPlan): string[] {
  if (!plan.notary) throw new Error('pas d’identifiants de notarisation')
  return notarytoolAuth(plan.notary)
}

const DEVELOPER_ID = { CSC_NAME: 'Developer ID Application: Test (ABCDE12345)' }
const apiKey = () => ({
  APPLE_API_KEY: fakeKey(),
  APPLE_API_KEY_ID: 'KEYID',
  APPLE_API_ISSUER: 'issuer-uuid'
})

describe('plan de signature (fiche 111)', () => {
  it('sans variable : ad hoc, exactement comme avant (aucun certificat du trousseau)', () => {
    const plan = signingPlan({})
    expect(plan.certificate).toBeUndefined()
    expect(plan.notary).toBeUndefined()
    expect(cliArgs(plan.overrides)).toEqual(['-c.mac.identity=-'])
    expect(plan.env).toEqual({ CSC_IDENTITY_AUTO_DISCOVERY: 'false' })
    expect(plan.errors).toEqual([])
    expect(plan.warnings).toEqual([])
    expect(shellAssignments(plan)).toBe(
      'export CSC_IDENTITY_AUTO_DISCOVERY=false\nsigning_args=(-c.mac.identity=-)\nnotarize_dmg=0'
    )
  })

  it('secrets GitHub non posés (variables vides) : ad hoc, même en --strict', () => {
    const plan = signingPlan(
      {
        CSC_LINK: '',
        CSC_KEY_PASSWORD: '',
        APPLE_API_KEY: '',
        APPLE_API_KEY_ID: ' ',
        APPLE_API_ISSUER: ''
      },
      { strict: true }
    )
    expect(cliArgs(plan.overrides)).toEqual(['-c.mac.identity=-'])
    expect(plan.errors).toEqual([])
    // electron-builder lit CSC_LINK lui-même : vide, il y voit un fichier et échoue (« not a
    // file », Release v0.5.0 du 2026-10-23) ; le plan l'efface avant de le lancer.
    expect(plan.unset).toEqual(['CSC_LINK', 'CSC_KEY_PASSWORD'])
    expect(shellAssignments(plan).split('\n')[0]).toBe('unset CSC_LINK CSC_KEY_PASSWORD')
  })

  it('certificat et clé d’API : signature, notarisation, .dmg signé puis agrafé', () => {
    const env = { ...DEVELOPER_ID, ...apiKey() }
    const plan = signingPlan(env, { strict: true })
    expect(plan.errors).toEqual([])
    expect(plan.certificate).toEqual({ source: 'CSC_NAME' })
    expect(plan.notary?.kind).toBe('api-key')
    expect(plan.env).toEqual({})
    expect(cliArgs(plan.overrides)).toEqual(['-c.mac.notarize=true', '-c.dmg.sign=true'])
    expect(shellAssignments(plan)).toContain('notarize_dmg=1')
    expect(authOf(plan)).toEqual([
      '--key',
      env.APPLE_API_KEY,
      '--key-id',
      'KEYID',
      '--issuer',
      'issuer-uuid'
    ])
  })

  it('certificat .p12 (CI) et identifiant Apple', () => {
    const plan = signingPlan({
      CSC_LINK: 'MIIK…base64',
      CSC_KEY_PASSWORD: 'secret-p12',
      APPLE_ID: 'dev@example.com',
      APPLE_APP_SPECIFIC_PASSWORD: 'abcd-efgh-ijkl-mnop',
      APPLE_TEAM_ID: 'ABCDE12345'
    })
    expect(plan.certificate).toEqual({ source: 'CSC_LINK' })
    expect(plan.warnings).toEqual([])
    expect(authOf(plan)).toEqual([
      '--apple-id',
      'dev@example.com',
      '--password',
      'abcd-efgh-ijkl-mnop',
      '--team-id',
      'ABCDE12345'
    ])
  })

  it('profil du trousseau (APPLE_KEYCHAIN_PROFILE), trousseau facultatif', () => {
    const plan = signingPlan({
      ...DEVELOPER_ID,
      APPLE_KEYCHAIN_PROFILE: 'bobine',
      APPLE_KEYCHAIN: 'build.keychain'
    })
    expect(authOf(plan)).toEqual(['--keychain-profile', 'bobine', '--keychain', 'build.keychain'])
  })

  it('jeu incomplet : erreur qui nomme les variables manquantes, jamais les valeurs', () => {
    const plan = signingPlan({
      ...DEVELOPER_ID,
      APPLE_ID: 'dev@example.com',
      APPLE_TEAM_ID: 'ABCDE12345'
    })
    expect(plan.errors).toEqual([
      'Notarisation incomplète : APPLE_ID, APPLE_TEAM_ID sans APPLE_APP_SPECIFIC_PASSWORD'
    ])
    expect(plan.errors.join()).not.toContain('dev@example.com')
  })

  it('APPLE_API_KEY qui n’est pas un fichier : erreur (electron-builder attend le chemin du .p8)', () => {
    const plan = signingPlan({
      ...DEVELOPER_ID,
      ...apiKey(),
      APPLE_API_KEY: '-----BEGIN PRIVATE KEY-----'
    })
    expect(plan.errors).toEqual([
      'APPLE_API_KEY doit être le chemin du fichier .p8 : fichier introuvable'
    ])
  })

  it('certificat sans notarisation : avertissement en local, erreur pour une version publiée', () => {
    expect(signingPlan(DEVELOPER_ID).warnings).toHaveLength(1)
    expect(signingPlan(DEVELOPER_ID).errors).toEqual([])
    expect(signingPlan(DEVELOPER_ID, { strict: true }).errors).toHaveLength(1)
    expect(cliArgs(signingPlan(DEVELOPER_ID).overrides)).toEqual([])
  })

  it('notarisation sans certificat : ignorée (ad hoc), erreur en --strict', () => {
    const plan = signingPlan(apiKey())
    expect(cliArgs(plan.overrides)).toEqual(['-c.mac.identity=-'])
    expect(plan.warnings).toHaveLength(1)
    expect(signingPlan(apiKey(), { strict: true }).errors).toHaveLength(1)
  })

  it('plusieurs jeux : celui qu’electron-builder prendra (identifiant Apple d’abord)', () => {
    const plan = signingPlan({
      ...DEVELOPER_ID,
      ...apiKey(),
      APPLE_ID: 'dev@example.com',
      APPLE_APP_SPECIFIC_PASSWORD: 'x',
      APPLE_TEAM_ID: 'ABCDE12345'
    })
    expect(plan.notary?.kind).toBe('apple-id')
    expect(plan.warnings).toHaveLength(1)
  })

  it('résumé sans aucune valeur secrète', () => {
    const env = { ...DEVELOPER_ID, ...apiKey() }
    const text = describePlan(signingPlan(env)).join('\n')
    expect(text).toContain('Notarisation : clé d’API App Store Connect')
    expect(text).toContain('Agrafage')
    for (const secret of Object.values(env)) expect(text).not.toContain(secret)
  })
})

describe('essai à blanc : configuration lue par electron-builder (fiche 111)', () => {
  it('droits du runtime durci : exactement ceux justifiés dans la fiche', () => {
    const plist = readFileSync(join(ROOT, 'build', 'entitlements.mac.plist'), 'utf8')
    expect(entitlementKeys(plist).sort()).toEqual([...REQUIRED_ENTITLEMENTS].sort())
  })

  it('ad hoc : le chargeur et le schéma d’electron-builder acceptent la configuration', async () => {
    const config = await checkConfiguration(signingPlan({}))
    expect(config.mac).toMatchObject({
      identity: '-',
      hardenedRuntime: true,
      notarize: false,
      entitlements: 'build/entitlements.mac.plist',
      entitlementsInherit: 'build/entitlements.mac.plist'
    })
    expect(config.dmg?.['sign']).toBeUndefined()
  })

  it('Developer ID + notarisation : certificat désigné, notarisation et .dmg signé', async () => {
    const config = await checkConfiguration(signingPlan({ ...DEVELOPER_ID, ...apiKey() }))
    expect(config.mac?.['identity']).toBeUndefined()
    expect(config.mac).toMatchObject({ hardenedRuntime: true, notarize: true })
    expect(config.dmg?.['sign']).toBe(true)
  })

  it('pnpm package --dry-run : plan affiché, rien de construit ni signé', () => {
    const env = { ...cleanEnv(), ...DEVELOPER_ID, ...apiKey() }
    const result = spawnSync(join(ROOT, 'scripts', 'package'), ['--dry-run', '--strict'], {
      env,
      encoding: 'utf8'
    })
    expect(result.status, result.stderr).toBe(0)
    expect(result.stderr).toContain('Signature Developer ID')
    expect(result.stderr).toContain('notarize=true, dmg.sign=true')
    expect(result.stdout + result.stderr).not.toContain('building')
  })

  it('pnpm package --dry-run --strict refuse une configuration incomplète', () => {
    const result = spawnSync(join(ROOT, 'scripts', 'package'), ['--dry-run', '--strict'], {
      env: { ...cleanEnv(), ...DEVELOPER_ID },
      encoding: 'utf8'
    })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('Certificat sans identifiants de notarisation')
  })
})

describe('notarisation du .dmg (fiche 111)', () => {
  it('soumet, attend, agrafe, puis vérifie avec Gatekeeper (xcrun et spctl simulés)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'notarize-'))
    const calls = join(dir, 'calls.txt')
    for (const tool of ['xcrun', 'spctl']) {
      writeFileSync(join(dir, tool), `#!/bin/sh\necho "${tool} $*" >> "${calls}"\n`)
      chmodSync(join(dir, tool), 0o755)
    }
    const dmg = join(dir, 'Bobine-9.9.9-arm64.dmg')
    writeFileSync(dmg, '')
    const key = fakeKey()
    const result = spawnSync(
      'node',
      [
        '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
        join(ROOT, 'scripts', 'signing.mts'),
        'notarize-dmg',
        dmg
      ],
      {
        env: {
          ...cleanEnv(),
          PATH: `${dir}:${process.env['PATH'] ?? ''}`,
          ...DEVELOPER_ID,
          APPLE_API_KEY: key,
          APPLE_API_KEY_ID: 'KEYID',
          APPLE_API_ISSUER: 'issuer-uuid'
        },
        encoding: 'utf8'
      }
    )
    expect(result.status, result.stderr).toBe(0)
    expect(readFileSync(calls, 'utf8').trim().split('\n')).toEqual([
      `xcrun notarytool submit ${dmg} --key ${key} --key-id KEYID --issuer issuer-uuid --wait`,
      `xcrun stapler staple ${dmg}`,
      `xcrun stapler validate ${dmg}`,
      `spctl --assess --type open --context context:primary-signature -vv ${dmg}`
    ])
  })

  it('refuse sans certificat ni identifiants', () => {
    const dmg = join(mkdtempSync(join(tmpdir(), 'notarize-')), 'Bobine.dmg')
    writeFileSync(dmg, '')
    const result = spawnSync(
      'node',
      [
        '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
        join(ROOT, 'scripts', 'signing.mts'),
        'notarize-dmg',
        dmg
      ],
      { env: { PATH: process.env['PATH'] }, encoding: 'utf8' }
    )
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('Pas de certificat')
  })
})
