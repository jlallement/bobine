import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react'
import { useContext, useEffect, useId, useState, type MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import {
  commandCoverage,
  commandParts,
  normalizeCommandPrefix,
  type ApprovalRulesError,
  type ApprovalRulesView
} from '@shared/approval-rules'
import { permissionOptionLabel } from '@shared/permissions'

import type { ToolPermission } from '@shared/transcript'
import { CodeText } from '../common/CodeText'
import { WorkspaceContext } from './workspace-context'
import {
  GlobalRulesContext,
  oneWordExample,
  recordGlobalRule,
  useGlobalRuleOutcome,
  type GlobalRules
} from './global-rules'
import '../../approval-rules.css'

type PermissionOption = ToolPermission['options'][number]

/** Message d'une erreur des règles : rien n'a été écrit (ou pas tout, dit par le main). */
export function approvalRulesErrorText(t: TFunction, error: ApprovalRulesError): string {
  const where = error.line ? ` (${t('approvalRules.error.line', { line: error.line })})` : ''
  return `${t(`approvalRules.error.${error.code}`)}${where}`
}

const optionLabel = (
  t: TFunction,
  option: PermissionOption,
  siblings: PermissionOption[],
  scoped = false
) => {
  // Le bouton de la carte porte le libellé déclaré par le profil (fiche 214) : le texte le reprend.
  if (scoped && option.kind === 'allow_always') return t('toolCall.permission.alwaysConversation')
  const label = permissionOptionLabel(option, siblings)
  return 'key' in label ? t(label.key) : label.text
}

/**
 * « Pour tous les projets » en pied de carte de commande (fiche 215, ADR-0044) : seulement si
 * l'agent de la conversation déclare des règles d'approbation, pour une commande, sans risque
 * repéré (fiche 211), et quand l'agent propose « Toujours » (sinon il veut un accord explicite).
 * Rien n'est écrit sans un clic sur « Autoriser partout » ou « Refuser partout ».
 */
export function GlobalRuleSection({
  command,
  permission,
  risky,
  accepts,
  onRespond,
  alwaysScoped = false
}: {
  command: string | undefined
  permission: ToolPermission
  risky: boolean
  /** Clic réel trop tôt après l'apparition de la carte : pas une décision (`useArmedCard`). */
  accepts: (event: MouseEvent) => boolean
  onRespond: (requestId: string, optionId: string | null) => void
  /** Le profil déclare la portée de « Toujours » : le libellé de la carte la dit. */
  alwaysScoped?: boolean
}) {
  const rules = useContext(GlobalRulesContext)
  // Choisi par genre d'option ACP, jamais par identifiant.
  const always = permission.options.find((o) => o.kind === 'allow_always')
  const reject =
    permission.options.find((o) => o.kind === 'reject_once') ??
    permission.options.find((o) => o.kind === 'reject_always')
  if (!rules || !command?.trim() || risky || !always || !reject) return null
  return (
    <Section
      rules={rules}
      command={command}
      permission={permission}
      always={always}
      reject={reject}
      accepts={accepts}
      onRespond={onRespond}
      alwaysScoped={alwaysScoped}
    />
  )
}

interface Part {
  text: string
  on: boolean
  /** Partie telle que proposée : sa couverture par les listes de Bob ne change pas à la saisie. */
  original: string
}

function Section({
  rules,
  command,
  permission,
  always,
  reject,
  accepts,
  onRespond,
  alwaysScoped
}: {
  rules: GlobalRules
  command: string
  permission: ToolPermission
  always: PermissionOption
  reject: PermissionOption
  accepts: (event: MouseEvent) => boolean
  onRespond: (requestId: string, optionId: string | null) => void
  alwaysScoped: boolean
}) {
  const { t } = useTranslation()
  const workspace = useContext(WorkspaceContext)
  const id = useId()
  const [open, setOpen] = useState(false)
  // Règles lues à l'apparition : fichier illisible ou format inattendu, pas de section.
  const [view, setView] = useState<ApprovalRulesView | 'error' | null>(null)
  const [parts, setParts] = useState<Part[]>(() =>
    commandParts(command, workspace).map((text) => ({ text, on: true, original: text }))
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    window.api.approvalRules
      .get(rules.profileId)
      .then((read) => live && setView(read.ok ? read.rules : 'error'))
      .catch(() => live && setView('error'))
    return () => {
      live = false
    }
  }, [rules.profileId])
  if (view === null || view === 'error') return null
  // Déjà décidée par les listes de Bob (liste par défaut comprise) : ni proposée, ni écrite.
  const coverage = (part: Part) =>
    commandCoverage(part.original, view.commands.allowed, view.commands.denied)
  const pending = parts.filter((p) => !coverage(p))
  if (pending.length === 0) return <Covered parts={parts} coverage={coverage} rules={rules} />
  const execute = view.groups.find((g) => g.id === 'execute')
  const firstTime = !execute?.enabled && !execute?.forbidden
  const chained = parts.length > 1
  const singles = pending
    .filter((p) => p.on)
    .map((p) => normalizeCommandPrefix(p.text))
    .filter((n) => n?.singleWord)
    .map((n) => n?.prefix ?? '')
  const act = async (event: MouseEvent, kind: 'allowed' | 'denied') => {
    if (!accepts(event) || busy) return
    const chosen = pending.filter((p) => p.on).map((p) => p.text)
    if (chosen.length === 0) return setError(t('approvalRules.card.nothingSelected'))
    setBusy(true)
    setError(null)
    const written: string[] = []
    try {
      for (const prefix of chosen) {
        const result = await window.api.approvalRules.change(
          rules.profileId,
          kind === 'allowed'
            ? { type: 'allowCommandEverywhere', prefix }
            : { type: 'addCommand', prefix, list: 'denied' }
        )
        if (!result.ok) {
          setError(approvalRulesErrorText(t, result.error))
          return
        }
        if (result.notice.prefix) written.push(result.notice.prefix)
      }
      recordGlobalRule(permission.requestId, { kind, prefixes: written })
      // La règle ne vaut qu'à la conversation suivante : la carte reçoit aussi sa réponse.
      onRespond(permission.requestId, (kind === 'allowed' ? always : reject).optionId)
    } catch (e) {
      setError(t('approvalRules.error.failed', { message: (e as Error).message }))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="global-rule" data-testid="global-rule" data-open={open ? '' : undefined}>
      <button
        type="button"
        className="global-rule-toggle"
        aria-expanded={open}
        aria-controls={`${id}-body`}
        onClick={() => setOpen((v) => !v)}
        data-testid="global-rule-toggle"
      >
        {open ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}
        <span className="global-rule-title">{t('approvalRules.card.toggle')}</span>
        <span className="global-rule-tools">· {t('approvalRules.card.toggleTools')}</span>
      </button>
      {open && (
        <div className="global-rule-body" id={`${id}-body`}>
          <div className="global-rule-label" id={`${id}-label`}>
            {t('approvalRules.card.prefixLabel')}
          </div>
          {chained && <p className="global-rule-hint">{t('approvalRules.card.partsLabel')}</p>}
          {parts.map((part, i) => {
            const covered = coverage(part)
            return covered ? (
              <div className="global-rule-part covered" key={i} data-testid="global-rule-covered">
                <code>{part.original}</code>
                <span className="global-rule-covered-state">
                  {t(
                    covered === 'allowed'
                      ? 'approvalRules.card.alreadyAllowed'
                      : 'approvalRules.card.alreadyDenied'
                  )}
                </span>
              </div>
            ) : (
              <div className="global-rule-part" key={i}>
                {pending.length > 1 && (
                  <input
                    type="checkbox"
                    checked={part.on}
                    aria-label={t('approvalRules.card.partInclude', { n: i + 1 })}
                    onChange={(e) =>
                      setParts((list) =>
                        list.map((p, j) => (j === i ? { ...p, on: e.target.checked } : p))
                      )
                    }
                    data-testid="global-rule-part-on"
                  />
                )}
                <input
                  className="global-rule-input"
                  value={part.text}
                  spellCheck={false}
                  aria-labelledby={pending.length > 1 ? undefined : `${id}-label`}
                  aria-label={
                    pending.length > 1 ? t('approvalRules.card.partLabel', { n: i + 1 }) : undefined
                  }
                  onChange={(e) =>
                    setParts((list) =>
                      list.map((p, j) => (j === i ? { ...p, text: e.target.value } : p))
                    )
                  }
                  data-testid="global-rule-prefix"
                />
              </div>
            )
          })}
          <p className="global-rule-hint">{t('approvalRules.card.prefixHint')}</p>
          {singles.map((word) => (
            <OneWordWarning key={word} word={word} />
          ))}
          {firstTime && (
            <div className="global-rule-first" data-testid="global-rule-first-time">
              <CodeText text={t('approvalRules.card.firstTime')} />{' '}
              <button
                type="button"
                className="link-button global-rule-manage"
                onClick={rules.onManage}
              >
                {t('approvalRules.card.seeList')}
              </button>
            </div>
          )}
          {execute?.forbidden && (
            <p className="global-rule-hint" data-testid="global-rule-execute-forbidden">
              {t('approvalRules.card.executeForbidden')}
            </p>
          )}
          {/* Quand la règle vaut (Bob 2.1.0, vérifié) : un refus tout de suite ; une autorisation
              tout de suite seulement si « Commandes de la liste » était déjà permis, sinon à la
              prochaine conversation (le groupe est figé pour la conversation). */}
          <p className="global-rule-hint" data-testid="global-rule-when">
            {t(execute?.enabled ? 'approvalRules.card.whenNow' : 'approvalRules.card.whenNext', {
              always: optionLabel(t, always, permission.options, alwaysScoped),
              reject: optionLabel(t, reject, permission.options)
            })}
          </p>
          {error && (
            <p className="global-rule-error" role="alert" data-testid="global-rule-error">
              {error} {t('approvalRules.error.nothingWritten')}
            </p>
          )}
          <div className="global-rule-actions">
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={(e) => void act(e, 'allowed')}
              data-testid="global-rule-allow"
            >
              {t('approvalRules.card.allow')}
            </button>
            <button
              type="button"
              className="btn ghost"
              disabled={busy}
              onClick={(e) => void act(e, 'denied')}
              data-testid="global-rule-deny"
            >
              {t('approvalRules.card.deny')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Avertissement d'un préfixe d'un seul mot (`git`) : il couvre toutes les commandes qui commencent
 * ainsi. Partagé par la carte et Réglages › Approbations (fiche 215, recette QA).
 */
export function OneWordWarning({ word }: { word: string }) {
  const { t } = useTranslation()
  const example = oneWordExample(word)
  return (
    <p className="global-rule-warn" data-testid="global-rule-one-word">
      <AlertTriangle size={14} aria-hidden />
      <span>
        <CodeText
          text={
            example
              ? t('approvalRules.card.oneWord', { word, example })
              : t('approvalRules.card.oneWordAny', { word })
          }
        />
      </span>
    </p>
  )
}

/**
 * Commande déjà entièrement décidée par les listes de Bob : rien à proposer, on le dit (si Bob
 * demande quand même, c'est que le groupe Commandes est coupé ou que la règle est plus récente que
 * la session).
 */
function Covered({
  parts,
  coverage,
  rules
}: {
  parts: Part[]
  coverage: (part: Part) => 'allowed' | 'denied' | undefined
  rules: GlobalRules
}) {
  const { t } = useTranslation()
  return (
    <p className="global-rule global-rule-hint" data-testid="global-rule-all-covered">
      {parts.map((part, i) => (
        <span key={i}>
          {i > 0 && ' · '}
          <CodeText
            text={t(
              coverage(part) === 'denied'
                ? 'approvalRules.card.coveredDenied'
                : 'approvalRules.card.coveredAllowed',
              { command: part.original }
            )}
          />
        </span>
      ))}{' '}
      <button type="button" className="link-button global-rule-manage" onClick={rules.onManage}>
        {t('approvalRules.card.manage')}
      </button>
    </p>
  )
}

/** Sur la ligne de réponse : la règle écrite depuis cette carte, et « Gérer ». */
export function GlobalRuleAnswer({ requestId }: { requestId: string }) {
  const { t } = useTranslation()
  const rules = useContext(GlobalRulesContext)
  const outcome = useGlobalRuleOutcome(requestId)
  if (!outcome || outcome.prefixes.length === 0) return null
  const command = outcome.prefixes.map((p) => `\`${p}\``).join(', ')
  return (
    <span className="global-rule-answer" data-testid="global-rule-answer">
      <span aria-hidden>·</span>{' '}
      <CodeText
        text={t(
          outcome.kind === 'allowed'
            ? 'approvalRules.card.allowedDone'
            : 'approvalRules.card.deniedDone',
          { command, count: outcome.prefixes.length }
        )}
      />
      {rules && (
        <>
          {' '}
          <span aria-hidden>·</span>{' '}
          <button type="button" className="link-button global-rule-manage" onClick={rules.onManage}>
            {t('approvalRules.card.manage')}
          </button>
        </>
      )}
    </span>
  )
}
