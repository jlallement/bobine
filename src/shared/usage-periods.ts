/**
 * Périodes de la page « Mon activité » (fiche 144) : jour, semaine (du lundi au dimanche), mois,
 * douze mois glissants, à l'heure locale. Partagées par le main (statistiques) et le renderer
 * (navigation, libellés) : un jour s'écrit `AAAA-MM-JJ`, et les bornes sont des minuits locaux
 * (changements d'heure compris).
 */

/** Périodes qu'on choisit ou qu'on affiche ; « all » (tout le journal) ne sert qu'à l'export. */
export const USAGE_SCOPES = ['day', 'week', 'month', 'year', 'all'] as const
export type UsageScope = (typeof USAGE_SCOPES)[number]
/** Périodes du sélecteur de la page (un jour s'ouvre depuis la grille). */
export const PAGE_SCOPES = ['week', 'month', 'year'] as const
export type PageScope = (typeof PAGE_SCOPES)[number]
/** Périodes navigables (flèches) et comparables. */
export type DatedScope = Exclude<UsageScope, 'all'>

const pad = (n: number) => String(n).padStart(2, '0')

/** `AAAA-MM-JJ` d'une date, à l'heure locale. */
export const dayKey = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

/** `AAAA-MM` d'une date, à l'heure locale. */
export const monthKey = (date: Date): string => `${date.getFullYear()}-${pad(date.getMonth() + 1)}`

export const isDayKey = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  dayKey(dateOfDay(value)) === value

/** Minuit local d'un jour `AAAA-MM-JJ`. */
export function dateOfDay(day: string): Date {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1)
}

/** Le jour décalé de `days` jours. */
export function addDays(day: string, days: number): string {
  const d = dateOfDay(day)
  return dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + days))
}

/** Lundi de la semaine du jour. */
export function mondayOf(day: string): string {
  return addDays(day, -((dateOfDay(day).getDay() + 6) % 7))
}

/** Bornes d'une période (minuits locaux) : début inclus, fin exclue. */
export function scopeRange(scope: DatedScope, day: string): { from: Date; to: Date } {
  const d = dateOfDay(day)
  const y = d.getFullYear()
  const m = d.getMonth()
  switch (scope) {
    case 'day':
      return { from: d, to: dateOfDay(addDays(day, 1)) }
    case 'week': {
      const monday = mondayOf(day)
      return { from: dateOfDay(monday), to: dateOfDay(addDays(monday, 7)) }
    }
    case 'month':
      return { from: new Date(y, m, 1), to: new Date(y, m + 1, 1) }
    case 'year':
      // Douze mois glissants, jusqu'au mois du jour compris.
      return { from: new Date(y, m - 11, 1), to: new Date(y, m + 1, 1) }
  }
}

/** Jour de la période d'à côté (`delta` : -1 la précédente, 1 la suivante). */
export function shiftDay(scope: DatedScope, day: string, delta: number): string {
  const d = dateOfDay(day)
  switch (scope) {
    case 'day':
      return addDays(day, delta)
    case 'week':
      return addDays(day, 7 * delta)
    case 'month':
      return dayKey(new Date(d.getFullYear(), d.getMonth() + delta, 1))
    case 'year':
      return dayKey(new Date(d.getFullYear(), d.getMonth() + 12 * delta, 1))
  }
}

/** La période contient-elle `now` ? */
export function isCurrent(scope: DatedScope, day: string, now: Date): boolean {
  const { from, to } = scopeRange(scope, day)
  return from.getTime() <= now.getTime() && now.getTime() < to.getTime()
}

/**
 * Période à laquelle on compare (fiche 144) : la précédente, coupée à date égale si la période
 * affichée est en cours (le 24 du mois se compare au 24 du mois d'avant, à la même heure).
 * L'année et un jour n'en ont pas (un jour se compare à la moyenne de son jour de la semaine).
 */
export function previousRange(
  scope: DatedScope,
  day: string,
  now: Date
): { from: Date; to: Date; sameDate: boolean } | undefined {
  if (scope !== 'week' && scope !== 'month') return undefined
  const current = scopeRange(scope, day)
  const previous = scopeRange(scope, shiftDay(scope, day, -1))
  if (!isCurrent(scope, day, now)) return { ...previous, sameDate: false }
  const elapsed = now.getTime() - current.from.getTime()
  const to = new Date(Math.min(previous.to.getTime(), previous.from.getTime() + elapsed))
  return { from: previous.from, to, sameDate: true }
}

/** Jours de comparaison d'un jour : le même jour de la semaine, les douze semaines d'avant. */
export const WEEKDAY_WEEKS = 12
export function sameWeekdays(day: string): string[] {
  return Array.from({ length: WEEKDAY_WEEKS }, (_, i) => addDays(day, -7 * (i + 1)))
}

/** Jours `AAAA-MM-JJ` de `from` (inclus) à `to` (exclu). */
export function daysOf(from: Date, to: Date): string[] {
  const days: string[] = []
  const last = dayKey(new Date(to.getTime() - 1))
  for (let day = dayKey(from); days.length < 3700; day = addDays(day, 1)) {
    days.push(day)
    if (day >= last) break
  }
  return days
}

/**
 * Étendue de la grille d'activité : les douze derniers mois (du lendemain du même jour l'an
 * dernier à aujourd'hui), ou une année civile passée.
 */
export type HeatRange = 'last12' | number

export function heatDays(range: HeatRange, now: Date): string[] {
  const today = dayKey(now)
  if (range === 'last12') {
    const start = addDays(dayKey(new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())), 1)
    return daysOf(dateOfDay(start), dateOfDay(addDays(today, 1)))
  }
  return daysOf(new Date(range, 0, 1), new Date(range + 1, 0, 1))
}
