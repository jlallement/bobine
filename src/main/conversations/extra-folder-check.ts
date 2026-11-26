/**
 * Vérification d'un chemin proposé comme autre dossier d'une conversation (fiche 290). Un seul
 * chemin de code pour les trois sources : fenêtre native, saisie au clavier, dossier glissé (le
 * renderer n'a que la chaîne ; le main décide). Fonctions pures, système injecté (`path.win32` et
 * un faux disque dans les essais).
 *
 * Règles :
 * - espaces autour et une paire de guillemets autour retirés (« Copier en tant que chemin
 *   d'accès » de Windows met des `"` ; un collage traîne souvent un retour à la ligne) ;
 * - vide, plus de `MAX_FOLDER_INPUT` caractères, caractère de contrôle : refusés ;
 * - `~` et `~/…` (`~\…` sous Windows) : le dossier personnel ; `~autre` : refusé (pas absolu) ;
 * - chemin relatif refusé, jamais résolu : relatif à quoi ? le dossier courant du main ne veut
 *   rien dire pour l'utilisateur, et le dossier de travail n'est pas ce que la saisie montre ;
 * - Windows : lettre de lecteur complète (`C:\…`, `C:/…`) ou chemin UNC (`\\serveur\partage`)
 *   seulement ; `C:dossier` (relatif au lecteur) et `\dossier` (racine du lecteur courant) refusés ;
 *   sous macOS et Linux, `\` est un caractère du nom, jamais un séparateur ;
 * - normalisé (`.`, `..`, séparateurs doublés ou finaux), puis **liens suivis jusqu'au bout**
 *   (`realpath` natif) : c'est le dossier réel qui est retenu et montré. Pourquoi : l'accès donné à
 *   l'agent est celui que l'utilisateur voit dans la liste (un lien changé plus tard ne déplace pas
 *   l'accès en silence) ; un doublon se reconnaît quel que soit le chemin pris ; macOS et Windows
 *   rendent la casse réelle (`~/dev` et `~/Dev` sont un seul dossier) ;
 * - absent (ou lien cassé) : `notFound` ; fichier : `notDirectory` ; sans droit de lecture et de
 *   traversée, ou dont la liste ne s'ouvre pas : `unreadable`.
 *
 * Doublons (dossier de travail, dossier déjà là) : `sameFolder`, appelé par
 * `additional-directories.ts` au moment d'écrire la liste.
 */
