import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const alias = { '@shared': resolve(__dirname, 'src/shared') }

/**
 * Deux projets (fiche 043) : « node » pour le main, le preload, le partagé et l'agent factice ;
 * « renderer » (jsdom + Testing Library) pour les composants React. `pnpm coverage` ajoute le
 * rapport de couverture (texte, et `coverage/` en HTML, ignoré par git).
 */
export default defineConfig({
  resolve: { alias },
  test: {
    globalSetup: ['scripts/vitest-tmp.ts'],
    testTimeout: 15_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.d.ts',
        'src/mock-agent/**',
        'src/renderer/src/main.tsx',
        'src/renderer/src/test-setup.ts',
        'src/shared/i18n/test-setup.ts'
      ],
      reporter: ['text-summary', 'html']
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          // Scripts du dépôt aussi (installation hors ligne, fiche 065 ; pilote en .mjs, fiche 206).
          include: ['src/**/*.test.ts', 'scripts/**/*.test.ts', 'scripts/**/*.test.mjs'],
          exclude: ['src/renderer/**', '**/node_modules/**'],
          environment: 'node',
          setupFiles: ['src/shared/i18n/test-setup.ts']
        }
      },
      {
        extends: true,
        plugins: [react()],
        test: {
          name: 'renderer',
          include: ['src/renderer/**/*.test.{ts,tsx}'],
          environment: 'jsdom',
          // La feuille de style de l'app, lisible par `?raw` (cascade des règles d'une carte,
          // fiche 124) ; les autres CSS restent vides, comme par défaut.
          css: { include: [/src\/renderer\/src\/styles\.css/] },
          setupFiles: ['src/renderer/src/test-setup.ts']
        }
      }
    ]
  }
})
