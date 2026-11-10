import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { L, check, sleep, withApp, M } from '../lib.mjs'

/** Position d'un élément dans la fenêtre. */
const rect = (selector) =>
  `(() => { const b = ${selector}.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height, right: b.right, bottom: b.bottom } })()`

/** État de la barre de saisie : niveau de repli, ce qui se voit, ce qui est tronqué. */
const barState = `(() => {
  const bar = document.querySelector('[data-testid="composer-bar"]')
  const shown = (sel) => { const el = bar.querySelector(sel); return !!el && el.offsetWidth > 0 }
  const cut = (sel) => {
    const label = bar.querySelector(sel + ' .chip-label')
    return !!label && label.scrollWidth > label.clientWidth + 1
  }
  const width = (sel) => bar.querySelector(sel)?.getBoundingClientRect().width ?? 0
  const send = bar.querySelector('[data-testid="send"]').getBoundingClientRect()
  const composer = document.querySelector('.composer').getBoundingClientRect()
  const labels = [...bar.querySelectorAll('.chip-label')].filter((l) => l.offsetWidth > 0)
  return {
    fold: Number(bar.dataset.fold),
    fits: bar.scrollWidth <= bar.clientWidth + 1,
    capture: shown('[data-testid="capture"]'),
    percent: shown('.usage-percent'),
    modeLabel: shown('.mode-chip .chip-label'),
    modelCut: cut('.model-chip'),
    agentCut: cut('.agent-chip'),
    othersCut: labels.some((l) => !l.closest('.model-chip, .agent-chip') && l.scrollWidth > l.clientWidth + 1),
    model: width('.model-chip'),
    agent: width('.agent-chip'),
    agentIcon: bar.hasAttribute('data-agent-icon'),
    sendInside: send.right <= Math.min(innerWidth, composer.right),
    composerRight: Math.round(composer.right),
    width: innerWidth
  }
})()`

/**
 * Mode Plan (fiche 098) : ce que montrent la zone de saisie, la puce du mode et la ligne de rappel,
 * couleurs rendues (un pixel de canevas : `color-mix` et transparence compris) et contrastes WCAG.
 */
const planLook = `(() => {
  const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  const pixel = (...colors) => {
    ctx.clearRect(0, 0, 1, 1)
    for (const c of colors) { ctx.fillStyle = c; ctx.fillRect(0, 0, 1, 1) }
    return [...ctx.getImageData(0, 0, 1, 1).data]
  }
  // Fond vu à l'écran : les fonds des parents jusqu'au premier opaque, superposés.
  const backdrop = (el) => {
    const layers = []
    for (let e = el; e; e = e.parentElement) {
      const c = getComputedStyle(e).backgroundColor
      layers.unshift(c)
      if (pixel(c)[3] === 255) break
    }
    return layers
  }
  const lum = ([r, g, b]) => {
    const f = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  }
  const contrast = (el) => {
    const bg = backdrop(el)
    const [a, b] = [lum(pixel(...bg)), lum(pixel(...bg, getComputedStyle(el).color))].sort((x, y) => y - x)
    return Math.round(((a + 0.05) / (b + 0.05)) * 100) / 100
  }
  const same = (a, b) => a.slice(0, 3).every((v, i) => Math.abs(v - b[i]) <= 2)
  const root = getComputedStyle(document.documentElement)
  const plan = pixel(root.getPropertyValue('--plan'))
  const accent = pixel(root.getPropertyValue('--accent'))
  const composer = document.querySelector('.composer')
  const box = getComputedStyle(composer)
  const chip = document.querySelector('[data-testid="mode-chip"]')
  const label = chip.querySelector('.chip-label')
  const send = document.querySelector('[data-testid="send"]')
  const hint = document.querySelector('[data-testid="plan-hint"]')
  const context = document.querySelector('[data-testid="composer-context"]')
  const input = document.querySelector('[data-testid="composer-input"]')
  return {
    plan: plan.slice(0, 3),
    distinct: !same(plan, accent),
    composer: composer.dataset.plan === 'true',
    border: same(pixel(box.borderTopColor), plan),
    tinted: !same(pixel(box.backgroundColor), pixel(root.getPropertyValue('--surface'))),
    halo: /0px 0px 0px 3px/.test(box.boxShadow),
    animated: box.transitionDuration.split(',').every((d) => d.trim() === '0.15s'),
    chip: chip.dataset.plan === 'true',
    chipText: same(pixel(getComputedStyle(chip).color), plan),
    chipFilled: pixel(getComputedStyle(chip).backgroundColor)[3] === 255,
    chipLabel: label.offsetWidth > 0 ? label.textContent : '',
    chipContrast: contrast(chip),
    sendAccent: same(pixel(getComputedStyle(send).backgroundColor), accent),
    placeholder: input.placeholder,
    hint: hint && {
      text: hint.textContent,
      contrast: contrast(hint),
      between:
        hint.getBoundingClientRect().top >= composer.getBoundingClientRect().bottom &&
        (!context || hint.getBoundingClientRect().bottom <= context.getBoundingClientRect().top)
    }
  }
})()`

