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
  // Faux AXe : `--version` répond comme AXe 2 (« v2.0.4 », fiche 273).
  writeFileSync(
    join(bin, 'axe'),
    `#!/bin/sh
if [ "$1" = "--version" ]; then echo v2.0.4; exit 0; fi
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
          const expected = ${JSON.stringify(L('simulator.axe', { version: '2.0.4' }))}
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
          !(await ui.ev(`!!${ui.$('permission')}`)) && (await ui.ev(`!!${ui.$('simulator-tab')}`)),
          'aucune autorisation demandée ; onglet « Simulateur » ouvert tout seul'
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
        await ui.shot('28b-simulateur-direct')
        // « Joindre au message » (fiche 066) : l'image arrive dans la zone de saisie, puis retirée.
        await ui.click(ui.$('simulator-attach'))
        await ui.waitFor(
          `[...document.querySelectorAll('[data-testid=attachment]')].some((a) => a.querySelector('img') && a.title.startsWith('${L('simulator.title', { name: 'iPhone' })}'))`
        )
        // Le « × » n'apparaît qu'au survol : retrait déclenché directement.
        await ui.ev(
          `[...document.querySelectorAll('[data-testid=attachment]')].find((a) => a.title.startsWith('${L('simulator.title', { name: 'iPhone' })}')).querySelector('.attachment-remove').click()`
        )
        await ui.waitFor(`!document.querySelector('[data-testid=attachment]')`)
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
        // Glisser vers la gauche sur un tiers de l'écran : balayage (changement de page).
        await ui.drag(
          { x: video.x + video.w / 4, y: video.y },
          { x: video.x - video.w / 4, y: video.y }
        )
        await sleep(500)
        // Molette vers le bas sur l'écran : un balayage court vers le haut, à l'endroit du pointeur.
        await ui.wheel({ x: video.x, y: video.y }, 0, 240)
        await sleep(600)
        await ui.waitFor(`${ui.$('simulator-screen')}?.naturalWidth > 10`, 20000)
        await ui.shot('28-simulateur')

        // Zoom (fiche 084) : « ajuster » au départ, taille réelle (1 point de l'appareil = 1 point),
        // défilement avec la barre de commandes visible, toucher juste une fois zoomé, retour.
        const zoomButton = (id) => ui.$(`simulator-zoom-${id}`)
        const stage = ui.$('simulator-stage')
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
        await ui.drag(visible, visible)
        await sleep(500)
        await ui.wheel(visible, 0, 240)
        await sleep(600)
        await ui.shot('28e-simulateur-zoom')
        await ui.click(zoomButton('in'))
        await ui.waitFor(
          `Math.abs(${ui.$('simulator-display')}.getBoundingClientRect().width - 402 * 1.25) < 1`
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
