import { describe, expect, it } from 'vitest'
import { ipcErrorText } from './ipc-errors'

describe('ipcErrorText', () => {
  it('retire le préfixe d’Electron et le nom de l’erreur, garde la cause', () => {
    expect(
      ipcErrorText(new Error("Error invoking remote method 'app:install': Error: Copie impossible"))
    ).toBe('Copie impossible')
    expect(
      ipcErrorText(new Error("Error invoking remote method 'mcp:test': TypeError: fetch failed"))
    ).toBe('fetch failed')
    // Erreur nommée sans « Error » (délai d'un réglage, fiche 253).
    expect(
      ipcErrorText(
        new Error(
          "Error invoking remote method 'agent:setControl': AgentTimeout: L’agent n’a pas appliqué « Mode » en 30 s."
        )
      )
    ).toBe('L’agent n’a pas appliqué « Mode » en 30 s.')
    expect(ipcErrorText(new Error("Error invoking remote method 'git:diff': pas de dépôt"))).toBe(
      'pas de dépôt'
    )
  })

  it('autre erreur ou valeur levée : inchangée', () => {
    expect(ipcErrorText(new Error('Error: reste tel quel'))).toBe('Error: reste tel quel')
    expect(ipcErrorText('texte')).toBe('texte')
  })

  it('refus de la lecture seule (fiche 196) : dit dans la langue de l’interface, jamais brut', () => {
    const raw = new Error(
      "Error invoking remote method 'conversation:delete': Error: BOBINE_PROFILE_READ_ONLY: Lecture seule…"
    )
    expect(ipcErrorText(raw)).toBe('Cette version ne peut pas modifier ce profil.')
  })
})
