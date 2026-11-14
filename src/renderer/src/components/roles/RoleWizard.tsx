import * as Dialog from '@radix-ui/react-dialog'
import { Check } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { ProfileSummary } from '@shared/agent'
import type { Role, RolesListing, RoleScope } from '@shared/roles'
import { ipcErrorText } from '../../ipc-errors'
import {
  draftDefinition,
  draftErrors,
  draftTouched,
  emptyDraft,
  errorField,
  stepOfField,
  WIZARD_STEPS,
  type DraftErrors,
  type RoleDraft,
  type WizardStep
} from '../../roles/role-draft'
import { rolesChanged, useRolesListing } from '../../roles/roles-store'
import {
  AgentFields,
  AppearanceFields,
  DescriptionField,
  NameFields,
  PromptField,
  ReadOnlyField,
  ScopeField,
  TemplateTiles,
  ToolsField,
  type DraftChange
} from './RoleFields'
import { RolePreview } from './RolePreview'

export interface RoleWizardProps {
  prefill: Partial<RoleDraft>
  /** Conversation active : son projet (portée « Ce projet ») et son agent. */
  conversationId?: string | undefined
  conversationProfileId?: string | undefined
  /** Nom du dossier de la conversation, pour « Ce projet » ; absent : pas de projet. */
  project?: string | undefined
  profiles: readonly ProfileSummary[]
  /**
   * « Créer et essayer » possible : le jeton du rôle créé sera posé dans la saisie de la
   * conversation affichée, une conversation de l'historique qui peut être mère.
   */
  canTry?: boolean
  onClose: () => void
  /** Rôle enregistré ; `tryIt` : « Créer et essayer » (son jeton `@rôle` dans la saisie). */
  onCreated: (name: string, tryIt: boolean) => void
}

const PRIORITY: readonly RoleScope[] = ['builtin', 'user', 'project']

/**
 * Rôles fournis, pour les tuiles de l'étape 2 : leur définition d'origine, même remplacés, dans la
 * langue de l'interface (ADR-0046).
 */
function useTemplates(listing: RolesListing | null): Role[] {
  const { i18n } = useTranslation()
  const language = i18n.language
  const [templates, setTemplates] = useState<Role[]>([])
  const names = (listing?.roles ?? [])
    .filter((r) => r.scope === 'builtin' || r.hides?.includes('builtin'))
    .map((r) => r.name)
    .join(',')
  useEffect(() => {
    if (!names) return
    let alive = true
    void Promise.all(names.split(',').map((name) => window.api.roles.read('builtin', name))).then(
      (roles) => alive && setTemplates(roles.filter((r): r is Role => !!r)),
      () => undefined
    )
    return () => {
      alive = false
    }
  }, [names, language])
  return templates
}

/**
 * Assistant de création d'un rôle (fiche 223, maquettes A1 à A3) : Qui (nom, icône, couleur,
 * quand l'appeler), Comment (consigne, à partir d'un rôle fourni ou d'une page blanche), Avec
 * quoi (agent, mode, modèle, lecture seule, outils, portée), avec l'aperçu en direct. ⌘↩ passe à
 * l'étape suivante (ou crée) ; Échap ferme, après confirmation si quelque chose a été saisi.
 */
