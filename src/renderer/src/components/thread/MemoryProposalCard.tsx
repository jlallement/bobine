import { useContext, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Bookmark,
  ChevronDown,
  CircleCheck,
  CircleX,
  Info,
  Trash,
  TriangleAlert
} from 'lucide-react'
import { commandPassages, type MemoryProposalItem } from '@shared/memory'
import { currentLocale } from '@shared/i18n/format'
import { TurnControlsContext } from '../../turn-controls'
import { ipcErrorText } from '../../ipc-errors'
import { Markdown } from './Markdown'
import { Highlighted } from '../common/Highlighted'
import '../../memory.css'

/** Au-delà, un corps sans risque est replié (jamais résumé). */
const FOLD_LINES = 6

/**
 * Proposition de l'agent de retenir ou d'oublier un souvenir (fiche 182, ADR-0040) : le texte
 * entier, la portée, ce qu'elle remplace ; « Retenir » / « Non ». Rien n'est écrit avant le clic.
 * Après la lecture d'un contenu externe, ou si le texte contient une commande à exécuter, aucun
 * bouton n'est mis en avant et le corps n'est jamais replié. Aucun bouton ne prend le focus de
 * lui-même. Décidée : une ligne.
 */
export function MemoryProposalCard({ item }: { item: MemoryProposalItem }) {
  const { t } = useTranslation()
  const memory = useContext(TurnControlsContext)?.memory
  // Version actuelle quand le souvenir a changé depuis la proposition ; `null` : supprimé depuis.
  const [changed, setChanged] = useState<{
    description: string
    body: string
    updated: string
  } | null>()
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const forget = item.action === 'forget'
  const { draft } = item

  if (item.status !== 'pending') return <DecidedLine item={item} />

  const decide = (accept: boolean) => {
    if (!memory || busy) return
    setBusy(true)
    setError(undefined)
    memory
      .decide(item.proposalId, accept, accept && changed !== undefined)
      .then((result) => {
        if (!result.done) setChanged(result.changed)
      })
      .catch((e: unknown) => setError(ipcErrorText(e)))
      .finally(() => setBusy(false))
  }

  const source = item.sourceOf
  const sourceText = !source
    ? t('memory.source.unknown')
    : source.kind === 'web'
      ? source.detail
        ? t('memory.source.webNamed', { host: source.detail })
        : t('memory.source.web')
      : source.kind === 'mcp'
        ? t('memory.source.mcp', { server: source.detail ?? '?' })
        : source.kind === 'browser'
          ? t('memory.source.browser')
          : t('memory.source.attachment')
  const passages = commandPassages(draft.body)
  // La description part dans l'index de chaque session : une commande y est repérée aussi.
  const descriptionPassages = commandPassages(draft.description)
  const command = passages.length + descriptionPassages.length > 0
  const risky = item.source === 'external' || command
  const replaced = forget || changed === null ? undefined : (changed ?? item.replaces)
  // Mémoire coupée : « Retenir » grisé, « Non » reste possible (il n'écrit rien).
  const disabled = !memory?.enabled || busy
  return (
    <div
      className="memory-card"
      data-testid="memory-card"
      data-action={item.action}
      data-risky={risky ? 'true' : undefined}
    >
      <div className="memory-card-title">
        {forget ? <Trash size={15} aria-hidden /> : <Bookmark size={15} aria-hidden />}
        <strong>{t(forget ? 'memory.card.forgetTitle' : 'memory.card.rememberTitle')}</strong>
        <span className="memory-card-who">{t('memory.card.by', { agent: item.agent })}</span>
      </div>
      <div className="memory-card-description">
        <Highlighted text={draft.description} passages={descriptionPassages} />
      </div>
      <div className="memory-chips">
        <span className="memory-chip">
          {draft.scope === 'user'
            ? t('memory.scope.user')
            : item.project
              ? t('memory.scope.projectNamed', { project: item.project })
              : t('memory.scope.project')}
        </span>
      </div>
      {risky && (
        <div className="memory-banner" data-testid="memory-banner" role="note">
          <TriangleAlert size={14} aria-hidden />
          <span>
            {item.source === 'external' && t('memory.card.external', { source: sourceText })}
            {item.source === 'external' && command && ' '}
            {command && t('memory.card.command')}
          </span>
        </div>
      )}
      <MemoryBody body={draft.body} passages={passages} foldable={!risky} />
      {changed === null && (
        <div className="memory-replaces memory-changed" data-testid="memory-changed">
          <Info size={13} aria-hidden />
          {t('memory.card.deletedSince')}
        </div>
      )}
      {replaced && (
        <div className="memory-replaces" data-testid="memory-replaces">
          {changed && (
            <div className="memory-changed" data-testid="memory-changed">
              <Info size={13} aria-hidden />
              {t('memory.card.changed', { date: shortDate(changed.updated) })}
            </div>
          )}
          <div>
            {t('memory.card.replaces', {
              description: replaced.description,
              date: shortDate(replaced.updated)
            })}
          </div>
          <div className="memory-replaces-old">{replaced.body}</div>
        </div>
      )}
      <div className="memory-card-actions">
        <button
          type="button"
          className={`btn small${risky ? '' : ' primary'}`}
          disabled={disabled}
          onClick={() => decide(true)}
          data-testid="memory-accept"
        >
          {t(forget ? 'memory.card.forget' : 'memory.card.remember')}
        </button>
        <button
          type="button"
          className="btn small"
          disabled={!memory || busy}
          onClick={() => decide(false)}
          data-testid="memory-decline"
        >
          {t('memory.card.no')}
        </button>
        {memory && !memory.enabled && (
          <span className="memory-card-hint">
            {t('memory.card.off')} ·{' '}
            <button type="button" className="link-button" onClick={() => memory.open()}>
              {t('memory.card.settings')}
            </button>
          </span>
        )}
      </div>
      {error && <div className="memory-error">{error}</div>}
    </div>
  )
}

