import { MAIN_PORT, check, mainProcess, withApp } from '../lib.mjs'

/**
 * Zone de saisie alignée sur le fil (fiche 294) : le texte tapé occupe exactement la colonne du fil
 * (bord gauche = celui du texte de l'agent, bord droit = celui des bulles), le cadre déborde dans la
 * gouttière sans jamais toucher le bord de la zone ni faire défiler de côté, son ombre n'est pas
 * coupée ; le texte tapé a la taille et l'interligne de la bulle envoyée, et la hauteur de la saisie
 * suit un changement de taille avec du texte déjà tapé.
 *
 * Mesures en positions calculées (CSS), jamais en pixels de capture : les mêmes sur les trois
 * systèmes. Tolérance de 1 px : arrondis de mise en page (largeur de colonne impaire, centrage).
 */

/** Positions de la colonne du fil, de la dernière réponse, de la dernière bulle et de la saisie. */
const MEASURE = `(() => {
  const r = (n) => Math.round(n * 100) / 100
  const agent = [...document.querySelectorAll('.msg-agent p')].at(-1)
  const user = [...document.querySelectorAll('.msg-user')].at(-1)
  const column = agent.closest('.column')
  const cb = column.getBoundingClientRect(), cs = getComputedStyle(column)
  const input = document.querySelector('[data-testid=composer-input]')
  const ib = input.getBoundingClientRect(), is = getComputedStyle(input)
  const composer = input.closest('.composer')
  const frame = composer.getBoundingClientRect()
  const dock = composer.closest('.column')
  const db = dock.getBoundingClientRect()
  const main = document.querySelector('.main').getBoundingClientRect()
  // Étendue horizontale de l'ombre du cadre (avec le halo du focus) : |x| + flou + étalement.
  const reach = (shadow) =>
    Math.max(0, ...(shadow === 'none' ? [] : shadow.split(/,(?![^(]*\\))/).map((part) => {
      const px = part.replace(/rgba?\\([^)]*\\)/, '').match(/-?[\\d.]+px/g)?.map(parseFloat) ?? []
      return Math.abs(px[0] ?? 0) + (px[2] ?? 0) + Math.max(0, px[3] ?? 0)
    })))
  const scrolls = [document.scrollingElement, document.querySelector('.main'), dock]
    .filter(Boolean)
    .some((el) => el.scrollWidth > el.clientWidth + 1)
  return {
    agentLeft: r(agent.getBoundingClientRect().left),
    bubbleRight: r(user.getBoundingClientRect().right),
    columnLeft: r(cb.left + parseFloat(cs.paddingLeft)),
    columnRight: r(cb.right - parseFloat(cs.paddingRight)),
    typedLeft: r(ib.left + parseFloat(is.borderLeftWidth) + parseFloat(is.paddingLeft)),
    typedRight: r(ib.right - parseFloat(is.borderRightWidth) - parseFloat(is.paddingRight)),
    frameLeft: r(frame.left),
    frameRight: r(frame.right),
    mainLeft: r(main.left),
    mainRight: r(main.right),
    // Place de l'ombre : du cadre au bord de coupe de sa colonne (bord + marge de coupe).
    shadowRoom: r(Math.min(frame.left - db.left, db.right - frame.right) + (parseFloat(getComputedStyle(dock).overflowClipMargin) || 0)),
    shadowReach: reach(getComputedStyle(composer).boxShadow),
    scrolls,
    typedFont: is.fontSize,
    typedLine: is.lineHeight,
    placeholderFont: getComputedStyle(input, '::placeholder').fontSize,
    bubbleFont: getComputedStyle(user).fontSize,
    bubbleLine: getComputedStyle(user).lineHeight,
    inputHeight: r(ib.height),
    inputFits: input.scrollHeight <= input.clientHeight + 1
  }
})()`

const near = (a, b) => Math.abs(a - b) <= 1

const AGENT_TEXT =
  'Le chantier tient en trois temps. D’abord, la zone de saisie prend la largeur du fil : ce que vous tapez commence là où commence ma réponse et s’arrête au bord de la colonne. Ensuite, le texte tapé prend la taille de la bulle envoyée. Enfin, rien d’autre ne bouge.'
const TYPED =
  'Peux-tu vérifier l’alignement dans les trois largeurs de conversation ?\nRegarde aussi la fenêtre étroite, où la colonne remplit déjà toute la place.\nPuis le panneau de droite ouvert, et la taille 22.\nMerci !'

