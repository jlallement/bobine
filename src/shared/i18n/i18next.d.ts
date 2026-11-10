/**
 * Clés de traduction typées à partir de `fr.json` (ADR-0014) : une clé qui n'existe pas, ou une
 * variable mal nommée, ne compile pas, dans le main comme dans le renderer. Le type exact du
 * fichier est écrit par `scripts/i18n-types.mts` (lancé par `pnpm typecheck`).
 */
import 'i18next'
import type { FrResources } from './fr.generated'

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation'
    resources: { translation: FrResources }
  }
}
