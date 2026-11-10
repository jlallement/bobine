/**
 * Mode Annoter de l'onglet Navigateur (fiches 132 et 146) : la page reste vivante (elle défile et
 * zoome) et un script de la page transforme le clic en remarque ; la page n'est figée que le temps
 * d'écrire (brouillon). Envoi : un message, une capture annotée par écran (`pageImages`).
 */
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ImageAttachment } from '@shared/attachments'
import {
  pageFeedback,
  pageImages,
  type PageElement,
  type PageFreeze,
  type PageLayerEvent,
  type PageLayerTheme,
  type PagePoint
} from '@shared/page-notes'
import { ipcErrorText } from './ipc-errors'
import { composePageImage } from './page-annotation'
import { pageNotes, usePageNotes } from './page-notes-store'

/** Couleurs si le thème n'en donne pas. */
const FALLBACK: PageLayerTheme = {
  accent: '#c96442',
  surface: '#ffffff',
  text: '#1f1e1d',
  border: '#e3e0d6'
}

/** Remarque en cours d'écriture, page figée : nouvelle (au clic), ou à modifier (son épingle). */
export interface PageDraft {
  id: string
  /** Point de l'épingle dans la page figée (pixels CSS de sa fenêtre). */
  x: number
  y: number
  text: string
  existing: boolean
  /** Capture affichée pendant l'écriture : la page telle qu'on la voyait, épingles comprises. */
  freeze: PageFreeze
  element: PageElement | null
  doc: PagePoint
  /** Épingles visibles au clic : celles de la capture propre de la remarque. */
  pins: Record<string, PagePoint>
  url: string
}

/** Couleurs du thème pour ce que l'app dessine dans la page. */
function layerTheme(): PageLayerTheme {
  const style = getComputedStyle(document.body)
  const token = (name: string, fallback: string) =>
    style.getPropertyValue(`--${name}`).trim() || fallback
  return {
    accent: token('accent', FALLBACK.accent),
    surface: token('surface', FALLBACK.surface),
    text: token('text', FALLBACK.text),
    border: token('border', FALLBACK.border)
  }
}

