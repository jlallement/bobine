/**
 * Capacités de la plateforme (fiche 145, ADR-0032) : le seul endroit qui lit le nom du système
 * pour décider qu'une fonction existe, une fois, depuis `index.ts` ; les modules reçoivent ces
 * capacités (injection), ils ne testent pas le système eux-mêmes. Ce qui ne peut pas marcher est
 * masqué, pas laissé en panne. `BOBINE_PLATFORM` impose un système (essais : les capacités de
 * Linux sur un Mac). N'importe pas `electron`.
 */
import type { PlatformFeatures } from '@shared/platform'

export function platformFeatures(platform: string): PlatformFeatures {
  const mac = platform === 'darwin'
  return {
    // Xcode et `simctl` n'existent que sur macOS.
    simulator: mac,
    // Copie dans `/Applications` depuis le `.dmg` ; AppImage et `.deb` n'en ont pas besoin.
    selfInstall: mac,
    // `AppleLanguages` du domaine de l'app ; pas d'équivalent ailleurs.
    nativeLanguage: mac,
    // `screencapture -i` ; sous Wayland, seul le portail du bureau capture (fiche 145, écarts).
    screenCapture: mac,
    // Libellé « Afficher dans le Finder » (fiche 158).
    finder: mac,
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
    glass: mac
  }
}

/** Capacités de cette machine, ou du système imposé par `BOBINE_PLATFORM`. */
export function currentPlatformFeatures(
  env: NodeJS.ProcessEnv,
  platform: string
): PlatformFeatures {
  return platformFeatures(env['BOBINE_PLATFORM'] || platform)
}

/** Où lire les polices installées (`fonts.ts`) : AppKit sur macOS, fontconfig sous Linux. */
export type FontSource = 'appkit' | 'fontconfig'

/** Source des polices du vrai système (pas de `BOBINE_PLATFORM` : la commande doit exister). */
export function fontSource(platform: string): FontSource | undefined {
  return platform === 'darwin' ? 'appkit' : platform === 'linux' ? 'fontconfig' : undefined
}

/** Nom du système pour les infos techniques (fiche 116) : celui de la vraie machine. */
export function systemName(platform: string): string {
  return platform === 'darwin' ? 'macOS' : platform === 'linux' ? 'Linux' : platform
}
