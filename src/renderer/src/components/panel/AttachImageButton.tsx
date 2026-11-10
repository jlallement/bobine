import { ImagePlus, LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import type { ImageAttachment } from '@shared/attachments'
import { Tip } from '../common/Menus'

/**
 * « Joindre au message » (fiche 066) : l'image de ce que montre l'onglet (page du navigateur, écran
 * d'un simulateur) part dans la zone de saisie de la conversation.
 */
export function AttachImageButton({
  label,
  testId,
  disabled,
  size = 'small',
  take,
  onAttach
}: {
  label: string
  testId: string
  disabled?: boolean
  /** `normal` : dans la barre de commandes sous un appareil (fiche 081). */
  size?: 'small' | 'normal'
  take: () => Promise<ImageAttachment | null>
  onAttach: (image: ImageAttachment) => void
}) {
  const [busy, setBusy] = useState(false)
  const attach = async () => {
    setBusy(true)
    try {
      const image = await take()
      if (image) onAttach(image)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Tip label={label}>
      <button
        type="button"
        className={size === 'small' ? 'icon-button small' : 'icon-button'}
        aria-label={label}
        disabled={disabled || busy}
        onClick={() => void attach()}
        data-testid={testId}
      >
        {busy ? (
          <LoaderCircle size={size === 'small' ? 14 : 17} className="spin" />
        ) : (
          <ImagePlus size={size === 'small' ? 14 : 17} />
        )}
      </button>
    </Tip>
  )
}

/** Capture JPEG d'un simulateur (base64, en points), en pièce jointe. */
export function screenAttachment(
  shot: { data: string } | null,
  name: string
): ImageAttachment | null {
  return shot
    ? {
        kind: 'image',
        name: `${name.replace(/[/:\\]/g, '-')}.jpg`,
        mimeType: 'image/jpeg',
        data: shot.data
      }
    : null
}
