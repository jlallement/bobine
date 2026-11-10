/**
 * Date et commit du build (fiche 116), injectés par `define` d'electron-vite
 * (`electron.vite.config.ts`). Hors build (tests) : date du jour et « dev ».
 */
export interface BuildInfo {
  /** Jour du build, `AAAA-MM-JJ` (heure locale de la machine qui a construit). */
  date: string
  /** Commit court ; `dev` en développement, `unknown` hors dépôt git. */
  commit: string
}

declare const __BOBINE_BUILD__: BuildInfo | undefined

const today = (now: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function buildInfo(now = new Date()): BuildInfo {
  return typeof __BOBINE_BUILD__ === 'undefined'
    ? { date: today(now), commit: 'dev' }
    : __BOBINE_BUILD__
}