/**
 * Hauteur de la zone de saisie et hauteur que demande son contenu (fiche 167). Zone vide : l'invite
 * se mesure comme un texte (posée le temps de la mesure, sans événement pour React).
 */
const inputFit = `(() => {
  const el = document.querySelector('[data-testid="composer-input"]')
  const value = el.value
  if (!value) el.value = el.placeholder
  const needed = el.scrollHeight
  el.value = value
  const style = getComputedStyle(el)
  const padding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)
  return {
    needed,
    height: el.clientHeight,
    lines: Math.round((needed - padding) / parseFloat(style.lineHeight))
  }
})()`

/** Sans animation si macOS le demande : la règle `prefers-reduced-motion` couvre le mode Plan. */
const reducedMotion = `[...document.styleSheets].some((sheet) =>
  [...sheet.cssRules].some((rule) =>
    rule.conditionText?.includes('prefers-reduced-motion') &&
    ['.composer', '.mode-chip', '.composer-plan-hint'].every((sel) =>
      [...rule.cssRules].some((r) => r.selectorText?.split(',').some((s) => s.trim() === sel))
    )
  )
)`

/**
 * Zone de saisie (fiche 092) : focus après un choix dans un menu de la barre, infobulles qui ne
 * prennent pas le pointeur, dossier et branche sous la saisie, repli de la barre, accueil étroit,
 * liste des modèles avec recherche (`MOCK_MODELS=long`).
 */
