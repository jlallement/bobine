import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { L, check, withApp } from '../lib.mjs'
import { rgb, tokensOf, variantOf, withPalette } from '../palette.mjs'

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
        const rows = `(${shown('.xterm-rows')}?.innerText ?? '')`
        await ui.press('`', 2)
        await ui.waitFor(`!!${ui.$('terminal-tab')}`)
        await ui.waitFor(
          `document.activeElement?.classList.contains('xterm-helper-textarea') && ${rows}.trim() !== ''`
        )
        await ui.type('echo bouton-$((1+1))')
        await ui.enter()
        await ui.waitFor(`${rows}.includes('bouton-2')`)
        check(true, '⌃` : un terminal s’ouvre à droite et prend le clavier')
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
          const g = document.createElement('canvas').getContext('2d')
          g.font = size + 'px ' + family
          const cell = g.measureText('W').width
          const lines = [...rowsEl.children]
          const spacing = (e) => parseFloat(e.style.letterSpacing) || 0
          const bad = []
          const cases = [['icones ', '\\ue0b0\\ue0a0\\uf07c\\u{f024b}'], ['segment ', '\\uf179\\uf017']]
          for (const [prefix, chars] of cases) {
            const line = lines.filter((l) => l.textContent.startsWith(prefix)).at(-1)
            for (const ch of chars) {
              const m = g.measureText(ch)
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
        await ui.press('`', 2)
        await ui.waitFor(`!${ui.$('terminal-tab')}`)
        await ui.press('`', 2)
        await ui.waitFor(
          `!!${ui.$('terminal-tab')} && document.activeElement?.classList.contains('xterm-helper-textarea')`
        )
        await ui.press('`', 2)
        await ui.waitFor(`!${ui.$('terminal-tab')}`)
        check(true, '⌃` ouvre et referme le terminal, même quand il a le clavier')
        await ui.send('Lance la commande')
        await ui.waitFor(`!!${ui.$('questions')}`)
        check(
          (await ui.ev(`${ui.$('questions')}.innerText`)).includes('bonjour du terminal'),
          'commande montrée à l’utilisateur avant de partir dans le terminal'
        )
        check(
          (await ui.ev(`${ui.$('questions')}.innerText`)).includes(L('approvals.alwaysInProject')),
          'trois choix, comme Claude Code : Lancer, Toujours dans ce projet, Refuser (fiche 072)'
        )
        // « Toujours dans ce projet » : retenu pour ce dossier, listé dans les Réglages.
        await ui.press('2')
        await ui.ready()
        const reply = await ui.lastAgentText()
        // L'onglet 1 est celui de l'utilisateur (⌃`) : l'agent ouvre le sien (fiche 126).
        check(
          reply.includes('Started in terminal tab 2') && reply.includes('bonjour du terminal 42'),
          'commande lancée dans un onglet de l’agent, écran lu par l’agent (sortie du shell)'
        )
        check(
          (await ui.ev(`!!${ui.$('terminal-tab')}`)) &&
            (await ui.ev(rows)).includes('bonjour du terminal 42'),
          'onglet « Terminal » ouvert tout seul, historique affiché par xterm.js'
        )
        await ui.click(ui.$('open-settings'))
        await ui.waitFor(`!!${ui.$('settings')}`)
        await ui.click(ui.$('settings-privacy'))
        await ui.waitFor(`!!${ui.$('settings-approved-commands')}`)
        check(
          (await ui.ev(`${ui.$('settings-allowed')}.innerText`)).includes('bonjour du terminal'),
          'Réglages › Confidentialité : la commande retenue est listée sous son dossier'
        )
        await ui.ev(`${ui.$('settings-approved-commands')}.scrollIntoView({ block: 'center' })`)
        await ui.shot('32-commandes-autorisees')
        await ui.click(ui.$('forget-command'))
        await ui.waitFor(`!!${ui.$('confirm-row')}`)
        await ui.click(ui.$('confirm-row-confirm'))
        await ui.waitFor(`!${ui.$('settings-approved-commands')}`)
        check(true, 'commande retenue oubliée depuis les Réglages')
        await ui.key('Escape')
        await ui.waitFor(`!${ui.$('settings')}`)
        // L'utilisateur tape dans le terminal.
        await ui.ev(`${shown('.xterm-helper-textarea')}.focus()`)
        await ui.type('echo saisie-$((40+2))')
        await ui.enter()
        await ui.waitFor(`${rows}.includes('saisie-42')`)
        check(true, 'saisie au clavier dans le terminal')
        await ui.shot('31-terminal')
        // Couleurs du terminal : jetons de la palette, ANSI compris ; elles suivent la variante du
        // mode et l'accent sans rouvrir l'onglet (fiche 134).
        const xterm = `(() => {
          const instance = ${shown('.terminal-instance')}
          const painted = [...instance.querySelectorAll('*')].find((e) => e.style.backgroundColor)
          const css = [...instance.querySelectorAll('style')].map((s) => s.textContent).join('')
          return { background: painted?.style.backgroundColor ?? '', css }
        })()`
        const follows = async (palette) => {
          const t = tokensOf(palette)
          await ui.waitFor(`${xterm}.background === '${rgb(t.surface)}'`, 3000)
          const { css } = await ui.ev(xterm)
          return css.includes(t.ansi[3]) && css.includes(t.ansi[4])
        }
        check(await follows(scheme), 'terminal : fond et palette ANSI des jetons')
        const variant = variantOf(scheme)
        await withPalette(ui, variant, async () => {
          check(await follows(variant), `terminal en ${variant} sans rouvrir l’onglet`)
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
        check(true, 'nouvel onglet de terminal')
        // Refuser la commande (fiche 122) : la carte dit « refusé », pas une coche verte, même
        // si l'agent la dit finie (comme OpenCode).
        await ui.click(ui.$('composer-input'))
        await ui.ev(`${ui.$('composer-input')}.select()`)
        await ui.send('/scenario terminal-refus')
        await ui.waitFor(`!!${ui.$('questions')}`)
        await ui.press('3')
        await ui.ready()
        const card = `[...document.querySelectorAll('[data-testid=tool]')].at(-1)`
        check(
          (await ui.ev(`${card}?.dataset.status`)) === 'refused' &&
            (await ui.ev(`${card}?.innerText`)).includes(L('toolCall.state.refused')),
          'commande refusée : la carte dit « refusé », sans coche verte (fiche 122)'
        )
        check(
          (await ui.lastAgentText()).includes('The user refused'),
          'l’agent reçoit le refus (résultat en erreur)'
        )
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
