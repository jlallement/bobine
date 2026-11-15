import { check, withApp } from '../lib.mjs'

/** Familles d'une pile CSS calculée, sans guillemets. */
const families = (css) => css.split(',').map((f) => f.trim().replace(/^["']|["']$/g, ''))

/**
 * Polices (fiche 145, D9) : Inter et JetBrains Mono livrées avec l'app, chargées depuis l'app, sur
 * les trois systèmes. Ligatures du code coupées par défaut (`!=` reste `!=`), activées par Réglages › Apparence. Captures : la conversation et ses
 * blocs de code sans puis avec ligatures, la page Apparence, et la conversation en Aurore nuit.
 */
export async function policesSuite(scheme) {
  console.log(`\n— Polices et ligatures (${scheme})`)
  await withApp(scheme, async (ui) => {
    await ui.ready()
    const fonts = await ui.ev(`(async () => {
      await document.fonts.ready
      return {
        ui: getComputedStyle(document.body).fontFamily,
        inter: [...document.fonts].some(
          (f) => f.family.replace(/"/g, '') === 'Bobine Inter' && f.status === 'loaded'
        )
      }
    })()`)
    check(
      families(fonts.ui)[0] === 'Bobine Inter' && fonts.inter,
      `interface en Inter, chargée depuis l’app (${families(fonts.ui)[0]})`
    )

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
      families(off.family)[0] === 'Bobine JetBrains Mono' && off.monoLoaded,
      `code en ${families(off.family)[0]}, chargée depuis l’app`
    )
    check(
      off.block === 'none' && off.inline === 'none' && off.prose === 'none',
      `ligatures du code coupées par défaut, texte sans les flèches d’Inter (${off.block}, ${off.inline}, ${off.prose})`
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
      codeFonts === 'system,system-mono',
      `police du code : JetBrains Mono, puis celle du système (${codeFonts})`
    )
    await ui.shot('p2-apparence')
    await ui.click(`${ui.$('settings-code-ligatures')}.parentElement`)
    await ui.waitFor(`${ui.$('settings-code-ligatures')}.checked`)
    await ui.shot('p2b-apparence-ligatures')
    await ui.key('Escape')
    await ui.waitFor(`!${ui.$('settings')}`)

    const on = await look()
    check(
      on.block === 'normal' && on.inline === 'normal' && on.prose === off.prose,
      `ligatures du code activées, texte inchangé (${on.block}, ${on.inline}, ${on.prose})`
    )
    await ui.ev(`${answer}.scrollIntoView({ block: 'start' })`)
    await ui.shot('p3-code-ligatures')

    // Aurore nuit (thème sombre), choisi dans Réglages › Apparence : la page, la conversation sans
    // ligatures, puis avec.
    if (scheme === 'dark') {
      const appearance = async () => {
        await ui.click(ui.$('open-settings'))
        await ui.waitFor(`!!${ui.$('settings')}`)
        await ui.click(ui.$('settings-appearance'))
        await ui.waitFor(`!!${ui.$('settings-code-ligatures')}`)
      }
      const setLigatures = async (on) => {
        await ui.click(`${ui.$('settings-code-ligatures')}.parentElement`)
        await ui.waitFor(`${on ? '' : '!'}${ui.$('settings-code-ligatures')}.checked`)
      }
      const close = async () => {
        await ui.key('Escape')
        await ui.waitFor(`!${ui.$('settings')}`)
        await ui.ev(`${answer}.scrollIntoView({ block: 'start' })`)
      }
      await appearance()
      await ui.click(ui.$('theme-auroraNight'))
      await ui.waitFor(`document.documentElement.dataset.palette === 'auroraNight'`)
      await setLigatures(false)
      await ui.ev(`${ui.$('settings-code-font')}.scrollIntoView({ block: 'center' })`)
      await ui.shot('p5-aurore-nuit-apparence')
      await close()
      await ui.shot('p4-aurore-nuit')
      await appearance()
      await setLigatures(true)
      await close()
      check(
        (await ui.ev(`document.documentElement.dataset.palette`)) === 'auroraNight',
        'Aurore nuit gardée après le réglage des ligatures'
      )
      await ui.shot('p6-aurore-nuit-ligatures')
    }
  })
}
