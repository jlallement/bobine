import { Component, type ErrorInfo, type ReactNode } from 'react'
import i18next from 'i18next'
import { messageOf } from '@shared/errors'

/**
 * Filet de sécurité de l'interface (fiche 041) : une erreur de rendu affiche un écran de reprise au
 * lieu d'une fenêtre blanche, et part dans le journal de l'app. Les conversations vivent dans le
 * main process : recharger l'interface ne perd rien.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  override state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    void window.api.app
      .reportError({
        source: 'react',
        message: error.message,
        stack: `${error.stack ?? ''}${info.componentStack ?? ''}`
      })
      .catch(() => {})
  }

  override render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div className="crash-screen" role="alert" data-testid="crash-screen">
        <h1>{i18next.t('errorBoundary.title')}</h1>
        <p>{i18next.t('errorBoundary.description')}</p>
        <pre>{error.message}</pre>
        <div className="crash-actions">
          <button className="btn primary" onClick={() => window.location.reload()}>
            {i18next.t('errorBoundary.reload')}
          </button>
          <button className="btn" onClick={() => void window.api.app.showLog()}>
            {i18next.t('errorBoundary.showLog')}
          </button>
        </div>
      </div>
    )
  }
}

/** Erreurs hors rendu (gestionnaires d'évènements, promesses) : dans le journal de l'app. */
export function reportGlobalErrors(): void {
  window.addEventListener('error', (event) => {
    const error = event.error as unknown
    void window.api.app
      .reportError({
        source: 'error',
        message: event.message || String(error),
        ...(error instanceof Error && error.stack ? { stack: error.stack } : {})
      })
      .catch(() => {})
  })
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason as unknown
    void window.api.app
      .reportError({
        source: 'unhandledrejection',
        message: messageOf(reason),
        ...(reason instanceof Error && reason.stack ? { stack: reason.stack } : {})
      })
      .catch(() => {})
  })
}
