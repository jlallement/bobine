import * as Dialog from '@radix-ui/react-dialog'
import { Folder, LoaderCircle, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { AgentSessionView, ProfileSummary } from '@shared/agent'
import { hasAllWords, searchWords } from '@shared/conversation-search'
import { currentLocale } from '@shared/i18n/format'
import { useTranslation } from 'react-i18next'
import i18next from 'i18next'
import { ipcErrorText } from '../../ipc-errors'

const basename = (path: string) => path.split('/').filter(Boolean).at(-1) ?? path
const home = (path: string) => path.replace(/^\/Users\/[^/]+/, '~')

/** Date courte : heure aujourd'hui, « hier », sinon jour et mois. */
function shortDate(iso: string | undefined, now = new Date()): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((day(now) - day(date)) / 86_400_000)
  if (days === 0)
    return date.toLocaleTimeString(currentLocale(), { hour: '2-digit', minute: '2-digit' })
  if (days === 1) return i18next.t('resume.yesterday')
  return date.toLocaleDateString(currentLocale(), {
    day: 'numeric',
    month: 'short',
    ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {})
  })
}

/** L'agent sait lister ses sessions, ou on ne le sait pas encore (jamais démarré). */
const canList = (p: ProfileSummary) =>
  p.available && p.capabilities.announced?.items.find((i) => i.id === 'list')?.supported !== false

type Listing =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'done'; sessions: AgentSessionView[] }

/** Liste reçue, et pour quelle demande (agent et dossier) : une autre demande est « en cours ». */
type Received = { key: string; listing: Exclude<Listing, { kind: 'loading' }> }

/**
 * « Reprendre une session… » (fiche 055) : les sessions qu'un agent garde (`bob chat`, Bob IDE,
 * OpenCode en terminal) et que l'historique ne connaît pas, celles du dossier d'abord. Choisir une
 * session l'ouvre comme une conversation : l'agent rejoue l'échange.
 */
