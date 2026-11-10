/**
 * Infos techniques de la fenêtre À propos (fiche 116), à copier pour un signalement. En anglais
 * et non traduites : elles partent dans une issue GitHub, comme le journal (ADR-0014).
 */
import type { ProfileSummary } from '@shared/agent'

export interface TechnicalFacts {
  name: string
  version: string
  build: { date: string; commit: string }
  versions: { electron: string; chrome: string; node: string }
  /** Version de macOS (`process.getSystemVersion()`), ex. `26.0`. */
  os: string
  arch: string
  /** Langue de l'interface. */
  language: string
  /** Agents connus de l'app ; seuls ceux qui sont installés sont cités. */
  agents: Pick<ProfileSummary, 'label' | 'available' | 'capabilities'>[]
}

export function technicalInfo(facts: TechnicalFacts): string {
  const agents = facts.agents.filter((agent) => agent.available)
  const lines = [
    `${facts.name} ${facts.version} (commit ${facts.build.commit}, built ${facts.build.date})`,
    `Electron ${facts.versions.electron}`,
    `Chromium ${facts.versions.chrome}`,
    `Node ${facts.versions.node}`,
    `macOS ${facts.os} (${facts.arch})`,
    `Interface language: ${facts.language}`,
    `Agents: ${agents.length ? '' : 'none installed'}`.trimEnd(),
    ...agents.map((agent) => {
      const version = agent.capabilities.announced?.version
      return `- ${agent.label} ${version ?? 'version unknown (not started yet)'}`
    })
  ]
  return lines.join('\n')
}
