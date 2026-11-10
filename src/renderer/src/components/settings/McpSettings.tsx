import { Check, Copy, LoaderCircle, Pencil, PlugZap, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { numberFormat } from '@shared/i18n/format'
import {
  joinCommandLine,
  splitCommandLine,
  type AppToolFamily,
  type McpAgentView,
  type McpScope,
  type McpServer,
  type McpServerEntry
} from '@shared/mcp'
import {
  mcpKey,
  mcpStatus,
  testMcpServer,
  testMcpServers,
  useMcpStatuses,
  type McpStatus
} from '../../mcp-status'
import { Trans, useTranslation } from 'react-i18next'
import { useDisplayPath } from '../../presentation'
import { ipcErrorText } from '../../ipc-errors'
import { AppToolsTab, appToolCount } from './AppToolsTab'
import { ConfirmRow, useConfirm } from './ConfirmRow'

const seconds = (ms: number) => `${numberFormat({ maximumFractionDigits: 1 }).format(ms / 1000)} s`

/** Pastille d'état d'un serveur : vert joignable, rouge en erreur, gris désactivé ou pas testé. */
export function McpDot({ server, status }: { server: McpServerEntry; status?: McpStatus }) {
  const { t } = useTranslation()
  const state = !server.enabled
    ? 'off'
    : status === undefined
      ? 'unknown'
      : status === 'testing'
        ? 'testing'
        : status.ok
          ? 'ok'
          : 'error'
  const label = t(`mcp.state.${state}`)
  return (
    <span
      className={`mcp-dot ${state}`}
      role="img"
      aria-label={label}
      title={label}
      data-testid="mcp-dot"
      data-state={state}
    />
  )
}

/**
 * L'erreur en une ligne : le message, et la ligne la plus parlante de la sortie d'erreur du serveur
 * (celle qui dit « error », sinon la dernière).
 */
export function errorSummary(error: string): string {
  const [message, ...stderr] = error.split('\n').map((l) => l.trim())
  // Sans les lignes de pile d'appels (« at … »).
  const lines = stderr.filter((l) => l && !/^at\s/.test(l))
  const telling = lines.find((l) => /error|erreur/i.test(l)) ?? lines.at(-1)
  return telling ? `${message} — ${telling}` : (message ?? error)
}

/** Résultat de « Tester » (fiche 060), en une ligne ; le détail au survol. */
export function TestLine({ result }: { result: McpStatus | undefined }) {
  const { t } = useTranslation()
  if (!result) return null
  if (result === 'testing') {
    return (
      <div className="mcp-test" data-testid="mcp-test-result" data-state="testing">
        <LoaderCircle size={12} className="spin" /> {t('mcp.test.connecting')}
      </div>
    )
  }
  if (!result.ok) {
    return (
      <div
        className="mcp-test error"
        title={result.error}
        data-testid="mcp-test-result"
        data-state="error"
      >
        <X size={12} /> {errorSummary(result.error)}
      </div>
    )
  }
  const parts = [
    result.server
      ? `${result.server.name}${result.server.version ? ` ${result.server.version}` : ''}`
      : null,
    t('mcp.test.tools', { count: result.tools.length }),
    result.resources !== undefined ? t('mcp.test.resources', { count: result.resources }) : null,
    result.prompts !== undefined ? t('mcp.test.prompts', { count: result.prompts }) : null,
    seconds(result.ms)
  ].filter(Boolean)
  return (
    <div
      className="mcp-test ok"
      title={
        result.tools.length ? t('mcp.test.toolsTip', { tools: result.tools.join(', ') }) : undefined
      }
      data-testid="mcp-test-result"
      data-state="ok"
    >
      <Check size={12} /> {t('mcp.test.reachable', { details: parts.join(' · ') })}
    </div>
  )
}

const basename = (path: string) => path.split('/').filter(Boolean).at(-1) ?? path

/** Formulaire d'un serveur : champs texte, convertis à l'enregistrement. */
interface Draft {
  profileId: string
  previousName?: string
  previousScope?: McpScope
  name: string
  transport: 'stdio' | 'http'
  commandLine: string
  url: string
  /** `CLÉ=valeur` par ligne (variables) ou `Nom: valeur` (en-têtes). */
  pairs: string
  scope: McpScope
  enabled: boolean
}

function toDraft(profileId: string, entry?: McpServerEntry): Draft {
  if (!entry) {
    return {
      profileId,
      name: '',
      transport: 'stdio',
      commandLine: '',
      url: '',
      pairs: '',
      scope: 'global',
      enabled: true
    }
  }
  const pairs =
    entry.transport === 'http'
      ? Object.entries(entry.headers ?? {}).map(([k, v]) => `${k}: ${v}`)
      : Object.entries(entry.env ?? {}).map(([k, v]) => `${k}=${v}`)
  return {
    profileId,
    previousName: entry.name,
    previousScope: entry.scope,
    name: entry.name,
    transport: entry.transport,
    commandLine: joinCommandLine([entry.command ?? '', ...(entry.args ?? [])].filter(Boolean)),
    url: entry.url ?? '',
    pairs: pairs.join('\n'),
    scope: entry.scope,
    enabled: entry.enabled
  }
}

function parsePairs(text: string, separator: '=' | ':'): Record<string, string> {
  const result: Record<string, string> = {}
  for (const line of text.split('\n')) {
    const at = line.indexOf(separator)
    if (at <= 0) continue
    const key = line.slice(0, at).trim()
    if (key) result[key] = line.slice(at + 1).trim()
  }
  return result
}

function fromDraft(draft: Draft): McpServer {
  if (draft.transport === 'http') {
    const headers = parsePairs(draft.pairs, ':')
    return {
      name: draft.name.trim(),
      transport: 'http',
      url: draft.url.trim(),
      ...(Object.keys(headers).length ? { headers } : {}),
      enabled: draft.enabled
    }
  }
  const [command = '', ...args] = splitCommandLine(draft.commandLine.trim())
  const env = parsePairs(draft.pairs, '=')
  return {
    name: draft.name.trim(),
    transport: 'stdio',
    command,
    ...(args.length ? { args } : {}),
    ...(Object.keys(env).length ? { env } : {}),
    enabled: draft.enabled
  }
}

function summary(server: McpServerEntry): string {
  return server.transport === 'http'
    ? (server.url ?? '')
    : joinCommandLine([server.command ?? '', ...(server.args ?? [])])
}

/** Onglet des outils de Bobine (fiche 099) : le premier, choisi par défaut. */
export const BOBINE_TAB = 'bobine'

/**
 * Réglages › Serveurs MCP : les outils de Bobine (fiche 099), puis les serveurs de chaque agent
 * (fiche 025), ceux déclarés dans les fichiers de Bob et d'OpenCode, à activer, modifier, copier
 * d'un agent à l'autre. L'app écrit dans ces fichiers, dans le format de chaque agent : ce qui est
 * configuré ici vaut aussi pour `bob` et `opencode` dans un terminal.
 */
export function McpSettings({
  workspace,
  initialTab,
  onSection
}: {
  workspace: string
  initialTab?: string
  /** Ouvre une autre section des réglages (famille réglée ailleurs, fiche 182). */
  onSection?: (section: 'memory') => void
}) {
  const { t } = useTranslation()
  const [views, setViews] = useState<McpAgentView[] | null>(null)
  const [families, setFamilies] = useState<AppToolFamily[] | null>(null)
  const [tab, setTab] = useState(initialTab ?? BOBINE_TAB)
  const [error, setError] = useState<string | null>(null)
  const [familiesError, setFamiliesError] = useState<string | null>(null)
  // Résultats de « Tester », partagés avec « Réglages de la session » (mcp-status.ts).
  useMcpStatuses()

  useEffect(() => {
    let alive = true
    window.api.mcp
      .list()
      .then((list) => {
        if (!alive) return
        setViews(list)
        // État de chaque serveur activé, sans résultat récent : testé à l'ouverture, l'un après
        // l'autre (fiche 060).
        void (async () => {
          for (const v of list) await testMcpServers(v.profileId, v.servers, true)
        })()
      })
      .catch((e: unknown) => alive && setError(ipcErrorText(e)))
    window.api.mcp
      .appTools()
      .then((list) => alive && setFamilies(list))
      .catch((e: unknown) => alive && setFamiliesError(ipcErrorText(e)))
    return () => {
      alive = false
    }
  }, [workspace])

  const agentTab = tab !== BOBINE_TAB
  const view = agentTab ? (views?.find((v) => v.profileId === tab) ?? views?.[0]) : undefined
  return (
    <div className="mcp-settings" data-testid="mcp-settings">
      <div className="segmented" role="tablist" aria-label={t('mcp.tabsLabel')}>
        <button
          role="tab"
          aria-selected={!view}
          className={view ? '' : 'active'}
          onClick={() => setTab(BOBINE_TAB)}
          data-testid="mcp-tab-bobine"
        >
          {t('mcp.bobine.tab')}
          {families && <span className="count">{appToolCount(families)}</span>}
        </button>
        {views?.map((v) => (
          <button
            key={v.profileId}
            role="tab"
            aria-selected={v.profileId === view?.profileId}
            className={v.profileId === view?.profileId ? 'active' : ''}
            onClick={() => setTab(v.profileId)}
            data-testid={`mcp-agent-${v.profileId}`}
          >
            {v.label}
            <span className="count">{v.servers.length}</span>
          </button>
        ))}
      </div>
      {view && views ? (
        <AgentServers
          key={view.profileId}
          view={view}
          views={views}
          workspace={workspace}
          onViews={setViews}
        />
      ) : agentTab && !views && !error ? (
        <p className="settings-row-hint">{t('mcp.loading')}</p>
      ) : (
        <AppToolsTab
          families={families}
          error={familiesError}
          {...(onSection ? { onSection } : {})}
          onToggle={(id, enabled) =>
            void window.api.mcp
              .setAppToolFamily(id, enabled)
              .then(setFamilies)
              .catch((e: unknown) => setFamiliesError(ipcErrorText(e)))
          }
        />
      )}
      {error && <p className="settings-row-hint">{error}</p>}
      {views?.length === 0 && <p className="settings-row-hint">{t('mcp.noAgent')}</p>}
    </div>
  )
}

/** Serveurs MCP d'un agent (fiche 025) : liste, formulaire, « Tester » (fiche 060). */
function AgentServers({
  view,
  views,
  workspace,
  onViews
}: {
  view: McpAgentView
  views: McpAgentView[]
  workspace: string
  onViews: (views: McpAgentView[]) => void
}) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState<string | null>(null)
  const confirm = useConfirm()

  const run = (action: Promise<McpAgentView[]>, after?: () => void) => {
    setError(null)
    action
      .then((list) => {
        onViews(list)
        after?.()
      })
      .catch((e: unknown) => setError(ipcErrorText(e)))
  }

  const others = views.filter((v) => v.profileId !== view.profileId)
  const key = (s: McpServerEntry) => `${s.scope}:${s.name}`
  const status = (s: McpServerEntry) => mcpStatus(mcpKey(view.profileId, s))
  const test = (server: McpServerEntry) => testMcpServer(view.profileId, server)
  const testAll = () =>
    testMcpServers(
      view.profileId,
      view.servers.map((s) => ({ ...s, enabled: true }))
    )

  return (
    <>
      {/* Chemins des fichiers de l'agent : longs, dans une note repliée (fiche 136). */}
      <details className="settings-fold" data-testid="mcp-files">
        <summary>{t('mcp.files.summary', { agent: view.label })}</summary>
        <p className="settings-row-hint">
          <Trans
            t={t}
            i18nKey={view.files.project ? 'mcp.files.both' : 'mcp.files.global'}
            values={{
              agent: view.label,
              global: view.files.global,
              project: view.files.project ?? ''
            }}
            components={{ code: <code /> }}
          />
        </p>
      </details>
      {view.error && (
        <div className="settings-note error" data-testid="mcp-file-error">
          {view.error}
        </div>
      )}
      {error && (
        <div className="settings-note error" role="alert" data-testid="mcp-error">
          {error}
        </div>
      )}

      {view.servers.length === 0 && !draft ? (
        <p className="settings-row-hint">{t('mcp.none', { agent: view.label })}</p>
      ) : (
        <ul className="settings-list mcp-list" data-testid="mcp-list">
          {view.servers.map((server) => (
            <li key={key(server)} data-testid="mcp-server" data-name={server.name}>
              <label
                className="switch"
                title={server.enabled ? t('mcp.server.disable') : t('mcp.server.enable')}
              >
                <input
                  type="checkbox"
                  checked={server.enabled}
                  onChange={(e) =>
                    run(
                      window.api.mcp.setEnabled(
                        view.profileId,
                        server.scope,
                        server.name,
                        e.target.checked
                      )
                    )
                  }
                  aria-label={t('mcp.server.enabledLabel', { name: server.name })}
                  data-testid="mcp-enabled"
                />
                <span />
              </label>
              <div className="mcp-server-text">
                <div className="mcp-server-name">
                  <McpDot server={server} status={status(server)} />
                  {server.name}
                  <span className="mcp-badge">
                    {server.scope === 'global' ? t('mcp.server.global') : t('mcp.server.folder')}
                  </span>
                  {server.transport === 'http' && (
                    <span className="mcp-badge">{t('mcp.server.web')}</span>
                  )}
                </div>
                <div className="mcp-server-detail mono" title={summary(server)}>
                  {summary(server)}
                  {server.env &&
                    ` · ${t('mcp.server.variables', { n: Object.keys(server.env).length })}`}
                  {server.headers &&
                    ` · ${t('mcp.server.headers', { n: Object.keys(server.headers).length })}`}
                </div>
                <TestLine result={status(server)} />
              </div>
              <button
                className="icon-button small"
                aria-label={t('mcp.server.testLabel', { name: server.name })}
                title={t('mcp.server.test')}
                disabled={status(server) === 'testing'}
                onClick={() => void test(server)}
                data-testid="mcp-test"
              >
                <PlugZap size={13} />
              </button>
              <button
                className="icon-button small"
                aria-label={t('mcp.server.editLabel', { name: server.name })}
                title={t('mcp.server.edit')}
                onClick={() => setDraft(toDraft(view.profileId, server))}
                data-testid="mcp-edit"
              >
                <Pencil size={13} />
              </button>
              {others.map((other) => (
                <button
                  key={other.profileId}
                  className="icon-button small"
                  aria-label={t('mcp.server.copyLabel', { name: server.name, agent: other.label })}
                  title={t('mcp.server.copy', { agent: other.label })}
                  onClick={() => {
                    if (
                      other.servers.some((s) => s.name === server.name && s.scope === server.scope)
                    ) {
                      setError(
                        t('mcp.server.copyExists', { agent: other.label, name: server.name })
                      )
                      return
                    }
                    run(window.api.mcp.save(other.profileId, server.scope, fromEntry(server)), () =>
                      setError(null)
                    )
                  }}
                  data-testid="mcp-copy"
                >
                  <Copy size={13} />
                </button>
              ))}
              <button
                className="icon-button small"
                aria-label={t('mcp.server.removeLabel', { name: server.name })}
                aria-expanded={confirm.asking === key(server)}
                title={t('mcp.server.remove')}
                onClick={() => confirm.ask(key(server))}
                data-testid="mcp-remove"
              >
                <Trash2 size={13} />
              </button>
              {confirm.asking === key(server) && (
                <ConfirmRow
                  message={t('mcp.server.removeAsk', { name: server.name })}
                  action={t('mcp.server.remove')}
                  onConfirm={() => {
                    confirm.done()
                    run(window.api.mcp.remove(view.profileId, server.scope, server.name))
                  }}
                  onCancel={confirm.done}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      {draft ? (
        <McpForm
          draft={draft}
          workspace={workspace}
          agent={view.label}
          onChange={setDraft}
          onCancel={() => {
            setDraft(null)
            setError(null)
          }}
          onSave={() => {
            const server = fromDraft(draft)
            const moved = draft.previousName && draft.previousScope !== draft.scope
            // Changement de portée : ajouté dans l'autre fichier, puis retiré de l'ancien.
            const save = window.api.mcp
              .save(draft.profileId, draft.scope, server, moved ? undefined : draft.previousName)
              .then((list) =>
                moved && draft.previousName && draft.previousScope
                  ? window.api.mcp.remove(draft.profileId, draft.previousScope, draft.previousName)
                  : list
              )
            run(save, () => setDraft(null))
          }}
        />
      ) : (
        <div className="mcp-actions">
          <button
            className="btn small"
            onClick={() => setDraft(toDraft(view.profileId))}
            data-testid="mcp-add"
          >
            <Plus size={13} /> {t('mcp.add')}
          </button>
          {view.servers.length > 0 && (
            <button
              className="btn small"
              onClick={() => void testAll()}
              disabled={view.servers.some((s) => status(s) === 'testing')}
              data-testid="mcp-test-all"
            >
              <PlugZap size={13} /> {t('mcp.testAll')}
            </button>
          )}
        </div>
      )}
    </>
  )
}

function fromEntry(entry: McpServerEntry): McpServer {
  const { scope: _scope, file: _file, ...server } = entry
  return server
}

function McpForm({
  draft,
  workspace,
  agent,
  onChange,
  onCancel,
  onSave
}: {
  draft: Draft
  workspace: string
  agent: string
  onChange: (draft: Draft) => void
  onCancel: () => void
  onSave: () => void
}) {
  const { t } = useTranslation()
  const displayPath = useDisplayPath()
  const set = (change: Partial<Draft>) => onChange({ ...draft, ...change })
  const http = draft.transport === 'http'
  return (
    <form
      className="mcp-form"
      onSubmit={(e) => {
        e.preventDefault()
        onSave()
      }}
      data-testid="mcp-form"
    >
      <div className="mcp-form-title">
        {draft.previousName
          ? t('mcp.form.editTitle', { name: draft.previousName })
          : t('mcp.form.newTitle', { agent })}
      </div>
      <label>
        <span>{t('mcp.form.name')}</span>
        <input
          autoFocus
          value={draft.name}
          placeholder={t('mcp.form.namePlaceholder')}
          onChange={(e) => set({ name: e.target.value })}
          data-testid="mcp-name"
        />
      </label>
      <div className="segmented" role="radiogroup" aria-label={t('mcp.form.transport')}>
        <button
          type="button"
          role="radio"
          aria-checked={!http}
          className={!http ? 'active' : ''}
          onClick={() => set({ transport: 'stdio' })}
          data-testid="mcp-transport-stdio"
        >
          {t('mcp.form.stdio')}
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={http}
          className={http ? 'active' : ''}
          onClick={() => set({ transport: 'http' })}
          data-testid="mcp-transport-http"
        >
          {t('mcp.form.http')}
        </button>
      </div>
      {http ? (
        <label>
          <span>{t('mcp.form.url')}</span>
          <input
            value={draft.url}
            placeholder={t('mcp.form.urlPlaceholder')}
            onChange={(e) => set({ url: e.target.value })}
            data-testid="mcp-url"
          />
        </label>
      ) : (
        <label>
          <span>{t('mcp.form.command')}</span>
          <input
            className="mono"
            value={draft.commandLine}
            placeholder={t('mcp.form.commandPlaceholder')}
            onChange={(e) => set({ commandLine: e.target.value })}
            data-testid="mcp-command"
          />
        </label>
      )}
      <label>
        <span>{http ? t('mcp.form.headers') : t('mcp.form.env')}</span>
        <textarea
          className="mono"
          rows={2}
          value={draft.pairs}
          placeholder={http ? 'Authorization: Bearer …' : 'API_KEY=…'}
          onChange={(e) => set({ pairs: e.target.value })}
          data-testid="mcp-pairs"
        />
        <small>{t('mcp.form.plainText')}</small>
      </label>
      <div className="segmented" role="radiogroup" aria-label={t('mcp.form.scope')}>
        <button
          type="button"
          role="radio"
          aria-checked={draft.scope === 'global'}
          className={draft.scope === 'global' ? 'active' : ''}
          onClick={() => set({ scope: 'global' })}
          data-testid="mcp-scope-global"
        >
          {t('mcp.form.scopeGlobal')}
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={draft.scope === 'project'}
          className={draft.scope === 'project' ? 'active' : ''}
          onClick={() => set({ scope: 'project' })}
          title={displayPath(workspace)}
          data-testid="mcp-scope-project"
        >
          {t('mcp.form.scopeProject', { folder: basename(workspace) })}
        </button>
      </div>
      <div className="mcp-form-actions">
        <button type="button" className="btn small ghost" onClick={onCancel}>
          {t('common.cancel')}
        </button>
        <button type="submit" className="btn small primary" data-testid="mcp-save">
          {t('common.save')}
        </button>
      </div>
    </form>
  )
}
