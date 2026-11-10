import { ScanSearch, ZoomIn, ZoomOut } from 'lucide-react'
import type { ReactNode, Ref } from 'react'
import { useTranslation } from 'react-i18next'
import { nextZoom, type DeviceZoom } from '../../device-zoom'
import { Tip } from '../common/Menus'

/**
 * Commandes d'un appareil (simulateur iOS, émulateur Android), dans une barre en pastille sous son
 * cadre (fiche 081) ; `ControlSeparator` sépare les groupes (touches de l'appareil, capture).
 */
export function DeviceControls({
  testId,
  ref,
  children
}: {
  testId: string
  ref?: Ref<HTMLDivElement>
  children: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <div
      ref={ref}
      className="device-controls"
      role="toolbar"
      aria-label={t('panel.device.controls')}
      data-testid={testId}
    >
      {children}
    </div>
  )
}

export function ControlSeparator() {
  return <span className="device-controls-sep" aria-hidden="true" />
}

/**
 * Zoom de l'appareil, en haut de son onglet (fiche 084) : dézoomer, ajuster (par défaut), taille
 * réelle, zoomer, puis le niveau affiché. `scale` : l'échelle dessinée (0 tant qu'elle est inconnue).
 */
export function DeviceZoomControls({
  zoom,
  scale,
  onZoom,
  testId
}: {
  zoom: DeviceZoom
  scale: number
  onZoom: (zoom: DeviceZoom) => void
  testId: string
}) {
  const { t, i18n } = useTranslation()
  const ready = scale > 0
  const smaller = ready ? nextZoom(scale, -1) : undefined
  const larger = ready ? nextZoom(scale, 1) : undefined
  const level = new Intl.NumberFormat(i18n.language, {
    style: 'percent',
    maximumFractionDigits: 0
  }).format(scale)
  const button = (
    label: string,
    target: DeviceZoom | undefined,
    content: ReactNode,
    id: string,
    pressed?: boolean
  ) => (
    <Tip label={label}>
      <button
        className={`icon-button small${pressed ? ' active' : ''}`}
        aria-label={label}
        aria-pressed={pressed}
        disabled={target === undefined}
        onClick={() => target !== undefined && onZoom(target)}
        data-testid={`${testId}-${id}`}
      >
        {content}
      </button>
    </Tip>
  )
  return (
    <div
      className="device-zoom"
      role="group"
      aria-label={t('panel.device.zoom.label')}
      data-testid={testId}
    >
      {button(t('panel.device.zoom.out'), smaller, <ZoomOut size={15} />, 'out')}
      {button(
        t('panel.device.zoom.fit'),
        ready ? 'fit' : undefined,
        <ScanSearch size={15} />,
        'fit',
        zoom === 'fit'
      )}
      {button(
        t('panel.device.zoom.actual'),
        ready ? 1 : undefined,
        <span className="device-zoom-actual">1:1</span>,
        'actual',
        zoom === 1
      )}
      {button(t('panel.device.zoom.in'), larger, <ZoomIn size={15} />, 'in')}
      {ready && (
        <span className="device-zoom-level" data-testid={`${testId}-level`}>
          {level}
        </span>
      )}
    </div>
  )
}
