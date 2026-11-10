/**
 * Profil en lecture seule (fiche 196) : la mémoire se lit sans rien écrire — ni clé des
 * empreintes créée, ni temporaire balayé, ni souvenir abîmé mis de côté.
 */
import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { MemoryPlace } from '@shared/memory'
import { setReadOnlyProfile } from '../storage'
import { approvalSigner, type KeyCipher } from './approval-key'
import { MemoryStore } from './store'

const USER: MemoryPlace = { scope: 'user' }

const cipher: KeyCipher = {
  available: async () => true,
  encrypt: async (text) => Buffer.from(`chiffré:${text}`),
  decrypt: async (data) => data.toString().replace(/^chiffré:/, '')
}

/** Empreinte de tout ce qu'il y a sous un dossier, à l'octet près. */
function fingerprint(dir: string): string {
  const hash = createHash('sha256')
  const walk = (path: string) => {
    for (const name of readdirSync(path, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name)
    )) {
      const child = join(path, name.name)
      hash.update(child)
      if (name.isDirectory()) walk(child)
      else hash.update(readFileSync(child))
    }
  }
  walk(dir)
  return hash.digest('hex')
}

afterEach(() => setReadOnlyProfile(undefined))

describe('mémoire en lecture seule (fiche 196)', () => {
  it('clé absente : jamais créée, état « locked » ; rien n’est donné aux agents', async () => {
    const data = mkdtempSync(join(tmpdir(), 'profil-'))
    const file = join(data, 'memory.key')
    setReadOnlyProfile(data)
    const signer = approvalSigner(file, cipher, () => {})
    expect(await signer.state()).toBe('locked')
    expect(await signer.sign('contenu')).toBeUndefined()
    expect(existsSync(file)).toBe(false)
  })

  it('lister : temporaires et souvenirs abîmés laissés tels quels, rien d’écrit', async () => {
    const data = mkdtempSync(join(tmpdir(), 'profil-'))
    const root = join(data, 'memory')
    const dir = join(root, 'user')
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      join(dir, 'bon.md'),
      '---\nname: bon\ndescription: Un souvenir\ntype: feedback\n---\nCorps.\n'
    )
    writeFileSync(join(dir, 'abime.md'), '\u0000pas un souvenir')
    writeFileSync(join(dir, '.bon.md.tmp-1-1'), 'écriture interrompue')
    writeFileSync(join(data, 'memory.key'), 'chiffré:clé')
    const before = fingerprint(data)
    setReadOnlyProfile(data)
    const signer = approvalSigner(join(data, 'memory.key'), cipher, () => {})
    const store = new MemoryStore(root, { signer })
    await store.list(USER)
    await signer.state()
    // Écrire est refusé (verrou, ou refus de la lecture seule) : jamais un fichier.
    const written = await store
      .write(USER, { name: 'neuf', description: 'd', type: 'feedback', body: 'b' })
      .catch(() => ({ ok: false }))
    expect(written.ok).toBe(false)
    expect(fingerprint(data)).toBe(before)
  })
})
