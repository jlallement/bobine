import { FEATURES, check, withApp } from '../lib.mjs'
import { withPalette } from '../palette.mjs'

/** Familles d'une pile CSS calculée, sans guillemets. */
const families = (css) => css.split(',').map((f) => f.trim().replace(/^["']|["']$/g, ''))

/**
 * Polices (fiche 145) : Inter et JetBrains Mono livrées hors macOS (capacité `bundledFonts`),
 * chargées depuis l'app ; SF Pro et SF Mono inchangées sur le Mac. Ligatures du code coupées par
 * défaut (`!=` reste `!=`), activées par Réglages › Apparence. Captures : la conversation et ses
 * blocs de code sans puis avec ligatures, la page Apparence, et la conversation en Aurore nuit.
 */
export async function policesSuite(scheme) {
  console.log(`\n— Polices et ligatures (${scheme})`)
  await withApp(scheme, async (ui) => {
    await ui.ready()
    const fonts = await ui.ev(`(async () => {
      await document.fonts.ready
      const root = document.documentElement
      return {
        bundled: root.classList.contains('bundled-fonts'),
        ui: getComputedStyle(document.body).fontFamily,
        inter: document.fonts.check('14px "Bobine Inter"'),
        mono: document.fonts.check('12px "Bobine JetBrains Mono"')
      }
    })()`)
    if (FEATURES.bundledFonts) {
      check(
        fonts.bundled && families(fonts.ui)[0] === 'Bobine Inter',
        `interface en Inter livrée (${families(fonts.ui)[0]})`
      )
    } else {
      check(
        !fonts.bundled && families(fonts.ui)[0] === '-apple-system',
        `interface en police du système, rien de livré (${families(fonts.ui)[0]})`
      )
    }

    await ui.send('/scenario ligatures')
    await ui.ready()
    const answer = `[...document.querySelectorAll('.msg-agent')].at(-1)`
    await ui.waitFor(`!!${answer}?.querySelector('pre code.hljs')`)
    const look = () =>
      ui.ev(`(async () => {
        const answer = ${answer}
        const block = answer.querySelector('pre code.hljs')
        const inline = answer.querySelector('p code')
        await document.fonts.ready
        return {
          family: getComputedStyle(block).fontFamily,
          block: getComputedStyle(block).fontVariantLigatures,
          inline: getComputedStyle(inline).fontVariantLigatures,
          prose: getComputedStyle(answer.querySelector('p')).fontVariantLigatures,
          monoLoaded: [...document.fonts].some(
            (f) => f.family.replace(/"/g, '') === 'Bobine JetBrains Mono' && f.status === 'loaded'
          )
        }
      })()`)
    const off = await look()
    check(
      FEATURES.bundledFonts
        ? families(off.family)[0] === 'Bobine JetBrains Mono' && off.monoLoaded
        : families(off.family)[0] === 'ui-monospace',
      `code en ${families(off.family)[0]}${FEATURES.bundledFonts ? ', chargée depuis l’app' : ''}`
    )
    check(
      off.block === 'none' && off.inline === 'none' && off.prose === 'normal',
      `ligatures du code coupées par défaut, texte inchangé (${off.block}, ${off.inline}, ${off.prose})`
    )
    await ui.ev(`${answer}.scrollIntoView({ block: 'start' })`)
    await ui.shot('p1-code-sans-ligatures')

    // Réglages › Apparence : l'interrupteur des ligatures, sous la police et la taille du code.
    await ui.click(ui.$('open-settings'))
    await ui.waitFor(`!!${ui.$('settings')}`)
    await ui.click(ui.$('settings-appearance'))
    await ui.waitFor(`!!${ui.$('settings-code-ligatures')}`)
    await ui.ev(`${ui.$('settings-code-font')}.scrollIntoView({ block: 'center' })`)
    check(
      !(await ui.ev(`${ui.$('settings-code-ligatures')}.checked`)),
      'interrupteur des ligatures coupé par défaut'
    )
    const codeFonts = await ui.ev(
      `[...${ui.$('settings-code-font')}.options].map((o) => o.value).slice(0, 2).join()`
    )
    check(
      FEATURES.bundledFonts ? codeFonts === 'system,system-mono' : codeFonts.startsWith('system'),
      `police du code : ${FEATURES.bundledFonts ? 'JetBrains Mono, puis celle du système' : 'SF Mono'} (${codeFonts})`
    )
    await ui.shot('p2-apparence')
    await ui.click(`${ui.$('settings-code-ligatures')}.parentElement`)
    await ui.waitFor(`${ui.$('settings-code-ligatures')}.checked`)
    await ui.shot('p2b-apparence-ligatures')
    await ui.key('Escape')
    await ui.waitFor(`!${ui.$('settings')}`)

    const on = await look()
    check(
      on.block === 'normal' && on.inline === 'normal',
      `ligatures du code activées (${on.block}, ${on.inline})`
    )
    await ui.ev(`${answer}.scrollIntoView({ block: 'start' })`)
    await ui.shot('p3-code-ligatures')

    // Aurore nuit (thème sombre) : la même conversation, ligatures coupées.
    if (scheme === 'dark') {
      await ui.click(ui.$('open-settings'))
      await ui.waitFor(`!!${ui.$('settings')}`)
      await ui.click(ui.$('settings-appearance'))
      await ui.waitFor(`!!${ui.$('settings-code-ligatures')}`)
      await ui.click(`${ui.$('settings-code-ligatures')}.parentElement`)
      await ui.waitFor(`!${ui.$('settings-code-ligatures')}.checked`)
      await ui.key('Escape')
      await ui.waitFor(`!${ui.$('settings')}`)
      await withPalette(ui, 'auroraNight', async () => {
        await ui.ev(`${answer}.scrollIntoView({ block: 'start' })`)
        await ui.shot('p4-aurore-nuit')
      })
    }
  })
}
