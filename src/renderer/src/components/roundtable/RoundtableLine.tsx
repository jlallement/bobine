/**
 * Ligne du tour de table dans la saisie (fiche 285, maquettes `lancement-2-pret`, `premier-usage`,
 * `surcout`, `fenetre-etroite`) : sous la question, au-dessus de la barre, sur une seule ligne.
 *
 *   ⁘ 3 participants ▾  + synthèse · ≈ 4 fois les jetons d'une question simple            ✕
 *
 * « N participants ▾ » ouvre le menu à cases ; son infobulle dit qui reçoit quoi et chez qui. Le
 * surcoût a une forme courte en saisie étroite (`roundtable.css`, requête de conteneur), qui garde
 * toujours le mot « jetons » et n'est jamais coupée. Sans participants, « Choisir les participants
 * ▾ · 2 à 5 modèles » ; places manquantes, participant indisponible, refus du main : dits à la place
 * du surcoût.
 */
import * as Popover from '@radix-ui/react-popover'
import * as Tooltip from '@radix-ui/react-tooltip'
import { ChevronDown, X } from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { focusWithoutIntent } from '../common/Menus'
import { requestSettings } from '../../open-settings'
import { RoundtableIcon } from './RoundtableIcon'
import '../../roundtable.css'
import { RoundtableParticipants } from './RoundtableParticipants'
import { listText, participantGroups, sendsKey } from './roundtable-view'
import type { RoundtableCompose } from './useRoundtableCompose'

/** Étiquette « Tour de table » en tête de la question (maquette `lancement-2-pret`). */
export function RoundtableTag() {
  const { t } = useTranslation()
  return (
    <span className="roundtable-tag" data-testid="roundtable-tag">
      <RoundtableIcon size={14} />
      <span>{t('roundtable.command.tag')}</span>
    </span>
  )
}

/** L'étiquette en tête de la saisie, sur sa ligne (comme les jetons de rôle). */
export function RoundtableComposerTag() {
  return (
    <div className="role-tokens">
      <RoundtableTag />
    </div>
  )
}

/** Infobulle de « N participants » : la destination de chacun, puis ce qui part avec la question. */
function ParticipantsTip({
  roundtable,
  files,
  children
}: {
  roundtable: RoundtableCompose
  files: boolean
  children: ReactNode
}) {
  const { t } = useTranslation()
  const groups = participantGroups(roundtable.choices, roundtable.options)
  const trigger = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  // Comme `Tip` : pas d'infobulle sur un focus rendu par le menu qui se ferme (fiche 185, F7).
  const onOpenChange = (next: boolean) => {
    const element = trigger.current
    if (next && element && focusWithoutIntent(element)) return
    setOpen(next)
  }
  return (
    <Tooltip.Root
      delayDuration={400}
      disableHoverableContent
      open={open && !roundtable.menuOpen}
      onOpenChange={onOpenChange}
    >
      <Tooltip.Trigger asChild ref={trigger}>
        {children}
      </Tooltip.Trigger>
      {groups.length > 0 && (
        <Tooltip.Portal>
          <Tooltip.Content
            className="tooltip roundtable-tip"
            sideOffset={6}
            data-testid="roundtable-tip"
          >
            {groups.map((g) => (
              <span key={g.agent} className="roundtable-tip-line">
                {g.destinations.length > 0
                  ? t('roundtable.line.byTo', {
                      models: listText(g.models),
                      agent: g.agent,
                      destination: listText(g.destinations)
                    })
                  : t('roundtable.line.by', { models: listText(g.models), agent: g.agent })}
              </span>
            ))}
            <span className="roundtable-tip-sends">
              {t(sendsKey(files, roundtable.options?.lastExchange === true))}
            </span>
          </Tooltip.Content>
        </Tooltip.Portal>
      )}
    </Tooltip.Root>
  )
}

