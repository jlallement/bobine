import { ChevronLeft, Circle, Smartphone, Square } from 'lucide-react'
import type { ImageAttachment } from '@shared/attachments'
import { AttachImageButton, screenAttachment } from './AttachImageButton'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { AndroidState } from '@shared/android'
import { androidChassis, type Rect, type SideKey } from '../../android-chassis'
import { useDeviceRoom } from '../../device-room'
import { useDeviceZoom } from '../../device-zoom'
import { useScreenGestures } from '../../screen-gestures'
import { ControlSeparator, DeviceControls, DeviceZoomControls } from './DeviceControls'
import { Tip } from '../common/Menus'
import { useTranslation } from 'react-i18next'
import i18next from 'i18next'
import { ipcErrorText } from '../../ipc-errors'

/** Rafraîchissement des captures quand il n'y a pas de flux vidéo. */
const REFRESH_MS = 1500

/** Infobulles des boutons de la tranche. */
const SIDE_LABEL = {
  power: 'android.power',
  volume_up: 'android.volumeUp',
  volume_down: 'android.volumeDown'
} as const satisfies Record<SideKey, string>

/**
 * Onglet « Android » (fiche 032) : l'écran de l'appareil de la conversation dans un cadre de
 * téléphone ou de tablette tourné comme lui (fiche 081), en vidéo H.264 décodée par Chromium
 * (WebCodecs), sinon par captures successives. Clic = toucher, appui long, glisser = balayage,
 * molette = défilement (en dp) ; boutons de la tranche cliquables.
 */
