import { linkSync, mkdirSync, mkdtempSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { RequestPermissionRequest } from '../../shared/acp-sdk.mts'
import { isInside, writeAreaVerdict } from './write-area'

type ToolCall = RequestPermissionRequest['toolCall']
const area = () => realpathSync(mkdtempSync(join(tmpdir(), 'discussion-')))
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

describe('écritures d’une discussion (fiche 224, relecture)', () => {
  it('document du premier niveau : accordé ; hors du dossier : refusé', () => {
    const a = area()
    expect(writeAreaVerdict(a, call([join(a, 'Synthèse.docx')]))).toEqual({
      decision: 'allow',
      file: 'Synthèse.docx'
    })
    expect(writeAreaVerdict(a, call([join(homedir(), '.zshrc')]))).toEqual({
      decision: 'refuse',
      file: join(homedir(), '.zshrc')
    })
    expect(writeAreaVerdict(a, call([join(a, '..', 'voisin.md')])).decision).toBe('refuse')
  })

  it('B2 : un diff qui vise un autre fichier compte ; dehors, refusé ; en désaccord, posé', () => {
    const a = area()
    const inside = join(a, 'a.md')
    expect(writeAreaVerdict(a, call([inside], ['/Users/x/.zshrc'])).decision).toBe('refuse')
    expect(writeAreaVerdict(a, call([], [join(a, 'b.md')])).decision).toBe('allow')
    expect(writeAreaVerdict(a, call([inside], [join(a, 'b.md')])).decision).toBe('ask')
    expect(writeAreaVerdict(a, call([inside], [inside])).decision).toBe('allow')
  })

  it('I1 : chemin relatif ou `~` jamais accordé (posé), aucune cible : posé', () => {
    const a = area()
    expect(writeAreaVerdict(a, call(['~/.ssh/authorized_keys'])).decision).toBe('ask')
    expect(writeAreaVerdict(a, call(['notes.md'])).decision).toBe('ask')
    expect(writeAreaVerdict(a, call([])).decision).toBe('ask')
    expect(isInside(a, 'notes.md')).toBe(false)
  })

  it('I2 : fichier caché ou sous-dossier, même dans le dossier : posé', () => {
    const a = area()
    for (const p of ['.bob/custom_modes.yaml', '.opencode/agent.md', 'sous/a.md', '.env'])
      expect(writeAreaVerdict(a, call([join(a, p)])).decision).toBe('ask')
  })

  it('I2 : un lien symbolique qui mène dehors rend la cible extérieure', () => {
    const a = area()
    const ailleurs = realpathSync(mkdtempSync(join(tmpdir(), 'ailleurs-')))
    symlinkSync(ailleurs, join(a, 'out'))
    writeFileSync(join(ailleurs, 'cible.txt'), 'x')
    symlinkSync(join(ailleurs, 'cible.txt'), join(a, 'lien.txt'))
    expect(writeAreaVerdict(a, call([join(a, 'out', 'authorized_keys')])).decision).toBe('refuse')
    expect(writeAreaVerdict(a, call([join(a, 'lien.txt')])).decision).toBe('refuse')
  })

  it('déplacement : jamais accordé seul (destination pas toujours dite), dehors refusé', () => {
    const a = area()
    mkdirSync(join(a, 'x'), { recursive: true })
    expect(writeAreaVerdict(a, call([join(a, 'a.md')], [], 'move')).decision).toBe('ask')
    expect(writeAreaVerdict(a, call([join(a, 'a.md'), '/tmp/b.md'], [], 'move')).decision).toBe(
      'refuse'
    )
  })

  it('fiche 230 : un fichier à plusieurs noms (lien physique) n’est jamais accordé seul : posé', () => {
    const a = area()
    const ailleurs = realpathSync(mkdtempSync(join(tmpdir(), 'ailleurs-')))
    const secret = join(ailleurs, 'secret.txt')
    writeFileSync(secret, 'à garder')
    linkSync(secret, join(a, 'Notes.md'))
    // `realpath` ne voit rien : le chemin est bien dans le dossier.
    expect(realpathSync(join(a, 'Notes.md'))).toBe(join(a, 'Notes.md'))
    for (const kind of ['edit', 'delete'] as const) {
      expect(writeAreaVerdict(a, call([join(a, 'Notes.md')], [], kind)).decision).toBe('ask')
      expect(writeAreaVerdict(a, call([], [join(a, 'Notes.md')], kind)).decision).toBe('ask')
    }
    // Même quand l'autre nom est aussi dans le dossier : prudent, posé.
    writeFileSync(join(a, 'a.md'), 'x')
    linkSync(join(a, 'a.md'), join(a, 'b.md'))
    expect(writeAreaVerdict(a, call([join(a, 'a.md')])).decision).toBe('ask')
    // Un document ordinaire ou à créer reste accordé.
    writeFileSync(join(a, 'Seul.md'), 'x')
    expect(writeAreaVerdict(a, call([join(a, 'Seul.md')])).decision).toBe('allow')
    expect(writeAreaVerdict(a, call([join(a, 'Neuf.md')])).decision).toBe('allow')
  })
})
