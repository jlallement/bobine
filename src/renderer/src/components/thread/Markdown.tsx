import { memo, useRef, type ComponentProps } from 'react'
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'
import '../../syntax.css'
import { CopyButton } from '../common/CopyButton'
import { MarkdownLink } from './FileLink'
import { MermaidBlock } from './MermaidBlock'
import { useTranslation } from 'react-i18next'
import { rehypeKnownLanguage, rehypeRememberLanguage, textOf } from './code-language'

/** Nœud de l'arbre HTML produit par le Markdown (hast), juste ce qu'il faut ici. */
interface HastNode {
  type?: string
  tagName?: string
  value?: string
  properties?: { className?: unknown }
  children?: HastNode[]
}

/** Code d'un bloc ` ```mermaid ` (fiche 063), ou `undefined` pour un autre bloc. */
export function mermaidSource(pre: unknown): string | undefined {
  const code = (pre as HastNode | undefined)?.children?.find((c) => c.tagName === 'code')
  const classes = code?.properties?.className
  if (!code || !Array.isArray(classes) || !classes.includes('language-mermaid')) return undefined
  return textOf(code).replace(/\n$/, '')
}

/** Bloc de code avec un bouton « Copier » (texte tel qu'affiché, sans la coloration). */
export function CodeBlock({ node, ...props }: ComponentProps<'pre'> & { node?: unknown }) {
  const { t } = useTranslation()
  const pre = useRef<HTMLPreElement>(null)
  const mermaid = mermaidSource(node)
  if (mermaid !== undefined) return <MermaidBlock source={mermaid} />
  return (
    <div className="code-block">
      <pre ref={pre} {...props} />
      <CopyButton
        text={() => pre.current?.innerText.replace(/\n$/, '') ?? ''}
        label={t('markdown.copyCode')}
        className="code-copy"
        testId="copy-code"
      />
    </div>
  )
}

/** Tableau dans un cadre qui défile : un tableau large ne déborde pas du fil. */
function Table({ node: _node, ...props }: ComponentProps<'table'> & { node?: unknown }) {
  return (
    <div className="table-wrap" data-testid="markdown-table">
      <table {...props} />
    </div>
  )
}

/**
 * Rendu Markdown (GFM + coloration). Mémoïsé : seul le message en cours se re-rend en streaming.
 * `streaming` : réponse en cours, son bloc de code encore ouvert n'est pas coloré (fiche 192).
 */
export const Markdown = memo(function Markdown({
  text,
  streaming = false
}: {
  text: string
  streaming?: boolean
}) {
  return (
    <div className="markdown">
      <ReactMarkdown
        // Liens `file://` gardés : ils désignent un fichier (fiche 052) ; le reste comme d'habitude.
        urlTransform={(url) => (/^file:/i.test(url) ? url : defaultUrlTransform(url))}
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          [rehypeKnownLanguage, { source: text, streaming }],
          [rehypeHighlight, { detect: true, ignoreMissing: true }],
          rehypeRememberLanguage
        ]}
        components={{
          // Liens de fichiers ouverts par l'app (fiche 052), liens web dans le navigateur système.
          a: MarkdownLink,
          pre: CodeBlock,
          table: Table
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
})
