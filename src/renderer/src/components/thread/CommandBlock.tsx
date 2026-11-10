import { ArrowDown, Check, Copy, Folder } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  commandFolderOf,
  commandLines,
  folderChunks,
  hasInvisible,
  SHOWN_CHARS,
  SHOWN_LINES,
  visibleText,
  type FolderLocation,
  type ToolCommand
} from '@shared/command-view'
import { safeCut } from '@shared/display-cap'
import { countText } from '@shared/i18n/format'
import { sizeText } from '../../acp-view'
import { useDisplayText } from '../../presentation'

/** Durée du « Copié ». */
const COPIED_MS = 1500

/**
 * Commande que l'agent lancera (0.11, M1, maquette validée) : brute, entière, sans coloration ni
 * nettoyage ; seuls les opérateurs d'enchaînement sont marqués quand le découpage est sûr. Les
 * caractères invisibles ou trompeurs (contrôles, `\r` seul, bidi, zéro-largeur…) sont rendus
 * visibles (␍, ⟨U+202E⟩…) et la barre le dit ; « Copier » copie le texte brut. Le dossier où elle
 * tourne, signalé s'il est hors de celui de la conversation ; le titre annoncé par l'agent s'il
 * annonce une autre commande. Au-delà de 12 lignes, le bloc défile (barre toujours visible,
 * ombre, ligne qui l'annonce). Une commande énorme n'est affichée qu'en partie, et la carte le dit.
 */
