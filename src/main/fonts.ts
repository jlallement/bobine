/**
 * Polices installées sur le Mac (fiche 136), pour Réglages › Apparence : toutes les familles (police
 * des réponses) et celles à chasse fixe (code, terminal). Lues une fois par `osascript` en
 * JavaScript (`NSFontManager`, `NSFont.isFixedPitch`), sans dépendance, puis gardées en mémoire.
 * Hors macOS, ou si la lecture échoue : listes vides (les choix « Système » restent).
 */
import { execFile } from 'node:child_process'
import type { InstalledFonts } from '@shared/ipc'
import { isFontName } from '@shared/preferences'
import { log } from './log'

/** Script JXA : familles visibles (pas celles du système, en « . »), et les monospace. */
const SCRIPT = `ObjC.import('AppKit');
const fm = $.NSFontManager.sharedFontManager;
const families = ObjC.deepUnwrap(fm.availableFontFamilies).filter((f) => !f.startsWith('.'));
const monospace = families.filter((family) => {
  const members = fm.availableMembersOfFontFamily(family);
  if (!members || members.count === 0) return false;
  const font = $.NSFont.fontWithNameSize(members.objectAtIndex(0).objectAtIndex(0), 12);
  return !font.isNil() && font.isFixedPitch;
});
JSON.stringify({ families, monospace });`

const EMPTY: InstalledFonts = { families: [], monospace: [] }

/** Sortie du script : noms valides (posables dans le CSS), triés, sans doublon. */
export function parseFonts(output: string): InstalledFonts {
  try {
    const raw = JSON.parse(output) as Record<string, unknown>
    const names = (value: unknown) =>
      Array.isArray(value)
        ? [...new Set(value.filter(isFontName))].sort((a, b) => a.localeCompare(b))
        : []
    return { families: names(raw['families']), monospace: names(raw['monospace']) }
  } catch {
    return EMPTY
  }
}

export type RunScript = (script: string) => Promise<string>

const runOsascript: RunScript = (script) =>
  new Promise((resolve, reject) =>
    execFile(
      'osascript',
      ['-l', 'JavaScript', '-e', script],
      { timeout: 15_000, maxBuffer: 4 * 1024 * 1024 },
      (error, stdout) => (error ? reject(error) : resolve(stdout))
    )
  )

/** Lecteur des polices, mis en cache au premier appel (une lecture par lancement). */
export function fontLister(
  run: RunScript = runOsascript,
  platform: string = process.platform
): () => Promise<InstalledFonts> {
  let cached: Promise<InstalledFonts> | undefined
  return () => {
    if (platform !== 'darwin') return Promise.resolve(EMPTY)
    cached ??= run(SCRIPT).then(parseFonts, (error: unknown) => {
      log.warn('Polices installées illisibles :', error)
      return EMPTY
    })
    return cached
  }
}
