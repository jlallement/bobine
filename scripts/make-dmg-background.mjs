/**
 * Produit build/background.png et build/background@2x.png (écrans Retina) à partir de
 * build/background.svg, à sa taille, avec le moteur de rendu d'Electron : rien à installer
 * (fiche 073). electron-builder en fait le fond de la fenêtre du .dmg et en tire sa taille.
 *
 *   pnpm exec electron scripts/make-dmg-background.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { app, BrowserWindow } from 'electron'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const svg = readFileSync(join(root, 'build', 'background.svg'), 'utf8')
const [, WIDTH, HEIGHT] = /width="(\d+)" height="(\d+)"/.exec(svg).map(Number)

/** Image de la page, dessinée hors écran à cette échelle. */
async function render(scale) {
  const win = new BrowserWindow({
    width: WIDTH * scale,
    height: HEIGHT * scale,
    show: false,
    frame: false,
    useContentSize: true,
    webPreferences: { offscreen: true }
  })
  // L'image arrive par l'évènement `paint`, une fois la page dessinée.
  const painted = new Promise((resolve) => {
    let timer
    win.webContents.on('paint', (_event, _dirty, image) => {
      clearTimeout(timer)
      timer = setTimeout(() => resolve(image), 300)
    })
  })
  win.webContents.setFrameRate(10)
  const sized = svg.replace(
    `width="${WIDTH}" height="${HEIGHT}"`,
    `width="${WIDTH * scale}" height="${HEIGHT * scale}"`
  )
  await win.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(
      `<html><body style="margin:0">${sized}</body></html>`
    )}`
  )
  const image = await painted
  win.destroy()
  return image.resize({ width: WIDTH * scale, height: HEIGHT * scale }).toPNG()
}

app.dock?.hide()
// Deux rendus de suite : fermer la première fenêtre ne doit pas quitter l'app.
app.on('window-all-closed', () => {})
// Pas d'`await` au niveau supérieur avant `ready` : Electron ne démarrerait pas.
void app.whenReady().then(async () => {
  writeFileSync(join(root, 'build', 'background.png'), await render(1))
  writeFileSync(join(root, 'build', 'background@2x.png'), await render(2))
  console.log(`build/background.png : ${WIDTH} × ${HEIGHT} (et @2x)`)
  app.quit()
})
