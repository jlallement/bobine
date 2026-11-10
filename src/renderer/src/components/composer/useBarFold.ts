import { useLayoutEffect, useRef, useState } from 'react'

/**
 * Repli de la barre de saisie quand la place manque (fiche 092) : une étape après l'autre, au lieu
 * de puces qui rétrécissent toutes ensemble jusqu'à « c… », « GP… ».
 *
 * 0 : tout est là ; 1 : la capture passe dans le menu de 📎 ; 2 : la consommation ne garde que son
 * anneau ; 3 : le mode ne garde que son icône. Au-delà, le modèle se tronque, puis l'agent.
 * 4 (conversation très étroite, que même cela ne suffit pas à loger) : la barre passe sur deux
 * lignes (outils, puis consommation, modèle, agent et envoi) plutôt que de pousser le bouton
 * d'envoi hors de la fenêtre.
 */
export const MAX_FOLD = 3
export const WRAPPED = 4

/** Premier niveau auquel la barre tient (le dernier sinon). */
export function fitFold(fits: (level: number) => boolean): number {
  for (let level = 0; level < MAX_FOLD; level++) if (fits(level)) return level
  return MAX_FOLD
}

/** Largeur minimale du modèle, puis au plus serré. */
const MODEL_MIN = 110
const MODEL_TIGHT = 56
/** Icône de l'agent, à la place de son nom quand la place manque (`.agent-chip-icon`). */
const AGENT_ICON = 14

export interface Squeeze {
  /** Largeurs minimales du modèle et de l'agent. */
  model: number
  agent: number
  /** L'agent n'a plus que son icône et son chevron (son nom est dans l'infobulle). */
  agentIcon: boolean
  fits: boolean
}

/**
 * Largeurs minimales du modèle et de l'agent, d'après leur largeur entière et ce qui dépasse au
 * dernier niveau de repli. Le modèle cède d'abord (jusqu'à 110 px, jamais plus que son nom). L'agent
 * ne se tronque jamais (fiche 185, D26) : son nom entier, ou son icône et son chevron, jamais un bout
 * de nom ni un chevron seul. Ensuite le modèle descend encore, jusqu'à 56 px.
 */
export function squeeze(
  model: number,
  agent: { width: number; label: number },
  overflow: number
): Squeeze {
  const minModel = Math.min(MODEL_MIN, model)
  const deficit = overflow - (model - minModel)
  if (deficit <= 0) return { model: minModel, agent: agent.width, agentIcon: false, fits: true }
  const icon = agent.label > 0 ? agent.width - agent.label + AGENT_ICON : agent.width
  const left = deficit - (agent.width - icon)
  const tight = Math.min(MODEL_TIGHT, minModel)
  return {
    model: Math.max(tight, minModel - Math.max(0, left)),
    agent: icon,
    agentIcon: icon < agent.width,
    fits: left <= minModel - tight
  }
}

/**
 * Niveau de repli de la barre (à poser sur elle avec la référence rendue). Mesuré quand sa largeur
 * change et quand son contenu change (nom du modèle, du mode, de l'agent, bouton Arrêter…). La
 * mesure se fait dans le DOM, sans rendu : `data-measure` empêche tout rétrécissement, et
 * `data-fold` prend chaque niveau jusqu'à ce que la barre tienne. Le CSS fait le reste, avec les
 * minimums du modèle et de l'agent (`--model-min`, `--agent-min`) et `data-agent-icon`.
 */
export function useBarFold() {
  const bar = useRef<HTMLDivElement>(null)
  const [fold, setFold] = useState(0)
  useLayoutEffect(() => {
    const el = bar.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const width = (selector: string) => el.querySelector<HTMLElement>(selector)?.offsetWidth ?? 0
    const measure = () => {
      const shown = el.dataset.fold
      el.dataset.measure = ''
      delete el.dataset.agentIcon
      const folded = fitFold((candidate) => {
        el.dataset.fold = String(candidate)
        return el.scrollWidth <= el.clientWidth
      })
      // Le dernier niveau n'a pas été essayé : ce qui dépasse s'y mesure.
      el.dataset.fold = String(folded)
      const model = width('.model-chip')
      const agent = { width: width('.agent-chip'), label: width('.agent-chip .chip-label') }
      let level = folded
      let result = squeeze(model, agent, el.scrollWidth - el.clientWidth)
      if (!result.fits) {
        // Sur deux lignes : la seconde (consommation, modèle, agent, envoi) se calcule seule.
        level = WRAPPED
        result = squeeze(model, agent, width('.composer-bar-end') - el.clientWidth)
      }
      el.style.setProperty('--model-min', `${result.model}px`)
      el.style.setProperty('--agent-min', `${result.agent}px`)
      if (result.agentIcon) el.dataset.agentIcon = ''
      delete el.dataset.measure
      if (shown === undefined) delete el.dataset.fold
      else el.dataset.fold = shown
      setFold(level)
    }
    // Largeur de la barre (fenêtre, panneau), avec une première mesure à l'observation.
    const resize = new ResizeObserver(measure)
    resize.observe(el)
    // Contenu : les attributs ne comptent pas (ceux de la mesure, entre autres).
    const content = new MutationObserver(measure)
    content.observe(el, { childList: true, characterData: true, subtree: true })
    // Polices chargées après coup : les noms changent de largeur sans que la barre change.
    void document.fonts?.ready.then(measure)
    return () => {
      resize.disconnect()
      content.disconnect()
    }
  }, [])
  return [bar, fold] as const
}
