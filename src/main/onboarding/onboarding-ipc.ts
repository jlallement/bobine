/**
 * Canaux IPC de l'accueil du premier lancement (fiche 188). Les arguments viennent du renderer :
 * vérifiés ici.
 */
import { t } from 'i18next'
import type { IpcHandlers } from '@shared/ipc'
import type { CheckRequest } from '@shared/onboarding'
import type { Onboarding } from './onboarding'

export type OnboardingIpc = Pick<
  Onboarding,
  'state' | 'check' | 'cancel' | 'finish' | 'runStep' | 'trialFolder' | 'hints'
>

type OnboardingChannel = Extract<keyof IpcHandlers, `onboarding:${string}`>

export function onboardingHandlers(
  onboarding: OnboardingIpc | undefined
): Pick<IpcHandlers, OnboardingChannel> {
  const available = () => {
    if (!onboarding) throw new Error(t('ipc.unavailable.onboarding'))
    return onboarding
  }
  const text = (value: unknown, name: string): string => {
    if (typeof value !== 'string' || !value) throw new Error(`Paramètre invalide : ${name}`)
    return value
  }
  return {
    'onboarding:state': () => available().state(),
    'onboarding:check': (request) => {
      const r = (typeof request === 'object' && request !== null ? request : {}) as Partial<
        Record<keyof CheckRequest, unknown>
      >
      if (r.level !== 'connect' && r.level !== 'reply')
        throw new Error('Paramètre invalide : level')
      const authenticate =
        r.authenticate === undefined ? undefined : text(r.authenticate, 'authenticate')
      return available().check({
        conversationId: text(r.conversationId, 'conversationId'),
        profileId: text(r.profileId, 'profileId'),
        level: r.level,
        ...(authenticate ? { authenticate } : {})
      })
    },
    'onboarding:cancel': () => {
      available().cancel()
      return undefined
    },
    'onboarding:finish': (outcome) => {
      if (outcome !== 'finished' && outcome !== 'skipped') {
        throw new Error('Paramètre invalide : outcome')
      }
      available().finish(outcome)
      return undefined
    },
    // Le renderer désigne une étape du profil, jamais une commande.
    'onboarding:runStep': (id, profileId, stepId) =>
      available().runStep(text(id, 'id'), text(profileId, 'profileId'), text(stepId, 'stepId')),
    'onboarding:trialFolder': () => available().trialFolder(t('onboarding.trialFolderName')),
    'onboarding:hints': (id) => available().hints(text(id, 'id'))
  }
}
