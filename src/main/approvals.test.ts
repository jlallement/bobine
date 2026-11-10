import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { ApprovalStore } from './approvals'

const fileIn = () => join(mkdtempSync(join(tmpdir(), 'approbations-')), 'approvals.json')

describe('ApprovalStore (fiche 072)', () => {
  it('sites et commandes retenus, relus au lancement suivant, révocables', () => {
    const file = fileIn()
    const changed = vi.fn()
    const store = new ApprovalStore(file, changed)
    store.sites.add('github.com')
    store.sites.add('github.com')
    store.commands.add('/projet', 'pnpm dev')
    store.commands.add('/projet', 'pnpm test')
    store.commands.add('/autre', 'make')
    expect(changed).toHaveBeenCalledTimes(4)

    const again = new ApprovalStore(file)
    expect(again.sites.has('github.com')).toBe(true)
    expect(again.sites.has('gitlab.com')).toBe(false)
    expect(again.commands.has('/projet', 'pnpm dev')).toBe(true)
    // Retenue pour un dossier, pas pour un autre.
    expect(again.commands.has('/autre', 'pnpm dev')).toBe(false)
    expect(again.view()).toEqual({
      sites: ['github.com'],
      commands: [
        { workspace: '/autre', commands: ['make'] },
        { workspace: '/projet', commands: ['pnpm dev', 'pnpm test'] }
      ],
      worktreeSetups: []
    })

    again.forgetSite('github.com')
    again.forgetCommand('/autre', 'make')
    expect(new ApprovalStore(file).view()).toEqual({
      sites: [],
      commands: [{ workspace: '/projet', commands: ['pnpm dev', 'pnpm test'] }],
      worktreeSetups: []
    })
  })

  it('préparation des worktrees (fiche 175) : par dépôt et empreinte, révocable', () => {
    const file = fileIn()
    const store = new ApprovalStore(file)
    expect(store.worktreeSetups.approved('/repo', 'f1')).toBe(false)
    store.worktreeSetups.approve('/repo', 'f1', { setup: 'pnpm install' })
    const again = new ApprovalStore(file)
    expect(again.worktreeSetups.approved('/repo', 'f1')).toBe(true)
    // Commandes changées : autre empreinte, l'accord ne vaut plus.
    expect(again.worktreeSetups.approved('/repo', 'f2')).toBe(false)
    expect(again.worktreeSetups.approved('/autre', 'f1')).toBe(false)
    expect(again.view().worktreeSetups).toEqual([{ root: '/repo', setup: 'pnpm install' }])
    again.forgetWorktreeSetup('/repo')
    expect(new ApprovalStore(file).worktreeSetups.approved('/repo', 'f1')).toBe(false)
  })

  it('abonnés posés après coup (fiche 089) : prévenus, puis plus après désabonnement', () => {
    const store = new ApprovalStore(fileIn())
    const listener = vi.fn()
    const unsubscribe = store.onChange(listener)
    store.sites.add('github.com')
    store.forgetSite('github.com')
    unsubscribe()
    store.sites.add('gitlab.com')
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('fichier absent ou abîmé : rien de retenu, sans erreur', () => {
    expect(new ApprovalStore(fileIn()).view()).toEqual({
      sites: [],
      commands: [],
      worktreeSetups: []
    })
    const file = fileIn()
    writeFileSync(file, '{ pas du json')
    const store = new ApprovalStore(file)
    expect(store.view()).toEqual({ sites: [], commands: [], worktreeSetups: [] })
    store.sites.add('exemple.com')
    expect(JSON.parse(readFileSync(file, 'utf8'))).toMatchObject({ sites: ['exemple.com'] })
  })

  it('valeurs mal formées ignorées', () => {
    const file = fileIn()
    writeFileSync(
      file,
      JSON.stringify({
        sites: ['ok.com', 3, ''],
        commands: { '/p': ['a', null], '/vide': [] },
        worktreeSetups: { '/r': { fingerprint: 'f', setup: 'make', archive: 4 }, '/x': {} }
      })
    )
    expect(new ApprovalStore(file).view()).toEqual({
      sites: ['ok.com'],
      commands: [{ workspace: '/p', commands: ['a'] }],
      worktreeSetups: [{ root: '/r', setup: 'make' }]
    })
  })
})
