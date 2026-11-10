import { FileText, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { useAttachments } from '../../useAttachments'
import { ContextIcon } from './ContextIcon'
import { ImageAnnotator } from './ImageAnnotator'
import { ExcludedConfirm } from './ExcludedConfirm'
import { PastedTextDialog, PastedTextLabel } from './PastedText'

/**
 * Pièces jointes du message en cours, au-dessus de la zone de saisie (sorti de `Composer`, fiche
 * 089) : vignette d'une image (un clic l'annote, fiche 067), mention de contexte, fichier, texte
 * collé (un clic l'ouvre, fiche 155) ; chacune se retire. Sous la zone de saisie, la confirmation
 * des fichiers que l'agent exclut (fiche 155).
 */
export function ComposerAttachments({
  attachments,
  agentLabel,
  onPutBack
}: {
  attachments: ReturnType<typeof useAttachments>
  agentLabel: string
  /** Texte collé remis dans la saisie. */
  onPutBack: (text: string) => void
}) {
  const { t } = useTranslation()
  // Image jointe en cours d'annotation (fiche 067), texte collé ouvert (fiche 155).
  const [annotating, setAnnotating] = useState<string | null>(null)
  const [reading, setReading] = useState<string | null>(null)
  const annotatedItem = attachments.items.find((a) => a.id === annotating)
  const annotated = annotatedItem?.kind === 'image' ? annotatedItem : undefined
  const readItem = attachments.items.find((a) => a.id === reading)
  const read = readItem?.kind === 'text' ? readItem : undefined
  return (
    <>
      {attachments.items.length > 0 && (
        <div className="attachments" data-testid="attachments">
          {attachments.items.map((item) => (
            <div
              key={item.id}
              className={`attachment ${item.kind}`}
              title={
                item.kind === 'file'
                  ? item.path
                  : item.kind === 'text'
                    ? item.text.slice(0, 200)
                    : item.name
              }
              data-testid="attachment"
            >
              {item.kind === 'image' ? (
                <button
                  type="button"
                  className="attachment-open"
                  onClick={() => setAnnotating(item.id)}
                  title={t('composer.attachment.annotateTitle')}
                  aria-label={t('composer.attachment.annotate', { name: item.name })}
                  data-testid="attachment-annotate"
                >
                  <img src={`data:${item.mimeType};base64,${item.data}`} alt={item.name} />
                </button>
              ) : item.kind === 'text' ? (
                <button
                  type="button"
                  className="attachment-open attachment-text"
                  onClick={() => setReading(item.id)}
                  aria-label={t('composer.attachment.openPasted', { name: item.name })}
                  data-testid="attachment-pasted"
                >
                  <PastedTextLabel name={item.name} text={item.text} />
                </button>
              ) : item.kind === 'context' ? (
                <>
                  <ContextIcon source={item.source} />
                  <span>@{item.name}</span>
                </>
              ) : (
                <>
                  <FileText size={14} />
                  <span>{item.name}</span>
                </>
              )}
              <button
                type="button"
                className="attachment-remove"
                aria-label={t('composer.attachment.remove', { name: item.name })}
                onClick={() => attachments.remove(item.id)}
              >
                <X size={11} strokeWidth={3} />
              </button>
            </div>
          ))}
        </div>
      )}
      {annotated && (
        <ImageAnnotator
          image={annotated}
          onApply={(image) => {
            attachments.replaceImage(annotated.id, image)
            setAnnotating(null)
          }}
          onClose={() => setAnnotating(null)}
        />
      )}
      {read && (
        <PastedTextDialog
          name={read.name}
          text={read.text}
          onClose={() => setReading(null)}
          onPutBack={() => {
            attachments.remove(read.id)
            setReading(null)
            onPutBack(read.text)
          }}
        />
      )}
      {attachments.pending && (
        <ExcludedConfirm
          pending={attachments.pending}
          agentLabel={agentLabel}
          onResolve={attachments.resolvePending}
        />
      )}
    </>
  )
}
