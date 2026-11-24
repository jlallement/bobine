import { describe, expect, it } from 'vitest'
import { runCommand } from './run'

// Vrai processus enfant (Node lui-même) : c'est le tube réel qui casse, pas un double.
describe('runCommand', () => {
  it('rend la sortie d’un enfant qui lit son entrée', async () => {
    const result = await runCommand(
      process.execPath,
      ['-e', 'process.stdin.pipe(process.stdout)'],
      { input: 'bonjour' }
    )
    expect(result.code).toBe(0)
    expect(result.stdout.toString()).toBe('bonjour')
  })

  // Run 45289731873 (1.1.0-rc.1, Linux) : `git check-ignore --stdin` hors dépôt sort sans lire
  // son entrée ; l'écriture dans le tube fermé levait « write EPIPE » non géré dans le main.
  it('un enfant sorti sans lire son entrée : code rendu, aucune exception non gérée', async () => {
    const uncaught: unknown[] = []
    const onUncaught = (error: unknown) => uncaught.push(error)
    process.on('uncaughtException', onUncaught)
    try {
      // Plus gros que le tampon d'un tube (64 Kio) : l'écriture attend encore quand l'enfant sort.
      const input = Buffer.alloc(8 * 1024 * 1024, 'a')
      const result = await runCommand(process.execPath, ['-e', 'process.exit(3)'], { input })
      expect(result.code).toBe(3)
      // L'erreur du tube peut arriver juste après la fin de l'enfant : laisser passer un tour.
      await new Promise((resolve) => setTimeout(resolve, 50))
      expect(uncaught).toEqual([])
    } finally {
      process.off('uncaughtException', onUncaught)
    }
  })
})
