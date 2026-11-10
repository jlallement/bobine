import { L, MAIN_PORT, check, mainProcess, withApp } from '../lib.mjs'
import { themeTokens } from '../../src/shared/themes.ts'

/**
 * Petites touches : copier, heure des messages, couleur d'accent, largeur du fil, réglages d'une
 * nouvelle conversation, archiver, confirmation avant de quitter.
 */
export async function touchesSuite(scheme) {
  console.log(`\n— Petites touches (${scheme})`)
  await withApp(
    scheme,
    async (ui) => {
      const main = await mainProcess()
      try {
        await ui.send('/scenario streaming-texte')
        await ui.ready()

        // Copier : bloc de code, puis toute la réponse (le presse-papiers du Mac est remis après).
        const saved = await main.evaluate(`require('electron').clipboard.readText()`)
        await ui.ev(`document.querySelector('.code-block').scrollIntoView({ block: 'center' })`)
        await ui.click(ui.$('copy-code'))
        await ui.waitFor(
          `${ui.$('copy-code')}.getAttribute('aria-label') === ${JSON.stringify(L('copy.done'))}`
        )
        const clipboard = () => main.evaluate(`require('electron').clipboard.readText()`)
        check(
          (await clipboard()).startsWith('export function hello'),
          'copier un bloc de code : son texte dans le presse-papiers'
        )
        await ui.click(ui.$('copy-reply'))
        await ui.waitFor(
          `${ui.$('copy-reply')}.getAttribute('aria-label') === ${JSON.stringify(L('copy.done'))}`
        )
        check(
          (await clipboard()).includes('**en Markdown**'),
          'copier la réponse : le Markdown complet'
        )
        await main.evaluate(
          `require('electron').clipboard.writeText(${JSON.stringify(saved ?? '')}), true`
        )

        // Heure des messages.
        const times = await ui.ev(
          `[...document.querySelectorAll('.msg-time')].map((t) => t.textContent)`
        )
        check(
          times.length === 2 && times.every((t) => /^\d{2}:\d{2}(\s?[AP]M)?$/.test(t)),
          'heure du message et de la réponse (au survol)'
        )
        await ui.shot('d0-copier-heure')

        // Apparence : couleur d'accent et largeur du fil.
        await ui.click(ui.$('open-settings'))
        await ui.waitFor(`!!${ui.$('settings')}`)
        await ui.click(ui.$('settings-appearance'))
        await ui.click(ui.$('accent-blue'))
        await ui.waitFor(`document.documentElement.dataset.accent === 'blue'`)
        check(
          (await ui.ev(
            `getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()`
          )) === themeTokens(scheme === 'dark' ? 'dark' : 'light', 'blue').accent,
          'couleur d’accent : bleu appliqué'
        )
        await ui.shot('d1-accent-bleu')
        await ui.click(ui.$('thread-width-wide'))
        await ui.waitFor(
          `getComputedStyle(document.documentElement).getPropertyValue('--column-width').trim() === '960px'`
        )
        check(true, 'largeur du fil : large')

        // Nouvelle conversation en mode Plan.
        await ui.click(ui.$('settings-conversation'))
        await ui.click(ui.$('new-conversation-mode-plan'))
        await ui.waitFor(
          `${ui.$('new-conversation-mode-plan')}.getAttribute('aria-checked') === 'true'`
        )
        await ui.key('Escape')
        await ui.waitFor(`!${ui.$('settings')}`)
        await ui.click(ui.$('new-conversation'))
        await ui.waitFor(`!document.querySelector('.history-item.active')`)
        await ui.ready()
        await ui
          .waitFor(
            `document.querySelector('[data-testid=composer]')?.innerText.includes('Plan')`,
            5000
          )
          .catch(() => {})
        check(
          (await ui.ev(`document.querySelector('.composer')?.innerText ?? ''`)).includes('Plan'),
          'nouvelle conversation : démarre en mode Plan'
        )

        // Archiver la première conversation.
        await ui.click(
          `document.querySelector('[data-testid=history-item] [data-testid=history-more]')`
        )
        await ui.waitFor(`!!${ui.$('history-archive')}`)
        await ui.click(ui.$('history-archive'))
        await ui.waitFor(`!!${ui.$('history-archived')}`)
        check(
          (await ui.ev(
            `document.querySelectorAll('[data-testid=history-list] [data-testid=history-item]').length`
          )) === 0 &&
            (await ui.ev(`${ui.$('history-archived-toggle')}.textContent`)) ===
              L('sidebar.archived') &&
            (await ui.ev(`${ui.$('history-archived-toggle')}.getAttribute('aria-expanded')`)) ===
              'false',
          'archivée : sortie des « Récents », rangée dans « Archivées », repliée, sans compteur'
        )
        await ui.click(ui.$('history-archived-toggle'))
        await ui.waitFor(
          `!!${ui.$('history-archived')}.querySelector('[data-testid=history-item]')`
        )
        await ui.shot('d2-archivees')

        // Quitter pendant une réponse : confirmation (dialogue simulé, « Annuler »).
        await ui.send('/scenario lent')
        await ui.waitFor(`${ui.$('working')}?.dataset.activity === 'writing'`)
        const asked = await main.evaluate(`(async () => {
          const { app, dialog } = require('electron')
          let question = null
          dialog.showMessageBox = async (...args) => {
            question = args.at(-1)
            return { response: 1 }
          }
          app.quit()
          await new Promise((r) => setTimeout(r, 300))
          return question && { message: question.message, buttons: question.buttons }
        })()`)
        check(
          asked?.message === L('quit.title_one') &&
            asked.buttons.join('/') === `${L('quit.confirm')}/${L('quit.cancel')}` &&
            (await ui.ev(`!!${ui.$('working')}`)),
          'quitter pendant une réponse : confirmation, « Annuler » garde l’app et l’agent'
        )
        await ui.click(ui.$('stop'))
        await ui.ready()
      } finally {
        main.close()
      }
    },
    undefined,
    'demo',
    {},
    [`--inspect=${MAIN_PORT}`]
  )
}
