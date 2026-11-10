/**
 * Cadre dessiné autour de l'écran d'un appareil Android (fiche 081) : téléphone ou tablette d'après
 * le plus petit côté de l'écran (600 dp, le seuil `sw600dp` d'Android), tourné comme l'appareil.
 * Aucun modèle réel n'est reproduit : proportions tirées de la taille de l'écran. Tout est en dp,
 * dans le repère du cadre affiché (origine en haut à gauche du tour) ; l'onglet met à l'échelle.
 */

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** Boutons de la tranche, cliquables (touches d'`android:key`). */
export type SideKey = 'power' | 'volume_up' | 'volume_down'

export interface AndroidChassis {
  kind: 'phone' | 'tablet'
  /** Taille du cadre (tour compris, boutons non compris). */
  width: number
  height: number
  /** Rayon des coins de l'écran. */
  radius: number
  /** Cadre noir autour de l'écran, puis tour de couleur : l'écran commence à `bezel + rim`. */
  bezel: number
  rim: number
  /** Caméra (cercle) : dans l'écran pour un téléphone, dans le cadre pour une tablette. */
  camera: Rect
  /** Boutons sur la tranche ; ils dépassent du tour de `overhang`. */
  buttons: { key: SideKey; rect: Rect }[]
  overhang: number
}

/** Plus petit côté à partir duquel l'appareil est une tablette (dp). */
const TABLET_MIN_DP = 600

/**
 * `screen` : taille de l'écran en dp dans l'orientation affichée ; `rotation` : quarts de tour du
 * dessin (`Surface.ROTATION_*` / 90 : 1 = appareil tourné d'un quart de tour vers la gauche) ;
 * `declaredRadius` : rayon des coins déclaré par l'appareil (0 : aucun, on en dessine un).
 */
export function androidChassis(
  screen: { width: number; height: number },
  rotation = 0,
  declaredRadius = 0
): AndroidChassis {
  const turns = (((Math.round(rotation) % 4) + 4) % 4) as 0 | 1 | 2 | 3
  // Position naturelle de l'appareil : l'écran affiché, défait de sa rotation.
  const natural = turns % 2 === 0 ? screen : { width: screen.height, height: screen.width }
  const short = Math.min(screen.width, screen.height)
  const tablet = short >= TABLET_MIN_DP
  // Cadre noir mince et écran bien arrondi : les coins de l'écran et du tour, concentriques, ont
  // des courbes proches (un cadre épais les fait paraître différentes).
  const radius = declaredRadius > 0 ? declaredRadius : Math.round(short * (tablet ? 0.04 : 0.085))
  const bezel = Math.round(short * (tablet ? 0.025 : 0.015))
  const rim = Math.max(3, Math.round(short * (tablet ? 0.006 : 0.01)))
  const side = bezel + rim
  const box = { width: natural.width + 2 * side, height: natural.height + 2 * side }
  const overhang = Math.max(2, Math.round(short * (tablet ? 0.004 : 0.007)))

  // Repère naturel : caméra en haut au centre ; boutons sur la tranche droite (téléphone) ou en
  // haut à droite (tablette, tenue en paysage).
  const size = Math.max(5, Math.round(short * (tablet ? 0.012 : 0.032)))
  const cameraCenter = {
    x: box.width / 2,
    y: tablet ? rim + bezel / 2 : side + Math.round(size * 1.4)
  }
  const camera = {
    x: cameraCenter.x - size / 2,
    y: cameraCenter.y - size / 2,
    width: size,
    height: size
  }
  const along: [SideKey, number, number][] = tablet
    ? [
        ['volume_up', 0.7, 0.045],
        ['volume_down', 0.75, 0.045],
        ['power', 0.84, 0.04]
      ]
    : [
        ['power', 0.19, 0.07],
        ['volume_up', 0.3, 0.075],
        ['volume_down', 0.385, 0.075]
      ]
  // Collés au tour (1 dp sous lui), saillie de `overhang`.
  const buttons = along.map(([key, start, length]) => ({
    key,
    rect: tablet
      ? {
          x: box.width * start,
          y: -overhang,
          width: box.width * length,
          height: overhang + 1
        }
      : {
          x: box.width - 1,
          y: box.height * start,
          width: overhang + 1,
          height: box.height * length
        }
  }))

  return {
    kind: tablet ? 'tablet' : 'phone',
    width: turns % 2 === 0 ? box.width : box.height,
    height: turns % 2 === 0 ? box.height : box.width,
    radius,
    bezel,
    rim,
    camera: turn(camera, turns, box),
    buttons: buttons.map((b) => ({ key: b.key, rect: turn(b.rect, turns, box) })),
    overhang
  }
}

/**
 * Rectangle du repère naturel → repère affiché, l'appareil tourné de `turns` quarts de tour vers
 * la gauche : à chaque quart, (x, y) dans une boîte w × h devient (y, w − x) dans une boîte h × w.
 */
function turn(rect: Rect, turns: number, box: { width: number; height: number }): Rect {
  let r = rect
  let w = box.width
  let h = box.height
  for (let i = 0; i < turns; i++) {
    r = { x: r.y, y: w - (r.x + r.width), width: r.height, height: r.width }
    ;[w, h] = [h, w]
  }
  return r
}
