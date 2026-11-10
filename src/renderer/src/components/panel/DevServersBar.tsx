import { ScrollText, Square } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { DevServerView } from '@shared/launch'
import { Tip } from '../common/Menus'
import { useTranslation } from 'react-i18next'

/**
 * Serveurs de dev du projet lancés par l'agent (fiche 030), sous la barre d'adresse : état, ouvrir,
 * arrêter, journaux.
 */
export function DevServersBar({
  conversationId,
  onOpen
}: {
  conversationId: string
  onOpen: (url: string) => void
}) {
  const { t } = useTranslation()
  const [servers, setServers] = useState<DevServerView[]>([])
  const [logsOf, setLogsOf] = useState<string | null>(null)
  const [logs, setLogs] = useState<string[]>([])

  useEffect(() => {
    let alive = true
    const refresh = () =>
      void window.api.preview
        .list(conversationId)
        .then((list) => alive && setServers(list))
        .catch(() => {})
    refresh()
    const off = window.api.preview.onChanged(refresh)
    return () => {
      alive = false
      off()
    }
  }, [conversationId])

  // Journal affiché : rafraîchi tant qu'il est ouvert.
  useEffect(() => {
    if (!logsOf) return
    let alive = true
    const refresh = () =>
      void window.api.preview
        .logs(conversationId, logsOf)
        .then((lines) => alive && setLogs(lines))
        .catch(() => {})
    refresh()
    const timer = setInterval(refresh, 1000)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [conversationId, logsOf])

  if (servers.length === 0) return null
  return (
    <div className="dev-servers" data-testid="dev-servers">
      <div className="dev-servers-row">
        {servers.map((server) => (
          <div
            key={server.name}
            className={`dev-server ${server.status}`}
            title={`${server.command}\n${server.url}`}
            data-testid="dev-server"
            data-status={server.status}
          >
            <span className="dev-server-dot" />
            <button
              type="button"
              className="dev-server-name"
              onClick={() => onOpen(server.url)}
              disabled={server.status !== 'running' && server.status !== 'attached'}
            >
              {server.name}
            </button>
            <span className="dev-server-status">{t(`devServers.status.${server.status}`)}</span>
            <Tip label={logsOf === server.name ? t('devServers.hideLog') : t('devServers.showLog')}>
              <button
                type="button"
                className={`icon-button small${logsOf === server.name ? ' active' : ''}`}
                aria-label={t('devServers.showLog')}
                onClick={() => setLogsOf(logsOf === server.name ? null : server.name)}
                data-testid="dev-server-logs"
              >
                <ScrollText size={13} />
              </button>
            </Tip>
            {(server.status === 'running' || server.status === 'starting') && (
              <Tip label={t('devServers.stop')}>
                <button
                  type="button"
                  className="icon-button small"
                  aria-label={t('devServers.stop')}
                  onClick={() => void window.api.preview.stop(conversationId, server.name)}
                  data-testid="dev-server-stop"
                >
                  <Square size={11} fill="currentColor" />
                </button>
              </Tip>
            )}
          </div>
        ))}
      </div>
      {logsOf && (
        <pre className="dev-server-logs" data-testid="dev-server-log-text">
          {logs.join('\n') || t('devServers.noLines')}
        </pre>
      )}
    </div>
  )
}
