/**
 * Recommencer à neuf (fiche 148), côté interface : ce que le lancement dit de lui (profil
 * temporaire, `--reinitialiser`), lu une fois ; la demande de réinitialisation ne sert qu'une fois.
 */
import { useEffect, useState } from 'react'
import type { FreshStartInfo } from '@shared/fresh-start'

const NONE: FreshStartInfo = { temporary: false, askReset: false }
let pending: Promise<FreshStartInfo> | undefined
let resetAsked = false

/** Profil temporaire, `--reinitialiser` : lus de `app:getInfo`, une seule fois. */
export function freshStartInfo(): Promise<FreshStartInfo> {
  pending ??= window.api.app.getInfo().then(
    (info) => info.freshStart ?? NONE,
    () => NONE
  )
  return pending
}

export function useFreshStart(): FreshStartInfo | null {
  const [info, setInfo] = useState<FreshStartInfo | null>(null)
  useEffect(() => {
    let live = true
    void freshStartInfo().then((value) => live && setInfo(value))
    return () => {
      live = false
    }
  }, [])
  return info
}

/** `--reinitialiser` : vrai la première fois seulement (la confirmation s'ouvre une fois). */
export function takeResetRequest(info: FreshStartInfo): boolean {
  if (!info.askReset || resetAsked) return false
  resetAsked = true
  return true
}

/** Essais : on repart de zéro. */
export function forgetFreshStart(): void {
  pending = undefined
  resetAsked = false
}
