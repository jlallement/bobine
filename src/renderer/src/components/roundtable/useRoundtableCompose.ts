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
import { saveDraft } from '../../drafts'
import { ipcErrorText } from '../../ipc-errors'
import {
  enterAction,
  inMenuOrder,
  lineState,
  type LineState,
  type MenuEntry
} from './roundtable-view'
import { onRoundtableMenuRequest } from './roundtable-menu-request'

/** Ce que l'app donne à la saisie pour le tour de table (absent : pas de tour de table ici). */
export interface ComposerRoundtable {
  /** Participants retenus (dernier choix du menu, préférence `roundtableParticipants`). */
  participants: readonly RoundtableChoice[]
  /** Retient un nouveau choix (préférence de l'app, pour ce tour et les suivants). */
  setParticipants: (choices: RoundtableChoice[]) => void
  /** Un tour est en cours ici : ni bouton ni `/roundtable` jusqu'à sa synthèse (B11). */
  running?: boolean
}

const COMMAND = /^\/roundtable\s/
/** Un Échap qui suit la fermeture du menu de moins que ça est celui du menu (B10). */
const ESCAPE_AFTER_MENU_MS = 500

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
  focus,
  questionChars = 0
}: {
  conversationId: string | undefined
  config: ComposerRoundtable | undefined
  /** La commande est à l'app (ni l'agent ni l'utilisateur n'ont de `/roundtable`), hors Discussion. */
  enabled: boolean
  focus: () => void
  /** Longueur de la question tapée : au-delà de la borne, la ligne le dit avant l'envoi. */
  questionChars?: number
}) {
  const usable = enabled && !!config && !!conversationId
  const [active, setActive] = useState(false)
  const [menuOpen, setMenuOpenState] = useState(false)
  // Fermeture du menu : un second Échap tout de suite après ne retire pas le mode (B10).
  const closedAt = useRef(0)
  const setMenuOpen = useCallback((open: boolean) => {
    if (!open) closedAt.current = Date.now()
    setMenuOpenState(open)
  }, [])
  const [options, setOptions] = useState<RoundtableOptions | undefined>()
  // Choix fait ici, en attendant que la préférence revienne du main.
  const [local, setLocal] = useState<RoundtableChoice[] | undefined>()
  const [refusal, setRefusal] = useState<string | undefined>()
  const [sending, setSending] = useState(false)
  const choices = useMemo(() => local ?? config?.participants ?? [], [local, config?.participants])

  // Lectures concurrentes (entrée, ouverture du menu, refus) : seule la dernière compte.
  const request = useRef(0)
  const reload = useCallback(() => {
    if (!conversationId) return
    const asked = ++request.current
    const keep = (value: RoundtableOptions | undefined) => {
      if (asked === request.current) setOptions(value)
    }
    window.api.roundtable
      .options(conversationId)
      .then(keep)
      // Pas encore d'options (main pas prêt) : la ligne s'en passe, le main dira à l'envoi.
      .catch(() => keep(undefined))
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
    // Déjà en tour de table (menu rouvert, commande retapée) : les options sont relues quand même.
    reload()
  }, [usable, reload])
  const exit = useCallback(() => {
    setActive(false)
    setMenuOpen(false)
    setRefusal(undefined)
  }, [setMenuOpen])

  // « Choisir un autre modèle » d'une carte du fil : la saisie passe en tour de table, menu ouvert.
  // Sans tour possible ici (Discussion, commande prise par l'agent), le menu ne s'arme pas.
  const latest = useRef({ enter, usable })
  useLayoutEffect(() => {
    latest.current = { enter, usable }
  })
  useEffect(
    () =>
      onRoundtableMenuRequest(() => {
        if (!latest.current.usable) return
        latest.current.enter()
        setMenuOpen(true)
      }),
    [setMenuOpen]
  )

  const state: LineState = useMemo(
    () => lineState(choices, options, questionChars),
    [choices, options, questionChars]
  )

  /** Options relues tout de suite (avant d'envoyer sur un refus peut-être dépassé). */
  const fresh = async (): Promise<LineState> => {
    if (!conversationId) return state
    const asked = ++request.current
    try {
      const read = await window.api.roundtable.options(conversationId)
      if (asked === request.current) setOptions(read)
      return lineState(choices, read, questionChars)
    } catch {
      return state
    }
  }

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
    if (!usable || config?.running || !COMMAND.test(value)) return undefined
    enter()
    return value.replace(COMMAND, '')
  }

  /**
   * Entrée en tour de table : envoie, ou ouvre le menu des participants. `true` : le tour est
   * parti, la saisie se vide ; `false` : la question reste (refus, menu, rien à envoyer).
   */
  const submit = async (question: string, attachments: PromptAttachment[]): Promise<boolean> => {
    if (!conversationId || sending) return false
    // Un refus lu plus tôt (tour en cours depuis fini, places libérées) : relu avant de conclure.
    const current = state.kind === 'refused' || state.kind === 'slots' ? await fresh() : state
    const action = enterAction(current)
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
        // L'ordre des cases du menu, pas celui des clics : la carte le garde (B16).
        participants: inMenuOrder(choices, options),
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
    focus,
    enter,
    exit,
    toggleMode: () => (active ? exit() : enter()),
    /** Échap dans la saisie : retire le mode, sauf juste après la fermeture du menu (B10). */
    escape: () => {
      if (Date.now() - closedAt.current < ESCAPE_AFTER_MENU_MS) return
      exit()
    },
    blocked: !!config?.running,
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
    /** Le texte de la saisie, pour ne vider que la question partie (revue QA). */
    text: string
    /** Brouillon : repris en tour de table, et gardé sous la forme `/roundtable …`. */
    draft: { startActive: boolean; setPrefix: (prefix: string) => void; adopt: () => void }
  }
) {
  const rt = useRoundtableCompose({
    conversationId: props.draftKey,
    config: props.roundtable,
    enabled: !props.discussion && !!appCommandOf('/roundtable', c.agentCommands, c.ownCommands),
    focus: c.focusInput,
    questionChars: c.text.trim().length
  })
  const text = useRef(c.text)
  useLayoutEffect(() => {
    text.current = c.text
  })
  const { setPrefix, adopt, startActive } = c.draft
  // Brouillon `/roundtable …` : repris en tour de table dès que celui-ci est utilisable ici (options
  // et commandes connues) ; sinon le texte garde son préfixe (N3).
  const pending = useRef(startActive)
  const { usable, enter } = rt
  useLayoutEffect(() => {
    if (!pending.current || !usable) return
    pending.current = false
    adopt()
    enter()
  }, [usable, adopt, enter])
  useEffect(() => {
    if (!pending.current) setPrefix(rt.active ? '/roundtable ' : '')
  }, [rt.active, setPrefix])
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
      attachments: {
        items: readonly { id: string }[]
        toSend: () => PromptAttachment[]
        remove: (id: string) => void
      },
      recordSent: (text: string) => void,
      changeText: (value: string, caret?: number) => void
    ) => {
      const sent = attachments.items.map((a) => a.id)
      const payload = attachments.toSend()
      const key = props.draftKey
      // Le tour posé dans le fil peut remonter la saisie (accueil d'une conversation vide → fil) :
      // le brouillon ne doit pas la rouvrir en tour de table avec la question déjà partie.
      if (key) saveDraft(key, { text: '', attachments: [] })
      if (!(await rt.submit(question, payload))) {
        // Refusé : le brouillon redevient ce qui est dans la saisie.
        if (key) saveDraft(key, { text: `/roundtable ${text.current}`, attachments: payload })
        return
      }
      // Rappelé par ↑, le message repart en tour de table (fiche 227).
      recordSent(`/roundtable ${question}`)
      // Pendant l'envoi, l'utilisateur a pu écrire ou joindre autre chose : seul ce qui est parti
      // quitte la saisie.
      for (const id of sent) attachments.remove(id)
      if (text.current === question) changeText('', 0)
    },
    /** Bouton Envoyer : en tour de table, la ligne décide ; sinon, l'envoi ordinaire. */
    barSend: (text: string, ordinary: boolean) =>
      rt.active ? rt.canSend(text.trim().length > 0) : ordinary,
    /** Bouton de la barre (absent quand le tour de table n'est pas possible ici). */
    bar: rt.usable
      ? {
          roundtable: {
            active: rt.active,
            blocked: rt.blocked && !rt.active,
            onToggle: () => {
              rt.toggleMode()
              c.focusInput()
            }
          }
        }
      : {}
  }
}