// eslint-disable-next-line max-lines-per-function, complexity -- onglet pas encore découpé (fiche 089) : à faire comme Composer si on y retouche
export function AndroidTab({
  conversationId,
  onAttach
}: {
  conversationId: string
  /** « Joindre au message » (fiche 066). */
  onAttach?: (image: ImageAttachment) => void
}) {
  const { t } = useTranslation()
  const [state, setState] = useState<AndroidState | null>(null)
  const [shot, setShot] = useState<{ data: string; width: number; height: number } | null>(null)
  const [streaming, setStreaming] = useState(false)
  const [hasFrame, setHasFrame] = useState(false)
  const [streamNote, setStreamNote] = useState<string | null>(null)
  /** Images dessinées pendant la dernière seconde (`null` sans flux). */
  const [fps, setFps] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const area = useRef<HTMLDivElement>(null)
  const controls = useRef<HTMLDivElement>(null)
  const busy = useRef(false)
  const ready = state?.device?.state === 'device'
  const serial = state?.device?.serial
  // Place disponible pour le cadre, suivie quand le panneau change de taille.
  const room = useDeviceRoom(area, ready, controls)
  // `screenrecord` garde la taille de son départ : la vidéo repart quand l'écran tourne.
  const orientation = state?.screen
    ? `${state.screen.width}x${state.screen.height}@${state.rotation ?? 0}`
    : ''

  useEffect(() => {
    let alive = true
    void window.api.android.getState(conversationId).then((s) => alive && setState(s))
    const off = window.api.android.onState((s) => {
      if (s.conversationId === conversationId) setState(s)
    })
    return () => {
      alive = false
      off()
    }
  }, [conversationId])

  // Flux H.264 : décodé par le décodeur matériel de Chromium, dessiné image par image.
  useEffect(() => {
    if (!ready || !serial || typeof VideoDecoder === 'undefined') return
    let alive = true
    let decoder: VideoDecoder | undefined
    let codec: string | undefined
    let waitingKey = true
    let timestamp = 0
    let drawn = 0
    // L'émulateur n'envoie une image que quand l'écran change : 0 sur un écran immobile.
    const meter = window.setInterval(() => {
      if (alive) setFps(drawn)
      drawn = 0
    }, 1000)
    const fail = (reason: string) => {
      if (!alive) return
      setStreaming(false)
      setStreamNote(i18next.t('panel.device.streamInterrupted', { reason }))
      void window.api.android.stopStream()
    }
    const configure = (next: string) => {
      if (decoder && codec === next) return
      decoder?.close()
      codec = next
      waitingKey = true
      decoder = new VideoDecoder({
        output: (frame) => {
          const el = canvas.current
          if (alive && el) {
            if (el.width !== frame.displayWidth) el.width = frame.displayWidth
            if (el.height !== frame.displayHeight) el.height = frame.displayHeight
            el.getContext('2d')?.drawImage(frame, 0, 0)
            drawn++
            setHasFrame(true)
          }
          frame.close()
        },
        error: (e) => fail(e.message)
      })
      decoder.configure({ codec: next, optimizeForLatency: true })
    }
    const offFrame = window.api.android.onFrame((frame) => {
      if (frame.conversationId !== conversationId || !alive) return
      try {
        if (frame.codec) configure(frame.codec)
        if (!decoder || decoder.state !== 'configured') return
        // Le décodeur repart d'une image clé (début du flux, relance de screenrecord).
        if (waitingKey && !frame.key) return
        waitingKey = false
        timestamp += 16_666
        decoder.decode(
          new EncodedVideoChunk({
            type: frame.key ? 'key' : 'delta',
            timestamp,
            data: frame.data
          })
        )
      } catch (e) {
        fail(ipcErrorText(e))
      }
    })
    const offEnd = window.api.android.onStreamEnded((end) => {
      if (end.conversationId === conversationId) fail(end.reason)
    })
    void window.api.android
      .startStream(conversationId)
      .then((started) => alive && setStreaming(started))
      .catch(() => alive && setStreaming(false))
    return () => {
      alive = false
      window.clearInterval(meter)
      offFrame()
      offEnd()
      if (decoder && decoder.state !== 'closed') decoder.close()
      setStreaming(false)
      setHasFrame(false)
      setFps(null)
      void window.api.android.stopStream()
    }
  }, [conversationId, ready, serial, orientation])

  // Sans flux : des captures successives.
  useEffect(() => {
    if (!ready || (streaming && hasFrame)) return
    let alive = true
    const refresh = async () => {
      if (busy.current) return
      busy.current = true
      try {
        const next = await window.api.android.screenshot(conversationId)
        if (alive) setShot(next)
      } catch {
        // Appareil en cours d'arrêt…
      } finally {
        busy.current = false
      }
    }
    void refresh()
    const timer = setInterval(() => void refresh(), REFRESH_MS)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [conversationId, ready, streaming, hasFrame, state])

  const screen = state?.screen ?? null
  const chassis = screen ? androidChassis(screen, state?.rotation, state?.cornerRadius) : null
  // Échelle (pixels de l'écran de l'utilisateur par dp) pour que le cadre et ses boutons tiennent.
  const fit =
    chassis && room && room.width > 0 && room.height > 0
      ? Math.min(
          room.width / (chassis.width + 2 * chassis.overhang),
          room.height / (chassis.height + 2 * chassis.overhang)
        )
      : 0
  // Zoom choisi dans l'en-tête (fiche 084) : « ajuster » (`fit`) au départ.
  const { zoom, scale, setZoom, stage } = useDeviceZoom(fit)

  const report = (promise: Promise<unknown>) => {
    setError(null)
    promise.catch((e: unknown) => setError(ipcErrorText(e)))
  }

  const gestures = useScreenGestures({
    screen,
    scale,
    enabled: true,
    longPress: true,
    wheelScrolls: zoom === 'fit',
    perform: (g) =>
      report(
        g.kind === 'tap'
          ? window.api.android.tap(conversationId, g.at.x, g.at.y, g.holdMs)
          : window.api.android.swipe(conversationId, g.from, g.to, g.ms)
      )
  })

  const press = (key: 'back' | 'home' | 'recents' | SideKey) =>
    report(window.api.android.key(conversationId, key))

  if (!state?.sdk) {
    return (
      <div className="side-panel-empty" data-testid="android-empty">
        <Smartphone size={22} />
        <p>{t('android.noSdk')}</p>
      </div>
    )
  }
  if (!state.device || !ready) {
    return (
      <div className="side-panel-empty" data-testid="android-empty">
        <Smartphone size={22} />
        <p>
          {state.device
            ? t('android.notReady', { name: state.device.name, state: state.device.state })
            : t('android.none')}
        </p>
      </div>
    )
  }

  const showVideo = streaming && hasFrame
  const picture = (
    <>
      <canvas ref={canvas} className={showVideo ? '' : 'hidden'} data-testid="android-video" />
      {!showVideo && shot && (
        <img
          src={`data:image/jpeg;base64,${shot.data}`}
          alt={t('panel.device.screen', { name: state.device.name })}
          draggable={false}
          data-testid="android-screen"
        />
      )}
    </>
  )
  return (
    <div className="simulator-tab" data-testid="android-tab">
      <div className="simulator-bar">
        <span className="simulator-name" title={state.device.serial}>
          {state.device.name} <span>{state.device.serial}</span>
        </span>
        {showVideo && (
          <span className="simulator-live" data-testid="android-live">
            {t('panel.device.live')}
          </span>
        )}
        {showVideo && fps !== null && (
          <span className="simulator-name" title={t('android.fps')} data-testid="android-fps">
            <span>{t('panel.device.fps', { fps })}</span>
          </span>
        )}
        <span className="grow" />
        {chassis && screen && (
          <DeviceZoomControls zoom={zoom} scale={scale} onZoom={setZoom} testId="android-zoom" />
        )}
      </div>
      {error && <div className="browser-error">{error}</div>}
      {streamNote && !streaming && <div className="simulator-hint">{streamNote}</div>}
      <div className="simulator-screen" ref={area}>
        <div
          className={`device-stage${chassis && screen && scale > 0 ? (zoom === 'fit' ? '' : ' zoomed') : ' fill'}`}
          ref={stage}
          data-testid="android-stage"
        >
          {chassis && screen && scale > 0 ? (
            <div
              className="android-device-box"
              style={{
                width: (chassis.width + 2 * chassis.overhang) * scale,
                height: (chassis.height + 2 * chassis.overhang) * scale
              }}
            >
              {chassis.buttons.map((button) => (
                <Tip key={button.key} label={t(SIDE_LABEL[button.key])}>
                  <button
                    type="button"
                    className="android-side-button"
                    aria-label={t(SIDE_LABEL[button.key])}
                    style={place(button.rect, scale, chassis.overhang)}
                    onClick={() => press(button.key)}
                    data-testid={`android-${button.key}`}
                  />
                </Tip>
              ))}
              <div
                className="android-device"
                style={{
                  ...place(
                    { x: 0, y: 0, width: chassis.width, height: chassis.height },
                    scale,
                    chassis.overhang
                  ),
                  borderRadius: (chassis.radius + chassis.bezel + chassis.rim) * scale
                }}
                data-testid="android-device"
                data-kind={chassis.kind}
                data-rotation={state.rotation ?? 0}
              >
                <div
                  className="android-bezel"
                  style={{
                    inset: chassis.rim * scale,
                    borderRadius: (chassis.radius + chassis.bezel) * scale
                  }}
                />
                <div
                  className="android-display touchable"
                  style={{
                    left: (chassis.bezel + chassis.rim) * scale,
                    top: (chassis.bezel + chassis.rim) * scale,
                    width: screen.width * scale,
                    height: screen.height * scale,
                    borderRadius: chassis.radius * scale
                  }}
                  {...gestures}
                  data-testid="android-display"
                >
                  {picture}
                </div>
                <div
                  className="android-camera"
                  style={place(chassis.camera, scale, 0)}
                  data-testid="android-camera"
                />
              </div>
            </div>
          ) : (
            picture
          )}
        </div>
        <DeviceControls testId="android-controls" ref={controls}>
          <Tip label={t('android.back')}>
            <button
              className="icon-button"
              aria-label={t('android.back')}
              onClick={() => press('back')}
            >
              <ChevronLeft size={19} />
            </button>
          </Tip>
          <Tip label={t('panel.device.home')}>
            <button
              className="icon-button"
              aria-label={t('panel.device.home')}
              onClick={() => press('home')}
            >
              <Circle size={16} />
            </button>
          </Tip>
          <Tip label={t('android.recents')}>
            <button
              className="icon-button"
              aria-label={t('android.recents')}
              onClick={() => press('recents')}
            >
              <Square size={15} />
            </button>
          </Tip>
          {onAttach && (
            <>
              <ControlSeparator />
              <AttachImageButton
                label={t('panel.device.attach')}
                testId="android-attach"
                size="normal"
                take={async () =>
                  screenAttachment(
                    await window.api.android.screenshot(conversationId),
                    t('android.title', { name: state.device?.name ?? '' }).trim()
                  )
                }
                onAttach={onAttach}
              />
            </>
          )}
        </DeviceControls>
      </div>
    </div>
  )
}

/** Position absolue d'un rectangle du cadre (dp) dans la boîte qui garde la place des boutons. */
function place(rect: Rect, scale: number, offset: number): CSSProperties {
  return {
    left: (rect.x + offset) * scale,
    top: (rect.y + offset) * scale,
    width: rect.width * scale,
    height: rect.height * scale
  }
}
