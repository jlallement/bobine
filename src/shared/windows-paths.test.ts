/**
 * Chemins Windows (fiche 229, lot 3) : noms spéciaux, comparaisons, et affichage (`~`, nom du
 * dossier, chemin relatif au dossier de la conversation). Les cas POSIX vérifient que macOS et
 * Linux ne changent pas.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { homeFromArgv, setHomeFolder, shortenHomeIn, shortFolderPath } from './path-display'
import { abbreviateHome, abbreviateHomeIn, pathParts } from './presentation'
import { filePathParts, relativePath } from './tool-label'
import {
  actsWhenShown,
  folderName,
  isDriveAbsolute,
  isWindowsPath,
  lastSegment,
  windowsNameProblem,
  windowsWithin
} from './windows-paths'

const HOME = 'C:\\Users\\ada'

describe('noms et formes de chemins Windows', () => {
  it('formes', () => {
    expect(isDriveAbsolute('C:\\x')).toBe(true)
    expect(isDriveAbsolute('c:/x')).toBe(true)
    expect(isDriveAbsolute('C:x')).toBe(false)
    expect(isDriveAbsolute('\\\\?\\C:\\x')).toBe(false)
    expect(isWindowsPath('\\\\srv\\p')).toBe(true)
    expect(isWindowsPath('/Users/ada')).toBe(false)
  })

  it('noms spéciaux', () => {
    expect(windowsNameProblem('Notes.md')).toBeUndefined()
    expect(windowsNameProblem('rapport final.docx')).toBeUndefined()
    expect(windowsNameProblem('a.txt.')).toBe('trailing')
    expect(windowsNameProblem('a.txt ')).toBe('trailing')
    expect(windowsNameProblem('doc:flux')).toBe('stream')
    expect(windowsNameProblem('PRN')).toBe('reserved')
    expect(windowsNameProblem('lpt¹.txt')).toBe('reserved')
    expect(windowsNameProblem('console.log')).toBeUndefined()
    expect(windowsNameProblem('nul-et-non.md')).toBeUndefined()
    expect(windowsNameProblem('PROGRA~1')).toBe('short-name')
    expect(windowsNameProblem('a?.md')).toBe('invalid')
    expect(actsWhenShown('Raccourci.LNK')).toBe(true)
    expect(actsWhenShown('Notes.md')).toBe(false)
  })

  it('dans un dossier : sans casse, `\\` et `/`, pas un voisin', () => {
    expect(windowsWithin('c:/users/ADA/x', HOME)).toBe(true)
    expect(windowsWithin(HOME, 'C:\\Users\\ada\\')).toBe(true)
    expect(windowsWithin('C:\\Users\\adam', HOME)).toBe(false)
    expect(windowsWithin('C:\\x', 'C:\\')).toBe(true)
  })

  it('nom du dossier', () => {
    expect(folderName('C:\\Users\\ada\\livres')).toBe('livres')
    expect(folderName('C:/Users/ada/livres/')).toBe('livres')
    expect(folderName('\\\\srv\\partage\\docs')).toBe('docs')
    // POSIX : inchangé, un `\` est un caractère du nom.
    expect(folderName('/Users/ada/a\\b')).toBe('a\\b')
    expect(folderName('/')).toBe('/')
    expect(lastSegment('/')).toBeUndefined()
  })
})

describe('affichage sous Windows', () => {
  afterEach(() => setHomeFolder(undefined))

  it('`~` pour %USERPROFILE%, sans casse ; dossier de la conversation par son nom', () => {
    expect(shortFolderPath('C:\\Users\\ada\\notes', { home: HOME })).toBe('~\\notes')
    expect(shortFolderPath('c:/users/ADA/notes', { home: HOME })).toBe('~\\notes')
    expect(shortFolderPath('C:\\Users\\adam\\x', { home: HOME })).toBeUndefined()
    expect(shortFolderPath('C:\\Users\\ada\\..\\bob', { home: HOME })).toBeUndefined()
    expect(shortFolderPath('%USERPROFILE%\\x', { home: HOME })).toBeUndefined()
    expect(
      shortFolderPath('C:\\Users\\ada\\projets\\livres\\src', {
        home: HOME,
        workspace: 'C:\\Users\\ada\\projets\\livres'
      })
    ).toBe('livres\\src')
  })

  it('`~` dans un texte libre', () => {
    expect(shortenHomeIn('type C:\\Users\\ada\\a.txt', HOME)).toBe('type ~\\a.txt')
    expect(shortenHomeIn('cd "c:/users/ada/x"', HOME)).toBe('cd "~/x"')
    expect(shortenHomeIn('C:\\Users\\adam\\x', HOME)).toBe('C:\\Users\\adam\\x')
  })

  it('dossier personnel accepté au démarrage et passé au renderer', () => {
    setHomeFolder(HOME)
    expect(homeFromArgv([`--bobine-home=${HOME}`])).toBe(HOME)
    expect(homeFromArgv(['--bobine-home=relatif'])).toBe('')
  })

  it('mode présentation : `C:\\Users\\<nom>` masqué', () => {
    expect(abbreviateHome('C:\\Users\\ada\\livres')).toBe('~\\livres')
    expect(abbreviateHome('c:\\users\\ADA\\livres', HOME)).toBe('~\\livres')
    expect(abbreviateHome('C:\\Users\\adam', HOME)).toBe('C:\\Users\\adam')
    expect(abbreviateHomeIn('dir C:\\Users\\ada\\x')).toBe('dir ~\\x')
    expect(pathParts('C:\\Users\\ada\\projets\\livres', HOME)).toEqual({
      dir: '~\\projets\\',
      name: 'livres'
    })
  })

  it('chemin relatif au dossier de la conversation', () => {
    const ws = 'C:\\Users\\ada\\livres'
    expect(relativePath('C:\\Users\\ada\\livres\\src\\a.ts', ws)).toBe('src\\a.ts')
    expect(relativePath('c:/users/ada/LIVRES/src/a.ts', ws)).toBe('src/a.ts')
    expect(relativePath('C:\\Users\\ada\\livres-copie\\a.ts', ws)).toBe(
      'C:\\Users\\ada\\livres-copie\\a.ts'
    )
    expect(relativePath(ws, ws)).toBe('livres\\')
    expect(relativePath(ws, ws, 'Documents')).toBe('Documents\\')
    expect(filePathParts('C:\\Users\\ada\\livres\\src\\a.ts', ws)).toEqual({
      dir: 'src\\',
      name: 'a.ts'
    })
  })
})

describe('macOS et Linux inchangés', () => {
  it('mêmes résultats qu’avant pour des chemins POSIX', () => {
    expect(shortFolderPath('/Users/ada/notes', { home: '/Users/ada' })).toBe('~/notes')
    expect(shortenHomeIn('cat /Users/ada/a', '/Users/ada')).toBe('cat ~/a')
    expect(relativePath('/p/src/a.ts', '/p')).toBe('src/a.ts')
    expect(abbreviateHome('/home/ada/x')).toBe('~/x')
    expect(pathParts('/Users/ada/livres', '/Users/ada')).toEqual({ dir: '~/', name: 'livres' })
  })
})
