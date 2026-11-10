/**
 * Terminaux à côté de la conversation (fiche 034), comme ceux de Claude Desktop : des onglets de
 * shell dans le dossier de la conversation. Chaque onglet a un double `@xterm/headless` qui connaît
 * l'écran tel que l'utilisateur le voit : l'agent le lit, et un affichage ouvert plus tard s'en sert
 * pour se remettre à jour (ADR-0007).
 */
import { basename } from 'node:path'
import { SerializeAddon } from '@xterm/addon-serialize'
import { Terminal } from '@xterm/headless'
import type { TerminalCommand, TerminalTabInfo, TerminalsChange } from '@shared/terminal'
import { t } from 'i18next'

/** Pseudo-terminal (node-pty en vrai, faux en test). */
export interface Pty {
  readonly pid: number
  /** Programme au premier plan (`zsh`, `npm`, `vim`…). */
  readonly process: string
  onData: (listener: (data: string) => void) => void
  onExit: (listener: (exitCode: number) => void) => void
  write: (data: string) => void
  resize: (cols: number, rows: number) => void
  kill: () => void
}

export type SpawnPty = (
  shell: string,
  args: string[],
  options: { cols: number; rows: number; cwd: string; env: NodeJS.ProcessEnv }
) => Pty

const SCROLLBACK = 2000
const STARTUP_MS = 1000
/** Silence qui marque la fin d'une salve de sortie. */
const QUIET_MS = 400
/** « Arrêter » : délai laissé à Ctrl+C avant d'envoyer SIGTERM à la commande (fiche 166). */
const STOP_GRACE_MS = 2000
const SHELLS = new Set(['zsh', 'bash', 'sh', 'fish', 'dash', 'ksh', 'tcsh', 'csh', 'nu'])
const DEFAULT_SIZE = { cols: 100, rows: 30 }

interface Tab {
  id: string
  cwd: string
  pty: Pty
  screen: Terminal
  serializer: SerializeAddon
  /** Écritures en cours dans le double (l'écran n'est à jour qu'une fois finies). */
  pending: Promise<void>
  exitCode?: number
  /** Réveille ceux qui attendent une nouvelle sortie. */
  waiters: Set<() => void>
  createdAt: number
  disposed: boolean
  /** Ouvert par l'agent (`terminal_run`) : sans pager, et seul à recevoir ses commandes. */
  byAgent?: true
  /** Commande au premier plan, depuis quand l'app la voit (fiche 166). */
  command?: TerminalCommand
  /** Dernier état annoncé (titre, commande) : un changement prévient l'UI. */
  announced: string
  /** Second coup d'œil après une salve de sortie (voir `watch`). */
  recheck?: NodeJS.Timeout
}

/**
 * Commandes de l'agent sans pager (fiche 126) : `git log` ou `man` ne restent pas sur « (END) »
 * à attendre « q ». `GIT_PAGER` passe devant `core.pager` ; les onglets de l'utilisateur gardent
 * le sien.
 */
const AGENT_ENV = { PAGER: 'cat', GIT_PAGER: 'cat' }

export interface TerminalManagerOptions {
  spawn: SpawnPty
  shell?: string
  env?: () => NodeJS.ProcessEnv
  /** Sortie d'un onglet, pour l'affichage. */
  onData: (conversationId: string, tabId: string, data: string) => void
  /** Liste des onglets d'une conversation changée (ouverture, fermeture, titre, fin). */
  onChange: (change: TerminalsChange) => void
  /**
   * Envoie SIGTERM au groupe au premier plan du terminal de ce shell (`foreground.ts`) ; absent :
   * « Arrêter » s'en tient à Ctrl+C.
   */
  terminateForeground?: (shellPid: number) => Promise<void>
}

export class TerminalManager {
  private readonly conversations = new Map<string, { tabs: Map<string, Tab>; next: number }>()
  private readonly options: TerminalManagerOptions
  private readonly shell: string

  constructor(options: TerminalManagerOptions) {
    this.options = options
    this.shell = options.shell ?? process.env['SHELL'] ?? '/bin/zsh'
  }

