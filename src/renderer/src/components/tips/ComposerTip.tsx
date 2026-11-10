import { CalendarClock } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { ASIDE_TIP_DELAY_MS, CONTEXT_TIP_RATIO } from '@shared/tips'
import { contextRatio, type ConversationUsage } from '@shared/usage'
import { useTipsContext } from '../../useTips'
import { TipTab } from './TipTab'

/**
 * Astuces de la saisie (fiche 191), sur son bord haut :
 * - aparté : on tape (texte non vide depuis 2 s) pendant que l'agent travaille ; « Essayer »
 *   pose le texte tapé en aparté ;
 * - contexte presque plein (au-delà de 85 %), une fois par conversation.
 */
export function ComposerTip({
  busy,
  hasText,
  usage,
  onTryAside
}: {
  busy: boolean
  hasText: boolean
  usage: ConversationUsage | undefined
  onTryAside: () => void
}) {
  const { t } = useTranslation()
  const tips = useTipsContext()
  const offer = tips?.offer
  const ratio = usage ? contextRatio(usage) : undefined
  const contextOffered = useRef(false)

  useEffect(() => {
    if (!offer || !busy || !hasText) return
    const timer = setTimeout(() => offer('aside'), ASIDE_TIP_DELAY_MS)
    return () => clearTimeout(timer)
  }, [offer, busy, hasText])

  useEffect(() => {
    if (!offer || contextOffered.current || ratio === undefined || ratio < CONTEXT_TIP_RATIO) return
    contextOffered.current = true
    offer('context')
  }, [offer, ratio])

  // Texte envoyé ou effacé : l'astuce de l'aparté n'a plus d'objet.
  const close = tips?.close
  const showingAside = tips?.current === 'aside'
  useEffect(() => {
    if (showingAside && !hasText) close?.()
  }, [showingAside, hasText, close])

  if (!tips) return null
  if (tips.current === 'aside') {
    return (
      <TipTab
        id="aside"
        help="aside"
        actions={[
          {
            label: t('tips.aside.try'),
            run: () => {
              tips.used('aside')
              onTryAside()
            },
            testId: 'tip-try'
          }
        ]}
        onNever={() => tips.never('aside')}
        onClose={tips.close}
      >
        <Trans i18nKey="tips.aside.text" components={{ kbd: <kbd /> }} />
      </TipTab>
    )
  }
  if (tips.current === 'scheduled' && tips.planRepeated) {
    return (
      <TipTab
        id="scheduled"
        icon={CalendarClock}
        actions={[{ label: t('tips.scheduled.plan'), run: tips.planRepeated, testId: 'tip-plan' }]}
        onNever={() => tips.never('scheduled')}
        onClose={tips.close}
      >
        {t('tips.scheduled.text')}
      </TipTab>
    )
  }
  if (tips.current === 'context' && ratio !== undefined) {
    return (
      <TipTab
        id="context"
        help="compact"
        onNever={() => tips.never('context')}
        onClose={tips.close}
      >
        {t('tips.context.text', { percent: Math.round(ratio * 100) })}
      </TipTab>
    )
  }
  return null
}