export function RoleWizard(props: RoleWizardProps) {
  const { t } = useTranslation()
  const [initial] = useState(() => emptyDraft(props.prefill))
  const [draft, setDraft] = useState(initial)
  const [step, setStep] = useState<WizardStep>('who')
  const [errors, setErrors] = useState<DraftErrors>({})
  const [failure, setFailure] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const [pendingTemplate, setPendingTemplate] = useState<Role | null>(null)
  const { listing } = useRolesListing(props.conversationId)
  const templates = useTemplates(listing)
  const body = useRef<HTMLDivElement>(null)
  const index = WIZARD_STEPS.indexOf(step)
  const last = index === WIZARD_STEPS.length - 1

  // Une autre étape : son premier champ prend le focus (tabulation depuis le haut).
  useEffect(() => {
    body.current?.querySelector<HTMLElement>('input, textarea, select, button')?.focus()
  }, [step])

  const change: DraftChange = (next) => {
    setDraft(next)
    // Une erreur montrée disparaît dès que son champ change.
    if (Object.keys(errors).length) setErrors(draftErrors(next, step))
    setFailure(null)
  }
  const existing = listing?.roles.find((r) => r.name === draft.name.trim())
  const replaces =
    existing && PRIORITY.indexOf(existing.scope) < PRIORITY.indexOf(draft.scope)
      ? existing
      : undefined

  const pickTemplate = (template: Role | null, force = false) => {
    const fromTemplate = templates.find((r) => r.name === draft.template)?.prompt
    const typed = draft.prompt.trim() && draft.prompt !== fromTemplate
    if (template && typed && !force) return setPendingTemplate(template)
    setPendingTemplate(null)
    change(
      template
        ? {
            ...draft,
            template: template.name,
            prompt: template.prompt,
            readOnly: template.readOnly,
            mcp: template.mcp ? [...template.mcp] : null
          }
        : { ...draft, template: '', prompt: typed ? draft.prompt : '' }
    )
  }

  const goTo = (next: WizardStep) => {
    // En avant : l'étape quittée doit être juste ; en arrière, toujours possible.
    if (WIZARD_STEPS.indexOf(next) > index) {
      const found = draftErrors(draft, step)
      setErrors(found)
      if (Object.keys(found).length) return
      if (next === 'how' && draft.template === undefined && !draft.prompt.trim()) {
        // Le rôle fourni qui ressemble au nom (même icône suggérée) est présélectionné (A2).
        const like = templates.find((r) => r.icon === draft.icon)
        if (like) pickTemplate(like)
      }
    } else setErrors({})
    setStep(next)
  }

  const save = async (tryIt: boolean) => {
    if (busy) return
    const found = draftErrors(draft, 'all')
    const first = Object.keys(found)[0] as keyof DraftErrors | undefined
    if (first) {
      setErrors(found)
      return setStep(stepOfField(first))
    }
    const checked = draftDefinition(draft)
    if (!checked.ok) return
    setBusy(true)
    try {
      const result = await window.api.roles.save(
        draft.scope,
        checked.role,
        props.conversationId ? { conversationId: props.conversationId } : undefined
      )
      if (!result.ok) {
        const field = errorField(result.error)
        setErrors({ [field]: result.error })
        setStep(stepOfField(field))
        return
      }
      rolesChanged()
      props.onCreated(checked.role.name, tryIt)
    } catch (e) {
      setFailure(ipcErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Enter' || !(event.metaKey || event.ctrlKey)) return
    event.preventDefault()
    if (last) void save(false)
    else goTo(WIZARD_STEPS[index + 1] ?? step)
  }

  return (
    <Dialog.Root open onOpenChange={(open) => !open && !busy && props.onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className="dialog role-wizard"
          data-testid="role-wizard"
          data-step={step}
          onKeyDown={onKeyDown}
          onEscapeKeyDown={(event) => {
            if (confirmClose || !draftTouched(draft, initial)) return
            event.preventDefault()
            setConfirmClose(true)
          }}
          onInteractOutside={(event) => event.preventDefault()}
        >
          <div className="role-wizard-main">
            <header className="role-wizard-head">
              <Dialog.Title className="role-wizard-title">{t('roleWizard.title')}</Dialog.Title>
              <Steps step={step} onStep={goTo} />
            </header>
            <Dialog.Description className="sr-only">
              {t('roleWizard.description')}
            </Dialog.Description>
            <div className="role-wizard-body" ref={body} data-testid={`role-step-${step}`}>
              {step === 'who' && (
                <>
                  <NameFields
                    draft={draft}
                    onChange={change}
                    errors={errors}
                    {...(replaces ? { replaces } : {})}
                    onEnter={() => goTo('how')}
                    autoFocus
                  />
                  <AppearanceFields draft={draft} onChange={change} />
                  <DescriptionField draft={draft} onChange={change} errors={errors} examples />
                </>
              )}
              {step === 'how' && (
                <>
                  <TemplateTiles
                    templates={templates}
                    selected={draft.template}
                    onPick={(template) => pickTemplate(template)}
                  />
                  {pendingTemplate && (
                    <div className="role-note role-replace" role="alert" data-testid="role-replace">
                      <span>{t('roleWizard.replacePrompt', { label: pendingTemplate.label })}</span>
                      <button
                        type="button"
                        className="btn small"
                        onClick={() => pickTemplate(pendingTemplate, true)}
                        data-testid="role-replace-confirm"
                      >
                        {t('roleWizard.replace')}
                      </button>
                      <button
                        type="button"
                        className="btn small ghost"
                        onClick={() => setPendingTemplate(null)}
                      >
                        {t('common.keep')}
                      </button>
                    </div>
                  )}
                  <PromptField draft={draft} onChange={change} errors={errors} rows={11} />
                </>
              )}
              {step === 'with' && (
                <>
                  <AgentFields
                    draft={draft}
                    onChange={change}
                    errors={errors}
                    profiles={props.profiles}
                  />
                  <ReadOnlyField
                    draft={draft}
                    onChange={change}
                    profiles={props.profiles}
                    conversationProfileId={props.conversationProfileId}
                  />
                  <ToolsField draft={draft} onChange={change} />
                  <ScopeField draft={draft} onChange={change} project={props.project} />
                </>
              )}
              {failure && (
                <p className="field-error" role="alert" data-testid="role-wizard-error">
                  {failure}
                </p>
              )}
            </div>
            {confirmClose ? (
              <div
                className="role-wizard-foot role-wizard-confirm"
                role="alertdialog"
                aria-label={t('roleWizard.discard')}
              >
                <span>{t('roleWizard.discard')}</span>
                <button
                  className="btn danger"
                  onClick={props.onClose}
                  data-testid="role-wizard-discard"
                >
                  {t('roleWizard.discardConfirm')}
                </button>
                <button className="btn" autoFocus onClick={() => setConfirmClose(false)}>
                  {t('roleWizard.keepEditing')}
                </button>
              </div>
            ) : (
              <Footer
                index={index}
                last={last}
                busy={busy}
                canTry={!!props.canTry}
                onBack={() => goTo(WIZARD_STEPS[index - 1] ?? step)}
                onNext={() => goTo(WIZARD_STEPS[index + 1] ?? step)}
                onSave={(tryIt) => void save(tryIt)}
                onCancel={() =>
                  draftTouched(draft, initial) ? setConfirmClose(true) : props.onClose()
                }
              />
            )}
          </div>
          <RolePreview draft={draft} showFile={last} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/** Fil des étapes : faite (coche, cliquable pour y revenir), en cours, à venir. */
function Steps({ step, onStep }: { step: WizardStep; onStep: (step: WizardStep) => void }) {
  const { t } = useTranslation()
  const current = WIZARD_STEPS.indexOf(step)
  return (
    <ol className="role-steps" aria-label={t('roleWizard.steps')}>
      {WIZARD_STEPS.map((id, i) => (
        <li
          key={id}
          className={`role-step${i === current ? ' current' : ''}${i < current ? ' done' : ''}`}
          aria-current={i === current ? 'step' : undefined}
          data-testid={`role-step-tab-${id}`}
        >
          <button type="button" disabled={i >= current} onClick={() => onStep(id)}>
            <span className="role-step-dot" aria-hidden>
              {i < current ? <Check size={12} strokeWidth={3} /> : i + 1}
            </span>
            {t(`roleWizard.step.${id}`)}
          </button>
        </li>
      ))}
    </ol>
  )
}

function Footer({
  index,
  last,
  busy,
  canTry,
  onBack,
  onNext,
  onSave,
  onCancel
}: {
  index: number
  last: boolean
  busy: boolean
  canTry: boolean
  onBack: () => void
  onNext: () => void
  onSave: (tryIt: boolean) => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  return (
    <footer className="role-wizard-foot">
      <button className="btn ghost" onClick={onCancel} data-testid="role-wizard-cancel">
        {t('common.cancel')}
      </button>
      <span className="role-wizard-spacer" />
      <kbd className="role-kbd" title={t('roleWizard.shortcut')}>
        {t('roleWizard.shortcutKeys')}
      </kbd>
      {index > 0 && (
        <button className="btn" onClick={onBack} disabled={busy} data-testid="role-wizard-back">
          {t('roleWizard.back')}
        </button>
      )}
      {last ? (
        <>
          <button
            className={`btn${canTry ? '' : ' primary'}`}
            onClick={() => onSave(false)}
            disabled={busy}
            data-testid="role-wizard-create"
          >
            {t('roleWizard.create')}
          </button>
          {canTry && (
            <button
              className="btn primary"
              onClick={() => onSave(true)}
              disabled={busy}
              data-testid="role-wizard-create-try"
            >
              {t('roleWizard.createAndTry')}
            </button>
          )}
        </>
      ) : (
        <button className="btn primary" onClick={onNext} data-testid="role-wizard-next">
          {t('roleWizard.next')}
        </button>
      )}
    </footer>
  )
}
