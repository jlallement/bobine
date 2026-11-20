import { Hand, TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AgentSnapshot, SessionControl } from '@shared/agent'
import { ipcErrorText } from '../../ipc-errors'
import { ModelPickButton } from '../common/ModelMenu'

/** Le modèle refusé au tour d'un travail (fiches 259, 267) et le réglage de modèle de ce travail. */
interface Refused {
  model: { name: string; quota?: true }
  control: SessionControl | undefined
}

/** Le refus de modèle d'un instantané, s'il y en a un (carte « Modèle refusé » au tour). */
function refusedOf(snapshot: AgentSnapshot | null | undefined): Refused | undefined {
  const blocker = snapshot?.status === 'needs-action' ? snapshot.blocker : undefined
  if (blocker?.kind !== 'auth' || !blocker.atTurn || !blocker.model) return undefined
  const control = snapshot?.controls.find(
    (c) =>
      c.category === 'model' &&
      c.type === 'select' &&
      c.options.some((o) => o.value !== c.currentValue)
  )
  return {
    model: { name: blocker.model.name, ...(blocker.model.quota ? { quota: true as const } : {}) },
    control
  }
}

/**
 * Le travail attend parce que son modèle est refusé (recette N3/N8, fiche 267 : quota gratuit
 * épuisé dans la carte d'un travail) : lu dans l'instantané de sa conversation, puis suivi par ses
 * évènements, seulement tant que la carte dit « attend ».
 */
export function useWorkRefusedModel(childId: string | undefined): Refused | undefined {
  const [state, setState] = useState<{ id: string | undefined; refused: Refused | undefined }>({
    id: childId,
    refused: undefined
  })
  useEffect(() => {
    if (!childId) return
    let alive = true
    // Un statut reçu pendant la lecture fait foi : la réponse, plus ancienne, est jetée (revue QA).
    let fresher = false
    const set = (snapshot: AgentSnapshot | null | undefined) =>
      alive && setState({ id: childId, refused: refusedOf(snapshot) })
    const off = window.api.agent.onEvent(({ conversationId, event }) => {
      if (conversationId !== childId || event.type !== 'status') return
      fresher = true
      set(event.snapshot)
    })
    // L'état de son agent seulement, pas tout son fil (revue QA).
    window.api.roles
      ?.workState?.(childId)
      .then((snapshot) => !fresher && set(snapshot))
      .catch(() => !fresher && set(undefined))
    return () => {
      alive = false
      off()
    }
  }, [childId])
  return state.id === childId ? state.refused : undefined
}

/**
 * « Attend votre réponse » d'un travail ; si c'est son modèle qui est refusé, la raison et
 * « Choisir un autre modèle » **du travail**, depuis sa carte : le message refusé repart avec le
 * nouveau modèle, dans sa conversation (fiche 210), sans avoir à l'ouvrir.
 */
export function WorkWaiting({ childId }: { childId: string | undefined }) {
  const { t } = useTranslation()
  const refused = useWorkRefusedModel(childId)
  // Le changement de modèle refusé par l'app (agent arrêté…) : dit dans la carte (revue UX).
  const [failed, setFailed] = useState<string | undefined>(undefined)
  if (!refused || !childId) {
    return (
      <div className="work-live" data-testid="work-live">
        <Hand size={13} aria-hidden />
        {t('workCard.waitingLine')}
      </div>
    )
  }
  const { model, control } = refused
  return (
    <div className="work-live work-refused" data-testid="work-live" data-refused="">
      <TriangleAlert size={13} aria-hidden />
      <span className="grow" data-testid="work-refused-text">
        {t(model.quota ? 'workCard.modelQuota' : 'workCard.modelRefused', { model: model.name })}
        {control && <span className="work-refused-hint">{t('workCard.modelRetry')}</span>}
      </span>
      {control && (
        <ModelPickButton
          control={control}
          className="btn small primary"
          testId="work-choose-model"
          onPick={(value) => {
            setFailed(undefined)
            window.api.agent
              .setControl(childId, control.id, value)
              .catch((error: unknown) => setFailed(ipcErrorText(error)))
          }}
        >
          {t('blocker.auth.chooseModel')}
        </ModelPickButton>
      )}
      {failed && (
        <span className="work-refused-error" role="alert" data-testid="work-refused-error">
          {t('workCard.modelChangeFailed', { error: failed })}
        </span>
      )}
    </div>
  )
}
