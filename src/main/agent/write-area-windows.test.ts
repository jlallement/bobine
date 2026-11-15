/**
 * Zone d'écriture d'une discussion sous Windows (fiche 229, lot 3), jouée sur le Mac par
 * `path.win32` et un petit disque NTFS simulé : les comportements de `lstat` et `realpath` y sont
 * ceux relevés dans la VM Windows 11 (jonction et lien symbolique : `isFile()` faux, `realpath`
 * suit ; lien physique : `nlink` ; `realpath` JS garde la casse et les noms 8.3 qu'on lui donne).
 */
import { win32 } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { RequestPermissionRequest } from '../../shared/acp-sdk.mts'
import { isInside, writeAreaVerdict, type WriteAreaSystem } from './write-area'

type ToolCall = RequestPermissionRequest['toolCall']

const AREA = 'C:\\Users\\ada\\AppData\\Roaming\\Bobine\\discussions\\d1'
const OUTSIDE = 'C:\\Users\\ada\\.ssh'

/** Disque simulé : fichiers (avec `nlink`), dossiers, liens (jonctions comprises) vers une cible. */
interface Entry {
  type: 'file' | 'dir' | 'link'
  nlink?: number
  target?: string
}
const key = (p: string) => win32.resolve(p).toLowerCase()
const enoent = () => Object.assign(new Error('ENOENT'), { code: 'ENOENT' })

function disk(entries: Record<string, Entry>): WriteAreaSystem {
  const table = new Map(Object.entries(entries).map(([p, e]) => [key(p), e]))
  const realpath = (p: string): string => {
    // Comme `fs.realpathSync` (JS) : segment par segment, la casse de l'entrée gardée, liens suivis.
    const { root } = win32.parse(win32.resolve(p))
    const names = win32.resolve(p).slice(root.length).split('\\').filter(Boolean)
    let real = root
    for (const name of names) {
      real = win32.join(real, name)
      const entry = table.get(key(real))
      if (!entry) throw enoent()
      if (entry.type === 'link') real = realpath(entry.target ?? '')
    }
    return real
  }
  return {
    path: win32,
    realpath,
    lstat: (p) => {
      const entry = table.get(key(p))
      if (!entry) throw enoent()
      return { isFile: () => entry.type === 'file', nlink: entry.nlink ?? 1 }
    },
    windows: true
  }
}

const BASE: Record<string, Entry> = {
  'C:\\Users': { type: 'dir' },
  'C:\\Users\\ada': { type: 'dir' },
  'C:\\Users\\ada\\AppData': { type: 'dir' },
  'C:\\Users\\ada\\AppData\\Roaming': { type: 'dir' },
  'C:\\Users\\ada\\AppData\\Roaming\\Bobine': { type: 'dir' },
  'C:\\Users\\ada\\AppData\\Roaming\\Bobine\\discussions': { type: 'dir' },
  [AREA]: { type: 'dir' },
  [`${AREA}\\Notes.md`]: { type: 'file' },
  [OUTSIDE]: { type: 'dir' },
  [`${OUTSIDE}\\id_ed25519`]: { type: 'file', nlink: 2 }
}
const sys = (extra: Record<string, Entry> = {}) => disk({ ...BASE, ...extra })

const call = (
  locations: string[],
  diffs: string[] = [],
  kind: ToolCall['kind'] = 'edit'
): ToolCall => ({
  toolCallId: 't',
  kind,
  locations: locations.map((path) => ({ path })),
  content: diffs.map((path) => ({ type: 'diff' as const, path, oldText: null, newText: 'x' }))
})
const verdict = (
  paths: string[],
  s = sys(),
  diffs: string[] = [],
  kind: ToolCall['kind'] = 'edit'
) => writeAreaVerdict(AREA, call(paths, diffs, kind), s)
const ASK = { decision: 'ask' }

