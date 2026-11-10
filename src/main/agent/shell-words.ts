/**
 * Lecture prudente d'une ligne de shell (fiche 211) : mots, opérateurs d'enchaînement et
 * redirections, pour repérer ce qu'une commande ÉCRIT (`command-writes.ts`). Ce n'est pas un shell :
 * au moindre doute — substitution de commande (`$(`, backtick), substitution de processus (`<(`,
 * `>(`), guillemets ANSI-C (`$'`), guillemet non fermé — la lecture le dit (`doubt`) : le morceau
 * douteux devient un mot inconnu et la lecture continue, pour que le nom des commandes reste lu
 * (`sudo bash -c "…"`), mais aucune cible d'écriture n'en est tirée (pas de risque faux).
 *
 * Développé comme le ferait le shell : `~` et `~/…` en tête de mot hors guillemets, `$HOME` et
 * `${HOME}` hors guillemets simples. Toute autre variable rend le mot « inconnu » (`known: false`) :
 * il n'est jamais pris pour un chemin. Le corps d'un heredoc (`<<EOF … EOF`) est sauté.
 */

/** Opérateurs qui séparent deux commandes simples (le retour à la ligne est rendu en `;`). */
export type ShellOperator = ';' | '&&' | '||' | '|' | '|&' | '&' | '(' | ')'

export type ShellToken =
  | { type: 'word'; value: string; known: boolean }
  | { type: 'op'; value: ShellOperator }
  /** Redirection ; sa cible est le mot suivant. `fd` : descripteur écrit devant (`2>`). */
  | { type: 'redirect'; op: string; fd?: string }

/** Ce qu'il faut pour développer `~` et `$HOME`. */
export interface ShellEnv {
  home: string
}

const IDENT = /[A-Za-z0-9_]/

/** Mots, opérateurs et redirections de la ligne ; `doubt` : un morceau n'a pas pu être lu. */
export function shellTokens(
  command: string,
  env: ShellEnv
): { tokens: ShellToken[]; doubt: boolean } {
  const lexer = new Lexer(command, env)
  return { tokens: lexer.run(), doubt: lexer.doubt }
}

class Lexer {
  private i = 0
  private readonly tokens: ShellToken[] = []
  doubt = false
  /** Mot en cours : `null` tant qu'aucun caractère n'y est entré. */
  private word: { value: string; known: boolean; quoted: boolean } | null = null
  /** Heredocs dont le corps commence à la prochaine fin de ligne : délimiteur, tabulations ôtées. */
  private readonly heredocs: { delimiter: string; strip: boolean }[] = []

  private readonly src: string
  private readonly env: ShellEnv

  constructor(src: string, env: ShellEnv) {
    this.src = src
    this.env = env
  }

  run(): ShellToken[] {
    while (this.i < this.src.length) this.step()
    this.endWord()
    return this.tokens
  }

  private get c(): string {
    return this.src[this.i] ?? ''
  }

  private at(offset: number): string {
    return this.src[this.i + offset] ?? ''
  }

  private append(text: string, quoted = false): void {
    this.word ??= { value: '', known: true, quoted: false }
    this.word.value += text
    if (quoted) this.word.quoted = true
  }

  private endWord(): void {
    if (!this.word) return
    this.tokens.push({ type: 'word', value: this.word.value, known: this.word.known })
    this.word = null
  }

  private unknown(): void {
    this.word ??= { value: '', known: true, quoted: false }
    this.word.known = false
  }

  private step(): void {
    const c = this.c
    if (c === ' ' || c === '\t') {
      this.endWord()
      this.i++
      return
    }
    if (c === '\n' || c === '\r') return this.newline()
    if (c === '#' && !this.word) return this.comment()
    if (c === '\\') return this.backslash()
    if (c === "'") return this.single()
    if (c === '"') return this.double()
    if (c === '`') return this.skipUnknown(this.closing('`', this.i + 1))
    if (c === '$') return this.dollar()
    if (c === '~' && !this.word) return this.tilde()
    if (c === '>' || c === '<' || (c === '&' && this.at(1) === '>')) return this.redirect()
    if (c === '&' || c === '|' || c === ';' || c === '(' || c === ')') return this.operator()
    this.append(c)
    this.i++
  }

  private newline(): void {
    this.endWord()
    this.i += this.c === '\r' && this.at(1) === '\n' ? 2 : 1
    this.tokens.push({ type: 'op', value: ';' })
    this.skipHeredocBodies()
  }

  private comment(): void {
    while (this.i < this.src.length && this.c !== '\n') this.i++
  }

  private backslash(): void {
    const next = this.at(1)
    // Fin de ligne échappée : la commande continue.
    if (next === '\n') {
      this.i += 2
      return
    }
    this.append(next, true)
    this.i += 2
  }

  private single(): void {
    const end = this.src.indexOf("'", this.i + 1)
    if (end === -1) return this.skipUnknown(this.src.length)
    this.append(this.src.slice(this.i + 1, end), true)
    this.i = end + 1
  }

  private double(): void {
    this.append('', true)
    this.i++
    while (this.i < this.src.length && this.c !== '"') {
      const c = this.c
      if (c === '`') {
        this.skipUnknown(this.closing('`', this.i + 1))
        continue
      }
      if (c === '\\' && '$`"\\\n'.includes(this.at(1))) {
        if (this.at(1) !== '\n') this.append(this.at(1))
        this.i += 2
        continue
      }
      if (c === '$') {
        this.dollar(true)
        continue
      }
      this.append(c)
      this.i++
    }
    if (this.c !== '"') return this.skipUnknown(this.src.length)
    this.i++
  }

