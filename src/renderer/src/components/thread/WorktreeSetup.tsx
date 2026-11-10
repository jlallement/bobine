import {
  CircleCheck,
  CircleExclamationPoint,
  Clock,
  Copy,
  LoaderCircle,
  Wrench
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { HelpLink } from '../help/HelpLink'
import type { TFunction } from 'i18next'
import type { TranscriptItem } from '@shared/transcript'
import { setupSeconds } from '@shared/worktree-setup'

type Item = Extract<TranscriptItem, { kind: 'worktree-setup' }>

/** Issue de la commande, en quelques mots. */
function stateText(item: Item, t: TFunction): string {
  switch (item.state) {
    case 'running':
      return item.startedAt ? t('worktreeSetup.running') : t('worktreeSetup.copying')
    case 'done': {
      if (!item.command && item.archive) return t('worktreeSetup.archiveApproved')
      const seconds = setupSeconds(item)
      return seconds ? t('worktreeSetup.done', { seconds }) : t('worktreeSetup.doneShort')
    }
    case 'failed':
      if (item.stopped) return t('worktreeSetup.stopped')
      if (item.timedOut) return t('worktreeSetup.timedOut')
      if (item.exitCode !== undefined) return t('worktreeSetup.failed', { code: item.exitCode })
      return t('worktreeSetup.notStarted', { error: item.error ?? '' })
    case 'approval':
      return ''
    case 'skipped':
      return item.command ? t('worktreeSetup.skipped') : t('worktreeSetup.notApproved')
  }
}

export interface WorktreeSetupActions {
  /** « Autoriser » : l'empreinte des commandes montrées sur la carte. */
  onApprove?: ((signature: string) => void) | undefined
  /** « Continuer sans préparer » (à autoriser) ou « Continuer sans attendre » (en cours). */
  onSkip?: (() => void) | undefined
  /** « Arrêter » la commande en cours. */
  onStop?: (() => void) | undefined
}

/**
 * Préparation du worktree, sous son départ (fiche 175) : fichiers copiés depuis le dossier
 * d'origine (`.worktreeinclude`), les commandes que l'accord couvre (à la création, à la
 * suppression) et l'état, fin de la sortie (dépliable). Tant que les commandes ne sont pas
 * autorisées : « Autoriser et lancer » (action principale) ou « Continuer sans préparer » ;
 * pendant la commande : « Arrêter », et « Continuer sans attendre » quand un message attend.
 */
export function WorktreeSetup({
  item,
  onApprove,
  onSkip,
  onStop
}: { item: Item } & WorktreeSetupActions) {
  const { t } = useTranslation()
  const state = stateText(item, t)
  const Icon =
    item.state === 'running'
      ? LoaderCircle
      : item.state === 'failed'
        ? CircleExclamationPoint
        : item.state === 'done'
          ? CircleCheck
          : Wrench
  const hint =
    item.state === 'skipped'
      ? item.unattended
        ? t('worktreeSetup.unattendedHint')
        : item.command
          ? t('worktreeSetup.skippedHint')
          : ''
      : item.state === 'failed'
        ? t('worktreeSetup.failedHint')
        : item.proceeded
          ? t('worktreeSetup.proceededHint')
          : ''
  return (
    <div
      className={`worktree-origin worktree-setup ${item.state}`}
      data-testid="worktree-setup"
      data-state={item.state}
    >
      <div className="worktree-origin-line">
        <Icon
          size={14}
          className={`worktree-origin-icon${item.state === 'running' ? ' spin' : ''}`}
        />
        <span className="worktree-setup-title">{t('worktreeSetup.title')}</span>
        <HelpLink topic="worktreeSetup" section={t('worktreeSetup.title')} />
        {state && (
          <span className="worktree-setup-state" data-testid="worktree-setup-state">
            {state}
          </span>
        )}
      </div>
      {item.copy && <CopiedFiles copy={item.copy} />}
      <Commands item={item} />
      {item.state === 'approval' && <Approval item={item} onApprove={onApprove} onSkip={onSkip} />}
      {item.state === 'running' && item.startedAt && !item.proceeded && (
        <Running item={item} onSkip={onSkip} onStop={onStop} />
      )}
      {hint && <div className="worktree-setup-hint">{hint}</div>}
      {item.output && (
        <details className="worktree-setup-output" open={item.state === 'failed'}>
          <summary>{t('worktreeSetup.output')}</summary>
          <pre data-testid="worktree-setup-output">{item.output}</pre>
        </details>
      )}
    </div>
  )
}

/** Les commandes du dépôt, chacune avec son moment : ce que l'accord couvre, tout entier montré. */
function Commands({ item }: { item: Item }) {
  const { t } = useTranslation()
  const rows = [
    ...(item.command
      ? [{ id: 'command', label: t('worktreeSetup.atCreate'), text: item.command }]
      : []),
    ...(item.archive
      ? [{ id: 'archive', label: t('worktreeSetup.atRemove'), text: item.archive }]
      : [])
  ]
  if (!rows.length) return null
  return (
    <dl className="worktree-setup-commands">
      {rows.map((row) => (
        <div key={row.id} className="worktree-setup-command-row">
          <dt>{row.label}</dt>
          <dd>
            <code className="worktree-setup-command" data-testid={`worktree-setup-${row.id}`}>
              {row.text}
            </code>
          </dd>
        </div>
      ))}
    </dl>
  )
}

function HeldLine({ text }: { text: string }) {
  return (
    <span className="worktree-setup-held" data-testid="worktree-setup-held">
      <Clock size={13} />
      {text}
    </span>
  )
}

/** À autoriser : l'explication, le fichier changé, le message qui attend, et les deux choix. */
function Approval({ item, onApprove, onSkip }: { item: Item } & WorktreeSetupActions) {
  const { t } = useTranslation()
  const archiveOnly = !item.command
  const text = archiveOnly
    ? t('worktreeSetup.approvalArchive')
    : item.archive
      ? t('worktreeSetup.approvalBoth')
      : t('worktreeSetup.approval')
  const signature = item.signature
  return (
    <div className="worktree-setup-approval">
      <span>{text}</span>
      {item.changed && (
        <span className="worktree-setup-changed" data-testid="worktree-setup-changed">
          <CircleExclamationPoint size={13} />
          {t('worktreeSetup.changed')}
        </span>
      )}
      {item.held ? <HeldLine text={t('worktreeSetup.held', { count: item.held })} /> : null}
      <div className="worktree-setup-actions">
        {onApprove && signature && (
          <button
            className="btn small primary"
            title={t(
              archiveOnly ? 'worktreeSetup.approveArchiveTitle' : 'worktreeSetup.approveTitle'
            )}
            onClick={() => onApprove(signature)}
            data-testid="worktree-setup-approve"
          >
            {t(archiveOnly ? 'worktreeSetup.approveArchive' : 'worktreeSetup.approve')}
          </button>
        )}
        {onSkip && (
          <button
            className="btn small ghost"
            title={t(archiveOnly ? 'worktreeSetup.refuseArchiveTitle' : 'worktreeSetup.skipTitle')}
            onClick={onSkip}
            data-testid="worktree-setup-skip"
          >
            {t(archiveOnly ? 'worktreeSetup.refuseArchive' : 'worktreeSetup.skip')}
          </button>
        )}
      </div>
    </div>
  )
}

/** Commande en cours : le message qui attend, « Arrêter », « Continuer sans attendre ». */
function Running({ item, onSkip, onStop }: { item: Item } & WorktreeSetupActions) {
  const { t } = useTranslation()
  return (
    <div className="worktree-setup-approval">
      {item.held ? <HeldLine text={t('worktreeSetup.heldRunning', { count: item.held })} /> : null}
      <div className="worktree-setup-actions">
        {onStop && (
          <button
            className="btn small"
            title={t('worktreeSetup.stopTitle')}
            onClick={onStop}
            data-testid="worktree-setup-stop"
          >
            {t('worktreeSetup.stop')}
          </button>
        )}
        {onSkip && item.held ? (
          <button
            className="btn small ghost"
            title={t('worktreeSetup.proceedTitle')}
            onClick={onSkip}
            data-testid="worktree-setup-proceed"
          >
            {t('worktreeSetup.proceed')}
          </button>
        ) : null}
      </div>
    </div>
  )
}

/** Fichiers copiés : le nombre, dépliable en liste (50 chemins au plus), ignorés et plafond. */
function CopiedFiles({ copy }: { copy: NonNullable<Item['copy']> }) {
  const { t } = useTranslation()
  const { count } = copy
  const more = count - copy.files.length
  const extra = [
    copy.skipped ? t('worktreeSetup.skipped', { count: copy.skipped }) : '',
    copy.truncated ? t('worktreeSetup.truncated', { count: copy.truncated }) : '',
    copy.error ? t('worktreeSetup.copyError', { error: copy.error }) : ''
  ].filter(Boolean)
  const summary = count ? t('worktreeSetup.copied', { count }) : t('worktreeSetup.copiedNone')
  return (
    <div className="worktree-setup-copy" data-testid="worktree-setup-copy">
      <Copy size={13} />
      <div className="worktree-setup-copy-body">
        {count ? (
          <details>
            <summary data-testid="worktree-setup-copy-summary">{summary}</summary>
            <ul className="worktree-setup-files" aria-label={t('worktreeSetup.filesTitle')}>
              {copy.files.map((file) => (
                <li key={file}>
                  <code>{file}</code>
                </li>
              ))}
              {more > 0 && (
                <li className="worktree-setup-more">{t('worktreeSetup.more', { count: more })}</li>
              )}
            </ul>
          </details>
        ) : (
          <span data-testid="worktree-setup-copy-summary">{summary}</span>
        )}
        {extra.length > 0 && (
          <div className="worktree-setup-copy-extra" data-testid="worktree-setup-copy-extra">
            {extra.join(' · ')}
          </div>
        )}
      </div>
    </div>
  )
}
