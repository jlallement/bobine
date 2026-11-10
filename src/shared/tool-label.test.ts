import { afterEach, describe, expect, it } from 'vitest'
import i18next from 'i18next'
import {
  cleanCommand,
  cleanTitle,
  createsFile,
  filePathParts,
  relativePath,
  shortenPath,
  toolInputOf,
  toolLabel,
  toolText,
  type LabelledTool,
  type ToolInput
} from './tool-label'

const WS = '/Users/ada/Development/livres'

const tool = (extra: Partial<LabelledTool> & { rawInput?: unknown } = {}): LabelledTool => {
  const { rawInput, ...rest } = extra
  const input: ToolInput | undefined = rawInput !== undefined ? toolInputOf(rawInput) : undefined
  return { title: 'read', toolKind: 'read', locations: [], ...(input ? { input } : {}), ...rest }
}

describe('toolInputOf (fiche 107)', () => {
  it('lit la cible sous ses noms usuels, texte sur une ligne', () => {
    expect(toolInputOf({ filePath: '/a/b.ts', pattern: 'TODO', url: 'https://x.io' })).toEqual({
      path: '/a/b.ts',
      pattern: 'TODO',
      url: 'https://x.io'
    })
    expect(toolInputOf({ file_path: '/a.ts' })).toEqual({ path: '/a.ts' })
    expect(toolInputOf({ path: '/a.ts', query: 'main' })).toEqual({
      path: '/a.ts',
      pattern: 'main'
    })
    expect(toolInputOf({ command: 'git\n  status  --short', description: 'état' })).toEqual({
      command: 'git status --short'
    })
  })

  it('rien sans cible connue, ni pour une valeur qui n’est pas un texte', () => {
    expect(toolInputOf({ plan: 'Étape 1' })).toBeUndefined()
    expect(toolInputOf({ path: ['a', 'b'] })).toBeUndefined()
    expect(toolInputOf('read')).toBeUndefined()
    expect(toolInputOf(undefined)).toBeUndefined()
  })

  it('une valeur très longue est raccourcie', () => {
    const input = toolInputOf({ command: 'x'.repeat(300) })
    expect(input?.command).toHaveLength(200)
    expect(input?.command?.endsWith('…')).toBe(true)
  })
})

describe('chemins', () => {
  it('relatifs au dossier de la conversation, tels quels en dehors', () => {
    expect(relativePath(`${WS}/src/books.js`, WS)).toBe('src/books.js')
    expect(relativePath(`${WS}/src/books.js`, `${WS}/`)).toBe('src/books.js')
    expect(relativePath('/etc/hosts', WS)).toBe('/etc/hosts')
    expect(relativePath(`${WS}-bis/a.ts`, WS)).toBe(`${WS}-bis/a.ts`)
    expect(relativePath(WS, WS)).toBe('livres/')
    expect(relativePath('src/books.js', WS)).toBe('src/books.js')
    expect(relativePath(`${WS}/src/books.js`, undefined)).toBe(`${WS}/src/books.js`)
  })

  it('tronqués au milieu, le nom du fichier toujours entier', () => {
    expect(shortenPath('src/books.js')).toBe('src/books.js')
    const long = 'src/renderer/src/components/thread/ToolCall.tsx'
    expect(shortenPath(long, 30)).toBe('src/renderer/…/ToolCall.tsx')
    expect(shortenPath(long, 30).length).toBeLessThanOrEqual(30)
    // Nom de fichier plus long que la place : coupé au début, lui aussi.
    expect(shortenPath(`/Users/ada/${'a'.repeat(40)}.ts`, 30)).toBe(`…${'a'.repeat(26)}.ts`)
    expect(shortenPath('a'.repeat(60), 30)).toBe(`…${'a'.repeat(29)}`)
  })
})

