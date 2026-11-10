import { chosenEditor } from '@shared/editors'
import { useTranslation } from 'react-i18next'
import { useInstalledEditors } from '../../useEditor'
import { Row } from './rows'

/**
 * Réglages › Général › Éditeur (fiche 156) : celui de « Ouvrir dans… », parmi les éditeurs
 * installés ; aucun : « Ouvrir dans… » n'apparaît pas.
 */
export function EditorRow({
  preference,
  onChange
}: {
  preference: string | undefined
  onChange: (editor: string) => void
}) {
  const { t } = useTranslation()
  const installed = useInstalledEditors()
  if (!installed) return null
  const current = chosenEditor(installed, preference)
  return (
    <Row
      label={t('settings.general.editor.label')}
      hint={t(installed.length ? 'settings.general.editor.hint' : 'settings.general.editor.none')}
    >
      {installed.length > 0 && (
        <select
          className="settings-input"
          value={current?.id ?? ''}
          onChange={(e) => onChange(e.target.value)}
          data-testid="settings-editor"
        >
          {installed.map((editor) => (
            <option key={editor.id} value={editor.id}>
              {editor.name}
            </option>
          ))}
        </select>
      )}
    </Row>
  )
}
