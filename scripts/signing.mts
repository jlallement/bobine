/**
 * Signature et notarisation de l'app (fiches 012 et 111) : ce que `pnpm package` fait selon les
 * variables d'environnement présentes. Sans certificat désigné, signature ad hoc, exactement comme
 * avant la fiche 111 ; avec un certificat « Developer ID Application » et des identifiants Apple,
 * signature, runtime durci, notarisation et agrafage de l'app (electron-builder) puis du `.dmg`
 * (ici). Aucune valeur secrète n'est jamais affichée : seulement les noms des variables.
 *
 *   node scripts/signing.mts plan [--strict]          variables pour scripts/package (eval)
 *   node scripts/signing.mts check [--strict]         essai à blanc : configuration lue, rien signé
 *   node scripts/signing.mts notarize-dmg <dmg>       notarise, agrafe et vérifie le .dmg
 *
 * `--strict` (release.yml) : une configuration incomplète est une erreur, pas un avertissement.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

export type Env = Record<string, string | undefined>

/** Certificat désigné : par son nom dans le trousseau, ou un fichier .p12 (CI). */
export type Certificate = { source: 'CSC_NAME' } | { source: 'CSC_LINK' }

/** Identifiants de notarisation, dans l'ordre où electron-builder les essaie. */
export type Notary =
  | { kind: 'apple-id'; appleId: string; password: string; teamId: string }
  | { kind: 'api-key'; key: string; keyId: string; issuer: string }
  | { kind: 'keychain-profile'; profile: string; keychain?: string }

/** Surcharges de `electron-builder.yml`, passées en `-c.<chemin>=<valeur>`. */
export interface Overrides {
  mac?: { identity?: '-'; notarize?: true }
  dmg?: { sign?: true }
}

export interface SigningPlan {
  /** Absent : signature ad hoc. */
  certificate?: Certificate
  /** Absent : pas de notarisation. */
  notary?: Notary
  overrides: Overrides
  /** Variables à poser pour electron-builder. */
  env: Record<string, string>
  /**
   * Variables présentes mais vides (secrets GitHub non posés), à effacer avant electron-builder :
   * pour lui, `CSC_LINK=""` est un certificat désigné, et il échoue sur « not a file ».
   */
  unset: string[]
  errors: string[]
  warnings: string[]
}

/** Jeux de variables de notarisation, dans l'ordre de priorité d'electron-builder 26. */
const NOTARY_SETS = [
  { kind: 'apple-id', names: ['APPLE_ID', 'APPLE_APP_SPECIFIC_PASSWORD', 'APPLE_TEAM_ID'] },
  { kind: 'api-key', names: ['APPLE_API_KEY', 'APPLE_API_KEY_ID', 'APPLE_API_ISSUER'] },
  { kind: 'keychain-profile', names: ['APPLE_KEYCHAIN_PROFILE'] }
] as const

const NOTARY_LABELS: Record<Notary['kind'], string> = {
  'apple-id': 'identifiant Apple et mot de passe d’app (APPLE_ID…)',
  'api-key': 'clé d’API App Store Connect (APPLE_API_KEY…)',
  'keychain-profile': 'profil du trousseau (APPLE_KEYCHAIN_PROFILE)'
}

/** Une variable vide (secret GitHub non posé) compte comme absente. */
const value = (env: Env, name: string): string | undefined => env[name]?.trim() || undefined

function notaryOf(env: Env, errors: string[], warnings: string[]): Notary | undefined {
  const complete: Notary[] = []
  for (const set of NOTARY_SETS) {
    const present = set.names.filter((name) => value(env, name))
    if (present.length === 0) continue
    if (present.length < set.names.length) {
      const missing = set.names.filter((name) => !value(env, name))
      errors.push(`Notarisation incomplète : ${present.join(', ')} sans ${missing.join(', ')}`)
      continue
    }
    const v = (name: string) => value(env, name) ?? ''
    if (set.kind === 'apple-id') {
      complete.push({
        kind: 'apple-id',
        appleId: v('APPLE_ID'),
        password: v('APPLE_APP_SPECIFIC_PASSWORD'),
        teamId: v('APPLE_TEAM_ID')
      })
    } else if (set.kind === 'api-key') {
      complete.push({
        kind: 'api-key',
        key: v('APPLE_API_KEY'),
        keyId: v('APPLE_API_KEY_ID'),
        issuer: v('APPLE_API_ISSUER')
      })
    } else {
      const keychain = value(env, 'APPLE_KEYCHAIN')
      complete.push({
        kind: 'keychain-profile',
        profile: v('APPLE_KEYCHAIN_PROFILE'),
        ...(keychain ? { keychain } : {})
      })
    }
  }
  const [first, ...others] = complete
  if (first && others.length > 0) {
    warnings.push(
      `Plusieurs jeux d’identifiants de notarisation : ${NOTARY_LABELS[first.kind]} utilisé`
    )
  }
  if (first?.kind === 'api-key' && !existsSync(first.key)) {
    errors.push('APPLE_API_KEY doit être le chemin du fichier .p8 : fichier introuvable')
  }
  return first
}