describe('toolLabel (fiche 107)', () => {
  afterEach(() => i18next.changeLanguage('fr'))
  const text = (item: LabelledTool, workspace?: string) => toolLabel(item, workspace)?.text

  it('lecture, modification, suppression, déplacement : d’après le premier emplacement', () => {
    const read = tool({ locations: [{ path: `${WS}/src/books.js` }] })
    expect(toolLabel(read, WS)).toEqual({
      text: 'Lecture de src/books.js',
      detail: `${WS}/src/books.js`,
      file: { before: 'Lecture de ', dir: 'src/', name: 'books.js', after: '' }
    })
    expect(
      text(tool({ toolKind: 'edit', title: 'edit', locations: [{ path: 'README.md' }] }))
    ).toBe('Modification de README.md')
    expect(text(tool({ toolKind: 'delete', locations: [{ path: 'old.txt' }] }))).toBe(
      'Suppression de old.txt'
    )
    expect(text(tool({ toolKind: 'move', locations: [{ path: 'a.txt' }] }))).toBe(
      'Déplacement de a.txt'
    )
  })

  it('sans emplacement, le chemin de rawInput ; sans cible, rien (titre de l’agent)', () => {
    expect(text(tool({ rawInput: { filePath: `${WS}/notes.txt` } }), WS)).toBe(
      'Lecture de notes.txt'
    )
    expect(toolLabel(tool())).toBeUndefined()
    expect(toolLabel(tool({ title: 'Reading the project files' }))).toBeUndefined()
  })

  it('plusieurs fichiers : le premier et les autres comptés, tous dans le détail', () => {
    const patch = tool({
      toolKind: 'edit',
      title: 'patch',
      locations: [{ path: `${WS}/a.ts` }, { path: `${WS}/b.ts` }, { path: `${WS}/c.ts` }]
    })
    expect(toolLabel(patch, WS)).toEqual({
      text: 'Modification de a.ts et 2 autres',
      detail: `${WS}/a.ts\n${WS}/b.ts\n${WS}/c.ts`,
      file: { before: 'Modification de ', dir: '', name: 'a.ts', after: ' et 2 autres' }
    })
    expect(text(tool({ toolKind: 'edit', locations: [{ path: 'a.ts' }, { path: 'b.ts' }] }))).toBe(
      'Modification de a.ts et 1 autre'
    )
  })

  it('chemin long tronqué au milieu, entier dans le détail', () => {
    const deep = `${WS}/src/renderer/src/components/thread/very/deep/folder/ToolCall.tsx`
    const label = toolLabel(tool({ locations: [{ path: deep }] }), WS)
    expect(label?.text).toBe('Lecture de src/renderer/src/components/…/ToolCall.tsx')
    expect(label?.detail).toBe(deep)
  })

  it('recherche : le motif, le dossier fouillé en détail ; sans motif, le dossier', () => {
    const grep = tool({
      title: 'grep',
      toolKind: 'search',
      rawInput: { pattern: 'TODO', path: `${WS}/src` }
    })
    expect(toolLabel(grep, WS)).toEqual({
      text: 'Recherche «\u00a0TODO\u00a0»',
      detail: `TODO\n${WS}/src`
    })
    expect(
      text(tool({ title: 'glob', toolKind: 'search', rawInput: { pattern: '**/*.ts' } }))
    ).toBe('Recherche «\u00a0**/*.ts\u00a0»')
    expect(
      text(tool({ title: 'grep', toolKind: 'search', rawInput: { path: `${WS}/src` } }), WS)
    ).toBe('Recherche dans src')
    expect(toolLabel(tool({ title: 'grep', toolKind: 'search' }))).toBeUndefined()
  })

  it('liste d’un dossier : titre nu « list » ou « ls », genre lecture ou recherche', () => {
    expect(text(tool({ title: 'list', rawInput: { path: `${WS}/src` } }), WS)).toBe('Liste de src')
    expect(text(tool({ title: 'ls', toolKind: 'search', rawInput: { path: WS } }), WS)).toBe(
      'Liste de livres/'
    )
    expect(text(tool({ title: 'Listing files', rawInput: { path: `${WS}/src` } }), WS)).toBe(
      'Lecture de src'
    )
  })

  it('page web : adresse sans protocole, entière en détail', () => {
    const fetch = tool({
      title: 'webfetch',
      toolKind: 'fetch',
      rawInput: { url: 'https://example.com/doc/', format: 'markdown' }
    })
    expect(toolLabel(fetch)).toEqual({
      text: 'Page example.com/doc',
      detail: 'https://example.com/doc/'
    })
    expect(toolLabel(tool({ title: 'webfetch', toolKind: 'fetch' }))).toBeUndefined()
  })

  it('commande : son texte en code ; le titre en détail s’il en diffère ; sans commande, rien', () => {
    expect(
      toolLabel(
        tool({
          title: 'git status --short',
          toolKind: 'execute',
          rawInput: { command: 'git status --short' }
        })
      )
    ).toEqual({ text: 'git status --short', code: true })
    expect(
      toolLabel(
        tool({ title: 'Running command', toolKind: 'execute', rawInput: { command: 'pnpm test' } })
      )
    ).toEqual({ text: 'pnpm test', code: true, detail: 'Running command' })
    expect(toolLabel(tool({ title: 'npm test', toolKind: 'execute' }))).toBeUndefined()
  })

  it('réflexion, changement de mode, outil inconnu : rien, même avec une cible', () => {
    expect(toolLabel(tool({ toolKind: 'think', locations: [{ path: 'a.ts' }] }))).toBeUndefined()
    expect(toolLabel(tool({ toolKind: 'switch_mode', rawInput: { path: 'a' } }))).toBeUndefined()
    expect(toolLabel(tool({ toolKind: 'other', locations: [{ path: 'a.ts' }] }))).toBeUndefined()
    expect(toolLabel(tool({ toolKind: undefined, locations: [{ path: 'a.ts' }] }))).toBeUndefined()
  })

  it('en anglais', async () => {
    await i18next.changeLanguage('en')
    expect(text(tool({ locations: [{ path: `${WS}/src/books.js` }] }), WS)).toBe(
      'Read src/books.js'
    )
    expect(text(tool({ title: 'grep', toolKind: 'search', rawInput: { pattern: 'TODO' } }))).toBe(
      'Search “TODO”'
    )
    expect(
      text(
        tool({
          toolKind: 'edit',
          locations: [{ path: 'a.ts' }, { path: 'b.ts' }, { path: 'c.ts' }]
        })
      )
    ).toBe('Edit a.ts and 2 others')
  })
})

