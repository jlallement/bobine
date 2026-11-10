import { Component, type ErrorInfo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { CircleAlert, RefreshCw } from 'lucide-react'
import type { TranscriptItem } from '@shared/transcript'
import type { ThreadEntry } from '@shared/tool-groups'
import '../../safe-boundary.css'

/**
 * Filets d'erreur par morceau d'interface (fiche 194) : un élément du fil, un onglet du panneau ou
 * une page de réglages qui ne s'affiche pas est remplacé, le reste de la fenêtre reste utilisable.
 * L'erreur part au journal de l'app, comme celles du filet de la fenêtre entière.
 */
class SafeBoundary extends Component<
  { children: ReactNode; source: string; fallback: (error: Error, retry: () => void) => ReactNode },
  { error: Error | null }
> {
  override state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    void window.api.app
      .reportError({
        source: this.props.source,
        message: error.message,
        stack: `${error.stack ?? ''}${info.componentStack ?? ''}`
      })
      .catch(() => {})
  }

  override render() {
    const { error } = this.state
    if (!error) return this.props.children
    return this.props.fallback(error, () => this.setState({ error: null }))
  }
}

/** Ce que l'élément du fil est, pour le nommer (« Ce message… », « Ces modifications… »). */
export type ItemKind = 'message' | 'tool' | 'diff' | 'other'

const MESSAGE_KINDS: ReadonlySet<TranscriptItem['kind']> = new Set([
  'user',
  'agent',
  'thought',
  'branch'
])

export function entryKind(entry: ThreadEntry): ItemKind {
  if (entry.kind !== 'item') return 'tool'
  const { item } = entry
  if (MESSAGE_KINDS.has(item.kind)) return 'message'
  // Calculé hors du filet : un fil abîmé (contenu qui n'est pas une liste) ne doit pas lever ici.
  if (item.kind === 'tool') {
    return Array.isArray(item.content) && item.content.some((c) => c?.type === 'diff')
      ? 'diff'
      : 'tool'
  }
  return 'other'
}

export const entryKey = (entry: ThreadEntry): number =>
  entry.kind === 'item' ? entry.item.id : entry.key

/** Détail technique, replié ; « Afficher le journal » mène au même endroit pour tous les filets. */
function Details({ error }: { error: Error }) {
  const { t } = useTranslation()
  return (
    <details className="safe-details">
      <summary>{t('errorBoundary.details')}</summary>
      <pre>{`${error.name}: ${error.message}`}</pre>
      <button className="link-button" onClick={() => void window.api.app.showLog()}>
        {t('errorBoundary.showLog')}
      </button>
    </details>
  )
}

function ItemFallback({ kind, error }: { kind: ItemKind; error: Error }) {
  const { t } = useTranslation()
  return (
    <div className="item-error" data-testid="item-error" data-kind={kind}>
      <div className="item-error-head">
        <CircleAlert size={15} aria-hidden />
        <span>
          <b>{t(`errorBoundary.item.${kind}`)}</b> {t('errorBoundary.item.rest')}
        </span>
      </div>
      <Details error={error} />
    </div>
  )
}

/** Filet d'un élément du fil. */
export function ItemBoundary({ kind, children }: { kind: ItemKind; children: ReactNode }) {
  return (
    <SafeBoundary
      source="react:item"
      fallback={(error) => <ItemFallback kind={kind} error={error} />}
    >
      {children}
    </SafeBoundary>
  )
}

function PaneFallback({
  what,
  error,
  retry
}: {
  what: 'panel' | 'page'
  error: Error
  retry: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="pane-error" role="alert" data-testid="pane-error" data-what={what}>
      <CircleAlert size={22} aria-hidden />
      <b>{t(`errorBoundary.${what}.title`)}</b>
      <span>{t('errorBoundary.panel.rest')}</span>
      <button className="btn small" data-testid="pane-error-retry" onClick={retry}>
        <RefreshCw size={13} aria-hidden /> {t('errorBoundary.retry')}
      </button>
      <Details error={error} />
    </div>
  )
}

/**
 * Filet d'un onglet du panneau (`panel`) ou d'une page de réglages (`page`) : « Réessayer » refait
 * l'affichage. `resetKey` : autre onglet ou autre page, le filet repart de zéro.
 */
export function PaneBoundary({
  what,
  resetKey,
  children
}: {
  what: 'panel' | 'page'
  resetKey?: string
  children: ReactNode
}) {
  return (
    <SafeBoundary
      key={resetKey}
      source={`react:${what}`}
      fallback={(error, retry) => <PaneFallback what={what} error={error} retry={retry} />}
    >
      {children}
    </SafeBoundary>
  )
}
