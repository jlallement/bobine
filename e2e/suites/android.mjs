import { execFileSync } from 'node:child_process'
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { L, root, sleep, check, withApp } from '../lib.mjs'

/**
 * Émulateur Android (fiche 032) sans émulateur : un faux SDK (`ANDROID_HOME`) dont le faux `adb`
 * imite un appareil 1080×2400 à 420 ppp, rejoue un extrait H.264 réel et note chaque appel. Pour
 * la planche contact (fiche 076), son `screenrecord --output-format=frames` envoie des images
 * brutes où une bande descend, comme un écran qui défile. Cadre de l'appareil (fiche 081) : son
 * orientation (`dumpsys window displays`) et sa capture sont des fichiers que l'essai change pour
 * le tourner en paysage, puis en faire une tablette (comme un pliable qu'on déplie).
 */

/** Réponse de `dumpsys window displays | grep …` pour un écran de `width`×`height` px. */
const displays = (width, height, rotation) =>
  `    init=1080x2400 420dpi mMinSizeOfResizeableTaskDp=220 cur=${width}x${height} app=${width}x${height}\n      mCurrentRotation=ROTATION_${rotation}\n`

/** Image au format `frames` de screenrecord : en-tête de 20 octets, pixels RGB, une bande bleue. */
function rawFrame(width, height, bandTop) {
  const pixels = Buffer.alloc(width * height * 3, 235)
  for (let y = bandTop; y < Math.min(height, bandTop + 120); y++) {
    for (let x = 0; x < width; x++) pixels.set([40, 90, 200], (y * width + x) * 3)
  }
  const head = Buffer.alloc(20)
  head.writeUInt32LE(16 + pixels.length, 0)
  head.writeUInt32LE(width, 4)
  head.writeUInt32LE(height, 8)
  head.writeUInt32LE(width * 3, 12)
  head.writeUInt32LE(3, 16)
  return Buffer.concat([head, pixels])
}
export async function androidSuite(scheme) {
  console.log(`\n— Émulateur Android (${scheme})`)
  const workspace = mkdtempSync(join(tmpdir(), 'bob-e2e-android-'))
  writeFileSync(join(workspace, 'settings.gradle'), '')
  writeFileSync(join(workspace, 'gradlew'), '')
  const sdk = mkdtempSync(join(tmpdir(), 'bob-e2e-sdk-'))
  mkdirSync(join(sdk, 'platform-tools'))
  mkdirSync(join(sdk, 'emulator'))
  const log = join(sdk, 'appels.log')
  // Attentes du faux `adb` reconnaissables (fiche 208) : `sleep 30.<marque>`, propre à cet essai.
  // Ce sont des enfants d'`adb` : arrêter le seul `adb` les laissait vivre après l'app (et avec
  // eux le crashpad d'Electron).
  const mark = `${String(process.pid).padStart(6, '0')}${scheme === 'dark' ? 1 : 0}`
  const nap = (seconds) => `${seconds}.${mark}`
  const naps = () =>
    execFileSync('ps', ['-axww', '-o', 'pid=,command='], { encoding: 'utf8' })
      .split('\n')
      .filter((line) => new RegExp(`sleep \\d+\\.${mark}$`).test(line.trim()))
  const nothingLeft = async (what) => {
    let left = naps()
    for (let i = 0; i < 5 && left.length > 0; i++) {
      await sleep(100)
      left = naps()
    }
    for (const line of left) process.kill(Number(line.trim().split(/\s+/)[0]), 'SIGKILL')
    check(
      left.length === 0,
      `${what} : rien du faux \`adb\` ne survit à l'app (${left.join(' | ')})`
    )
  }
  const video = join(root, 'e2e/fixtures/android.h264')
  const screenFile = join(sdk, 'screen.jpg')
  const displaysFile = join(sdk, 'displays')
  copyFileSync(join(root, 'e2e/fixtures/android-portrait.jpg'), screenFile)
  writeFileSync(displaysFile, displays(1080, 2400, 0))
  // Quatre images (411×914 dp) : la bande descend de 200 dp à chaque image.
  for (let i = 0; i < 4; i++)
    writeFileSync(join(sdk, `frame${i}.raw`), rawFrame(411, 914, 100 + i * 200))
  const ui = `<?xml version='1.0' encoding='UTF-8' standalone='yes' ?><hierarchy rotation="0"><node text="" class="android.widget.LinearLayout" resource-id="" content-desc="" clickable="false" enabled="true" bounds="[0,0][1080,2400]"><node text="Ajouter un" class="android.widget.Button" resource-id="" content-desc="" clickable="true" enabled="true" bounds="[100,1000][500,1100]" /></node></hierarchy>`
  writeFileSync(
    join(sdk, 'platform-tools/adb'),
    `#!/bin/sh
echo "adb $*" >> '${log}'
[ "$1" = "-s" ] && shift 2
case "$*" in
  "devices -l") printf 'List of devices attached\\nemulator-5554\\tdevice model:sdk_gphone64\\n' ;;
  "emu avd name") printf 'Pixel_factice\\nOK\\n' ;;
  "shell wm size") echo "Physical size: 1080x2400" ;;
  "shell wm density") echo "Physical density: 420" ;;
  "shell dumpsys window displays"*) cat '${displaysFile}' ;;
  "shell getprop sys.boot_completed") echo 1 ;;
  "shell cmd package resolve-activity"*) echo "fr.bobine.demo/.MainActivity" ;;
  "exec-out uiautomator dump /dev/tty") echo '${ui}' ;;
  "exec-out screencap -p") cat '${screenFile}' ;;
  "exec-out screenrecord --output-format=frames"*)
    i=0
    while [ $i -lt 12 ]; do cat '${sdk}'/frame$(( (i / 3) % 4 )).raw; i=$((i + 1)); sleep 0.08; done
    sleep ${nap(20)} ;;
  "exec-out screenrecord --output-format=h264 --size 544x1200"*) cat '${video}'; sleep ${nap(3)} ;;
  "exec-out screenrecord"*) sleep ${nap(30)} ;;
esac
exit 0
`
  )
  writeFileSync(join(sdk, 'emulator/emulator'), `#!/bin/sh\necho Pixel_factice\n`)
  chmodSync(join(sdk, 'platform-tools/adb'), 0o755)
  chmodSync(join(sdk, 'emulator/emulator'), 0o755)
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
        await ui.send('Teste l’app Android')
        await ui.ready()
        const reply = await ui.lastAgentText()
        check(
          reply.includes('* Pixel_factice — device — emulator-5554') &&
            reply.includes('fr.bobine.demo/.MainActivity launched'),
          'appareil trouvé (nom de l’AVD), app lancée par son activité'
        )
        check(
          calls().includes('shell input tap 299 1050') &&
            calls().includes("shell input text 'Ada'"),
          'écran lu, toucher au centre du bouton (dp → px), saisie'
        )
        check(
          !(await ui.ev(`!!${ui.$('permission')}`)) && (await ui.ev(`!!${ui.$('android-tab')}`)),
          'aucune autorisation demandée ; onglet « Android » ouvert tout seul'
        )
        await ui.waitFor(`!!${ui.$('android-live')} && ${ui.$('android-video')}.width > 10`, 20000)
        await ui.waitFor(`/^\\d+ fps$/.test(${ui.$('android-fps')}?.innerText ?? '')`, 5000)
        check(true, 'débit de la vidéo affiché dans la barre (fps)')
        check(
          calls().includes('exec-out screenrecord --output-format=h264'),
          'vidéo H.264 de screenrecord décodée par Chromium et dessinée'
        )
        await ui.shot('29-android')
        // « Joindre au message » (fiche 066) : l'image arrive dans la zone de saisie, puis retirée.
        await ui.click(ui.$('android-attach'))
        await ui.waitFor(
          `[...document.querySelectorAll('[data-testid=attachment]')].some((a) => a.querySelector('img') && a.title.startsWith('${L('android.title', { name: 'Pixel_factice' })}'))`
        )
        check(true, 'écran de l’émulateur Android joint au message')
        // Le « × » n'apparaît qu'au survol : retrait déclenché directement.
        await ui.ev(
          `[...document.querySelectorAll('[data-testid=attachment]')].find((a) => a.title.startsWith('${L('android.title', { name: 'Pixel_factice' })}')).querySelector('.attachment-remove').click()`
        )
        await ui.waitFor(`!document.querySelector('[data-testid=attachment]')`)

        const box = await ui.ev(
          `(() => { const r = ${ui.$('android-video')}.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`
        )
        await ui.drag(box, box)
        await sleep(500)
        const tap = [...calls().matchAll(/shell input tap (\d+) (\d+)/g)].at(-1)
        check(
          !!tap && Math.abs(Number(tap[1]) - 540) <= 20 && Math.abs(Number(tap[2]) - 1200) <= 30,
          'clic au centre de la vidéo : toucher au centre de l’écran'
        )
        await ui.click(
          `${ui.$('android-tab')}.querySelector('[aria-label="${L('android.back')}"]')`
        )
        check(await called(calls, "input keyevent 'KEYCODE_BACK'"), 'bouton Retour du panneau')
        await deviceFrame(ui, calls, { displaysFile, screenFile })
      },
      undefined,
      'android',
      { BOBINE_WORKSPACE: workspace, ANDROID_HOME: sdk }
    )
    await nothingLeft('vidéo de l’émulateur')

    // Planche contact (fiche 076) : un second screenrecord, en images brutes, pendant un balayage.
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        await ui.send('/scenario planche-android')
        await ui.ready()
        const sheet = await ui.lastAgentText()
        const frames = Number(/: (\d+) frames, numbered/.exec(sheet)?.[1] ?? 0)
        check(
          frames >= 2 &&
            sheet.includes('android_tap') &&
            calls().includes('exec-out screenrecord --output-format=frames --size 411x914 -') &&
            calls().includes('shell input swipe 525 1575 525 525 300'),
          `planche contact Android : balayage filmé en images brutes (${frames} images différentes)`
        )
        check(
          await ui.ev(
            `(() => { const img = [...document.querySelectorAll('[data-testid=tool-images] img')].at(-1); return !!img && img.naturalWidth > 300 })()`
          ),
          'planche contact Android affichée dans la carte de l’outil'
        )
        await ui.shot('29b-planche-android')
      },
      undefined,
      'android',
      { BOBINE_WORKSPACE: workspace, ANDROID_HOME: sdk }
    )
    await nothingLeft('planche contact')
  } finally {
    rmSync(workspace, { recursive: true, force: true })
    rmSync(sdk, { recursive: true, force: true })
  }
}

