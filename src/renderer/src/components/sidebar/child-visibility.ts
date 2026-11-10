import { useLayoutEffect, useRef, type RefObject } from 'react'
import type { ConversationSummary } from '@shared/agent'
import type { ChildLaunch } from '@shared/children'
import { familyRoot, projectOf } from './history-order'

export const launchRowId = (id: string) => `child-launch:${id}`

/** Projections de présentation, jamais persistées ni envoyées aux commandes de conversation. */
export function withChildLaunches(
  conversations: readonly ConversationSummary[],
  launches: readonly ChildLaunch[]
): ConversationSummary[] {
  const byId = new Map(conversations.map((c) => [c.id, c]))
  const rows = launches.flatMap((launch): ConversationSummary[] => {
    const mother = byId.get(launch.motherId)
    if (!mother || mother.archived || (launch.conversationId && byId.has(launch.conversationId)))
      return []
    return [
      {
        id: launchRowId(launch.id),
        title: launch.title,
        profileId: mother.profileId,
        profileLabel: mother.profileLabel,
        workspace: mother.workspace,
        ...(mother.project ? { project: mother.project } : {}),
        updatedAt: mother.updatedAt,
        status: 'starting',
        pinned: false,
        draft: false,
        startedFrom: { id: mother.id, title: mother.title }
      }
    ]
  })
  return [...rows, ...conversations]
}

/** Les replis restent gardés au redémarrage ; seul un nouveau lancement révèle sa famille. */
export function useChildVisibility(
  conversations: readonly ConversationSummary[],
  launches: readonly ChildLaunch[],
  unfoldSections: (ids: readonly string[]) => void,
  unfoldFolders: (ids: readonly string[]) => void,
  list: RefObject<HTMLDivElement | null>
): void {
  const seen = useRef(new Set(conversations.map((c) => c.id)))
  const initialized = useRef(conversations.length > 0)
  const seenLaunches = useRef(new Set<string>())
  const target = useRef<string | null>(null)
  useLayoutEffect(() => {
    const created = initialized.current
      ? conversations.filter((c) => c.startedFrom && !c.archived && !seen.current.has(c.id))
      : []
    if (conversations.length) initialized.current = true
    seen.current = new Set(conversations.map((c) => c.id))
    const fresh = launches.filter((launch) => !seenLaunches.current.has(launch.id))
    seenLaunches.current = new Set(launches.map((launch) => launch.id))
    const byId = new Map(conversations.map((c) => [c.id, c]))
    const mothers = fresh.flatMap((launch) => {
      const mother = byId.get(launch.motherId)
      return mother && !mother.archived ? [mother] : []
    })
    const reveal = [...created, ...mothers]
    if (!reveal.length) return
    const roots = reveal.map((c) => familyRoot(c, conversations))
    unfoldSections(roots.map((c) => (c.pinned ? 'pinned' : 'history')))
    unfoldFolders(roots.map(projectOf))
    const lastLaunch = fresh.at(-1)
    target.current = lastLaunch
      ? (lastLaunch.conversationId ?? launchRowId(lastLaunch.id))
      : (created.at(-1)?.id ?? null)
  }, [conversations, launches, unfoldSections, unfoldFolders])
  useLayoutEffect(() => {
    if (!target.current) return
    const row = [...(list.current?.querySelectorAll<HTMLElement>('[data-id]') ?? [])].find(
      (item) => item.dataset.id === target.current
    )
    if (row) {
      row.scrollIntoView?.({ block: 'nearest' })
      target.current = null
    }
  })
}
