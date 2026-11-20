import { describe, expect, it } from 'vitest'
import { filesErrorText } from './files-errors'

describe('erreurs du disque, dites en clair (mineur)', () => {
  it('accès refusé, disparu, dossier retiré ; un message déjà clair passe tel quel', () => {
    expect(
      filesErrorText(
        "Error invoking remote method 'files:list': Error: EACCES: permission denied, scandir '/p/app/secret'"
      )
    ).toBe('Accès refusé par le système.')
    expect(filesErrorText("ENOENT: no such file or directory, stat '/p/app/x'")).toBe(
      'Ce fichier ou ce dossier n’existe plus.'
    )
    expect(filesErrorText('Paramètre invalide : root')).toBe(
      'Ce dossier ne fait plus partie de la conversation.'
    )
    expect(filesErrorText('Hors des dossiers de la conversation : a')).toBe(
      'Hors des dossiers de la conversation : a'
    )
  })
})
