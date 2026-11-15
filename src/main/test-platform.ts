/**
 * Capacités de la machine pour les essais (fiche 229, lot 7a). Un essai qui ne peut pas tourner sous
 * Windows y est sauté **par capacité, avec la raison**, et seulement quand la fonction essayée
 * n'existe pas sous Windows ; ailleurs (macOS, Linux), il tourne exactement comme avant.
 */
import { mkdtempSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

/** Machine Windows (ni macOS ni Linux). */
export const ON_WINDOWS = process.platform === 'win32'

/**
 * Droits Unix (`0600`, `0700`, `chmod 000` pour un fichier illisible) : Windows a des ACL, `mode`
 * n'y garde que le bit « lecture seule » (`0o666` / `0o444`) ; un fichier ne s'y rend pas illisible
 * par `chmod`.
 */
export const POSIX_MODES = !ON_WINDOWS

/**
 * Chemins POSIX traités par la version Unix d'une fonction dont Windows a sa propre version, essayée
 * à part en `path.win32` (lecture des risques, zone d'écriture : `*-windows.test.ts`).
 */
export const POSIX_PATHS = !ON_WINDOWS

/**
 * Chemin absolu de la machine pour un chemin POSIX d'essai déjà normalisé (`/projet/src/a.js`) :
 * le même sous macOS et Linux ; sous Windows, sur le lecteur courant (`D:\projet\src\a.js`), comme le
 * rendent `resolve` et `join` de l'app à partir de `/projet`.
 */
export const abs = (posixPath: string): string => resolve(posixPath)

/**
 * Chemin montré par l'app (`~/…`, relatif) écrit à la façon POSIX dans un essai : le même sous
 * macOS et Linux ; sous Windows, avec `\` comme le rend l'app (`~\.bob\x`).
 */
export const native = (posixShown: string): string =>
  ON_WINDOWS ? posixShown.replace(/\//g, '\\') : posixShown

/**
 * Shell de connexion Unix (`$SHELL -ilc`) : sous Windows, l'environnement vient des variables
 * enregistrées (`readUserEnv`, fiche 229, lot 2), aucun shell de connexion n'est lancé.
 */
export const LOGIN_SHELL = !ON_WINDOWS

/**
 * Dossier temporaire neuf. Sous Windows, en noms longs (`realpathSync.native`) : le dossier
 * temporaire peut s'y écrire en noms courts 8.3 (`C:\Users\RUNNER~1\…`), que la zone d'écriture
 * d'une discussion pose toujours, alors que le dossier de données de l'app est en noms longs.
 * macOS et Linux : `mkdtempSync` tel quel, comme avant.
 */
export function tempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix))
  return ON_WINDOWS ? realpathSync.native(dir) : dir
}

/**
 * Modèle de processus d'Unix : groupes (`kill(-pgid)`), signaux (`SIGKILL`, `SIGSEGV`), `ps`. Windows
 * n'a ni groupes ni signaux : ses arbres sont tenus par des objets de tâche (ADR-0050, lot 2),
 * essayés à part (`process-*-windows`).
 */
export const POSIX_PROCESSES = !ON_WINDOWS

/**
 * Fonctions propres à macOS (DMG, signature et notarisation, installation par l'app elle-même,
 * Xcode, AXe) : essayées sous macOS et Linux avec de faux outils en `sh` ; absentes de Windows
 * (capacités `selfInstall` et `simulator`, fiche 145 ; paquet Windows : `pnpm package --windows`).
 */
export const MACOS_FEATURES = !ON_WINDOWS
