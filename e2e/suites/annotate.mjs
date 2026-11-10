import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MAIN_PORT, attachPage, check, mainProcess, sleep, withApp } from '../lib.mjs'

const FIXTURE = fileURLToPath(new URL('../fixtures/capture.png', import.meta.url))

/** Point du canevas d'annotation, en fraction de sa taille (0 à 1). */
const at = (ui, fx, fy) =>
  ui.ev(
    `(() => { const r = document.querySelector('[data-testid=annotator-canvas]').getBoundingClientRect(); return { x: r.x + r.width * ${fx}, y: r.y + r.height * ${fy} } })()`
  )

/** Dessine un rectangle, une flèche et un texte sur l'image ouverte. */
async function draw(ui) {
  await ui.waitFor(
    `document.querySelector('[data-testid=annotator-canvas]')?.dataset.ready === 'true'`
  )
  await ui.drag(await at(ui, 0.2, 0.2), await at(ui, 0.6, 0.45))
  await ui.click(ui.$('annotator-tool-arrow'))
  await ui.drag(await at(ui, 0.85, 0.85), await at(ui, 0.6, 0.5))
  await ui.click(ui.$('annotator-tool-text'))
  await ui.click(ui.$('annotator-color-blue'))
  // Clic à un point précis : la saisie du texte s'ouvre là.
  const point = await at(ui, 0.25, 0.7)
  await ui.drag(point, point)
  await ui.waitFor(`!!document.querySelector('[data-testid=annotator-text]')`)
  await ui.type('ici')
  if (ui.press) await ui.press('Enter')
  else await ui.enter()
  await ui.waitFor(`!document.querySelector('[data-testid=annotator-text]')`)
}

/**
 * Annoter une image jointe (fiche 067) : capture simulée, rectangle, flèche et texte à la souris,
 * « Appliquer » (image changée, mêmes dimensions) ; « Fermer » sans rien changer ; dans la
 * fenêtre rapide aussi.
 */
