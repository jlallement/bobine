import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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
  const sounds = () => readFileSync(soundLog, 'utf8').split('\n').filter(Boolean)
  const bounces = () => readFileSync(bounceLog, 'utf8').split('\n').filter(Boolean).join(',')
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
        const badge = () => main.evaluate(`require('electron').app.dock.getBadge()`)
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
        check(sounds().join(',') === 'Glass', 'fenêtre sans focus : un son pour la demande (Glass)')
        check(bounces() === 'critical', 'fenêtre sans focus : le Dock rebondit jusqu’au retour')
        await ui.waitFor(waiting)
        check((await badge()) === '1', 'badge du Dock : 1 conversation en attente')
        await ui.shot('60-notification-demande')
        // Retour dans l'app : le rebond s'arrête ; la demande, elle, attend toujours.
        await focus(true)
        check(bounces() === 'critical,stop', 'retour dans la fenêtre : le rebond s’arrête')
        await focus(false)

        await ui.click(allow)
        await ui.ready()
        list = await waitNotes(2)
        check(
          list[1]?.body.includes(
            M('Terminé. Tapez `/scenario` pour voir les autres scénarios.').replaceAll('`', '')
          ),
          'fin de la réponse : notification avec sa conclusion (sans Markdown)'
        )
        check(sounds().length === 1, 'fin de la réponse : pas de son (seulement pour une action)')
        check(
          bounces() === 'critical,stop,informational',
          'fin de la réponse : un seul rebond (informational)'
        )
        await ui.waitFor(`${dot}?.classList.contains('unread')`)
        check((await badge()) === '1', 'réponse non lue : toujours en attente')

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
        check((await badge()) === '', 'conversation vue : pastille et badge effacés')

        await ui.click(ui.$('notifications-toggle'))
        await ui.waitFor(`${ui.$('notifications-toggle')}.getAttribute('aria-pressed') === 'false'`)
        await focus(false)
        await ui.send('Encore')
        await ui.waitFor(`!!${allow}`)
        await ui.waitFor(waiting)
        await sleep(300)
        check(
          (await notes()).length === 2 && (await badge()) === '',
          'notifications coupées : ni notification ni badge, l’icône de demande reste'
        )
        check(
          bounces() === 'critical,stop,informational,stop',
          'notifications coupées : pas de rebond non plus'
        )
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
        check(
          bounces().endsWith(',stop,critical'),
          'refus de macOS : le Dock rebondit quand même (sans certificat)'
        )
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
