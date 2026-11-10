import { L, MAIN_PORT, check, mainProcess, withApp, M } from '../lib.mjs'
import { conversationTooltip } from '../sidebar-tooltip.mjs'

/** Historique : recherche dans le contenu, épinglage, regroupement par dossier, brouillons (fiche 026). */
export async function historySuite(scheme) {
  console.log(`\n— Historique (${scheme})`)
  await withApp(
    scheme,
    async (ui) => {
      await ui.ready()
      const items = `[...document.querySelectorAll('[data-testid=history-item]')]`
      const itemNamed = (title) =>
        `${items}.find((i) => i.querySelector('.label')?.innerText === ${JSON.stringify(title)})`
      await ui.send('Plan de migration')
      await ui.ready()
      await ui.send('Le cache Redis sature aux heures de pointe')
      await ui.ready()
      await ui.click(ui.$('new-conversation'))
      await ui.waitFor(`!document.querySelector('.history-item.active')`)
      await ui.ready()
      await ui.send('Écran de connexion')
      await ui.ready()

      // Fiche 149 : la bulle de l'app reste seule, même après un survol prolongé ; au clavier aussi.
      const ordinary = `${itemNamed('Plan de migration')}.querySelector('.history-open')`
      const hoverTip = await conversationTooltip(ui, ordinary, {
        hover: true,
        capture: '149-infobulle-unique-survol'
      })
      const focusTip = await conversationTooltip(ui, ordinary, {
        capture: '149-infobulle-unique-clavier'
      })
      check(
        hoverTip.startsWith('Plan de migration\n') && hoverTip === focusTip,
        'titre complet et détails identiques au survol et au clavier, une seule infobulle'
      )

      // Recherche : le mot n'est que dans le deuxième message de la première conversation.
      await ui.click(ui.$('open-search'))
      await ui.waitFor(`document.activeElement === ${ui.$('search-input')}`)
      await ui.type('redis SATURE')
      await ui.waitFor(`!!${ui.$('search-snippet')}`)
      const results = await ui.ev(
        `[...document.querySelectorAll('[data-testid=search-result]')].map((r) => r.innerText)`
      )
      const marks = await ui.ev(
        `[...document.querySelectorAll('[data-testid=search-snippet] mark')].map((m) => m.innerText)`
      )
      check(
        results.length === 1 &&
          results[0].startsWith('Plan de migration') &&
          JSON.stringify(marks) === JSON.stringify(['Redis', 'sature']),
        'recherche dans le contenu : bonne conversation, extrait, mots surlignés'
      )
      await ui.shot('90-recherche-contenu')
      await ui.enter()
      await ui.waitFor(
        `document.querySelector('.history-item.active .label')?.innerText === 'Plan de migration'`
      )

      // ⌘K relié à ⌘F (fiche 086) : la conversation trouvée par son contenu s'ouvre avec la
      // recherche, sur le premier résultat.
      const firstOf = `/^1 \\/ \\d+$/.test(${ui.$('find-count')}?.innerText ?? '')`
      await ui.waitFor(`${ui.$('find-input')}?.value === 'redis SATURE'`)
      await ui.waitFor(firstOf)
      check(
        await ui.ev(
          `CSS.highlights.get('thread-find-current')?.size === 1 && document.activeElement === ${ui.$('find-input')}`
        ),
        '⌘K → ⌘F : recherche reprise dans la conversation, premier résultat surligné'
      )
      await ui.shot('93-recherche-fil')
      // Sans casse ni accents des deux côtés : « PÔINTE » trouve « pointe ».
      await ui.ev(`${ui.$('find-input')}.select()`)
      await ui.type('PÔINTE')
      await ui.waitFor(firstOf)
      check(true, 'sans casse ni accents : « PÔINTE » trouve « pointe »')
      await ui.press('Escape')
      await ui.waitFor(`!${ui.$('find-bar')}`)
      check(
        await ui.ev(
          `!CSS.highlights.has('thread-find') && !CSS.highlights.has('thread-find-current')`
        ),
        'Échap : barre fermée, surlignage retiré'
      )
      // ⌘F (menu Édition) : la barre revient avec la dernière recherche, prête à être remplacée.
      const main = await mainProcess()
      try {
        await main.evaluate(
          `require('electron').Menu.getApplicationMenu().getMenuItemById('find').click()`
        )
      } finally {
        main.close()
      }
      await ui.waitFor(
        `${ui.$('find-input')}?.value === 'PÔINTE' && document.activeElement === ${ui.$('find-input')}`
      )
      await ui.waitFor(firstOf)
      check(true, 'Édition › Rechercher… (⌘F) : barre rouverte sur la dernière recherche')
      // Plusieurs résultats : Entrée suivant, ⇧Entrée précédent.
      await ui.type('point')
      await ui.waitFor(`/^1 \\/ ([2-9]|\\d\\d)$/.test(${ui.$('find-count')}?.innerText ?? '')`)
      await ui.press('Enter')
      await ui.waitFor(`${ui.$('find-count')}?.innerText.startsWith('2 /')`)
      await ui.press('Enter', 8)
      await ui.waitFor(`${ui.$('find-count')}?.innerText.startsWith('1 /')`)
      check(true, 'plusieurs résultats : Entrée suivant, ⇧Entrée précédent')
      await ui.press('Escape')
      await ui.waitFor(`!${ui.$('find-bar')}`)

      // Brouillon : texte non envoyé, retrouvé en revenant.
      await ui.ev(`${ui.$('composer-input')}.focus()`)
      await ui.type('brouillon à finir')
      // Fiche 155 : un long texte collé devient une pièce jointe, gardée avec le brouillon.
      await ui.ev(`(() => {
        const data = new DataTransfer()
        data.setData('text/plain', Array.from({ length: 45 }, (_, i) => 'ligne ' + i).join('\\n'))
        const input = document.querySelector('[data-testid=composer-input]')
        input.focus()
        input.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }))
        return true
      })()`)
      await ui.waitFor(`!!${ui.$('attachment-pasted')}`)
      await ui.click(`${itemNamed('Écran de connexion')}.querySelector('.history-open')`)
      await ui.waitFor(
        `document.querySelector('.history-item.active .label')?.innerText === 'Écran de connexion'`
      )
      check(
        (await ui.ev(`${ui.$('composer-input')}.value`)) === '',
        'autre conversation : zone de saisie vide'
      )
      await ui.click(`${itemNamed('Plan de migration')}.querySelector('.history-open')`)
      await ui.waitFor(`${ui.$('composer-input')}?.value === 'brouillon à finir'`)
      check(true, 'brouillon retrouvé en revenant sur la conversation')
      check(
        (await ui.ev(`${ui.$('attachment-pasted')}?.innerText.trim()`)) ===
          L('composer.attachment.pastedLines', { name: L('attachments.pastedText'), count: 45 }),
        'brouillon : la pièce jointe (texte collé) revient avec le texte (fiche 155)'
      )

      // Titres au bord (fiche 131) : plus de colonne d'icône vide ; le menu « … » au survol
      // par-dessus la droite de la ligne ; survol et sélection de deux couleurs.
      const row = itemNamed('Écran de connexion')
      await ui.hover(await ui.center(`${row}.querySelector('.label')`))
      await ui.waitFor(
        `getComputedStyle(${row}.querySelector('[data-testid=history-more]')).opacity === '1'`
      )
      const layout = await ui.ev(`(() => {
        const rows = ${items}
        const r = ${row}.getBoundingClientRect()
        const more = ${row}.querySelector('[data-testid=history-more]').getBoundingClientRect()
        const active = document.querySelector('.history-item.active')
        return {
          edge: rows.every((i) => i.querySelector('.history-open').firstElementChild.className === 'row-main'),
          inside: more.right <= r.right && more.top >= r.top && more.bottom <= r.bottom,
          hover: getComputedStyle(${row}).backgroundColor,
          active: active && active !== ${row} ? getComputedStyle(active).backgroundColor : null
        }
      })()`)
      check(
        layout.edge &&
          layout.inside &&
          layout.active !== null &&
          layout.hover !== layout.active &&
          layout.hover !== 'rgba(0, 0, 0, 0)',
        `titres au bord, « … » au survol dans la ligne, survol ≠ sélection (${JSON.stringify(layout)})`
      )

      // Épingler.
      await ui.click(
        `${itemNamed('Écran de connexion')}.querySelector('[data-testid=history-more]')`
      )
      await ui.waitFor(`!!${ui.$('history-pin')}`)
      await ui.click(ui.$('history-pin'))
      await ui.waitFor(`${ui.$('history-pinned')}?.innerText.includes('Écran de connexion')`)
      check(true, 'conversation épinglée, en tête de la barre latérale')

      // Mode « Dossiers » (fiche 131) : le projet, sans icône ni compteur, chevron après le nom.
      await ui.click(ui.$('history-grouping'))
      await ui.waitFor(`!!${ui.$('grouping-folder')}`)
      await ui.click(ui.$('grouping-folder'))
      await ui.waitFor(`document.querySelectorAll('[data-testid=folder-group]').length === 1`)
      const head = ui.$('folder-head')
      check(
        (await ui.ev(`${head}.textContent`)).includes('workspace') &&
          (await ui.ev(`${ui.$('section-toggle-history')}.textContent`)) ===
            L('sidebar.byFolder') &&
          (await ui.ev(`${head}.lastElementChild.tagName`)) === 'svg' &&
          (await ui.ev(`${head}.children.length`)) === 2,
        'regroupement par projet : nom, puis chevron ; ni icône ni compteur'
      )
      await ui.shot('91-historique')
      // Un dossier se replie : seul son nom reste.
      await ui.click(head)
      await ui.waitFor(
        `${head}.getAttribute('aria-expanded') === 'false' && !document.querySelector('[data-testid=folder-group] [data-testid=history-item]')`
      )
      await ui.click(head)
      await ui.waitFor(
        `!!document.querySelector('[data-testid=folder-group] [data-testid=history-item]')`
      )
      check(true, 'un dossier se replie et se déplie au clic sur son nom')

      // Suppression : fenêtre intégrée, option « chez l'agent ».
      await ui.click(
        `${itemNamed('Plan de migration')}.querySelector('[data-testid=history-more]')`
      )
      await ui.waitFor(`!!${ui.$('history-delete')}`)
      await ui.click(ui.$('history-delete'))
      await ui.waitFor(`!!${ui.$('delete-dialog')}`)
      check(
        (await ui.ev(`${ui.$('delete-from-agent')}?.checked`)) === false &&
          (await ui.ev(`${ui.$('delete-dialog')}.innerText`)).includes(M('Agent factice')),
        'confirmation : corbeille ; « aussi chez l’agent » proposé, jamais coché d’office (fiche 196)'
      )
      await ui.shot('92-suppression')
      await ui.click(ui.$('delete-confirm'))
      await ui.waitFor(`!${itemNamed('Plan de migration')}`)
      check(true, 'conversation supprimée')
    },
    undefined,
    'streaming-texte',
    {},
    // Process principal joignable : commande du menu Édition (fiche 086).
    [`--inspect=${MAIN_PORT}`]
  )
}
