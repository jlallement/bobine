/**
 * Tour de table dans la saisie (fiche 285, maquettes `lancement-*`, `premier-usage`) : la saisie
 * passe en tour de table par `/roundtable ` ou par le bouton de la barre ; la ligne du tour dit avec
 * qui et combien de jetons ; Entrée envoie, ou ouvre le menu des participants tant qu'il en manque.
 *
 * Le dernier choix du menu est retenu dans la préférence `roundtableParticipants`, à chaque case.
 * Le main fait autorité : il lit les agents et les places (`roundtable:options`) et refuse un tour
 * qui ne peut pas partir (`roundtable:start`) ; son refus s'affiche dans la ligne, la question
 * tapée reste dans la saisie.
 */
import i18next from 'i18next'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { PromptAttachment } from '@shared/attachments'
import type { AgentCommand } from '@shared/agent'
import { appCommandOf } from '@shared/app-commands'
import { toggleChoice, type RoundtableChoice } from '@shared/roundtable'
import type { RoundtableOptions, RoundtableStartResult } from '@shared/roundtable-ipc'
import { ipcErrorText } from '../../ipc-errors'
import { enterAction, lineState, type LineState, type MenuEntry } from './roundtable-view'
import { onRoundtableMenuRequest } from './roundtable-menu-request'

/** Ce que l'app donne à la saisie pour le tour de table (absent : pas de tour de table ici). */
export interface ComposerRoundtable {
  /** Participants retenus (dernier choix du menu, préférence `roundtableParticipants`). */
  participants: readonly RoundtableChoice[]
  /** Retient un nouveau choix (préférence de l'app, pour ce tour et les suivants). */
  setParticipants: (choices: RoundtableChoice[]) => void
}

const COMMAND = /^\/roundtable\s/

/** Texte d'un refus du main : ce qui empêche le tour de partir, dit en clair. */
export function refusalText(result: Extract<RoundtableStartResult, { ok: false }>): string {
  switch (result.error) {
    case 'selection':
      return i18next.t(`roundtable.error.selection.${result.problem ?? 'too-few'}`)
    case 'slots':
      return i18next.t('roundtable.error.slots', { count: result.missing ?? 1 })
    default:
      return i18next.t(`roundtable.error.${result.error}`)
  }
}

