import * as Dropdown from '@radix-ui/react-dropdown-menu'
import { ChevronDown } from 'lucide-react'
import { useState, type KeyboardEvent } from 'react'
import type { ConversationSummary } from '@shared/agent'
import { ConversationMenuItems, type ConversationActions } from './ConversationMenu'
import { useTranslation } from 'react-i18next'

/**
 * Titre de la conversation dans la barre de titre (fiche 049), aligné à gauche : un clic ouvre le
 * menu de la conversation (le même que dans la barre latérale) ; « Renommer » édite le titre en
 * place.
 */
export function ConversationTitle({
  conversation,
  onRename,
  ...actions
}: Omit<ConversationActions, 'onRename' | 'onOpenBeside'> & {
  conversation: ConversationSummary
  onRename: (title: string) => void
}) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<string | null>(null)
  const finish = (save: boolean) => {
    const title = draft?.trim()
    setDraft(null)
    if (save && title && title !== conversation.title) onRename(title)
  }
  if (draft !== null) {
    return (
      <input
        className="main-title-input no-drag"
        value={draft}
        autoFocus
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
          if (e.key === 'Enter') finish(true)
          if (e.key === 'Escape') finish(false)
        }}
        onBlur={() => finish(true)}
        aria-label={t('conversationTitle.label')}
        data-testid="title-input"
      />
    )
  }
  return (
    // Non modal : un menu modal qui ouvre une boîte (Supprimer) laisse la page bloquée aux clics
    // (`pointer-events: none` sur le body) une fois la boîte refermée.
    <Dropdown.Root modal={false}>
      <Dropdown.Trigger className="main-title no-drag" data-testid="title-menu">
        <span className="main-title-text">{conversation.title}</span>
        <ChevronDown size={14} className="main-title-chevron" />
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content className="menu" align="start" sideOffset={6}>
          <ConversationMenuItems
            conversation={conversation}
            testIdPrefix="title"
            {...actions}
            onRename={() => setDraft(conversation.title)}
          />
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  )
}

/**
 * Origine d'une branche dans l'en-tête (fiche 131), comme « ↳ depuis » pour une fille : la branche
 * n'est plus rangée sous elle dans la barre latérale. Ramène à l'origine si elle existe encore ; son
 * titre actuel, sinon celui retenu à la création.
 */
export function BranchOrigin({
  origin,
  list,
  onSelect
}: {
  origin: { id: string; title: string }
  list: readonly Pick<ConversationSummary, 'id' | 'title'>[]
  onSelect: (id: string) => void
}) {
  const { t } = useTranslation()
  const current = list.find((c) => c.id === origin.id)
  const label = t('conversationTitle.branchFrom', { title: current?.title ?? origin.title })
  if (!current) {
    return (
      <span className="main-title-origin" data-testid="title-branch-origin">
        {label}
      </span>
    )
  }
  return (
    <button
      className="main-title-origin no-drag"
      title={t('conversationTitle.branchFromTitle')}
      onClick={() => onSelect(current.id)}
      data-testid="title-branch-origin"
    >
      {label}
    </button>
  )
}
