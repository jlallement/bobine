import { L, MAIN_PORT, check, mainProcess, withApp } from '../lib.mjs'

/** Valeur calculée d'une propriété CSS de la page. */
const css = (name) =>
  `getComputedStyle(document.documentElement).getPropertyValue('${name}').trim()`

/**
 * Densité compacte et mode présentation (fiche 159) : la densité passe par les jetons
 * `--density-*` ; le mode présentation (menu Affichage, Réglages, pastille) agrandit le texte du
 * fil, masque les coûts et le quota, sans jamais être retenu dans `settings.json`.
 */
export async function presentationSuite(scheme) {
  console.log(`\n— Densité et présentation (${scheme})`)
  await withApp(
    scheme,
    async (ui) => {
      const main = await mainProcess()
      try {
        await ui.ready()
        await ui.send('/scenario streaming-texte')
        await ui.ready()
        await ui.send('/scenario streaming-texte')
        await ui.ready()
        await ui.waitFor(`!!${ui.$('usage-meter')}`)
        const normalGap = await ui.ev(
          `parseFloat(getComputedStyle(document.querySelector('.thread')).rowGap)`
        )
        check(normalGap === 18, 'densité normale : 18 px entre les messages')
        await ui.shot('presentation-0-normale')

        // Densité compacte : par les jetons, dans le fil, les outils et la barre latérale.
        await ui.click(ui.$('open-settings'))
        await ui.waitFor(`!!${ui.$('settings')}`)
        await ui.click(ui.$('settings-appearance'))
        await ui.click(ui.$('density-compact'))
        await ui.waitFor(`document.documentElement.dataset.density === 'compact'`)
        check(
          (await ui.ev(css('--density-thread-gap'))) === '10px',
          'compacte : jeton --density-thread-gap'
        )
        await ui.shot('presentation-1-reglages')
        await ui.key('Escape')
        await ui.waitFor(`!${ui.$('settings')}`)
        check(
          (await ui.ev(
            `parseFloat(getComputedStyle(document.querySelector('.thread')).rowGap)`
          )) === 10,
          'compacte : 10 px entre les messages'
        )
        const rowPad = await ui.ev(
          `parseFloat(getComputedStyle(document.querySelector('.history-open')).paddingTop)`
        )
        check(rowPad === 4, 'compacte : lignes de la barre latérale resserrées (4 px)')
        check(
          (await ui.ev(
            `parseFloat(getComputedStyle(document.querySelector('.history-open')).paddingLeft)`
          )) === 10,
          'barre latérale : le retrait à gauche ne change pas (jamais de second niveau)'
        )
        await ui.shot('presentation-2-compacte')
        await ui.click(ui.$('open-settings'))
        await ui.click(ui.$('settings-appearance'))
        await ui.click(ui.$('density-normal'))
        await ui.waitFor(`document.documentElement.dataset.density === 'normal'`)
        await ui.key('Escape')
        await ui.waitFor(`!${ui.$('settings')}`)

        // Mode présentation : interrupteur des Réglages, menu Affichage synchronisé, pastille.
        const baseSize = await ui.ev(`parseFloat(${css('--conv-size')})`)
        check(!(await ui.ev(`!!${ui.$('presentation-pill')}`)), 'pastille absente au lancement')
        const menuChecked = () =>
          main.evaluate(
            `require('electron').Menu.getApplicationMenu().getMenuItemById('presentation').checked`
          )
        check((await menuChecked()) === false, 'menu Affichage : « Mode présentation » décoché')
        await ui.click(ui.$('open-settings'))
        await ui.click(ui.$('settings-appearance'))
        await ui.click(ui.$('settings-presentation'))
        await ui.waitFor(`!!${ui.$('presentation-pill')}`)
        check(
          (await ui.ev(`parseFloat(${css('--conv-size')})`)) === baseSize + 3,
          'texte du fil agrandi de 3 px'
        )
        check(await menuChecked(), 'menu Affichage : coché, synchronisé avec les Réglages')
        check(
          (await ui.ev(`${ui.$('presentation-pill')}.innerText`)) === L('presentation.pill'),
          'pastille de rappel affichée'
        )
        await ui.shot('presentation-3-reglages-actif')
        await ui.key('Escape')
        await ui.waitFor(`!${ui.$('settings')}`)
        check(
          !(await ui.ev(`!!document.querySelector('[data-testid=agent-quota]')`)) &&
            !(await ui.ev(`/\\$/.test(${ui.$('usage-meter')}?.innerText ?? '')`)),
          'quota et montants masqués'
        )
        await ui.click(ui.$('usage-meter'))
        await ui.waitFor(`!!${ui.$('usage-details')}`)
        check(
          !(await ui.ev(`!!${ui.$('usage-cost')}`)) &&
            !(await ui.ev(`${ui.$('usage-details')}.innerText.includes('$')`)),
          'détail de la consommation : aucun coût'
        )
        await ui.shot('presentation-4-actif')
        await ui.key('Escape')

        // Jamais enregistré ; la pastille le quitte.
        await ui.click(ui.$('presentation-pill'))
        await ui.waitFor(`!${ui.$('presentation-pill')}`)
        check(
          (await ui.ev(`parseFloat(${css('--conv-size')})`)) === baseSize && !(await menuChecked()),
          'pastille : quitte le mode, texte et menu rétablis'
        )
      } finally {
        main.close?.()
      }
    },
    undefined,
    'demo',
    {},
    [`--inspect=${MAIN_PORT}`]
  )
}
