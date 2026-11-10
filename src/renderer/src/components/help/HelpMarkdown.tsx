import { memo, type ComponentProps, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { GUIDE_IMAGES } from '../../help/guide-content'
import type { GuideLang } from '../../help/guide'
import { guideImageKey, resolveGuideLink, type GuideLink } from '../../help/links'
import { remarkFrenchSpaces, remarkGuideAnchors } from '../../help/remark-anchors'
import { CodeBlock } from '../thread/Markdown'

interface Props {
  text: string
  lang: GuideLang
  page: string
  /** Lien vers une page de l'aide, ou vers les Nouveautés. */
  onLink: (link: Exclude<GuideLink, { kind: 'external' } | { kind: 'none' }>) => void
}

/**
 * Page du guide (fiche 186) : Markdown sans HTML brut (`skipHtml`, seules les ancres
 * `<a id>` sont lues, par `remarkGuideAnchors`) ni adresse inconnue : chaque lien est résolu par
 * `resolveGuideLink`, chaque image doit être une image embarquée du guide.
 */
export const HelpMarkdown = memo(function HelpMarkdown({ text, lang, page, onLink }: Props) {
  const Link = ({ href, children }: ComponentProps<'a'> & { node?: unknown }): ReactNode => {
    const link = resolveGuideLink(href ?? '', lang, page)
    if (link.kind === 'none') return <span>{children}</span>
    if (link.kind === 'external') {
      // Ouvert dans le navigateur du système (`setWindowOpenHandler`, http(s) seulement).
      return (
        <a href={link.url} target="_blank" rel="noreferrer">
          {children}
        </a>
      )
    }
    return (
      <a
        href="#"
        onClick={(event) => {
          event.preventDefault()
          onLink(link)
        }}
      >
        {children}
      </a>
    )
  }
  const Image = ({ src, alt }: ComponentProps<'img'> & { node?: unknown }): ReactNode => {
    const key = typeof src === 'string' ? guideImageKey(src, lang, page) : undefined
    const url = key ? GUIDE_IMAGES[key] : undefined
    return url ? <img src={url} alt={alt ?? ''} loading="lazy" /> : null
  }
  const Table = ({ node: _node, ...props }: ComponentProps<'table'> & { node?: unknown }) => (
    <div className="table-wrap">
      <table {...props} />
    </div>
  )
  return (
    <div className="markdown help-markdown">
      <ReactMarkdown
        skipHtml
        // Adresses gardées telles quelles : `Link` et `Image` décident de chacune.
        urlTransform={(url) => url}
        remarkPlugins={
          lang === 'fr'
            ? [remarkGfm, remarkGuideAnchors, remarkFrenchSpaces]
            : [remarkGfm, remarkGuideAnchors]
        }
        // Blocs de code comme dans le fil : fond, marge, bouton « Copier ».
        components={{ a: Link, img: Image, table: Table, pre: CodeBlock }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
})
