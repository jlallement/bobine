import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Choix du mode d'écran du runner macOS (fiche 250) : seule la partie sans écran se teste ici ;
// le changement de mode et sa vérification ne se prouvent que sur GitHub.
const SCRIPT = join(import.meta.dirname, 'macos-screen.sh')

/** Sortie de `displayplacer list` (format de la 1.4.0) avec ces lignes de modes. */
function list(modes: string[], main = true): string {
  return [
    'Persistent screen id: 37D8832A-2D66-02CA-B9F7-8F30A301B230',
    'Contextual screen id: 1',
    'Type: 20 inch external screen',
    'Resolution: 1024x768',
    `Origin: (0,0)${main ? ' - main display' : ''}`,
    'Resolutions for rotation 0:',
    ...modes.map((mode, n) => `  mode ${n}: ${mode}`),
    '',
    'Execute the command below to set your screens to the current arrangement:',
    'displayplacer "id:37D8832A-2D66-02CA-B9F7-8F30A301B230 res:1024x768 origin:(0,0) degree:0"'
  ].join('\n')
}

function choose(input: string): { status: number | null; stdout: string } {
  const run = spawnSync('bash', [SCRIPT, '--choisir'], { input, encoding: 'utf8' })
  return { status: run.status, stdout: run.stdout.trim() }
}

const ID = '37D8832A-2D66-02CA-B9F7-8F30A301B230'

describe('macos-screen.sh --choisir', () => {
  it('prend 1920x1080 sans mise à l’échelle quand il est offert, même s’il y a plus grand', () => {
    const modes = [
      'res:1024x768 color_depth:8 <-- current mode',
      'res:1920x1080 hz:60 color_depth:8 scaling:on',
      'res:1920x1080 hz:60 color_depth:8',
      'res:2560x1440 hz:60 color_depth:8'
    ]
    expect(choose(list(modes))).toEqual({ status: 0, stdout: `${ID} 2 1920x1080` })
  })

  it('prend 1920x1080 mis à l’échelle s’il n’y a que lui', () => {
    const modes = ['res:1024x768 color_depth:8', 'res:1920x1080 hz:60 color_depth:8 scaling:on']
    expect(choose(list(modes))).toEqual({ status: 0, stdout: `${ID} 1 1920x1080` })
  })

  it('prend le plus grand mode à défaut de 1920x1080', () => {
    const modes = ['res:1024x768 color_depth:8', 'res:2560x1440 hz:60', 'res:1440x900 hz:60']
    expect(choose(list(modes))).toEqual({ status: 0, stdout: `${ID} 1 2560x1440` })
  })

  it('rend le seul mode offert (la vérification qui suit dira l’échec)', () => {
    expect(choose(list(['res:1024x768 color_depth:8 <-- current mode']))).toEqual({
      status: 0,
      stdout: `${ID} 0 1024x768`
    })
  })

  it('échoue sans écran principal ou sans mode', () => {
    expect(choose(list(['res:1920x1080 hz:60'], false)).status).toBe(1)
    expect(choose('rien').status).toBe(1)
  })
})
