import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { DragEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { DraggedImage } from '@shared/images'
import '../../thread-extras.css'

/**
 * Glisser une image du fil vers le Finder (fiche 156) : le main l'écrit dans un fichier temporaire
 * et lance le glisser natif (`webContents.startDrag`). Le glisser HTML du renderer est annulé.
 */
function dragOut(event: DragEvent, image: DraggedImage) {
  event.preventDefault()
  const { mimeType, data, name } = image
  void window.api.images.startDrag({ mimeType, data, ...(name ? { name } : {}) }).catch(() => {})
}

/**
 * Image d'un message ou capture d'un outil (fiche 156) : un clic l'ouvre en grand (Échap ferme),
 * elle se glisse vers le Finder, petite ou en grand.
 */
export function ZoomableImage({
  image,
  className,
  alt
}: {
  image: DraggedImage
  className: string
  alt: string
}) {
  const { t } = useTranslation()
  const src = `data:${image.mimeType};base64,${image.data}`
  return (
    <Dialog.Root>
      <Dialog.Trigger
        className={`image-zoom-trigger ${className}`}
        title={t('imageZoom.open')}
        aria-label={t('imageZoom.open')}
        data-testid="image-zoom-open"
      >
        <img src={src} alt={alt} draggable onDragStart={(e) => dragOut(e, image)} />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog image-zoom" data-testid="image-zoom-dialog">
          <Dialog.Title className="sr-only">{alt}</Dialog.Title>
          <Dialog.Description className="sr-only">{t('imageZoom.description')}</Dialog.Description>
          <Dialog.Close className="icon-button image-zoom-close" aria-label={t('common.close')}>
            <X size={16} />
          </Dialog.Close>
          <div className="image-zoom-body">
            <img
              src={src}
              alt={alt}
              draggable
              onDragStart={(e) => dragOut(e, image)}
              data-testid="image-zoom-image"
            />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
