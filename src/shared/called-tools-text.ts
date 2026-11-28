/**
 * Textes du titre d'une carte d'après les outils qu'elle a appelés (fiche 293, lot 3), dans la
 * langue courante : le texte brut du titre (essais, lecteurs) et de son infobulle. Le fil
 * (`CalledToolsTitle.tsx`) affiche les mêmes morceaux, chaque nom dans un `<code>`.
 */
import { t } from 'i18next'
import { calledToolsTitle, type CalledTool, type CalledToolsMark } from './called-tools'

/** Au-delà, un nom est raccourci à l'écran (`…`) ; entier dans l'infobulle. */
export const SHOWN_CALLED_NAME = 24

/** Nom tel que le titre le montre : raccourci par la fin au-delà de `SHOWN_CALLED_NAME`. */
export function shownCalledName(name: string): string {
  const chars = [...name]
  return chars.length > SHOWN_CALLED_NAME
    ? `${chars.slice(0, SHOWN_CALLED_NAME - 1).join('')}…`
    : name
}

/** Texte d'une clé dont les noms sont balisés `<code>` (sans les balises). */
const plain = (text: string) => text.replace(/<\/?code>/g, '')

/** Un appel en texte : « serveur · outil », l'outil seul, ou la recherche ; « (échec) » s'il a échoué. */
export function calledToolText(
  tool: CalledTool,
  shorten: (name: string) => string = (n) => n
): string {
  const name =
    'search' in tool
      ? tool.server
        ? plain(t('toolCall.calledTools.search', { server: shorten(tool.server) }))
        : t('toolCall.calledTools.searchAny')
      : tool.server
        ? `${shorten(tool.server)} · ${shorten(tool.tool)}`
        : shorten(tool.tool)
  return tool.failed ? `${name} ${t('toolCall.calledTools.failed')}` : name
}

/**
 * Titre en texte, tel qu'affiché : au plus trois outils distincts, le serveur dit une fois s'ils
 * l'ont tous en commun (« figma · a, b »), noms raccourcis, puis « +N » appels.
 */
export function calledToolsText(mark: CalledToolsMark): string {
  const { shown, more, server } = calledToolsTitle(mark)
  const parts = shown.map((tool) =>
    server && !('search' in tool)
      ? calledToolText({ ...tool, server: undefined } as CalledTool, shownCalledName)
      : calledToolText(tool, shownCalledName)
  )
  const head = `${server ? `${shownCalledName(server)} · ` : ''}${parts.join(', ')}`
  return more > 0 ? `${head} ${t('toolCall.calledTools.more', { n: more })}` : head
}

/** Infobulle : le titre de l'agent et le nombre d'appels, puis chaque outil distinct en entier. */
export function calledToolsTip(mark: CalledToolsMark, agentTitle: string): string {
  const lines = [...new Set(mark.tools.map((tool) => calledToolText(tool)))]
  const calls = t('toolCall.calledTools.calls', { count: mark.total })
  return [`${agentTitle} · ${calls}`, ...lines].join('\n')
}
