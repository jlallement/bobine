/**
 * Ce que l'agent décrit à sa façon dans ses mises à jour, remis en forme générique d'après son
 * profil (ADR-0015) avant que l'hôte ne les trie : diffs manquants (`diffSource`, fiches 096, 202),
 * échecs d'outils (`toolStatus`, fiche 122), outils appelés par du code (`calledTools`, fiche
 * 293), sous-agents (`subagentFormat`, fiche 140). Avant
 * tout, ce qui est générique : le diff de la demande d'autorisation (fiche 202), les fichiers
 * nouveaux d'après le disque quand l'outil est proposé (`new-files.ts`, fiche 203).
 */
import type { ToolCallLocation, SessionUpdate, ToolCallUpdate } from '../../shared/acp-sdk.mts'
import { calledToolsMark, withCalledTools, withoutCalledTools } from '@shared/called-tools'
import type { AgentProfile } from './profiles'
import { SubagentMarker } from './subagent-marks'
import { existsOnDisk, noteProposedFiles, withNewFiles, type FileExists } from './new-files'
import { ToolCallMemory, withPermissionDiffs } from './tool-call-memory'

/** Ce que l'adaptation reprend du profil (l'hôte passe le profil entier, le rejeu une partie). */
export type UpdateAdapters = Pick<
  AgentProfile,
  'diffSource' | 'toolStatus' | 'calledTools' | 'subagentFormat'
>

/** Fin d'un appel d'outil : il n'y a plus rien à compléter. */
const ENDED = new Set(['completed', 'failed', 'cancelled'])

/** Outil proposé, pas encore lancé (ACP : un `tool_call` sans état est en attente). */
function isProposed(
  update: SessionUpdate
): update is Extract<SessionUpdate, { sessionUpdate: 'tool_call' | 'tool_call_update' }> {
  if (update.sessionUpdate === 'tool_call') return (update.status ?? 'pending') === 'pending'
  return update.sessionUpdate === 'tool_call_update' && update.status === 'pending'
}

export class ProfileUpdates {
  private readonly profile: UpdateAdapters
  private readonly workspace: string
  private readonly marker: SubagentMarker
  private readonly calls = new ToolCallMemory()
  /**
   * Nom annoncé par le `tool_call` de chaque carte en cours (champ `name` hors ACP, sinon le titre) :
   * seule une carte vue dès son début sous le nom déclaré par `calledTools` est marquée.
   */
  private readonly started = new Map<string, string>()
  private readonly exists: FileExists

  constructor(profile: UpdateAdapters, workspace: string, exists: FileExists = existsOnDisk) {
    this.profile = profile
    this.workspace = workspace
    this.exists = exists
    this.marker = new SubagentMarker(profile.subagentFormat)
  }

  /**
   * La mise à jour de l'agent, complétée et marquée. `live` faux pendant le rejeu de
   * `session/load` : un outil rejoué parle du passé, le disque d'aujourd'hui n'en dit rien.
   */
  adapt(update: SessionUpdate, live = true): SessionUpdate {
    const { diffSource, toolStatus, calledTools } = this.profile
    const soFar = this.calls.note(update)
    if (live && soFar && isProposed(update)) noteProposedFiles(soFar, update, this.exists)
    // Générique d'abord (le diff de la demande d'autorisation, les fichiers nouveaux), puis ce
    // que l'agent dit à sa façon.
    const kept = withNewFiles(withPermissionDiffs(update, soFar), soFar)
    const completed = diffSource?.complete(kept, this.workspace, soFar) ?? kept
    if (
      (update.sessionUpdate === 'tool_call' || update.sessionUpdate === 'tool_call_update') &&
      update.status &&
      ENDED.has(update.status)
    ) {
      this.calls.forget(update.toolCallId)
    }
    // Outils nommés par l'agent à la fin de la carte (fiche 293) : marque générique, bornée et
    // nettoyée ici (ce sont des données d'un tiers) ; celle qu'enverrait l'agent est retirée.
    const corrected = withoutCalledTools(toolStatus?.correct(completed) ?? completed)
    const called =
      calledTools && this.startedAs(update, calledTools.toolName)
        ? calledTools.read(update)
        : undefined
    const mark = called && calledToolsMark(called.tools, called.total)
    return this.marker.mark(mark ? withCalledTools(corrected, mark) : corrected)
  }

  /**
   * Appel d'outil d'une demande d'autorisation (l'outil n'a pas tourné : ses fichiers sont
   * regardés), ses fichiers nouveaux dits, marqué s'il lance un sous-agent.
   */
  permission(toolCall: ToolCallUpdate): ToolCallUpdate {
    const soFar = this.calls.notePermission(toolCall)
    noteProposedFiles(soFar, toolCall, this.exists)
    const marked = this.marker.markPermission(withNewFiles(toolCall, soFar))
    // Genre annoncé plus tôt (`tool_call`) quand la demande n'en porte pas (fiche 223).
    return marked.kind || !soFar.kind ? marked : { ...marked, kind: soFar.kind }
  }

  /**
   * Emplacements annoncés par le `tool_call` d'une demande qui n'en porte pas (Bob 2.1.0, fiche
   * 224) : pour la seule décision d'écriture d'une discussion. La demande montrée reste telle que
   * l'agent l'a envoyée (son libellé, sa notification).
   */
  knownLocations(toolCallId: string): ToolCallLocation[] | undefined {
    return this.calls.locationsOf(toolCallId)
  }

  /**
   * La carte de cette mise à jour a-t-elle été annoncée sous le nom `name` ? Le nom est retenu au
   * `tool_call`, oublié à la fin : une carte dont on n'a pas vu le début n'est jamais marquée.
   */
  private startedAs(update: SessionUpdate, name: string): boolean {
    if (update.sessionUpdate === 'tool_call') {
      const announced = (update as { name?: unknown }).name
      if (update.status && ENDED.has(update.status)) this.started.delete(update.toolCallId)
      else {
        this.started.set(
          update.toolCallId,
          typeof announced === 'string' ? announced : (update.title ?? '')
        )
      }
      return false
    }
    if (update.sessionUpdate !== 'tool_call_update') return false
    const seen = this.started.get(update.toolCallId) === name
    if (update.status && ENDED.has(update.status)) this.started.delete(update.toolCallId)
    return seen
  }

  /** Nouvelle session ou agent arrêté. */
  clear(): void {
    this.started.clear()
    this.marker.clear()
    this.calls.clear()
  }
}
