import { ArrowLeftRight, ExternalLink, Layers, Pause, Play, Search, Shield } from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ACP_EXCHANGES_MAX } from '@shared/acp-exchanges'
import {
  buildRows,
  countText,
  filterRows,
  jsonTokens,
  sizeText,
  timeText,
  toNdjson,
  type AcpRow,
  type ParsedExchange
} from '../../acp-view'
import { useAcpExchanges } from '../../useAcpExchanges'
import { CopyButton } from '../common/CopyButton'
import { Tip } from '../common/Menus'

/** Écart au bas de la liste sous lequel elle suit les nouveaux messages. */
const STICK_PX = 24

/**
 * Onglet « Échanges ACP » (fiche 135) : les messages JSON-RPC de la conversation, dans les deux
 * sens, en direct. Un clic déplie le JSON (et sélectionne la ligne pour « Copier ») ; les morceaux
 * de texte d'un même message sont regroupés. Tout vient du main, secrets déjà masqués.
 */
export function AcpTab({ conversationId }: { conversationId: string }) {
  const { t } = useTranslation()
  const [group, setGroup] = useState(true)
  const [query, setQuery] = useState('')
  /** Lignes dépliées, qui sont aussi la sélection copiée. */
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set())
  const { messages, paused, setPaused, waiting } = useAcpExchanges(conversationId)
  const rows = useMemo(() => buildRows(messages, { group }), [messages, group])
  const shown = useMemo(() => filterRows(rows, query), [rows, query])
  const selected = shown.filter((row) => open.has(row.key))
  const [logEmpty, setLogEmpty] = useState(false)
  useEffect(() => {
    void window.api.log.status().then(
      (status) => setLogEmpty(status.sizes.agents === 0),
      () => {}
    )
  }, [])

  // La liste suit les nouveaux messages tant qu'on est en bas.
  const list = useRef<HTMLDivElement>(null)
  const stick = useRef(true)
  useLayoutEffect(() => {
    const element = list.current
    if (element && stick.current) element.scrollTop = element.scrollHeight
  }, [shown])

  const toggle = (key: string) =>
    setOpen((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  const pauseLabel = paused ? t('acpTab.resume') : t('acpTab.pause')
  const logLabel = logEmpty ? t('acpTab.openLogEmpty') : t('acpTab.openLog')

  return (
    <div className="acp-tab" data-testid="acp-tab">
      <div className="acp-bar">
        <label className="acp-search">
          <Search size={14} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('acpTab.filter')}
            aria-label={t('acpTab.filter')}
            spellCheck={false}
            data-testid="acp-filter"
          />
        </label>
        <Tip label={t('acpTab.group')}>
          <button
            className={`chip acp-toggle${group ? ' on' : ''}`}
            aria-label={t('acpTab.group')}
            aria-pressed={group}
            onClick={() => setGroup(!group)}
            data-testid="acp-group"
          >
            <Layers size={13} />
            <span className="chip-label">{t('acpTab.group')}</span>
          </button>
        </Tip>
        <span className="grow" />
        {paused && waiting > 0 && (
          <span className="acp-waiting" data-testid="acp-waiting">
            {t('acpTab.waiting', { count: waiting })}
          </span>
        )}
        <Tip label={pauseLabel}>
          <button
            className={`icon-button small${paused ? ' active' : ''}`}
            aria-label={pauseLabel}
            aria-pressed={paused}
            onClick={() => setPaused(!paused)}
            data-testid="acp-pause"
          >
            {paused ? <Play size={14} /> : <Pause size={14} />}
          </button>
        </Tip>
        <CopyButton
          text={() => toNdjson(selected.length ? selected : shown)}
          label={selected.length ? t('acpTab.copySelection') : t('acpTab.copyAll')}
          testId="acp-copy"
        />
        <Tip label={logLabel}>
          <button
            className="icon-button small"
            aria-label={logLabel}
            aria-disabled={logEmpty}
            onClick={() => {
              if (!logEmpty) void window.api.log.open('agents')
            }}
            data-testid="acp-open-log"
          >
            <ExternalLink size={14} />
          </button>
        </Tip>
      </div>
      {messages.length === 0 ? (
        <div className="side-panel-empty" data-testid="acp-empty">
          <ArrowLeftRight size={22} />
          <p>{t('acpTab.empty')}</p>
        </div>
      ) : (
        <div
          className="acp-list"
          ref={list}
          role="list"
          aria-label={t('acpTab.list')}
          onScroll={(event) => {
            const e = event.currentTarget
            stick.current = e.scrollHeight - e.scrollTop - e.clientHeight < STICK_PX
          }}
          data-testid="acp-list"
        >
          {shown.length === 0 && <p className="acp-no-match">{t('acpTab.noMatch')}</p>}
          {shown.map((row) => (
            <AcpRowView
              key={row.key}
              row={row}
              open={open.has(row.key)}
              onToggle={() => toggle(row.key)}
            />
          ))}
        </div>
      )}
      <div className="acp-foot">
        <Shield size={13} />
        <span>{t('acpTab.foot', { max: countText(ACP_EXCHANGES_MAX) })}</span>
      </div>
    </div>
  )
}

