import { describe, expect, it } from 'vitest'
import {
  announcedTitle,
  commandFolderOf,
  commandLines,
  commandOfTool,
  commandParts,
  KEPT_CHARS,
  normalizePath,
  outsideWorkspace,
  sameFolder,
  shortFolder,
  hasInvisible,
  quoteArg,
  toolCommandOf,
  visibleParts,
  visibleText,
  withCommand
} from './command-view'

/** Opérateurs marqués, dans l'ordre ; `null` : rien de marqué (doute). */
const ops = (command: string) =>
  commandParts(command)
    ?.filter((p) => p.op)
    .map((p) => p.text) ?? null

/** Le découpage ne perd ni n'ajoute un caractère. */
const joined = (command: string) =>
  commandParts(command)
    ?.map((p) => p.text)
    .join('')

describe('commande à autoriser : opérateurs d’enchaînement (0.11, M1)', () => {
  it('la commande de la recette (m07) : cinq commandes', () => {
    const m07 =
      "seq 1 20000 | sed 's/^/ligne numero /' > gros.txt && git add gros.txt && git -c user.email=qa@example.test -c user.name=QA commit -qm gros && sed -i '' 's/numero/n°/' gros.txt && wc -l gros.txt"
    expect(ops(m07)).toEqual(['|', '&&', '&&', '&&', '&&'])
    expect(joined(m07)).toBe(m07)
  })

  it('chaque opérateur, hors guillemets', () => {
    expect(ops('a && b || c ; d | e & f')).toEqual(['&&', '||', ';', '|', '&'])
    expect(ops('a;b')).toEqual([';'])
    expect(ops('make |& tee log')).toEqual(['|&'])
    expect(ops('case $x in a) echo a;; esac')).toEqual([';;'])
    expect(ops('sleep 10 &')).toEqual(['&'])
  })

  it('pas des opérateurs : guillemets, échappements, redirections', () => {
    expect(ops("echo ';' && echo '&&'")).toEqual(['&&'])
    expect(ops('echo "a | b; c && d"')).toEqual([])
    expect(ops('echo "il a dit \\"; rm\\" ici"')).toEqual([])
    expect(ops('find . -exec rm {} \\;')).toEqual([])
    expect(ops('npm test 2>&1')).toEqual([])
    expect(ops('npm test 2>&1 | tee log')).toEqual(['|'])
    expect(ops('cmd &> out.log')).toEqual([])
    expect(ops('cmd &>> out.log')).toEqual([])
    expect(ops('exec 3<&0')).toEqual([])
    expect(ops('echo a >| fichier')).toEqual([])
    expect(ops('echo ${x:-a|b}; echo ${y#*;}')).toEqual([';'])
    // Entre guillemets simples, `\` n'échappe rien : le guillemet ferme, `&&` est dehors.
    expect(ops("echo 'un \\' && deux")).toEqual(['&&'])
    expect(ops("echo 'un \\' && deux'")).toBeNull()
  })

  it('au moindre doute, rien de marqué', () => {
    expect(ops("cat <<'EOF'\na && b\nEOF")).toBeNull()
    expect(ops('grep x <<< "$texte"')).toBeNull()
    expect(ops('echo $(date) && ls')).toBeNull()
    expect(ops('echo `date` && ls')).toBeNull()
    expect(ops('diff <(ls a) <(ls b)')).toBeNull()
    expect(ops('tee >(gzip > a.gz) < x')).toBeNull()
    expect(ops("echo $'a\\'b' && ls")).toBeNull()
    expect(ops("echo 'non fermé && rm -rf /")).toBeNull()
    expect(ops('echo "non fermé && rm -rf /')).toBeNull()
    expect(ops('echo ${non fermé && ls')).toBeNull()
  })

  it('&& en fin de ligne, commandes sur plusieurs lignes, CRLF', () => {
    const multi = 'npm ci &&\nnpm run build \\\n  --prod ;\r\nnpm test'
    expect(ops(multi)).toEqual(['&&', ';'])
    expect(joined(multi)).toBe(multi)
    const { lines, marked } = commandLines(multi)
    expect(marked).toBe(true)
    expect(lines.map((line) => line.map((p) => p.text).join(''))).toEqual([
      'npm ci &&',
      'npm run build \\',
      '  --prod ;',
      'npm test'
    ])
    expect(lines[0]?.at(-1)).toEqual({ text: '&&', op: true })
  })

  it('lignes vides gardées, Unicode intact', () => {
    const { lines } = commandLines('echo « été » 🚀 && echo 日本\n\necho fin')
    expect(lines).toHaveLength(3)
    expect(lines[0]?.map((p) => p.text)).toEqual(['echo « été » 🚀 ', '&&', ' echo 日本'])
    expect(lines[1]).toEqual([])
    expect(commandLines('ls').marked).toBe(false)
  })

  it('heredoc : affiché brut, ligne par ligne, rien de marqué', () => {
    const { lines, marked } = commandLines("python3 - <<'EOF'\nprint('a; b')\nEOF")
    expect(marked).toBe(false)
    expect(lines.map((l) => l.map((p) => p.text).join(''))).toEqual([
      "python3 - <<'EOF'",
      "print('a; b')",
      'EOF'
    ])
  })

  it('100 Ko : découpé vite, sans rien perdre', () => {
    const big = Array.from({ length: 4000 }, (_, i) => `echo "ligne ${i}; ok" && true`).join('\n')
    expect(big.length).toBeGreaterThan(100_000)
    const start = performance.now()
    const { lines } = commandLines(big)
    expect(performance.now() - start).toBeLessThan(500)
    expect(lines).toHaveLength(4000)
    expect(joined(big)).toBe(big)
    expect(ops(big)).toHaveLength(4000)
  })
})