  /**
   * Nouvel onglet : shell de connexion de l'utilisateur, dans le dossier de la conversation.
   * `byAgent` : ouvert pour une commande de l'agent (sans pager).
   */
  create(
    conversationId: string,
    cwd: string,
    size = DEFAULT_SIZE,
    byAgent = false
  ): TerminalTabInfo {
    const conversation = this.conversation(conversationId)
    const id = String(conversation.next++)
    const pty = this.options.spawn(this.shell, ['-l'], {
      ...size,
      cwd,
      env: {
        ...(this.options.env?.() ?? process.env),
        ...(byAgent ? AGENT_ENV : {}),
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
        TERM_PROGRAM: 'Bobine'
      }
    })
    const screen = new Terminal({ ...size, scrollback: SCROLLBACK, allowProposedApi: true })
    const serializer = new SerializeAddon()
    screen.loadAddon(serializer)
    const tab: Tab = {
      id,
      cwd,
      pty,
      screen,
      serializer,
      pending: Promise.resolve(),
      waiters: new Set(),
      createdAt: Date.now(),
      disposed: false,
      announced: '',
      ...(byAgent ? { byAgent: true as const } : {})
    }
    conversation.tabs.set(id, tab)
    pty.onData((data) => {
      if (tab.disposed) return
      tab.pending = tab.pending.then(() => new Promise<void>((done) => screen.write(data, done)))
      this.options.onData(conversationId, id, data)
      for (const wake of tab.waiters) wake()
      this.watch(conversationId, tab)
    })
    pty.onExit((exitCode) => {
      if (tab.disposed) return
      clearTimeout(tab.recheck)
      tab.exitCode = exitCode
      for (const wake of tab.waiters) wake()
      this.changed(conversationId)
    })
    this.changed(conversationId)
    return this.info(tab)
  }

  list(conversationId: string): TerminalTabInfo[] {
    return [...(this.conversations.get(conversationId)?.tabs.values() ?? [])].map((t) =>
      this.info(t)
    )
  }

  /** Frappe de l'utilisateur. */
  write(conversationId: string, tabId: string, data: string): void {
    this.tab(conversationId, tabId).pty.write(data)
  }

  resize(conversationId: string, tabId: string, cols: number, rows: number): void {
    const tab = this.tab(conversationId, tabId)
    if (tab.exitCode !== undefined) return
    tab.pty.resize(cols, rows)
    tab.screen.resize(cols, rows)
  }

  /** Image de l'écran et de l'historique, pour un affichage qui s'ouvre. */
  async snapshot(conversationId: string, tabId: string): Promise<string> {
    const tab = this.tab(conversationId, tabId)
    await tab.pending
    return tab.serializer.serialize({ scrollback: SCROLLBACK })
  }

  /**
   * Dernières lignes de l'écran, telles que l'utilisateur les voit (couleurs et effacements
   * appliqués). `waitMs` : attend d'abord une nouvelle sortie, au plus ce délai.
   */
  async read(conversationId: string, tabId: string, lines: number, waitMs = 0): Promise<string> {
    const tab = this.tab(conversationId, tabId)
    if (waitMs > 0) {
      // Attend une nouvelle sortie, puis que le terminal se calme (une compilation écrit par
      // à-coups), au plus `waitMs` en tout.
      await new Promise<void>((done) => {
        let quiet: NodeJS.Timeout | undefined
        const finish = () => {
          clearTimeout(limit)
          clearTimeout(quiet)
          tab.waiters.delete(onOutput)
          done()
        }
        const onOutput = () => {
          clearTimeout(quiet)
          quiet = setTimeout(finish, QUIET_MS)
        }
        const limit = setTimeout(finish, waitMs)
        tab.waiters.add(onOutput)
      })
    }
    await tab.pending
    const buffer = tab.screen.buffer.active
    const out: string[] = []
    for (let i = 0; i < buffer.length; i++)
      out.push(buffer.getLine(i)?.translateToString(true) ?? '')
    while (out.length && !out[out.length - 1]?.trim()) out.pop()
    return out.slice(-lines).join('\n')
  }

  /**
   * Lance une commande de l'agent dans un onglet : celui qu'il donne, sinon le premier des siens
   * qui est libre, sinon un nouveau (jamais un onglet de l'utilisateur pris d'office, fiche 126).
   */
  run(conversationId: string, cwd: string, command: string, tabId?: string): TerminalTabInfo {
    const tab = tabId
      ? this.tab(conversationId, tabId)
      : ([...(this.conversations.get(conversationId)?.tabs.values() ?? [])].find(
          (t) => t.byAgent && t.exitCode === undefined && !this.busy(t)
        ) ?? this.tab(conversationId, this.create(conversationId, cwd, DEFAULT_SIZE, true).id))
    if (tab.exitCode !== undefined) throw new Error(`Terminal ${tab.id} is closed`)
    tab.pty.write(`${command}\r`)
    return this.info(tab)
  }

  /** Ctrl+C dans l'onglet. */
  interrupt(conversationId: string, tabId: string): void {
    this.tab(conversationId, tabId).pty.write('\x03')
  }

  /**
   * « Arrêter » de l'onglet « Session » (fiche 166) : arrête la commande au premier plan, pas
   * l'onglet. Ctrl+C d'abord, comme au clavier ; si la même commande tourne encore
   * `STOP_GRACE_MS` plus tard (elle ignore Ctrl+C : `vim`, `tmux`…), SIGTERM à son groupe. Le
   * shell, son historique et l'écran restent. À l'invite : rien.
   */
  stop(conversationId: string, tabId: string): void {
    const tab = this.tab(conversationId, tabId)
    this.refresh(conversationId, tab)
    const command = tab.command
    if (!command) return
    tab.pty.write('\x03')
    const terminate = this.options.terminateForeground
    if (!terminate) return
    setTimeout(() => {
      if (tab.disposed || tab.exitCode !== undefined) return
      this.refresh(conversationId, tab)
      if (tab.command?.startedAt !== command.startedAt) return
      terminate(tab.pty.pid).catch(() => {
        // Plus de groupe au premier plan, ou `ps` absent : la commande reste, l'onglet le montre.
      })
    }, STOP_GRACE_MS).unref()
  }

