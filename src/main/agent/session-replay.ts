/**
 * Relecture d'une session à part (fiche 053 : travail d'un sous-agent). Un agent lancé pour
 * l'occasion rouvre la session (`session/load`) ; son rejeu devient un fil, construit avec le
 * réducteur partagé, puis l'agent est arrêté. Rien n'est envoyé au modèle.
 */
import type { AgentStatus } from '@shared/agent'
import { emptyTranscript, reduceTranscript, type TranscriptItem } from '@shared/transcript'
import { AgentHost, type AgentHostOptions } from './agent-host'
import { t } from 'i18next'
import { delay } from '../delay'

export interface ReplayOptions extends Pick<
  AgentHostOptions,
  'profile' | 'workspace' | 'clientVersion' | 'credentials'
> {
  sessionId: string
  /** Délai pour ouvrir la session (défaut : 30 s). */
  timeoutMs?: number
  /** Attente après l'ouverture : un agent peut rejouer après sa réponse (Bob 2.0.6). */
  settleMs?: number
}

/** États où l'ouverture est finie, réussie ou non. */
const SETTLED: ReadonlySet<AgentStatus> = new Set([
  'ready',
  'read-only',
  'error',
  'exited',
  'needs-action'
])

/** Fil rejoué de la session ; erreur si l'agent ne la rouvre pas ou ne la rejoue pas. */
export async function replaySession(options: ReplayOptions): Promise<TranscriptItem[]> {
  const { sessionId, timeoutMs = 30_000, settleMs = 300, ...hostOptions } = options
  let transcript = emptyTranscript
  let settle: (outcome: { status: AgentStatus; detail?: string }) => void = () => {}
  const opened = new Promise<{ status: AgentStatus; detail?: string }>((resolve) => {
    settle = resolve
  })
  const host = new AgentHost({
    ...hostOptions,
    reopen: { sessionId },
    emit: (event) => {
      transcript = reduceTranscript(transcript, event)
      if (event.type === 'status' && SETTLED.has(event.snapshot.status)) {
        settle({ status: event.snapshot.status, detail: event.snapshot.detail })
      }
    }
  })
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<{ status: AgentStatus; detail?: string }>((resolve) => {
    timer = setTimeout(
      () => resolve({ status: 'error', detail: t('subagentWork.timeout') }),
      timeoutMs
    )
  })
  try {
    void host.start()
    const outcome = await Promise.race([opened, timeout])
    if (outcome.status !== 'ready') {
      throw new Error(outcome.detail ?? t('subagentWork.notReopened'))
    }
    await delay(settleMs)
    if (transcript.items.length === 0) throw new Error(t('subagentWork.empty'))
    return transcript.items
  } finally {
    clearTimeout(timer)
    host.stop()
  }
}
