/**
 * SDK Android de la machine (fiche 032) : indispensable pour développer sur Android, il fournit tout
 * ce dont l'app a besoin (`adb`, `emulator`, `aapt2`). Trouvé même hors du PATH, là où Android Studio
 * l'installe.
 */
import { existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { posix, win32 } from 'node:path'

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

/** Ce que la recherche du SDK lit de la machine (remplacé en essai). */
export interface SdkMachine {
  platform: NodeJS.Platform
  home: string
  exists: (path: string) => boolean
  list: (dir: string) => string[]
}

const MACHINE: SdkMachine = {
  platform: process.platform,
  home: homedir(),
  exists: existsSync,
  list: (dir) => readdirSync(dir)
}

/**
 * SDK Android de la machine. macOS et Linux : comme avant (`ANDROID_HOME`, `ANDROID_SDK_ROOT`, puis
 * `~/Library/Android/sdk`). Windows (fiche 229) : les mêmes variables, puis le dossier d'Android
 * Studio (`%LOCALAPPDATA%\Android\Sdk`) ; programmes en `.exe`, Java d'Android Studio sous
 * `%ProgramFiles%\Android\Android Studio\jbr`.
 */
export function findAndroidSdk(
  env: NodeJS.ProcessEnv = process.env,
  machine: SdkMachine = MACHINE
): AndroidSdk | undefined {
  const windows = machine.platform === 'win32'
  const { join } = windows ? win32 : posix
  const exe = windows ? '.exe' : ''
  const local = env['LOCALAPPDATA'] || join(machine.home, 'AppData', 'Local')
  const candidates = [
    env['ANDROID_HOME'],
    env['ANDROID_SDK_ROOT'],
    windows ? join(local, 'Android', 'Sdk') : join(machine.home, 'Library/Android/sdk')
  ].filter((p): p is string => !!p)
  const root = candidates.find((p) => machine.exists(join(p, 'platform-tools', `adb${exe}`)))
  if (!root) return undefined
  let aapt2: string | undefined
  try {
    const versions = machine
      .list(join(root, 'build-tools'))
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
    aapt2 = versions
      .map((v) => join(root, 'build-tools', v, `aapt2${exe}`))
      .find((p) => machine.exists(p))
  } catch {
    // Pas de build-tools : le nom du paquet d'un APK devra être donné.
  }
  const studioJava = windows
    ? join(env['ProgramFiles'] || 'C:\\Program Files', 'Android', 'Android Studio', 'jbr')
    : STUDIO_JAVA
  return {
    root,
    adb: join(root, 'platform-tools', `adb${exe}`),
    emulator: join(root, 'emulator', `emulator${exe}`),
    ...(aapt2 ? { aapt2 } : {}),
    ...(env['JAVA_HOME']
      ? { javaHome: env['JAVA_HOME'] }
      : machine.exists(studioJava)
        ? { javaHome: studioJava }
        : {})
  }
}
