import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { bundledPackages } from './scripts/third-party/bundled-plugin.mts'

const shared = { '@shared': resolve(__dirname, 'src/shared') }
/** Inventaire des paquets tiers de chaque build, pour les avis de licence (fiche 217). */
const thirdParty = resolve(__dirname, 'out/third-party')

/** Jour local `AAAA-MM-JJ`. */
const today = (): string => {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Commit court du dépôt ; `unknown` hors dépôt git (archive des sources). */
const commit = (): string => {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: __dirname })
      .toString()
      .trim()
  } catch {
    return 'unknown'
  }
}

export default defineConfig(({ command }) => ({
  main: {
    resolve: { alias: shared },
    plugins: [bundledPackages('main', thirdParty)],
    // Date et commit du build, pour la fenêtre À propos (fiche 116) ; `pnpm dev` : « dev ».
    define: {
      __BOBINE_BUILD__: JSON.stringify({
        date: today(),
        commit: command === 'serve' ? 'dev' : commit()
      })
    }
  },
  preload: {
    resolve: { alias: shared },
    plugins: [bundledPackages('preload', thirdParty)]
  },
  renderer: {
    resolve: { alias: shared },
    plugins: [react(), bundledPackages('renderer', thirdParty)]
  }
}))
