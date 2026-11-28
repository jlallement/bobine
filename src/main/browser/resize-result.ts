/**
 * Outil `browser_resize` de l'agent (fiches 031, 129) : ses préréglages et la phrase qu'il rend.
 * Sorti de `browser-tools.ts` (taille bornée, fiche 089). En anglais, non traduit : c'est pour
 * l'agent (ADR-0014).
 */

/** Préréglages de `browser_resize` (ceux de l'agent ; pas la liste d'appareils de l'utilisateur). */
export const PRESETS: Record<
  string,
  { width: number; height: number; mobile: boolean } | undefined
> = {
  mobile: { width: 375, height: 812, mobile: true },
  tablet: { width: 768, height: 1024, mobile: true },
  desktop: undefined
}

/**
 * Ce que l'agent apprend : la fenêtre en pixels CSS, la réduction à l'affichage, et ce qui revient
 * à la fin de son tour — la largeur du panneau, ou le réglage de l'utilisateur s'il en a un (fiche
 * 295 : l'agent n'en apprend rien d'autre).
 */
export function resizeResult(
  viewport: { width: number; height: number },
  emulation: { scale: number } | undefined,
  userDevice: boolean
): string {
  const { width, height } = viewport
  const reset = userDevice ? '' : ' The size is reset at the end of your turn.'
  const note = emulation
    ? ` Shown at ${Math.round(emulation.scale * 100)}% to fit the panel; screenshots and click coordinates use these ${width}×${height} CSS pixels.${reset}`
    : ''
  const back = userDevice
    ? " The user's own screen size and theme settings for this browser come back at the end of your turn."
    : ''
  return `Fenêtre : ${width}×${height} px.${note}${back}`
}
