/**
 * Icônes du paquet Linux (fiche 145) : les tailles du thème hicolor livrées en PNG
 * (`scripts/make-icon.mjs --linux`), plus l'icône vectorielle (`scalable`). Le thème hicolor ne
 * déclare pas de dossier 1024x1024 : une icône seule à cette taille n'est pas trouvée par GNOME.
 */
export const LINUX_ICON_SIZES = [16, 24, 32, 48, 64, 128, 256, 512]

/** Dossiers hicolor attendus dans le .deb, `scalable` compris. */
export const HICOLOR_DIRS = [...LINUX_ICON_SIZES.map((n) => `${n}x${n}`), 'scalable']
