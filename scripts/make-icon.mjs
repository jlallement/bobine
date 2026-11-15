/**
 * Produit build/icon.png (1024 × 1024, fond transparent) à partir de build/icon.svg, avec le
 * moteur de rendu d'Electron : rien à installer. electron-builder en tire l'icône macOS (.icns).
 *
 *   pnpm exec electron scripts/make-icon.mjs
 *
 * Avec `--linux` (fiche 145) : les tailles du thème d'icônes hicolor, de 16 à 512 px
 * (build/icons/<n>x<n>.png, lues par electron-builder pour le .deb), réduites depuis
 * build/icon.png, qui reste tel quel (l'icône du Mac ne change pas). À relancer après chaque
 * nouvelle build/icon.png ; `scripts/linux-icons.test.ts` vérifie qu'elles sont là et à leur taille.
 *
 *   pnpm exec electron scripts/make-icon.mjs --linux
 *
 * Avec `--win` (fiche 229) : build/icon.ico, une image par taille de `WINDOWS_ICON_SIZES` (16 à
 * 256 px), réduites depuis build/icon.png comme pour Linux ; `scripts/windows-icon.test.ts` vérifie
 * les tailles.
 *
 *   pnpm exec electron scripts/make-icon.mjs --win
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { app, BrowserWindow, nativeImage } from 'electron'
import { LINUX_ICON_SIZES } from './linux-icons.mjs'
import { WINDOWS_ICON_SIZES, encodeIco } from './windows-icon.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const svg = readFileSync(join(root, 'build', 'icon.svg'), 'utf8')

app.dock?.hide()
// Pas d'`await` au niveau supérieur avant `ready` : Electron ne démarrerait pas.
void app.whenReady().then(async () => {
  if (process.argv.includes('--win')) {
    const source = nativeImage.createFromPath(join(root, 'build', 'icon.png'))
    const images = WINDOWS_ICON_SIZES.map((size) => ({
      size,
      png: source.resize({ width: size, height: size, quality: 'best' }).toPNG()
    }))
    writeFileSync(join(root, 'build', 'icon.ico'), encodeIco(images))
    console.log(`build/icon.ico : ${WINDOWS_ICON_SIZES.map((n) => `${n}x${n}`).join(', ')}`)
    app.quit()
    return
  }
  if (process.argv.includes('--linux')) {
    const source = nativeImage.createFromPath(join(root, 'build', 'icon.png'))
    const dir = join(root, 'build', 'icons')
    mkdirSync(dir, { recursive: true })
    for (const size of LINUX_ICON_SIZES) {
      const png = source.resize({ width: size, height: size, quality: 'best' }).toPNG()
      writeFileSync(join(dir, `${size}x${size}.png`), png)
    }
    console.log(`build/icons : ${LINUX_ICON_SIZES.map((n) => `${n}x${n}`).join(', ')}`)
    app.quit()
    return
  }
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