export function usePageAnnotation(
  conversationId: string,
  /** Page affichée (adresse, onglet) ; `null` sans page. */
  page: { url: string; tab: string } | null,
  onSend: ((text: string, images: ImageAttachment[]) => void) | undefined,
  onError: (message: string | null) => void
) {
  const { t } = useTranslation()
  const [annotating, setAnnotating] = useState(false)
  const [draft, setDraft] = useState<PageDraft | null>(null)
  const session = usePageNotes(conversationId)
  const notes = session?.notes
  const url = page?.url ?? ''
  const tab = page?.tab ?? ''
  // Lus par les écouteurs d'évènements, posés une fois.
  const live = useRef({ annotating, draft, opening: false })
  useEffect(() => {
    live.current.annotating = annotating
    live.current.draft = draft
  })

  const stop = () => {
    setAnnotating(false)
    setDraft(null)
  }

  // Le script de la page suit le mode, sur l'onglet affiché (un autre onglet : il change d'onglet).
  useEffect(() => {
    if (!annotating || !tab) return
    window.api.browser
      .annotate(conversationId, true, layerTheme())
      .catch((e: unknown) => onError(ipcErrorText(e)))
    return () => {
      void window.api.browser.annotate(conversationId, false, null).catch(() => {})
    }
    // `onError` change à chaque rendu de l'onglet ; seul le mode compte ici.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annotating, conversationId, tab])

  // Épingles dessinées dans la page : celles posées sur l'adresse affichée.
  useEffect(() => {
    if (!annotating || !tab) return
    const pins = (notes ?? [])
      .map((note, i) => ({ note, n: i + 1 }))
      .filter(({ note }) => note.url === url)
      .map(({ note, n }) => ({ id: note.id, n, text: note.comment, doc: note.doc }))
    void window.api.browser.pagePins(conversationId, pins).catch(() => {})
  }, [annotating, conversationId, tab, url, notes])

  // Clic ou épingle dans la page : la page se fige, la bulle s'ouvre.
  useEffect(() => {
    const open = async (event: PageLayerEvent) => {
      const existing =
        event.kind === 'open'
          ? pageNotes.get(conversationId)?.notes.find((n) => n.id === event.id)
          : undefined
      if (event.kind === 'open' && !existing) return
      live.current.opening = true
      try {
        const freeze = await window.api.browser.freeze(conversationId)
        if (!freeze || !live.current.annotating) return
        const at =
          event.kind === 'place'
            ? event.point
            : (event.pins[event.id] ?? { x: existing?.x ?? 0, y: existing?.y ?? 0 })
        setDraft({
          id: event.id,
          x: at.x,
          y: at.y,
          text: existing?.comment ?? '',
          existing: !!existing,
          freeze,
          element: event.kind === 'place' ? event.element : (existing?.element ?? null),
          doc: event.kind === 'place' ? event.doc : (existing?.doc ?? at),
          pins: event.pins,
          url: event.url
        })
      } catch (e) {
        onError(ipcErrorText(e))
      } finally {
        live.current.opening = false
      }
    }
    const offAnnotate = window.api.browser.onAnnotate((event) => {
      if (event.conversationId !== conversationId) return
      if (!live.current.annotating || live.current.draft || live.current.opening) return
      void open(event)
    })
    // Échap tapé dans la page : fin du mode.
    const offCommand = window.api.browser.onCommand((command) => {
      if (command.conversationId === conversationId && command.command === 'annotate-escape') {
        stop()
      }
    })
    return () => {
      offAnnotate()
      offCommand()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId])

  // Échap dans l'onglet (bouton « Annoter », page figée) : la bulle d'abord, puis le mode. Pas
  // depuis la zone de saisie, où Échap interrompt l'agent.
  useEffect(() => {
    if (!annotating) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      const target = event.target instanceof Element ? event.target : null
      if (target && target !== document.body && !target.closest('[data-testid="browser-tab"]')) {
        return
      }
      event.preventDefault()
      if (live.current.draft) setDraft(null)
      else stop()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [annotating])

  const toggle = () => {
    if (annotating) return stop()
    onError(null)
    if (page) setAnnotating(true)
  }

  /**
   * Remarque enregistrée. Nouvelle : sa capture propre est prise page encore masquée, avant que la
   * page ne revienne (on ne voit pas les épingles disparaître le temps de la capture).
   */
  const save = async (text: string) => {
    const current = live.current.draft
    const comment = text.trim()
    if (!current || !comment) return
    if (current.existing) pageNotes.edit(conversationId, current.id, comment)
    else {
      pageNotes.add(conversationId, {
        id: current.id,
        x: current.x,
        y: current.y,
        comment,
        element: current.element,
        url: current.url,
        doc: current.doc
      })
      await pageNotes.shot(
        conversationId,
        current.id,
        window.api.browser.noteShot(conversationId),
        current.pins
      )
    }
    setDraft(null)
  }

  const remove = () => {
    if (draft) pageNotes.remove(conversationId, draft.id)
    setDraft(null)
  }

  const clear = () => {
    pageNotes.clear(conversationId)
    stop()
  }

  /** Un seul message : le texte et une image par écran annoté ; la file l'attend (fiche 020). */
  const send = async () => {
    if (!onSend || !pageNotes.get(conversationId)?.notes.length) return
    try {
      const current = await pageNotes.settled(conversationId)
      if (!current) return
      const { images, loose } = pageImages(current.shots, current.notes)
      const accent = layerTheme().accent
      const files = await Promise.all(
        images.map((image, i) =>
          composePageImage(
            image.freeze,
            image.pins,
            accent,
            images.length > 1
              ? t('browser.annotate.imageN', { n: i + 1 })
              : t('browser.annotate.image')
          )
        )
      )
      onSend(pageFeedback(images, loose), files)
      clear()
    } catch (e) {
      onError(ipcErrorText(e))
    }
  }

  return {
    annotating,
    draft,
    session,
    count: notes?.length ?? 0,
    /** Numéro de l'épingle du brouillon. */
    draftNumber: draft
      ? draft.existing
        ? (notes ?? []).findIndex((n) => n.id === draft.id) + 1
        : (notes?.length ?? 0) + 1
      : 0,
    toggle,
    stop,
    clear,
    send,
    save,
    remove,
    cancel: () => setDraft(null)
  }
}

export type PageAnnotation = ReturnType<typeof usePageAnnotation>