describe('commande à autoriser : source et dossier (0.11, M1)', () => {
  it('rawInput.command ou cmd en entier, retours à la ligne gardés', () => {
    const long = `${'x'.repeat(300)}\nsuite`
    expect(toolCommandOf({ command: long })).toEqual({ text: long })
    expect(toolCommandOf({ cmd: 'ls', workdir: '/tmp' })).toEqual({ text: 'ls', cwd: '/tmp' })
    // Tableau d'arguments : chaque argument cité comme un shell POSIX le lirait (relecture M1).
    expect(toolCommandOf({ command: ['bash', '-lc', 'npm test'], cwd: '/p' })).toEqual({
      text: "bash -lc 'npm test'",
      cwd: '/p',
      argv: true
    })
    // `command` vide, `cmd` rempli : `cmd`.
    expect(toolCommandOf({ command: '', cmd: 'ls -la' })).toEqual({ text: 'ls -la' })
    expect(toolCommandOf({ command: [], cmd: 'ls' })).toEqual({ text: 'ls' })
    expect(toolCommandOf({ command: '  ' })).toBeUndefined()
    expect(toolCommandOf({ path: 'a' })).toBeUndefined()
    expect(toolCommandOf(null)).toBeUndefined()
  })

  it('arguments cités POSIX : vide, espaces, guillemet, opérateurs, non-texte', () => {
    expect(quoteArg('')).toBe("''")
    expect(quoteArg('src/a.ts')).toBe('src/a.ts')
    expect(quoteArg('deux mots')).toBe("'deux mots'")
    expect(quoteArg("l'outil")).toBe("'l'\\''outil'")
    expect(quoteArg('a && rm -rf /')).toBe("'a && rm -rf /'")
    expect(quoteArg('$HOME')).toBe("'$HOME'")
    expect(quoteArg(42)).toBe('42')
    expect(quoteArg({ a: 1 })).toBe('\'{"a":1}\'')
    expect(quoteArg(null)).toBe('null')
    const argv = toolCommandOf({ command: ['bash', '-lc', "npm test && echo 'fini'", '', 42] })
    expect(argv?.text).toBe("bash -lc 'npm test && echo '\\''fini'\\''' '' 42")
    // Rien d'interprété par un shell : aucun opérateur marqué.
    expect(commandLines(argv?.text ?? '', !argv?.argv).marked).toBe(false)
  })

  it('command + args / arguments : tout affiché', () => {
    expect(toolCommandOf({ command: 'git', args: ['commit', '-m', 'un message'] })).toEqual({
      text: "git commit -m 'un message'",
      argv: true
    })
    expect(toolCommandOf({ command: 'npm', arguments: ['run', ''] })?.text).toBe("npm run ''")
  })

  it('commande énorme : le fil en garde le début et sa taille', () => {
    const huge = 'a'.repeat(KEPT_CHARS + 10)
    const kept = toolCommandOf({ command: huge })
    expect(kept?.text).toHaveLength(KEPT_CHARS)
    expect(kept?.total).toBe(KEPT_CHARS + 10)
  })

  it('withCommand garde la commande d’avant si rawInput n’en dit rien', () => {
    expect(withCommand({ status: 'x' }, { text: 'ls' })).toEqual({ command: { text: 'ls' } })
    expect(withCommand(undefined)).toEqual({})
  })

  it('commande d’un outil : rawInput, sinon le titre d’un execute (Bob), jamais du code', () => {
    expect(commandOfTool({ title: 'npm test', toolKind: 'execute' })).toEqual({ text: 'npm test' })
    expect(
      commandOfTool({ title: 'Run', toolKind: 'execute', command: { text: 'npm ci' } })
    ).toEqual({ text: 'npm ci' })
    expect(commandOfTool({ title: 'execute', toolKind: 'execute', input: { code: 'x()' } })).toBe(
      undefined
    )
    expect(commandOfTool({ title: 'Lire a.ts', toolKind: 'read' })).toBeUndefined()
    expect(commandOfTool({ title: ' ', toolKind: 'execute' })).toBeUndefined()
  })

  it('hors du dossier : comparaison de chemins absolus seulement', () => {
    expect(normalizePath('/a/./b//c/../d/')).toBe('/a/b/d')
    expect(normalizePath('a/b')).toBeUndefined()
    expect(outsideWorkspace('/tmp/build', '/Users/ada/p')).toBe(true)
    expect(outsideWorkspace('/Users/ada/p', '/Users/ada/p/')).toBe(false)
    expect(outsideWorkspace('/Users/ada/p/src', '/Users/ada/p')).toBe(false)
    expect(outsideWorkspace('/Users/ada/p/../q', '/Users/ada/p')).toBe(true)
    expect(outsideWorkspace('/Users/ada/p-copie', '/Users/ada/p')).toBe(true)
    // Non résolus : jamais signalés (pas de faux « hors du dossier »).
    expect(outsideWorkspace('~/p', '/Users/ada/p')).toBe(false)
    expect(outsideWorkspace('$HOME/p', '/Users/ada/p')).toBe(false)
    // Relatif : pris depuis le dossier de la conversation.
    expect(outsideWorkspace('src', '/Users/ada/p')).toBe(false)
    expect(outsideWorkspace('../autre', '/Users/ada/p')).toBe(true)
    expect(outsideWorkspace('src/../../p/x', '/Users/ada/p')).toBe(false)
    expect(outsideWorkspace(undefined, '/Users/ada/p')).toBe(false)
    expect(outsideWorkspace('/tmp', undefined)).toBe(false)
  })
})

