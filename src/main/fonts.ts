/**
 * Polices installées (fiche 136), pour Réglages › Apparence : toutes les familles (police des
 * réponses) et celles à chasse fixe (code, terminal). Lues une fois, sans dépendance, puis gardées
 * en mémoire : sur macOS par `osascript` en JavaScript (`NSFontManager`, `NSFont.isFixedPitch`),
 * sous Linux par `fc-list` de fontconfig (fiche 145). La source est choisie par `platform.ts` ;
 * sans source, ou si la lecture échoue : listes vides (les choix « Système » restent).
 */
import { execFile } from 'node:child_process'
import type { InstalledFonts } from '@shared/ipc'
import { isFontName } from '@shared/preferences'
import { log } from './log'
import type { FontSource } from './platform'

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

/**
 * Format de `fc-list` : premier nom de la famille, puis son espacement (fontconfig : 0
 * proportionnel, 90 double largeur, 100 chasse fixe, 110 cellule de caractère).
 */
const FC_FORMAT = '%{family[0]}\t%{spacing:-0}\n'

/** Sortie de `fc-list` : familles, et celles à chasse fixe (espacement 90 et plus). */
export function parseFontconfig(output: string): InstalledFonts {
  const families: string[] = []
  const monospace: string[] = []
  for (const line of output.split('\n')) {
    const [family = '', spacing = '0'] = line.split('\t')
    if (!family) continue
    families.push(family)
    if (Number(spacing) >= 90) monospace.push(family)
  }
  return parseFonts(JSON.stringify({ families, monospace }))
}

/** Commande du système (programme, arguments) ; rend sa sortie standard. */
export type RunCommand = (command: string, args: string[]) => Promise<string>

const runCommand: RunCommand = (command, args) =>
  new Promise((resolve, reject) =>
    execFile(command, args, { timeout: 15_000, maxBuffer: 4 * 1024 * 1024 }, (error, stdout) =>
      error ? reject(error) : resolve(stdout)
    )
  )

const READERS: Record<FontSource, (run: RunCommand) => Promise<InstalledFonts>> = {
  appkit: async (run) => parseFonts(await run('osascript', ['-l', 'JavaScript', '-e', SCRIPT])),
  fontconfig: async (run) => parseFontconfig(await run('fc-list', ['--format', FC_FORMAT]))
}

/** Lecteur des polices, mis en cache au premier appel (une lecture par lancement). */
export function fontLister(
  source: FontSource | undefined,
  run: RunCommand = runCommand
): () => Promise<InstalledFonts> {
  let cached: Promise<InstalledFonts> | undefined
  return () => {
    if (!source) return Promise.resolve(EMPTY)
    cached ??= READERS[source](run).catch((error: unknown) => {
      log.warn('Polices installées illisibles :', error)
      return EMPTY
    })
    return cached
  }
}
