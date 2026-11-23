/**
 * Capacités de la plateforme (fiche 145, ADR-0032) : le seul endroit qui lit le nom du système
 * pour décider qu'une fonction existe, une fois, depuis `index.ts` ; les modules reçoivent ces
 * capacités (injection), ils ne testent pas le système eux-mêmes. Ce qui ne peut pas marcher est
 * masqué, pas laissé en panne. `BOBINE_PLATFORM` impose un système (essais : les capacités de
 * Linux ou de Windows sur un Mac) ; il ne change jamais la façon de lancer les processus, qui suit
 * le vrai système (`process-launch.ts`, ADR-0050). N'importe pas `electron`.
 */
import type { PlatformFeatures } from '@shared/platform'

export function platformFeatures(platform: string): PlatformFeatures {
  // Windows (fiche 229, ADR-0050) comme Linux : rien de ce que seul macOS a ; cadre natif et menu ☰
  // (étape intermédiaire de D4), raccourcis en Ctrl, barres de défilement dessinées par l'app.
  const mac = platform === 'darwin'
  return {
    // Xcode et `simctl` n'existent que sur macOS.
    simulator: mac,
    // Copie dans `/Applications` depuis le `.dmg` ; le `.deb` et l'installeur Windows n'en ont pas besoin.
    selfInstall: mac,
    // `AppleLanguages` du domaine de l'app ; pas d'équivalent ailleurs.
    nativeLanguage: mac,
    // `screencapture -i` ; sous Wayland, seul le portail du bureau capture (fiche 145, écarts).
    screenCapture: mac,
    // Libellé « Afficher dans le Finder » (fiche 158).
    finder: mac,
    // « Afficher dans l'Explorateur » (fiche 229).
    explorer: platform === 'win32',
    // `C:\Users\x\agent.exe` tapé tel quel dans la commande d'un agent personnalisé.
    windowsPaths: platform === 'win32',
    // `app.dock.setBadge` ; seul Unity affichait un compteur sous Linux (fiche 145, écarts).
    dockBadge: mac,
    // Barre de menu globale de macOS ; sous Linux, menu de la fenêtre masqué, Alt l'affiche.
    appMenu: mac,
    // `titleBarStyle: 'hiddenInset'` et ses feux ; sous Linux, la barre de titre du système.
    insetTitleBar: mac,
    // Touche Commande ; ailleurs, Ctrl (les accélérateurs `CmdOrCtrl` suivent d'eux-mêmes).
    commandKey: mac,
    // Barres superposées de macOS ; sous Linux, Chromium dessine des barres épaisses à flèches.
    overlayScrollbars: mac,
    // Sous Linux, le flou d'arrière-plan et la fin des fondus dépendent du pilote graphique : un
    // menu y est resté à 88 % d'opacité, lisible à travers (VM VMware, fiche 145).
    glass: mac,
    // Sous Linux (job de la CI, X11 et openbox), la fenêtre rapide transparente créée cachée a
    // chargé sa page sans jamais la peindre : pas de `ready-to-show` (fiches 062 et 250). Windows,
    // non observé, prend le chemin sûr.
    hiddenPaint: mac
  }
}

/** Capacités de cette machine, ou du système imposé par `BOBINE_PLATFORM`. */
export function currentPlatformFeatures(
  env: NodeJS.ProcessEnv,
  platform: string
): PlatformFeatures {
  return platformFeatures(env['BOBINE_PLATFORM'] || platform)
}

/**
 * Où lire les polices installées (`fonts.ts`) : AppKit sur macOS, fontconfig sous Linux, GDI+ par
 * PowerShell sous Windows (fiche 229).
 */
export type FontSource = 'appkit' | 'fontconfig' | 'gdi'

/** Source des polices du vrai système (pas de `BOBINE_PLATFORM` : la commande doit exister). */
export function fontSource(platform: string): FontSource | undefined {
  if (platform === 'win32') return 'gdi'
  return platform === 'darwin' ? 'appkit' : platform === 'linux' ? 'fontconfig' : undefined
}

/** Système encore en préversion (ADR-0050, D7) : dit dans l'À propos ; aucun sur macOS et Linux. */
export function previewOf(platform: string): 'windows' | undefined {
  return platform === 'win32' ? 'windows' : undefined
}

const SYSTEM_NAMES: Record<string, string> = { darwin: 'macOS', linux: 'Linux', win32: 'Windows' }

/**
 * Nom du système pour les infos techniques (fiche 116) : celui de la vraie machine. Windows 11
 * annonce encore `10.0.<build>` (`getSystemVersion`) : le numéro de build le distingue (≥ 22000).
 */
export function systemName(platform: string): string {
  return SYSTEM_NAMES[platform] ?? platform
}
