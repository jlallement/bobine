import { check, withApp } from '../lib.mjs'
import { rgb, tokensOf, variantOf, withPalette } from '../palette.mjs'

/** Tableaux Markdown, comme dans Claude : sans grille, alignements, cadre qui défile si trop large. */
export async function tablesSuite(scheme) {
  console.log(`\n— Tableaux (${scheme})`)
  await withApp(scheme, async (ui) => {
    await ui.ready()
    await ui.send('/scenario tableaux')
    await ui.ready()
    const tables = `document.querySelectorAll('[data-testid=markdown-table]')`
    await ui.waitFor(`${tables}.length === 2`)
    const style = await ui.ev(`(() => {
      const [small] = ${tables}
      const th = [...small.querySelectorAll('th')].map((c) => getComputedStyle(c).textAlign)
      const td = getComputedStyle(small.querySelector('td'))
      return { th, left: td.borderLeftWidth, bottom: td.borderBottomWidth }
    })()`)
    check(
      style.th.join() === 'left,right,center,left',
      `alignements Markdown respectés, à gauche par défaut (${style.th.join()})`
    )
    check(
      style.left === '0px' && style.bottom === '1px',
      'pas de grille : seulement des lignes horizontales'
    )
    const wide = await ui.ev(`(() => {
      const wrap = ${tables}[1]
      const column = wrap.closest('.markdown').clientWidth
      return { wrap: wrap.clientWidth, column, scroll: wrap.scrollWidth }
    })()`)
    check(
      wide.wrap <= wide.column,
      `tableau large : reste dans le fil (${wide.wrap} ≤ ${wide.column} px), défile dans son cadre`
    )
    await ui.ev(`${tables}[0].scrollIntoView({ block: 'start' })`)
    await ui.shot('h0-tableaux')

    // Réponse très mise en forme, comme celles de Bob (fiche 070) : style de l'app.
    await ui.send('/scenario mise-en-forme')
    await ui.ready()
    await ui.waitFor(`!!document.querySelector('.msg-agent h4')`)
    await ui.ev(`document.querySelectorAll('.msg-agent')[1].scrollIntoView({ block: 'start' })`)
    await ui.shot('h1-mise-en-forme')
    const look = await ui.ev(`(() => {
      const answer = document.querySelectorAll('.msg-agent')[1]
      const px = (el) => parseFloat(getComputedStyle(el).fontSize)
      const body = px(answer.querySelector('p'))
      const hr = getComputedStyle(answer.querySelector('hr'))
      const quote = getComputedStyle(answer.querySelector('blockquote'))
      return {
        font: getComputedStyle(answer).fontFamily,
        h1: px(answer.querySelector('h1')) / body,
        h2: px(answer.querySelector('h2')) / body,
        h3: px(answer.querySelector('h3')) / body,
        h4: px(answer.querySelector('h4')) / body,
        hr: [hr.borderTopWidth, hr.borderBottomWidth, hr.borderTopStyle].join(' '),
        quote: quote.borderLeftWidth,
        tasks: [...answer.querySelectorAll('.contains-task-list li')].map((li) => getComputedStyle(li).listStyleType)
      }
    })()`)
    check(
      look.font.includes('system-ui') || look.font.includes('-apple-system'),
      `police du fil : celle de l'app par défaut (${look.font.split(',')[0]})`
    )
    check(
      look.h1 <= 1.4 && look.h2 <= look.h1 && look.h3 <= look.h2 && look.h4 >= 1,
      `titres proportionnés au texte (h1 ${look.h1.toFixed(2)}, h2 ${look.h2.toFixed(2)}, h3 ${look.h3.toFixed(2)})`
    )
    check(look.hr === '1px 0px solid', `trait « --- » : une ligne fine (${look.hr})`)
    check(look.quote !== '0px', 'citation : filet à gauche')
    check(
      look.tasks.length === 2 && look.tasks.every((t) => t === 'none'),
      'cases à cocher sans puce en plus'
    )

    // Blocs de code colorés par les jetons de la palette (fiche 134), plus de `github-dark`.
    await ui.send('/scenario code-colore')
    await ui.ready()
    await ui.waitFor(`document.querySelectorAll('.msg-agent pre code.hljs').length >= 5`)
    const code = `[...document.querySelectorAll('.msg-agent')].at(-1)`
    const colors = () =>
      ui.ev(`(() => {
        const answer = ${code}
        const style = (selector) => getComputedStyle(answer.querySelector(selector))
        return [
          style('pre code.hljs').backgroundColor,
          style('.hljs-keyword').color,
          style('.hljs-string').color,
          style('.hljs-comment').color
        ]
      })()`)
    const expected = (t) => [t.codeBg, t.syn.keyword, t.syn.string, t.syn.comment].map(rgb).join()
    check(
      (await colors()).join() === expected(tokensOf(scheme)),
      'blocs de code : fond et coloration de la palette'
    )
    await ui.ev(`${code}.scrollIntoView({ block: 'start' })`)
    await ui.shot('h2-code')
    const variant = variantOf(scheme)
    await withPalette(ui, variant, async () => {
      check(
        (await colors()).join() === expected(tokensOf(variant)),
        `blocs de code en ${variant} : ses propres couleurs`
      )
      await ui.shot(`h2-code-${variant}`)
    })
  })
}
