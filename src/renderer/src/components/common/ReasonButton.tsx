import * as Tooltip from '@radix-ui/react-tooltip'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Tip } from './Menus'

/**
 * Bouton qui dit pourquoi il ne fait rien (fiche 287). Un bouton `disabled` ne reçoit ni le survol
 * ni le focus : son infobulle ne s'ouvrait jamais, et le clavier passait sans rien dire (recette
 * Bricole : « Fusionner » et « Ajouter un dossier… » grisés sans raison). Avec une raison, le
 * bouton reste atteignable mais `aria-disabled`, son clic est sans effet, et la raison est dans
 * l'infobulle `Tip` au survol et au focus clavier — le mécanisme du bouton du tour de table
 * (fiche 285, B11) — et dans sa description (`aria-description`) pour un lecteur d'écran. `disabled` reste pour un état
 * passager qui n'a rien à expliquer (une action en cours).
 */
export function ReasonButton({
  reason,
  tip,
  disabled,
  onClick,
  children,
  ...rest
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-disabled'> & {
  /** Pourquoi le bouton ne fait rien ; absent ou vide : il agit (sauf `disabled`). */
  reason?: string | null | undefined
  /** Infobulle quand il agit. */
  tip?: string
  children: ReactNode
}) {
  const blocked = !!reason
  return (
    // Son propre fournisseur : le bouton vit aussi hors de l'app (essais, fenêtres secondaires) ;
    // les délais sont ceux de l'app.
    <Tooltip.Provider delayDuration={400}>
      <Tip label={reason || tip || ''}>
        <button
          type="button"
          {...rest}
          disabled={!blocked && disabled}
          aria-disabled={blocked || undefined}
          // Lue avec le nom du bouton (Chromium) ; aucun texte de plus dans le bouton.
          aria-description={reason || undefined}
          data-reason={reason || undefined}
          onClick={blocked ? undefined : onClick}
        >
          {children}
        </button>
      </Tip>
    </Tooltip.Provider>
  )
}
