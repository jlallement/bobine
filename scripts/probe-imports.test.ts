/**
 * Garde-fou des sondes (`pnpm bob-probe`, `pnpm opencode-probe`) : elles tournent sous Node sans
 * bundler, donc chaque import relatif de leur graphe doit porter son extension (`./x.ts`). Un
 * import sans extension passe le typecheck et les tests (Vite le résout) mais arrête la sonde sur
 * ERR_MODULE_NOT_FOUND (régression de la fiche 182, `log-redact.ts` → `./secret-scan`).
 *
 * L'essai charge, dans un Node nu, tous les modules du dépôt qu'importent les sondes — sans lancer
 * les sondes elles-mêmes (ni agent, ni réseau, ni modèle).
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const PROBES = ['bob-probe.mts', 'opencode-probe.mts']

/** Modules du dépôt importés par une sonde (imports relatifs, types exclus). */
function repoImports(probe: string): string[] {
  const source = readFileSync(resolve(here, probe), 'utf8')
  const specs = [...source.matchAll(/^import\s+(?!type\b)[^'"]*?from\s+'(\.[^']+)'/gms)]
  return specs.map((m) => resolve(here, m[1] ?? ''))
}

describe('sondes chargées sans bundler', () => {
  for (const probe of PROBES) {
    it(`${probe} : tout son graphe d'imports se charge dans Node`, () => {
      const modules = repoImports(probe)
      expect(modules.length).toBeGreaterThan(0)
      const script = modules
        .map((file) => `await import(${JSON.stringify(pathToFileURL(file).href)})`)
        .join(';')
      const run = () =>
        execFileSync(
          process.execPath,
          ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', '--input-type=module', '-e', script],
          { cwd: resolve(here, '..'), encoding: 'utf8', stdio: 'pipe', timeout: 60_000 }
        )
      expect(run).not.toThrow()
    }, 60_000)
  }
})
