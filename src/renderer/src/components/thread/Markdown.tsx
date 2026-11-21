import { memo, useRef, type ComponentProps } from 'react'
import ReactMarkdown, { defaultUrlTransform, type Options } from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'
import '../../syntax.css'
import { CopyButton } from '../common/CopyButton'
import { isPathNotScheme } from '@shared/file-links'
import { platformFeatures } from '../../platform-features'
import { MarkdownLink } from './FileLink'
import { rehypeInlineFileCode } from './inline-file-code'
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

/** Coloration des blocs de code (absente au-delà de la borne de l'onglet Fichiers). */
/** Adresse d'un lien : un fichier gardé tel quel, le reste nettoyé par react-markdown. */
function keepFileUrls(url: string): string {
  if (/^file:/i.test(url)) return url
  if (isPathNotScheme(url, { windowsPaths: platformFeatures().windowsPaths })) return url
  return defaultUrlTransform(url)
}

const COLORED: NonNullable<Options['rehypePlugins']> = [
  [rehypeHighlight, { detect: true, ignoreMissing: true }]
]

/**
 * Rendu Markdown (GFM + coloration). Mémoïsé : seul le message en cours se re-rend en streaming.
 * `streaming` : réponse en cours, son bloc de code encore ouvert n'est pas coloré (fiche 192).
 */
export const Markdown = memo(function Markdown({
  text,
  streaming = false,
  highlight = true
}: {
  text: string
  streaming?: boolean
  /** `false` : sans coloration (gros document de l'onglet Fichiers, même borne que la source). */
  highlight?: boolean
}) {
  return (
    <div className="markdown">
      <ReactMarkdown
        // Liens `file://` gardés : ils désignent un fichier (fiche 052), comme `liste.js:17`, qui a
        // l'air d'un schéma (fiche 271) ; le reste comme d'habitude.
        urlTransform={keepFileUrls}
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          [rehypeKnownLanguage, { source: text, streaming }],
          ...(highlight ? COLORED : []),
          rehypeRememberLanguage,
          // `fichier:ligne` en code : cliquable comme un lien de fichier (fiche 272).
          rehypeInlineFileCode
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
