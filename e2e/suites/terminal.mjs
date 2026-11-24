import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { TERMINAL_TEXT, check, withApp } from '../lib.mjs'
import { variantOf, withPalette } from '../palette.mjs'

/** Terminal à côté de la conversation (fiche 034). */
export async function terminalPanelSuite(scheme) {
  console.log(`\n— Terminal (${scheme})`)
  const workspace = mkdtempSync(join(tmpdir(), 'bob-e2e-term-'))
  try {
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        // ⌃` : terminal ouvert à droite, avec le clavier (plus de bouton dans l'en-tête, fiche 049).
        // Terminal de l'onglet affiché : les autres restent dans la page, cachés (fiche 126).
        const shown = (selector) =>
          `[...document.querySelectorAll('.terminal-host ${selector}')].find((e) => !e.closest('[hidden]'))`
        const rows = TERMINAL_TEXT
        await ui.press('`', 2)
        await ui.waitFor(`!!${ui.$('terminal-tab')}`)
        await ui.waitFor(
          `document.activeElement?.classList.contains('xterm-helper-textarea') && ${rows}.trim() !== ''`
        )
        await ui.type('echo bouton-$((1+1))')
        await ui.enter()
        await ui.waitFor(`${rows}.includes('bouton-2')`)
        await ui.shot('30-terminal-bouton')
        // Icônes des invites (powerlevel10k, starship) : Nerd Font livrée avec l'app (fiche 201),
        // même sans Nerd Font installée. Ligne 1 : flèche powerline, branche git, dossier, icône
        // « md » au-delà du plan de base. Ligne 2, comme un segment de powerlevel10k : fond coloré,
        // pomme, horloge, puis le bout arrondi. Octets UTF-8 en octal : compris par tous les `printf`.
        await ui.type(
          String.raw`printf 'icones \356\202\260 \356\202\240 main \357\201\274 src \363\260\211\213 fin\nsegment\033[44m \357\205\271 \357\200\227 12:00 \033[0m\356\202\264\n'`
        )
        await ui.enter()
        await ui.waitFor(`${rows}.includes('segment \\uf179 \\uf017 12:00 \\ue0b4')`)
        await ui.shot('30-terminal-icones')
        // Une icône n'est pas coupée si : elle avance d'une cellule exactement (sinon xterm.js la
        // recale par un `letter-spacing` à part, dans sa propre <span> dont le débordement passe
        // sous le fond de la suivante — le défaut de la première version), son dessin ne déborde
        // pas à gauche, et à droite au plus sur la cellule suivante (l'espace que les invites
        // laissent après une icône) ; à l'écran, elle partage sa <span> avec cet espace.
        const icons = await ui.ev(`(async () => {
          await document.fonts.ready
          const rowsEl = ${shown('.xterm-rows')}
          const family = getComputedStyle(rowsEl).fontFamily
          const size = parseFloat(getComputedStyle(rowsEl).fontSize)
          const face = [...document.fonts].find((f) => f.family.replace(/"/g, '') === 'Bobine Nerd Font')
          // Mesures à 64 fois la taille, ramenées ensuite : Chromium sous Linux arrondit les bornes
          // de l'encre au pixel entier (« W » : 0..8 pour une cellule de 7,53), ce qui ferait d'un
          // débord voulu d'une fraction de pixel (flèche powerline) un débord d'un pixel entier.
          const scale = 64
          const g = document.createElement('canvas').getContext('2d')
          g.font = size * scale + 'px ' + family
          const measure = (text) => {
            const m = g.measureText(text)
            return {
              width: m.width / scale,
              actualBoundingBoxLeft: m.actualBoundingBoxLeft / scale,
              actualBoundingBoxRight: m.actualBoundingBoxRight / scale
            }
          }
          const cell = measure('W').width
          const lines = [...rowsEl.children]
          const spacing = (e) => parseFloat(e.style.letterSpacing) || 0
          const bad = []
          const cases = [['icones ', '\\ue0b0\\ue0a0\\uf07c\\u{f024b}'], ['segment ', '\\uf179\\uf017']]
          for (const [prefix, chars] of cases) {
            const line = lines.filter((l) => l.textContent.startsWith(prefix)).at(-1)
            for (const ch of chars) {
              const m = measure(ch)
              const span = line && [...line.querySelectorAll('span')].find((s) => s.textContent.includes(ch))
              const shares = !!span && span.textContent.includes(ch + ' ')
              const ok =
                Math.abs(m.width - cell) < 0.05 &&
                m.actualBoundingBoxLeft <= 0.5 &&
                m.actualBoundingBoxRight <= 2 * cell + 0.5 &&
                !!span && Math.abs(spacing(span) - spacing(rowsEl)) < 0.05 && shares
              if (!ok) {
                bad.push(ch.codePointAt(0).toString(16) + ' (avance ' + m.width.toFixed(2) + ' / cellule ' +
                  cell.toFixed(2) + ', encre ' + (-m.actualBoundingBoxLeft).toFixed(2) + '..' +
                  m.actualBoundingBoxRight.toFixed(2) + ', letter-spacing « ' + (span?.style.letterSpacing ?? '?') +
                  ' », avec l’espace : ' + shares + ')')
              }
            }
          }
          return { status: face?.status, inStack: family.includes('Bobine Nerd Font'), bad }
        })()`)
        check(
          icons.status === 'loaded' && icons.inStack,
          `icônes des invites : Nerd Font livrée chargée, dans la police du terminal (${icons.status})`
        )
        check(
          icons.bad.length === 0,
          `icônes entières : une cellule d’avance, débord sur l’espace suivant seulement ${icons.bad.join(' ; ')}`
        )
        // Terminal refermé : la commande de l'agent le rouvre (vérifié dans `parcours-outils`).
        await ui.press('`', 2)
        await ui.waitFor(`!${ui.$('terminal-tab')}`)
        await ui.send('Lance la commande')
        await ui.waitFor(`!!${ui.$('questions')}`)
        // « Toujours cette commande ici » : retenu pour ce dossier, listé dans les Réglages.
        await ui.press('2')
        await ui.ready()
        await ui.waitFor(`!!${ui.$('terminal-tab')}`)
        await ui.click(ui.$('open-settings'))
        await ui.waitFor(`!!${ui.$('settings')}`)
        await ui.click(ui.$('settings-privacy'))
        await ui.waitFor(`!!${ui.$('settings-approved-commands')}`)
        await ui.ev(`${ui.$('settings-approved-commands')}.scrollIntoView({ block: 'center' })`)
        await ui.shot('32-commandes-autorisees')
        await ui.click(ui.$('forget-command'))
        await ui.waitFor(`!!${ui.$('confirm-row')}`)
        await ui.click(ui.$('confirm-row-confirm'))
        await ui.waitFor(`!${ui.$('settings-approved-commands')}`)
        await ui.key('Escape')
        await ui.waitFor(`!${ui.$('settings')}`)
        // L'utilisateur tape dans le terminal.
        await ui.ev(`${shown('.xterm-helper-textarea')}.focus()`)
        await ui.type('echo saisie-$((40+2))')
        await ui.enter()
        await ui.waitFor(`${rows}.includes('saisie-42')`)
        await ui.shot('31-terminal')
        const variant = variantOf(scheme)
        await withPalette(ui, variant, async () => {
          await ui.shot(`31-terminal-${variant}`)
        })
        // Sélection d'une ligne à la souris, puis « Ajouter au message ».
        const row = await ui.ev(
          `(() => { const r = [...document.querySelectorAll('.terminal-host .xterm-rows > div')].find((d) => d.innerText.startsWith('saisie-42')).getBoundingClientRect(); return { a: { x: r.x + 2, y: r.y + r.height / 2 }, b: { x: r.x + 120, y: r.y + r.height / 2 } } })()`
        )
        await ui.drag(row.a, row.b)
        await ui.waitFor(`!!${ui.$('terminal-add-to-message')}`)
        await ui.click(ui.$('terminal-add-to-message'))
        await ui.waitFor(`${ui.$('composer-input')}.value.includes('saisie-42')`)
        check(
          (await ui.ev(`${ui.$('composer-input')}.value`)).startsWith('Terminal 2'),
          'extrait du terminal joint au message, avec l’onglet d’origine'
        )
        // Deux onglets remplissent la rangée, qui défile (sa barre de défilement passe sur « + ») :
        // clic par la page.
        await ui.ev(`${ui.$('terminal-new')}.click(); true`)
        await ui.waitFor(
          `document.querySelectorAll('[data-testid=terminal-tab-chip]').length === 3`
        )
        // Refuser la commande (fiche 122) : la carte dit « refusé », pas une coche verte, même
        // si l'agent la dit finie (comme OpenCode).
        await ui.click(ui.$('composer-input'))
        await ui.ev(`${ui.$('composer-input')}.select()`)
        await ui.send('/scenario terminal-refus')
        await ui.waitFor(`!!${ui.$('questions')}`)
        await ui.press('3')
        await ui.ready()
        const card = `[...document.querySelectorAll('[data-testid=tool]')].at(-1)`
        await ui.ev(`${card}?.scrollIntoView({ block: 'center' })`)
        await ui.shot('33-terminal-refus')
      },
      undefined,
      'terminal',
      { BOBINE_WORKSPACE: workspace }
    )
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
}
