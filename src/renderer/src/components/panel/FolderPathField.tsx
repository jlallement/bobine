import { Check, CircleAlert, CornerDownLeft, FolderOpen } from 'lucide-react'
import { useEffect, useId, useRef, useState, type DragEvent, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { extraFolderRefusalKey, type AddFolderResult } from '@shared/extra-folders'
import { FILE_DRAG_TYPE } from '../../useFileDrop'
import { Tip } from '../common/Menus'
import { ReasonButton } from '../common/ReasonButton'

/** Durée de la ligne « Ajouté » (fiche 290) : jusqu'à la frappe suivante, ou ce délai. */
export const ADDED_NOTE_MS = 4000

/** D'où vient le chemin : le champ (vidé si ajouté), la fenêtre du système, un dépôt. */
type Source = 'typed' | 'dialog' | 'drop'

/** Ce que dit la ligne sous le champ. */
type Note =
  | { kind: 'refused'; result: Extract<AddFolderResult, { ok: false }>; typed: boolean }
  | { kind: 'added' }
  | { kind: 'several' }

export interface FolderPathFieldProps {
  /** Pourquoi l'ajout attend (un tour de l'agent) ; absent : ouvert. */
  blocked?: string | undefined
  /** Ajoute : sans chemin, la fenêtre du système ; `null` si elle est annulée. */
  add: (path?: string) => Promise<AddFolderResult | null>
  /** Chemin d'un élément glissé (`window.api.files.pathFor`) ; '' s'il n'en a pas. */
  pathFor: (file: File) => string
  /** Dossier ajouté (pour le signaler dans la liste). */
  onAdded: (folder: string) => void
  /** Erreur inattendue (conversation disparue…). */
  onError: (error: unknown) => void
}

/** Un glisser de fichiers du système, pas une ligne de l'onglet Fichiers ni du texte. */
const systemFiles = (event: DragEvent) =>
  event.dataTransfer.types.includes('Files') && !event.dataTransfer.types.includes(FILE_DRAG_TYPE)

/**
 * Champ « Autres dossiers » (fiche 290) : un chemin saisi ou collé, un dossier glissé, ou la
 * fenêtre du système (bouton du bout). Le renderer ne lit rien : il envoie la chaîne, le main
 * vérifie et rend le dossier retenu ou la raison du refus, affichée sous le champ.
 */
export function FolderPathField(props: FolderPathFieldProps) {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const [note, setNote] = useState<Note | null>(null)
  const [pending, setPending] = useState(false)
  const [dropping, setDropping] = useState(false)
  const depth = useRef(0)
  const noteId = useId()
  // Pendant un tour, et juste après un ajout pendant que la session repart : même traitement.
  const reason = props.blocked || (pending ? t('sessionTab.folderRestarting') : undefined)

  useEffect(() => {
    if (note?.kind !== 'added') return
    const timer = setTimeout(() => setNote(null), ADDED_NOTE_MS)
    return () => clearTimeout(timer)
  }, [note])

  const submit = async (source: Source, path?: string) => {
    if (reason) return
    setNote(null)
    setPending(true)
    let result: AddFolderResult | null
    try {
      result = await props.add(path)
    } catch (error) {
      props.onError(error)
      return
    } finally {
      setPending(false)
    }
    if (!result) return
    if (result.ok) {
      if (source === 'typed') setText('')
      setNote({ kind: 'added' })
      props.onAdded(result.folder)
    } else setNote({ kind: 'refused', result, typed: source === 'typed' })
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      // Entrée sur un champ vide : rien (la raison `empty` n'est qu'une garde du main).
      if (text.trim()) void submit('typed', text)
    } else if (event.key === 'Escape' && text) {
      // Vide le champ ; champ vide : l'évènement passe (raccourcis du panneau).
      event.preventDefault()
      event.stopPropagation()
      setText('')
      setNote(null)
    }
  }

  const drag = {
    onDragEnter: (event: DragEvent) => {
      event.stopPropagation()
      if (!systemFiles(event) || reason) return
      event.preventDefault()
      depth.current += 1
      setDropping(true)
    },
    onDragOver: (event: DragEvent) => {
      event.stopPropagation()
      // Toujours refusé par défaut : sans cela, un texte glissé s'insérerait dans le champ.
      event.preventDefault()
      event.dataTransfer.dropEffect = systemFiles(event) && !reason ? 'copy' : 'none'
    },
    onDragLeave: (event: DragEvent) => {
      if (!dropping) return
      event.stopPropagation()
      depth.current = Math.max(0, depth.current - 1)
      if (depth.current === 0) setDropping(false)
    },
    onDrop: (event: DragEvent) => {
      event.preventDefault()
      event.stopPropagation()
      depth.current = 0
      setDropping(false)
      if (!systemFiles(event) || reason) return
      const files = [...event.dataTransfer.files]
      if (files.length > 1) return setNote({ kind: 'several' })
      const path = files[0] ? props.pathFor(files[0]) : ''
      if (path) void submit('drop', path)
    }
  }

  const refused = note?.kind === 'refused' ? note : null
  return (
    <div
      className={`folder-path${dropping ? ' dropping' : ''}`}
      data-testid="session-folder-field"
      {...drag}
    >
      <div className="folder-path-box">
        <Tip label={reason ?? ''}>
          <input
            className="folder-path-input"
            type="text"
            value={text}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            placeholder={dropping ? '' : t('sessionTab.folderPlaceholder')}
            aria-label={t('sessionTab.folderField')}
            readOnly={!!reason}
            aria-disabled={reason ? true : undefined}
            aria-description={reason || undefined}
            aria-invalid={refused?.typed || undefined}
            aria-describedby={note ? noteId : undefined}
            onChange={(event) => {
              setText(event.target.value)
              setNote(null)
            }}
            onKeyDown={onKeyDown}
            data-testid="session-folder-path"
          />
        </Tip>
        {dropping && <span className="folder-path-drop">{t('sessionTab.dropFolder')}</span>}
        <span className="folder-path-buttons">
          {text.trim() && (
            <ReasonButton
              className="icon-button small folder-path-button"
              aria-label={t('sessionTab.addThisFolder')}
              tip={t('sessionTab.addThisFolder')}
              reason={reason}
              onClick={() => void submit('typed', text)}
              data-testid="session-folder-submit"
            >
              <CornerDownLeft size={14} />
            </ReasonButton>
          )}
          <ReasonButton
            className="icon-button small folder-path-button"
            aria-label={t('sessionTab.chooseFolder')}
            tip={t('sessionTab.chooseFolder')}
            reason={reason}
            onClick={() => void submit('dialog')}
            data-testid="session-add-folder"
          >
            <FolderOpen size={14} />
          </ReasonButton>
        </span>
      </div>
      <div
        id={noteId}
        role="status"
        className={`folder-path-note${note ? ` ${note.kind}` : ''}`}
        data-testid="session-folder-note"
        data-reason={refused?.result.reason}
      >
        {note && <FolderNote note={note} />}
      </div>
    </div>
  )
}

function FolderNote({ note }: { note: Note }) {
  const { t } = useTranslation()
  if (note.kind === 'added')
    return (
      <>
        <Check size={14} aria-hidden />
        <span>{t('sessionTab.folderAdded')}</span>
      </>
    )
  const text =
    note.kind === 'several'
      ? t('sessionTab.oneFolder')
      : t(extraFolderRefusalKey(note.result.reason), { folder: note.result.folder ?? '' })
  return (
    <>
      <CircleAlert size={14} aria-hidden />
      <span>{text}</span>
    </>
  )
}
