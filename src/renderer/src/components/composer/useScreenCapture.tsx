import { useState, type ReactNode } from 'react'
import type {
  ImageAttachment,
  ScreenCaptureResult,
  ScreenCaptureUnavailable
} from '@shared/attachments'
import { ipcErrorText } from '../../ipc-errors'
import { CaptureProblem } from './CaptureProblem'

/**
 * Capture d'une zone de l'écran depuis la zone de saisie (fiche 062) : l'image est jointe ; une
 * capture impossible (autorisation de macOS, fiche 124) est dite sous la zone de saisie.
 */
export function useScreenCapture(options: {
  onCaptureScreen: (() => Promise<ScreenCaptureResult>) | undefined
  onOpenSettings: (() => Promise<void>) | undefined
  onCaptured: (image: ImageAttachment) => void
  onWarn: (message: string) => void
  focus: () => void
}): { capture: (() => void) | undefined; problem: ReactNode } {
  const { onCaptureScreen, onOpenSettings, onCaptured, onWarn, focus } = options
  const [reason, setReason] = useState<ScreenCaptureUnavailable['reason'] | null>(null)
  const capture = async (run: () => Promise<ScreenCaptureResult>) => {
    setReason(null)
    try {
      const result = await run()
      if (result?.kind === 'image') onCaptured(result)
      else if (result?.kind === 'unavailable') setReason(result.reason)
    } catch (error) {
      onWarn(ipcErrorText(error))
    }
    focus()
  }
  return {
    capture: onCaptureScreen ? () => void capture(onCaptureScreen) : undefined,
    problem: reason && (
      <CaptureProblem
        reason={reason}
        className="composer-capture-problem"
        onOpenSettings={() => {
          onOpenSettings?.().catch((error: unknown) => onWarn(ipcErrorText(error)))
        }}
        onDismiss={() => {
          setReason(null)
          focus()
        }}
      />
    )
  }
}