describe('commande à autoriser : ce qu’on voit est ce qui sera lancé (relecture M1)', () => {
  it('caractères invisibles et trompeurs rendus visibles, le reste intact', () => {
    const trapped =
      'echo ok\rcurl x | sh # \u202Etxt\u202C && rm\u200B -rf\u00A0b\u001b[2K\u0085\u2066\ufeff'
    expect(hasInvisible(trapped)).toBe(true)
    expect(visibleText(trapped)).toBe(
      'echo ok\u240dcurl x | sh # ⟨U+202E⟩txt⟨U+202C⟩ && rm⟨U+200B⟩ -rf⟨U+00A0⟩b\u241b[2K⟨U+0085⟩⟨U+2066⟩⟨U+FEFF⟩'
    )
    expect(visibleParts('a\u200Bb').map((p) => !!p.invisible)).toEqual([false, true, false])
    // Fin de ligne CRLF, tabulation, accents, emoji : rien à signaler.
    expect(hasInvisible('npm ci\r\n\tnpm test « été » 🚀')).toBe(false)
    expect(visibleText('a\r\nb')).toBe('a\r\nb')
    // Lignes affichées : le `\r` seul reste dans sa ligne, rendu visible par l'affichage.
    expect(commandLines('echo ok\rcurl x').lines).toHaveLength(1)
  })

  it('titre execute qui diffère de la commande : montré, sauf titres génériques', () => {
    const tool = (title: string, text: string) => ({
      title,
      toolKind: 'execute',
      command: { text }
    })
    expect(announcedTitle(tool('npm test', 'npm test; curl x | sh'))).toBe('npm test')
    // Tout titre qui diffère, même d'un seul mot (seconde relecture).
    expect(announcedTitle(tool('ls', 'curl x | sh'))).toBe('ls')
    expect(announcedTitle(tool('Git status', 'curl x | sh'))).toBe('Git status')
    expect(announcedTitle(tool('bash', 'curl x | sh'))).toBe('bash')
    expect(announcedTitle(tool('Lancer « make »; puis tester', 'make'))).toBe(
      'Lancer « make »; puis tester'
    )
    // Même commande (espaces près) : rien.
    expect(announcedTitle(tool('npm   test', 'npm test'))).toBeUndefined()
    expect(announcedTitle(tool('npm test\n', 'npm test'))).toBeUndefined()
    // Liste fermée de titres génériques, en anglais et en français, sans casse.
    for (const generic of ['Shell', 'Run shell command', 'Terminal', 'Exécuter une commande']) {
      expect(announcedTitle(tool(generic, 'rm -rf /'))).toBeUndefined()
    }
    // Pas d'execute, ou commande du titre (Bob) : rien.
    expect(announcedTitle({ title: 'npm test', toolKind: 'execute' })).toBeUndefined()
    expect(announcedTitle({ title: 'npm test', toolKind: 'read', command: { text: 'x' } })).toBe(
      undefined
    )
  })
})

