/**
 * Titre d'une carte finie d'après les outils qu'elle a appelés (fiche 293, lot 3) : « figma ·
 * whoami », « Cherche parmi les outils de figma », plusieurs outils à la suite (au plus trois
 * distincts, puis « +N » appels). Texte et infobulle : `shared/called-tools-text.ts` ; ici, le
 * serveur est mis en retrait. Les noms viennent de l'agent et d'un serveur tiers, déjà bornés et
 * nettoyés (`shared/called-tools.ts`) ; React les écrit en texte, jamais en HTML.
 */
import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { calledToolsTitle, type CalledToolsMark } from '@shared/called-tools'
import { calledToolText, calledToolsTip } from '@shared/called-tools-text'

const Server = ({ name }: { name: string }) => (
  <span className="tool-called-server">{`${name} ·`}</span>
)

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
  // Re-rendu au changement de langue (les textes viennent de `t` d'i18next).
  const { t } = useTranslation()
  const { shown, more, server } = calledToolsTitle(mark)
  return (
    <span title={show(calledToolsTip(mark, agentTitle))} data-testid="tool-called">
      {server && (
        <>
          <Server name={show(server)} />{' '}
        </>
      )}
      {shown.map((tool, i) => (
        <Fragment key={i}>
          {i > 0 && ', '}
          {'search' in tool ? (
            show(calledToolText(tool))
          ) : (
            <>
              {!server && tool.server && (
                <>
                  <Server name={show(tool.server)} />{' '}
                </>
              )}
              {show(tool.tool)}
            </>
          )}
        </Fragment>
      ))}
      {more > 0 && (
        <span className="tool-called-more">{` ${t('toolCall.calledTools.more', { n: more })}`}</span>
      )}
    </span>
  )
}
