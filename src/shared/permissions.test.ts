import { describe, expect, it } from 'vitest'
import { permissionOptionLabel, rememberableTool, rememberedToolText } from './permissions'

describe('autorisations retenues (fiche 042)', () => {
  it('outils sans effet sur les fichiers : retenus par leur titre', () => {
    expect(rememberableTool({ title: 'Updating todo list', kind: 'other' })).toBe(
      'Updating todo list'
    )
    expect(rememberableTool({ title: 'Running Mot Secret (essai-app)' })).toBe(
      'Running Mot Secret (essai-app)'
    )
  })

  it('Réglages : « Updating todo list » dit dans la langue, un titre inconnu tel quel (fiche 214)', () => {
    expect(rememberedToolText('Updating todo list')).toBe('Mise à jour de la liste de tâches')
    expect(rememberedToolText('  updating TODO list ')).toBe('Mise à jour de la liste de tâches')
    expect(rememberedToolText('Running Mot Secret (essai-app)')).toBe(
      'Running Mot Secret (essai-app)'
    )
  })

  it('modifications, commandes et titres avec un chemin : jamais', () => {
    expect(rememberableTool({ title: 'Searching and replacing', kind: 'edit' })).toBeUndefined()
    expect(rememberableTool({ title: 'npm test', kind: 'execute' })).toBeUndefined()
    expect(
      rememberableTool({ title: 'Writing file /Users/x/a.txt', kind: 'other' })
    ).toBeUndefined()
    expect(rememberableTool({ title: 'Lire ./src/a.ts' })).toBeUndefined()
    expect(rememberableTool({ title: 'Lire ~/notes.md' })).toBeUndefined()
    expect(rememberableTool({ title: '  ' })).toBeUndefined()
  })
})

describe('libellé des options d’autorisation (recette 0.11, C5)', () => {
  const bob = [
    { kind: 'allow_once', name: 'Allow once' },
    { kind: 'allow_always', name: 'Always allow' },
    { kind: 'reject_once', name: 'Reject' }
  ]
  it('genre ACP connu et unique : le libellé de l’app', () => {
    expect(bob.map((o) => permissionOptionLabel(o, bob))).toEqual([
      { key: 'permissionOption.allow_once' },
      { key: 'permissionOption.allow_always' },
      { key: 'permissionOption.reject_once' }
    ])
    const always = { kind: 'reject_always', name: 'Never' }
    expect(permissionOptionLabel(always, [always])).toEqual({
      key: 'permissionOption.reject_always'
    })
  })

  it('deux options du même genre : le nom de l’agent, seul à les distinguer', () => {
    const options = [
      { kind: 'allow_once', name: 'Allow this command' },
      { kind: 'allow_once', name: 'Allow in this folder' },
      { kind: 'reject_once', name: 'Reject' }
    ]
    expect(options.map((o) => permissionOptionLabel(o, options))).toEqual([
      { text: 'Allow this command' },
      { text: 'Allow in this folder' },
      { key: 'permissionOption.reject_once' }
    ])
  })

  it('genre inconnu : le nom de l’agent ; réponse déjà donnée : le genre suffit', () => {
    const odd = { kind: 'allow_forever', name: 'Forever' }
    expect(permissionOptionLabel(odd, [odd])).toEqual({ text: 'Forever' })
    expect(permissionOptionLabel({ kind: 'allow_once', name: 'Allow once' })).toEqual({
      key: 'permissionOption.allow_once'
    })
  })
})
