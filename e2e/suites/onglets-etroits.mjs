import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { check, withApp } from '../lib.mjs'

/**
 * Onglets du panneau au plus étroit (fiche 185, D25) : panneau à sa largeur minimale (280 px), tous
 * les outils ouverts, « Modifications 12 » ; en français puis en anglais dans le même essai. Aucun
 * onglet coupé au bord, aucun nom tronqué, l'actif et son ✕ entiers ; la puce de l'agent passe à
 * son icône, jamais un bout de nom ni un chevron seul (D26).
 */
export async function narrowTabsSuite(scheme) {
  console.log(`\n— Onglets au plus étroit (${scheme})`)
  // Départ en français ; `BOBINE_LANG` vide : c'est le réglage qui décide (comme la suite `language`).
  const userData = mkdtempSync(join(tmpdir(), 'bob-e2e-onglets-'))
  writeFileSync(join(userData, 'settings.json'), JSON.stringify({ language: 'fr' }))
  await withApp(
    scheme,
    async (ui) => {
      await ui.ready()
      await ui.send('/scenario douze-fichiers')
      await ui.ready()
      for (const language of ['fr', 'en']) {
        // Langue de l'interface, choisie dans Réglages › Général.
        await ui.click(ui.$('open-settings'))
        await ui.waitFor(`!!${ui.$('settings-language')}`)
        await ui.ev(`(() => {
        const select = ${ui.$('settings-language')}
        Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, '${language}')
        select.dispatchEvent(new Event('change', { bubbles: true }))
        return true
      })()`)
        await ui.waitFor(`document.documentElement.lang === '${language}'`)
        await ui.key('Escape')
        await ui.waitFor(`!${ui.$('settings')}`)

        // Fenêtre de 900 px, panneau ouvert à la main, tous les outils ouverts.
        await ui.viewport(900, 760)
        if (!(await ui.ev(`!!${ui.$('side-panel')}`))) await ui.click(ui.$('panel-toggle'))
        await ui.waitFor(`!!${ui.$('side-panel')}`)
        await ui.waitFor(`${ui.$('side-panel')}.getAnimations().length === 0`)
        for (let i = 0; i < 8; i++) {
          const next = await ui.ev(`(() => {
          const open = new Set([...document.querySelectorAll('.side-panel-tab')].map((t) => t.dataset.tab))
          return ['changes', 'browser', 'terminal', 'tasks', 'simulator', 'android'].find((id) => !open.has(id)) ?? null
        })()`)
          if (!next || !(await ui.ev(`!!${ui.$('panel-more')}`))) break
          await ui.click(ui.$('panel-more'))
          await ui.waitFor(`!!${ui.$('panel-more-menu')}`)
          const item = `${ui.$('panel-more-menu')}.querySelector('[data-tab=${next}]')`
          if (!(await ui.ev(`!!${item}`))) {
            await ui.key('Escape')
            break
          }
          await ui.click(item)
          await ui.waitFor(`!!document.querySelector('.side-panel-tab.active[data-tab=${next}]')`)
        }
        // Panneau tiré à sa largeur minimale.
        const handle = await ui.ev(
          `(() => { const b = document.querySelector('.side-panel-resize').getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + 200 } })()`
        )
        await ui.drag(handle, { x: handle.x + 600, y: handle.y })
        await ui.waitFor(`${ui.$('side-panel')}.getBoundingClientRect().width <= 281`)
        // État de la rangée : onglets visibles dans la rangée, boutons de l'en-tête dans l'en-tête,
        // aucun nom tronqué, ✕ de l'actif entier.
        const rowState = () =>
          ui.ev(`(() => {
            const head = document.querySelector('.side-panel-head').getBoundingClientRect()
            const list = document.querySelector('.side-panel-tabs').getBoundingClientRect()
            const within = (r, b) => b.width > 0 && b.left >= r.left - 1 && b.right <= r.right + 1
            const tabs = [...document.querySelectorAll('.side-panel-tab:not([data-overflow])')]
            const buttons = [...document.querySelectorAll('.side-panel-head > button, .side-panel-head > .icon-button')]
            const close = document.querySelector('.side-panel-tab.active .side-panel-tab-close')
            return {
              active: document.querySelector('.side-panel-tab.active')?.dataset.tab,
              open: document.querySelectorAll('.side-panel-tab').length,
              stored: [...document.querySelectorAll('.side-panel-tab[data-overflow]')].map((t) => t.dataset.tab),
              cut: [
                ...tabs.filter((t) => !within(list, t.getBoundingClientRect())).map((t) => t.dataset.tab),
                ...buttons.filter((b) => !within(head, b.getBoundingClientRect())).map((b) => b.dataset.testid || b.getAttribute('aria-label'))
              ],
              partial: [...document.querySelectorAll('.side-panel-tab-label')]
                .filter((l) => l.offsetWidth > 0 && l.scrollWidth > l.clientWidth + 1)
                .map((l) => l.textContent),
              close: !!close && within(list, close.getBoundingClientRect()) && getComputedStyle(close).opacity === '1'
            }
          })()`)
        const whole = (state, what) =>
          check(
            state.cut.length === 0 && state.partial.length === 0 && state.close,
            `${language}, 280 px, ${what} : aucun onglet ni bouton coupé, aucun nom tronqué, ✕ de l’actif entier (${JSON.stringify(state)})`
          )

        // Modifications actif (pris dans le menu « + » s'il y est rangé) : son « 12 » se lit.
        const changes = `document.querySelector('.side-panel-tab:not([data-overflow])[data-tab=changes] .side-panel-tab-main')`
        if (await ui.ev(`!!${changes}`)) await ui.click(changes)
        else {
          await ui.click(ui.$('panel-more'))
          await ui.waitFor(`!!${ui.$('panel-more-menu')}`)
          await ui.click(
            `${ui.$('panel-more-menu')}.querySelector('[data-testid=panel-more-tab][data-tab=changes]')`
          )
        }
        await ui.waitFor(`!!document.querySelector('.side-panel-tab.active[data-tab=changes]')`)
        whole(await rowState(), 'Modifications actif')
        check(
          await ui.ev(`(() => {
            const count = document.querySelector('.side-panel-tab.active[data-tab=changes] .side-panel-tab-count')
            return !!count && count.getBoundingClientRect().width > 0 && count.textContent.trim() === '12'
          })()`),
          `${language} : « 12 » affiché sur l’onglet Modifications`
        )

        // Un clic sur l'icône d'un inactif l'ouvre (le ✕ invisible ne prend pas le clic) : il devient
        // l'actif et aucun onglet n'est fermé.
        const inactive = await ui.ev(
          `[...document.querySelectorAll('.side-panel-tab:not([data-overflow]):not(.active)')].map((t) => t.dataset.tab)`
        )
        for (const id of inactive) {
          const before = (await rowState()).open
          // Au milieu de l'onglet entier : là où un ✕ invisible pourrait être posé.
          await ui.click(
            `document.querySelector('.side-panel-tab:not([data-overflow])[data-tab=${id}]')`
          )
          await ui.waitFor(`!!document.querySelector('.side-panel-tab.active[data-tab=${id}]')`)
          const state = await rowState()
          check(
            state.active === id && state.open === before,
            `${language}, 280 px : un clic sur l’icône de ${id} l’ouvre, aucun onglet fermé (${before} → ${state.open})`
          )
          whole(state, `${id} actif`)
        }

        // ✕ d'une ligne rangée, à la souris : l'onglet se ferme (il ne s'ouvre pas).
        if ((await rowState()).stored.length > 0) {
          const before = await rowState()
          const target = before.stored[0]
          await ui.click(ui.$('panel-more'))
          await ui.waitFor(`!!${ui.$('panel-more-menu')}`)
          await ui.click(
            `${ui.$('panel-more-menu')}.querySelector('[data-testid=panel-more-tab][data-tab=${target}] [data-testid=panel-more-tab-close]')`
          )
          await ui
            .waitFor(
              `document.querySelectorAll('.side-panel-tab').length === ${before.open - 1}`,
              3000
            )
            .catch(() => {})
          const after = await rowState()
          check(
            after.open === before.open - 1 &&
              after.active !== target &&
              after.active === before.active,
            `${language} : le ✕ de la ligne ${target} dans « + » ferme l’onglet, sans l’ouvrir (${before.open} → ${after.open}, actif ${before.active} → ${after.active})`
          )
          await ui.key('Escape')
        }

        // Appui sur le ✕ d'une ligne, glissé hors d'elle et relâché : rien ne se ferme ; puis ↩ sur
        // cette ligne l'ouvre (l'appui d'avant ne compte plus).
        if ((await rowState()).stored.length > 0) {
          const before = await rowState()
          const target = before.stored[0]
          await ui.click(ui.$('panel-more'))
          await ui.waitFor(`!!${ui.$('panel-more-menu')}`)
          const row = `${ui.$('panel-more-menu')}.querySelector('[data-testid=panel-more-tab][data-tab=${target}]')`
          const from = await ui.center(`${row}.querySelector('[data-testid=panel-more-tab-close]')`)
          const to = await ui.center(`${ui.$('panel-more-menu')}.querySelector('.menu-label')`)
          await ui.drag(from, to)
          check(
            (await rowState()).open === before.open &&
              (await ui.ev(`!!${ui.$('panel-more-menu')}`)),
            `${language} : appui sur le ✕ puis glissé ailleurs : rien ne se ferme, le menu reste ouvert`
          )
          await ui.ev(`(${row}.focus(), true)`)
          await ui.key('Enter')
          await ui.waitFor(`!!document.querySelector('.side-panel-tab.active[data-tab=${target}]')`)
          const after = await rowState()
          check(
            after.active === target && after.open === before.open,
            `${language} : ↩ sur la ligne ${target} l’ouvre, rien n’est fermé (${before.open} → ${after.open})`
          )
        }

        // Ligne rangée fermée au clavier (⌫) : l'onglet se ferme, le focus reste dans le menu (ou
        // le menu se ferme s'il est vide).
        if ((await rowState()).stored.length > 0) {
          const before = (await rowState()).open
          await ui.click(ui.$('panel-more'))
          await ui.waitFor(`!!${ui.$('panel-more-menu')}`)
          await ui.ev(`(document.querySelector('[data-testid=panel-more-tab]').focus(), true)`)
          await ui.press('Backspace')
          await ui.waitFor(`document.querySelectorAll('.side-panel-tab').length === ${before - 1}`)
          await ui.waitFor(
            `!${ui.$('panel-more-menu')} || !!document.activeElement?.closest('[data-testid=panel-more-menu]')`
          )
          check(
            true,
            `${language} : ⌫ sur une ligne rangée ferme l’onglet, le focus reste dans le menu`
          )
          await ui.key('Escape')
        }
        // Puce de l'agent : forcément en icône à cette largeur, jamais un bout ni un chevron seul.
        const chip = await ui.ev(`(() => {
        const chip = document.querySelector('.agent-chip')
        const icon = chip.querySelector('.agent-chip-icon')
        return { iconMode: !!chip.closest('[data-agent-icon]'), icon: icon.getBoundingClientRect().width > 0, name: chip.textContent.trim() }
      })()`)
        check(
          chip.iconMode && chip.icon && chip.name.length > 0,
          `${language}, 280 px : la puce de l’agent est en icône, son nom gardé pour les lecteurs (${JSON.stringify(chip)})`
        )
        await ui.shot(`185-280-${language}`)
        await ui.viewport()
      }
    },
    userData,
    'demo',
    { BOBINE_LANG: '' }
  )
}
