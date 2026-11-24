import { existsSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { backupProfile } from './conversations/backup'
import { RESTORE_JOB, RESTORE_KEEP_DIR, requestRestore } from './conversations/restore'
import { ConversationStore } from './conversations/store'
import { AppProfile } from './profile-app'
import type { ProfileStatus } from '@shared/profile'
import { profileHandlers } from './profile-ipc'
import { resetProtectedFiles, setReadOnlyProfile } from './storage'

/**
 * Le profil assemblé comme au lancement (`AppProfile`, fiches 196, 197) : ouverture, lecture des
 * fichiers, avis, puis les canaux `profile:*` branchés dessus. Remplace côté main « Afficher dans
 * le Finder montre le fichier mis de côté » (e2e `profil` n° 12) et la moitié main de
 * « restauration faite : avis de succès » (n° 26) ; l'e2e garde le vrai lancement de l'app.
 */

/** Un profil de quelques conversations, réglages et autorisations. */
function profile(conversations: string[]): string {
  const data = mkdtempSync(join(tmpdir(), 'profil-app-'))
  const dir = join(data, 'conversations')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'index.json'), JSON.stringify(conversations.map((id) => ({ id }))))
  for (const id of conversations) writeFileSync(join(dir, `${id}.json`), '{"items":[],"nextId":1}')
  writeFileSync(join(data, 'settings.json'), '{"recentWorkspaces":[],"theme":"dark"}')
  writeFileSync(join(data, 'approvals.json'), '{"sites":[]}')
  return data
}

/** Les canaux du profil, comme `index.ts` les branche (Finder et navigateur simulés). */
function channels(app: AppProfile) {
  const reveal = vi.fn()
  const handlers = profileHandlers(
    app.ipc(
      { restoreFromTrash: vi.fn(), prompt: vi.fn(async () => {}) },
      { reveal, openExternal: vi.fn(async () => {}) },
      vi.fn(async () => null),
      { relaunchAfterQuit: vi.fn() }
    )
  )
  // Synchrone dans le main ; le contrat de l'IPC l'autorise asynchrone.
  const status = () => handlers['profile:status']() as ProfileStatus
  return { handlers, reveal, status }
}

afterEach(() => {
  setReadOnlyProfile(undefined)
  resetProtectedFiles()
})

describe('profil au lancement, jusqu’aux canaux (fiches 196, 197)', () => {
  it('réglages abîmés : mis de côté, l’avis le dit, « Afficher dans le Finder » montre ce fichier', () => {
    const data = profile(['a'])
    writeFileSync(join(data, 'settings.json'), '{"theme": tronqué')
    const app = new AppProfile(data, '1.0.0')
    app.readSettings(join(data, 'settings.json'))
    const store = new ConversationStore(join(data, 'conversations'))
    store.loadIndex()
    const sent = vi.fn()
    app.loaded({ damaged: undefined }, store, sent)

    const { handlers, reveal, status: read } = channels(app)
    const status = read()
    const notice = status.notices.find((n) => n.message.key === 'profile.notice.settingsDamaged')
    expect(notice?.reveal).toBe(true)
    // L'interface ne voit jamais le chemin : elle désigne l'avis, le main sait son fichier.
    expect(JSON.stringify(status)).not.toContain('.corrupt-')
    handlers['profile:reveal'](notice?.id ?? '')
    expect(reveal).toHaveBeenCalledTimes(1)
    const shown = String(reveal.mock.calls[0]?.[0])
    expect(shown).toMatch(/settings\.json\.corrupt-/)
    expect(existsSync(shown)).toBe(true)
    // Un avis inconnu (ou fermé) ne montre rien ; un identifiant vide est refusé.
    handlers['profile:reveal']('inconnu')
    expect(reveal).toHaveBeenCalledTimes(1)
    expect(() => handlers['profile:reveal']('')).toThrow('id')
    // Fermé : l'interface est prévenue du nouvel état.
    handlers['profile:dismiss'](notice?.id ?? '')
    expect(sent).toHaveBeenCalledWith(expect.objectContaining({ notices: [] }))
  })

  it('restauration demandée : faite à l’ouverture, avis de succès, l’état d’avant se montre', async () => {
    const data = profile(['avant'])
    const backup = await backupProfile(
      profile(['sauvee']),
      mkdtempSync(join(tmpdir(), 'cible-')),
      '1.0.0'
    )
    requestRestore(data, backup)

    const app = new AppProfile(data, '1.0.0')
    expect(existsSync(join(data, RESTORE_JOB))).toBe(false)
    expect(readdirSync(join(data, 'conversations'))).toContain('sauvee.json')
    expect(readdirSync(join(data, 'conversations'))).not.toContain('avant.json')
    const { handlers, reveal, status } = channels(app)
    const [notice] = status().notices
    expect(notice).toMatchObject({
      level: 'success',
      message: { key: 'profile.notice.restored' },
      reveal: true
    })
    handlers['profile:reveal'](notice?.id ?? '')
    const kept = String(reveal.mock.calls[0]?.[0])
    expect(kept.startsWith(join(data, RESTORE_KEEP_DIR, 'avant-'))).toBe(true)
    expect(readdirSync(join(kept, 'conversations'))).toContain('avant.json')
  })

  it('sauvegarde disparue entre la demande et le lancement : avis d’échec, profil intact', () => {
    const data = profile(['a'])
    requestRestore(data, join(tmpdir(), 'bobine-sauvegarde-disparue'))
    const app = new AppProfile(data, '1.0.0')
    const { status } = channels(app)
    expect(status().notices.map((n) => [n.level, n.message.key])).toEqual([
      ['error', 'profile.notice.restoreFailed']
    ])
    expect(readdirSync(join(data, 'conversations'))).toContain('a.json')
    expect(app.readOnly()).toBe(false)
  })
})
