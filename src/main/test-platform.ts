/**
 * Capacités de la machine pour les essais (fiche 229, lot 7a). Un essai qui ne peut pas tourner sous
 * Windows y est sauté **par capacité, avec la raison**, et seulement quand la fonction essayée
 * n'existe pas sous Windows ; ailleurs (macOS, Linux), il tourne exactement comme avant.
 */
import { resolve } from 'node:path'

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

/** Fonction propre à macOS (app installée par elle-même, DMG, signature, Xcode, simulateur). */
export const ON_MACOS = process.platform === 'darwin'

/**
 * Chemin absolu de la machine pour un chemin POSIX d'essai déjà normalisé (`/projet/src/a.js`) :
 * le même sous macOS et Linux ; sous Windows, sur le lecteur courant (`D:\projet\src\a.js`), comme le
 * rendent `resolve` et `join` de l'app à partir de `/projet`.
 */
export const abs = (posixPath: string): string => resolve(posixPath)
