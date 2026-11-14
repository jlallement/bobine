/**
 * Brouillon d'un rôle (fiche 223, phase 3A) : ce que l'assistant de création et l'écran
 * d'édition remplissent avant `roles:save`. Rien ici ne parle au main : validation par étape
 * (messages des clés `roles.error.*` de la phase 2), nom tiré du libellé, icône et couleur
 * suggérées d'après le libellé. La vérification qui fait foi reste `checkRole` (même module que
 * le main) au moment d'enregistrer.
 */
import type { AccentColor } from '@shared/preferences'
import {
  checkRole,
  ROLE_LIMITS,
  ROLE_NAME,
  type Role,
  type RoleDefinition,
  type RoleError,
  type RoleFileScope
} from '@shared/roles'

export interface RoleDraft {
  /** Nom affiché (« Expert sécu »). */
  label: string
  /** Identifiant tapé après `@` ; suit le libellé tant que `nameEdited` est faux. */
  name: string
  nameEdited: boolean
  icon: string
  color: AccentColor
  /** Icône ou couleur choisies à la main : elles ne suivent plus le libellé. */
  appearanceChosen: boolean
  description: string
  prompt: string
  /** Profil de l'agent ; vide : celui de la conversation. */
  agent: string
  mode: string
  model: string
  readOnly: boolean
  /** Familles d'outils de Bobine ; `null` : toutes. */
  mcp: string[] | null
  scope: RoleFileScope
  /** Modèle fourni dont la consigne est partie (tuiles de l'étape 2). */
  template?: string
}

/** Étapes de l'assistant : Qui, Comment, Avec quoi (maquettes A1 à A3). */
export const WIZARD_STEPS = ['who', 'how', 'with'] as const
export type WizardStep = (typeof WIZARD_STEPS)[number]

/** Champs du formulaire, pour placer une erreur sous le bon. */
export type DraftField =
  | 'label'
  | 'name'
  | 'icon'
  | 'color'
  | 'description'
  | 'prompt'
  | 'agent'
  | 'mode'
  | 'model'
  | 'mcp'

export type DraftErrors = Partial<Record<DraftField, RoleError>>

const STEP_OF: Record<DraftField, WizardStep> = {
  label: 'who',
  name: 'who',
  icon: 'who',
  color: 'who',
  description: 'who',
  prompt: 'how',
  agent: 'with',
  mode: 'with',
  model: 'with',
  mcp: 'with'
}

export function emptyDraft(prefill: Partial<RoleDraft> = {}): RoleDraft {
  const draft: RoleDraft = {
    label: '',
    name: '',
    nameEdited: false,
    icon: 'bot',
    color: 'graphite',
    appearanceChosen: false,
    description: '',
    prompt: '',
    agent: '',
    mode: '',
    model: '',
    readOnly: false,
    mcp: null,
    scope: 'user',
    ...prefill
  }
  // Prérempli d'un libellé sans nom (« Enregistrer comme rôle ») : le nom en est tiré.
  if (!draft.name && draft.label) draft.name = slugifyRoleName(draft.label)
  if (prefill.name) draft.nameEdited = true
  if (prefill.icon || prefill.color) draft.appearanceChosen = true
  else if (draft.label) Object.assign(draft, suggestAppearance(draft.label))
  return draft
}

/** Brouillon d'un rôle existant (écran d'édition). */
export function draftFromRole(role: Role): RoleDraft {
  return {
    label: role.label,
    name: role.name,
    nameEdited: true,
    icon: role.icon,
    color: role.color,
    appearanceChosen: true,
    description: role.description,
    prompt: role.prompt,
    agent: role.agent ?? '',
    mode: role.mode ?? '',
    model: role.model ?? '',
    readOnly: role.readOnly,
    mcp: role.mcp ? [...role.mcp] : null,
    scope: role.scope === 'project' ? 'project' : 'user'
  }
}

/** Identifiant tiré d'un libellé : « Expert sécu » → `expert-secu` (`ROLE_NAME`). */
export function slugifyRoleName(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .slice(0, 40)
    .replace(/-+$/, '')
}

/** Mots du libellé qui appellent une icône et une couleur (« sécu » → bouclier, orange). */
const SUGGESTIONS: readonly [RegExp, string, AccentColor][] = [
  [/s[eé]cu|secur|audit|vuln/i, 'shield-check', 'orange'],
  [/review|relect|relir|critique/i, 'scan-search', 'blue'],
  [/\bux\b|\bui\b|design|[eé]cran|interface/i, 'palette', 'pink'],
  [/flutter|mobile|ios|android/i, 'smartphone', 'blue'],
  [/front/i, 'layout-dashboard', 'violet'],
  [/back|api|serveur|server/i, 'server', 'green'],
  [/lead|chef|archi|plan/i, 'compass', 'violet'],
  [/test|qa\b|qualit/i, 'flask-conical', 'green'],
  [/doc|r[eé]dac|writer|[eé]crivain/i, 'book-open', 'graphite'],
  [/bug|debug|d[eé]bog/i, 'bug', 'orange'],
  [/perf/i, 'gauge', 'orange'],
  [/donn[eé]e|data|sql|base/i, 'database', 'blue']
]

