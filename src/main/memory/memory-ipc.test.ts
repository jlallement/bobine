import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { memoryHandlers } from './memory-ipc'
import { MemoryService } from './service'
import { MemoryStore } from './store'

function setup() {
  const root = mkdtempSync(join(tmpdir(), 'memoire-ipc-'))
  const service = new MemoryService({
    store: new MemoryStore(join(root, 'memory')),
    conversations: {
      items: () => [],
      post: () => {},
      workspaceOf: () => root,
      agentLabel: () => 'Factice'
    },
    enabled: () => true
  })
  const saved = join(root, 'export.md')
  const revealed: string[] = []
  const handlers = memoryHandlers(service, {
    chooseDirectory: () => Promise.resolve(null),
    saveMarkdown: () => Promise.resolve(saved),
    reveal: (path) => revealed.push(path),
    exportTitle: () => 'Mémoire — Vous'
  })
  return { handlers, service, saved, revealed }
}

const USER = { scope: 'user' } as const
const entry = {
  name: 'pref',
  description: 'Une préférence',
  type: 'user' as const,
  body: 'Le corps.'
}

describe('IPC de la mémoire (fiche 182)', () => {
  it('modifier : mêmes validations que l’outil, secret refusé, version dépassée refusée', async () => {
    const { handlers, service } = setup()
    expect(await handlers['memory:save'](USER, { ...entry, name: '../x' }, null)).toMatchObject({
      ok: false,
      error: { code: 'name' }
    })
    expect(
      await handlers['memory:save'](USER, { ...entry, body: 'token: abcdefgh1234' }, null) // gitleaks:allow — fake value for tests
    ).toMatchObject({ ok: false, error: { code: 'secret' } })
    expect(await handlers['memory:save'](USER, entry, null)).toEqual({ ok: true })
    expect(await handlers['memory:save'](USER, entry, null)).toEqual({ ok: false, changed: true })
    const [saved] = await service.store.list(USER)
    expect(saved?.by).toBe('user')
  })

  it('arguments venus du renderer vérifiés : place, identifiant, nom', async () => {
    const { handlers } = setup()
    await expect(
      handlers['memory:list']({ scope: 'project', projectId: '../..' })
    ).rejects.toThrow()
    await expect(handlers['memory:list']({ scope: 'autre' } as never)).rejects.toThrow()
    await expect(handlers['memory:remove'](USER, '../x')).rejects.toThrow()
    await expect(handlers['memory:attach']('../user')).rejects.toThrow()
    expect(await handlers['memory:attach']('ancien-00000000')).toBeNull()
  })

  it('export dans le fichier choisi ; Finder seulement si le dossier existe', async () => {
    const { handlers, saved, revealed } = setup()
    await handlers['memory:reveal'](USER)
    expect(revealed).toEqual([])
    await handlers['memory:save'](USER, entry, null)
    expect(await handlers['memory:export'](USER)).toBe(saved)
    expect(readFileSync(saved, 'utf8')).toContain('# Mémoire — Vous')
    await handlers['memory:reveal'](USER)
    expect(revealed).toHaveLength(1)
  })
})

describe('IPC de la mémoire : relecture (fiche 182)', () => {
  it('une modification depuis l’écran garde « contenu externe »', async () => {
    const { handlers, service } = setup()
    await service.store.write(USER, { ...entry, source: 'external' })
    expect(await handlers['memory:save'](USER, { ...entry, body: 'Corrigé.' }, null)).toEqual({
      ok: false,
      changed: true
    })
    const [current] = await service.store.list(USER)
    expect(
      await handlers['memory:save'](USER, { ...entry, body: 'Corrigé.' }, current?.version ?? null)
    ).toEqual({ ok: true })
    const [saved] = await service.store.list(USER)
    expect(saved).toMatchObject({
      body: 'Corrigé.',
      source: 'external',
      by: 'user',
      approved: true
    })
  })

  it('une clé Google dans la description est refusée', async () => {
    const { handlers } = setup()
    expect(
      await handlers['memory:save'](
        USER,
        { ...entry, description: 'cle AIzaSyA1234567890abcdefghijklmnopqrstuv' }, // gitleaks:allow — fake value for tests
        null
      )
    ).toMatchObject({ ok: false, error: { code: 'secret' } })
  })
})

describe('« Garder ces modifications » (fiche 182)', () => {
  it('refusé s’il y a un secret ; accepté sinon, et le souvenir est validé', async () => {
    const { handlers, service } = setup()
    const { writeFileSync, mkdirSync } = await import('node:fs')
    const dir = service.store.dirOf(USER)
    mkdirSync(dir, { recursive: true })
    const file = (body: string) =>
      `---\nname: pose\ndescription: D\ntype: user\nupdated: 2026-11-07T00:00:00Z\n---\n\n${body}\n`
    writeFileSync(join(dir, 'pose.md'), file('token: abcdefgh1234')) // gitleaks:allow — fake value for tests
    let [entry] = await service.store.list(USER)
    expect(await handlers['memory:approve'](USER, 'pose', entry?.version ?? '')).toEqual({
      ok: false,
      reason: 'secret'
    })
    writeFileSync(join(dir, 'pose.md'), file('Sans secret.'))
    ;[entry] = await service.store.list(USER)
    expect(await handlers['memory:approve'](USER, 'pose', 'ancienne')).toEqual({
      ok: false,
      reason: 'changed'
    })
    expect(await handlers['memory:approve'](USER, 'pose', entry?.version ?? '')).toEqual({
      ok: true
    })
    expect((await service.store.get(USER, 'pose'))?.approved).toBe(true)
  })
})

describe('état de la clé des empreintes pour l’écran (fiche 182)', () => {
  it('clé illisible : `locked` dans `memory:projects`, et « Garder » refusé avec la raison', async () => {
    const root = mkdtempSync(join(tmpdir(), 'memoire-cle-'))
    const signer = {
      sign: () => Promise.resolve(undefined),
      state: () => Promise.resolve('locked' as const)
    }
    const service = new MemoryService({
      store: new MemoryStore(join(root, 'memory'), { signer }),
      conversations: {
        items: () => [],
        post: () => {},
        workspaceOf: () => root,
        agentLabel: () => 'Factice'
      },
      enabled: () => true
    })
    const handlers = memoryHandlers(service)
    expect((await handlers['memory:projects']()).keyState).toBe('locked')
    expect(await handlers['memory:save'](USER, entry, null)).toMatchObject({
      ok: false,
      error: { code: 'locked' }
    })
  })
})
