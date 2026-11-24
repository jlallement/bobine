import { beforeAll, describe, expect, it } from 'vitest'
import styles from './styles.css?raw'

/**
 * Règles de la feuille de style que jsdom ne met pas en page mais lit (cascade) : remplacent les
 * vérifications de composant de `e2e/suites/composer.mjs` n° 8 (infobulle qui ne prend pas le
 * pointeur), n° 36 (« réduire les animations ») et n° 17, 19, 24 (ce que montre chaque niveau de repli ;
 * le niveau lui-même est mesuré par `useBarFold`, essayé dans `useBarFold.test.ts`). Le vrai clic à travers une infobulle reste à
 * `parcours-matinee` (étape 11).
 */

/** Règles de style, à plat (celles des `@media` comprises, avec leur condition). */
function rules(): { selector: string; style: CSSStyleDeclaration; media?: string }[] {
  const sheet = [...document.styleSheets].at(-1)
  if (!sheet) throw new Error('feuille absente')
  const out: { selector: string; style: CSSStyleDeclaration; media?: string }[] = []
  for (const rule of sheet.cssRules) {
    if (rule instanceof CSSStyleRule) out.push({ selector: rule.selectorText, style: rule.style })
    else if (rule instanceof CSSMediaRule) {
      for (const inner of rule.cssRules) {
        if (inner instanceof CSSStyleRule) {
          out.push({
            selector: inner.selectorText,
            style: inner.style,
            media: rule.media.mediaText
          })
        }
      }
    }
  }
  return out
}

const selectors = (selector: string) => selector.split(',').map((s) => s.trim())

beforeAll(() => {
  const style = document.createElement('style')
  style.textContent = styles
  document.head.append(style)
})

describe('feuille de style de la zone de saisie', () => {
  it('une infobulle ne prend jamais le pointeur, ni son enveloppe de placement (composer n° 8)', () => {
    const element = document.createElement('div')
    element.className = 'tooltip'
    document.body.append(element)
    expect(getComputedStyle(element).pointerEvents).toBe('none')
    const wrapper = rules().find((r) =>
      selectors(r.selector).includes('[data-radix-popper-content-wrapper]:has(> .tooltip)')
    )
    expect(wrapper?.style.pointerEvents).toBe('none')
    element.remove()
  })

  it('« réduire les animations » : ni transition du mode Plan, ni animation de sa ligne de rappel (composer n° 36)', () => {
    const reduced = rules().filter((r) => r.media?.includes('prefers-reduced-motion: reduce'))
    const ruleFor = (selector: string) =>
      reduced.find((r) => selectors(r.selector).includes(selector))
    expect(ruleFor('.composer')?.style.transition).toBe('none')
    expect(ruleFor('.mode-chip')?.style.transition).toBe('none')
    expect(ruleFor('.composer-plan-hint')?.style.animation).toBe('none')
  })

  /** Barre au niveau de repli `fold` : ce qui reste affiché. */
  function bar(fold: number) {
    const root = document.createElement('div')
    root.innerHTML = `
      <div class="composer-bar" data-fold="${fold}">
        <button class="chip icon-chip capture-chip">capture</button>
        <button class="chip mode-chip"><svg></svg><span class="chip-label">Plan</span></button>
        <span class="session-settings-slot"><button>réglages</button></span>
        <div class="composer-bar-end">
          <button class="chip usage-chip"><svg></svg><span class="usage-percent">42 %</span></button>
          <button class="send-button">envoyer</button>
        </div>
      </div>`
    document.body.append(root)
    const shown = (selector: string) => {
      const el = root.querySelector(selector)
      if (!el) throw new Error(`absent : ${selector}`)
      return getComputedStyle(el).display !== 'none'
    }
    return { shown, remove: () => root.remove() }
  }

  it('fenêtre large (niveau 0) : capture, pourcentage et nom du mode affichés (composer n° 17)', () => {
    const b = bar(0)
    expect(b.shown('.capture-chip')).toBe(true)
    expect(b.shown('.usage-percent')).toBe(true)
    expect(b.shown('.mode-chip .chip-label')).toBe(true)
    b.remove()
  })

  it('premier repli (≈ 760 px) : la capture passe sous 📎, le reste tient (composer n° 19)', () => {
    const b = bar(1)
    expect(b.shown('.capture-chip')).toBe(false)
    expect(b.shown('.usage-percent')).toBe(true)
    expect(b.shown('.mode-chip .chip-label')).toBe(true)
    expect(b.shown('.send-button')).toBe(true)
    b.remove()
  })

  it('niveau 3 (≈ 640 px) : mode en icône, anneau seul, envoi visible (composer n° 24)', () => {
    const b = bar(3)
    expect(b.shown('.mode-chip .chip-label')).toBe(false)
    expect(b.shown('.mode-chip svg')).toBe(true)
    expect(b.shown('.usage-percent')).toBe(false)
    expect(b.shown('.usage-chip svg')).toBe(true)
    expect(b.shown('.send-button')).toBe(true)
    expect(b.shown('.session-settings-slot')).toBe(true)
    b.remove()
  })
})