describe('zone d’écriture sous Windows (path.win32, fiche 229)', () => {
  it('document du premier niveau, existant ou à créer : accordé', () => {
    expect(verdict([`${AREA}\\Notes.md`])).toEqual({ decision: 'allow', file: 'Notes.md' })
    expect(verdict([`${AREA}\\Synthèse.docx`])).toEqual({
      decision: 'allow',
      file: 'Synthèse.docx'
    })
  })

  it('séparateurs `/` et casse différente : le même dossier', () => {
    expect(verdict([`${AREA.replace(/\\/g, '/')}/Notes.md`]).decision).toBe('allow')
    expect(verdict([`${AREA.toUpperCase()}\\NOTES.MD`]).decision).toBe('allow')
    const lower = `${AREA.toLowerCase()}\\notes.md`
    expect(verdict([`${AREA}\\Notes.md`], sys(), [lower]).decision).toBe('allow')
  })

  it('hors du dossier : refusé (autre dossier, voisin, `..`, autre lecteur)', () => {
    expect(verdict([`${OUTSIDE}\\config`])).toEqual({
      decision: 'refuse',
      file: `${OUTSIDE}\\config`
    })
    expect(verdict([`${AREA}-copie\\a.md`]).decision).toBe('refuse')
    expect(verdict([`${AREA}\\..\\d2\\a.md`]).decision).toBe('refuse')
    expect(verdict(['D:\\a.md']).decision).toBe('refuse')
    expect(verdict([`D${AREA.slice(1)}\\a.md`]).decision).toBe('refuse')
  })

  it('jonction ou lien symbolique de dossier vers ailleurs : refusé', () => {
    const s = sys({ [`${AREA}\\docs`]: { type: 'link', target: OUTSIDE } })
    expect(verdict([`${AREA}\\docs\\config`], s)).toEqual({
      decision: 'refuse',
      file: `${AREA}\\docs\\config`
    })
    expect(verdict([`${AREA}\\docs\\id_ed25519`], s).decision).toBe('refuse')
    expect(verdict([`${AREA}\\DOCS\\id_ed25519`], s).decision).toBe('refuse')
  })

  it('lien symbolique de fichier : refusé s’il mène dehors, posé s’il reste dedans', () => {
    const out = sys({ [`${AREA}\\lien.txt`]: { type: 'link', target: `${OUTSIDE}\\id_ed25519` } })
    expect(verdict([`${AREA}\\lien.txt`], out).decision).toBe('refuse')
    const inside = sys({ [`${AREA}\\lien.txt`]: { type: 'link', target: `${AREA}\\Notes.md` } })
    expect(verdict([`${AREA}\\lien.txt`], inside)).toEqual(ASK)
  })

  it('lien physique (`fsutil hardlink`, nlink > 1) : posé (fiche 230)', () => {
    const s = sys({ [`${AREA}\\hard.txt`]: { type: 'file', nlink: 2 } })
    expect(verdict([`${AREA}\\hard.txt`], s)).toEqual(ASK)
  })

  it('point ou espace final : posé (`hard.txt.` écrirait dans `hard.txt`)', () => {
    const s = sys({ [`${AREA}\\hard.txt`]: { type: 'file', nlink: 2 } })
    // Node ne voit pas `hard.txt.` (relevé : ENOENT) : sans la règle, « à créer », donc accordé.
    expect(verdict([`${AREA}\\hard.txt.`], s)).toEqual(ASK)
    expect(verdict([`${AREA}\\hard.txt `], s)).toEqual(ASK)
    expect(verdict([`${AREA}\\docs.\\x.md`])).toEqual(ASK)
    expect(verdict([`${AREA}\\...`])).toEqual(ASK)
  })

  it('noms réservés, avec ou sans extension, toute casse : posés', () => {
    const names = [
      'NUL',
      'con',
      'CON.txt',
      'aux.md',
      'COM1',
      'lpt9.log',
      'COM¹',
      'CONOUT$',
      'nul .txt'
    ]
    for (const name of names) expect(verdict([`${AREA}\\${name}`]), name).toEqual(ASK)
  })

  it('flux de données alternatif : posé, sur un document comme sur le dossier', () => {
    expect(verdict([`${AREA}\\Notes.md:Zone.Identifier`])).toEqual(ASK)
    expect(verdict([`${AREA}\\Notes.md::$DATA`])).toEqual(ASK)
    expect(verdict([`${AREA}:flux`])).toEqual(ASK)
  })

  it('nom court 8.3 (alias possible d’un nom caché) : posé', () => {
    expect(verdict([`${AREA}\\ENV~1`])).toEqual(ASK)
    const short = 'C:\\Users\\ada\\APPDAT~1\\Roaming\\Bobine\\discussions\\d1\\a.md'
    expect(verdict([short])).toEqual(ASK)
  })

  it('caractères interdits : posé', () => {
    for (const name of ['a<b.md', 'a>b.md', 'a"b.md', 'a|b.md', 'a?.md', 'a*.md', 'a\u0001.md'])
      expect(verdict([`${AREA}\\${name}`]), name).toEqual(ASK)
  })

  it('noms qui agissent dans l’Explorateur : posés', () => {
    const names = [
      'desktop.ini',
      'Desktop.INI',
      'autorun.inf',
      'a.lnk',
      'site.URL',
      'x.scf',
      'b.library-ms'
    ]
    for (const name of names) expect(verdict([`${AREA}\\${name}`]), name).toEqual(ASK)
  })

  it('autres formes de chemin (UNC, préfixes, racine du lecteur, Git Bash) : posées', () => {
    const paths = [
      `\\\\?\\${AREA}\\a.md`,
      `\\\\.\\${AREA}\\a.md`,
      `\\\\localhost\\C$${AREA.slice(2)}\\a.md`,
      '\\\\wsl$\\Ubuntu\\home\\ada\\a.md',
      `${AREA.slice(2)}\\a.md`,
      '/c/Users/ada/AppData/Roaming/Bobine/discussions/d1/a.md'
    ]
    for (const path of paths) expect(verdict([path]), path).toEqual(ASK)
  })

  it('relatif au lecteur (`C:a.md`) : pas absolu, posé', () => {
    expect(verdict(['C:a.md'])).toEqual(ASK)
  })

  it('une cible douteuse parmi d’autres : posé, même si une autre sort du dossier', () => {
    expect(verdict([`${AREA}\\NUL`, `${OUTSIDE}\\config`])).toEqual(ASK)
  })

  it('fichier caché, sous-dossier, déplacement : posés comme ailleurs', () => {
    expect(verdict([`${AREA}\\.bob\\x`])).toEqual(ASK)
    expect(verdict([`${AREA}\\.env`])).toEqual(ASK)
    expect(verdict([`${AREA}\\sous\\a.md`])).toEqual(ASK)
    expect(verdict([`${AREA}\\sous/a.md`])).toEqual(ASK)
    expect(verdict([`${AREA}\\a.md`], sys(), [], 'move')).toEqual(ASK)
  })

  it('dossier de la discussion absent : posé', () => {
    expect(verdict([`${AREA}\\a.md`], disk({ 'C:\\Users': { type: 'dir' } }))).toEqual(ASK)
  })

  it('isInside sans casse, entre lecteurs', () => {
    expect(isInside('C:\\A\\b', 'c:\\a\\B\\x', win32)).toBe(true)
    expect(isInside('C:\\A\\b', 'D:\\A\\b\\x', win32)).toBe(false)
    expect(isInside('C:\\A\\b', 'C:\\A\\bc', win32)).toBe(false)
    expect(isInside('C:\\A\\b', 'C:x', win32)).toBe(false)
  })
})
