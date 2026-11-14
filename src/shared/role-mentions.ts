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

/**
 * Passages où un `@` n'est pas une mention : blocs de code (```…```, jusqu'à la fin s'ils ne sont
 * pas fermés) et code en ligne (`…`).
 */
function codeRanges(text: string): [number, number][] {
  const ranges: [number, number][] = []
  for (const m of text.matchAll(/```[\s\S]*?(?:```|$)/g))
    ranges.push([m.index, m.index + m[0].length])
  const inFence = (at: number) => ranges.some(([from, to]) => at >= from && at < to)
  const inline: [number, number][] = []
  for (const m of text.matchAll(/`[^`\n]+`/g)) {
    if (!inFence(m.index)) inline.push([m.index, m.index + m[0].length])
  }
  return [...ranges, ...inline]
}

/** Avant `@` : début, blanc ou ponctuation d'ouverture (`(@x)`, `@a,@x`) ; pas `moi@x.fr`. */
const MENTION_BEFORE = /[\s(,;:]/

/**
 * `@nom` des rôles connus dans un texte (casse ignorée), dans l'ordre où ils apparaissent, et le
 * texte sans eux. Seuls `@nom` et l'espace qui le suit sont retirés (avec ses parenthèses s'il est
 * seul entre elles) : l'indentation, les listes et le code restent tels quels, et une mention dans
 * du code n'en est pas une. Les `@mot` inconnus restent dans le texte.
 */
export function splitRoleMentions(
  text: string,
  roles: readonly Pick<RoleDefinition, 'name'>[]
): { names: string[]; text: string } {
  const known = new Map(roles.map((r) => [r.name.toLowerCase(), r.name]))
  const code = codeRanges(text)
  const names: string[] = []
  const cuts: [number, number][] = []
  for (const m of text.matchAll(/@([a-z0-9][a-z0-9-]*)/gi)) {
    const at = m.index
    const name = known.get((m[1] ?? '').toLowerCase())
    if (!name || code.some(([from, to]) => at >= from && at < to)) continue
    if (at > 0 && !MENTION_BEFORE.test(text[at - 1] ?? '')) continue
    let start = at
    let end = at + m[0].length
    if (/[\w-]/.test(text[end] ?? '')) continue
    if (text[start - 1] === '(' && text[end] === ')') {
      start -= 1
      end += 1
    }
    if (text[end] === ' ') end += 1
    else if ((end === text.length || text[end] === '\n') && text[start - 1] === ' ') start -= 1
    if (!names.includes(name)) names.push(name)
    cuts.push([start, end])
  }
  if (names.length === 0) return { names, text }
  let rest = ''
  let from = 0
  for (const [start, end] of cuts) {
    rest += text.slice(from, start)
    from = end
  }
  rest += text.slice(from)
  // Lignes vides laissées en tête (`@rôle` seul sur sa ligne) et blancs de fin : rien d'autre.
  return { names, text: rest.replace(/^(?:[ \t]*\n)+/, '').trimEnd() }
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