/** Variables de certificat qu'electron-builder lit lui-même, même vides. */
const CERTIFICATE_VARIABLES = ['CSC_NAME', 'CSC_LINK', 'CSC_KEY_PASSWORD']

/** Ce que `pnpm package` fera de ces variables. */
export function signingPlan(env: Env, { strict = false } = {}): SigningPlan {
  const errors: string[] = []
  const warnings: string[] = []
  const certificate: Certificate | undefined = value(env, 'CSC_NAME')
    ? { source: 'CSC_NAME' }
    : value(env, 'CSC_LINK')
      ? { source: 'CSC_LINK' }
      : undefined
  if (certificate?.source === 'CSC_LINK' && !value(env, 'CSC_KEY_PASSWORD')) {
    warnings.push('CSC_LINK sans CSC_KEY_PASSWORD : le .p12 doit alors être sans mot de passe')
  }
  const notary = notaryOf(env, errors, warnings)
  // Les avertissements qui suivent sont des erreurs pour une version publiée (--strict) : un .dmg
  // signé mais pas notarisé, ou notarisable mais signé ad hoc, reste bloqué par macOS.
  const soft = strict ? errors : warnings
  if (!certificate && notary) {
    soft.push(
      'Identifiants de notarisation sans certificat (CSC_NAME ou CSC_LINK) : ignorés, signature ad hoc'
    )
  }
  if (certificate && !notary) {
    soft.push(
      'Certificat sans identifiants de notarisation : l’app téléchargée restera bloquée par macOS'
    )
  }
  if (!certificate) {
    // Jamais un certificat pris au hasard dans le trousseau (ADR-0008).
    return {
      overrides: { mac: { identity: '-' } },
      env: { CSC_IDENTITY_AUTO_DISCOVERY: 'false' },
      unset: CERTIFICATE_VARIABLES.filter((name) => name in env),
      errors,
      warnings
    }
  }
  return {
    certificate,
    ...(notary ? { notary } : {}),
    overrides: notary ? { mac: { notarize: true }, dmg: { sign: true } } : {},
    env: {},
    unset: [],
    errors,
    warnings
  }
}

/** `{ mac: { identity: '-' } }` → `['-c.mac.identity=-']`, la forme de la ligne de commande. */
export function cliArgs(overrides: Overrides, prefix = '-c'): string[] {
  return Object.entries(overrides).flatMap(([key, child]) =>
    typeof child === 'object' && child !== null
      ? cliArgs(child as Overrides, `${prefix}.${key}`)
      : [`${prefix}.${key}=${String(child)}`]
  )
}

/** Résumé lisible du plan (aucune valeur secrète). */
export function describe(plan: SigningPlan): string[] {
  const lines = [
    plan.certificate
      ? `Signature Developer ID (${plan.certificate.source === 'CSC_NAME' ? 'certificat du trousseau, CSC_NAME' : 'certificat .p12, CSC_LINK'})`
      : 'Signature ad hoc (aucun certificat désigné)',
    'Runtime durci, droits de build/entitlements.mac.plist'
  ]
  if (plan.notary) {
    lines.push(`Notarisation : ${NOTARY_LABELS[plan.notary.kind]}`)
    lines.push('Agrafage : l’app, puis le .dmg signé')
  }
  return lines
}

/** Variables pour `eval` dans scripts/package (valeurs fixes, jamais un secret). */
export function shellAssignments(plan: SigningPlan): string {
  return [
    ...(plan.unset.length > 0 ? [`unset ${plan.unset.join(' ')}`] : []),
    ...Object.entries(plan.env).map(([name, val]) => `export ${name}=${val}`),
    `signing_args=(${cliArgs(plan.overrides).join(' ')})`,
    `notarize_dmg=${plan.notary ? 1 : 0}`
  ].join('\n')
}

/** Arguments d'identification de `xcrun notarytool`. */
export function notarytoolAuth(notary: Notary): string[] {
  switch (notary.kind) {
    case 'apple-id':
      return [
        '--apple-id',
        notary.appleId,
        '--password',
        notary.password,
        '--team-id',
        notary.teamId
      ]
    case 'api-key':
      return ['--key', notary.key, '--key-id', notary.keyId, '--issuer', notary.issuer]
    case 'keychain-profile':
      return [
        '--keychain-profile',
        notary.profile,
        ...(notary.keychain ? ['--keychain', notary.keychain] : [])
      ]
  }
}

/**
 * Droits du runtime durci demandés par l'app : chacun est justifié dans le fichier. Un droit de
 * plus, ou de moins, doit passer par la fiche 111 (et un essai avec un vrai certificat).
 */
export const REQUIRED_ENTITLEMENTS = [
  'com.apple.security.cs.allow-jit',
  'com.apple.security.cs.allow-unsigned-executable-memory',
  'com.apple.security.cs.disable-library-validation'
] as const

