import { useTranslation } from 'react-i18next'
import { fullTime, messageTime, turnDuration } from '../../time'

/** Heure d'un message (date complète dans l'infobulle). */
export function MessageTime({ at }: { at: number }) {
  return (
    <time className="msg-time" dateTime={new Date(at).toISOString()} title={fullTime(at)}>
      {messageTime(at)}
    </time>
  )
}

/**
 * Durée du tour, à côté de l'heure de sa dernière réponse (fiche 156) ; sous la seconde, « < 1 s »,
 * comme les sous-agents (fiche 261).
 */
export function MessageDuration({ ms }: { ms: number }) {
  const { t } = useTranslation()
  const text = turnDuration(ms)
  return (
    <span
      className="msg-duration"
      title={t('transcript.duration.title', { duration: text })}
      data-testid="turn-duration"
    >
      {text}
    </span>
  )
}
