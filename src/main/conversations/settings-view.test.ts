import { describe, expect, it } from 'vitest'
import { SettingsStore } from '../settings-store'
import { settingsViewOf } from './settings-view'

describe('vue des réglages (fiche 272)', () => {
  it('le dossier de repli interne de l’app n’est jamais un dossier récent', () => {
    const store = new SettingsStore({
      initial: { recentWorkspaces: ['/profil/workspace', '/projets/carnet'] },
      save: () => {},
      profiles: []
    })
    const view = settingsViewOf({ profileId: 'mock', workspace: '/projets/carnet' }, store, {
      profiles: [],
      pathEnv: () => undefined,
      neutralFolder: '/profil/workspace'
    })
    expect(view.recentWorkspaces).toEqual(['/projets/carnet'])
  })
})
