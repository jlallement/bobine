/**
 * Titre d'une carte finie d'après les outils qu'elle a appelés (fiche 293, lot 3) : « figma ·
 * whoami », « Cherche parmi les outils de figma », plusieurs outils à la suite (au plus trois
 * distincts, puis « +N » appels), « (échec) » après un appel qui n'a pas réussi. Les noms viennent
 * de l'agent et d'un serveur tiers (fichier d'un dépôt, serveur MCP) : ce sont des données, montrées
 * comme telles, chacune dans un `<code>`, le séparateur « · » toujours hors des `<code>` ; déjà
 * bornés et nettoyés (`shared/called-tools.ts` : ni espace ni point médian dans un nom), raccourcis
 * ici à l'écran, entiers au survol. React les écrit en texte, jamais en HTML.
 */
import { Fragment } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { calledToolsTitle, type CalledTool, type CalledToolsMark } from '@shared/called-tools'
import { calledToolsTip, shownCalledName } from '@shared/called-tools-text'

/** Un nom (serveur ou outil) : une donnée, en `<code>`, entier au survol s'il est raccourci. */
function Name({ name, show }: { name: string; show: (text: string) => string }) {
  const shown = shownCalledName(name)
  return (
    <code className="tool-called-name" title={shown !== name ? show(name) : undefined}>
      {show(shown)}
    </code>
  )
}

function Call({
  tool,
  common,
  show
}: {
  tool: CalledTool
  /** Serveur dit une fois en tête du titre : pas répété ici. */
  common: boolean
  show: (text: string) => string
}) {
  const { t } = useTranslation()
  const failed = tool.failed && (
    <span className="tool-called-failed"> {t('toolCall.calledTools.failed')}</span>
  )
  if ('search' in tool) {
    return (
      <>
        {tool.server ? (
          <Trans
            t={t}
            i18nKey="toolCall.calledTools.search"
            values={{ server: tool.server }}
            components={{ code: <Name name={tool.server} show={show} /> }}
          />
        ) : (
          t('toolCall.calledTools.searchAny')
        )}
        {failed}
      </>
    )
  }
  return (
    <>
      {!common && tool.server && (
        <>
          <Name name={tool.server} show={show} />
          <span className="tool-called-sep"> · </span>
        </>
      )}
      <Name name={tool.tool} show={show} />
      {failed}
    </>
  )
}

export function CalledToolsTitle({
  mark,
  agentTitle,
  show
}: {
  mark: CalledToolsMark
  /** Titre donné par l'agent (« execute »), gardé en infobulle. */
  agentTitle: string
  /** Texte tel que l'app l'affiche (`useDisplayText`). */
  show: (text: string) => string
}) {
  const { t } = useTranslation()
  const { shown, more, server } = calledToolsTitle(mark)
  return (
    <span title={show(calledToolsTip(mark, agentTitle))} data-testid="tool-called">
      {server && (
        <>
          <Name name={server} show={show} />
          <span className="tool-called-sep"> · </span>
        </>
      )}
      {shown.map((tool, i) => (
        <Fragment key={i}>
          {i > 0 && ', '}
          <Call tool={tool} common={!!server && !('search' in tool)} show={show} />
        </Fragment>
      ))}
      {more > 0 && (
        <span className="tool-called-more">{` ${t('toolCall.calledTools.more', { n: more })}`}</span>
      )}
    </span>
  )
}
