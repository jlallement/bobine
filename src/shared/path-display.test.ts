import { afterEach, describe, expect, it } from 'vitest'
import { cleanCommand, cleanTitle, filePathParts } from './tool-label'
import {
  currentHomeFolder,
  homeArgument,
  homeFromArgv,
  setHomeFolder,
  shortenHomeIn,
  shortFolderPath
} from './path-display'

const WS = '/private/tmp/claude-501/x/scratchpad/banc/risque-sans/projet'
const HOME = '/Users/ada'

afterEach(() => setHomeFolder(undefined))

describe('shortFolderPath (fiche 214)', () => {
  it('dossier de la conversation : son nom ; sous-dossier : le nom puis le reste', () => {
    expect(shortFolderPath(WS, { workspace: WS })).toBe('projet')
    expect(shortFolderPath(`${WS}/`, { workspace: `${WS}/` })).toBe('projet')
    expect(shortFolderPath(`${WS}/src//./renderer/`, { workspace: WS })).toBe('projet/src/renderer')
  })

  it('dossier personnel : `~`', () => {
    expect(shortFolderPath('/Users/ada', { home: HOME })).toBe('~')
    expect(shortFolderPath('/Users/ada/Dev/notes', { home: `${HOME}/` })).toBe('~/Dev/notes')
  })

  it('le dossier de la conversation l’emporte sur le dossier personnel', () => {
    expect(
      shortFolderPath('/Users/ada/projets/livres/src', {
        workspace: '/Users/ada/projets/livres',
        home: HOME
      })
    ).toBe('livres/src')
    expect(
      shortFolderPath('/Users/ada/projets/autre', {
        workspace: '/Users/ada/projets/livres',
        home: HOME
      })
    ).toBe('~/projets/autre')
  })

  it('ailleurs, ou au moindre doute : rien (le chemin reste entier)', () => {
    const ctx = { workspace: WS, home: HOME }
    expect(shortFolderPath('/private/tmp/ailleurs', ctx)).toBeUndefined()
    // Voisins au nom qui commence pareil.
    expect(shortFolderPath(`${WS}-copie/src`, ctx)).toBeUndefined()
    expect(shortFolderPath('/Users/adam/x', ctx)).toBeUndefined()
    // `..`, relatif, `~`, variable : jamais devinés.
    expect(shortFolderPath(`${WS}/../projet`, ctx)).toBeUndefined()
    expect(shortFolderPath('/Users/ada/a/../b', ctx)).toBeUndefined()
    expect(shortFolderPath('src', ctx)).toBeUndefined()
    expect(shortFolderPath('~/x', ctx)).toBeUndefined()
    expect(shortFolderPath('$HOME/x', ctx)).toBeUndefined()
    expect(shortFolderPath(`${WS}/$SUB`, ctx)).toBeUndefined()
    // Racine : jamais « le dossier de la conversation ».
    expect(shortFolderPath('/src', { workspace: '/' })).toBeUndefined()
    expect(shortFolderPath('/x', { home: '/' })).toBeUndefined()
    // Rien à comparer.
    expect(shortFolderPath(WS, {})).toBeUndefined()
    expect(shortFolderPath('', ctx)).toBeUndefined()
  })
})

describe('shortenHomeIn : texte libre (fiche 214)', () => {
  it('le dossier personnel devient `~` aux limites de mot', () => {
    expect(shortenHomeIn('cat /Users/ada/notes.md', HOME)).toBe('cat ~/notes.md')
    expect(shortenHomeIn('cp a "/Users/ada/b c" && ls /Users/ada', HOME)).toBe(
      'cp a "~/b c" && ls ~'
    )
    expect(shortenHomeIn('FOO=/Users/ada/x', HOME)).toBe('FOO=~/x')
    expect(shortenHomeIn('(/Users/ada)', HOME)).toBe('(~)')
  })

  it('pas un autre utilisateur, pas un chemin qui le contient plus loin, pas sans dossier connu', () => {
    expect(shortenHomeIn('ls /Users/adam/x', HOME)).toBe('ls /Users/adam/x')
    expect(shortenHomeIn('ls /srv/Users/ada/x', HOME)).toBe('ls /srv/Users/ada/x')
    expect(shortenHomeIn('ls /Users/ada/x', undefined)).toBe('ls /Users/ada/x')
    expect(shortenHomeIn('ls /x', '/')).toBe('ls /x')
    expect(shortenHomeIn('ls /x', 'relatif')).toBe('ls /x')
  })

  it('un dossier personnel avec des caractères spéciaux n’est pas une expression régulière', () => {
    expect(shortenHomeIn('ls /Users/a.b+c/x', '/Users/a.b+c')).toBe('ls ~/x')
    expect(shortenHomeIn('ls /Users/aXb+c/x', '/Users/a.b+c')).toBe('ls /Users/aXb+c/x')
  })
})

describe('branché sur les libellés de carte (fiche 214)', () => {
  it('sans dossier personnel connu : rien ne change', () => {
    expect(cleanCommand('ls /Users/ada/x', undefined)).toBe('ls /Users/ada/x')
    expect(cleanTitle('Reading /Users/ada/x', undefined)).toBe('Reading /Users/ada/x')
  })

  it('commande : le dossier de la conversation relatif, puis le dossier personnel en `~`', () => {
    setHomeFolder(HOME)
    expect(currentHomeFolder()).toBe(HOME)
    const ws = '/Users/ada/livres'
    expect(cleanCommand(`cd ${ws} && cp src/a.js /Users/ada/Desktop/a.js`, ws)).toBe(
      'cp src/a.js ~/Desktop/a.js'
    )
    expect(cleanCommand('ls /Users/ada/Dev', undefined)).toBe('ls ~/Dev')
    expect(cleanTitle('Reading /Users/ada/notes.md', ws)).toBe('Reading ~/notes.md')
  })

  it('en-tête d’un diff hors du dossier : `~` exact, sinon la forme générale', () => {
    setHomeFolder('/Users/ada')
    expect(filePathParts('/Users/ada/.zshrc', '/Users/ada/livres')).toEqual({
      dir: '~/',
      name: '.zshrc'
    })
    // Dossier d'un autre utilisateur : pas `~`, mais l'ancienne abréviation générale reste.
    expect(filePathParts('/tmp/x/a.txt', '/Users/ada/livres')).toEqual({
      dir: '/tmp/x/',
      name: 'a.txt'
    })
  })

  it('home posé sans chemin absolu : ignoré', () => {
    setHomeFolder('ada')
    expect(currentHomeFolder()).toBeUndefined()
    setHomeFolder('')
    expect(currentHomeFolder()).toBeUndefined()
  })
})

describe('dossier personnel passé au renderer', () => {
  it('argument de la fenêtre, lu par le preload', () => {
    expect(homeFromArgv(['/app', homeArgument(HOME)])).toBe(HOME)
  })

  it('argument absent, vide ou non absolu : vide', () => {
    expect(homeFromArgv(['/app'])).toBe('')
    expect(homeFromArgv(['/app', '--bobine-home='])).toBe('')
    expect(homeFromArgv(['/app', '--bobine-home=ada'])).toBe('')
  })
})
