/**
 * Boîtes JavaScript d'une page (`alert`, `confirm`, `prompt`, `beforeunload`) : Electron les montre
 * sur la fenêtre de l'app, et la page est bloquée jusqu'à la réponse de l'utilisateur. Une commande
 * du protocole DevTools vers la page attend alors sans fin (relevé à l'essai réel de la fiche 097 :
 * `browser_click` sans réponse pendant douze minutes).
 *
 * Les outils du navigateur ne les attendent donc jamais : une commande échoue tout de suite tant
 * qu'une boîte est ouverte, et une action qui en ouvre une rend la main. L'agent apprend ce que la
 * page attend, puis ce que l'utilisateur a répondu (en anglais, ADR-0014). L'app ne répond pas à sa
 * place : répondre par le protocole laisse la boîte d'Electron affichée (relevé sur Electron 44.7).
 */

/** Une boîte de la page : son type (`alert`, `confirm`, `prompt`, `beforeunload`) et son texte. */
export interface PageDialog {
  type: string
  message: string
}

/** Réponse de l'utilisateur à une boîte de la page. */
export interface DialogAnswer extends PageDialog {
  accepted: boolean
  /** Texte saisi (`prompt`). */
  input?: string
}

const MAX_QUOTED = 200

const quoted = (text: string) => {
  const line = text.replace(/\s+/g, ' ').trim()
  return line.length > MAX_QUOTED ? `${line.slice(0, MAX_QUOTED - 1)}…` : line
}

/** Ce que l'agent apprend d'une boîte ouverte (résultat ou erreur d'un outil). */
export function dialogOpenText(dialog: PageDialog): string {
  return (
    `The page is showing a ${dialog.type} dialog: "${quoted(dialog.message)}". It blocks the ` +
    'page until the user answers it in Bobine: no browser tool can act on this tab until then, ' +
    'and you cannot answer it yourself. Do something else or end your turn (ask the user if ' +
    'needed): a later browser tool result will tell you what they answered.'
  )
}

/** Ce que l'agent apprend de la réponse de l'utilisateur. */
export function dialogAnswerText(answer: DialogAnswer): string {
  const choice = !answer.accepted
    ? 'Cancel'
    : answer.type === 'prompt'
      ? `OK, with "${quoted(answer.input ?? '')}"`
      : 'OK'
  return `Note: the user answered the page's ${answer.type} dialog "${quoted(answer.message)}": ${choice}.`
}

/** Une boîte de la page est ouverte : la commande n'a pas pu aboutir. */
export class PageDialogOpen extends Error {
  readonly dialog: PageDialog

  constructor(dialog: PageDialog) {
    super(dialogOpenText(dialog))
    this.dialog = dialog
  }
}

/** Boîtes d'un onglet, d'après les évènements `Page.javascriptDialog*` du protocole. */
export class DialogWatch {
  /** Boîte ouverte, qui bloque la page. */
  current: PageDialog | undefined
  /** Boîte ouverte ou fermée : la conversation attend l'utilisateur, ou plus (liste, fiche 024). */
  onChange: ((dialog: PageDialog | undefined) => void) | undefined
  private answers: DialogAnswer[] = []
  private readonly waiters = new Set<(dialog: PageDialog) => void>()

  opened(params: Record<string, unknown>): void {
    const dialog = {
      type: String(params['type'] ?? 'alert'),
      message: String(params['message'] ?? '')
    }
    this.current = dialog
    for (const waiter of [...this.waiters]) waiter(dialog)
    this.onChange?.(dialog)
  }

  closed(params: Record<string, unknown>): void {
    const dialog = this.current
    this.current = undefined
    if (dialog) {
      const input = params['userInput']
      this.answers.push({
        ...dialog,
        accepted: params['result'] === true,
        ...(typeof input === 'string' && input ? { input } : {})
      })
    }
    this.onChange?.(undefined)
  }

  /** Réponses données depuis la dernière lecture, à dire à l'agent. */
  takeAnswers(): DialogAnswer[] {
    return this.answers.splice(0)
  }

  /**
   * Commande vers la page : refusée tout de suite si une boîte est ouverte, abandonnée si une
   * boîte s'ouvre pendant qu'elle attend (la page ne répondra qu'après).
   */
  guard<T>(command: () => Promise<T>): Promise<T> {
    if (this.current) return Promise.reject(new PageDialogOpen(this.current))
    return new Promise<T>((resolve, reject) => {
      const onOpen = (dialog: PageDialog) => reject(new PageDialogOpen(dialog))
      this.waiters.add(onOpen)
      command()
        .then(resolve, reject)
        .finally(() => this.waiters.delete(onOpen))
    })
  }

  /**
   * Action de l'agent (clic, touche…) : si une boîte s'ouvre pendant l'action, l'action a eu lieu
   * et c'est elle qui l'a ouverte. Seule une boîte déjà ouverte avant l'empêche.
   */
  async through<T>(action: () => Promise<T>, fallback: T): Promise<T> {
    const before = this.current
    try {
      return await action()
    } catch (error) {
      if (error instanceof PageDialogOpen && !before) return fallback
      throw error
    }
  }
}