export function ResumeDialog({
  profiles,
  profileId,
  workspace,
  onClose,
  onResume
}: {
  profiles: ProfileSummary[]
  /** Agent et dossier de la conversation affichée. */
  profileId: string
  workspace: string
  onClose: () => void
  onResume: (profileId: string, session: AgentSessionView) => Promise<void>
}) {
  const { t } = useTranslation()
  const listing = profiles.filter(canList)
  const [agent, setAgent] = useState(
    () => listing.find((p) => p.id === profileId)?.id ?? listing[0]?.id ?? ''
  )
  const [scope, setScope] = useState<'folder' | 'all'>('folder')
  const [query, setQuery] = useState('')
  const [received, setReceived] = useState<Received | null>(null)
  const only = scope === 'folder' ? workspace : undefined
  const key = `${agent}\u0000${only ?? ''}`
  const state: Listing = received?.key === key ? received.listing : { kind: 'loading' }
  const [selected, setSelected] = useState<string | null>(null)
  const [resuming, setResuming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!agent) return
    let current = true
    window.api.agent.listSessions(agent, only).then(
      (sessions) => current && setReceived({ key, listing: { kind: 'done', sessions } }),
      (e: unknown) =>
        current &&
        setReceived({
          key,
          listing: {
            kind: 'error',
            message: ipcErrorText(e)
          }
        })
    )
    return () => {
      current = false
    }
  }, [agent, only, key])

  const shown = useMemo(() => {
    if (received?.key !== key || received.listing.kind !== 'done') return []
    const { sessions } = received.listing
    const words = searchWords(query)
    return words.length === 0
      ? sessions
      : sessions.filter((s) => hasAllWords(`${s.title ?? ''} ${s.cwd}`, words))
  }, [received, key, query])
  const groups = useMemo(() => {
    const byFolder = new Map<string, AgentSessionView[]>()
    for (const s of shown) byFolder.set(s.cwd, [...(byFolder.get(s.cwd) ?? []), s])
    return [...byFolder.entries()]
  }, [shown])
  const chosen = shown.find((s) => s.sessionId === selected)
  const agentLabel = profiles.find((p) => p.id === agent)?.label ?? agent

  const resume = (session: AgentSessionView | undefined) => {
    if (!session || resuming) return
    setResuming(true)
    setError(null)
    onResume(agent, session).then(onClose, (e: unknown) => {
      setResuming(false)
      setError(ipcErrorText(e))
    })
  }

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog resume-dialog" data-testid="resume-dialog">
          <Dialog.Title className="confirm-title">{t('resume.title')}</Dialog.Title>
          <Dialog.Description className="confirm-text">
            {t('resume.description')}
          </Dialog.Description>
          {listing.length === 0 ? (
            <p className="confirm-text" data-testid="resume-unsupported">
              {t('resume.noAgent')}
            </p>
          ) : (
            <>
              <div className="resume-controls">
                <select
                  className="settings-input"
                  value={agent}
                  onChange={(e) => setAgent(e.target.value)}
                  aria-label={t('resume.agent')}
                  data-testid="resume-agent"
                >
                  {listing.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <div className="segmented" role="radiogroup" aria-label={t('resume.scope.label')}>
                  {(
                    [
                      ['folder', t('resume.scope.folder')],
                      ['all', t('resume.scope.all')]
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      role="radio"
                      aria-checked={scope === id}
                      className={scope === id ? 'active' : ''}
                      onClick={() => setScope(id)}
                      data-testid={`resume-scope-${id}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <label className="resume-search">
                <Search size={14} />
                <input
                  type="search"
                  value={query}
                  placeholder={t('resume.filter')}
                  aria-label={t('resume.filterLabel')}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') resume(chosen ?? shown[0])
                  }}
                  autoFocus
                  data-testid="resume-filter"
                />
              </label>
              <div className="resume-list" role="listbox" aria-label={t('resume.sessions')}>
                {state.kind === 'loading' && (
                  <p className="resume-empty">
                    <LoaderCircle size={14} className="spin" />{' '}
                    {t('resume.loading', { agent: agentLabel })}
                  </p>
                )}
                {state.kind === 'error' && (
                  <p className="resume-empty error" role="alert" data-testid="resume-error">
                    {state.message}
                  </p>
                )}
                {state.kind === 'done' && shown.length === 0 && (
                  <p className="resume-empty" data-testid="resume-none">
                    {query
                      ? t('resume.noMatch')
                      : scope === 'folder'
                        ? t('resume.noneInFolder', { agent: agentLabel })
                        : t('resume.none', { agent: agentLabel })}
                    {scope === 'folder' && !query && (
                      <button className="link-button" onClick={() => setScope('all')}>
                        {t('resume.showAll')}
                      </button>
                    )}
                  </p>
                )}
                {groups.map(([cwd, sessions]) => (
                  <div key={cwd} className="resume-group">
                    {scope === 'all' && (
                      <div className="resume-folder" title={cwd}>
                        <Folder size={13} />
                        <span>{basename(cwd)}</span>
                        <span className="muted">{home(cwd)}</span>
                      </div>
                    )}
                    {sessions.map((s) => (
                      <button
                        key={s.sessionId}
                        role="option"
                        aria-selected={s.sessionId === selected}
                        className={`resume-item${s.sessionId === selected ? ' selected' : ''}`}
                        onClick={() => setSelected(s.sessionId)}
                        onDoubleClick={() => resume(s)}
                        title={s.title}
                        data-testid="resume-session"
                      >
                        <span className="resume-title">{s.title || t('resume.untitled')}</span>
                        <span className="resume-date">{shortDate(s.updatedAt)}</span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </>
          )}
          {error && (
            <p className="resume-empty error" role="alert">
              {error}
            </p>
          )}
          <div className="confirm-actions">
            <Dialog.Close className="btn ghost">{t('common.cancel')}</Dialog.Close>
            <button
              className="btn primary"
              disabled={!chosen || resuming}
              onClick={() => resume(chosen)}
              data-testid="resume-confirm"
            >
              {resuming ? t('resume.resuming') : t('resume.resume')}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
