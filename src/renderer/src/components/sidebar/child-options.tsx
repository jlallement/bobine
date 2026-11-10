import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ConversationSummary, ProfileSummary, SessionControl } from '@shared/agent'

/**
 * Agent et modèle d'une conversation fille (fiches 097 et 112), partagés par le dialogue « Lancer
 * en parallèle… » et la carte « Tâches proposées » : ceux de la mère par défaut ; le modèle n'est
 * proposé que pour l'agent de la mère, le seul dont on connaît les options ; un autre agent prend
 * son dernier modèle choisi.
 */
export interface ChildChoice {
  profileId: string
  /** Valeur du réglage « modèle » ; `null` : celui de la mère. */
  modelValue: string | null
}

/**
 * Le profil de l'agent de la mère permet-il de choisir le modèle d'une fille (`childModel`,
 * fiche 160) ? Sinon, ni modèle proposé, ni présélectionné : l'agent prend le sien.
 */
export function childModelAllowed(
  profiles: readonly Pick<ProfileSummary, 'id' | 'childModel'>[],
  mother: Pick<ConversationSummary, 'profileId'>
): boolean {
  return !!profiles.find((p) => p.id === mother.profileId)?.childModel
}

/**
 * Le réglage « modèle » de la mère, si son agent tourne (sinon, celui que prendra l'agent) ; `null`
 * si son profil ne permet pas de choisir le modèle d'une fille (`allowed`).
 */
export function useMotherModel(motherId: string, allowed = true): SessionControl | null {
  const [model, setModel] = useState<SessionControl | null>(null)
  useEffect(() => {
    if (!motherId || !allowed) return undefined
    let alive = true
    window.api.conversations
      .view(motherId)
      .then((view) => {
        const control = view.snapshot?.controls.find(
          (c) => c.category === 'model' && c.type === 'select'
        )
        if (alive && control) setModel(control)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [motherId, allowed])
  return allowed ? model : null
}

/** Ce qui part au main : l'agent s'il diffère de la mère, le modèle s'il est choisi pour son agent. */
export function childChoiceRequest(
  mother: Pick<ConversationSummary, 'profileId'>,
  model: SessionControl | null,
  choice: ChildChoice
): { profileId?: string; model?: { controlId: string; value: string } } {
  const sameAgent = choice.profileId === mother.profileId
  const value = choice.modelValue ?? (model ? String(model.currentValue) : null)
  return {
    ...(sameAgent ? {} : { profileId: choice.profileId }),
    ...(sameAgent && model && value ? { model: { controlId: model.id, value } } : {})
  }
}

/** Les deux sélecteurs, agent puis modèle. `testId` préfixe les `data-testid` (`child`, `proposal`). */
export function ChildOptions({
  mother,
  profiles,
  model,
  choice,
  onChange,
  testId
}: {
  mother: Pick<ConversationSummary, 'profileId'>
  profiles: ProfileSummary[]
  model: SessionControl | null
  choice: ChildChoice
  onChange: (choice: ChildChoice) => void
  testId: string
}) {
  const { t } = useTranslation()
  const agents = profiles.filter((p) => p.available || p.id === mother.profileId)
  const sameAgent = choice.profileId === mother.profileId
  const modelValue = choice.modelValue ?? (model ? String(model.currentValue) : null)
  return (
    <div className="child-dialog-row">
      <label className="form-field">
        <span className="field-label">{t('children.dialog.agent')}</span>
        <select
          className="field-input"
          value={choice.profileId}
          onChange={(e) => onChange({ ...choice, profileId: e.target.value })}
          data-testid={`${testId}-agent`}
        >
          {agents.map((p) => (
            <option key={p.id} value={p.id} disabled={!p.available}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <label className="form-field">
        <span className="field-label">{t('children.dialog.model')}</span>
        {sameAgent && model && modelValue !== null ? (
          <select
            className="field-input"
            value={modelValue}
            onChange={(e) => onChange({ ...choice, modelValue: e.target.value })}
            data-testid={`${testId}-model`}
          >
            {model.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.group ? `${o.group} · ${o.name}` : o.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="field-help child-dialog-model">
            {t(
              sameAgent && !childModelAllowed(profiles, mother)
                ? 'children.dialog.modelAgent'
                : 'children.dialog.modelOther'
            )}
          </span>
        )}
      </label>
    </div>
  )
}