/** Dernier appel d'`adb` qui correspond à `pattern`, en nombres. */
const lastCall = (calls, pattern) =>
  [...calls().matchAll(pattern)].at(-1)?.slice(1).map(Number) ?? null

/** Vrai dès que l'appel d'`adb` figure dans le journal (il arrive après l'action, fiche 106). */
async function called(calls, text, ms = 5000) {
  const start = Date.now()
  while (!calls().includes(text) && Date.now() - start < ms) await sleep(100)
  return calls().includes(text)
}

/**
 * Cadre de l'appareil (fiche 081) : téléphone en portrait, gestes, boutons de la tranche, puis
 * paysage (cadre tourné, vidéo relancée à la nouvelle taille, toucher juste) et tablette.
 */
async function deviceFrame(ui, calls, { displaysFile, screenFile }) {
  const box = () =>
    ui.ev(
      `(() => { const r = ${ui.$('android-display')}.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height } })()`
    )
  const frame = () =>
    ui.ev(
      `(() => { const d = ${ui.$('android-device')}; const s = ${ui.$('android-display')}.getBoundingClientRect(); const c = ${ui.$('android-camera')}.getBoundingClientRect(); return { kind: d.dataset.kind, rotation: d.dataset.rotation, ratio: s.width / s.height, camera: { x: c.x + c.width / 2 - s.x, y: c.y + c.height / 2 - s.y }, screen: { w: s.width, h: s.height } } })()`
    )
  let f = await frame()
  check(
    f.kind === 'phone' &&
      f.rotation === '0' &&
      Math.abs(f.ratio - 411 / 914) < 0.01 &&
      Math.abs(f.camera.x - f.screen.w / 2) < 2 &&
      f.camera.y > 0,
    'cadre de téléphone : écran aux proportions de l’appareil, perforation en haut au centre'
  )
  check(
    await ui.ev(
      `${ui.$('android-controls')}.getBoundingClientRect().top >= ${ui.$('android-device')}.getBoundingClientRect().bottom && !!${ui.$('android-controls')}.querySelector('[aria-label="${L('android.recents')}"]')`
    ),
    'commandes (Retour, Accueil, Apps récentes, joindre) dans la barre sous le téléphone'
  )

  // Zoom (fiche 084) : « ajuster » au départ, taille réelle (1 point de l'appareil = 1 point),
  // défilement avec la barre de commandes visible, toucher juste une fois zoomé, retour.
  const zoomButton = (id) => ui.$(`android-zoom-${id}`)
  const stage = ui.$('android-stage')
  check(
    (await ui.ev(`${zoomButton('fit')}.getAttribute('aria-pressed') === 'true'`)) &&
      /%/.test(await ui.ev(`${zoomButton('level')}.innerText`)),
    'zoom : « ajuster » au départ, niveau affiché'
  )
  await ui.click(zoomButton('actual'))
  await ui.waitFor(`Math.abs(${ui.$('android-display')}.getBoundingClientRect().width - 411) < 1`)
  check(
    await ui.ev(
      `${stage}.classList.contains('zoomed') && ${stage}.scrollHeight > ${stage}.clientHeight && ${zoomButton('level')}.innerText.startsWith('100') && ${ui.$('android-controls')}.getBoundingClientRect().bottom <= innerHeight && ${ui.$('android-controls')}.getBoundingClientRect().top >= ${stage}.getBoundingClientRect().bottom - 1`
    ),
    'taille réelle : 1 point par point, l’appareil défile, la barre de commandes reste visible'
  )
  // Milieu de la partie visible de l'écran : le zoom part du centre, pas du coin en haut à gauche.
  const visible = await ui.ev(
    `(() => { const s = ${stage}.getBoundingClientRect(); const d = ${ui.$('android-display')}.getBoundingClientRect(); const x = (Math.max(s.left, d.left) + Math.min(s.right, d.right)) / 2; const y = (Math.max(s.top, d.top) + Math.min(s.bottom, d.bottom)) / 2; return { x, y, fx: (x - d.left) / d.width, fy: (y - d.top) / d.height } })()`
  )
  check(
    Math.abs(visible.fy - 0.5) < 0.1,
    `zoom depuis « ajuster » : le milieu de l’écran reste au centre (${Math.round(visible.fy * 100)} %)`
  )
  await ui.drag(visible, visible)
  await sleep(500)
  const zoomTap = lastCall(calls, /shell input tap (\d+) (\d+)/g)
  check(
    !!zoomTap &&
      Math.abs(zoomTap[0] - visible.fx * 1080) <= 20 &&
      Math.abs(zoomTap[1] - visible.fy * 2400) <= 30,
    'zoomé : un clic touche le point correspondant de l’écran'
  )
  // Zoomé, la molette déplace la vue ; elle ne fait plus défiler l'app (on glisse pour cela).
  const swipes = () => [...calls().matchAll(/shell input swipe/g)].length
  const swipesBefore = swipes()
  const scrolled = await ui.ev(`${stage}.scrollTop`)
  await ui.wheel(visible, 0, 240)
  await sleep(600)
  check(
    (await ui.ev(`${stage}.scrollTop`)) > scrolled && swipes() === swipesBefore,
    'zoomé : la molette déplace la vue, sans faire défiler l’app'
  )
  await ui.shot('29e-android-zoom')
  await ui.click(zoomButton('in'))
  await ui.waitFor(
    `Math.abs(${ui.$('android-display')}.getBoundingClientRect().width - 411 * 1.25) < 1`
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
      `(() => { const a = ${stage}.parentElement.getBoundingClientRect(); const d = ${ui.$('android-device')}.getBoundingClientRect(); return d.top >= a.top - 1 && d.bottom <= a.bottom + 1 && d.left >= a.left - 1 && d.right <= a.right + 1 })()`
    ),
    '« ajuster » : l’appareil tient de nouveau en entier dans le panneau'
  )
  let b = await box()
  const at = (fx, fy) => ({ x: b.x + b.w * fx, y: b.y + b.h * fy })

  await ui.drag(at(0.5, 0.75), at(0.5, 0.25))
  await sleep(500)
  const swipe = lastCall(calls, /shell input swipe (\d+) (\d+) (\d+) (\d+) (\d+)/g)
  check(
    !!swipe &&
      Math.abs(swipe[0] - 540) <= 20 &&
      Math.abs(swipe[1] - 1800) <= 30 &&
      Math.abs(swipe[3] - 600) <= 30,
    'glisser sur l’écran : balayage de bas en haut, au bon endroit'
  )
  await ui.wheel(at(0.5, 0.5), 0, 120)
  await sleep(600)
  const wheel = lastCall(calls, /shell input swipe (\d+) (\d+) (\d+) (\d+) (\d+)/g)
  check(
    !!wheel && wheel[3] < wheel[1] && wheel[4] === 250,
    'molette : balayage court qui fait défiler vers le bas'
  )
  await ui.hold(at(0.3, 0.4), 700)
  await sleep(500)
  const long = lastCall(calls, /shell input swipe (\d+) (\d+) (\d+) (\d+) (\d+)/g)
  check(
    !!long &&
      long[0] === long[2] &&
      long[1] === long[3] &&
      Math.abs(long[0] - 324) <= 20 &&
      long[4] >= 600,
    'appui long : toucher tenu à l’endroit du pointeur'
  )
  await ui.click(ui.$('android-volume_up'))
  check(await called(calls, "input keyevent 'KEYCODE_VOLUME_UP'"), 'bouton de volume de la tranche')

  // Paysage : l'appareil tourné d'un quart de tour vers la gauche (ROTATION_90).
  copyFileSync(join(root, 'e2e/fixtures/android-paysage.jpg'), screenFile)
  writeFileSync(displaysFile, displays(2400, 1080, 90))
  await ui.waitFor(`${ui.$('android-device')}?.dataset.rotation === '1'`, 10000)
  await ui.waitFor(
    `(() => { const i = ${ui.$('android-screen')}; return !!i && i.complete && i.naturalWidth === 914 })()`,
    10000
  )
  f = await frame()
  check(
    Math.abs(f.ratio - 914 / 411) < 0.01 && f.camera.x < 0.1 * f.screen.w,
    'paysage : cadre tourné, perforation à gauche'
  )
  check(
    await called(calls, 'exec-out screenrecord --output-format=h264 --size 1200x544'),
    'paysage : vidéo relancée à la taille de l’écran tourné'
  )
  b = await box()
  await ui.drag(at(0.25, 0.5), at(0.25, 0.5))
  await sleep(500)
  const tap = lastCall(calls, /shell input tap (\d+) (\d+)/g)
  check(
    !!tap && Math.abs(tap[0] - 600) <= 20 && Math.abs(tap[1] - 540) <= 20,
    'paysage : clic au quart de l’écran, toucher au quart en pixels'
  )
  await ui.shot('29c-android-paysage')

  // Tablette : écran de 975×610 dp (plus petit côté ≥ 600).
  copyFileSync(join(root, 'e2e/fixtures/android-tablette.jpg'), screenFile)
  writeFileSync(displaysFile, displays(2560, 1600, 0))
  await ui.waitFor(`${ui.$('android-device')}?.dataset.kind === 'tablet'`, 10000)
  await ui.waitFor(
    `(() => { const i = ${ui.$('android-screen')}; return !!i && i.complete && i.naturalWidth === 975 })()`,
    10000
  )
  f = await frame()
  check(
    Math.abs(f.ratio - 975 / 610) < 0.01 && f.camera.y < 0,
    'tablette : cadre plus large, caméra dans le cadre au-dessus de l’écran'
  )
  await ui.shot('29d-android-tablette')

  // Retour au téléphone en portrait pour la suite (planche contact).
  copyFileSync(join(root, 'e2e/fixtures/android-portrait.jpg'), screenFile)
  writeFileSync(displaysFile, displays(1080, 2400, 0))
}