function AcpRowView({ row, open, onToggle }: { row: AcpRow; open: boolean; onToggle: () => void }) {
  const { t } = useTranslation()
  return (
    <div role="listitem">
      <button
        className={`acp-row${open ? ' open' : ''}${row.error ? ' error' : ''}`}
        aria-expanded={open}
        onClick={onToggle}
        data-testid="acp-row"
        data-what={row.what}
        data-direction={row.direction}
        data-grouped={row.grouped || undefined}
      >
        <span className="acp-time">{timeText(row.at)}</span>
        <span className={`acp-dir ${row.direction}`} title={t(`acpTab.${row.direction}`)}>
          {row.direction === 'out' ? '→' : '←'}
        </span>
        <span className="acp-what" title={row.what}>
          {row.grouped ? (
            <>
              <span className="acp-what-text">{row.messages[0]?.update}</span>
              <span className="acp-count">{`×${row.messages.length}`}</span>
              <span className="acp-pill">{t('acpTab.grouped')}</span>
            </>
          ) : (
            <span className="acp-what-text">{row.what}</span>
          )}
        </span>
        <span className="acp-detail" title={row.detail || undefined}>
          {row.detail}
        </span>
        <span className="acp-size">{sizeText(row.bytes)}</span>
      </button>
      {open &&
        (row.grouped ? (
          <ChunkList messages={row.messages} />
        ) : (
          row.messages[0] && <JsonView message={row.messages[0]} />
        ))}
    </div>
  )
}

/** Morceaux d'un groupe déplié, un par ligne (↳ dans la colonne du sens, sans retrait). */
function ChunkList({ messages }: { messages: ParsedExchange[] }) {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <div className="acp-chunks" data-testid="acp-chunks">
      {messages.map((message) => (
        <div key={message.seq}>
          <button
            className={`acp-row chunk${open === message.seq ? ' open' : ''}`}
            aria-expanded={open === message.seq}
            onClick={() => setOpen(open === message.seq ? null : message.seq)}
          >
            <span className="acp-time">{timeText(message.at)}</span>
            <span className="acp-dir">↳</span>
            <span className="acp-what">{chunkText(message)}</span>
            <span className="acp-detail" />
            <span className="acp-size">{sizeText(message.bytes)}</span>
          </button>
          {open === message.seq && <JsonView message={message} />}
        </div>
      ))}
    </div>
  )
}

/** Texte d'un morceau (`update.content.text`), sur une ligne. */
function chunkText(message: ParsedExchange): string {
  const params = message.json?.['params'] as { update?: { content?: { text?: unknown } } }
  const text = params?.update?.content?.text
  return typeof text === 'string' ? JSON.stringify(text) : (message.update ?? '')
}

function JsonView({ message }: { message: ParsedExchange }) {
  const { t } = useTranslation()
  const tokens = useMemo(() => jsonTokens(message), [message])
  return (
    <>
      {message.truncated && (
        <p className="acp-truncated">{t('acpTab.truncated', { size: sizeText(message.bytes) })}</p>
      )}
      <pre className="acp-json" data-testid="acp-json">
        {tokens.map((token, index) =>
          token.type ? (
            <span key={index} className={`acp-json-${token.type}`}>
              {token.text}
            </span>
          ) : (
            token.text
          )
        )}
      </pre>
    </>
  )
}
