/**
 * Mots d'une ligne de commande Windows (fiche 229, lot 3b), pour `windows-command-writes.ts` :
 * découpage commun à PowerShell et `cmd`, volontairement étroit. Rend `undefined` (illisible, donc
 * « écritures inconnues ») dès qu'un élément change le sens d'une façon que Bobine ne suit pas :
 *
 * - échappements : `` ` `` (PowerShell, même entre guillemets doubles), `^` (cmd) ;
 * - sous-expressions et blocs : `$(`, `@(`, `@{`, `(`, `)`, `{`, `}` ; mot qui commence par `[`
 *   (type .NET) ou `@` (éclatement) ; commentaire `#` en début de mot ;
 * - `&` seul (opérateur d'appel ou tâche de fond de PowerShell, séparateur de cmd) ; entrée `<` ;
 * - guillemet non fermé, redirection sans cible.
 *
 * Guillemets à la PowerShell : `'…'` littéral (`''` vaut `'`), `"…"` (`""` vaut `"`, `$` gardé
 * tel quel pour la résolution des variables). Séparateurs : `;`, `&&`, `||` (PowerShell 7 et
 * cmd), `|`, fin de ligne. Une virgule hors guillemets fait une liste (`Remove-Item a, b`).
 */

/** Un mot : ses valeurs (plusieurs pour une liste `a, b`), et s'il commence par un guillemet. */
export interface ShellWord {
  values: string[]
  quoted: boolean
}

/** Une commande d'un tuyau : ses mots et les cibles de ses redirections vers un fichier. */
export interface ShellCommand {
  words: ShellWord[]
  redirects: string[]
  /** Reçoit l'entrée d'une commande précédente par `|`. */
  piped: boolean
}

const SEPARATORS = ['&&', '||', ';', '|', '\r\n', '\n', '\r']

/** Caractères qui rendent la ligne illisible hors guillemets. */
const UNREADABLE = new Set(['`', '^', '(', ')', '{', '}', '<'])

class Reader {
  readonly commands: ShellCommand[] = []
  private words: ShellWord[] = []
  private redirects: string[] = []
  private piped = false
  private word = ''
  private started = false
  private quoted = false
  private redirectNext = false
  private joinNext = false

  /** Termine le mot en cours ; `false` si une redirection ou une liste reste sans mot. */
  flush(): void {
    if (!this.started) return
    if (this.redirectNext) this.redirects.push(this.word)
    else if (this.joinNext && this.words.length > 0) this.words.at(-1)?.values.push(this.word)
    else this.words.push({ values: [this.word], quoted: this.quoted })
    this.redirectNext = false
    this.joinNext = false
    this.word = ''
    this.started = false
    this.quoted = false
  }

  /** Commande suivante ; `false` si quelque chose reste en suspens. */
  next(pipe: boolean): boolean {
    this.flush()
    if (this.redirectNext || this.joinNext) return false
    if (this.words.length > 0 || this.redirects.length > 0) {
      this.commands.push({ words: this.words, redirects: this.redirects, piped: this.piped })
    } else if (pipe || this.piped) return false // `| x` ou `x | | y`
    this.words = []
    this.redirects = []
    this.piped = pipe
    return true
  }

  add(text: string, quoted = false): void {
    if (!this.started) this.quoted = quoted
    this.started = true
    this.word += text
  }

  get empty(): boolean {
    return !this.started
  }

  redirect(): boolean {
    this.flush()
    if (this.redirectNext) return false
    this.redirectNext = true
    return true
  }

  list(): boolean {
    this.flush()
    if (this.joinNext || this.redirectNext || this.words.length === 0) return false
    this.joinNext = true
    return true
  }
}

/** Fin d'un passage entre guillemets ouvert en `start` ; `undefined` s'il n'est pas lisible. */
function quotedText(text: string, start: number): { value: string; end: number } | undefined {
  const quote = text[start]
  let value = ''
  for (let i = start + 1; i < text.length; i++) {
    const c = text[i]
    if (c === quote) {
      if (text[i + 1] === quote) {
        value += quote
        i++
        continue
      }
      return { value, end: i }
    }
    if (quote === '"' && (c === '`' || text.startsWith('$(', i))) return undefined
    value += c
  }
  return undefined
}

/** Longueur d'une redirection (`>`, `>>`, `2>`, `*>>`, `2>&1`) en `i`, ou 0. */
function redirectAt(text: string, i: number, wordEmpty: boolean): string {
  const rest = text.slice(i)
  const match = /^(?:[1-6*]?>>?)(?:&[1-6])?/.exec(rest)?.[0] ?? ''
  if (!match) return ''
  // `a2>b` : le `2` appartient au mot.
  if (/^[1-6*]/.test(match) && !wordEmpty) return ''
  return match
}

/** Commandes d'une ligne, ou `undefined` si elle n'est pas lisible. */
export function windowsCommands(text: string): ShellCommand[] | undefined {
  const reader = new Reader()
  for (let i = 0; i < text.length; i++) {
    const c = text[i] ?? ''
    if (c === "'" || c === '"') {
      const quoted = quotedText(text, i)
      if (!quoted) return undefined
      reader.add(quoted.value, true)
      i = quoted.end
      continue
    }
    const sep = SEPARATORS.find((s) => text.startsWith(s, i))
    if (sep) {
      if (!reader.next(sep === '|')) return undefined
      i += sep.length - 1
      continue
    }
    if (c === '&' || UNREADABLE.has(c) || text.startsWith('$(', i)) return undefined
    if (reader.empty && (c === '@' || c === '[' || c === '#')) return undefined
    if (c === ' ' || c === '\t') {
      reader.flush()
      continue
    }
    if (c === ',') {
      if (!reader.list()) return undefined
      continue
    }
    const redirect = redirectAt(text, i, reader.empty)
    if (redirect) {
      i += redirect.length - 1
      // `2>&1`, `*>&1` : vers un autre flux, pas un fichier.
      if (redirect.includes('&')) {
        reader.flush()
        continue
      }
      if (!reader.redirect()) return undefined
      continue
    }
    reader.add(c)
  }
  if (!reader.next(false)) return undefined
  return reader.commands
}