export async function composerSuite(scheme) {
  console.log(`\n— Zone de saisie (${scheme})`)

  // Texte perdu après un choix de mode (essai réel du 2026-10-20), à la vraie souris : pas de
  // `ui.send`, qui rend lui-même le focus à la saisie.
  await withApp(
    scheme,
    async (ui) => {
      await ui.ready()
      const input = ui.$('composer-input')
      const value = () => ui.ev(`${input}.value`)
      check(
        await ui.ev(
          `!!${ui.$('workspace-menu')}.closest('.composer-context') && !${ui.$('workspace-menu')}.closest('.composer-bar')`
        ),
        'accueil : le dossier est sur la ligne sous la zone de saisie, plus dans la barre'
      )
      await ui.click(ui.$('mode-chip'))
      await ui.waitFor(`!!${ui.$('control-mode-ask')}`)
      await ui.click(ui.$('control-mode-ask'))
      await ui.waitFor(`${ui.$('mode-chip')}.innerText.includes('${M('Question')}')`)
      // Au-delà du délai d'ouverture des infobulles.
      await sleep(700)
      check(
        await ui.ev(`document.activeElement === ${input}`),
        'après un choix de mode, le focus revient à la zone de saisie'
      )
      check(!(await ui.ev(`!!document.querySelector('.tooltip')`)), '… sans infobulle ouverte')
      // Clic dans la saisie juste au-dessus de la puce, là où s'ouvrait l'infobulle.
      const chip = await ui.ev(rect(ui.$('mode-chip')))
      const box = await ui.ev(rect(input))
      await ui.clickAt({ x: chip.x + chip.w / 2, y: box.bottom - 6 })
      await ui.type('Bonjour')
      check(
        (await value()) === 'Bonjour',
        'clic dans la saisie, frappe : le texte est dans la saisie'
      )
      await ui.enter()
      await ui.waitFor(`document.querySelectorAll('.msg-user').length === 1`)
      check((await value()) === '', 'Entrée envoie le message')
      await ui.ready()

      // Fil remonté : un message envoyé ramène en bas, sa bulle visible (fiche 127, D26).
      await ui.send(Array.from({ length: 50 }, (_, i) => `Ligne ${i + 1}`).join('\n'))
      await ui.ready()
      const scroller = `document.querySelector('.main > .scroll')`
      await ui.ev(`${scroller}.scrollTop = 0; true`)
      await ui.waitFor(`!!${ui.$('scroll-to-bottom')}`)
      await ui.ev(`${input}.focus(); true`)
      await ui.type('Mon message est-il parti ?')
      await ui.enter()
      await ui.waitFor(`document.querySelectorAll('.msg-user').length === 3`)
      await sleep(150)
      const sent = await ui.ev(`(() => {
        const bubble = [...document.querySelectorAll('.msg-user')].at(-1).getBoundingClientRect()
        const view = ${scroller}.getBoundingClientRect()
        return { top: bubble.top >= view.top, bottom: bubble.bottom <= view.bottom }
      })()`)
      check(
        sent.top && sent.bottom && !(await ui.ev(`!!${ui.$('scroll-to-bottom')}`)),
        `fil remonté, message envoyé : retour en bas, bulle envoyée visible (${JSON.stringify(sent)})`
      )
      await ui.ready()
      await ui.waitFor(
        `${scroller}.scrollHeight - ${scroller}.scrollTop - ${scroller}.clientHeight < 60`
      )
      check(true, '… et la réponse suivie jusqu’en bas')
      await ui.shot('composer-1b-envoi-fil-remonte')

      // Infobulle ouverte par-dessus la saisie (puce focalisée, comme Radix le faisait en rendant le
      // focus) : un clic dessus atteint la zone de saisie.
      await ui.ev(`${ui.$('mode-chip')}.focus()`)
      await ui.waitFor(`!!document.querySelector('.tooltip')`)
      await sleep(200)
      const tip = await ui.ev(rect(`document.querySelector('.tooltip')`))
      const area = await ui.ev(rect(input))
      const center = { x: tip.x + tip.w / 2, y: tip.y + tip.h / 2 }
      check(
        tip.y < area.bottom &&
          (await ui.ev(`document.elementFromPoint(${center.x}, ${center.y}) === ${input}`)),
        'une infobulle ouverte sur la zone de saisie ne prend pas le pointeur'
      )
      await ui.shot('composer-1-infobulle')
      await ui.clickAt(center)
      await ui.type('Suite')
      check(
        (await value()) === 'Suite' && (await ui.ev(`document.activeElement === ${input}`)),
        'un clic à travers l’infobulle met le curseur dans la saisie'
      )

      // Échap : le focus revient à la puce (clavier), comme avant.
      await ui.click(ui.$('mode-chip'))
      await ui.waitFor(`!!${ui.$('mode-menu-content')}`)
      await ui.key('Escape')
      await ui.waitFor(`!${ui.$('mode-menu-content')}`)
      await sleep(100)
      check(
        await ui.ev(`document.activeElement === ${ui.$('mode-chip')}`),
        'Échap ferme le menu et rend le focus à la puce'
      )
    },
    undefined,
    'echo'
  )

  // Liste façon OpenCode, nom de modèle long : recherche, repli de la barre.
  await withApp(
    scheme,
    async (ui) => {
      await ui.ready()
      await ui.click(ui.$('model-chip'))
      await ui.waitFor(`!!${ui.$('model-search')}`)
      await sleep(300)
      const menu = await ui.ev(`(() => {
        const menu = ${ui.$('model-menu-content')}
        const list = menu.querySelector('.model-list')
        const box = menu.getBoundingClientRect()
        const lb = list.getBoundingClientRect()
        const current = menu.querySelector('[aria-selected="true"]')
        const cb = current.getBoundingClientRect()
        return {
          inside: box.top >= 0 && box.bottom <= innerHeight,
          scrolls: list.scrollHeight > list.clientHeight,
          options: menu.querySelectorAll('[role="option"]').length,
          current: current.dataset.testid,
          highlighted: menu.querySelector('[data-highlighted]')?.dataset.testid,
          visible: cb.top >= lb.top && cb.bottom <= lb.bottom,
          title: current.querySelector('.menu-title').textContent,
          provider: current.querySelector('.model-provider')?.textContent
        }
      })()`)
      check(
        await ui.ev(`document.activeElement === ${ui.$('model-search')}`),
        'liste longue : curseur dans le champ de recherche'
      )
      check(
        menu.inside && menu.scrolls && menu.options >= 30,
        `liste longue (${menu.options} modèles) : dans la fenêtre, avec défilement`
      )
      check(
        menu.current === 'control-model-factice-rapide' &&
          menu.highlighted === menu.current &&
          menu.visible,
        'ouverte sur le modèle en cours, visible et en surbrillance'
      )
      check(
        menu.title === M('Factice rapide') &&
          menu.provider === M('factice/Factice rapide').split('/')[0],
        'ligne : nom court, fournisseur à part'
      )
      await ui.shot('composer-2-modeles')
      await ui.type('6.1 SOL')
      await ui.waitFor(
        `${ui.$('model-menu-content')}.querySelectorAll('[role="option"]').length === 2`
      )
      await ui.shot('composer-3-modeles-recherche')
      await ui.press('ArrowDown')
      await ui.press('Enter')
      await ui.waitFor(`${ui.$('model-chip')}?.innerText.trim() === 'GPT-6.1 Sol Fast'`)
      await sleep(300)
      check(
        await ui.ev(`document.activeElement === ${ui.$('composer-input')}`),
        'recherche, ↓, Entrée : modèle choisi, focus rendu à la zone de saisie'
      )
      await ui.send('Bonjour')
      await ui.ready()
      check(
        (await ui.lastAgentText()).includes('openai/gpt-6.1-sol-fast'),
        'le modèle choisi est appliqué par l’agent'
      )
      await ui.waitFor(`!!${ui.$('usage-meter')}`)

      // Panneau « Session » ouvert de lui-même (fiche 166) : fermé, la barre a toute la place.
      await ui.closePanel()
      // La barre se déplie une fois la place rendue (mesure au rendu suivant).
      await ui.waitFor(`${barState}.fold === 0`, 3000).catch(() => {})
      // Fenêtre large : tout est là, rien de tronqué.
      let bar = await ui.ev(barState)
      check(
        bar.fold === 0 && bar.capture && bar.percent && bar.modeLabel && bar.fits,
        'fenêtre large : barre complète (capture, pourcentage, nom du mode)'
      )
      check(!bar.modelCut && !bar.agentCut && !bar.othersCut, '… et aucun nom tronqué')
      await ui.shot('composer-4-barre-large')

      // Demi-écran : repli, sans rien tronquer.
      await ui.viewport(760)
      bar = await ui.ev(barState)
      check(
        bar.fold >= 1 && !bar.capture && bar.fits && bar.sendInside,
        `760 px : la capture passe sous 📎 (niveau ${bar.fold}), la barre tient`
      )
      check(
        !bar.agentCut && !bar.othersCut && (bar.modelCut ? bar.fold === 3 : true),
        `760 px : rien de tronqué, sauf le modèle une fois tout replié (${Math.round(bar.model)} px)`
      )
      await ui.shot('composer-5-barre-760')
      await ui.click(ui.$('attach'))
      await ui.waitFor(`!!${ui.$('attach-menu-content')}`)
      check(
        (await ui.ev(`${ui.$('attach-menu-content')}.innerText`)).includes(
          L('composer.capture.item')
        ) && (await ui.ev(`!!${ui.$('attach-files')}`)),
        '📎 replié : « Joindre des fichiers… » et « Capturer une zone de l’écran »'
      )
      await ui.shot('composer-6-menu-joindre')
      await ui.key('Escape')
      await ui.waitFor(`!${ui.$('attach-menu-content')}`)

      // Mode plan : icône à part (repliée, le mode n'a plus que son icône).
      const icon = () => ui.ev(`${ui.$('mode-chip')}.querySelector('svg').getAttribute('class')`)
      const before = await icon()
      await ui.click(ui.$('mode-chip'))
      await ui.waitFor(`!!${ui.$('control-mode-plan')}`)
      await ui.click(ui.$('control-mode-plan'))
      await ui.waitFor(`${ui.$('mode-chip')}.dataset.plan === 'true'`)
      check((await icon()) !== before, 'le mode plan a son icône, distincte des autres modes')

      // Plus étroit encore : le mode garde son icône, puis le modèle se tronque, l'agent en dernier.
      await ui.viewport(640)
      bar = await ui.ev(barState)
      check(
        bar.fold === 3 && !bar.modeLabel && !bar.percent && bar.fits && bar.sendInside,
        `640 px : mode en icône, anneau seul, envoi visible (niveau ${bar.fold})`
      )
      check(
        !bar.othersCut && bar.modelCut && bar.model >= 56,
        `640 px : seuls le modèle (${Math.round(bar.model)} px) et l’agent (${bar.agentIcon ? 'chevron seul' : `${Math.round(bar.agent)} px`}) cèdent`
      )
      await ui.shot('composer-7-barre-640')
      // La barre latérale cède jusqu'à 220 px (fiche 113) : la conversation n'a plus que 280 px.
      await ui.viewport(500)
      bar = await ui.ev(barState)
      check(
        bar.fold === 4 && bar.fits && bar.sendInside,
        '500 px (panneau ouvert sur une petite fenêtre) : la barre passe sur deux lignes, envoi visible'
      )
      await ui.shot('composer-8-barre-500')

      // Zone de texte aussi haute que son contenu, invite comprise (fiche 167) : la largeur
      // change après coup, la hauteur doit suivre.
      const input = await ui.ev(inputFit)
      check(
        input.height >= input.needed - 1,
        `500 px, mode Plan : l’invite (${input.lines} ligne(s)) est entière (${input.height} px pour ${input.needed} px)`
      )
      await ui.click(ui.$('mode-chip'))
      await ui.waitFor(`!!${ui.$('control-mode-code')}`)
      await ui.click(ui.$('control-mode-code'))
      await ui.waitFor(`${ui.$('mode-chip')}.dataset.plan !== 'true'`)
      const code = await ui.ev(inputFit)
      check(
        code.height >= code.needed - 1,
        `500 px, mode Code : l’invite (${code.lines} ligne(s)) est entière`
      )
      // Texte tapé large, puis conversation rétrécie : il garde toutes ses lignes.
      await ui.viewport(760)
      await ui.click(ui.$('composer-input'))
      await ui.type(
        'Un message assez long pour tenir sur une ligne en fenêtre moyenne, et sur deux ou trois ensuite'
      )
      await ui.viewport(500)
      const typed = await ui.ev(inputFit)
      check(
        typed.lines >= 2 && typed.height >= typed.needed - 1,
        `500 px : le texte tapé (${typed.lines} lignes) est entier, sans défilement`
      )
      await ui.shot('composer-8b-texte-500')
      await ui.viewport()
    },
    undefined,
    'echo',
    { MOCK_MODELS: 'long' }
  )

  // Accueil en fenêtre étroite : la zone de saisie et l'envoi restent dans la fenêtre.
  await withApp(scheme, async (ui) => {
    await ui.ready()
    await ui.viewport(760)
    const home = await ui.ev(`(() => {
      const composer = document.querySelector('.composer').getBoundingClientRect()
      const send = ${ui.$('send')}.getBoundingClientRect()
      const context = ${ui.$('composer-context')}.getBoundingClientRect()
      const suggestions = [...document.querySelectorAll('[data-testid="suggestion"]')]
      return {
        composer: Math.round(composer.right),
        send: send.right,
        below: context.top >= composer.bottom,
        suggestions: Math.max(...suggestions.map((s) => s.getBoundingClientRect().right)),
        width: innerWidth
      }
    })()`)
    check(
      home.composer <= home.width && home.send <= home.composer,
      `accueil à 760 px : zone de saisie (bord droit ${home.composer} px) et envoi dans la fenêtre`
    )
    check(home.suggestions <= home.width, 'accueil à 760 px : suggestions dans la fenêtre')
    check(home.below, 'accueil : dossier et branche sous la zone de saisie')
    await ui.shot('composer-9-accueil-760')
    await ui.click(ui.$('composer-input'))
    await ui.type('Explique ce projet')
    await ui.click(ui.$('send'))
    await ui.waitFor(`document.querySelectorAll('.msg-user').length === 1`)
    check(true, 'accueil à 760 px : le bouton d’envoi se clique')
    await ui.viewport()
  })

  await planModeVisible(scheme)
}

