import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { findPackageDir } from './third-party/packages.mts'

/** Un magasin pnpm d'essai : `.pnpm/<dossier>/node_modules/<nom>/package.json`. */
function store(entries: Record<string, { name: string; version: string }>): string {
  const root = mkdtempSync(join(tmpdir(), 'avis-'))
  for (const [dir, pkg] of Object.entries(entries)) {
    const at = join(root, 'node_modules', '.pnpm', dir, 'node_modules', pkg.name)
    mkdirSync(at, { recursive: true })
    writeFileSync(join(at, 'package.json'), JSON.stringify(pkg))
  }
  return root
}

describe('avis de licence : dossier d’un paquet dans le magasin pnpm', () => {
  it('nom complet (macOS, Linux) : comme avant', () => {
    const root = store({
      'yaml@2.8.1': { name: 'yaml', version: '2.8.1' },
      '@floating-ui+react-dom@2.1.9_react@19.2.0': {
        name: '@floating-ui/react-dom',
        version: '2.1.9'
      }
    })
    expect(findPackageDir(root, { name: 'yaml', version: '2.8.1' })).toContain('yaml@2.8.1')
    expect(findPackageDir(root, { name: '@floating-ui/react-dom', version: '2.1.9' })).toContain(
      '@floating-ui+react-dom@2.1.9_react'
    )
  })

  it('nom raccourci par pnpm sous Windows (hachage) : trouvé par sa version', () => {
    const root = store({
      '@floating-ui+react-dom@2.1._c645c4d66c08a969d8ea8e3044efd0cf': {
        name: '@floating-ui/react-dom',
        version: '2.1.9'
      }
    })
    expect(findPackageDir(root, { name: '@floating-ui/react-dom', version: '2.1.9' })).toContain(
      '@floating-ui+react-dom@2.1._c645c4'
    )
  })

  it('nom raccourci avant même la version (Windows) : trouvé par son contenu', () => {
    const root = store({
      '@radix-ui+react-compose-ref_b3d765b39c685001f44067d66c248108': {
        name: '@radix-ui/react-compose-refs',
        version: '1.1.5'
      }
    })
    expect(
      findPackageDir(root, { name: '@radix-ui/react-compose-refs', version: '1.1.5' })
    ).toContain('@radix-ui+react-compose-ref_b3d765')
  })

  it('jamais un autre paquet au nom proche, ni une autre version', () => {
    const root = store({
      'yaml-lint@2.8.1': { name: 'yaml-lint', version: '2.8.1' },
      'yaml@2.7.0': { name: 'yaml', version: '2.7.0' }
    })
    expect(() => findPackageDir(root, { name: 'yaml', version: '2.8.1' })).toThrow(/introuvable/)
  })
})
