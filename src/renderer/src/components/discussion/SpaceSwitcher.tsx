import { CodeXml, MessageCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ConversationSpace } from '@shared/agent'
import { SHORTCUTS } from '@shared/shortcuts'

const keysOf = (command: string) => SHORTCUTS.find((s) => s.command === command)?.keys ?? ''

/** Sélecteur d'espace en tête de la barre latérale (fiche 224) : Code | Discussion. */
export function SpaceSwitcher(props: {
  space: ConversationSpace
  onChoose: (space: ConversationSpace) => void
}) {
  const { t } = useTranslation()
  const tab = (space: ConversationSpace, icon: React.ReactNode, command: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={props.space === space}
      onClick={() => props.onChoose(space)}
      data-testid={`space-${space}`}
    >
      {icon}
      {t(`discussion.space.${space}`)}
      <kbd>{keysOf(command)}</kbd>
    </button>
  )
  return (
    <div className="space-switch" role="tablist" aria-label={t('discussion.space.label')}>
      {tab('code', <CodeXml size={14} />, 'space-code')}
      {tab('discussion', <MessageCircle size={14} />, 'space-discussion')}
    </div>
  )
}