/** Corps du souvenir : Markdown, ou texte brut avec les commandes repérées surlignées. */
function MemoryBody({
  body,
  passages,
  foldable
}: {
  body: string
  passages: [number, number][]
  foldable: boolean
}) {
  const { t } = useTranslation()
  const lines = body.split('\n').length
  const [open, setOpen] = useState(false)
  const folded = foldable && !open && lines > FOLD_LINES
  if (passages.length > 0) {
    return (
      <div className="memory-body memory-body-plain">
        <Highlighted text={body} passages={passages} />
      </div>
    )
  }
  return (
    <>
      <div className={`memory-body${folded ? ' memory-body-folded' : ''}`}>
        <Markdown text={body} />
      </div>
      {folded && (
        <button type="button" className="link-button memory-more" onClick={() => setOpen(true)}>
          <ChevronDown size={13} aria-hidden />
          {t('memory.card.showAll', { count: lines })}
        </button>
      )}
    </>
  )
}

/** Décidée : une ligne (« Retenu », « Non retenu », « Oublié »), « Voir » pour un souvenir gardé. */
function DecidedLine({ item }: { item: MemoryProposalItem }) {
  const { t } = useTranslation()
  const memory = useContext(TurnControlsContext)?.memory
  const Icon = item.status === 'kept' ? CircleCheck : item.status === 'forgotten' ? Trash : CircleX
  return (
    <div className={`memory-decided memory-decided-${item.status}`} data-testid="memory-decided">
      <Icon size={14} aria-hidden />
      <span>{t(`memory.decided.${item.status === 'pending' ? 'kept' : item.status}`)}</span>
      <span className="memory-decided-name">{item.draft.description}</span>
      {item.status === 'kept' && memory && (
        <button type="button" className="link-button" onClick={() => memory.open(item.draft.name)}>
          {t('memory.decided.view')}
        </button>
      )}
    </div>
  )
}

/** « 2 novembre » dans la langue de l'app ; vide si la date est illisible. */
function shortDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(currentLocale(), { day: 'numeric', month: 'long' })
}