export function useRoundtableCompose({
  conversationId,
  config,
  enabled,
  focus
}: {
  conversationId: string | undefined
  config: ComposerRoundtable | undefined
  /** La commande est à l'app (ni l'agent ni l'utilisateur n'ont de `/roundtable`), hors Discussion. */
  enabled: boolean
  focus: () => void
}) {
  const usable = enabled && !!config && !!conversationId
  const [active, setActive] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [options, setOptions] = useState<RoundtableOptions | undefined>()
  // Choix fait ici, en attendant que la préférence revienne du main.
  const [local, setLocal] = useState<RoundtableChoice[] | undefined>()
  const [refusal, setRefusal] = useState<string | undefined>()
  const [sending, setSending] = useState(false)
  const choices = useMemo(() => local ?? config?.participants ?? [], [local, config?.participants])

  const reload = useCallback(() => {
    if (!conversationId) return
    window.api.roundtable
      .options(conversationId)
      .then(setOptions)
      // Pas encore d'options (main pas prêt) : la ligne s'en passe, le main dira à l'envoi.
      .catch(() => setOptions(undefined))
  }, [conversationId])

  // Options relues à l'entrée en tour de table, et à chaque ouverture du menu (places, agents).
  useEffect(() => {
    if (active) reload()
  }, [active, reload])
  useEffect(() => {
    if (menuOpen) reload()
  }, [menuOpen, reload])

  const enter = useCallback(() => {
    if (!usable) return
    setActive(true)
    setRefusal(undefined)
  }, [usable])
  const exit = useCallback(() => {
    setActive(false)
    setMenuOpen(false)
    setRefusal(undefined)
  }, [])

  // « Choisir un autre modèle » d'une carte du fil : la saisie passe en tour de table, menu ouvert.
  const latestEnter = useRef(enter)
  useLayoutEffect(() => {
    latestEnter.current = enter
  })
  useEffect(
    () =>
      onRoundtableMenuRequest(() => {
        latestEnter.current()
        setMenuOpen(true)
      }),
    []
  )

  const state: LineState = useMemo(() => lineState(choices, options), [choices, options])

  const toggle = (entry: Pick<MenuEntry, 'choice' | 'modelChoice'>) => {
    const next = toggleChoice(choices, entry.choice, entry.modelChoice)
    setLocal(next)
    setRefusal(undefined)
    config?.setParticipants(next)
  }

  /**
   * `/roundtable ` tapé (ou collé, ou choisi dans le menu « / ») : la saisie passe en tour de table
   * et garde le reste comme question. `undefined` : le texte n'est pas pour le tour de table.
   */
  const fromCommand = (value: string): string | undefined => {
    if (!usable || !COMMAND.test(value)) return undefined
    enter()
    return value.replace(COMMAND, '')
  }

  /**
   * Entrée en tour de table : envoie, ou ouvre le menu des participants. `true` : le tour est
   * parti, la saisie se vide ; `false` : la question reste (refus, menu, rien à envoyer).
   */
  const submit = async (question: string, attachments: PromptAttachment[]): Promise<boolean> => {
    if (!conversationId || sending) return false
    const action = enterAction(state)
    if (action === 'menu') {
      setMenuOpen(true)
      return false
    }
    if (action === 'none' || !question.trim()) return false
    setSending(true)
    setRefusal(undefined)
    try {
      const result = await window.api.roundtable.start(conversationId, {
        question: question.trim(),
        participants: [...choices],
        ...(attachments.length ? { attachments } : {})
      })
      if (!result.ok) {
        setRefusal(refusalText(result))
        reload()
        return false
      }
      setActive(false)
      setMenuOpen(false)
      return true
    } catch (error) {
      setRefusal(ipcErrorText(error))
      return false
    } finally {
      setSending(false)
      focus()
    }
  }

  return {
    usable,
    active,
    enter,
    exit,
    toggleMode: () => (active ? exit() : enter()),
    menuOpen,
    setMenuOpen,
    options,
    choices,
    state,
    toggle,
    refusal,
    sending,
    fromCommand,
    submit,
    /** Envoi possible (bouton Envoyer) : la ligne est prête et une question est tapée. */
    canSend: (hasText: boolean) => state.kind === 'ready' && hasText && !sending
  }
}

export type RoundtableCompose = ReturnType<typeof useRoundtableCompose>

/**
 * Le tour de table tel que la saisie s'en sert (sorti de `Composer`, taille bornée, fiche 089) : la
 * commande est à l'app (ni l'agent ni l'utilisateur n'ont de `/roundtable`), hors Discussion.
 */
export function useComposerRoundtable(
  props: {
    draftKey?: string | undefined
    discussion?: boolean | undefined
    roundtable?: ComposerRoundtable | undefined
  },
  c: {
    agentCommands: readonly AgentCommand[]
    ownCommands: readonly AgentCommand[]
    focusInput: () => void
  }
) {
  const rt = useRoundtableCompose({
    conversationId: props.draftKey,
    config: props.roundtable,
    enabled: !props.discussion && !!appCommandOf('/roundtable', c.agentCommands, c.ownCommands),
    focus: c.focusInput
  })
  return {
    ...rt,
    /** Texte tapé : `/roundtable ` passe en tour de table, la suite reste comme question. */
    typed: (value: string, caret: number | undefined): [string, number | undefined] => {
      const question = rt.fromCommand(value)
      return question === undefined ? [value, caret] : [question, question.length]
    },
    /** Entrée : le tour part (la saisie se vide), ou la question reste (refus, menu). */
    send: async (
      question: string,
      attachments: { toSend: () => PromptAttachment[]; clear: () => void },
      recordSent: (text: string) => void,
      changeText: (value: string, caret?: number) => void
    ) => {
      if (!(await rt.submit(question, attachments.toSend()))) return
      // Rappelé par ↑, le message repart en tour de table (fiche 227).
      recordSent(`/roundtable ${question}`)
      attachments.clear()
      changeText('', 0)
    },
    /** Bouton Envoyer : en tour de table, la ligne décide ; sinon, l'envoi ordinaire. */
    barSend: (text: string, ordinary: boolean) =>
      rt.active ? rt.canSend(text.trim().length > 0) : ordinary,
    /** Bouton de la barre (absent quand le tour de table n'est pas possible ici). */
    bar: rt.usable
      ? {
          roundtable: {
            active: rt.active,
            onToggle: () => {
              rt.toggleMode()
              c.focusInput()
            }
          }
        }
      : {}
  }
}
