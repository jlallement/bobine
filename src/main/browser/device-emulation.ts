/**
 * Taille d'écran et thème de la page du navigateur intégré, en deux couches (fiche 295, ADR-0078) :
 * le **réglage de l'utilisateur**, par conversation (tous ses onglets, nouveaux compris), et
 * l'**essai de l'agent** (`browser_resize`), par onglet, jusqu'à la fin de son tour. Ce qui
 * s'applique est calculé ici (`appliedSettings`, pur) ; seul ce module le pose par le CDP.
 *
 * Aucun état caché : `CdpTab.emulation` et `CdpTab.colorScheme` sont ce que Chromium a pris
 * (notés après sa réponse) ; l'état de l'interface les lit tels quels. Les poses d'un onglet passent
 * une à une dans une file, et chaque passage recalcule ce qui doit s'appliquer au moment où il
 * part : une demande arrivée pendant un passage en fait un autre, et plusieurs demandes en attente
 * n'en font qu'un (sonde S9 : l'ordre des réponses du CDP est sûr, pas la page remise en page). Un
 * échec laisse l'onglet « à reposer en entier » au passage suivant.
 *
 * Rien n'est écrit sur le disque : la mémoire dure jusqu'à la fermeture de la conversation ou de
 * l'app (fiche 295, question 4).
 */
import type {
  BrowserAgentTrial,
  BrowserBounds,
  BrowserColorScheme,
  BrowserDeviceRequest,
  BrowserEmulation,
  BrowserState
} from '@shared/browser'
import { appliedSettings, emulationFrame, sameEmulation } from './page-view'

/** Ce que le moteur demande à un onglet : son CDP (`CdpTab`). */
export interface EmulationTarget {
  cdp: {
    emulation: BrowserEmulation | undefined
    colorScheme: BrowserColorScheme | undefined
    emulate(emulation: BrowserEmulation | undefined): Promise<void>
    setColorScheme(scheme: BrowserColorScheme | undefined): Promise<void>
  }
}

export interface DeviceEmulationHost {
  /** Zone du navigateur de la conversation (pixels de la fenêtre) ; `undefined` : il n'existe plus. */
  area(conversationId: string): BrowserBounds | undefined
  /** Ce qui est posé sur un onglet a changé : reposer les vues, émettre l'état. */
  changed(conversationId: string): void
}

/** Ce qui doit être posé sur un onglet : écran réduit pour tenir dans la zone, thème. */
export interface WantedEmulation {
  emulation?: BrowserEmulation
  colorScheme?: BrowserColorScheme
}

/** Partie de l'état de l'interface que ce module tient (voir `BrowserState`). */
export type DeviceView = Pick<
  BrowserState,
  'emulation' | 'colorScheme' | 'device' | 'agent' | 'control'
>

/**
 * File des poses d'un onglet : un passage à la fois ; une demande faite pendant qu'un passage
 * attend son tour le rejoint (il recalculera tout en partant).
 */
class TabQueue {
  private tail: Promise<void> = Promise.resolve()
  private waiting: Promise<void> | undefined

  request(job: () => Promise<void>): Promise<void> {
    if (this.waiting) return this.waiting
    const run = this.tail.then(() => {
      this.waiting = undefined
      return job()
    })
    this.waiting = run
    this.tail = run.then(
      () => {},
      () => {}
    )
    return run
  }

  /** Toutes les poses demandées jusqu'ici sont passées (jamais rejetée). */
  settled(): Promise<void> {
    return this.tail
  }
}

export class DeviceEmulation<T extends EmulationTarget> {
  private readonly devices = new Map<string, BrowserDeviceRequest>()
  private readonly trials = new WeakMap<T, BrowserAgentTrial>()
  private readonly queues = new WeakMap<T, TabQueue>()
  /** Onglets dont une pose a échoué : tout est reposé au passage suivant. */
  private readonly dirty = new WeakSet<T>()
  private readonly host: DeviceEmulationHost

  constructor(host: DeviceEmulationHost) {
    this.host = host
  }

  /** Réglage de l'utilisateur pour la conversation ; `undefined` : barre fermée. */
  device(conversationId: string): BrowserDeviceRequest | undefined {
    return this.devices.get(conversationId)
  }