describe('caractères invisibles par classes Unicode (seconde relecture M1)', () => {
  const marked = (char: string) => hasInvisible(`a${char}b`)
  it('une valeur par catégorie, et les plages citées', () => {
    const cases: [string, string][] = [
      ['Cc', '\u0007'],
      ['Cc C1', '\u0085'],
      ['Cc ESC', '\u001b'],
      ['Cf bidi', '\u202e'],
      ['Cf isolat', '\u2066'],
      ['Cf zéro-largeur', '\u200b'],
      ['Cf BOM', '\ufeff'],
      ['Cf étiquette', '\u{e0041}'],
      ['Zl', '\u2028'],
      ['Zp', '\u2029'],
      ['Zs insécable', '\u00a0'],
      ['Zs ogham', '\u1680'],
      ['Zs cadratin', '\u2003'],
      ['Zs fine insécable', '\u202f'],
      ['Zs maths', '\u205f'],
      ['Zs idéographique', '\u3000'],
      ['Mn barre', '\u0336'],
      // Marque combinante isolée (après une espace) : rien à composer, montrée.
      ['Me cercle isolée', ' \u20dd'],
      ['Mn isolée', ' \u0301'],
      ['sélecteur', '\ufe0f'],
      ['sélecteur supplémentaire', '\u{e0100}'],
      ['remplissage hangul', '\u3164']
    ]
    for (const [name, char] of cases) expect(marked(char), name).toBe(true)
    for (let c = 0x2000; c <= 0x200a; c++) expect(marked(String.fromCodePoint(c))).toBe(true)
    for (let c = 0xfe00; c <= 0xfe0f; c++) expect(marked(String.fromCodePoint(c))).toBe(true)
    for (const c of [0xe0000, 0xe0020, 0xe007f, 0xe01ef]) {
      expect(marked(String.fromCodePoint(c))).toBe(true)
    }
    // Un caractère hors du plan de base : son vrai code.
    expect(visibleText('rm\u{e0041}x')).toBe('rm⟨U+E0041⟩x')
    expect(visibleText('rm\u2003-rf')).toBe('rm⟨U+2003⟩-rf')
  })

  it('texte français ordinaire : rien de marqué', () => {
    const french =
      'git commit -m \'L’été, j’ai corrigé « l’accès » à la base\' && echo "déjà fait"\tok\r\nfin'
    expect(hasInvisible(french)).toBe(false)
    expect(visibleText(french)).toBe(french)
    expect(hasInvisible('npm test 🚀 日本語 ñ ç Œ')).toBe(false)
  })
})

