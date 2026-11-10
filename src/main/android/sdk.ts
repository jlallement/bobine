/**
 * SDK Android de la machine (fiche 032) : indispensable pour développer sur Android, il fournit tout
 * ce dont l'app a besoin (`adb`, `emulator`, `aapt2`). Trouvé même hors du PATH, là où Android Studio
 * l'installe.
 */
import { existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export interface AndroidSdk {
  root: string
  adb: string
  emulator: string
  /** `aapt2` de la version la plus récente des build-tools, s'il y en a. */
  aapt2?: string
  /** Java d'Android Studio, pour Gradle quand `JAVA_HOME` n'est pas défini. */
  javaHome?: string
}

const STUDIO_JAVA = '/Applications/Android Studio.app/Contents/jbr/Contents/Home'

export function findAndroidSdk(env: NodeJS.ProcessEnv = process.env): AndroidSdk | undefined {
  const candidates = [
    env['ANDROID_HOME'],
    env['ANDROID_SDK_ROOT'],
    join(homedir(), 'Library/Android/sdk')
  ].filter((p): p is string => !!p)
  const root = candidates.find((p) => existsSync(join(p, 'platform-tools', 'adb')))
  if (!root) return undefined
  let aapt2: string | undefined
  try {
    const versions = readdirSync(join(root, 'build-tools')).sort((a, b) =>
      b.localeCompare(a, undefined, { numeric: true })
    )
    aapt2 = versions.map((v) => join(root, 'build-tools', v, 'aapt2')).find((p) => existsSync(p))
  } catch {
    // Pas de build-tools : le nom du paquet d'un APK devra être donné.
  }
  return {
    root,
    adb: join(root, 'platform-tools', 'adb'),
    emulator: join(root, 'emulator', 'emulator'),
    ...(aapt2 ? { aapt2 } : {}),
    ...(env['JAVA_HOME']
      ? { javaHome: env['JAVA_HOME'] }
      : existsSync(STUDIO_JAVA)
        ? { javaHome: STUDIO_JAVA }
        : {})
  }
}
