import { describe, expect, it, vi } from 'vitest'
import type { BackupCheck } from '@shared/profile'
import { profileHandlers } from './profile-ipc'
import { ProfileStatusStore } from './profile-status'
import { keepUnsaved, unsavedQuestion } from './unsaved-at-quit'

const full = Object.assign(new Error('ENOSPC'), { code: 'ENOSPC' })

describe('en quittant, des conversations non enregistrées (fiche 197)', () => {
  it('« Réessayer » par défaut, aussi pour Échap ; les conversations nommées, sans code', () => {
    const q = unsavedQuestion(['Plan', 'Écran'], full)
    expect(q.defaultId).toBe(0)
    expect(q.cancelId).toBe(0)
    expect(q.buttons[0]).toBe('Réessayer')
    expect(q.message).toMatch(/^«.Plan.» et «.Écran.» ne sont pas enregistrées$/)
    expect(q.detail).toContain('Le disque est plein')
    expect(`${q.message} ${q.detail}`).not.toContain('ENOSPC')
  })

  it('fils écrits d’abord ; l’alerte revient tant que ça échoue ; Échap ne jette rien', async () => {
    let unsaved = ['Plan']
    const ask = vi.fn(async () => 0)
    const retry = vi.fn(() => {
      if (retry.mock.calls.length === 3) unsaved = []
    })
    const note = vi.fn()
    const outcome = await keepUnsaved({
      interactive: () => true,
      unsaved: () => unsaved,
      lastError: () => full,
      retry,
      ask,
      note
    })
    expect(outcome).toBe('saved')
    expect(ask).toHaveBeenCalledTimes(2)
    expect(retry).toHaveBeenCalledTimes(3)
    expect(note).not.toHaveBeenCalled()
  })

  it('« Quitter sans les enregistrer » : on quitte ; arrêt du Mac : noté, sans alerte', async () => {
    const note = vi.fn()
    const base = { unsaved: () => ['Plan'], lastError: () => full, retry: () => {}, note }
    expect(await keepUnsaved({ ...base, interactive: () => true, ask: async () => 1 })).toBe(
      'discarded'
    )
    expect(note).not.toHaveBeenCalled()
    const ask = vi.fn(async () => 0)
    expect(await keepUnsaved({ ...base, interactive: () => false, ask })).toBe('noted')
    expect(ask).not.toHaveBeenCalled()
    expect(note).toHaveBeenCalledWith(['Plan'], full)
  })

  it('arrêt du Mac pendant l’alerte : elle se ferme, sa réponse ne compte pas, la perte est notée', async () => {
    const note = vi.fn()
    let abort = () => {}
    let system = false
    const outcome = await keepUnsaved({
      interactive: () => !system,
      unsaved: () => ['Plan'],
      lastError: () => full,
      retry: () => {},
      note,
      onAbort: (fn) => (abort = fn),
      // La boîte fermée de l'extérieur rend son bouton d'annulation (« Réessayer »).
      ask: (_q, signal) =>
        new Promise((resolve) => {
          signal.addEventListener('abort', () => resolve(0))
          setTimeout(() => {
            system = true
            abort()
          }, 5)
        })
    })
    expect(outcome).toBe('noted')
    expect(note).toHaveBeenCalledOnce()
  })

  it('sans réponse avant le délai : l’alerte se ferme et la perte est notée', async () => {
    const note = vi.fn()
    const outcome = await keepUnsaved({
      interactive: () => true,
      unsaved: () => ['Plan'],
      lastError: () => full,
      retry: () => {},
      note,
      timeoutMs: 10,
      ask: (_q, signal) =>
        new Promise((resolve) => signal.addEventListener('abort', () => resolve(0)))
    })
    expect(outcome).toBe('noted')
    expect(note).toHaveBeenCalledOnce()
  })
})

describe('canaux du profil (fiches 196, 197)', () => {
  const setup = (readOnly = false) => {
    const status = new ProfileStatusStore()
    status.readOnly = readOnly ? 'newer' : false
    status.add(
      'warning',
      { key: 'profile.notice.settingsDamaged' },
      { path: '/d/settings.json.corrupt-x' }
    )
    const ok: BackupCheck = {
      ok: true,
      folder: '/sauvegarde',
      createdAt: '2026-11-07T00:00:00Z',
      conversations: 2,
      currentConversations: 3
    }
    const deps = {
      status,
      trash: { list: vi.fn(() => []), restore: vi.fn(), erase: vi.fn() },
      reveal: vi.fn(),
      openExternal: vi.fn(),
      chooseDirectory: vi.fn(async () => '/sauvegarde'),
      checkBackup: vi.fn((folder: string): BackupCheck =>
        folder === '/sauvegarde' ? ok : { ok: false, reason: 'notBackup' }
      ),
      restore: vi.fn()
    }
    return { deps, handlers: profileHandlers(deps) }
  }

  it('un avis montre son fichier par son identifiant, jamais par un chemin venu de l’interface', async () => {
    const { deps, handlers } = setup()
    const [notice] = (await handlers['profile:status']()).notices
    expect(notice).not.toHaveProperty('path')
    handlers['profile:reveal'](notice?.id ?? '')
    handlers['profile:reveal']('/etc/passwd')
    expect(deps.reveal).toHaveBeenCalledTimes(1)
    expect(deps.reveal).toHaveBeenCalledWith('/d/settings.json.corrupt-x')
    handlers['profile:openReleases']()
    expect(deps.openExternal).toHaveBeenCalledWith('https://github.com/jlallement/bobine/releases')
  })

  it('restaurer : revérifie le dossier ; refusé si ce n’en est plus une', async () => {
    const { deps, handlers } = setup()
    expect(await handlers['backup:choose']()).toMatchObject({ ok: true })
    handlers['backup:restore']('/sauvegarde')
    expect(deps.restore).toHaveBeenCalledWith('/sauvegarde')
    expect(() => handlers['backup:restore']('/ailleurs')).toThrow()
    expect(deps.restore).toHaveBeenCalledTimes(1)
  })

  it('lecture seule : corbeille et restauration refusées, la liste se lit', async () => {
    const { deps, handlers } = setup(true)
    expect(handlers['trash:list']()).toEqual([])
    expect(() => handlers['trash:restore']('a')).toThrow()
    expect(() => handlers['trash:erase']('a')).toThrow()
    await expect(handlers['backup:choose']()).rejects.toThrow()
    expect(() => handlers['backup:restore']('/sauvegarde')).toThrow()
    expect(deps.trash.erase).not.toHaveBeenCalled()
    expect(deps.restore).not.toHaveBeenCalled()
  })
})
