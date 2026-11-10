import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { L, check, withApp } from '../lib.mjs'

/** Plan annoté : plan dans un fichier (comme Bob), remarques, nouvelle version, exécution (fiche 040). */
export async function planSuite(scheme) {
  console.log(`\n— Plan annoté (${scheme})`)
  const workspace = mkdtempSync(join(tmpdir(), 'bob-e2e-plan-'))
  try {
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        await ui.ev(
          `window.api.conversations.get().then((s) => window.api.agent.setControl(s.activeId, 'mode', 'plan'))`
        )
        await ui.waitFor(`document.body.innerText.includes('Plan')`)
        await ui.send('Propose un plan pour goodbye()')
        await ui.ready()
        // Panneau « Session » ouvert de lui-même (fiche 166) : fermé, le fil garde sa largeur.
        await ui.closePanel()
        await ui.waitFor(`!!${ui.$('plan-document')}`)
        check(
          (await ui.ev(`${ui.$('plan-document')}.innerText`)).includes('plan.md') &&
            (await ui.ev(`${ui.$('plan-document')}.dataset.version`)) === '1',
          'mode plan : plan écrit dans plan.md affiché comme document (version 1)'
        )

        /** Boîtes des boutons de la barre du plan (dernière carte). */
        const buttons = () =>
          ui.ev(`(() => {
            const box = (id) => {
              const b = [...document.querySelectorAll('[data-testid=' + id + ']')].at(-1).getBoundingClientRect()
              return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }
            }
            return { send: box('plan-send-notes'), execute: box('plan-execute') }
          })()`)
        const sameColumns = (a, b) =>
          a.send.x === b.send.x &&
          a.send.w === b.send.w &&
          a.execute.x === b.execute.x &&
          a.execute.w === b.execute.w
        /** Ce qu'un clic au milieu de l'ancien « Envoyer mes remarques » toucherait maintenant. */
        const underOldSend = (old, now) =>
          ui.ev(
            `document.elementFromPoint(${old.send.x + old.send.w / 2}, ${now.send.y + now.send.h / 2})?.closest('button')?.dataset.testid`
          )
        const hint = () =>
          ui.ev(`[...document.querySelectorAll('.plan-document-hint')].at(-1).innerText`)
        const noHint = await buttons()

        // Sélection d'un passage, puis remarque.
        let addBox = null
        let withEditor = null
        const annotate = async (comment, { byMouse = false } = {}) => {
          await ui.ev(`(() => {
            const body = ${ui.$('plan-body')}
            const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT)
            let node
            while ((node = walker.nextNode()) && !node.nodeValue.includes('script Node maison')) {}
            const range = document.createRange()
            const at = node.nodeValue.indexOf('script Node maison')
            range.setStart(node, at)
            range.setEnd(node, at + 'script Node maison'.length)
            const selection = window.getSelection()
            selection.removeAllRanges()
            selection.addRange(range)
            body.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
            return true
          })()`)
          await ui.waitFor(`!!${ui.$('plan-comment')}`)
          await ui.click(ui.$('plan-comment'))
          await ui.waitFor(`document.activeElement === ${ui.$('plan-note-input')}`)
          await ui.type(comment)
          if (byMouse) {
            // « Ajouter la remarque » à la souris : ce qu'il y a ensuite sous le pointeur compte.
            // Le bouton d'abord amené dans la vue (comme on le ferait), la barre mesurée ensuite.
            addBox = await ui.center(ui.$('plan-note-add'))
            withEditor = await buttons()
            await ui.click(ui.$('plan-note-add'))
          } else await ui.enter()
          await ui.waitFor(
            `[...(${ui.$('plan-notes')}?.querySelectorAll('textarea') ?? [])].some((t) => t.value === ${JSON.stringify(comment)})`
          )
        }
        // Fenêtre haute : le fil a de la place sous la carte (comme au rejeu du 2026-10-23) ; une
        // carte qui rétrécit y fait remonter la barre, alors qu'en bas du fil elle ne bouge pas.
        await ui.viewport(await ui.ev('window.innerWidth'), 1100)
        await annotate('Utilise Vitest.', { byMouse: true })
        // Le texte d'aide raccourcit (« 1 remarque ») : les boutons ne bougent pas (fiche 124, D10).
        // Le formulaire se replie : sa zone garde sa hauteur, la barre ne remonte pas (fiche 127, D27).
        const oneNote = await buttons()
        const underAdd = await ui.ev(
          `document.elementFromPoint(${addBox.x}, ${addBox.y})?.closest('button')?.dataset.testid ?? null`
        )
        check(
          (await hint()) === L('planDocument.notes', { count: 1 }) &&
            sameColumns(noHint, oneNote) &&
            (await underOldSend(noHint, oneNote)) === 'plan-send-notes',
          `remarque ajoutée : boutons à la même place, l’ancien « Envoyer » reste « Envoyer » (${JSON.stringify(noHint.execute)} → ${JSON.stringify(oneNote.execute)})`
        )
        check(
          oneNote.send.y === withEditor.send.y &&
            oneNote.execute.y === withEditor.execute.y &&
            underAdd !== 'plan-execute' &&
            underAdd !== 'plan-send-notes',
          `première remarque : la barre ne remonte pas, rien d’autre sous le pointeur laissé sur « Ajouter » (y ${withEditor.execute.y} → ${oneNote.execute.y}, sous le pointeur : ${underAdd})`
        )
        await ui.shot('97a-plan-premiere-remarque')
        await ui.viewport()
        // Fenêtre étroite (texte d'aide sur deux lignes) : pareil, remarque retirée puis remise.
        await ui.viewport(760)
        const narrowNote = await buttons()
        await ui.ev(`${ui.$('plan-notes')}.querySelector('li button').click(), true`)
        await ui.waitFor(`!${ui.$('plan-notes')}`)
        const narrowHint = await buttons()
        await ui.shot('97-plan-barre-etroite')
        check(
          (await hint()) === L('planDocument.selectHint') &&
            sameColumns(narrowHint, narrowNote) &&
            (await underOldSend(narrowHint, narrowNote)) === 'plan-send-notes',
          'fenêtre étroite : boutons à la même place avec ou sans remarque'
        )
        await annotate('Utilise Vitest.')
        await ui.viewport()
        check(
          (await ui.ev(`CSS.highlights.get('plan-notes')?.size`)) === 1,
          'passage commenté : remarque listée, passage surligné'
        )
        await ui.shot('98-plan-annote')

        // Plan plus long que la fenêtre (comme celui de GPT) : sa fin reste visible au-dessus des
        // remarques, sans défilement caché dans la carte (fiche 095). Le rechargement qui suit
        // efface ces lignes ajoutées.
        const layout = await ui.ev(`(() => {
          const body = ${ui.$('plan-body')}
          const markdown = body.querySelector('.markdown')
          for (let i = 1; i <= 20; i++) {
            const p = document.createElement('p')
            p.textContent = 'Étape détaillée ' + i + ' du plan.'
            markdown.append(p)
          }
          const last = document.createElement('h2')
          last.textContent = '4. Vérifier'
          markdown.append(last)
          return {
            hidden: body.scrollHeight - body.clientHeight,
            gap: ${ui.$('plan-notes')}.getBoundingClientRect().top - last.getBoundingClientRect().bottom
          }
        })()`)
        check(
          layout.hidden <= 1 && layout.gap >= 0,
          'plan long : rien de caché dans la carte, la fin du plan reste au-dessus des remarques'
        )
        await ui.ev(`${ui.$('plan-notes')}.scrollIntoView({ block: 'center' })`)
        await ui.shot('98b-plan-long-annote')

        // Remarques en cours retrouvées après un rechargement de l'interface (fiche 043).
        await ui.ev(`setTimeout(() => location.reload(), 0); true`)
        await ui.ready()
        await ui.waitFor(
          `[...(${ui.$('plan-notes')}?.querySelectorAll('textarea') ?? [])].some((t) => t.value === 'Utilise Vitest.')`
        )
        check(true, 'remarques en cours gardées après rechargement (stockage local)')

        await ui.click(ui.$('plan-send-notes'))
        await ui.waitFor(
          `[...document.querySelectorAll('.msg-user')].at(-1)?.innerText.includes('Remarques sur le plan (plan.md)')`
        )
        await ui.ready()
        await ui.waitFor(
          `[...document.querySelectorAll('[data-testid=plan-document]')].at(-1)?.dataset.version === '2'`
        )
        const sent = await ui.ev(`[...document.querySelectorAll('.msg-user')].at(-1).innerText`)
        check(
          sent.includes('« script Node maison »') && sent.includes('Remarque : Utilise Vitest.'),
          'remarques envoyées : passage cité et remarque'
        )
        await ui.click(`[...document.querySelectorAll('[data-testid=plan-diff-toggle]')].at(-1)`)
        await ui.waitFor(`!!${ui.$('plan-diff')}`)
        const diff = await ui.ev(`${ui.$('plan-diff')}.innerText`)
        check(
          diff.includes('Vitest') && diff.includes('script Node maison'),
          'version 2 : « Voir ce qui a changé » montre le diff entre les versions'
        )
        await ui.shot('99-plan-version-2')

        await ui.click(`[...document.querySelectorAll('[data-testid=plan-execute]')].at(-1)`)
        await ui.waitFor(
          `[...document.querySelectorAll('.msg-user')].at(-1)?.innerText === 'Exécute le plan de plan.md.'`
        )
        await ui.ready()
        check(
          (await ui.lastAgentText()).includes('Plan exécuté') &&
            (await ui.ev(
              `window.api.conversations.get().then((s) => window.api.conversations.view(s.activeId)).then((v) => v.snapshot.controls.find((c) => c.category === 'mode').currentValue)`
            )) === 'code',
          'exécuter : retour au mode d’exécution, puis demande d’exécution'
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