  setDevice(conversationId: string, device: BrowserDeviceRequest | undefined): void {
    if (device) this.devices.set(conversationId, device)
    else this.devices.delete(conversationId)
  }

  /** Conversation fermée : son réglage s'en va avec elle. */
  forget(conversationId: string): void {
    this.devices.delete(conversationId)
  }

  /** Essai de l'agent sur l'onglet ; `undefined` : aucun. */
  trial(tab: T): BrowserAgentTrial | undefined {
    const trial = this.trials.get(tab)
    if (!trial || (trial.screen === undefined && trial.colorScheme === undefined)) return undefined
    return trial
  }

  setTrial(tab: T, patch: BrowserAgentTrial): void {
    this.trials.set(tab, { ...this.trials.get(tab), ...patch })
  }

  /** Efface l'essai de l'agent (ou seulement sa taille) ; vrai s'il y avait quelque chose. */
  clearTrial(tab: T, only?: 'screen'): boolean {
    const trial = this.trial(tab)
    if (!trial) return false
    if (only === 'screen') {
      if (trial.screen === undefined) return false
      const { screen: _screen, ...rest } = trial
      this.trials.set(tab, rest)
      return true
    }
    this.trials.delete(tab)
    return true
  }

  /** Ce qui doit être posé sur l'onglet maintenant, réduit pour tenir dans `area`. */
  wanted(conversationId: string, tab: T, area: BrowserBounds): WantedEmulation {
    const applied = appliedSettings(this.devices.get(conversationId), this.trial(tab))
    return {
      ...(applied.screen ? { emulation: emulationFrame(area, applied.screen).emulation } : {}),
      ...(applied.colorScheme ? { colorScheme: applied.colorScheme } : {})
    }
  }

  /**
   * Pose sur l'onglet ce qui doit s'appliquer (rien si c'est déjà posé). Rejetée si le CDP refuse
   * (onglet fermé…) ; l'état dit alors ce qui a vraiment été pris.
   */
  sync(conversationId: string, tab: T): Promise<void> {
    let queue = this.queues.get(tab)
    if (!queue) {
      queue = new TabQueue()
      this.queues.set(tab, queue)
    }
    return queue.request(() => this.reconcile(conversationId, tab))
  }

  /** Les poses demandées pour l'onglet sont passées (jamais rejetée). */
  settled(tab: T): Promise<void> {
    return this.queues.get(tab)?.settled() ?? Promise.resolve()
  }

  /** Ce que l'état de l'interface dit de l'onglet : posé (CDP), couches, qui a la main. */
  view(conversationId: string, tab: T): DeviceView {
    const device = this.devices.get(conversationId)
    const agent = this.trial(tab)
    const { control } = appliedSettings(device, agent)
    const emulation = tab.cdp.emulation
    const colorScheme = tab.cdp.colorScheme
    return {
      ...(emulation ? { emulation } : {}),
      ...(colorScheme ? { colorScheme } : {}),
      ...(device ? { device: { ...device } } : {}),
      ...(agent ? { agent: copyTrial(agent) } : {}),
      ...(control ? { control } : {})
    }
  }

  private async reconcile(conversationId: string, tab: T): Promise<void> {
    const area = this.host.area(conversationId)
    if (!area) return
    const wanted = this.wanted(conversationId, tab, area)
    const force = this.dirty.has(tab)
    let touched = false
    try {
      if (force || !sameEmulation(tab.cdp.emulation, wanted.emulation)) {
        touched = true
        await tab.cdp.emulate(wanted.emulation)
      }
      if (force || tab.cdp.colorScheme !== wanted.colorScheme) {
        touched = true
        await tab.cdp.setColorScheme(wanted.colorScheme)
      }
      this.dirty.delete(tab)
    } catch (error) {
      this.dirty.add(tab)
      throw error
    } finally {
      if (touched) this.host.changed(conversationId)
    }
  }
}

function copyTrial(trial: BrowserAgentTrial): BrowserAgentTrial {
  const { screen, colorScheme } = trial
  return {
    ...(screen !== undefined ? { screen: screen === 'panel' ? 'panel' : { ...screen } } : {}),
    ...(colorScheme !== undefined ? { colorScheme } : {})
  }
}