describe('caractères invisibles : pas de faux positifs (troisième relecture M1)', () => {
  const loud = (text: string) =>
    commandLines(text)
      .lines.flat()
      .filter((p) => p.invisible === 'loud')
      .map((p) => p.text)
  const quiet = (text: string) =>
    commandLines(text)
      .lines.flat()
      .filter((p) => p.invisible === 'quiet')
      .map((p) => p.text)

  it('marques combinantes après une lettre (NFD de macOS, devanagari) : rien', () => {
    const nfd = 'cat Résumé.txt Noël.md'.normalize('NFD')
    expect(nfd.length).toBeGreaterThan('cat Résumé.txt Noël.md'.length)
    expect(hasInvisible(nfd)).toBe(false)
    expect(visibleText(nfd)).toBe(nfd)
    expect(hasInvisible('echo क\u094dषत\u094dरिय नमस\u094dत\u0947')).toBe(false)
    // Deux marques sur une lettre (vietnamien en NFD) : encore du texte.
    expect(hasInvisible('echo ệ'.normalize('NFD'))).toBe(false)
  })

  it('marques de recouvrement, piles (zalgo), marques isolées, liant invisible : montrées', () => {
    expect(loud('rm a\u0338b')).toEqual(['⟨U+0338⟩'])
    expect(loud('rm x\u20d2')).toEqual(['⟨U+20D2⟩'])
    expect(loud('r\u0336m -rf')).toEqual(['⟨U+0336⟩'])
    expect(loud('echo a\u0301\u0302\u0303')).toEqual(['⟨U+0301⟩', '⟨U+0302⟩', '⟨U+0303⟩'])
    expect(loud('echo \u0301x')).toEqual(['⟨U+0301⟩'])
    expect(loud('r\u034fm')).toEqual(['⟨U+034F⟩'])
  })

  it('emoji : sélecteur après un pictogramme, liant entre pictogrammes, rien', () => {
    const heart = 'git commit -m "❤\ufe0f merci"'
    const family = 'echo 👨\u200d👩\u200d👧 👍🏽\u200d🔥'
    expect(hasInvisible(heart)).toBe(false)
    expect(hasInvisible(family)).toBe(false)
    // Hors d'une séquence d'emoji : montrés.
    expect(loud('r\u200dm')).toEqual(['⟨U+200D⟩'])
    expect(loud('a\ufe0f')).toEqual(['⟨U+FE0F⟩'])
    expect(loud('❤\u200d')).toEqual(['⟨U+200D⟩'])
  })

  it('espace insécable entre guillemets : discrète, sans alerte ; hors guillemets : alerte', () => {
    const message = 'git commit -m "Correction\u00a0: ok"'
    expect(hasInvisible(message)).toBe(false)
    expect(quiet(message)).toEqual(['\u00a0'])
    expect(quiet("echo 'cinq\u202fmots'")).toEqual(['\u202f'])
    const rm = 'rm -rf\u00a0/tmp/x'
    expect(hasInvisible(rm)).toBe(true)
    expect(loud(rm)).toEqual(['⟨U+00A0⟩'])
    // Guillemets non fermés : dans le doute, hors guillemets.
    expect(hasInvisible('echo "non fermé\u00a0rm')).toBe(true)
    // Le texte brut reste dans la partie discrète (« Copier » et le shell voient la même chose).
    expect(
      commandLines(message)
        .lines.flat()
        .map((p) => p.text)
        .join('')
    ).toBe(message)
  })

  it('caractères musicaux qui se dessinent comme du blanc', () => {
    expect(hasInvisible('rm\u{1d159}-rf')).toBe(true)
    for (let c = 0x1d173; c <= 0x1d17a; c++) {
      expect(hasInvisible(`rm${String.fromCodePoint(c)}x`)).toBe(true)
    }
  })
})

