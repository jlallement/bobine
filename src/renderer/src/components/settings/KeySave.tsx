import { LockKeyhole } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ipcErrorText, isKeychainTimeout } from '../../ipc-errors'

/** Passé ce délai sans réponse, l'enregistrement attend sûrement la fenêtre du trousseau. */
export const KEYCHAIN_HINT_MS = 1000

/**
 * Enregistrement d'une clé d'API (fiche 207), jamais silencieux : en cours, puis « en attente du
 * trousseau » s'il tarde, puis délai dépassé (la valeur saisie est gardée, « Réessayer ») ou
 * erreur. Partagé par Réglages › Agents et la carte « Connexion requise ».
 */
export function useKeySave(save: (value: string) => Promise<void>) {
  const [saving, setSaving] = useState(false)
  const [slow, setSlow] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Abandon (formulaire fermé, démonté) : l'issue d'un enregistrement en cours n'est plus montrée.
  const attempt = useRef(0)
  useEffect(() => {
    if (!saving) return
    const timer = setTimeout(() => setSlow(true), KEYCHAIN_HINT_MS)
    return () => clearTimeout(timer)
  }, [saving])
  useEffect(
    () => () => {
      attempt.current++
    },
    []
  )
  const reset = () => {
    attempt.current++
    setSaving(false)
    setSlow(false)
    setTimedOut(false)
    setError(null)
  }
  const run = (value: string): Promise<boolean> => {
    const mine = ++attempt.current
    setSaving(true)
    setSlow(false)
    setTimedOut(false)
    setError(null)
    return save(value).then(
      () => {
        if (attempt.current !== mine) return false
        setSaving(false)
        setSlow(false)
        return true
      },
      (failure: unknown) => {
        if (attempt.current !== mine) return false
        setSaving(false)
        setSlow(false)
        setTimedOut(isKeychainTimeout(failure))
        setError(ipcErrorText(failure))
        return false
      }
    )
  }
  return { saving, slow, timedOut, error, run, reset }
}

export type KeySave = ReturnType<typeof useKeySave>

/** « En attente du trousseau macOS… » et ce qu'il faut faire dans sa fenêtre. */
export function KeychainWait({ className }: { className: string }) {
  const { t } = useTranslation()
  return (
    <div className={`${className} keychain-wait`} data-testid="keychain-wait" role="status">
      <LockKeyhole size={14} />
      <span>
        <b>{t('settings.apiKeys.keychainWaitTitle')}</b> {t('settings.apiKeys.keychainWaitText')}
      </span>
    </div>
  )
}
