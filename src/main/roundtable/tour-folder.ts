/**
 * Dossier changé pendant le recueil ou la réplique d'un tour de table (passe de contrôle, S1) :
 * un fait du tour, pas de chaque participant. Empreinte du dossier avant l'envoi des questions
 * (ou des répliques), comparée quand l'étape finit ; quelques fichiers lus dans `git status`.
 * L'attribution à une place reste au garde-fou de lecture seule (`ChangeFacts.attributable`).
 *
 * Suivi en mémoire seulement : perdu au redémarrage, comme le reste du garde-fou.
 */
import type { RoundtableEvent } from '@shared/roundtable'
import type { FolderBaseline, StepFolder } from './step-folder'

type Stage = 'collecting' | 'rebuttal'

export class TourFolder {
  private readonly folder: StepFolder | undefined
  private readonly baselines = new Map<string, Promise<FolderBaseline | undefined>>()
  private readonly checks = new Map<string, Promise<void>>()

  constructor(folder: StepFolder | undefined) {
    this.folder = folder
  }

  /** Avant l'envoi : empreinte de départ ; résolue quand elle est prise (ne lève jamais). */
  async begin(roundtableId: string, stage: Stage, workspace: string): Promise<void> {
    if (!this.folder) return
    const baseline = this.folder.baseline(workspace).catch(() => undefined)
    this.baselines.set(`${roundtableId}:${stage}`, baseline)
    await baseline
  }

  /** Étape finie : le dossier a-t-il changé ? `apply` reçoit l'évènement du tour. */
  end(roundtableId: string, stage: Stage, apply: (event: RoundtableEvent) => void): void {
    const key = `${roundtableId}:${stage}`
    const baseline = this.baselines.get(key)
    this.baselines.delete(key)
    const folder = this.folder
    if (!baseline || !folder) return
    const done = baseline
      .then((before) => (before ? folder.changes(before) : undefined))
      .then((files) => {
        if (files) apply({ type: 'folder-changed', stage, files })
      })
      .catch(() => {})
    this.checks.set(roundtableId, done)
    void done.finally(() => {
      if (this.checks.get(roundtableId) === done) this.checks.delete(roundtableId)
    })
  }

  /** Comparaison en cours finie (la demande de synthèse ou de décision la dit). */
  settled(roundtableId: string): Promise<void> {
    return this.checks.get(roundtableId) ?? Promise.resolve()
  }

  forget(roundtableId: string): void {
    for (const stage of ['collecting', 'rebuttal'] as const)
      this.baselines.delete(`${roundtableId}:${stage}`)
  }
}
