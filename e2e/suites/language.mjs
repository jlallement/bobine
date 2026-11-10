import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MAIN_PORT, check, mainProcess, withApp } from '../lib.mjs'

/**
 * Langue de l'interface (fiche 074) : Réglages › Général › Langue change l'app à chaud (fenêtres,
 * menu macOS), sans relancer ; le choix est gardé d'un lancement à l'autre.
 */
export async function languageSuite(scheme) {
  console.log(`\n— Langue de l’interface (${scheme})`)
  const userData = mkdtempSync(join(tmpdir(), 'bob-e2e-lang-'))
  // Départ en français quelle que soit la langue de la machine ; `BOBINE_LANG` vide : c'est le
  // réglage qui décide, pas l'environnement des essais.
  writeFileSync(join(userData, 'settings.json'), JSON.stringify({ language: 'fr' }))
  const env = { BOBINE_LANG: '' }
  const args = [`--inspect=${MAIN_PORT}`]
  const placeholder = (ui) => ui.ev(`${ui.$('composer-input')}.placeholder`)
  const menuLabels = (main) =>
    main.evaluate(`require('electron').Menu.getApplicationMenu().items.map((i) => i.label)`)
  // Langue de chaque fenêtre de l'app (principale, rapide si elle existe).
  const windowLanguages = (main) =>
    main.evaluate(
      `Promise.all(require('electron').BrowserWindow.getAllWindows().map((w) => w.webContents.executeJavaScript('document.documentElement.lang')))`
    )
  const choose = async (ui, language) => {
    await ui.ev(`(() => {
      const select = ${ui.$('settings-language')}
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, '${language}')
      select.dispatchEvent(new Event('change', { bubbles: true }))
      return true
    })()`)
    await ui.waitFor(`document.documentElement.lang === '${language}'`)
  }
  try {
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        const main = await mainProcess()
        try {
          check(
            (await ui.ev(`document.documentElement.lang`)) === 'fr' &&
              (await placeholder(ui)) === 'Que voulez-vous faire\u00a0?' &&
              (await menuLabels(main)).includes('Fichier'),
            'réglage « Français » : interface et menu en français'
          )
          await ui.click(ui.$('open-settings'))
          await ui.waitFor(`!!${ui.$('settings-language')}`)
          await ui.shot('langue-1-reglage')
          await choose(ui, 'en')
          await ui.waitFor(`${ui.$('settings-heading')}?.innerText === 'General'`)
          check(
            (
              await ui.ev(`${ui.$('settings-language')}.closest('.settings-row').innerText`)
            ).startsWith('Language'),
            'English : les Réglages restent ouverts et passent à l’anglais'
          )
          const labels = await menuLabels(main)
          check(
            labels.includes('File') && labels.includes('Edit') && !labels.includes('Fichier'),
            'English : le menu macOS est reconstruit en anglais'
          )
          check(
            (await windowLanguages(main)).every((lang) => lang === 'en'),
            'English : chaque fenêtre de l’app suit'
          )
          await ui.shot('langue-2-reglages-en')
          await ui.key('Escape')
          await ui.waitFor(`!${ui.$('settings')}`)
          check(
            (await placeholder(ui)) === 'What do you want to do?',
            'English : accueil en anglais'
          )
          await ui.shot('langue-3-accueil-en')
          const saved = JSON.parse(readFileSync(join(userData, 'settings.json'), 'utf8'))
          check(saved.language === 'en', 'choix gardé dans settings.json')
        } finally {
          main.close()
        }
      },
      userData,
      'demo',
      env,
      args
    )
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        const main = await mainProcess()
        try {
          check(
            (await ui.ev(`document.documentElement.lang`)) === 'en' &&
              (await placeholder(ui)) === 'What do you want to do?' &&
              (await menuLabels(main)).includes('File'),
            'relancée : en anglais dès le départ'
          )
          await ui.click(ui.$('open-settings'))
          await ui.waitFor(`!!${ui.$('settings-language')}`)
          await choose(ui, 'fr')
          await ui.waitFor(`${ui.$('settings-heading')}?.innerText === 'Général'`)
          check(
            (await menuLabels(main)).includes('Fichier') &&
              (await windowLanguages(main)).every((lang) => lang === 'fr'),
            'retour au français : Réglages, menu et fenêtres'
          )
        } finally {
          main.close()
        }
      },
      userData,
      'demo',
      env,
      args
    )
  } finally {
    rmSync(userData, { recursive: true, force: true })
  }
}