export async function saisieAligneeSuite(scheme) {
  console.log(`\n— Zone de saisie alignée sur le fil (${scheme})`)
  await withApp(
    scheme,
    async (ui) => {
      const setPrefs = async (prefs) => {
        await ui.ev(`window.api.settings.setPreferences(${JSON.stringify(prefs)}).then(() => true)`)
        // Posée sur la page : la variable de la taille, ou de la largeur, a changé.
        const size = prefs.conversationFontSize
        if (size)
          await ui.waitFor(
            `getComputedStyle(document.documentElement).getPropertyValue('--conv-size').trim() === '${size}px'`
          )
        await ui.frames()
      }
      const setPanel = async (open) => {
        const shown = `!!${ui.$('side-panel')}`
        if (!open) return ui.closePanel()
        if (!(await ui.ev(shown))) await ui.click(ui.$('panel-toggle'))
        await ui.waitFor(shown)
        await ui.frames()
      }
      const toBottom = async () => {
        await ui.ev(
          `(() => { const s = document.querySelector('.scroll'); s.scrollTop = s.scrollHeight })()`
        )
        await ui.frames()
      }
      /** Alignement mesuré, cadre dans la zone, aucun défilement de côté, ombre entière. */
      const aligned = async (label, shot) => {
        await toBottom()
        const m = await ui.ev(MEASURE)
        check(
          near(m.typedLeft, m.agentLeft) && near(m.typedLeft, m.columnLeft),
          `${label} : texte tapé à gauche sur le texte de l’agent (${m.typedLeft} / ${m.agentLeft})`
        )
        check(
          near(m.typedRight, m.bubbleRight) && near(m.typedRight, m.columnRight),
          `${label} : texte tapé à droite sur le bord des bulles (${m.typedRight} / ${m.bubbleRight})`
        )
        check(
          m.frameLeft - m.mainLeft >= 7 - 0.5 &&
            m.mainRight - m.frameRight >= 7 - 0.5 &&
            !m.scrolls,
          `${label} : cadre à 7 px au moins du bord de la zone, aucun défilement de côté (${m.frameLeft - m.mainLeft} / ${m.mainRight - m.frameRight})`
        )
        check(
          m.shadowRoom >= m.shadowReach,
          `${label} : ombre du cadre non coupée par la colonne (place ${m.shadowRoom} px, ombre ${m.shadowReach} px)`
        )
        if (shot) await ui.shot(shot)
        return m
      }

      await ui.ready()
      // Sans mémoire : la réponse de l'agent factice (`echo`) ne cite que le message envoyé.
      await ui.ev(`window.api.settings.setPreferences({ memoryEnabled: false }).then(() => true)`)
      await ui.viewport(1280, 820)
      await ui.send(AGENT_TEXT)
      await ui.ready()
      await setPanel(false)
      await ui.ev(`${ui.$('composer-input')}.focus()`)
      await ui.type(TYPED)
      await ui.frames()

      // Les trois largeurs de conversation, fenêtre de 1 280 px, panneau fermé.
      for (const [width, name] of [
        ['normal', 'normale'],
        ['narrow', 'etroite'],
        ['wide', 'large']
      ]) {
        await setPrefs({ threadWidth: width, conversationFontSize: 15 })
        await aligned(`largeur ${name}`, `294-largeur-${name}`)
      }

      // Taille du texte tapé = celle de la bulle, aux tailles 12, 15 et 22 ; la hauteur suit.
      await setPrefs({ threadWidth: 'normal', conversationFontSize: 15 })
      const at15 = await ui.ev(MEASURE)
      for (const size of [12, 15, 22]) {
        await setPrefs({ conversationFontSize: size })
        await toBottom()
        const m = await ui.ev(MEASURE)
        check(
          m.typedFont === m.bubbleFont &&
            m.typedLine === m.bubbleLine &&
            m.placeholderFont === m.bubbleFont,
          `taille ${size} : texte tapé et invite comme la bulle (${m.typedFont}/${m.typedLine} ; bulle ${m.bubbleFont}/${m.bubbleLine})`
        )
        check(
          m.inputFits,
          `taille ${size} : la saisie montre tout le texte tapé, sans défiler (${m.inputHeight} px)`
        )
        if (size === 22) {
          check(
            m.inputHeight > at15.inputHeight,
            `taille 22 : la saisie a grandi avec le texte (${at15.inputHeight} → ${m.inputHeight} px)`
          )
          await aligned('taille 22', '294-taille-22')
        }
        if (size === 12) await ui.shot('294-taille-12')
      }
      await setPrefs({ conversationFontSize: 15 })

      // Mode présentation (fiche 159) : le texte du fil grandit, le texte tapé aussi.
      const main = await mainProcess()
      try {
        await main.evaluate(
          `require('electron').Menu.getApplicationMenu().getMenuItemById('presentation').click()`
        )
        await ui.waitFor(`!!${ui.$('presentation-pill')}`)
        await ui.frames()
        const m = await ui.ev(MEASURE)
        check(
          m.typedFont === m.bubbleFont &&
            parseFloat(m.typedFont) > parseFloat(at15.typedFont) &&
            m.inputFits,
          `mode présentation : texte tapé comme la bulle (${m.typedFont}), saisie à sa hauteur`
        )
        await ui.click(ui.$('presentation-pill'))
        await ui.waitFor(`!${ui.$('presentation-pill')}`)
      } finally {
        main.close?.()
      }

      // Fenêtre étroite : la colonne remplit la zone du fil, le débord reste dans sa gouttière.
      await ui.viewport(760, 820)
      await aligned('fenêtre de 760 px', '294-fenetre-etroite')

      // Panneau de droite ouvert : même règle.
      await ui.viewport(1280, 820)
      await setPanel(true)
      await aligned('panneau de droite ouvert', '294-panneau')
      await ui.viewport()
    },
    undefined,
    'echo',
    {},
    [`--inspect=${MAIN_PORT}`]
  )
}