export function suggestAppearance(label: string): { icon: string; color: AccentColor } {
  const found = SUGGESTIONS.find(([pattern]) => pattern.test(label))
  return found ? { icon: found[1], color: found[2] } : { icon: 'bot', color: 'graphite' }
}

/**
 * Libellé changé : le nom le suit tant qu'il n'a pas été écrit à la main, l'icône et la couleur
 * aussi tant qu'elles n'ont pas été choisies.
 */
export function withLabel(draft: RoleDraft, label: string): RoleDraft {
  return {
    ...draft,
    label,
    ...(draft.nameEdited ? {} : { name: slugifyRoleName(label) }),
    ...(draft.appearanceChosen ? {} : suggestAppearance(label))
  }
}

/** Champs donnés à `checkRole` et à `roles:save`. */
export function draftFields(draft: RoleDraft): Parameters<typeof checkRole>[0] {
  return {
    name: draft.name.trim(),
    label: draft.label.trim(),
    icon: draft.icon,
    color: draft.color,
    description: draft.description.trim(),
    ...(draft.agent.trim() ? { agent: draft.agent.trim() } : {}),
    ...(draft.mode.trim() ? { mode: draft.mode.trim() } : {}),
    ...(draft.model.trim() ? { model: draft.model.trim() } : {}),
    readOnly: draft.readOnly,
    ...(draft.mcp ? { mcp: draft.mcp } : {}),
    prompt: draft.prompt
  }
}

/** Définition prête à enregistrer, ou l'erreur que `checkRole` y trouve. */
export function draftDefinition(
  draft: RoleDraft
): { ok: true; role: RoleDefinition } | { ok: false; error: RoleError } {
  return checkRole(draftFields(draft))
}

const oneLine = (text: string) => !/[\r\n]/.test(text)

/** Erreurs des champs d'une étape, toutes à la fois (une par champ). */
function stepFieldErrors(draft: RoleDraft, step: WizardStep): DraftErrors {
  const errors: DraftErrors = {}
  if (step === 'who') {
    const label = draft.label.trim()
    if (!label || label.length > ROLE_LIMITS.label || !oneLine(label)) {
      errors.label = { code: 'label', field: 'label' }
    }
    if (!ROLE_NAME.test(draft.name.trim())) errors.name = { code: 'name', field: 'name' }
    const description = draft.description.trim()
    if (!description || description.length > ROLE_LIMITS.description || !oneLine(description)) {
      errors.description = { code: 'description', field: 'description' }
    }
  }
  if (step === 'how') {
    const prompt = draft.prompt.trim()
    if (!prompt || prompt.length > ROLE_LIMITS.prompt) errors.prompt = { code: 'prompt' }
  }
  if (step === 'with') {
    for (const key of ['agent', 'mode', 'model'] as const) {
      const value = draft[key].trim()
      if (value.length > ROLE_LIMITS.value || !oneLine(draft[key])) {
        errors[key] = { code: 'value', field: key }
      }
    }
  }
  return errors
}

/** Erreurs d'une étape, ou de tout le formulaire (`'all'`, écran d'édition). */
export function draftErrors(draft: RoleDraft, step: WizardStep | 'all'): DraftErrors {
  const steps = step === 'all' ? WIZARD_STEPS : [step]
  const errors = Object.assign({}, ...steps.map((s) => stepFieldErrors(draft, s))) as DraftErrors
  if (step !== 'all' || Object.keys(errors).length > 0) return errors
  // Dernier mot à `checkRole`, celui du main : ce qu'il refuserait, placé sous son champ.
  const checked = draftDefinition(draft)
  return checked.ok ? {} : { [errorField(checked.error)]: checked.error }
}

/** Champ d'une erreur de `checkRole` ou du main (`duplicateName` : le nom). */
export function errorField(error: RoleError): DraftField {
  const field = error.field === 'read-only' ? undefined : error.field
  if (field && field in STEP_OF) return field as DraftField
  if (error.code === 'prompt') return 'prompt'
  if (error.code === 'mcp') return 'mcp'
  return 'name'
}

/** Étape où vit le champ d'une erreur (le main refuse : l'assistant y retourne). */
export const stepOfField = (field: DraftField): WizardStep => STEP_OF[field]

/** Le brouillon a-t-il quelque chose de saisi (Échap demande alors avant de fermer) ? */
export function draftTouched(draft: RoleDraft, initial: RoleDraft): boolean {
  return (
    draft.label !== initial.label ||
    draft.description !== initial.description ||
    draft.prompt !== initial.prompt
  )
}

/** Fichier où le rôle sera écrit, relatif à sa portée. */
export function roleFileHint(draft: Pick<RoleDraft, 'name' | 'scope'>): string {
  const file = `${draft.name.trim() || 'role'}.md`
  return draft.scope === 'project' ? `.bobine/roles/${file}` : file
}
