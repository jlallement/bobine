/**
 * Faut-il montrer l'accueil du premier lancement (fiche 188) ? Règle pure, prudente : dans le
 * doute, on ne le montre pas — une personne qui a déjà utilisé Bobine ne le revoit jamais.
 *
 * - Marque `finished` ou `skipped` : jamais.
 * - Marque `pending` (posée au tout premier lancement) : oui, l'accueil reprend.
 * - Pas de marque : oui seulement si rien ne montre un usage passé — pas de `settings.json` avant
 *   ce lancement (un fichier abîmé mis de côté compte comme un usage), aucune conversation, aucun
 *   dossier récent, aucun agent choisi. La marque `pending` est alors à poser tout de suite.
 *   Une Bobine 0.9 qui passe en 0.10 a tout cela : elle ne voit pas l'accueil.
 * - Essais (dossier de données imposé) : jamais, sauf `BOBINE_ONBOARDING=1`, pour que les suites
 *   existantes ne le voient pas ; le profil temporaire (« comme neuve », fiche 148) le voit.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { OnboardingMark } from '@shared/onboarding'

export interface OnboardingFacts {
  mark: OnboardingMark | undefined
  /** `settings.json` existait avant ce lancement (lisible ou non). */
  settingsExisted: boolean
  /** Au moins une conversation dans l'historique. */
  hasConversations: boolean
  recentWorkspaces: number
  /** Un agent a déjà été choisi (`profileId` des réglages). */
  profileChosen: boolean
  /** Dossier de données imposé par les essais (`--user-data-dir`), hors profil temporaire. */
  testRun: boolean
  env: NodeJS.ProcessEnv
  /** Profil en lecture seule (fiche 196) : rien ne s'y écrirait, pas même la marque d'accueil. */
  readOnly?: boolean
}

export interface OnboardingDecision {
  due: boolean
  /** Marque à enregistrer tout de suite (`pending`, premier lancement). */
  write?: OnboardingMark
}

export function onboardingDecision(
  facts: OnboardingFacts,
  now: Date,
  version: string
): OnboardingDecision {
  if (facts.readOnly) return { due: false }
  if (facts.testRun && facts.env['BOBINE_ONBOARDING'] !== '1') return { due: false }
  const { mark } = facts
  if (mark) return { due: mark.outcome === 'pending' }
  const used =
    facts.settingsExisted ||
    facts.hasConversations ||
    facts.recentWorkspaces > 0 ||
    facts.profileChosen
  if (used) return { due: false }
  return { due: true, write: { outcome: 'pending', at: now.toISOString(), version } }
}

/**
 * Marque de fin : `finished` ou `skipped`, jamais défaite. Une marque déjà finale reste telle
 * quelle (un second « Passer » ne réécrit rien).
 */
export function closingMark(
  current: OnboardingMark | undefined,
  outcome: 'finished' | 'skipped',
  now: Date,
  version: string
): OnboardingMark {
  if (current && current.outcome !== 'pending') return current
  return { outcome, at: now.toISOString(), version }
}

/**
 * Y a-t-il des conversations dans ce dossier ? Prudent : un index illisible ou un fichier inconnu
 * comptent comme un usage passé. Seuls « dossier absent », « vide » et un index `[]` disent non.
 */
export function hasConversations(dir: string): boolean {
  let entries: string[]
  try {
    entries = readdirSync(dir).filter((name) => !name.startsWith('.'))
  } catch {
    return false
  }
  if (entries.some((name) => name !== 'index.json' && name !== 'index.json.bak')) return true
  if (!entries.includes('index.json')) return false
  try {
    const index: unknown = JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8'))
    return !Array.isArray(index) || index.length > 0
  } catch {
    return true
  }
}
