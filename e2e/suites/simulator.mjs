import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { L, root, sleep, check, withApp } from '../lib.mjs'
import { streamGeometry } from '../../src/main/simulator/bgra-frames.ts'

/**
 * Simulateur iOS (fiches 008, 009, 044) sans simulateur : de faux `xcrun` et `axe` (BOBINE_XCRUN,
 * BOBINE_AXE) imitent un iPhone 17 démarré et notent chaque appel. L'image de test a les proportions
 * de l'écran (402×874) ; le faux flux BGRA a la taille que l'app en déduit.
 */
export async function simulatorSuite(scheme) {
  console.log(`\n— Simulateur iOS (${scheme})`)
  const workspace = mkdtempSync(join(tmpdir(), 'bob-e2e-ios-'))
  mkdirSync(join(workspace, 'Demo.xcodeproj'))
  const bin = mkdtempSync(join(tmpdir(), 'bob-e2e-bin-'))
  const log = join(bin, 'appels.log')
  const jpeg = join(root, 'e2e/fixtures/simulateur.jpg')
  const devices = JSON.stringify({
    devices: {
      'com.apple.CoreSimulator.SimRuntime.iOS-26-5': [
        {
          udid: 'FAUX-1',
          name: 'iPhone factice',
          state: 'Booted',
          isAvailable: true,
          deviceTypeIdentifier: 'com.apple.CoreSimulator.SimDeviceType.iPhone-17'
        }
      ]
    }
  })
  const screen = JSON.stringify([
    {
      type: 'Application',
      AXLabel: 'Demo',
      frame: { x: 0, y: 0, width: 402, height: 874 },
      children: [
        { type: 'Button', AXLabel: 'Ajouter un', frame: { x: 150, y: 511, width: 102, height: 34 } }
      ]
    }
  ])
  writeFileSync(
    join(bin, 'xcrun'),
    `#!/bin/sh
echo "xcrun $*" >> '${log}'
case "$2" in
  list) echo '${devices}' ;;
  launch) echo "fr.bobine.demo: 42" ;;
  io) for last; do :; done; cp '${jpeg}' "$last" ;;
  pbcopy) cat > /dev/null ;;
esac
exit 0
`
  )
  // Image BGRA opaque (alpha FF) de la taille attendue pour une capture de 402×874 pixels.
  const geometry = streamGeometry({ width: 402, height: 874 })
  // Deux couleurs, cinq images chacune : le flux change, comme un écran qui défile (fiche 075).
  for (const [name, color] of [
    ['frame.bgra', [40, 90, 200, 255]],
    ['frame2.bgra', [200, 120, 40, 255]]
  ]) {
    const frame = Buffer.alloc(geometry.frameSize)
    for (let p = 0; p < geometry.frameSize; p += 4) frame.set(color, p)
    writeFileSync(join(bin, name), frame)
  }
  writeFileSync(
    join(bin, 'axe'),
    `#!/bin/sh
if [ "$1" = "--version" ]; then echo 1.8.0; exit 0; fi
echo "axe $*" >> '${log}'
if [ "$1" = "describe-ui" ]; then echo '${screen}'; fi
if [ "$1" = "stream-video" ] && [ "$5" = "bgra" ]; then
  i=0
  while [ $i -lt 80 ]; do
    if [ $(( (i / 5) % 2 )) -eq 0 ]; then cat '${join(bin, 'frame.bgra')}'; else cat '${join(bin, 'frame2.bgra')}'; fi
    i=$((i + 1))
    sleep 0.05
  done
  echo "Simulateur perdu" >&2
  exit 1
fi
if [ "$1" = "stream-video" ]; then
  size=$(wc -c < '${jpeg}' | tr -d ' ')
  printf 'HTTP/1.1 200 OK\r\nContent-Type: multipart/x-mixed-replace; boundary=--mjpegstream\r\n\r\n'
  i=0
  while [ $i -lt 60 ]; do
    printf -- '--mjpegstream\r\nContent-Type: image/jpeg\r\nContent-Length: %s\r\n\r\n' "$size"
    cat '${jpeg}'
    printf '\r\n'
    i=$((i + 1))
    sleep 0.05
  done
  echo "Simulateur perdu" >&2
  exit 1
fi
exit 0
`
  )
  chmodSync(join(bin, 'xcrun'), 0o755)
  chmodSync(join(bin, 'axe'), 0o755)
  const calls = () => {
    try {
      return readFileSync(log, 'utf8')
    } catch {
      return ''
    }
  }
  try {
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        // La version laisse sa place aux FPS après la première seconde de direct : la relever
        // à son apparition plutôt qu'après la réponse complète de l'agent.
        await ui.ev(`(() => {
          window.__axeVersionSeen = null
          const expected = ${JSON.stringify(L('simulator.axe', { version: '1.8.0' }))}
          const observer = new MutationObserver(() => {
            const version = [...document.querySelectorAll('.simulator-bar .simulator-name')]
              .find((el) => el.innerText.trim() === expected)
            if (version) { window.__axeVersionSeen = version.innerText.trim(); observer.disconnect() }
          })
          observer.observe(document.body, { subtree: true, childList: true, characterData: true })
          return true
        })()`)
        await ui.send('Teste l’app iOS')
        await ui.ready()
        const reply = await ui.lastAgentText()
        check(
          reply.includes('* iPhone factice') && reply.includes('fr.bobine.demo launched'),
          'appareil démarré trouvé, app lancée'
        )
        check(
          calls().includes('axe tap -x 201 -y 528 --udid FAUX-1'),
          'écran lu par l’accessibilité, toucher au centre du bouton désigné'
        )
        check(
          calls().includes('xcrun simctl pbcopy FAUX-1') &&
            calls().includes('axe key-combo --modifiers 227 --key 25 --udid FAUX-1'),
          'saisie « Zoé » collée (presse-papiers + ⌘V)'
        )
        check(
          !(await ui.ev(`!!${ui.$('permission')}`)) && (await ui.ev(`!!${ui.$('simulator-tab')}`)),
          'aucune autorisation demandée ; onglet « Simulateur » ouvert tout seul'
        )
        check(
          (await ui.ev('window.__axeVersionSeen')) === L('simulator.axe', { version: '1.8.0' }),
          'version d’AXe affichée avant le passage aux FPS'
        )
        await ui.waitFor(`!!${ui.$('simulator-live')} && ${ui.$('simulator-video')}.width > 10`)
        check(
          calls().includes(
            `axe stream-video --udid FAUX-1 --format bgra --fps 30 --scale ${geometry.scale}`
          ) && (await ui.ev(`${ui.$('simulator-video')}.width`)) === geometry.width,
          'flux vidéo démarré (AXe, image de l’appareil en BGRA, encodée en JPEG) et dessiné'
        )
        // Débit affiché dans la barre à la place de la version d'AXe pendant le direct.
        await ui.waitFor(`/^\\d+ fps$/.test(${ui.$('simulator-fps')}?.innerText ?? '')`, 5000)
        const fps = Number.parseInt(await ui.ev(`${ui.$('simulator-fps')}.innerText`), 10)
        check(
          fps >= 8 &&
            fps <= 30 &&
            !(await ui.ev(`document.querySelector('.simulator-bar').innerText`)).includes(
              L('simulator.axe', { version: '1.8.0' })
            ) &&
            (await ui.ev(`${ui.$('simulator-fps')}.getAttribute('title')`)) ===
              L('simulator.fpsWithAxe', { version: '1.8.0' }),
          `débit en direct affiché (${fps} fps), version d’AXe dans l’infobulle pendant le direct`
        )
        await ui.shot('28b-simulateur-direct')
        // « Joindre au message » (fiche 066) : l'image arrive dans la zone de saisie, puis retirée.
        await ui.click(ui.$('simulator-attach'))
        await ui.waitFor(
          `[...document.querySelectorAll('[data-testid=attachment]')].some((a) => a.querySelector('img') && a.title.startsWith('${L('simulator.title', { name: 'iPhone' })}'))`
        )
        check(true, 'écran du simulateur joint au message')
        // Le « × » n'apparaît qu'au survol : retrait déclenché directement.
        await ui.ev(
          `[...document.querySelectorAll('[data-testid=attachment]')].find((a) => a.title.startsWith('${L('simulator.title', { name: 'iPhone' })}')).querySelector('.attachment-remove').click()`
        )
        await ui.waitFor(`!document.querySelector('[data-testid=attachment]')`)

        // Châssis (fiche 044) : tour, coins arrondis d'un iPhone récent, écran aux proportions.
        const device = await ui.ev(
          `(() => { const d = ${ui.$('simulator-device')}; const s = ${ui.$('simulator-display')}; const r = s.getBoundingClientRect(); return { radius: parseFloat(getComputedStyle(s).borderRadius), outer: parseFloat(getComputedStyle(d).borderRadius), ratio: r.width / r.height, home: d.dataset.homeButton ?? null } })()`
        )
        check(
          device.radius > 10 &&
            device.outer > device.radius &&
            Math.abs(device.ratio - 402 / 874) < 0.01 &&
            device.home === null,
          `châssis d’iPhone : coins arrondis (${Math.round(device.radius)} px), écran aux proportions, pas de bouton d’accueil`
        )
        check(
          await ui.ev(
            `${ui.$('simulator-controls')}.getBoundingClientRect().top >= ${ui.$('simulator-device')}.getBoundingClientRect().bottom && !!${ui.$('simulator-controls')}.querySelector('[aria-label="${L('simulator.lock')}"]')`
          ),
          'commandes (accueil, verrouillage, joindre) dans la barre sous l’iPhone'
        )
        const video = await ui.ev(
          `(() => { const r = ${ui.$('simulator-video')}.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 4, w: r.width } })()`
        )
        await ui.drag(video, video)
        await sleep(500)
        // Centre horizontal, quart de la hauteur : (201, 218) en points.
        const tap = [...calls().matchAll(/axe tap -x (\d+) -y (\d+) --udid FAUX-1/g)].at(-1)
        check(
          !!tap && Math.abs(Number(tap[1]) - 201) <= 3 && Math.abs(Number(tap[2]) - 218) <= 3,
          'clic sur la vidéo : toucher au point correspondant de l’écran'
        )
        // Glisser vers la gauche sur un tiers de l'écran : balayage (changement de page).
        await ui.drag(
          { x: video.x + video.w / 4, y: video.y },
          { x: video.x - video.w / 4, y: video.y }
        )
        await sleep(500)
        const swipe = [
          ...calls().matchAll(
            /axe swipe --start-x (\d+) --start-y (\d+) --end-x (\d+) --end-y (\d+) --duration ([\d.]+) --udid FAUX-1/g
          )
        ].at(-1)
        check(
          !!swipe &&
            Math.abs(Number(swipe[1]) - 301) <= 3 &&
            Math.abs(Number(swipe[3]) - 101) <= 3 &&
            Number(swipe[2]) === Number(swipe[4]) &&
            Number(swipe[5]) >= 0.05,
          'glisser sur l’écran : balayage entre les deux points, de la durée du geste'
        )
        // Molette vers le bas sur l'écran : un balayage court vers le haut, à l'endroit du pointeur.
        await ui.wheel({ x: video.x, y: video.y }, 0, 240)
        await sleep(600)
        const scroll = [
          ...calls().matchAll(
            /axe swipe --start-x (\d+) --start-y (\d+) --end-x (\d+) --end-y (\d+) --duration 0\.25 --udid FAUX-1/g
          )
        ].at(-1)
        check(
          !!scroll &&
            Number(scroll[1]) === Number(scroll[3]) &&
            Math.abs(Number(scroll[1]) - 201) <= 3 &&
            Number(scroll[4]) < Number(scroll[2]),
          'molette : défilement = balayage vers le haut à l’endroit du pointeur'
        )
        await ui.waitFor(`${ui.$('simulator-screen')}?.naturalWidth > 10`, 20000)
        check(
          (await ui.ev(`document.querySelector('.simulator-tab').innerText`)).includes(
            'Simulateur perdu'
          ),
          'flux interrompu : retour aux captures successives, raison affichée'
        )
        check(
          (await ui.ev(`document.querySelector('.simulator-name').innerText`)).includes(
            'iPhone factice'
          ),
          'capture de l’appareil affichée dans l’onglet, à l’échelle des points'
        )
        await ui.shot('28-simulateur')

        // Zoom (fiche 084) : « ajuster » au départ, taille réelle (1 point de l'appareil = 1 point),
        // défilement avec la barre de commandes visible, toucher juste une fois zoomé, retour.
        const zoomButton = (id) => ui.$(`simulator-zoom-${id}`)
        const stage = ui.$('simulator-stage')
        check(
          (await ui.ev(`${zoomButton('fit')}.getAttribute('aria-pressed') === 'true'`)) &&
            /%/.test(await ui.ev(`${zoomButton('level')}.innerText`)),
          'zoom : « ajuster » au départ, niveau affiché'
        )
        await ui.click(zoomButton('actual'))
        await ui.waitFor(
          `Math.abs(${ui.$('simulator-display')}.getBoundingClientRect().width - 402) < 1`
        )
        check(
          await ui.ev(
            `${stage}.classList.contains('zoomed') && ${stage}.scrollHeight > ${stage}.clientHeight && ${zoomButton('level')}.innerText.startsWith('100') && ${ui.$('simulator-controls')}.getBoundingClientRect().bottom <= innerHeight && ${ui.$('simulator-controls')}.getBoundingClientRect().top >= ${stage}.getBoundingClientRect().bottom - 1`
          ),
          'taille réelle : 1 point par point, l’appareil défile, la barre de commandes reste visible'
        )
        // Milieu de la partie visible de l'écran : le zoom part du centre, pas du coin en haut à gauche.
        const visible = await ui.ev(
          `(() => { const s = ${stage}.getBoundingClientRect(); const d = ${ui.$('simulator-display')}.getBoundingClientRect(); const x = (Math.max(s.left, d.left) + Math.min(s.right, d.right)) / 2; const y = (Math.max(s.top, d.top) + Math.min(s.bottom, d.bottom)) / 2; return { x, y, fx: (x - d.left) / d.width, fy: (y - d.top) / d.height } })()`
        )
        check(
          Math.abs(visible.fy - 0.5) < 0.1,
          `zoom depuis « ajuster » : le milieu de l’écran reste au centre (${Math.round(visible.fy * 100)} %)`
        )
        await ui.drag(visible, visible)
        await sleep(500)
        const zoomTap = [...calls().matchAll(/axe tap -x (\d+) -y (\d+) --udid FAUX-1/g)].at(-1)
        check(
          !!zoomTap &&
            Math.abs(Number(zoomTap[1]) - visible.fx * 402) <= 3 &&
            Math.abs(Number(zoomTap[2]) - visible.fy * 874) <= 3,
          'zoomé : un clic touche le point correspondant de l’écran'
        )
        // Zoomé, la molette déplace la vue ; elle ne fait plus défiler l'app (on glisse pour cela).
        const swipes = () => [...calls().matchAll(/axe swipe/g)].length
        const swipesBefore = swipes()
        const scrolled = await ui.ev(`${stage}.scrollTop`)
        await ui.wheel(visible, 0, 240)
        await sleep(600)
        check(
          (await ui.ev(`${stage}.scrollTop`)) > scrolled && swipes() === swipesBefore,
          'zoomé : la molette déplace la vue, sans faire défiler l’app'
        )
        await ui.shot('28e-simulateur-zoom')
        await ui.click(zoomButton('in'))
        await ui.waitFor(
          `Math.abs(${ui.$('simulator-display')}.getBoundingClientRect().width - 402 * 1.25) < 1`
        )
        check(
          (await ui.ev(`${zoomButton('level')}.innerText`)).startsWith('125'),
          'zoomer : palier suivant (125 %)'
        )
        await ui.click(zoomButton('fit'))
        await ui.waitFor(`!${stage}.classList.contains('zoomed')`)
        // La place peut avoir changé entre-temps (avis de flux interrompu) : l'appareil tient en entier.
        check(
          await ui.ev(
            `(() => { const a = ${stage}.parentElement.getBoundingClientRect(); const d = ${ui.$('simulator-device')}.getBoundingClientRect(); return d.top >= a.top - 1 && d.bottom <= a.bottom + 1 && d.left >= a.left - 1 && d.right <= a.right + 1 })()`
          ),
          '« ajuster » : l’appareil tient de nouveau en entier dans le panneau'
        )
      },
      undefined,
      'simulateur',
      {
        BOBINE_WORKSPACE: workspace,
        BOBINE_XCRUN: join(bin, 'xcrun'),
        BOBINE_AXE: join(bin, 'axe')
      }
    )

    // Planche contact (fiche 075) : le flux d'AXe filmé pendant un balayage, en une image.
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        await ui.send('/scenario planche-ios')
        await ui.ready()
        const sheet = await ui.lastAgentText()
        const frames = Number(/: (\d+) frames, numbered/.exec(sheet)?.[1] ?? 0)
        check(
          frames >= 2 &&
            sheet.includes('ios_tap') &&
            calls().includes('axe swipe --start-x 200 --start-y 600 --end-x 200 --end-y 200'),
          `planche contact iOS : balayage filmé dans le flux d’AXe (${frames} images différentes)`
        )
        check(
          await ui.ev(
            `(() => { const img = [...document.querySelectorAll('[data-testid=tool-images] img')].at(-1); return !!img && img.naturalWidth > 300 })()`
          ),
          'planche contact iOS affichée dans la carte de l’outil'
        )
        await ui.shot('28c-planche-simulateur')
      },
      undefined,
      'simulateur',
      {
        BOBINE_WORKSPACE: workspace,
        BOBINE_XCRUN: join(bin, 'xcrun'),
        BOBINE_AXE: join(bin, 'axe')
      }
    )
  } finally {
    rmSync(workspace, { recursive: true, force: true })
    rmSync(bin, { recursive: true, force: true })
  }
}
