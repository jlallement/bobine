/**
 * Dessin des diagrammes Mermaid (fiche 063). Chargé à la demande (`import()`) avec Mermaid : rien
 * n'est chargé tant qu'aucun diagramme n'apparaît. Niveau de sécurité strict (texte échappé, ni
 * clics ni liens actifs, SVG nettoyé) ; couleurs tirées des jetons du thème (fiche 134).
 */
import mermaid from 'mermaid'
import { currentTokens } from './theme'

/** Réglages appliqués la dernière fois (le thème de l'app peut changer entre deux dessins). */
let configured = ''
/** Mermaid ne dessine qu'un diagramme à la fois. */
let queue: Promise<unknown> = Promise.resolve()
let counter = 0

/** Variables du thème `base` de Mermaid, tirées des jetons du thème affiché (fiche 134). */
function themeVariables(): Record<string, string | boolean> {
  const t = currentTokens()
  const font = getComputedStyle(document.documentElement).getPropertyValue('--font-ui').trim()
  return {
    darkMode: t.scheme === 'dark',
    background: t.surface,
    primaryColor: t.surface2,
    primaryTextColor: t.text,
    primaryBorderColor: t.borderStrong,
    secondaryColor: t.surface3,
    tertiaryColor: t.surface,
    lineColor: t.muted,
    textColor: t.text,
    // Étiquettes des flèches : sur le fond du cadre (noires par défaut en sombre).
    edgeLabelBackground: t.surface,
    clusterBkg: t.surface2,
    clusterBorder: t.borderStrong,
    noteBkgColor: t.surface3,
    noteTextColor: t.text,
    fontFamily: font || 'system-ui, sans-serif',
    fontSize: '14px'
  }
}

/** SVG du diagramme ; lève l'erreur de Mermaid si le texte n'en est pas un. */
export function renderMermaid(source: string): Promise<string> {
  const run = async () => {
    const vars = themeVariables()
    const key = JSON.stringify(vars)
    if (key !== configured) {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        // Mermaid 12 (fiche 143) : rendu d'avant gardé (allure classique, mise en page dagre) ;
        // ses nouveaux défauts (`neo`, ELK) changeraient les diagrammes sans rien apporter ici.
        look: 'classic',
        layout: 'dagre',
        theme: 'base',
        themeVariables: vars,
        fontFamily: String(vars['fontFamily'])
      })
      configured = key
    }
    const id = `mermaid-${++counter}`
    try {
      const { svg } = await mermaid.render(id, source)
      return svg
    } finally {
      // Après une erreur, Mermaid laisse son brouillon dans la page.
      document.getElementById(id)?.remove()
      document.getElementById(`d${id}`)?.remove()
    }
  }
  const result = queue.then(run, run)
  queue = result.catch(() => undefined)
  return result
}