describe('titres bruts nettoyés (fiche 125)', () => {
  it('commande : le « cd » vers le dossier de la conversation disparaît, ses chemins sont relatifs', () => {
    expect(cleanCommand(`cd ${WS} && npm test 2>&1`, WS)).toBe('npm test 2>&1')
    expect(cleanCommand(`cd "${WS}" ; npm test`, WS)).toBe('npm test')
    expect(cleanCommand(`cd ${WS}/server && npm start`, WS)).toBe('cd server && npm start')
    expect(cleanCommand(`node ${WS}/scripts/seed.js --out ${WS}`, WS)).toBe(
      'node scripts/seed.js --out .'
    )
    // Ailleurs que dans le dossier : rien ne change.
    expect(cleanCommand('cd /tmp/autre && ls', WS)).toBe('cd /tmp/autre && ls')
    // Un dossier dont le nom commence pareil n'est pas le dossier.
    expect(cleanCommand(`cat ${WS}-copie/a.txt`, WS)).toBe(`cat ${WS}-copie/a.txt`)
    expect(cleanCommand('npm test', undefined)).toBe('npm test')
  })

  it('carte de commande : texte nettoyé en code, la commande entière en détail', () => {
    const command = `cd ${WS} && npm test 2>&1`
    // Comme Bob : le titre est la commande, `rawInput.command` aussi.
    expect(
      toolLabel(tool({ title: command, toolKind: 'execute', rawInput: { command } }), WS)
    ).toEqual({ text: 'npm test 2>&1', code: true, detail: command })
    // Sans `rawInput`, le titre est la commande.
    expect(toolLabel(tool({ title: command, toolKind: 'execute' }), WS)).toEqual({
      text: 'npm test 2>&1',
      code: true,
      detail: command
    })
  })

  it('titre sans libellé : les chemins du dossier deviennent relatifs', () => {
    expect(cleanTitle(`Running subagent: Read ${WS}/src/books.js`, WS)).toBe(
      'Running subagent: Read src/books.js'
    )
    expect(cleanTitle(`Applying diff to ${WS}/src/books.js`, WS)).toBe(
      'Applying diff to src/books.js'
    )
    expect(cleanTitle('Updating todo list', WS)).toBe('Updating todo list')
  })

  it('liste de tâches (`rawInput.todos`) : ce que fait l’outil et combien, la liste en détail', () => {
    // Comme Bob 2.0.6 : une liste à cases en texte, outil de genre « other ».
    const todos = '\n[-] Read AGENTS.md\n[ ] Run npm test\n[x] Commit\n'
    const item = tool({ title: 'Updating todo list', toolKind: 'other', rawInput: { todos } })
    expect(item.input?.todos).toEqual(['[-] Read AGENTS.md', '[ ] Run npm test', '[x] Commit'])
    expect(toolLabel(item, WS)).toEqual({
      text: 'Mise à jour de la liste de tâches (3)',
      detail: '[-] Read AGENTS.md\n[ ] Run npm test\n[x] Commit'
    })
    // Une liste en tableau d'objets (`content`) aussi.
    expect(
      toolInputOf({ todos: [{ content: 'Lire', status: 'completed' }, { content: 'Écrire' }] })
    ).toEqual({ todos: ['Lire', 'Écrire'] })
  })

  it('outil annoncé sans rien d’autre : le libellé de son genre, le titre brut en infobulle (fiche 128)', async () => {
    const text = (item: LabelledTool, workspace?: string) => toolLabel(item, workspace)?.text
    const pending = (extra: Partial<LabelledTool> & { rawInput?: unknown }) =>
      tool({ title: 'patch', toolKind: 'edit', status: 'pending', ...extra })
    expect(toolLabel(pending({}), WS)).toEqual({
      text: 'Prépare une modification…',
      detail: 'patch'
    })
    expect(text(pending({ title: 'shell', toolKind: 'execute', rawInput: { cwd: WS } }), WS)).toBe(
      'Prépare une commande…'
    )
    expect(text(pending({ toolKind: 'read' }))).toBe('Prépare une lecture…')
    expect(text(pending({ toolKind: 'search' }))).toBe('Prépare une recherche…')
    for (const toolKind of ['other', 'fetch', 'delete', 'move'] as const) {
      expect(text(pending({ toolKind }))).toBe('Prépare un outil…')
    }
    expect(text(pending({ toolKind: undefined }))).toBe('Prépare un outil…')
    await i18next.changeLanguage('en')
    expect(text(pending({}))).toBe('Preparing an edit…')
    await i18next.changeLanguage('fr')
  })

  it('« Prépare… » seulement sans cible, sans autorisation en attente, tant qu’il est annoncé', () => {
    const text = (item: LabelledTool, workspace?: string) => toolLabel(item, workspace)?.text
    const edit = (extra: Partial<LabelledTool>) =>
      tool({ title: 'patch', toolKind: 'edit', status: 'pending', ...extra })
    // Avec une cible : le libellé de la cible, comme avant.
    expect(text(edit({ locations: [{ path: 'a.ts' }] }))).toBe('Modification de a.ts')
    // Autorisation en attente : la carte dit déjà ce qu'on demande, le titre reste.
    expect(toolLabel(edit({ permission: { state: 'pending' } }))).toBeUndefined()
    // Déjà en cours ou fini : le titre de l'agent, comme avant.
    expect(toolLabel(edit({ status: 'in_progress' }))).toBeUndefined()
    expect(toolLabel(edit({ status: 'completed' }))).toBeUndefined()
    // Une commande titrée de la commande elle-même garde son titre ; une réflexion aussi.
    expect(
      toolLabel(tool({ title: 'npm test', toolKind: 'execute', status: 'pending' }))
    ).toBeUndefined()
    expect(
      toolLabel(tool({ title: 'think', toolKind: 'think', status: 'pending' }))
    ).toBeUndefined()
  })

  it('sans cible, interrompu ou en échec : le nom du genre, la carte dit l’état (C6)', () => {
    const text = (item: LabelledTool, workspace?: string) => toolLabel(item, workspace)?.text
    const ended = (status: string, extra: Partial<LabelledTool> = {}) =>
      tool({ title: 'patch', toolKind: 'edit', status, ...extra })
    expect(toolLabel(ended('cancelled'))).toEqual({ text: 'Modification', detail: 'patch' })
    expect(text(ended('failed'))).toBe('Modification')
    expect(text(ended('refused'))).toBe('Modification')
    expect(text(ended('cancelled', { title: 'shell', toolKind: 'execute' }))).toBe('Commande')
    expect(text(ended('failed', { toolKind: 'read' }))).toBe('Lecture')
    expect(text(ended('failed', { toolKind: 'fetch' }))).toBe('Page web')
    // Avec une cible, c'est elle qui parle ; fini, le titre de l'agent reste.
    expect(text(ended('cancelled', { locations: [{ path: 'a.ts' }] }))).toBe('Modification de a.ts')
    expect(toolLabel(ended('completed'))).toBeUndefined()
    expect(toolLabel(ended('cancelled', { toolKind: 'other' }))).toBeUndefined()
  })

  it('toolText : le libellé, sinon le titre nettoyé', () => {
    expect(
      toolText(
        tool({
          title: `Applying diff to ${WS}/src/books.js`,
          toolKind: 'edit',
          rawInput: { path: `${WS}/src/books.js` }
        }),
        WS
      )
    ).toBe('Modification de src/books.js')
    expect(toolText(tool({ title: `Running ${WS}/x`, toolKind: 'other' }), WS)).toBe('Running x')
  })
})