describe('dans le doute, on alerte (dernière relecture M1)', () => {
  it('marque qui ne se compose pas, ou d’une autre écriture, après une lettre : alerte', () => {
    for (const mark of ['\u17b4', '\u17b5', '\u20dd', '\u0332', '\u20e5']) {
      const passwd = `cat /etc/pa${mark}sswd`
      expect(hasInvisible(passwd), mark.codePointAt(0)?.toString(16)).toBe(true)
    }
    // Même dans sa propre écriture, une voyelle inhérente khmère reste trompeuse.
    expect(hasInvisible('echo ក\u17b4')).toBe(true)
    // Toujours du texte : composition NFC réelle, ou marque de la même écriture.
    expect(hasInvisible('cat Résumé.txt'.normalize('NFD'))).toBe(false)
    expect(hasInvisible('echo ệ'.normalize('NFD'))).toBe(false)
    expect(hasInvisible('echo क\u094dषत\u094dरिय')).toBe(false)
    // Une marque latine qui ne se compose pas (point souscrit sur « q ») : alerte.
    expect(hasInvisible('echo q\u0323')).toBe(true)
  })

  it('insécable : discrète seulement si le découpage des guillemets est sûr', () => {
    // Commentaire : son apostrophe n'ouvre pas de guillemets.
    expect(hasInvisible("ls # don't\nrm -rf\u00a0/tmp/x # it's")).toBe(true)
    // Heredoc : dans le doute, hors guillemets.
    expect(hasInvisible("cat <<EOF\nit's\nEOF\nrm -rf\u00a0/tmp/x 'ok'")).toBe(true)
    // Guillemets ANSI-C : dans le doute, hors guillemets.
    expect(hasInvisible("echo $'a\\'b' rm\u00a0x 'c'")).toBe(true)
    // Sûr : entre guillemets, après un commentaire fermé par la fin de ligne.
    expect(hasInvisible('ls # commentaire\ngit commit -m "Correction\u00a0: ok"')).toBe(false)
    // Un « # » au milieu d'un mot n'ouvre pas de commentaire.
    expect(hasInvisible('echo a#b "x\u00a0y"')).toBe(false)
  })
})

