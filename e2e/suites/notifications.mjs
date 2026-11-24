import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MAIN_PORT, sleep, check, withApp, mainProcess, L, M } from '../lib.mjs'

/**
 * Notifications macOS, badge du Dock et pastilles (fiche 024), son (fiche 068) et rebond du Dock
 * (fiche 101). La fenêtre est déclarée sans focus et les notifications sont interceptées dans le
 * processus principal (rien ne s'affiche) ; le son et le rebond sont notés dans des journaux.
 */
export async function notificationsSuite(scheme) {
  console.log(`\n— Notifications (${scheme})`)
  const logs = mkdtempSync(join(tmpdir(), 'bob-e2e-son-'))
  const soundLog = join(logs, 'sons.log')
  const bounceLog = join(logs, 'rebonds.log')
  writeFileSync(soundLog, '')
  writeFileSync(bounceLog, '')
  await withApp(
    scheme,
    async (ui) => {
      await ui.ready()
      const main = await mainProcess()
      try {
        const focus = (focused) =>
          main.evaluate(`(() => {
            const win = require('electron').BrowserWindow.getAllWindows()[0]
            win.isFocused = () => ${focused}
            win.emit(${focused} ? 'focus' : 'blur')
            return true
          })()`)
        await main.evaluate(`(() => {
          const { Notification } = require('electron')
          globalThis.__notes = []
          Notification.prototype.show = function () { globalThis.__notes.push(this) }
          return true
        })()`)
        await focus(false)
        const notes = () =>
          main.evaluate(`globalThis.__notes.map((n) => ({ title: n.title, body: n.body }))`)
        const waitNotes = async (count) => {
          for (let i = 0; i < 100 && (await notes()).length < count; i++) await sleep(100)
          return notes()
        }
        const allow = `document.querySelector('[data-testid=permission] button[data-kind=allow_once]')`

        await ui.send('Bonjour')
        await ui.waitFor(`!!${allow}`)
        const id = await ui.ev(`document.querySelector('.history-item.active')?.dataset.id`)
        // Icône d'état propre sur la ligne de la conversation (fiche 149).
        const dot = `document.querySelector('[data-testid=history-item][data-id="${id}"] .child-state')`
        // La conversation qui attend garde sa place, avec la main à droite du titre.
        const waiting = `!!document.querySelector('[data-testid=history-item][data-id="${id}"] .child-state[data-state=waiting]')`
        let list = await waitNotes(1)
        check(
          list[0]?.body ===
            L('notifications.permission', { tool: M('Modification de config.json') }) &&
            list[0]?.title.startsWith(`${L('profiles.mock.label')} · `),
          'fenêtre sans focus : notification pour une demande d’autorisation'
        )
        await ui.waitFor(waiting)
        await ui.shot('60-notification-demande')
        // Retour dans l'app : le rebond s'arrête ; la demande, elle, attend toujours.
        await focus(true)
        await focus(false)

        await ui.click(allow)
        await ui.ready()
        list = await waitNotes(2)
        await ui.waitFor(`${dot}?.classList.contains('unread')`)

        // Une autre conversation est affichée ; le clic sur la notification ramène la bonne.
        await ui.click(ui.$('new-conversation'))
        await ui.waitFor(`!document.querySelector('.history-item.active')`)
        await main.evaluate(`globalThis.__notes[1].emit('click')`)
        await ui.waitFor(
          `document.querySelector('.history-item.active')?.dataset.id === ${JSON.stringify(id)}`
        )
        check(true, 'clic sur la notification : sa conversation s’affiche')
        await focus(true)
        await ui.waitFor(`!${dot}`)

        await ui.click(ui.$('notifications-toggle'))
        await ui.waitFor(`${ui.$('notifications-toggle')}.getAttribute('aria-pressed') === 'false'`)
        await focus(false)
        await ui.send('Encore')
        await ui.waitFor(`!!${allow}`)
        await ui.waitFor(waiting)
        await sleep(300)
        await ui.shot('61-notifications-coupees')
        await ui.click(allow)
        await ui.ready()

        // macOS refuse (app signée « ad hoc ») : la cloche passe en alerte et l'explique.
        await ui.click(ui.$('notifications-toggle'))
        await ui.waitFor(`${ui.$('notifications-toggle')}.getAttribute('aria-pressed') === 'true'`)
        await main.evaluate(`(() => {
          require('electron').Notification.prototype.show = function () {
            this.emit('failed', {}, 'Notifications are not allowed for this application')
          }
          return true
        })()`)
        await ui.send('Toujours là ?')
        await ui.waitFor(`!!${allow}`)
        await ui.waitFor(`!!${ui.$('notifications-blocked')}`)
        await ui.click(ui.$('notifications-blocked'))
        await ui.waitFor(
          `document.body.innerText.includes(${JSON.stringify(L('sidebar.notifications.openSettings'))})`
        )
        check(true, 'refus de macOS : cloche en alerte, explication et lien vers les réglages')
        await ui.shot('62-notifications-bloquees')
        await ui.key('Escape')
        await ui.click(allow)
        await ui.ready()
      } finally {
        main.close()
      }
    },
    undefined,
    'demo',
    // Son d'attente (fiche 068) et rebond du Dock (fiche 101) notés au lieu d'être joués ; fenêtre
    // des bannières groupées (fiche 119, suite `inbox`) réduite : ici, une conversation à la fois.
    { BOBINE_SOUND_LOG: soundLog, BOBINE_BOUNCE_LOG: bounceLog, BOBINE_NOTICE_GROUP_MS: '300' },
    [`--inspect=${MAIN_PORT}`]
  )
  rmSync(logs, { recursive: true, force: true })
}