export function CommandBlock({
  command,
  workspace,
  locations,
  announced
}: {
  command: ToolCommand
  workspace: string | undefined
  /**
   * Emplacements de l'outil : un dossier relatif (`workdir: "docs"`, OpenCode) n'est résolu que
   * s'il est confirmé par l'un d'eux (fiche 203, `commandFolderOf`).
   */
  locations?: readonly FolderLocation[] | undefined
  /** Titre de l'outil, quand il annonce une autre commande que celle lancée. */
  announced?: string | undefined
}) {
  const { t } = useTranslation()
  const show = useDisplayText()
  const id = useId()
  // Dossier de la conversation ou sous-dossier, sans aucun doute : dit court (« projet/src ») ;
  // sinon le chemin entier (ou la valeur brute d'un relatif non confirmé), jamais coupé (fiche
  // 203, sécurité M1). Entier en infobulle et pour le lecteur d'écran dans tous les cas.
  const folder = commandFolderOf(command.cwd, workspace, locations)
  const cwd = folder?.full
  const outside = folder?.outside ?? false
  const short = folder?.short
  const fullCwd = cwd ? visibleText(show(cwd)) : undefined
  const invisible = hasInvisible(command.text)
  const total = command.total ?? command.text.length
  const cut =
    command.text.length > SHOWN_CHARS
      ? command.text.slice(0, safeCut(command.text, SHOWN_CHARS))
      : command.text
  const { lines: all } = useMemo(() => commandLines(cut, !command.argv), [cut, command.argv])
  const lines = all.length > SHOWN_LINES ? all.slice(0, SHOWN_LINES) : all
  const numbered = lines.length > 1
  const pre = useRef<HTMLPreElement>(null)
  const [scrolls, setScrolls] = useState(false)
  useLayoutEffect(() => {
    const el = pre.current
    if (!el) return
    const measure = () => setScrolls(el.scrollHeight > el.clientHeight + 2)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [cut])
  const partial =
    command.total !== undefined
      ? t('toolCall.command.keptPart', {
          size: sizeText(total),
          shown: sizeText(command.text.length)
        })
      : cut.length < command.text.length
        ? t('toolCall.command.shownPart', { size: sizeText(total), shown: sizeText(cut.length) })
        : lines.length < all.length
          ? t('toolCall.command.shownLines', {
              count: all.length,
              n: countText(all.length),
              shown: countText(lines.length)
            })
          : undefined
  // Lu par un lecteur d'écran : « Commande », le dossier, les mentions, puis le texte du bloc.
  const labelledBy = [
    `${id}-label`,
    cwd ? `${id}-cwd` : '',
    outside ? `${id}-outside` : '',
    invisible ? `${id}-invisible` : ''
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <div
      className={`cmd${scrolls ? ' scrolls' : ''}`}
      role="group"
      aria-labelledby={labelledBy}
      data-testid="command-block"
    >
      <span id={`${id}-label`} className="sr-only">
        {t('toolCall.command.label')}
      </span>
      <div className="cmd-bar">
        <span className="cmd-where">
          {fullCwd && (
            <span
              className="cmd-cwd"
              id={`${id}-cwd`}
              data-testid="command-cwd"
              title={short ? fullCwd : undefined}
            >
              <Folder size={13} aria-hidden />
              {short && <span className="sr-only">{`${t('toolCall.command.in')} ${fullCwd}`}</span>}
              <span aria-hidden={short ? true : undefined}>{t('toolCall.command.in')}</span>{' '}
              <code aria-hidden={short ? true : undefined} data-testid="command-cwd-text">
                {short ?? fullCwd}
              </code>
            </span>
          )}
          {outside && (
            <span className="cmd-warn" id={`${id}-outside`} data-testid="command-outside">
              {t('toolCall.command.outside')}
            </span>
          )}
          {invisible && (
            <span className="cmd-warn" id={`${id}-invisible`} data-testid="command-invisible">
              {t('toolCall.command.invisible')}
            </span>
          )}
        </span>
        <CopyCommand text={command.text} />
      </div>
      {announced && (
        <div className="cmd-announced" data-testid="command-announced">
          {t('toolCall.command.announced')} <code>{visibleText(announced)}</code>
        </div>
      )}
      {partial && (
        <div className="cmd-partial" data-testid="command-partial">
          {partial}
        </div>
      )}
      <pre
        ref={pre}
        className={`cmd-text${numbered ? ' numbered' : ''}`}
        data-testid="command-text"
        // Défilable au clavier quand la commande dépasse 12 lignes.
        tabIndex={scrolls ? 0 : undefined}
      >
        {lines.map((line, i) => (
          <span key={i} className="cmd-line">
            {numbered && (
              <span className="cmd-no" aria-hidden>
                {i + 1}
              </span>
            )}
            <span className="cmd-lt">
              {/* Ligne vide : rien (texte brut), sa hauteur vient du CSS. */}
              {line.map((part, j) =>
                part.op ? (
                  <b key={j} className="cmd-op">
                    {part.text}
                  </b>
                ) : part.invisible ? (
                  <span
                    key={j}
                    className={part.invisible === 'loud' ? 'cmd-invisible' : 'cmd-quiet'}
                  >
                    {part.text}
                  </span>
                ) : (
                  <FolderChips key={j} text={part.text} workspace={workspace} />
                )
              )}
            </span>
          </span>
        ))}
      </pre>
      {scrolls && (
        <div className="cmd-more" data-testid="command-more">
          <ArrowDown size={13} aria-hidden />
          {t('toolCall.command.scroll', { count: lines.length, n: countText(lines.length) })}
        </div>
      )}
    </div>
  )
}

/**
 * Texte d'une commande où le dossier de la conversation, écrit en toutes lettres, est montré par
 * une pastille portant son nom (fiche 214) : le chemin entier est en infobulle et dans le nom
 * accessible, « Copier » copie le texte exact de l'agent. Une pastille n'est pas du texte : on ne la
 * confond pas avec un mot `projet` écrit par l'agent.
 */
function FolderChips({ text, workspace }: { text: string; workspace: string | undefined }) {
  const { t } = useTranslation()
  const show = useDisplayText()
  const chunks = useMemo(() => folderChunks(text, workspace), [text, workspace])
  return (
    <>
      {chunks.map((chunk, i) => {
        if (typeof chunk === 'string') return chunk
        const path = visibleText(show(chunk.folder))
        return (
          <span
            key={i}
            className="cmd-chip"
            role="img"
            title={path}
            aria-label={t('toolCall.command.chipTitle', { path })}
            data-testid="command-chip"
          >
            <Folder size={12} aria-hidden />
            {chunk.name}
          </span>
        )
      })}
    </>
  )
}

/** « Copier » : la commande entière gardée, brute ; « Copié » dit pendant 1,5 s. */
function CopyCommand({ text }: { text: string }) {
  const { t } = useTranslation()
  const [state, setState] = useState<'idle' | 'done' | 'failed'>('idle')
  useEffect(() => {
    if (state === 'idle') return
    const timer = setTimeout(() => setState('idle'), COPIED_MS)
    return () => clearTimeout(timer)
  }, [state])
  return (
    <button
      type="button"
      className="cmd-copy"
      aria-live="polite"
      onClick={() =>
        navigator.clipboard.writeText(text).then(
          () => setState('done'),
          () => setState('failed')
        )
      }
      data-testid="command-copy"
    >
      {state === 'done' ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
      {state === 'done' ? t('copy.done') : state === 'failed' ? t('copy.failed') : t('copy.action')}
    </button>
  )
}
