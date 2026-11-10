import { describe, expect, it } from 'vitest'
import { defaultWorkspaceFor, hasFolder, NO_FOLDER } from './agentless'

describe('dossier d’une conversation sans choix (fiche 093)', () => {
  it('l’app : aucun, l’agent attend le choix de l’utilisateur', () => {
    expect(defaultWorkspaceFor({}, false, '/donnees/workspace')).toBeUndefined()
    expect(hasFolder(NO_FOLDER)).toBe(false)
    expect(hasFolder('/projet')).toBe(true)
  })

  it('essais (dossier de données imposé) : le dossier neutre, comme avant', () => {
    expect(defaultWorkspaceFor({}, true, '/donnees/workspace')).toBe('/donnees/workspace')
  })

  it('BOBINE_DEFAULT_WORKSPACE : imposé, ou vide pour un premier lancement réel en essai', () => {
    const env = { BOBINE_DEFAULT_WORKSPACE: '/ailleurs' }
    expect(defaultWorkspaceFor(env, false, '/donnees/workspace')).toBe('/ailleurs')
    expect(defaultWorkspaceFor({ BOBINE_DEFAULT_WORKSPACE: '' }, true, '/x')).toBeUndefined()
  })
})
