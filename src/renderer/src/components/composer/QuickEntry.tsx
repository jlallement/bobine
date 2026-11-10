import { ArrowUp, Camera, X } from 'lucide-react'
import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react'
import {
  basename,
  isImageType,
  MAX_ATTACHMENTS,
  MAX_IMAGE_BYTES,
  type PromptAttachment,
  type ScreenCaptureUnavailable
} from '@shared/attachments'
import type { QuickEntryInfo } from '@shared/quick-entry'
import { applyAppearance } from '../../appearance'
import { CaptureProblem } from './CaptureProblem'
import { ImageAnnotator } from './ImageAnnotator'
import { useTranslation } from 'react-i18next'
import i18next from 'i18next'
import { ipcErrorText } from '../../ipc-errors'

type Image = Extract<PromptAttachment, { kind: 'image' }>

function readBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ''))
    reader.onerror = () => reject(reader.error ?? new Error(i18next.t('attachments.readFailed')))
    reader.readAsDataURL(file)
  })
}

/**
 * Fenêtre rapide (fiche 062) : ouverte par un raccourci global depuis n'importe quelle app. Le
 * message part dans une nouvelle conversation, et la fenêtre principale s'ouvre dessus.
 */
export function QuickEntry() {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const [images, setImages] = useState<Image[]>([])
  const [info, setInfo] = useState<QuickEntryInfo | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Capture impossible (autorisation de macOS, fiche 124) : dit, avec le réglage à ouvrir.
  const [captureProblem, setCaptureProblem] = useState<ScreenCaptureUnavailable['reason'] | null>(
    null
  )
  const input = useRef<HTMLTextAreaElement>(null)
  const card = useRef<HTMLDivElement>(null)
  // Image en cours d'annotation (fiche 067) : la hauteur ne suit plus le contenu pendant ce temps.
  const [annotated, setAnnotated] = useState<number | null>(null)
  const annotating = useRef(false)

  // Apparence de l'app (accent, Sépia, Nuit noire…), suivie quand elle change.
  useEffect(() => {
    void window.api.settings.get().then((s) => applyAppearance(s))
    return window.api.settings.onChanged((s) => applyAppearance(s))
  }, [])

  // À chaque ouverture : où part le message (les réglages ont pu changer), et le clavier.
  useEffect(() => {
    const shown = () => {
      setError(null)
      setCaptureProblem(null)
      void window.api.quick.info().then(setInfo, () => setInfo(null))
      input.current?.focus()
    }
    shown()
    return window.api.quick.onShown(shown)
  }, [])

  // La fenêtre suit la hauteur du contenu (texte sur plusieurs lignes, images).
  useEffect(() => {
    const el = card.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      if (annotating.current) return
      void window.api.quick.resize(Math.ceil(el.getBoundingClientRect().height) + 24)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Zone de saisie qui grandit avec le texte.
  useEffect(() => {
    const el = input.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`
  }, [text])

  const stopAnnotating = () => {
    annotating.current = false
    setAnnotated(null)
    const el = card.current
    if (el) void window.api.quick.resize(Math.ceil(el.getBoundingClientRect().height) + 24)
    input.current?.focus()
  }

  const add = (image: Image) =>
    setImages((current) => (current.length >= MAX_ATTACHMENTS ? current : [...current, image]))

  const capture = async () => {
    setError(null)
    setCaptureProblem(null)
    try {
      const result = await window.api.capture.screen()
      if (result?.kind === 'image') add(result)
      else if (result?.kind === 'unavailable') setCaptureProblem(result.reason)
    } catch (e) {
      setError(ipcErrorText(e))
    }
    input.current?.focus()
  }

  const onPaste = (event: ClipboardEvent) => {
    const files = [...event.clipboardData.files].filter((f) => isImageType(f.type))
    if (files.length === 0) return
    event.preventDefault()
    for (const file of files) {
      if (file.size > MAX_IMAGE_BYTES) {
        setError(t('attachments.imageTooLarge', { name: file.name }))
        continue
      }
      void readBase64(file).then((data) =>
        add({
          kind: 'image',
          name: file.name || t('attachments.pastedImage'),
          mimeType: file.type,
          data
        })
      )
    }
  }

  const send = async () => {
    if (busy || (!text.trim() && images.length === 0)) return
    setBusy(true)
    setError(null)
    try {
      await window.api.quick.send(text, images)
      setText('')
      setImages([])
    } catch (e) {
      setError(ipcErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  const onKeyDown = (event: KeyboardEvent) => {
    // Touches de l'annotation (rendue dans un portail, ses évènements remontent jusqu'ici).
    if (annotating.current) return
    if (event.key === 'Escape') {
      event.preventDefault()
      void window.api.quick.hide()
    } else if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      void send()
    }
  }

  const folder = info ? basename(info.workspace) : ''
  return (
    <div className="quick" ref={card} data-testid="quick-entry" onKeyDown={onKeyDown}>
      <textarea
        ref={input}
        className="quick-input"
        value={text}
        rows={1}
        placeholder={
          info ? t('quick.placeholderAgent', { agent: info.agentLabel }) : t('quick.placeholder')
        }
        onChange={(e) => setText(e.target.value)}
        onPaste={onPaste}
        aria-label={t('quick.message')}
        data-testid="quick-input"
      />
      {images.length > 0 && (
        <div className="quick-images" data-testid="quick-images">
          {images.map((image, i) => (
            <div key={i} className="attachment image" title={image.name}>
              <button
                type="button"
                className="attachment-open"
                onClick={() => {
                  annotating.current = true
                  // La fenêtre rapide s'agrandit le temps de l'annotation.
                  void window.api.quick.resize(10_000)
                  setAnnotated(i)
                }}
                title={t('composer.attachment.annotateTitle')}
                aria-label={t('composer.attachment.annotate', { name: image.name })}
                data-testid="quick-annotate"
              >
                <img src={`data:${image.mimeType};base64,${image.data}`} alt={image.name} />
              </button>
              <button
                type="button"
                className="attachment-remove"
                aria-label={t('composer.attachment.remove', { name: image.name })}
                onClick={() => setImages((current) => current.filter((_, j) => j !== i))}
              >
                <X size={11} strokeWidth={3} />
              </button>
            </div>
          ))}
        </div>
      )}
      {annotated !== null && images[annotated] && (
        <ImageAnnotator
          image={images[annotated]}
          onApply={(image) => {
            setImages((current) => current.map((img, j) => (j === annotated ? image : img)))
            stopAnnotating()
          }}
          onClose={stopAnnotating}
        />
      )}
      {error && (
        <div className="quick-error" role="alert" data-testid="quick-error">
          {error}
        </div>
      )}
      {captureProblem && (
        <CaptureProblem
          reason={captureProblem}
          className="quick-capture-problem"
          onOpenSettings={() => {
            window.api.capture.openSettings().catch((e: unknown) => setError(ipcErrorText(e)))
          }}
          onDismiss={() => {
            setCaptureProblem(null)
            input.current?.focus()
          }}
        />
      )}
      <div className="quick-bar">
        <button
          type="button"
          className="chip icon-chip"
          onClick={() => void capture()}
          title={t('composer.capture.tip')}
          aria-label={t('composer.capture.label')}
          data-testid="quick-capture"
        >
          <Camera size={15} />
        </button>
        <span className="quick-target" title={info?.workspace} data-testid="quick-target">
          {info ? t('quick.target', { agent: info.agentLabel, folder }) : ''}
        </span>
        <button
          type="button"
          className="send-button"
          onClick={() => void send()}
          disabled={busy || (!text.trim() && images.length === 0)}
          aria-label={t('quick.send')}
          data-testid="quick-send"
        >
          <ArrowUp size={16} />
        </button>
      </div>
    </div>
  )
}