/** Ce que la ligne dit après le bouton des participants : le surcoût, ou ce qui empêche l'envoi. */
function LineStatus({ roundtable }: { roundtable: RoundtableCompose }) {
  const { t } = useTranslation()
  const { state, refusal } = roundtable
  if (refusal) {
    return (
      <span className="roundtable-line-alert" role="alert" data-testid="roundtable-refusal">
        {refusal}
      </span>
    )
  }
  switch (state.kind) {
    case 'choose':
      return <span className="roundtable-line-cost">{t('roundtable.line.chooseHint')}</span>
    case 'unavailable':
      return (
        <span className="roundtable-line-alert" role="status" data-testid="roundtable-unavailable">
          {t('roundtable.line.unavailable', { agent: state.agent })}
        </span>
      )
    case 'refused':
      return (
        <span className="roundtable-line-alert" role="status" data-testid="roundtable-refused">
          {t(`roundtable.error.${state.refused}`)}
        </span>
      )
    case 'slots':
      return (
        <span className="roundtable-line-alert" role="status" data-testid="roundtable-slots">
          {t('roundtable.line.slots', { count: state.missing })}
          <span aria-hidden> · </span>
          <button
            type="button"
            className="link-button"
            onClick={() => requestSettings('conversation')}
            data-testid="roundtable-slots-settings"
          >
            {t('roundtable.line.slotsSettings')}
          </button>
        </span>
      )
    case 'ready':
      return (
        <span className="roundtable-line-cost" data-testid="roundtable-cost">
          <span className="roundtable-plus">
            {t('roundtable.line.plusSynthesis')}
            <span aria-hidden> · </span>
          </span>
          <span className="roundtable-cost-full" data-testid="roundtable-cost-full">
            {t('roundtable.cost.full', { n: state.multiplier })}
          </span>
          <span className="roundtable-cost-short" data-testid="roundtable-cost-short">
            {t('roundtable.cost.short', { n: state.multiplier })}
          </span>
        </span>
      )
  }
}

export function RoundtableLine({
  roundtable,
  files
}: {
  roundtable: RoundtableCompose
  /** Des fichiers sont joints à la question : ils partent à chaque participant. */
  files: boolean
}) {
  const { t } = useTranslation()
  // Échap ou un choix : le focus revient à la saisie (Entrée envoie ensuite) ; un clic ailleurs
  // le laisse où l'on a cliqué.
  const outside = useRef(false)
  const { state } = roundtable
  // Dès deux retenus, le bouton les compte (même si le tour ne peut pas partir d'ici).
  const count = roundtable.choices.length
  const label =
    count >= 2 ? t('roundtable.line.participants', { count }) : t('roundtable.line.choose')
  return (
    <div className="roundtable-line" data-testid="roundtable-line" data-state={state.kind}>
      <RoundtableIcon size={15} className="roundtable-line-icon" />
      <Popover.Root open={roundtable.menuOpen} onOpenChange={roundtable.setMenuOpen}>
        <ParticipantsTip roundtable={roundtable} files={files}>
          <Popover.Trigger className="roundtable-pick" data-testid="roundtable-participants">
            {label}
            <ChevronDown size={14} aria-hidden />
          </Popover.Trigger>
        </ParticipantsTip>
        <Popover.Portal>
          <Popover.Content
            className="menu model-menu roundtable-popover"
            side="top"
            align="start"
            sideOffset={8}
            collisionPadding={12}
            onInteractOutside={() => {
              outside.current = true
            }}
            onCloseAutoFocus={(event) => {
              if (outside.current) {
                outside.current = false
                return
              }
              event.preventDefault()
              roundtable.focus()
            }}
            // Le focus va à la liste : `RoundtableParticipants` s'en charge.
            onOpenAutoFocus={(event) => event.preventDefault()}
          >
            <RoundtableParticipants
              options={roundtable.options}
              choices={roundtable.choices}
              onToggle={roundtable.toggle}
            />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      <LineStatus roundtable={roundtable} />
      <span className="grow" />
      <button
        type="button"
        className="icon-button small roundtable-close"
        aria-label={t('roundtable.command.close')}
        title={t('roundtable.command.close')}
        onClick={roundtable.exit}
        data-testid="roundtable-close"
      >
        <X size={14} aria-hidden />
      </button>
    </div>
  )
}