describe('Dossier de la commande dit court (fiche 203, sécurité M1)', () => {
  const WS = '/Users/ada/projet'

  it('dossier de la conversation : son nom ; sous-dossier : relatif, précédé du nom', () => {
    expect(shortFolder(WS, WS)).toBe('projet')
    expect(shortFolder(`${WS}/`, WS)).toBe('projet')
    expect(shortFolder(WS, `${WS}/`)).toBe('projet')
    expect(shortFolder(`${WS}/src/renderer`, WS)).toBe('projet/src/renderer')
    expect(shortFolder(`${WS}//src/./renderer/`, WS)).toBe('projet/src/renderer')
  })

  it('hors du dossier : jamais raccourci (chemin entier affiché)', () => {
    expect(shortFolder('/tmp/build', WS)).toBeUndefined()
    expect(shortFolder('/Users/ada', WS)).toBeUndefined()
    // Voisin au nom qui commence pareil.
    expect(shortFolder('/Users/ada/projet-copie', WS)).toBeUndefined()
    expect(shortFolder('/Users/ada/projet-copie/src', WS)).toBeUndefined()
    expect(shortFolder('/private/tmp/x/ailleurs', WS)).toBeUndefined()
  })

  it('au moindre doute : chemin entier (`..`, relatif, `~`, variable, `/`)', () => {
    // `..` : normalisé il serait dedans, mais un lien symbolique pourrait le faire sortir.
    expect(shortFolder(`${WS}/src/..`, WS)).toBeUndefined()
    expect(shortFolder(`${WS}/lien/../src`, WS)).toBeUndefined()
    expect(shortFolder(`${WS}/../projet`, WS)).toBeUndefined()
    expect(shortFolder('src', WS)).toBeUndefined()
    expect(shortFolder('./src', WS)).toBeUndefined()
    expect(shortFolder('~/projet', WS)).toBeUndefined()
    expect(shortFolder('$HOME/projet', WS)).toBeUndefined()
    expect(shortFolder(`${WS}/$SUB`, WS)).toBeUndefined()
    expect(shortFolder('/src', '/')).toBeUndefined()
    expect(shortFolder(WS, 'projet')).toBeUndefined()
    expect(shortFolder(undefined, WS)).toBeUndefined()
    expect(shortFolder(WS, undefined)).toBeUndefined()
  })

  it('caractères invisibles ou bidi du chemin : rendus visibles dans le nom court', () => {
    // Un RLO dans le nom d'un sous-dossier ne peut pas retourner l'affichage.
    const rlo = shortFolder(`${WS}/src/‮gnp.exe`, WS) ?? ''
    expect(rlo).toBe(`projet/src/${visibleText('‮gnp.exe')}`)
    expect(rlo).not.toMatch(/[‪-‮⁦-⁩​]/)
    expect(rlo).toContain('U+202E')
    // Dossier de la conversation au nom piégé (zéro-largeur) : rendu visible aussi.
    const zw = shortFolder('/Users/ada/pro​jet/src', '/Users/ada/pro​jet') ?? ''
    expect(zw).not.toContain('​')
    expect(zw).toContain('U+200B')
  })

  it('limite connue : un lien symbolique dans le dossier n’est pas résolu (fiche 006)', () => {
    // `projet/lien` → `/etc` s'affiche « projet/lien » ; le chemin entier reste en infobulle.
    expect(shortFolder(`${WS}/lien`, WS)).toBe('projet/lien')
  })

  it('même dossier : normalisé, barres finales comprises ; au moindre doute, non', () => {
    expect(sameFolder(WS, `${WS}/`)).toBe(true)
    expect(sameFolder(`${WS}//src/.`, `${WS}/src`)).toBe(true)
    expect(sameFolder(`${WS}/src`, WS)).toBe(false)
    expect(sameFolder(`${WS}/src/..`, WS)).toBe(false)
    expect(sameFolder('src', 'src')).toBe(false)
    expect(sameFolder('~/projet', '~/projet')).toBe(false)
    expect(sameFolder(undefined, WS)).toBe(false)
  })
})

