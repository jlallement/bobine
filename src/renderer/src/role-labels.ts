import type { RoleView } from '@shared/roles'
import type { TranscriptItem } from '@shared/transcript'
import { withoutCardedRefusal } from '@shared/transcript-notice'

/**
 * Libellés des rôles fournis dans la langue de l'interface (fiche 272, recette : « Expert
 * sécurité » restait dans les bulles après le passage en anglais). Le fil garde le libellé du
 * lancement ; pour un rôle fourni, celui du moment le remplace à l'affichage. Les rôles personnels
 * ou de projet gardent le leur (l'utilisateur l'a écrit, dans sa langue).
 */
export function builtinLabels(roles: readonly Pick<RoleView, 'name' | 'label' | 'scope'>[]) {
  return new Map(roles.filter((r) => r.scope === 'builtin').map((r) => [r.name, r.label]))
}

type Badge = { name: string; label: string }

function relabel<B extends Badge>(badge: B, labels: ReadonlyMap<string, string>): B {
  const label = labels.get(badge.name)
  return label && label !== badge.label ? { ...badge, label } : badge
}

/** Le fil avec les libellés du moment ; le même tableau si rien ne change. */
export function relabelRoles(
  items: TranscriptItem[],
  labels: ReadonlyMap<string, string>
): TranscriptItem[] {
  if (labels.size === 0) return items
  let changed = false
  const out = items.map((item) => {
    if (item.kind === 'child-started' && item.role) {
      const role = relabel(item.role, labels)
      if (role === item.role) return item
      changed = true
      return { ...item, role }
    }
    if (item.kind === 'role-request') {
      const works = item.works.map((w) => {
        const role = relabel(w.role, labels)
        return role === w.role ? w : { ...w, role }
      })
      if (works.every((w, i) => w === item.works[i])) return item
      changed = true
      return { ...item, works }
    }
    return item
  })
  return changed ? out : items
}

const NO_LABELS: ReadonlyMap<string, string> = new Map()

/** Fil affiché : sans le refus déjà en carte, libellés des rôles fournis du moment (fiche 272). */
export function threadItems(
  items: TranscriptItem[],
  snapshot: Parameters<typeof withoutCardedRefusal>[1],
  labels: ReadonlyMap<string, string> = NO_LABELS
): TranscriptItem[] {
  return relabelRoles(withoutCardedRefusal(items, snapshot), labels)
}