export async function annotateSuite(scheme) {
  console.log(`\n— Annoter une image (${scheme})`)
  const bin = mkdtempSync(join(tmpdir(), 'bob-e2e-annoter-'))
  const screencapture = join(bin, 'screencapture')
  writeFileSync(screencapture, `#!/bin/sh\nfor last; do :; done\ncp "${FIXTURE}" "$last"\n`)
  chmodSync(screencapture, 0o755)
  const image = (selector) =>
    `(() => { const img = ${selector}; return img ? { src: img.src.length + ':' + img.src.slice(-40), w: img.naturalWidth, h: img.naturalHeight } : null })()`
  try {
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        await ui.click(ui.$('capture'))
        await ui.waitFor(`!!document.querySelector('[data-testid=attachment-annotate] img')`)
        const before = await ui.ev(
          image(`document.querySelector('[data-testid=attachment-annotate] img')`)
        )

        // Fermer sans appliquer : rien ne change.
        await ui.click(ui.$('attachment-annotate'))
        await ui.waitFor(`!!${ui.$('annotator')}`)
        await ui.waitFor(
          `document.querySelector('[data-testid=annotator-canvas]')?.dataset.ready === 'true'`
        )
        await ui.drag(await at(ui, 0.3, 0.3), await at(ui, 0.5, 0.5))
        await ui.key('Escape')
        await ui.waitFor(`!${ui.$('annotator')}`)
        const kept = await ui.ev(
          image(`document.querySelector('[data-testid=attachment-annotate] img')`)
        )
        check(kept?.src === before?.src, 'Échap : image inchangée')

        // Annoter et appliquer.
        await ui.click(ui.$('attachment-annotate'))
        await ui.waitFor(`!!${ui.$('annotator')}`)
        // Les barres du haut sont « déplaçables » : macOS y prend les clics avant la page. La
        // fenêtre d'annotation, qui les chevauche, ne doit pas l'être (vrais clics, pas ceux du CDP).
        const region = await ui.ev(`(() => {
          const bar = document.querySelector('.annotator-bar').getBoundingClientRect()
          const head = document.querySelector('.main-header').getBoundingClientRect()
          const style = (el) => getComputedStyle(el).getPropertyValue('-webkit-app-region') || getComputedStyle(el).webkitAppRegion
          return { overlaps: bar.top < head.bottom, overlay: style(document.querySelector('.dialog-overlay')), dialog: style(document.querySelector('[data-testid=annotator]')) }
        })()`)
        check(
          region.overlay === 'no-drag' && region.dialog === 'no-drag',
          `fenêtre d’annotation non déplaçable (chevauche la barre du haut : ${region.overlaps})`
        )
        await draw(ui)
        check(
          !(await ui.ev(`${ui.$('annotator-undo')}.disabled`)),
          'rectangle, flèche et texte dessinés (« Annuler le dernier » actif)'
        )
        // Texte long (fiche 094) : il revient à la ligne sans sortir de l'image.
        const right = await at(ui, 0.55, 0.12)
        await ui.drag(right, right)
        await ui.waitFor(`!!document.querySelector('[data-testid=annotator-text]')`)
        await ui.type('Le bouton Exporter ne fait rien quand on clique dessus, sans un message')
        const box = await ui.ev(`(() => {
          const input = document.querySelector('[data-testid=annotator-text]')
          const text = input.getBoundingClientRect()
          const canvas = document.querySelector('[data-testid=annotator-canvas]').getBoundingClientRect()
          const line = parseFloat(getComputedStyle(input).lineHeight)
          return { right: Math.round(text.right), limit: Math.round(canvas.right), lines: Math.round((text.height - 2) / line) }
        })()`)
        check(
          box.right <= box.limit + 4 && box.lines >= 2,
          `texte long : revient à la ligne dans l’image (${box.lines} lignes, bord ${box.right} ≤ ${box.limit})`
        )
        if (ui.press) await ui.press('Enter')
        else await ui.enter()
        await ui.waitFor(`!document.querySelector('[data-testid=annotator-text]')`)
        await ui.shot('n0-annotation')
        await ui.click(ui.$('annotator-apply'))
        await ui.waitFor(`!${ui.$('annotator')}`)
        await sleep(200)
        const after = await ui.ev(
          image(`document.querySelector('[data-testid=attachment-annotate] img')`)
        )
        check(
          after &&
            before &&
            after.src !== before.src &&
            after.w === before.w &&
            after.h === before.h,
          `appliquée : image annotée à la place, mêmes dimensions (${after?.w}×${after?.h})`
        )
        await ui.shot('n1-image-annotee')

        // Fenêtre rapide.
        const main = await mainProcess()
        try {
          await main.evaluate(
            `(require('electron').Menu.getApplicationMenu().getMenuItemById('quick-entry').click(), true)`
          )
          const quick = await attachPage('#quick', scheme)
          try {
            await quick.waitFor(`!!${quick.$('quick-capture')}`)
            await quick.click(quick.$('quick-capture'))
            await quick.waitFor(`!!document.querySelector('[data-testid=quick-annotate] img')`)
            const q0 = await quick.ev(
              image(`document.querySelector('[data-testid=quick-annotate] img')`)
            )
            const height = () =>
              main.evaluate(
                `require('electron').BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes('#quick')).getBounds().height`
              )
            const small = await height()
            await quick.click(quick.$('quick-annotate'))
            await quick.waitFor(`!!${quick.$('annotator')}`)
            await sleep(300)
            const big = await height()
            await draw(quick)
            await quick.shot('n2-annotation-fenetre-rapide')
            await quick.click(quick.$('annotator-apply'))
            await quick.waitFor(`!${quick.$('annotator')}`)
            await sleep(300)
            const q1 = await quick.ev(
              image(`document.querySelector('[data-testid=quick-annotate] img')`)
            )
            check(
              big > small && q1 && q0 && q1.src !== q0.src && q1.w === q0.w,
              `fenêtre rapide : agrandie pour annoter (${small} → ${big} px), image annotée`
            )
            check((await height()) < big, 'fenêtre rapide : revenue à sa taille')
          } finally {
            quick.close()
          }
        } finally {
          main.close()
        }
      },
      undefined,
      'streaming-texte',
      { BOBINE_SCREENCAPTURE: screencapture },
      [`--inspect=${MAIN_PORT}`]
    )
  } finally {
    rmSync(bin, { recursive: true, force: true })
  }
}
