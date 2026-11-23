import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { NetworkSettings, NetworkView } from '@shared/providers'
import { ipcErrorText } from '../../ipc-errors'
import { onNetworkReveal } from '../../open-settings'
import { Advanced, Row, SettingsCard, SettingsTitle } from './rows'

const FIELDS = ['proxy', 'noProxy', 'caCerts'] as const
type Field = (typeof FIELDS)[number]

/**
 * Réglages › Agents › Avancé › Réseau d'entreprise (fiches 104, 136) : proxy, hôtes sans proxy, fichier des
 * certificats de l'entreprise, posés dans l'environnement de tous les agents à leur lancement et
 * utilisés par « Tester » un fournisseur. Vide : la valeur du shell de connexion, montrée en
 * indication. Enregistré quand le champ perd le focus ou sur Entrée. Fermé, « Avancé » résume ce
 * qui est défini. « Réglages réseau » d'un bandeau du fil (fiche 275) le déplie et met le champ du
 * proxy à l'écran, avec le focus.
 */
export function NetworkSection() {
  const { t } = useTranslation()
  const [view, setView] = useState<NetworkView | null>(null)
  const [drafts, setDrafts] = useState<Partial<Record<Field, string>>>({})
  const [note, setNote] = useState<{ error: boolean; text: string } | null>(null)
  const advanced = useRef<HTMLDetailsElement>(null)
  const proxyInput = useRef<HTMLInputElement>(null)
  const [revealed, setRevealed] = useState(0)
  useEffect(
    () =>
      onNetworkReveal(() => {
        if (advanced.current) advanced.current.open = true
        setRevealed((n) => n + 1)
      }),
    []
  )
  // Champ du proxy montré une fois les réglages lus (désactivé avant).
  useEffect(() => {
    if (!revealed || !view) return
    proxyInput.current?.scrollIntoView({ block: 'center' })
    proxyInput.current?.focus()
  }, [revealed, view])
  useEffect(() => {
    let alive = true
    window.api.settings
      .network()
      .then((v) => alive && setView(v))
      .catch((e: unknown) => alive && setNote({ error: true, text: ipcErrorText(e) }))
    return () => {
      alive = false
    }
  }, [])

  // Enregistrements l'un après l'autre, chacun parti des réglages que le précédent a rendus : passé
  // vite d'un champ au suivant, le second partait de l'ancienne vue et effaçait le premier (proxy
  // perdu en quittant aussitôt « Sans proxy », runner macOS, fiche 250).
  const saving = useRef<Promise<void>>(Promise.resolve())
  const latest = useRef<NetworkSettings | null>(null)
  const save = (field: Field) => {
    if (!view || drafts[field] === undefined) return
    const value = drafts[field]?.trim() ?? ''
    saving.current = saving.current.then(async () => {
      const settings = latest.current ?? view.settings
      if (value === (settings[field] ?? '')) {
        setDrafts((d) => ({ ...d, [field]: undefined }))
        return
      }
      try {
        const next = await window.api.settings.setNetwork({
          ...settings,
          [field]: value || undefined
        })
        latest.current = next.settings
        setView(next)
        setDrafts((d) => ({ ...d, [field]: undefined }))
        setNote({ error: false, text: t('settings.network.saved') })
      } catch (e: unknown) {
        setNote({ error: true, text: ipcErrorText(e) })
      }
    })
  }

  const defined = view ? FIELDS.filter((field) => view.settings[field]) : []
  const summary =
    defined.length > 0
      ? t('settings.network.summary.set', {
          list: defined.map((field) => t(`settings.network.summary.${field}`)).join(', ')
        })
      : t('settings.network.summary.none')
  return (
    <Advanced summary={summary} testId="settings-agents-advanced" detailsRef={advanced}>
      <SettingsTitle>{t('settings.network.label')}</SettingsTitle>
      <p className="settings-row-hint settings-before-card">{t('settings.network.hint')}</p>
      <SettingsCard>
        {FIELDS.map((field) => (
          <Row
            key={field}
            label={t(`settings.network.${field}.label`)}
            hint={t(`settings.network.${field}.hint`)}
          >
            <input
              ref={field === 'proxy' ? proxyInput : undefined}
              className="settings-input settings-input-wide mono"
              spellCheck={false}
              autoComplete="off"
              value={drafts[field] ?? view?.settings[field] ?? ''}
              placeholder={
                view?.fromShell[field]
                  ? t('settings.network.fromShell', { value: view.fromShell[field] })
                  : t('settings.network.empty')
              }
              disabled={!view}
              onChange={(e) => setDrafts((d) => ({ ...d, [field]: e.target.value }))}
              onBlur={() => save(field)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  save(field)
                }
              }}
              data-testid={`network-${field}`}
            />
          </Row>
        ))}
      </SettingsCard>
      {note && (
        <div
          className={`settings-note${note.error ? ' error' : ''}`}
          role={note.error ? 'alert' : undefined}
          data-testid="network-note"
        >
          {note.text}
        </div>
      )}
    </Advanced>
  )
}