/**
 * Mode Plan visible (fiche 098), avec le plan dans un fichier (scénario `plan-fichier`) : couleur,
 * pastille, invite, ligne de rappel ; retour à la normale par Maj+Tab et « Exécuter le plan » ;
 * accent violet (Plan bleu), Sépia ou Nuit noire selon la passe.
 */
async function planModeVisible(scheme) {
  const workspace = mkdtempSync(join(tmpdir(), 'bob-e2e-plan-visible-'))
  try {
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        // Couleurs lues une fois les transitions finies (bouton d'envoi, fiche 185, P7).
        const look = async () => {
          await ui.waitFor(`!document.querySelector('.send-button')?.getAnimations().length`)
          return ui.ev(planLook)
        }
        const planOn = `document.querySelector('.composer').dataset.plan === 'true'`
        const agent = await ui.ev(
          `window.api.conversations.get().then((s) => window.api.conversations.view(s.activeId)).then((v) => v.snapshot.info.profileLabel)`
        )
        let state = await look()
        check(
          !state.composer && !state.chip && !state.hint && state.animated,
          'mode Code : zone de saisie habituelle, sans ligne de rappel (transitions de 150 ms)'
        )
        check(
          await ui.ev(reducedMotion),
          '« réduire les animations » : aucune transition du mode Plan'
        )

        // Passage en Plan à la souris, par la puce du mode.
        await ui.click(ui.$('mode-chip'))
        await ui.waitFor(`!!${ui.$('control-mode-plan')}`)
        await ui.click(ui.$('control-mode-plan'))
        await ui.waitFor(planOn)
        await sleep(400)
        state = await look()
        check(
          state.border && state.tinted && state.halo,
          'mode Plan : bordure et halo de la couleur du plan, fond teinté'
        )
        check(
          state.chip && state.chipText && state.chipFilled && state.chipLabel === 'Plan',
          'la puce du mode devient une pastille « Plan » colorée'
        )
        check(
          state.placeholder === L('composer.plan.placeholder', { agent }),
          `invite : « ${state.placeholder} »`
        )
        check(
          state.hint?.text === L('composer.plan.hint', { mode: 'Code' }) && state.hint.between,
          'ligne de rappel sous la zone de saisie, au-dessus de la ligne du dossier'
        )
        check(
          state.hint.contrast >= 4.5 && state.chipContrast >= 4.5,
          `contraste AA : ligne de rappel ${state.hint.contrast}:1, pastille ${state.chipContrast}:1`
        )
        await ui.type('Propose un plan pour goodbye()')
        state = await look()
        check(
          state.distinct && state.sendAccent,
          'le bouton d’envoi garde l’accent, distinct du Plan'
        )
        await ui.shot('composer-10-plan')
        await ui.enter()
        await ui.waitFor(`!!${ui.$('plan-document')}`)
        await ui.ready()
        state = await look()
        check(
          state.composer && state.placeholder === L('composer.plan.placeholder', { agent }),
          'en conversation : toujours en mode Plan, même invite'
        )
        await ui.shot('composer-11-plan-conversation')

        // Fenêtre étroite : la puce repliée en icône garde la couleur.
        await ui.viewport(640)
        state = await look()
        check(
          state.chip && !state.chipLabel && state.chipFilled && state.chipText,
          'fenêtre étroite : la puce repliée en icône garde la couleur du Plan'
        )
        await ui.shot('composer-12-plan-640')
        await ui.viewport()

        // Maj+Tab : retour au mode suivant (Code), puis deux fois pour revenir en Plan.
        await ui.click(ui.$('composer-input'))
        await ui.press('Tab', 8)
        await ui.waitFor(`!(${planOn})`)
        await sleep(400)
        state = await look()
        check(
          !state.chip &&
            !state.hint &&
            !state.border &&
            !state.tinted &&
            !state.halo &&
            state.placeholder === L('composer.placeholder.reply', { agent }),
          'Maj+Tab : en Code, la zone de saisie redevient normale'
        )
        await ui.press('Tab', 8)
        await ui.waitFor(`${ui.$('mode-chip')}.innerText.includes('${M('Question')}')`)
        await ui.press('Tab', 8)
        await ui.waitFor(planOn)
        check(true, 'Maj+Tab deux fois : de nouveau en Plan')

        // « Exécuter le plan » : retour au mode d'exécution, la couleur part avec le mode.
        await ui.click(`[...document.querySelectorAll('[data-testid=plan-execute]')].at(-1)`)
        await ui.waitFor(`!(${planOn})`)
        await ui.ready()
        await sleep(400)
        state = await look()
        check(
          !state.chip && !state.hint && !state.tinted,
          '« Exécuter le plan » : en Code, la zone de saisie redevient normale'
        )

        // Accent violet : le Plan passe au bleu ; Sépia (clair) ou Nuit noire (sombre) ; Fjord.
        await ui.click(ui.$('mode-chip'))
        await ui.waitFor(`!!${ui.$('control-mode-plan')}`)
        await ui.click(ui.$('control-mode-plan'))
        await ui.waitFor(planOn)
        const palette = scheme === 'dark' ? 'black' : 'sepia'
        const before = await ui.ev(`({ ...document.documentElement.dataset })`)
        const themes = [
          { accent: 'violet', palette: '', name: 'accent violet' },
          {
            accent: before.accent ?? '',
            palette,
            name: palette === 'black' ? 'Nuit noire' : 'Sépia'
          },
          {
            accent: 'violet',
            palette,
            name: `${palette === 'black' ? 'Nuit noire' : 'Sépia'}, accent violet`
          },
          // Fjord (fiche 168) : Fjord en clair, Fjord nuit en sombre.
          {
            accent: before.accent ?? '',
            palette: scheme === 'dark' ? 'fjordNight' : 'fjord',
            name: scheme === 'dark' ? 'Fjord nuit' : 'Fjord'
          }
        ]
        for (const [i, theme] of themes.entries()) {
          await ui.ev(
            `Object.assign(document.documentElement.dataset, { accent: '${theme.accent}', palette: '${theme.palette}' })`
          )
          await sleep(400)
          state = await look()
          const [r, g] = state.plan
          const blue = g > r
          check(
            state.distinct && (theme.accent === 'violet' ? blue : !blue),
            `${theme.name} : Plan ${blue ? 'bleu' : 'violet'} (${state.plan.join(', ')}), distinct de l’accent`
          )
          check(
            state.hint?.contrast >= 4.5 && state.chipContrast >= 4.5,
            `${theme.name} : contraste AA, ligne ${state.hint?.contrast}:1, pastille ${state.chipContrast}:1`
          )
          const suffix = [theme.accent === 'violet' && 'violet', theme.palette].filter(Boolean)
          await ui.shot(`composer-${13 + i}-plan-${suffix.join('-')}`)
        }
        await ui.ev(
          `Object.assign(document.documentElement.dataset, { accent: '${before.accent ?? ''}', palette: '${before.palette ?? ''}' })`
        )
      },
      undefined,
      'plan-fichier',
      { BOBINE_WORKSPACE: workspace }
    )
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
}