import { accessSync, constants, opendirSync, realpathSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { posix, win32, type PlatformPath } from 'node:path'
import { MAX_FOLDER_INPUT, type AddFolderResult } from '@shared/extra-folders'
import { isDriveAbsolute, windowsKey } from '@shared/windows-paths'

/** Ce dont la vérification dépend du système ; par défaut, celui de la machine. */
export interface FolderSystem {
  path: PlatformPath
  /** Dossier personnel, pour `~` ; '' si inconnu (`~` refusé). */
  home: string
  /** Chemin réel, liens suivis ; lève une erreur avec `code` (`ENOENT`, `EACCES`…). */
  realpath: (path: string) => string
  isDirectory: (path: string) => boolean
  /** Le dossier se lit et se traverse, et sa liste s'ouvre. */
  readable: (path: string) => boolean
}

const nodePath: PlatformPath = process.platform === 'win32' ? win32 : posix

export const NATIVE_FOLDER_SYSTEM: FolderSystem = {
  path: nodePath,
  home: homedir(),
  // `.native` : la casse réelle sous macOS et Windows (le `realpath` en JS garde celle saisie).
  realpath: (path) => realpathSync.native(path),
  isDirectory: (path) => statSync(path).isDirectory(),
  readable: (path) => {
    try {
      accessSync(path, constants.R_OK | constants.X_OK)
      // Protection du système (macOS : Documents, Bureau…) : `access` dit oui, la liste non.
      opendirSync(path).closeSync()
      return true
    } catch {
      return false
    }
  }
}

const isWindows = (p: PlatformPath) => p.sep === '\\'

/** Une paire de guillemets autour (`"…"` ou `'…'`), retirée une fois. */
function unquote(text: string): string {
  const quoted = /^(["'])(.*)\1$/s.exec(text)
  return quoted ? (quoted[2] ?? '').trim() : text
}

/** `~` et `~/…` (`~\…` sous Windows) : le dossier personnel ; sinon tel quel. */
function expandHome(text: string, sys: Pick<FolderSystem, 'path' | 'home'>): string | undefined {
  if (text !== '~' && !text.startsWith('~/') && !(isWindows(sys.path) && text.startsWith('~\\')))
    return text
  return sys.home ? sys.path.join(sys.home, text.slice(1)) : undefined
}

/** Absolu au sens de la règle (Windows : lecteur complet ou UNC, jamais `\dossier`). */
function absolute(text: string, p: PlatformPath): boolean {
  return isWindows(p)
    ? isDriveAbsolute(text) || /^\\\\[^\\/]+[\\/]+[^\\/]+/.test(text)
    : p.isAbsolute(text)
}

/**
 * Lecture du texte reçu, sans toucher au disque : le chemin absolu normalisé, ou la raison du
 * refus.
 */
export function parseFolderInput(
  raw: string,
  sys: Pick<FolderSystem, 'path' | 'home'>
): AddFolderResult {
  if (raw.length > MAX_FOLDER_INPUT) return { ok: false, reason: 'tooLong' }
  const text = unquote(raw.trim())
  if (!text) return { ok: false, reason: 'empty' }
  if (/[\u0000-\u001f\u007f]/.test(text)) return { ok: false, reason: 'invalid' }
  const expanded = expandHome(text, sys)
  if (!expanded || !absolute(expanded, sys.path)) return { ok: false, reason: 'notAbsolute' }
  return { ok: true, folder: sys.path.resolve(expanded) }
}

const code = (error: unknown) => (error as NodeJS.ErrnoException | null)?.code

/**
 * Vérification complète d'un chemin reçu (texte, lecture du disque) : le dossier réel à retenir,
 * ou la raison du refus et le chemin compris. Les doublons se vérifient à part (`sameFolder`), au
 * moment d'écrire la liste.
 */
export function checkExtraFolder(
  raw: string,
  sys: FolderSystem = NATIVE_FOLDER_SYSTEM
): AddFolderResult {
  const parsed = parseFolderInput(raw, sys)
  if (!parsed.ok) return parsed
  const asked = parsed.folder
  let real: string
  try {
    real = sys.realpath(asked)
  } catch (error) {
    const reason = code(error) === 'EACCES' || code(error) === 'EPERM' ? 'unreadable' : 'notFound'
    return { ok: false, reason, folder: asked }
  }
  try {
    if (!sys.isDirectory(real)) return { ok: false, reason: 'notDirectory', folder: real }
  } catch {
    return { ok: false, reason: 'notFound', folder: asked }
  }
  if (!sys.readable(real)) return { ok: false, reason: 'unreadable', folder: real }
  return { ok: true, folder: real }
}

/**
 * Clé de comparaison d'un dossier déjà enregistré : son chemin réel s'il existe encore (il a pu
 * être enregistré avant la fiche 290, lien non suivi), sinon normalisé ; sans casse sous Windows.
 */
function folderKey(folder: string, sys: FolderSystem): string {
  let key: string
  try {
    key = sys.realpath(folder)
  } catch {
    key = sys.path.resolve(folder)
  }
  return isWindows(sys.path) ? windowsKey(key) : key
}

/** `folder` (déjà vérifié par `checkExtraFolder`) désigne le même dossier qu'`other`. */
export function sameFolder(
  folder: string,
  other: string,
  sys: FolderSystem = NATIVE_FOLDER_SYSTEM
) {
  return folderKey(folder, sys) === folderKey(other, sys)
}
