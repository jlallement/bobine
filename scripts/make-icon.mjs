/**
 * Produit build/icon.png (1024 × 1024, fond transparent) à partir de build/icon.svg, avec le
 * moteur de rendu d'Electron : rien à installer. electron-builder en tire l'icône macOS (.icns).
 *
 *   pnpm exec electron scripts/make-icon.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { app, BrowserWindow } from 'electron'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const svg = readFileSync(join(root, 'build', 'icon.svg'), 'utf8')

app.dock?.hide()
// Pas d'`await` au niveau supérieur avant `ready` : Electron ne démarrerait pas.
void app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1024,
    height: 1024,
    show: false,
    transparent: true,
    frame: false,
    useContentSize: true,
    webPreferences: { offscreen: true }
  })
  // Rendu hors écran : l'image arrive par l'évènement `paint` (une fois la page dessinée).
  const painted = new Promise((resolve) => {
    let timer
    win.webContents.on('paint', (_event, _dirty, image) => {
      clearTimeout(timer)
      timer = setTimeout(() => resolve(image), 300)
    })
  })
  win.webContents.setFrameRate(10)
  await win.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(
      `<html><body style="margin:0;background:transparent">${svg}</body></html>`
    )}`
  )
  const image = await painted
  const png = image.resize({ width: 1024, height: 1024 }).toPNG()
  writeFileSync(join(root, 'build', 'icon.png'), png)
  console.log(`build/icon.png : ${image.getSize().width} × ${image.getSize().height}`)
  app.quit()
})