describe('Création d’un fichier et chemin de l’en-tête d’un diff (fiche 203)', () => {
  afterEach(() => i18next.changeLanguage('fr'))
  const diff = (oldText?: string | null) => ({
    type: 'diff',
    ...(oldText !== undefined ? { oldText } : {})
  })
  const edit = (content: LabelledTool['content'], extra: Partial<LabelledTool> = {}) =>
    tool({
      title: 'write',
      toolKind: 'edit',
      locations: [{ path: `${WS}/notes.md` }],
      ...(content ? { content } : {}),
      ...extra
    })

  it('création : chaque diff sans ancien texte (`null` ou absent), outil `edit`', () => {
    expect(createsFile(edit([diff(null)]))).toBe(true)
    expect(createsFile(edit([diff()]))).toBe(true)
    expect(createsFile(edit([diff(null), diff(null)]))).toBe(true)
    // Rien de deviné pour `oldText: ""` (fichier vide existant ?), ni sans diff.
    expect(createsFile(edit([diff('')]))).toBe(false)
    expect(createsFile(edit([diff('avant')]))).toBe(false)
    expect(createsFile(edit([diff(null), diff('avant')]))).toBe(false)
    expect(createsFile(edit([]))).toBe(false)
    expect(createsFile(edit(undefined))).toBe(false)
    expect(createsFile(edit([{ type: 'content' }]))).toBe(false)
    // Un autre genre qu'`edit` n'est jamais une création.
    expect(createsFile(edit([diff(null)], { toolKind: 'delete' }))).toBe(false)
    expect(createsFile(edit([diff(null)], { toolKind: 'other' }))).toBe(false)
  })

  it('« Création de notes.md », marqué `created` ; une modification reste « Modification de »', async () => {
    expect(toolLabel(edit([diff(null)]), WS)).toEqual({
      text: 'Création de notes.md',
      detail: `${WS}/notes.md`,
      created: true,
      file: { before: 'Création de ', dir: '', name: 'notes.md', after: '' }
    })
    expect(toolText(edit([diff('')]), WS)).toBe('Modification de notes.md')
    expect(toolText(edit([diff('a')]), WS)).toBe('Modification de notes.md')
    await i18next.changeLanguage('en')
    expect(toolText(edit([diff(null)]), WS)).toBe('Create notes.md')
  })

  it('ligne d’outil : nom entier (extension comprise), dossier à part, le texte autour (correctif 203)', async () => {
    const long = `${WS}/docs/guide-utilisateur-de-la-bobine-tres-long-nom-de-fichier.md`
    const label = toolLabel(
      edit([{ type: 'diff', oldText: null }], { locations: [{ path: long }] }),
      WS
    )
    // Le texte (infobulle, notification) reste raccourci au milieu ; les morceaux gardent tout.
    expect(label?.text.startsWith('Création de …')).toBe(true)
    expect(label?.file).toEqual({
      before: 'Création de ',
      dir: 'docs/',
      name: 'guide-utilisateur-de-la-bobine-tres-long-nom-de-fichier.md',
      after: ''
    })
    // Hors du dossier : `~`, comme l'en-tête du diff ; un caractère bidi rendu visible.
    const outside = toolLabel(tool({ locations: [{ path: `/Users/ada/autre/a\u202Eb.txt` }] }), WS)
    expect(outside?.file?.dir).toBe('~/autre/')
    expect(outside?.file?.name).toBe('a⟨U+202E⟩b.txt')
    await i18next.changeLanguage('en')
    expect(toolLabel(tool({ locations: [{ path: `${WS}/src/a.ts` }] }), WS)?.file).toEqual({
      before: 'Read ',
      dir: 'src/',
      name: 'a.ts',
      after: ''
    })
  })

  it('création interrompue sans cible : « Création »', () => {
    const item = tool({
      title: 'write',
      toolKind: 'edit',
      status: 'failed',
      content: [diff(null)]
    })
    expect(toolLabel(item, WS)).toEqual({ text: 'Création', created: true, detail: 'write' })
  })

  it('chemin : relatif au dossier, dossier et nom séparés', () => {
    expect(filePathParts(`${WS}/notes.md`, WS)).toEqual({ dir: '', name: 'notes.md' })
    expect(filePathParts(`${WS}/src/renderer/src/components/thread/notes.md`, WS)).toEqual({
      dir: 'src/renderer/src/components/thread/',
      name: 'notes.md'
    })
    expect(filePathParts('notes.md', WS)).toEqual({ dir: '', name: 'notes.md' })
    expect(filePathParts(WS, WS)).toEqual({ dir: '', name: 'livres/' })
  })

  it('chemin hors du dossier : avec `~` pour le dossier personnel, sinon entier', () => {
    expect(
      filePathParts('/Users/ada/Dev/autre-projet/src/configuration-par-defaut.ts', WS)
    ).toEqual({ dir: '~/Dev/autre-projet/src/', name: 'configuration-par-defaut.ts' })
    expect(filePathParts('/etc/hosts', WS)).toEqual({ dir: '/etc/', name: 'hosts' })
    // Voisin au nom qui commence pareil : pas relatif.
    expect(filePathParts(`${WS}-copie/a.md`, WS)).toEqual({
      dir: '~/Development/livres-copie/',
      name: 'a.md'
    })
    expect(filePathParts(`${WS}/a.md`, undefined)).toEqual({
      dir: '~/Development/livres/',
      name: 'a.md'
    })
  })

  it('caractères invisibles ou bidi d’un chemin : rendus visibles, dossier et nom', () => {
    const parts = filePathParts(`${WS}/src/‮gnp​/fichier‮txt.exe`, WS)
    for (const part of [parts.dir, parts.name]) {
      expect(part).not.toMatch(/[‪-‮⁦-⁩​]/)
    }
    expect(parts.dir).toContain('U+202E')
    expect(parts.dir).toContain('U+200B')
    expect(parts.name).toContain('U+202E')
  })
})
