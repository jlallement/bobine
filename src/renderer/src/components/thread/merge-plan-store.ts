/**
 * Plan de fusion partagé par les cartes d'une même conversation (fiche 264, revue QA) : une seule
 * lecture des branches (`children:mergePlan`) par mère et par état, quel que soit le nombre de
 * cartes de groupe ou de travail affichées ; chaque carte en garde ses travaux (`planFor`).
 */
import type { ChildrenMergePlan } from '@shared/children-merge'

interface Entry {
  /** Lecture en cours ou faite pour cet état. */
  pending?: Promise<void>
  plan?: ChildrenMergePlan
  failed?: true
  /** À relire : son plan reste montré jusqu'à la nouvelle lecture (pas de pied qui clignote). */
  stale?: true
}

/** États gardés par mère (cartes, « Sous-tâches », vue « Filles », états qui passent). */
const KEPT = 16
const store = new Map<string, Map<string, Entry>>()
/** Dernier plan lu de chaque mère, quel que soit l'état : montré le temps d'une nouvelle lecture. */
const latest = new Map<string, ChildrenMergePlan>()
const listeners = new Set<() => void>()
let version = 0

const notify = () => {
  version++
  for (const listener of listeners) listener()
}

export function subscribePlans(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Change à chaque plan lu (pour `useSyncExternalStore`). */
export const plansVersion = (): number => version

/**
 * Le plan lu pour cet état (`exact`), sinon le dernier lu de cette mère, le temps que celui-ci le
 * soit : la carte ne clignote pas entre deux états ; `undefined` si rien n'est lu (ou illisible).
 */
export function readPlan(
  motherId: string,
  key: string
): { plan: ChildrenMergePlan; exact: boolean } | undefined {
  const entry = store.get(motherId)?.get(key)
  if (entry?.plan) return { plan: entry.plan, exact: true }
  if (entry?.failed) return undefined
  const last = latest.get(motherId)
  return last ? { plan: last, exact: false } : undefined
}

/** Lit le plan de cet état, une seule fois pour toutes les cartes qui le demandent. */
export function loadPlan(
  motherId: string,
  key: string,
  read: (motherId: string) => Promise<ChildrenMergePlan>
): void {
  const entries = store.get(motherId) ?? new Map<string, Entry>()
  store.set(motherId, entries)
  const found = entries.get(key)
  if (found && !found.stale) return
  const entry: Entry = found ?? {}
  delete entry.stale
  entries.set(key, entry)
  while (entries.size > KEPT) {
    const oldest = entries.keys().next().value
    if (oldest === undefined) break
    entries.delete(oldest)
  }
  entry.pending = read(motherId).then(
    (plan) => {
      entry.plan = plan
      latest.set(motherId, plan)
      delete entry.failed
      notify()
    },
    // Branches illisibles : pas de pied de carte.
    () => {
      delete entry.plan
      entry.failed = true
      notify()
    }
  )
}

/** Relire les branches de cette mère (après « Abandonner », une fusion lancée…). */
export function forgetPlans(motherId: string): void {
  const entries = store.get(motherId)
  if (!entries?.size) return
  for (const entry of entries.values()) entry.stale = true
  notify()
}

/** Pour les essais : tout oublier. */
export function resetPlans(): void {
  store.clear()
  latest.clear()
  notify()
}

/**
 * Le plan d'une carte : ses travaux seulement, dans l'ordre de ses lignes, et les recouvrements
 * entre eux ; la base et le refus d'avance (dossier principal) restent ceux du dépôt.
 */
export function planFor(plan: ChildrenMergePlan, ids: readonly string[]): ChildrenMergePlan {
  const children = ids.flatMap((id) => plan.children.find((c) => c.id === id) ?? [])
  const titles = new Set(children.map((c) => c.title))
  return {
    ...plan,
    children,
    overlaps: plan.overlaps.filter((o) => titles.has(o.first) && titles.has(o.second))
  }
}
