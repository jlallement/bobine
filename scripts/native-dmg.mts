/** DMG simple, sans auxiliaire téléchargé (fiche 153, ADR-0034). */
import { execFileSync } from 'node:child_process'
import { appendFileSync, mkdirSync, mkdtempSync, renameSync, rmSync, symlinkSync } from 'node:fs'
import { createRequire } from 'node:module'
import { basename, dirname, join } from 'node:path'
import type { AfterPackContext, MacPackager } from 'electron-builder'

type Run = (command: string, args: string[]) => void
const runNative: Run = (command, args) => {
  execFileSync(command, args, { stdio: 'inherit' })
}

interface DmgOptions {
  app: string
  destination: string
  volume: string
  sign?: (image: string) => Promise<void>
}

/** Ne remplace le livrable précédent qu’une fois l’image créée, signée et vérifiée. */
export async function createDmg(options: DmgOptions, run: Run = runNative): Promise<void> {
  const { app, destination, volume, sign } = options
  const output = dirname(destination)
  mkdirSync(output, { recursive: true })
  const temporary = mkdtempSync(join(output, '.bobine-dmg-'))
  try {
    const contents = join(temporary, 'contents')
    mkdirSync(contents)
    // ditto garde les métadonnées et les liens des frameworks signés de l’app.
    run('ditto', [app, join(contents, basename(app))])
    symlinkSync('/Applications', join(contents, 'Applications'))
    const image = join(temporary, 'Bobine.dmg')
    run('hdiutil', [
      'create',
      '-volname',
      volume,
      '-srcfolder',
      contents,
      '-fs',
      'HFS+',
      '-format',
      'UDZO',
      image
    ])
    if (sign) await sign(image)
    run('hdiutil', ['verify', image])
    renameSync(image, destination)
  } finally {
    rmSync(temporary, { recursive: true, force: true })
  }
}

type FindIdentity = (
  type: string,
  qualifier?: string | null,
  keychain?: string | null
) => Promise<{ hash?: string } | null>

const findSigningIdentity: FindIdentity = async (...args) => {
  const require = createRequire(createRequire(import.meta.url).resolve('electron-builder'))
  const { findIdentity } = require('app-builder-lib/out/codeSign/macCodeSign') as {
    findIdentity: FindIdentity
  }
  return findIdentity(...args)
}

/** Même sélection d’identité que le DMG d’electron-builder ; aucun nouveau trousseau. */
export async function signDmg(
  packager: MacPackager,
  image: string,
  run: Run = runNative,
  findIdentity: FindIdentity = findSigningIdentity
): Promise<void> {
  const { keychainFile } = await packager.codeSigningInfo.value
  const identity = await findIdentity(
    'Developer ID Application',
    packager.platformSpecificBuildOptions.identity,
    keychainFile
  )
  if (!identity?.hash) throw new Error('Identité Developer ID introuvable pour signer le DMG')
  run('codesign', [
    '--sign',
    identity.hash,
    ...(keychainFile ? ['--keychain', keychainFile] : []),
    image
  ])
  run('codesign', ['--verify', '--strict', image])
}

/** Appelé après la signature/notarisation de l’app, avant le nettoyage de son trousseau. */
export default async function afterSign(context: AfterPackContext): Promise<void> {
  const manifest = process.env['BOBINE_DMG_MANIFEST']
  if (!manifest || context.electronPlatformName !== 'darwin') return
  const packager = context.packager as MacPackager
  const config = packager.config.dmg ?? {}
  const name = packager.expandArtifactNamePattern(
    config,
    'dmg',
    context.arch,
    '${productName}-${version}-${arch}.${ext}',
    true
  )
  const destination = join(context.outDir, name)
  const app = join(context.appOutDir, `${packager.appInfo.productFilename}.app`)
  await createDmg({
    app,
    destination,
    volume: packager.appInfo.productName,
    ...(config.sign ? { sign: (image: string) => signDmg(packager, image) } : {})
  })
  appendFileSync(manifest, destination + '\n')
  console.log(`✓ DMG créé avec les outils de macOS : ${destination}`)
}
