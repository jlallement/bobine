/**
 * Préparation des tests de composants (fiche 043) : jsdom n'a ni `scrollIntoView` (menus) ni
 * l'API du preload ; un composant qui appellerait autre chose de `window.api` échoue, et c'est
 * voulu (le test doit alors fournir ce dont il a besoin). Interface en français (fiche 074).
 */
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { resetPlans } from './components/thread/merge-plan-store'
import { resetFileChecks } from './components/thread/file-checks'
import { initI18n } from './i18n'

Element.prototype.scrollIntoView = () => {}
window.api = {
  usage: {
    stats: async () => new Promise(() => {}),
    spends: async () => [],
    hasAny: async () => false,
    quotas: async () => [],
    refreshQuota: async () => [],
    onQuotasChanged: () => () => {}
  },
  files: { pathFor: () => '' },
  worktree: { info: async () => null, orphans: async () => [], onForge: () => () => {} },
  // Fin de tour d'un agent : relit la barre du worktree (fiche 176, D15).
  agent: { onEvent: () => () => {} },
  // Suivi de la PR (fiche 176) : pas de `gh`, pas de carte.
  pr: { status: async () => ({ status: 'unavailable' }), onChanged: () => () => {} },
  // Aucun éditeur installé (fiche 156) : pas de « Ouvrir dans… ».
  editors: { list: async () => [] },
  // Message de commit (fiche 246) : réglage coupé par défaut, le repli déduit des fichiers ; un
  // test qui essaie la rédaction par l'agent remplace `draft`.
  commit: {
    draft: async (_id: string, request: { files: { path: string; status: string }[] }) => {
      const { fallbackCommitMessage } = await import('@shared/commit-draft')
      return {
        source: 'fallback',
        reason: 'disabled',
        message: fallbackCommitMessage(request.files as never)
      }
    },
    stop: async () => undefined
  },
  // Avis de nouvelle version (fiche 274) : rien de connu, pas de ligne dans la barre latérale.
  app: {
    update: async () => ({
      current: '1.0.0',
      enabled: true,
      lastCheckedAt: null,
      checking: false,
      available: null,
      dismissed: false,
      manual: null
    }),
    onUpdate: () => () => {}
  },
  // Profil (fiche 196) : rien à dire, corbeille vide.
  profile: {
    status: async () => ({ readOnly: false, notices: [] }),
    onChanged: () => () => {},
    trash: async () => []
  }
} as unknown as Window['api']
// Textes de l'interface en français, comme dans l'app par défaut (fiche 074).
initI18n('fr')

afterEach(() => cleanup())
// Plans de fusion partagés entre cartes (fiche 264) : chaque essai lit les siens.
afterEach(() => {
  resetPlans()
  resetFileChecks()
})
