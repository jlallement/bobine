/**
 * Textes du titre d'une carte d'après les outils qu'elle a appelés (fiche 293, lot 3), dans la
 * langue courante : le même texte pour le fil (`CalledToolsTitle.tsx`, qui en met le serveur en
 * retrait) et pour les essais du main qui rejouent une trace réelle.
 */
import { t } from 'i18next'
import { calledToolsTitle, type CalledTool, type CalledToolsMark } from './called-tools'

/** Un appel en texte : « serveur · outil », l'outil seul, ou la recherche. */
export function calledToolText(tool: CalledTool): string {
  if ('search' in tool) {
    return tool.server
      ? t('toolCall.calledTools.search', { server: tool.server })
      : t('toolCall.calledTools.searchAny')
  }
  return tool.server ? `${tool.server} · ${tool.tool}` : tool.tool
}

/**
 * Titre en texte : au plus trois outils distincts, le serveur dit une fois s'ils l'ont tous en
 * commun (« figma · a, b »), puis « +N » appels.
 */
export function calledToolsText(mark: CalledToolsMark): string {
  const { shown, more, server } = calledToolsTitle(mark)
  const parts = shown.map((tool) =>
    server && !('search' in tool) ? tool.tool : calledToolText(tool)
  )
  const head = `${server ? `${server} · ` : ''}${parts.join(', ')}`
  return more > 0 ? `${head} ${t('toolCall.calledTools.more', { n: more })}` : head
}

/** Infobulle : le titre de l'agent et le nombre d'appels, puis chaque outil distinct, un par ligne. */
export function calledToolsTip(mark: CalledToolsMark, agentTitle: string): string {
  const lines = [...new Set(mark.tools.map(calledToolText))]
  const calls = t('toolCall.calledTools.calls', { count: mark.total })
  return [`${agentTitle} · ${calls}`, ...lines].join('\n')
}
