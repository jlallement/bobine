import * as Dialog from '@radix-ui/react-dialog'
import { CodeXml, Maximize2, Workflow, X } from 'lucide-react'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { CopyButton } from '../common/CopyButton'
import { useTranslation } from 'react-i18next'
import i18next from 'i18next'
import { messageOf } from '@shared/errors'
import { subscribeTheme, themeKey } from '../../theme'

/** Le texte doit s'être posé (streaming) avant d'essayer de le dessiner. */
const SETTLE_MS = 400
/** Une erreur n'est montrée que si le texte ne bouge plus : pas de clignotement en streaming. */
const ERROR_SETTLE_MS = 1100

const load = () => import('../../mermaid-render')

/** Thème de l'app : clair ou sombre, variante (Sépia, Nuit noire), accent — pour redessiner. */
function useThemeKey(): string {
  return useSyncExternalStore(subscribeTheme, themeKey)
}

/** L'erreur de Mermaid en une ligne : où (« Parse error on line 3: »), puis ce qu'il attendait. */
export function mermaidError(error: unknown): string {
  const lines = messageOf(error)
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  const [first = i18next.t('mermaid.unknownError')] = lines
  const last = lines.at(-1)
  return lines.length > 1 && last && !/^-*\^$/.test(last) ? `${first} ${last}` : first
}

/**
 * Bloc ` ```mermaid ` (fiche 063) : dessiné quand le texte s'est posé, le dernier dessin réussi
 * gardé pendant le streaming ; invalide, le code reste affiché avec l'erreur.
 */
export function MermaidBlock({ source }: { source: string }) {
  const { t } = useTranslation()
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showCode, setShowCode] = useState(false)
  const theme = useThemeKey()

  useEffect(() => {
    let cancelled = false
    let errorTimer: ReturnType<typeof setTimeout> | undefined
    const timer = setTimeout(() => {
      load()
        .then((m) => m.renderMermaid(source))
        .then(
          (drawn) => {
            if (cancelled) return
            setSvg(drawn)
            setError(null)
          },
          (e: unknown) => {
            if (cancelled) return
            errorTimer = setTimeout(() => {
              if (cancelled) return
              setSvg(null)
              setError(mermaidError(e))
            }, ERROR_SETTLE_MS)
          }
        )
    }, SETTLE_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
      clearTimeout(errorTimer)
    }
  }, [source, theme])

  const diagram = svg !== null && !showCode
  return (
    <div
      className="mermaid-block"
      data-testid="mermaid-block"
      data-state={error ? 'error' : svg ? 'drawn' : 'pending'}
    >
      {diagram ? (
        <div
          className="mermaid-diagram"
          data-testid="mermaid-diagram"
          // SVG produit par Mermaid en niveau strict, nettoyé par DOMPurify.
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <pre className="mermaid-code">
          <code className="hljs">{source}</code>
        </pre>
      )}
      {error && (
        <div className="mermaid-error" data-testid="mermaid-error">
          {t('mermaid.invalid', { error })}
        </div>
      )}
      <div className="mermaid-actions">
        {svg !== null && (
          <button
            type="button"
            className="icon-button small"
            onClick={() => setShowCode((v) => !v)}
            title={showCode ? t('mermaid.showDiagram') : t('mermaid.showCode')}
            aria-label={showCode ? t('mermaid.showDiagram') : t('mermaid.showCode')}
            data-testid="mermaid-toggle"
          >
            {showCode ? <Workflow size={13} /> : <CodeXml size={13} />}
          </button>
        )}
        {svg !== null && <Zoom svg={svg} />}
        <CopyButton text={() => source} label={t('mermaid.copyCode')} testId="mermaid-copy" />
      </div>
    </div>
  )
}

/** Le diagramme en grand, dans une fenêtre (il défile s'il dépasse). */
function Zoom({ svg }: { svg: string }) {
  const { t } = useTranslation()
  return (
    <Dialog.Root>
      <Dialog.Trigger
        className="icon-button small"
        title={t('mermaid.enlarge')}
        aria-label={t('mermaid.enlargeLabel')}
        data-testid="mermaid-zoom"
      >
        <Maximize2 size={13} />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog mermaid-zoom" data-testid="mermaid-zoom-dialog">
          <Dialog.Title className="sr-only">{t('mermaid.dialogTitle')}</Dialog.Title>
          <Dialog.Description className="sr-only">
            {t('mermaid.dialogDescription')}
          </Dialog.Description>
          <Dialog.Close className="icon-button mermaid-zoom-close" aria-label={t('common.close')}>
            <X size={16} />
          </Dialog.Close>
          <div className="mermaid-zoom-body" dangerouslySetInnerHTML={{ __html: svg }} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
