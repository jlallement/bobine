import { MessageCircleQuestion, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { HelpLink } from '../help/HelpLink'
import { asideExcerpt, asideQuote, estimatedTokens, type AsideExchange } from '@shared/aside'
import type { TranscriptItem } from '@shared/transcript'
import { formatCost, formatTokens } from '@shared/usage'
import type { AsideState } from '../../useAside'
import type { ComposerInbox } from '../../useFileDrop'
import { SpoolMark } from '../common/SpoolMark'
import { Markdown } from './Markdown'
import '../../aside.css'

/**
 * Carte « Aparté » au-dessus de la zone de saisie (fiche 180) : une question à côté, répondue dans
 * une session à part du même agent ; rien n'arrive dans le fil, sauf par « Ajouter au fil » (une
 * citation dans la zone de saisie, jamais envoyée d'office).
 */
export function AsideCard({
  aside,
  items,
  inbox
}: {
  aside: AsideState
  /** Fil de la conversation : estimation de ce que coûterait « Joindre l'échange récent ». */
  items: readonly TranscriptItem[]
  /** Zone de saisie de la conversation, où « Ajouter au fil » pose la citation. */
  inbox: ComposerInbox
}) {
  const { t } = useTranslation()
  const { view, withContext, focusTick } = aside
  const [draft, setDraft] = useState('')
  const input = useRef<HTMLTextAreaElement>(null)
  const tokens = useMemo(() => estimatedTokens(asideExcerpt(items)), [items])
  const busy = view?.status === 'starting' || view?.status === 'answering'
  const exchanges = view?.exchanges ?? []

  useEffect(() => input.current?.focus(), [focusTick])
  // Dernière réponse visible : la carte défile jusqu'en bas à chaque nouveau morceau.
  const body = useRef<HTMLDivElement>(null)
  const last = exchanges.at(-1)
  useEffect(() => {
    const el = body.current
    if (el) el.scrollTop = el.scrollHeight
  }, [exchanges.length, last?.answer, last?.refused, view?.error])

  const submit = () => {
    if (busy || !draft.trim()) return
    aside.ask(draft)
    setDraft('')
  }
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
    aside.close()
  }
  const quote = (exchange: AsideExchange) => {
    const text = asideQuote(t('aside.title'), exchange)
    aside.close()
    if (aside.conversationId) inbox.prefill({ id: aside.conversationId, text, attachments: [] })
  }

  return (
    <section
      className="aside-card"
      aria-label={t('aside.title')}
      data-testid="aside-card"
      data-status={view?.status ?? 'new'}
      onKeyDown={onKeyDown}
    >
      <header className="aside-head">
        <MessageCircleQuestion size={15} aria-hidden="true" />
        <span className="aside-title">{t('aside.title')}</span>
        <HelpLink topic="aside" section={t('aside.title')} />
        <span className="aside-sub">
          {view?.agentLabel
            ? t('aside.outsideWith', { agent: view.agentLabel })
            : t('aside.outside')}
        </span>
        {view?.cost && (
          <span className="aside-cost" data-testid="aside-cost" title={t('aside.costHint')}>
            {formatCost(view.cost)}
          </span>
        )}
        <button
          type="button"
          className="icon-button small"
          aria-label={t('aside.close')}
          title={t('aside.close')}
          onClick={aside.close}
          data-testid="aside-close"
        >
          <X size={14} />
        </button>
      </header>
      {(exchanges.length > 0 || view?.error) && (
        <div className="aside-body" ref={body} aria-live="polite" aria-busy={busy}>
          {exchanges.map((exchange, index) => {
            const last = index === exchanges.length - 1
            return (
              <div className="aside-exchange" key={index} data-testid="aside-exchange">
                <p className="aside-question">{exchange.question}</p>
                {exchange.answer ? (
                  <div className="aside-answer" data-testid="aside-answer">
                    <Markdown text={exchange.answer} />
                  </div>
                ) : last && busy ? (
                  <p className="aside-working">
                    <SpoolMark size={14} motion="loop" />
                    {t('aside.answering')}
                  </p>
                ) : null}
                {exchange.refused > 0 && (
                  <p className="aside-refused" data-testid="aside-refused">
                    {t('aside.refused', { count: exchange.refused })}
                  </p>
                )}
                {exchange.answer && !(last && busy) && (
                  <button
                    type="button"
                    className="btn ghost small"
                    onClick={() => quote(exchange)}
                    data-testid="aside-quote"
                  >
                    {t('aside.addToThread')}
                  </button>
                )}
              </div>
            )
          })}
          {view?.error && (
            <p className="aside-error" role="alert" data-testid="aside-error">
              {view.error}
            </p>
          )}
        </div>
      )}
      <form
        className="aside-form"
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <textarea
          ref={input}
          className="aside-input"
          rows={1}
          value={draft}
          placeholder={exchanges.length ? t('aside.placeholderMore') : t('aside.placeholder')}
          aria-label={t('aside.question')}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault()
              submit()
            }
          }}
          data-testid="aside-input"
        />
        <div className="aside-actions">
          <label className="aside-context">
            <input
              type="checkbox"
              checked={withContext}
              onChange={(event) => aside.setWithContext(event.target.checked)}
              data-testid="aside-with-context"
            />
            {t('aside.withContext', { tokens: formatTokens(tokens, true) })}
          </label>
          <button
            type="submit"
            className="btn primary small"
            disabled={busy || !draft.trim()}
            data-testid="aside-ask"
          >
            {t('aside.ask')}
          </button>
        </div>
      </form>
    </section>
  )
}
