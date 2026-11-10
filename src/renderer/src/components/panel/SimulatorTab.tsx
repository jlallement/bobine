import { Circle, Lock, Smartphone } from 'lucide-react'
import type { ImageAttachment } from '@shared/attachments'
import { AttachImageButton, screenAttachment } from './AttachImageButton'
import { useEffect, useRef, useState } from 'react'
import type { SimulatorState } from '@shared/simulator'
import { deviceChassis } from '../../device-chassis'
import { useDeviceRoom } from '../../device-room'
import { useDeviceZoom } from '../../device-zoom'
import { useScreenGestures } from '../../screen-gestures'
import { ControlSeparator, DeviceControls, DeviceZoomControls } from './DeviceControls'
import { Tip } from '../common/Menus'
import { useTranslation } from 'react-i18next'
import i18next from 'i18next'
import { ipcErrorText } from '../../ipc-errors'

/** Rafraîchissement des captures quand il n'y a pas de flux vidéo (fiche 008). */
const REFRESH_MS = 1000

/**
 * Onglet « Simulateur » : l'écran de l'appareil de la conversation dans un châssis (fiche 044),
 * en vidéo (fiche 009, avec AXe) ou par captures successives. Un clic est un toucher, un glisser
 * un balayage, la molette un défilement.
 */
