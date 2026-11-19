import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const alias = { '@shared': resolve(__dirname, 'src/shared') }

/**
 * Parcours `concurrent` joués en même temps dans un fichier : les grilles de conformité (fiche 139)
 * et `limits.test.ts`, seuls à s'en servir. Chacun lance de 1 à 3 agents node ; avec le défaut de
 * vitest (5) et les trois grilles en même temps, une machine de 4 cœurs en avait jusqu'à 15
 * parcours (45 agents) à la fois. Relevé sur `windows-latest` (fiche 229, lot 7a) : sur un passage
 * lent (43784163592), les grilles prenaient 26 à 32 s contre 10 à 13 s (43783452672), 13 tours sur
 * 62 dépassaient 2 s (jusqu'à 10,8 s), et « reprise après redémarrage » dépassait ses 20 s. Une
 * file d'attente, pas un délai : un parcours ne compte son délai qu'à son départ. Mêmes valeurs
 * sur les trois systèmes.
 */
const CONCURRENT_JOURNEYS = 2

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
        'src/shared/i18n/test-setup.ts',
        'src/main/test-setup.ts'
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
          maxConcurrency: CONCURRENT_JOURNEYS,
          setupFiles: ['src/shared/i18n/test-setup.ts', 'src/main/test-setup.ts']
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
          setupFiles: ['src/renderer/src/test-setup.ts'],
          // Crochets « après » dans l'ordre où ils sont écrits (QUA-1/2, fiche 250) : le
          // `cleanup()` de Testing Library (test-setup.ts, posé en premier) démonte les composants
          // AVANT que l'`afterEach` d'un fichier ne rende `window.api` d'origine. Avec l'ordre par
          // défaut (« stack », le plus récent d'abord), 120 essais de 20 fichiers démontaient
          // leurs composants avec l'API déjà restaurée : leurs effets de fin appelaient la mauvaise.
          sequence: { hooks: 'list' }
        }
      }
    ]
  }
})
