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

  it('accueil dû en essai : aucun dossier, l’agent attend le choix (fiche 242, D17)', () => {
    // `--user-data-dir` avec `BOBINE_ONBOARDING=1` (pilote, recette du 2026-11-17) : l'agent par
    // défaut démarrait dans le dossier neutre avant que l'utilisateur ait choisi un agent.
    expect(defaultWorkspaceFor({}, true, '/donnees/workspace', true)).toBeUndefined()
    // Un dossier imposé explicitement reste imposé.
    expect(defaultWorkspaceFor({ BOBINE_DEFAULT_WORKSPACE: '/a' }, true, '/x', true)).toBe('/a')
  })
})