/** Clés à `<true/>` d'un plist d'entitlements (format XML de build/). */
export function entitlementKeys(plist: string): string[] {
  return [...plist.matchAll(/<key>([^<]+)<\/key>\s*<true\s*\/>/g)].map((m) => m[1] ?? '')
}

interface BuilderConfig {
  mac?: Record<string, unknown> | null
  dmg?: Record<string, unknown> | null
}

/**
 * Essai à blanc : `electron-builder.yml` et les surcharges du plan lus et validés par le code
 * d'electron-builder lui-même (son chargeur et son schéma), droits vérifiés. Rien n'est construit
 * ni signé. Renvoie la configuration effective de signature.
 */
export async function checkConfiguration(plan: SigningPlan, root = ROOT): Promise<BuilderConfig> {
  const require = createRequire(
    createRequire(join(root, 'package.json')).resolve('electron-builder/package.json')
  )
  const { getConfig, validateConfiguration } =
    require('app-builder-lib/out/util/config/config') as {
      getConfig: (dir: string, path: string, overrides: Overrides) => Promise<BuilderConfig>
      validateConfiguration: (config: BuilderConfig, logger: unknown) => Promise<void>
    }
  const { DebugLogger } = require('builder-util') as {
    DebugLogger: new (enabled: boolean) => unknown
  }
  const config = await getConfig(root, join(root, 'electron-builder.yml'), plan.overrides)
  await validateConfiguration(config, new DebugLogger(false))
  const mac = config.mac ?? {}
  if (mac['hardenedRuntime'] !== true) throw new Error('mac.hardenedRuntime doit rester à true')
  for (const field of ['entitlements', 'entitlementsInherit']) {
    const file = mac[field]
    if (typeof file !== 'string') throw new Error(`mac.${field} manquant`)
    const keys = entitlementKeys(readFileSync(join(root, file), 'utf8'))
    const missing = REQUIRED_ENTITLEMENTS.filter((key) => !keys.includes(key))
    const extra = keys.filter((key) => !(REQUIRED_ENTITLEMENTS as readonly string[]).includes(key))
    if (missing.length > 0 || extra.length > 0) {
      throw new Error(
        `${file} : droits attendus ${REQUIRED_ENTITLEMENTS.join(', ')} (manque : ${missing.join(', ') || '—'} ; en trop : ${extra.join(', ') || '—'})`
      )
    }
  }
  return config
}

function run(command: string, args: string[]): void {
  const result = spawnSync(command, args, { stdio: 'inherit' })
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args
        .filter((a) => !a.startsWith('--'))
        .slice(0, 2)
        .join(' ')} a échoué`
    )
  }
}

/** Notarise le .dmg signé, agrafe le ticket et vérifie ce que Gatekeeper en dira. */
export function notarizeDmg(dmg: string, notary: Notary): void {
  run('xcrun', ['notarytool', 'submit', dmg, ...notarytoolAuth(notary), '--wait'])
  run('xcrun', ['stapler', 'staple', dmg])
  run('xcrun', ['stapler', 'validate', dmg])
  run('spctl', ['--assess', '--type', 'open', '--context', 'context:primary-signature', '-vv', dmg])
}

async function main(argv: string[]): Promise<number> {
  const [command, ...rest] = argv
  const strict = rest.includes('--strict')
  const plan = signingPlan(process.env, { strict })
  const report = () => {
    for (const line of describe(plan)) console.error(`▶ ${line}`)
    for (const warning of plan.warnings) console.error(`⚠ ${warning}`)
    for (const error of plan.errors) console.error(`✗ ${error}`)
  }
  if (command === 'plan') {
    report()
    if (plan.errors.length > 0) return 1
    console.log(shellAssignments(plan))
    return 0
  }
  if (command === 'check') {
    report()
    if (plan.errors.length > 0) return 1
    const config = await checkConfiguration(plan)
    const mac = config.mac ?? {}
    console.error(
      `✓ Configuration lue par electron-builder : identity=${String(mac['identity'] ?? 'certificat désigné')}, hardenedRuntime=${String(mac['hardenedRuntime'])}, notarize=${String(mac['notarize'])}, dmg.sign=${String(config.dmg?.['sign'] ?? false)}`
    )
    console.error(`✓ Droits : ${REQUIRED_ENTITLEMENTS.join(', ')}`)
    return 0
  }
  if (command === 'notarize-dmg') {
    const dmg = rest.find((arg) => !arg.startsWith('--'))
    if (!dmg || !existsSync(dmg)) throw new Error(`.dmg introuvable : ${dmg ?? '(aucun)'}`)
    if (!plan.notary || !plan.certificate)
      throw new Error('Pas de certificat ou d’identifiants de notarisation')
    console.error(`▶ Notarisation de ${basename(dmg)}`)
    notarizeDmg(dmg, plan.notary)
    return 0
  }
  console.error('Usage : node scripts/signing.mts plan|check [--strict] | notarize-dmg <dmg>')
  return 2
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (error: unknown) => {
      console.error(`✗ ${error instanceof Error ? error.message : String(error)}`)
      process.exit(1)
    }
  )
}
