/**
 * Diagnostic (fiche 061) : ce dont l'app dépend, vérifié d'un coup, avec la marche à suivre quand
 * ça ne va pas. Rien n'est demandé à un modèle.
 */
import { t } from 'i18next'

/** `optional` : absent mais facultatif (simulateur iOS sans Xcode…) ; `pending` : en cours. */
export type CheckLevel = 'ok' | 'warning' | 'error' | 'optional' | 'pending'

/** Action proposée par une ligne, faite par l'app à la demande de l'utilisateur. */
export type DiagnosticAction =
  /** Relire le PATH du shell de connexion. */
  | 'reload-shell-env'
  /** Ouvrir une session d'essai chez un agent qui ne saura pas la supprimer. */
  | 'try-session'
  | 'open-agents-settings'
  | 'open-mcp-settings'

export interface DiagnosticCheck {
  id: string
  label: string
  level: CheckLevel
  /** Ce qui a été trouvé. */
  detail: string
  /** Marche à suivre quand ça ne va pas. */
  fix?: string
  /** Commande à taper dans un terminal, affichée telle quelle. */
  command?: string
  action?: DiagnosticAction
}

export interface DiagnosticGroup {
  /** `app`, `environment`, `agent:<profil>`, `mcp`, `ios`, `android`. */
  id: string
  title: string
  checks: DiagnosticCheck[]
}

const MARKS: Record<CheckLevel, string> = {
  ok: '✓',
  warning: '!',
  error: '✗',
  optional: '–',
  pending: '…'
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Rapport en texte (« Copier le rapport ») : une ligne par vérification, la marche à suivre dessous. */
export function diagnosticReport(groups: readonly DiagnosticGroup[], at: Date): string {
  const date = `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())} ${pad(at.getHours())}:${pad(at.getMinutes())}`
  const lines = [t('diagnostics.report.title', { date }), diagnosticSummary(groups)]
  for (const group of groups) {
    lines.push('', group.title)
    for (const check of group.checks) {
      lines.push(
        `  ${MARKS[check.level]} ${t('diagnostics.report.check', { label: check.label, detail: check.detail })}`
      )
      if (check.fix) lines.push(`    → ${check.fix}`)
      if (check.command) lines.push(`    $ ${check.command}`)
    }
  }
  return `${lines.join('\n')}\n`
}

/** « Tout va bien », ou le compte de ce qui ne va pas. */
export function diagnosticSummary(groups: readonly DiagnosticGroup[]): string {
  const checks = groups.flatMap((g) => g.checks)
  const count = (level: CheckLevel) => checks.filter((c) => c.level === level).length
  const errors = count('error')
  const warnings = count('warning')
  const pending = count('pending')
  const parts = [
    errors ? t('diagnostics.summary.errors', { count: errors }) : '',
    warnings ? t('diagnostics.summary.warnings', { count: warnings }) : '',
    pending ? t('diagnostics.summary.pending', { count: pending }) : ''
  ].filter(Boolean)
  return parts.length ? parts.join(', ') : t('diagnostics.summary.ok')
}

/** Pire niveau d'un groupe, pour sa pastille. */
export function groupLevel(group: DiagnosticGroup): CheckLevel {
  const order: CheckLevel[] = ['error', 'warning', 'pending', 'ok', 'optional']
  return order.find((level) => group.checks.some((c) => c.level === level)) ?? 'optional'
}
