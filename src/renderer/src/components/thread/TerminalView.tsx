import { ansiStyleAt, parseAnsi, type TerminalState } from '@shared/terminal-output'
import { useTranslation } from 'react-i18next'
import { CappedText } from './CappedText'

/** Couleurs ANSI d'un morceau de sortie, avec le style en vigueur à son début. */
function ansiChunk(text: string, start: number, whole: string) {
  return parseAnsi(text, start > 0 ? ansiStyleAt(whole, start) : {}).map((s, i) => (
    <span
      key={i}
      className={
        [s.color && `ansi-${s.color}`, s.bold && 'ansi-bold', s.dim && 'ansi-dim']
          .filter(Boolean)
          .join(' ') || undefined
      }
    >
      {s.text}
    </span>
  ))
}

/**
 * Sortie d'une commande, couleurs ANSI comprises, avec son code de sortie ; plafonnée à ses
 * dernières lignes (fiche 192).
 */
export function TerminalView({ terminal }: { terminal: TerminalState }) {
  const { t } = useTranslation()
  const failed = terminal.exited && (terminal.exitCode ?? 0) !== 0
  return (
    <div className="terminal" data-testid="terminal">
      {terminal.truncated && <div className="terminal-note">{t('terminalView.truncated')}</div>}
      {terminal.output === '' ? (
        <pre className="terminal-output">
          {!terminal.exited && (
            <span className="terminal-waiting">{t('terminalView.running')}</span>
          )}
        </pre>
      ) : (
        <CappedText text={terminal.output} className="terminal-output" renderChunk={ansiChunk} />
      )}
      {terminal.exited && (
        <div className={`terminal-exit${failed ? ' failed' : ''}`} data-testid="terminal-exit">
          {terminal.signal
            ? t('terminalView.interrupted', { signal: terminal.signal })
            : t('terminalView.exitCode', { code: terminal.exitCode ?? '?' })}
        </div>
      )}
    </div>
  )
}