describe('Dossier relatif de la commande (fiche 203, correctif de recette OpenCode 2.2.5)', () => {
  const WS = '/Users/ada/projet'
  // Ce qu'envoie OpenCode 2.2.5 (trace `commande-dans-un-sous-dossier`) : `workdir` relatif,
  // l'emplacement absolu.
  const at = (path: string, line?: number) => (line === undefined ? { path } : { path, line })

  it('relatif confirmé par l’emplacement : « projet/docs », emplacement masqué', () => {
    expect(commandFolderOf('docs', WS, [at(`${WS}/docs`)])).toEqual({
      full: `${WS}/docs`,
      short: 'projet/docs',
      resolved: `${WS}/docs`,
      outside: false
    })
    expect(commandFolderOf('./src/renderer/', WS, [at(`${WS}/src/renderer/`)])?.short).toBe(
      'projet/src/renderer'
    )
    expect(commandFolderOf('.', WS, [at(WS)])?.short).toBe('projet')
  })

  it('relatif avec `..` qui sort : alerte, chemin entier, emplacement gardé', () => {
    const up = commandFolderOf('../..', WS, [at('/Users')])
    expect(up).toEqual({ full: '/Users', outside: true })
    expect(up?.resolved).toBeUndefined()
    // Sans emplacement : la valeur brute, et l'alerte quand même.
    expect(commandFolderOf('../..', WS)).toEqual({ full: '../..', outside: true })
    expect(commandFolderOf('../autre', WS, [])).toEqual({ full: '../autre', outside: true })
    // `..` qui reste dedans : pas d'alerte, mais ni forme courte ni emplacement masqué (doute).
    expect(commandFolderOf('src/../docs', WS, [at(`${WS}/docs`)])).toEqual({
      full: `${WS}/docs`,
      outside: false
    })
  })

  it('relatif sans emplacement : la valeur brute, rien de masqué', () => {
    expect(commandFolderOf('docs', WS)).toEqual({ full: 'docs', outside: false })
    // Un emplacement avec un numéro de ligne est un fichier : il ne confirme rien.
    expect(commandFolderOf('docs', WS, [at(`${WS}/docs`, 3)])).toEqual({
      full: 'docs',
      outside: false
    })
  })

  it('emplacement différent : la valeur brute ; s’il est hors du dossier, l’alerte', () => {
    expect(commandFolderOf('docs', WS, [at(`${WS}/src`)])).toEqual({
      full: 'docs',
      outside: false
    })
    expect(commandFolderOf('docs', WS, [at('/etc')])).toEqual({ full: 'docs', outside: true })
    // Un emplacement à `..` ne confirme rien.
    expect(commandFolderOf('docs', WS, [at(`${WS}/x/../docs`)])?.resolved).toBeUndefined()
  })

  it('`~`, variable, dossier de la conversation douteux : rien de résolu', () => {
    expect(commandFolderOf('~/x', WS, [at('/Users/ada/x')])).toEqual({
      full: '~/x',
      outside: true
    })
    expect(commandFolderOf('$HOME', WS, [])).toEqual({ full: '$HOME', outside: false })
    expect(commandFolderOf('docs', `${WS}/../projet`, [at(`${WS}/docs`)])).toEqual({
      full: `${WS}/docs`,
      outside: false
    })
    expect(commandFolderOf('docs', undefined, [at(`${WS}/docs`)])).toEqual({
      full: 'docs',
      outside: false
    })
  })

  it('absolu ou absent : inchangé (forme courte, emplacement égal masqué, alerte)', () => {
    expect(commandFolderOf(`${WS}/docs`, WS)).toEqual({
      full: `${WS}/docs`,
      short: 'projet/docs',
      resolved: `${WS}/docs`,
      outside: false
    })
    expect(commandFolderOf(undefined, WS)).toEqual({
      full: WS,
      short: 'projet',
      resolved: WS,
      outside: false
    })
    expect(commandFolderOf('/tmp', WS)).toEqual({ full: '/tmp', resolved: '/tmp', outside: true })
    expect(commandFolderOf(undefined, undefined)).toBeUndefined()
  })
})