// eslint-disable-next-line max-lines-per-function, complexity -- onglet pas encore découpé (fiche 089) : à faire comme Composer si on y retouche
export function SimulatorTab({
  conversationId,
  onAttach
}: {
  conversationId: string
  /** « Joindre au message » (fiche 066). */
  onAttach?: (image: ImageAttachment) => void
}) {
  const { t } = useTranslation()
  const [state, setState] = useState<SimulatorState | null>(null)
  const [shot, setShot] = useState<{ data: string; width: number; height: number } | null>(null)
  const [streaming, setStreaming] = useState(false)
  const [streamNote, setStreamNote] = useState<string | null>(null)
  const [hasFrame, setHasFrame] = useState(false)
  /** Images dessinées par seconde pendant le direct (`null` sans flux). */
  const [fps, setFps] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const area = useRef<HTMLDivElement>(null)
  const controls = useRef<HTMLDivElement>(null)
  const busy = useRef(false)
  const booted = state?.device?.state === 'Booted'
  const udid = state?.device?.udid
  // Place disponible pour le cadre, suivie quand le panneau change de taille.
  const room = useDeviceRoom(area, booted, controls)

  useEffect(() => {
    let alive = true
    void window.api.simulator.getState(conversationId).then((s) => alive && setState(s))
    const off = window.api.simulator.onState((s) => {
      if (s.conversationId === conversationId) setState(s)
    })
    return () => {
      alive = false
      off()
    }
  }, [conversationId])

  // Flux vidéo : seule l'image la plus récente est décodée (hors du fil principal) puis dessinée.
  useEffect(() => {
    if (!booted || !udid) return
    let alive = true
    let latest: Uint8Array | null = null
    let decoding = false
    let drawn = 0
    // Débit affiché : images dessinées pendant la dernière seconde.
    const meter = window.setInterval(() => {
      if (alive) setFps(drawn)
      drawn = 0
    }, 1000)
    const draw = async () => {
      if (decoding || !latest) return
      decoding = true
      const data = latest
      latest = null
      try {
        const bitmap = await createImageBitmap(new Blob([data as BlobPart], { type: 'image/jpeg' }))
        const el = canvas.current
        if (alive && el) {
          if (el.width !== bitmap.width) el.width = bitmap.width
          if (el.height !== bitmap.height) el.height = bitmap.height
          el.getContext('2d')?.drawImage(bitmap, 0, 0)
          drawn++
          setHasFrame(true)
        }
        bitmap.close()
      } catch {
        // Image abîmée : la suivante la remplacera.
      } finally {
        decoding = false
        if (latest && alive) void draw()
      }
    }
    const offFrame = window.api.simulator.onFrame((frame) => {
      if (frame.conversationId !== conversationId) return
      latest = frame.data
      void draw()
    })
    const offEnd = window.api.simulator.onStreamEnded((end) => {
      if (end.conversationId !== conversationId || !alive) return
      setStreaming(false)
      setFps(null)
      setStreamNote(i18next.t('panel.device.streamInterrupted', { reason: end.reason }))
    })
    void window.api.simulator
      .startStream(conversationId)
      .then((started) => {
        if (alive) setStreaming(started)
      })
      .catch(() => alive && setStreaming(false))
    return () => {
      alive = false
      window.clearInterval(meter)
      offFrame()
      offEnd()
      setStreaming(false)
      setHasFrame(false)
      setFps(null)
      void window.api.simulator.stopStream()
    }
  }, [conversationId, booted, udid])

  // Sans flux : une capture par seconde (et après chaque action de l'agent).
  useEffect(() => {
    if (!booted || streaming) return
    let alive = true
    const refresh = async () => {
      if (busy.current) return
      busy.current = true
      try {
        const next = await window.api.simulator.screenshot(conversationId)
        if (alive) setShot(next)
      } catch {
        // Appareil en cours d'arrêt… la prochaine capture dira.
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
  }, [conversationId, booted, streaming, state])

  const screen = state?.screen ?? (shot ? { width: shot.width, height: shot.height } : null)
  const chassis = screen ? deviceChassis(state?.device?.deviceType, screen) : null
  // Échelle (pixels de l'écran de l'utilisateur par point) pour que le châssis tienne dans le panneau.
  const outer =
    screen && chassis
      ? { width: screen.width + 2 * chassis.side, height: screen.height + 2 * chassis.top }
      : null
  const fit =
    outer && room && room.width > 0 && room.height > 0
      ? Math.min(room.width / outer.width, room.height / outer.height)
      : 0
  // Zoom choisi dans l'en-tête (fiche 084) : « ajuster » (`fit`) au départ.
  const { zoom, scale, setZoom, stage } = useDeviceZoom(fit)

  const report = (promise: Promise<unknown>) => {
    setError(null)
    promise.catch((e: unknown) => setError(ipcErrorText(e)))
  }

  // Clic = toucher, glisser = balayage, molette = défilement (fiche 044).
  const gestures = useScreenGestures({
    screen,
    scale,
    enabled: !!state?.touch,
    wheelScrolls: zoom === 'fit',
    perform: (g) =>
      report(
        g.kind === 'tap'
          ? window.api.simulator.tap(conversationId, g.at.x, g.at.y)
          : window.api.simulator.swipe(conversationId, g.from, g.to, g.ms / 1000)
      )
  })

  const press = (button: 'home' | 'lock') =>
    report(window.api.simulator.button(conversationId, button))

  if (!state?.device || !booted) {
    return (
      <div className="side-panel-empty" data-testid="simulator-empty">
        <Smartphone size={22} />
        <p>
          {state?.device
            ? t('simulator.shutdown', { name: state.device.name })
            : t('simulator.none')}
        </p>
      </div>
    )
  }

  const showVideo = streaming && hasFrame
  const picture = (
    <>
      <canvas ref={canvas} className={showVideo ? '' : 'hidden'} data-testid="simulator-video" />
      {!showVideo && shot && (
        <img
          src={`data:image/jpeg;base64,${shot.data}`}
          alt={t('panel.device.screen', { name: state.device.name })}
          draggable={false}
          data-testid="simulator-screen"
        />
      )}
    </>
  )
  const homeSize = 44
  return (
    <div className="simulator-tab" data-testid="simulator-tab">
      <div className="simulator-bar">
        <span className="simulator-name" title={state.device.udid}>
          {state.device.name} <span>{state.device.runtime}</span>
        </span>
        {streaming && (
          <span className="simulator-live" data-testid="simulator-live">
            {t('panel.device.live')}
          </span>
        )}
        {streaming && fps !== null ? (
          <span
            className="simulator-name"
            title={
              state.axe?.version
                ? t('simulator.fpsWithAxe', { version: state.axe.version })
                : t('simulator.fps')
            }
            data-testid="simulator-fps"
          >
            <span>{t('panel.device.fps', { fps })}</span>
          </span>
        ) : (
          state.axe?.version &&
          state.touch && (
            <span
              className="simulator-name"
              title={
                state.axe.path
                  ? t('simulator.axeVersionAt', { path: state.axe.path })
                  : t('simulator.axeVersion')
              }
            >
              <span>{t('simulator.axe', { version: state.axe.version })}</span>
            </span>
          )
        )}
        <span className="grow" />
        {screen && chassis && (
          <DeviceZoomControls zoom={zoom} scale={scale} onZoom={setZoom} testId="simulator-zoom" />
        )}
      </div>
      {error && <div className="browser-error">{error}</div>}
      {!state.touch && (
        <div className="simulator-hint" data-testid="simulator-axe-hint">
          {state.axe?.error ?? t('simulator.noAxe')}
        </div>
      )}
      {streamNote && !streaming && <div className="simulator-hint">{streamNote}</div>}
      <div className="simulator-screen" ref={area}>
        <div
          className={`device-stage${screen && chassis && outer && scale > 0 ? (zoom === 'fit' ? '' : ' zoomed') : ' fill'}`}
          ref={stage}
          data-testid="simulator-stage"
        >
          {screen && chassis && outer && scale > 0 ? (
            <div
              className="simulator-device"
              style={{
                width: outer.width * scale,
                height: outer.height * scale,
                padding: `${chassis.top * scale}px ${chassis.side * scale}px`,
                borderRadius:
                  (chassis.radius > 0 ? chassis.radius + chassis.side : chassis.side * 2.5) * scale
              }}
              data-testid="simulator-device"
              data-home-button={chassis.homeButton ? 'true' : undefined}
            >
              <div
                className={`simulator-display${state.touch ? ' touchable' : ''}`}
                style={{
                  width: screen.width * scale,
                  height: screen.height * scale,
                  borderRadius: chassis.radius * scale
                }}
                {...gestures}
                data-testid="simulator-display"
              >
                {picture}
              </div>
              {chassis.homeButton && (
                <button
                  type="button"
                  className="simulator-home"
                  aria-label={t('panel.device.home')}
                  style={{
                    width: homeSize * scale,
                    height: homeSize * scale,
                    bottom: ((chassis.top - homeSize) / 2) * scale
                  }}
                  onClick={() => press('home')}
                />
              )}
            </div>
          ) : (
            picture
          )}
        </div>
        <DeviceControls testId="simulator-controls" ref={controls}>
          {state.touch && (
            <>
              <Tip label={t('panel.device.home')}>
                <button
                  className="icon-button"
                  aria-label={t('panel.device.home')}
                  onClick={() => press('home')}
                >
                  <Circle size={16} />
                </button>
              </Tip>
              <Tip label={t('simulator.lock')}>
                <button
                  className="icon-button"
                  aria-label={t('simulator.lock')}
                  onClick={() => press('lock')}
                >
                  <Lock size={16} />
                </button>
              </Tip>
            </>
          )}
          {onAttach && (
            <>
              {state.touch && <ControlSeparator />}
              <AttachImageButton
                label={t('panel.device.attach')}
                testId="simulator-attach"
                size="normal"
                take={async () =>
                  screenAttachment(
                    await window.api.simulator.screenshot(conversationId),
                    t('simulator.title', { name: state.device?.name ?? '' }).trim()
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
