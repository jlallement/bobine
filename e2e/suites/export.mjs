import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Lpart, MAIN_PORT, check, mainProcess, sleep, withApp } from '../lib.mjs'

/**
 * Export d'une conversation et sauvegarde de l'historique (fiche 043). Les dialogues natifs
 * (enregistrement, dossier) et le Finder sont remplacés dans le processus principal.
 */
export async function exportSuite() {
  console.log('\n— Export et sauvegarde')
  const out = mkdtempSync(join(tmpdir(), 'bob-e2e-export-'))
  try {
    await withApp(
      'light',
      async (ui) => {
        await ui.ready()
        await ui.send('/scenario streaming-texte')
        await ui.ready()
        const main = await mainProcess()
        try {
          await main.evaluate(`(() => {
            const { dialog, shell } = require('electron')
            const path = require('path')
            dialog.showSaveDialog = async (a, b) => {
              const options = b ?? a
              return { canceled: false, filePath: path.join(${JSON.stringify(out)}, path.basename(options.defaultPath)) }
            }
            dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [${JSON.stringify(out)}] })
            shell.showItemInFolder = () => {}
            return true
          })()`)
          const more = `document.querySelector('[data-testid=history-more]')`
          // Le menu Radix s'ouvre au pointeur ; juste après une sélection, un clic peut tomber
          // pendant sa fermeture : on attend qu'il soit fermé, et on réessaie une fois.
          const openMenu = async (item) => {
            await ui.waitFor(`!${ui.$(item)}`)
            for (let attempt = 0; attempt < 3; attempt++) {
              await ui.click(more)
              if (await ui.waitFor(`!!${ui.$(item)}`, 2000).catch(() => false)) return
              await sleep(300)
            }
            throw new Error(`menu « … » : ${item} n'apparaît pas`)
          }
          await openMenu('history-export-markdown')
          await ui.click(ui.$('history-export-markdown'))
          await ui.waitFor(
            `document.body.innerText.includes(${JSON.stringify(Lpart('conversations.exported'))})`
          )
          const md = readdirSync(out).find((f) => f.endsWith('.md'))
          const text = md ? readFileSync(join(out, md), 'utf8') : ''
          check(
            !!md && text.startsWith('# ') && text.includes('/scenario streaming-texte'),
            `export Markdown : ${md ?? 'aucun fichier'}`
          )
          await openMenu('history-export-json')
          await ui.click(ui.$('history-export-json'))
          await ui.waitFor(
            `document.body.innerText.split(${JSON.stringify(Lpart('conversations.exported'))}).length > 2`
          )
          const json = readdirSync(out).find((f) => f.endsWith('.json'))
          const parsed = json ? JSON.parse(readFileSync(join(out, json), 'utf8')) : null
          check(
            parsed?.format === 'bobine-conversation' && parsed.transcript.items.length >= 2,
            `export JSON : ${json ?? 'aucun fichier'}`
          )

          // Sauvegarde depuis les réglages.
          await main.evaluate(
            `require('electron').BrowserWindow.getAllWindows()[0].webContents.send('app:command', 'settings'); true`
          )
          await ui.waitFor(`!!${ui.$('settings-data')}`)
          await ui.click(ui.$('settings-data'))
          await ui.waitFor(`!!${ui.$('settings-backup')}`)
          await ui.click(ui.$('settings-backup'))
          await ui.waitFor(
            `${ui.$('settings-backup-note')}?.innerText.includes(${JSON.stringify(Lpart('settings.data.backup.done'))})`
          )
          const backup = readdirSync(out).find((f) => f.startsWith('bobine-sauvegarde-'))
          // Les réglages ne sont écrits qu'au premier changement : l'app d'essai n'en a pas.
          const copied = backup ? readdirSync(join(out, backup, 'conversations')) : []
          check(
            copied.includes('index.json') &&
              copied.some((f) => /^[\w-]+\.json$/.test(f) && f !== 'index.json'),
            `sauvegarde de l’historique : ${backup ?? 'aucun dossier'} (${copied.length} fichiers)`
          )
          await ui.shot('85-sauvegarde')
        } finally {
          main.close()
        }
      },
      undefined,
      'streaming-texte',
      {},
      [`--inspect=${MAIN_PORT}`]
    )
  } finally {
    rmSync(out, { recursive: true, force: true })
  }
}
