import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import type { AppToolFamily } from '@shared/mcp'
import { formatTokens } from '@shared/usage'

/** Nombre d'outils de toutes les familles (onglet « Bobine »). */
export const appToolCount = (families: readonly AppToolFamily[]) =>
  families.reduce((sum, family) => sum + family.tools.length, 0)

/** Jetons estimés des familles, toutes ou seulement celles déclarées aux agents (fiche 109). */
const tokensOf = (families: readonly AppToolFamily[]) =>
  families.reduce((sum, family) => sum + family.tokens, 0)

/**
 * Onglet « Bobine » de Réglages › Serveurs MCP (fiche 099) : les outils que Bobine donne aux agents
 * par son serveur MCP `bobine`, une carte par famille, avec son poids estimé dans le contexte et
 * un interrupteur (fiche 109). Une famille coupée vaut pour les sessions ouvertes ensuite.
 */
export function AppToolsTab({
  families,
  error,
  onToggle,
  onSection
}: {
  families: AppToolFamily[] | null
  error: string | null
  onToggle?: (id: string, enabled: boolean) => void
  /** Ouvre la section qui règle une famille (`setting`, fiche 182). */
  onSection?: (section: 'memory') => void
}) {
  const { t } = useTranslation()
  // Un interrupteur changé : l'avis dit quand le changement s'applique.
  const [changed, setChanged] = useState(false)
  if (error) {
    return (
      <div className="settings-note error" data-testid="app-tools-error">
        {t('mcp.bobine.error', { error })}
      </div>
    )
  }
  if (!families) return <p className="settings-row-hint">{t('mcp.loading')}</p>
  const enabled = families.filter((family) => family.enabled)
  return (
    <>
      <p className="settings-row-hint">
        <Trans t={t} i18nKey="mcp.bobine.intro" components={{ code: <code /> }} />
      </p>
      <p className="settings-row-hint app-tools-weight" data-testid="app-tools-weight">
        {t('mcp.bobine.weight', {
          tokens: formatTokens(tokensOf(enabled)),
          total: formatTokens(tokensOf(families))
        })}
      </p>
      {changed && (
        <div className="settings-note" role="status" data-testid="app-tools-applies">
          {t('mcp.bobine.applies')}
        </div>
      )}
      <ul className="app-tool-families" data-testid="app-tool-families">
        {families.map((family) => (
          <FamilyCard
            key={family.id}
            family={family}
            {...(onSection ? { onSection } : {})}
            {...(onToggle
              ? {
                  onToggle: (value: boolean) => {
                    setChanged(true)
                    onToggle(family.id, value)
                  }
                }
              : {})}
          />
        ))}
      </ul>
    </>
  )
}

/**
 * Une famille : repliée, son titre, son poids, sa phrase, sa condition et son accord, et son
 * interrupteur (hors du bouton qui déplie : deux commandes ne s'imbriquent pas) ; dépliée, ses outils.
 */
function FamilyCard({
  family,
  onToggle,
  onSection
}: {
  family: AppToolFamily
  onToggle?: (enabled: boolean) => void
  onSection?: (section: 'memory') => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const listId = `app-tools-${family.id}`
  const name = t(family.title)
  return (
    <li
      className={`app-tool-family${open ? ' open' : ''}${family.enabled ? '' : ' off'}`}
      data-testid="app-tool-family"
      data-id={family.id}
      data-enabled={family.enabled}
    >
      <div className="app-tool-family-row">
        <button
          type="button"
          className="app-tool-family-head"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen(!open)}
          data-testid="app-tool-family-toggle"
        >
          <span className="app-tool-family-title">
            <span className="app-tool-family-name">{name}</span>
            <span className="app-tool-family-count" data-testid="app-tool-family-count">
              {t('mcp.bobine.count', { count: family.tools.length })}
            </span>
            <span
              className="app-tool-family-count"
              title={t('mcp.bobine.tokensTip')}
              data-testid="app-tool-family-tokens"
              data-tokens={family.tokens}
            >
              {t('mcp.bobine.tokens', { tokens: formatTokens(family.tokens) })}
            </span>
            <ChevronDown size={14} className="app-tool-family-chevron" aria-hidden />
          </span>
          <span className="app-tool-family-summary">{t(family.summary)}</span>
          <span className="app-tool-pills">
            <span
              className="app-tool-pill"
              title={t('mcp.bobine.conditionTip')}
              data-testid="app-tool-condition"
            >
              {family.enabled ? t(family.condition) : t('mcp.bobine.off')}
            </span>
            {family.approval && family.enabled && (
              <span
                className="app-tool-pill approval"
                title={t('mcp.bobine.approvalTip')}
                data-testid="app-tool-approval"
              >
                {t(family.approval)}
              </span>
            )}
          </span>
        </button>
        {family.setting ? (
          // Réglée ailleurs (fiche 182) : son état et le chemin du réglage, pas un second interrupteur.
          <span className="app-tool-required" data-testid="app-tool-setting">
            {t(family.enabled ? 'mcp.bobine.settingOn' : 'mcp.bobine.settingOff')}
            {' · '}
            {onSection ? (
              <button
                type="button"
                className="link-button"
                onClick={() => family.setting && onSection(family.setting)}
              >
                {t(`mcp.bobine.settingPath.${family.setting}`)}
              </button>
            ) : (
              t(`mcp.bobine.settingPath.${family.setting}`)
            )}
          </span>
        ) : family.required ? (
          // Imposée (les questions) : dit en clair, pas un interrupteur grisé (fiche 126).
          <span
            className="app-tool-required"
            title={t('mcp.bobine.required')}
            data-testid="app-tool-required"
          >
            {t('mcp.bobine.always')}
          </span>
        ) : (
          <label
            className="switch app-tool-switch"
            title={family.enabled ? t('mcp.bobine.disable') : t('mcp.bobine.enable')}
          >
            <input
              type="checkbox"
              checked={family.enabled}
              disabled={!onToggle}
              onChange={(e) => onToggle?.(e.target.checked)}
              aria-label={t('mcp.bobine.enabledLabel', { name })}
              data-testid="app-tool-enabled"
            />
            <span />
          </label>
        )}
      </div>
      {open && (
        <ul id={listId} className="app-tool-names" data-testid="app-tool-names">
          {family.tools.map((tool) => (
            // Description que lit l'agent, en anglais (ADR-0014) : au survol.
            <li key={tool.name} title={tool.description} data-testid="app-tool-name">
              {tool.name}
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}
