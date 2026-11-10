import { ChevronRight, CircleCheck, CircleDot, Circle, FilePen, History, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RESUME_MAX_FILES, RESUME_MAX_TASKS, resumeSummary } from '@shared/resume-card'
import type { TranscriptItem } from '@shared/transcript'
import { messageTime } from '../../time'
import '../../thread-extras.css'

/** Cartes fermées, par conversation et dernière activité : une fois par reprise. */
const dismissed = new Set<string>()

/** « et N autres » au bout d'une liste coupée. */
function More({ count }: { count: number }) {
  const { t } = useTranslation()
  return count > 0 ? <li className="resume-more">{t('resume.more', { count })}</li> : null
}

/**
 * « Où en était-on ? » (fiche 156) : en rouvrant une conversation inactive depuis plus d'un jour,
 * une carte en bas du fil, construite par Bobine (fil, plan, git) sans appeler le modèle. Elle
 * disparaît dès le message suivant ; fermée, elle ne revient pas pour cette reprise. À monter avec
 * `key` = la conversation : l'heure de réouverture est prise au montage.
 */
export function ResumeCard({
  conversationId,
  items
}: {
  conversationId: string
  items: TranscriptItem[]
}) {
  const { t } = useTranslation()
  const [openedAt] = useState(() => Date.now())
  const [files, setFiles] = useState<string[]>([])
  const [, setClosed] = useState(0)
  const summary = useMemo(() => resumeSummary(items, openedAt, files), [items, openedAt, files])
  const key = summary ? `${conversationId}:${summary.lastAt}` : ''
  const show = !!summary && !dismissed.has(key)
  useEffect(() => {
    if (!show) return
    let alive = true
    window.api.changes
      .git(conversationId)
      .then((changes) => alive && changes && setFiles(changes.files.map((f) => f.path)))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [conversationId, show])
  if (!summary || !show) return null
  const close = () => {
    dismissed.add(key)
    setClosed((n) => n + 1)
  }
  const done = summary.done.slice(-RESUME_MAX_TASKS)
  const todo = summary.todo.slice(0, RESUME_MAX_TASKS)
  const shownFiles = summary.files.slice(0, RESUME_MAX_FILES)
  return (
    <details className="resume-card" open data-testid="resume-card">
      <summary>
        <History size={14} />
        <span className="resume-title">{t('resume.title')}</span>
        <span className="resume-when">
          {t('resume.lastActivity', { when: messageTime(summary.lastAt) })}
        </span>
        <ChevronRight size={13} className="chevron" />
        <button
          type="button"
          className="icon-button small resume-close"
          aria-label={t('common.close')}
          title={t('common.close')}
          onClick={(e) => {
            e.preventDefault()
            close()
          }}
          data-testid="resume-close"
        >
          <X size={13} />
        </button>
      </summary>
      <div className="resume-body">
        {summary.request && (
          <section data-testid="resume-request">
            <h4>{t('resume.request')}</h4>
            <p>{summary.request}</p>
          </section>
        )}
        {done.length > 0 && (
          <section data-testid="resume-done">
            <h4>{t('resume.done')}</h4>
            <ul>
              <More count={summary.done.length - done.length} />
              {done.map((text, i) => (
                <li key={i}>
                  <CircleCheck size={13} className="resume-icon done" />
                  {text}
                </li>
              ))}
            </ul>
          </section>
        )}
        {todo.length > 0 && (
          <section data-testid="resume-todo">
            <h4>{t('resume.todo')}</h4>
            <ul>
              {todo.map((task, i) => (
                <li key={i} data-running={task.running || undefined}>
                  {task.running ? (
                    <CircleDot size={13} className="resume-icon running" />
                  ) : (
                    <Circle size={13} className="resume-icon" />
                  )}
                  {task.text}
                </li>
              ))}
              <More count={summary.todo.length - todo.length} />
            </ul>
          </section>
        )}
        {summary.reply && (
          <section data-testid="resume-reply">
            <h4>{t('resume.reply')}</h4>
            <p>{summary.reply}</p>
          </section>
        )}
        {shownFiles.length > 0 && (
          <section data-testid="resume-files">
            <h4>{t('resume.files', { count: summary.files.length })}</h4>
            <ul>
              {shownFiles.map((path) => (
                <li key={path}>
                  <FilePen size={13} className="resume-icon" />
                  <code>{path}</code>
                </li>
              ))}
              <More count={summary.files.length - shownFiles.length} />
            </ul>
          </section>
        )}
        <p className="resume-note">{t('resume.note')}</p>
      </div>
    </details>
  )
}