  close(conversationId: string, tabId: string): void {
    const conversation = this.conversations.get(conversationId)
    const tab = conversation?.tabs.get(tabId)
    if (!conversation || !tab) return
    conversation.tabs.delete(tabId)
    this.dispose(tab)
    this.changed(conversationId)
  }

  /** Conversation supprimée : ses terminaux sont fermés. */
  closeConversation(conversationId: string): void {
    const conversation = this.conversations.get(conversationId)
    if (!conversation) return
    this.conversations.delete(conversationId)
    for (const tab of conversation.tabs.values()) this.dispose(tab)
  }

  closeAll(): void {
    for (const id of [...this.conversations.keys()]) this.closeConversation(id)
  }

  private conversation(conversationId: string) {
    let conversation = this.conversations.get(conversationId)
    if (!conversation) {
      conversation = { tabs: new Map(), next: 1 }
      this.conversations.set(conversationId, conversation)
    }
    return conversation
  }

  private tab(conversationId: string, tabId: string): Tab {
    const tab = this.conversations.get(conversationId)?.tabs.get(tabId)
    if (!tab) throw new Error(`Unknown terminal tab ${tabId} (see terminal_list)`)
    return tab
  }

  /** Un programme tourne au premier plan (pas un shell à l'invite). */
  private busy(tab: Tab): boolean {
    // Le shell démarre : le nom du programme est encore transitoire.
    if (Date.now() - tab.createdAt < STARTUP_MS) return false
    // node-pty peut ne rien rendre pendant qu'un programme se termine : rien n'est au premier plan.
    const current = tab.pty.process
    if (!current) return false
    const name = basename(current).replace(/^-/, '')
    // `/bin/sh` est bash sur macOS : tout shell connu compte comme l'invite.
    return name !== basename(this.shell) && !SHELLS.has(name)
  }

  /**
   * Suit la commande au premier plan : son début est le premier moment où l'app la voit ; un
   * autre nom est une autre commande (`sleep 5; vim`).
   */
  private follow(tab: Tab): void {
    const name =
      tab.exitCode === undefined && this.busy(tab) ? basename(tab.pty.process) : undefined
    if (!name) delete tab.command
    else if (tab.command?.name !== name) tab.command = { name, startedAt: Date.now() }
  }

  /** Relit la commande au premier plan ; prévient l'UI si le titre ou la commande ont changé. */
  private refresh(conversationId: string, tab: Tab): void {
    if (tab.disposed) return
    this.follow(tab)
    const state = `${this.title(tab)}\n${tab.command?.startedAt ?? ''}`
    if (state === tab.announced) return
    tab.announced = state
    this.changed(conversationId)
  }

  /**
   * À chaque sortie : relecture tout de suite, et une seconde fois après `QUIET_MS` de silence (ou
   * la fin du démarrage du shell). La commande ne prend souvent le premier plan qu'après l'écho de
   * la touche Entrée (`sleep 30` n'écrit rien d'autre) ; la fin, elle, réécrit l'invite. Pas de
   * relecture périodique : sans sortie, rien ne change au premier plan qui ne soit déjà vu.
   */
  private watch(conversationId: string, tab: Tab): void {
    this.refresh(conversationId, tab)
    clearTimeout(tab.recheck)
    const delay = Math.max(QUIET_MS, tab.createdAt + STARTUP_MS - Date.now() + 50)
    tab.recheck = setTimeout(() => this.refresh(conversationId, tab), delay)
    tab.recheck.unref()
  }

  private title(tab: Tab): string {
    if (tab.exitCode !== undefined) return t('terminal.ended')
    return tab.command?.name ?? (basename(tab.cwd) || tab.cwd)
  }

  private info(tab: Tab): TerminalTabInfo {
    this.follow(tab)
    return {
      id: tab.id,
      title: this.title(tab),
      cwd: tab.cwd,
      busy: !!tab.command,
      startedAt: tab.createdAt,
      ...(tab.command ? { command: { ...tab.command } } : {}),
      ...(tab.exitCode !== undefined ? { exitCode: tab.exitCode } : {})
    }
  }

  private dispose(tab: Tab): void {
    tab.disposed = true
    clearTimeout(tab.recheck)
    if (tab.exitCode === undefined) {
      try {
        tab.pty.kill()
      } catch {
        // Déjà terminé.
      }
    }
    tab.screen.dispose()
    for (const wake of tab.waiters) wake()
  }

  private changed(conversationId: string): void {
    this.options.onChange({ conversationId, tabs: this.list(conversationId) })
  }
}
