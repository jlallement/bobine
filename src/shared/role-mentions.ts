/**
 * `@rôle` dans la saisie (fiche 223, phase 3B), sans processus ni interface : recherche d'un rôle
 * dans le menu `@` et analyse d'un message (rôles cités, texte qui part aux filles).
 *
 * Un rôle choisi dans le menu devient un jeton à part du texte ; un `@nom` tapé en entier compte
 * aussi, s'il nomme un rôle actif. Un `@mot` qui ne nomme aucun rôle reste du texte (fichier,
 * adresse, `@git-changes`…).
 */
import type { RoleDefinition } from './roles'

/** Texte comparable : minuscules, sans accents (« @secu » trouve « Expert sécu »). */
export function searchable(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

type Searchable = Pick<RoleDefinition, 'name' | 'label' | 'description'>

/**
 * Rôles qui correspondent à ce qui est tapé après `@` : d'abord ceux dont le nom ou un mot du
 * libellé commence par la recherche, puis ceux dont la description la contient (sauf
 * `descriptions: false`). Recherche vide : tous, dans l'ordre reçu.
 */
export function matchRoles<T extends Searchable>(
  roles: readonly T[],
  query: string,
  options: { descriptions?: boolean; describe?: (role: T) => string } = {}
): T[] {
  const describe = options.describe ?? ((role: T) => role.description)
  const q = searchable(query.trim())
  if (!q) return [...roles]
  const byName = roles.filter(
    (r) =>
      searchable(r.name).startsWith(q) ||
      searchable(r.label)
        .split(/[\s/-]+/)
        .some((word) => word.startsWith(q)) ||
      searchable(r.label).startsWith(q)
  )
  if (options.descriptions === false) return byName
  const byDescription = roles.filter(
    (r) => !byName.includes(r) && searchable(describe(r)).includes(q)
  )
  return [...byName, ...byDescription]
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * `@nom` des rôles connus dans un texte, dans l'ordre où ils apparaissent, et le texte sans eux
 * (blancs resserrés). Les `@mot` inconnus restent dans le texte.
 */
export function splitRoleMentions(
  text: string,
  roles: readonly Pick<RoleDefinition, 'name'>[]
): { names: string[]; text: string } {
  const found: { name: string; at: number }[] = []
  let rest = text
  for (const role of roles) {
    const pattern = new RegExp(`(^|[\\s(])@${escape(role.name)}(?![\\w-])`, 'g')
    let match: RegExpExecArray | null
    while ((match = pattern.exec(text))) {
      found.push({ name: role.name, at: match.index + (match[1]?.length ?? 0) })
    }
    rest = rest.replace(pattern, '$1')
  }
  const names = [...new Set(found.sort((a, b) => a.at - b.at).map((f) => f.name))]
  if (names.length === 0) return { names, text }
  return {
    names,
    text: rest
      .split('\n')
      .map((line) => line.replace(/[ \t]{2,}/g, ' ').trim())
      .join('\n')
      .trim()
  }
}

/**
 * À qui part un message : les jetons posés (menu `@`) puis les `@nom` tapés, sans doublon, et la
 * demande sans eux. Aucun rôle : le message part à la conversation, tel quel.
 */
export function roleRecipients(
  tokens: readonly string[],
  text: string,
  roles: readonly Pick<RoleDefinition, 'name'>[]
): { names: string[]; text: string } {
  const known = new Set(roles.map((r) => r.name))
  const typed = splitRoleMentions(text, roles)
  const names = [...new Set([...tokens.filter((t) => known.has(t)), ...typed.names])]
  return { names, text: names.length ? typed.text : text }
}
