import i18next from 'i18next'
import { currentLocale } from '@shared/i18n/format'
import { durationParts } from '@shared/turn-duration'

/** Heure d'un message : « 14:32 » aujourd'hui, « 12 oct., 14:32 » avant, l'année si elle diffère. */
export function messageTime(at: number, now = new Date()): string {
  const date = new Date(at)
  const time = date.toLocaleTimeString(currentLocale(), { hour: '2-digit', minute: '2-digit' })
  if (date.toDateString() === now.toDateString()) return time
  const day = date.toLocaleDateString(currentLocale(), {
    day: 'numeric',
    month: 'short',
    ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {})
  })
  return `${day}, ${time}`
}

/** Date et heure complètes, pour l'infobulle. */
export function fullTime(at: number): string {
  return new Date(at).toLocaleString(currentLocale(), { dateStyle: 'full', timeStyle: 'short' })
}

/**
 * Jour d'une conversation dans la barre latérale (fiche 131) : rien aujourd'hui (la liste est
 * triée par activité), « hier », le jour de la semaine dans les six jours, sinon « 12 oct. »
 * (l'année si elle diffère).
 */
export function rowDay(at: string | number, yesterday: string, now = new Date()): string {
  const date = new Date(at)
  if (Number.isNaN(date.getTime())) return ''
  const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((midnight(now) - midnight(date)) / 86_400_000)
  if (days <= 0) return ''
  if (days === 1) return yesterday
  if (days < 7) return date.toLocaleDateString(currentLocale(), { weekday: 'short' })
  return date.toLocaleDateString(currentLocale(), {
    day: 'numeric',
    month: 'short',
    ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {})
  })
}

/** Durée d'un tour (fiche 156) : « 8 s », « 2 min 14 s », « 1 h 05 min ». */
export function turnDuration(ms: number): string {
  const { hours, minutes, seconds } = durationParts(ms)
  if (hours > 0) {
    return i18next.t('transcript.duration.hours', {
      hours,
      minutes: String(minutes).padStart(2, '0')
    })
  }
  if (minutes > 0) return i18next.t('transcript.duration.minutes', { minutes, seconds })
  return i18next.t('transcript.duration.seconds', { seconds })
}
