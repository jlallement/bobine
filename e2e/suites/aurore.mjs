import { L, check, withApp } from '../lib.mjs'
import { tokensOf } from '../palette.mjs'

/** Valeur calculée d'une propriété CSS d'un élément. */
const style = (selector, property) =>
  `getComputedStyle(document.querySelector('${selector}')).getPropertyValue('${property}')`

/**
 * Thème Aurore (fiche 226) : Aurore en clair, Aurore nuit en sombre, choisi dans Réglages ›
 * Apparence (vignette « Nouveau ») ; les six touches posées (lueur de la barre latérale, bulle,
 * liseré de la saisie au focus, action en dégradé, ombre de la carte d'autorisation, verre du menu
 * et des Réglages) ; repli quand macOS demande moins de transparence ou plus de contraste.
 * Captures : la page Apparence, la fenêtre (carte d'autorisation, saisie au focus), la même avec
 * un menu en verre ouvert, et le repli.
 */
export async function auroreSuite(scheme) {
  const palette = scheme === 'dark' ? 'auroraNight' : 'aurora'
  console.log(`\n— Thème ${palette} (${scheme})`)
  await withApp(
    scheme,
    async (ui) => {
      await ui.ready()
      await ui.click(ui.$('open-settings'))
      await ui.waitFor(`!!${ui.$('settings')}`)
      await ui.click(ui.$('settings-appearance'))
      await ui.waitFor(`!!${ui.$(`theme-${palette}`)}`)
      check(
        (await ui.ev(`${ui.$(`theme-${palette}`)}.innerText`)).includes(
          L('settings.appearance.theme.new')
        ) && !(await ui.ev(`!!${ui.$('theme-sepia')}`)),
        `vignette ${palette} marquée « Nouveau », plus de Sépia`
      )
      await ui.click(ui.$(`theme-${palette}`))
      await ui.waitFor(`document.documentElement.dataset.palette === '${palette}'`)
      check(
        (await ui.ev(`getComputedStyle(document.body).getPropertyValue('--bg').trim()`)) ===
          tokensOf(palette).bg,
        `thème ${palette} appliqué (fond ${tokensOf(palette).bg})`
      )
      check(
        (await ui.ev(style('.settings-dialog', 'backdrop-filter'))).includes('blur'),
        'Réglages en verre dépoli (touche 6)'
      )
      await ui.shot('a1-apparence-aurore')
      await ui.key('Escape')
      await ui.waitFor(`!${ui.$('settings')}`)

      // Carte d'autorisation (touche 5), bulle (touche 2), lueur (touche 1), action (touche 4).
      await ui.send('Ajoute un mode hors ligne à l’écran de connexion.')
      const card = `document.querySelector('[data-testid=permission]')`
      await ui.waitFor(`!!${card}`)
      // Carte armée (boutons actifs, 0.11 M1) : capturée comme on la voit.
      await ui.waitFor(`${card}.hasAttribute('data-armed')`)
      check(
        (await ui.ev(style('.sidebar', 'background-image'))).includes('radial-gradient'),
        'lueur en haut de la barre latérale (touche 1)'
      )
      check(
        (await ui.ev(style('.msg-user', 'background-image'))).includes('linear-gradient'),
        'bulle de l’utilisateur en dégradé (touche 2)'
      )
      check(
        (await ui.ev(style('.permission-card', 'box-shadow'))).includes('rgba') &&
          (await ui.ev(style('.permission-card .btn.primary', 'background-image'))).includes(
            'linear-gradient'
          ),
        'carte d’autorisation : ombre teintée, action principale en dégradé (touches 4, 5)'
      )
      check(
        (await ui.ev(style('.msg-user', 'backdrop-filter'))) === 'none' &&
          (await ui.ev(style('.permission-card', 'backdrop-filter'))) === 'none',
        'aucun verre dans le fil'
      )
      // Saisie au focus : liseré dégradé (touche 3).
      await ui.click(ui.$('composer-input'))
      await ui.waitFor(`document.activeElement === ${ui.$('composer-input')}`)
      check(
        (await ui.ev(style('.composer', 'background-image'))).includes('linear-gradient') &&
          (await ui.ev(style('.composer', 'border-top-color'))) === 'rgba(0, 0, 0, 0)',
        'saisie au focus : liseré dégradé (touche 3)'
      )
      await ui.shot('a2-aurore-fenetre')
      // Menu « + » du panneau ouvert : verre (touche 6). Le menu des modèles est grisé pendant
      // le tour (l'agent attend l'accord) : on prend ce menu-là.
      await ui.click(ui.$('panel-more'))
      await ui.waitFor(`!!${ui.$('panel-more-menu')}`)
      check(
        (
          await ui.ev(
            `getComputedStyle(${ui.$('panel-more-menu')}).getPropertyValue('backdrop-filter')`
          )
        ).includes('blur'),
        'menu du panneau en verre dépoli (touche 6)'
      )
      await ui.shot('a2b-aurore-menu')
      await ui.key('Escape')
      await ui.waitFor(`!${ui.$('panel-more-menu')}`)

      // Repli : « Réduire la transparence », puis « Augmenter le contraste » de macOS.
      for (const [feature, value] of [
        ['prefers-reduced-transparency', 'reduce'],
        ['prefers-contrast', 'more']
      ]) {
        await ui.media({ [feature]: value })
        await ui.click(ui.$('panel-more'))
        await ui.waitFor(`!!${ui.$('panel-more-menu')}`)
        const fallback = await ui.ev(`({
          glow: ${style('.sidebar', 'background-image')},
          menu: getComputedStyle(${ui.$('panel-more-menu')}).getPropertyValue('backdrop-filter'),
          bubble: ${style('.msg-user', 'background-image')}
        })`)
        check(
          fallback.glow === 'none' &&
            fallback.menu === 'none' &&
            /^linear-gradient\((rgb\([^)]*\)), \1\)$/.test(fallback.bubble),
          `${feature} : verre opaque, plus de lueur, dégradés unis`
        )
        if (feature === 'prefers-reduced-transparency') await ui.shot('a3-aurore-repli')
        await ui.key('Escape')
        await ui.waitFor(`!${ui.$('panel-more-menu')}`)
      }
      await ui.media()
      check(
        (await ui.ev(style('.sidebar', 'background-image'))).includes('radial-gradient'),
        'préférences de macOS revenues : la lueur revient'
      )
    },
    undefined,
    'permission'
  )
}
