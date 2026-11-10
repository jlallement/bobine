/**
 * Règles d'approbation « pour tous les projets » sur les cartes de commande (fiche 215) : ce que la
 * conversation affichée en permet (son agent les déclare dans son profil), et ce qui a été écrit
 * depuis une carte, pour le redire sur sa ligne de réponse.
 */
import { createContext, useSyncExternalStore } from 'react'

export interface GlobalRules {
  /** Profil de l'agent de la conversation, qui déclare des règles d'approbation. */
  profileId: string
  /** Ouvre Réglages › Agents › <agent> › Approbations. */
  onManage: () => void
}

/** Absent : pas de section « Pour tous les projets » (agent sans règles, autre fil). */
export const GlobalRulesContext = createContext<GlobalRules | null>(null)

/** Règle écrite depuis une carte : ses préfixes, autorisés ou refusés partout. */
export interface GlobalRuleOutcome {
  kind: 'allowed' | 'denied'
  prefixes: string[]
}

/** En mémoire seulement, par demande d'autorisation : la ligne de réponse le rappelle. */
const outcomes = new Map<string, GlobalRuleOutcome>()
const listeners = new Set<() => void>()

export function recordGlobalRule(requestId: string, outcome: GlobalRuleOutcome): void {
  outcomes.set(requestId, outcome)
  for (const listener of listeners) listener()
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useGlobalRuleOutcome(requestId: string): GlobalRuleOutcome | undefined {
  return useSyncExternalStore(subscribe, () => outcomes.get(requestId))
}

/**
 * Exemples d'un préfixe d'un seul mot qui en dit trop (avertissement « un seul mot ») : des
 * commandes complètes, sans points de suspension. Mot inconnu : pas d'exemple (`undefined`).
 */
const EXAMPLES: Record<string, string> = {
  npm: 'npm publish',
  pnpm: 'pnpm publish',
  yarn: 'yarn publish',
  git: 'git push --force',
  rm: 'rm -rf ~',
  docker: 'docker rm -f',
  python: 'python script.py',
  python3: 'python3 script.py',
  node: 'node script.js',
  bash: 'bash script.sh',
  sh: 'sh install.sh',
  curl: 'curl -o x https://example.com'
}

export const oneWordExample = (word: string): string | undefined => EXAMPLES[word]