  /** `$` : `$HOME` / `${HOME}` développés ; `$(`, `$'` : doute ; autre variable : mot inconnu. */
  private dollar(inDouble = false): void {
    const next = this.at(1)
    if (next === '(') return this.skipUnknown(this.parenEnd(this.i + 1))
    if (next === "'" && !inDouble) return this.skipUnknown(this.closing("'", this.i + 2))
    if (next === '{') {
      const end = this.src.indexOf('}', this.i + 2)
      if (end === -1) return this.skipUnknown(this.src.length)
      const name = this.src.slice(this.i + 2, end)
      if (name === 'HOME') this.append(this.env.home)
      else this.unknown()
      this.i = end + 1
      return
    }
    let j = this.i + 1
    while (j < this.src.length && IDENT.test(this.src[j] ?? '')) j++
    // `$` seul, ou `$?`, `$1`, `$@`… : variables spéciales, inconnues aussi.
    if (j === this.i + 1) {
      if (next && /[?#@*!$0-9-]/.test(next)) {
        this.unknown()
        this.i += 2
        return
      }
      this.append('$')
      this.i++
      return
    }
    if (this.src.slice(this.i + 1, j) === 'HOME') this.append(this.env.home)
    else this.unknown()
    this.i = j
  }

  /** `~` en tête de mot : le dossier personnel ; `~autre` : inconnu. */
  private tilde(): void {
    const next = this.at(1)
    if (next === '' || next === '/' || /[\s;&|<>()]/.test(next)) {
      this.append(this.env.home)
      this.i++
      return
    }
    this.unknown()
    this.append('~')
    this.i++
  }

  private redirect(): void {
    // `2>` : le mot en cours, fait de chiffres et sans guillemets, est le descripteur.
    let fd: string | undefined
    if (this.word && !this.word.quoted && /^\d+$/.test(this.word.value)) {
      fd = this.word.value
      this.word = null
    } else this.endWord()
    const rest = this.src.slice(this.i)
    if (/^[<>]\(/.test(rest)) return this.skipUnknown(this.parenEnd(this.i + 1))
    if (rest.startsWith('<<<')) return this.pushRedirect('<<<', 3, fd)
    if (rest.startsWith('<<')) return this.heredoc(rest.startsWith('<<-'))
    const op = ['&>>', '&>', '>>', '>|', '>&', '<&', '<>', '>', '<'].find((o) => rest.startsWith(o))
    this.pushRedirect(op ?? this.c, (op ?? this.c).length, fd)
  }

  private pushRedirect(op: string, length: number, fd: string | undefined): void {
    this.tokens.push({ type: 'redirect', op, ...(fd ? { fd } : {}) })
    this.i += length
  }

  /** `<<EOF`, `<<'EOF'`, `<<-EOF` : le délimiteur ; le corps est sauté à la fin de la ligne. */
  private heredoc(strip: boolean): void {
    this.i += strip ? 3 : 2
    while (this.c === ' ' || this.c === '\t') this.i++
    let delimiter = ''
    while (this.i < this.src.length && !/[\s;&|<>()]/.test(this.c)) {
      const c = this.c
      if (c === "'" || c === '"') {
        const end = this.src.indexOf(c, this.i + 1)
        if (end === -1) return this.skipUnknown(this.src.length)
        delimiter += this.src.slice(this.i + 1, end)
        this.i = end + 1
        continue
      }
      if (c === '\\') {
        delimiter += this.at(1)
        this.i += 2
        continue
      }
      delimiter += c
      this.i++
    }
    if (!delimiter) return this.skipUnknown(this.i)
    this.heredocs.push({ delimiter, strip })
  }

  /**
   * Morceau illisible jusqu'à `end` (exclu) : un mot inconnu, et la ligne entière en doute (aucune
   * cible d'écriture ne sera tirée de la commande).
   */
  private skipUnknown(end: number): void {
    this.doubt = true
    this.unknown()
    this.i = Math.max(end, this.i + 1)
  }

  /** Après le prochain `mark` à partir de `from` (échappements sautés) ; la fin sinon. */
  private closing(mark: string, from: number): number {
    for (let j = from; j < this.src.length; j++) {
      if (this.src[j] === '\\') j++
      else if (this.src[j] === mark) return j + 1
    }
    return this.src.length
  }

  /** Après la `)` qui ferme la `(` en `open`, parenthèses imbriquées comprises ; la fin sinon. */
  private parenEnd(open: number): number {
    let depth = 0
    for (let j = open; j < this.src.length; j++) {
      const c = this.src[j]
      if (c === '\\') j++
      else if (c === "'" || c === '"' || c === '`') j = this.closing(c, j + 1) - 1
      else if (c === '(') depth++
      else if (c === ')' && --depth === 0) return j + 1
    }
    return this.src.length
  }

  private skipHeredocBodies(): void {
    while (this.heredocs.length > 0) {
      const { delimiter, strip } = this.heredocs.shift() ?? { delimiter: '', strip: false }
      while (this.i < this.src.length) {
        const end = this.src.indexOf('\n', this.i)
        const stop = end === -1 ? this.src.length : end
        const line = this.src.slice(this.i, stop).replace(/\r$/, '')
        this.i = end === -1 ? this.src.length : end + 1
        if ((strip ? line.replace(/^\t+/, '') : line) === delimiter) break
      }
    }
  }

  private operator(): void {
    this.endWord()
    const two = this.src.slice(this.i, this.i + 2)
    const op = (['&&', '||', '|&', ';;'] as const).find((o) => o === two)
    if (op) {
      this.tokens.push({ type: 'op', value: op === ';;' ? ';' : op })
      this.i += 2
      return
    }
    this.tokens.push({ type: 'op', value: this.c as ShellOperator })
    this.i++
  }
}
