import { Fragment } from 'react'
import { CopyButton } from './CopyButton'
import '../../safe-boundary.css'

/**
 * Message de l'app qui cite une commande à taper (fiche 194) : entre accents graves dans le texte
 * (« tapez `xcode-select --install` »), elle s'affiche en code, avec un bouton « Copier ». Le reste
 * du texte est rendu tel quel.
 */
export function CommandText({ text }: { text: string }) {
  const parts = text.split('`')
  // Un nombre pair de morceaux : accent grave orphelin, rien n'est pris pour une commande.
  if (parts.length < 3 || parts.length % 2 === 0) return <>{text}</>
  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 0 ? (
          <Fragment key={index}>{part}</Fragment>
        ) : (
          <span key={index} className="command-text">
            <code>{part}</code>
            <CopyButton text={() => part} testId="copy-command" />
          </span>
        )
      )}
    </>
  )
}
