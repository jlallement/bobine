/**
 * « Signaler un problème » (fiche 105) : l'issue GitHub préremplie, avec le gabarit `bug.yml`
 * (`.github/ISSUE_TEMPLATE/`), la version et le rapport de Réglages › Diagnostic. GitHub remplit
 * les champs du gabarit d'après les paramètres qui portent leur `id` (`version`, `report`), et
 * refuse une adresse au-delà de 8 192 octets : le rapport est coupé ligne à ligne pour tenir, et
 * dit alors de coller le reste depuis « Copier le rapport ».
 */
export const REPOSITORY_URL = 'https://github.com/jlallement/bobine'

/** Longueur d'adresse visée, sous la limite de GitHub avec de la marge. */
export const ISSUE_URL_LIMIT = 8_000

export interface IssueInput {
  version: string
  report: string
  /** Ligne ajoutée en fin de rapport quand il a fallu le couper. */
  truncatedNote: string
}

export function issueUrl(
  input: IssueInput,
  limit = ISSUE_URL_LIMIT
): { url: string; truncated: boolean } {
  const base = `${REPOSITORY_URL}/issues/new?template=bug.yml&version=${encodeURIComponent(input.version)}&report=`
  const whole = encodeURIComponent(input.report)
  if (base.length + whole.length <= limit) return { url: base + whole, truncated: false }

  const newline = encodeURIComponent('\n')
  const note = newline + encodeURIComponent(input.truncatedNote)
  let kept = ''
  for (const line of input.report.split('\n')) {
    const encoded = (kept ? newline : '') + encodeURIComponent(line)
    if (base.length + kept.length + encoded.length + note.length > limit) break
    kept += encoded
  }
  return { url: base + kept + note, truncated: true }
}
