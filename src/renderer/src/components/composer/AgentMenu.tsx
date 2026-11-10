/**
 * Menu de l'agent de la barre de saisie (sorti de `common/Menus.tsx`, fiche 108). Sur une
 * conversation commencée, il propose d'abord de la continuer avec un autre agent (« Continuer
 * avec », ses modèles mis en avant), puis une nouvelle conversation avec un agent, comme avant.
 * Sur une conversation vide, seulement le choix de l'agent : il n'y a rien à transmettre.
 */
import * as Dropdown from '@radix-ui/react-dropdown-menu'
import { Bot, Check, ChevronDown } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import i18next from 'i18next'
import type { AgentConfigureRequest, AgentSettingsView } from '@shared/agent'
import type { DataDestination, HandoverModel, HandoverTarget } from '@shared/handover'
import { shortModelName } from '@shared/models'
import { ItemText, MenuContent, Tip } from '../common/Menus'
import { HandoverDialog, type HandoverChoice } from './HandoverDialog'

export function AgentMenu({
  settings,
  label,
  disabled,
  conversationId,
  onConfigure
}: {
  settings: AgentSettingsView
  label: string
  disabled: boolean
  /** Conversation commencée : « Continuer avec » est proposé (fiche 108). */
  conversationId?: string
  onConfigure: (request: AgentConfigureRequest) => void
}) {
  const { t } = useTranslation()
  const [choice, setChoice] = useState<HandoverChoice | null>(null)
  const installed = settings.profiles.filter((p) => p.available || p.id === settings.profileId)
  return (
    <>
      <Dropdown.Root modal={false}>
        {/* Faute de place, l'icône remplace le nom (fiches 092, 185 D26) : le nom reste ici. */}
        <Tip label={t('agentMenu.tip', { agent: label })}>
          <Dropdown.Trigger
            className="chip agent-chip"
            disabled={disabled}
            data-testid="agent-menu"
          >
            <Bot size={14} className="agent-chip-icon" aria-hidden="true" />
            <span className="chip-label">{label}</span>
            <ChevronDown size={14} />
          </Dropdown.Trigger>
        </Tip>
        <MenuContent align="end" testId="agent-menu-content">
          {conversationId && <ContinueSection conversationId={conversationId} onPick={setChoice} />}
          <div className="menu-label">
            {conversationId ? t('handover.menu.newConversation') : t('agentMenu.title')}
          </div>
          {/* Seulement les agents installés (fiche 058) ; celui de la conversation reste visible. */}
          {installed.length === 0 && (
            <div className="menu-item" aria-disabled data-testid="agent-none">
              <ItemText title={t('agentMenu.none')} description={t('agentMenu.noneHint')} />
            </div>
          )}
          {installed.map((profile) => (
            <Dropdown.Item
              key={profile.id}
              className="menu-item"
              disabled={!profile.available}
              onSelect={() => {
                if (profile.id !== settings.profileId) onConfigure({ profileId: profile.id })
              }}
              data-testid={`agent-option-${profile.id}`}
            >
              <ItemText title={profile.label} description={profile.reason} />
              {profile.id === settings.profileId && <Check size={16} className="menu-check" />}
            </Dropdown.Item>
          ))}
        </MenuContent>
      </Dropdown.Root>
      {choice && conversationId && (
        <HandoverDialog
          conversationId={conversationId}
          fromLabel={label}
          choice={choice}
          onClose={() => setChoice(null)}
        />
      )}
    </>
  )
}

/**
 * « Continuer avec » : pour chaque autre agent installé, ses modèles mis en avant (récents, puis
 * ceux des fournisseurs déclarés), puis une ligne pour choisir un autre modèle (ou l'agent seul).
 * Lus à l'ouverture du menu : le menu fermé n'est pas monté.
 */
function ContinueSection({
  conversationId,
  onPick
}: {
  conversationId: string
  onPick: (choice: HandoverChoice) => void
}) {
  const { t } = useTranslation()
  const [targets, setTargets] = useState<HandoverTarget[]>([])
  useEffect(() => {
    let alive = true
    window.api.conversations
      .handoverTargets(conversationId)
      .then((found) => alive && setTargets(found))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [conversationId])
  if (targets.length === 0) return null
  return (
    <>
      <div className="menu-label">{t('handover.menu.continue')}</div>
      {targets.flatMap((target) => {
        const featured = target.models.filter((m) => m.featured)
        return [
          ...featured.map((model) => (
            <Dropdown.Item
              key={`${target.profileId}:${model.value}`}
              className="menu-item"
              onSelect={() => onPick({ target, model: model.value })}
              data-testid={`handover-${target.profileId}-${model.value}`}
            >
              <ItemText
                title={`${target.label} · ${shortModelName(model.name)}`}
                description={featuredNote(model)}
              />
            </Dropdown.Item>
          )),
          <Dropdown.Item
            key={target.profileId}
            className="menu-item"
            onSelect={() => onPick({ target })}
            data-testid={`handover-${target.profileId}`}
          >
            <ItemText
              title={
                featured.length > 0
                  ? t('handover.menu.otherModel', { agent: target.label })
                  : t('handover.menu.choose', { agent: target.label })
              }
            />
          </Dropdown.Item>
        ]
      })}
      <Dropdown.Separator className="menu-separator" />
    </>
  )
}

/** Sous un modèle mis en avant : « récent », et son fournisseur s'il est connu. */
function featuredNote(model: HandoverModel): string {
  const provider = providerName(model.destination)
  if (model.featured !== 'recent') return provider ?? ''
  return provider
    ? i18next.t('handover.menu.recentWith', { provider })
    : i18next.t('handover.menu.recent')
}

/** Nom du fournisseur d'une destination, s'il y en a un. */
export function providerName(destination: DataDestination): string | undefined {
  if (destination.kind === 'provider') return destination.name
  if (destination.kind === 'prefix') return destination.provider
  return undefined
}
