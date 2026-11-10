import { L, check, withApp, M } from '../lib.mjs'

/**
 * Liste de tâches épinglée au-dessus de la zone de saisie pendant le tour (fiche 077). Le scénario
 * `demo` s'arrête sur sa permission avec un plan à 1 / 3 : le tour dure tant qu'on n'a pas répondu.
 */
export async function pinnedPlanSuite(scheme) {
  console.log(`\n— Liste de tâches épinglée (${scheme})`)
  await withApp(scheme, async (ui) => {
    await ui.ready()
    // Un premier échange, pour que le fil ait de quoi défiler.
    await ui.send('/scenario streaming-texte')
    await ui.ready()
    // Panneau « Session » ouvert de lui-même (fiche 166) : fermé, l'en-tête montre son compteur.
    await ui.closePanel()
    await ui.send('Modifie la configuration')
    await ui.waitFor(
      `!!${ui.$('permission')} && ${ui.$('pinned-plan')}?.querySelectorAll('li.completed').length === 1`
    )
    const pinned = await ui.ev(`(() => {
      const pinned = ${ui.$('pinned-plan')}
      const composer = document.querySelector('.thread-dock .composer')
      const step = pinned.querySelector('li[aria-current=step]')
      return {
        aboveComposer:
          !!pinned.closest('.thread-dock') &&
          Math.abs(pinned.getBoundingClientRect().bottom + 8 - composer.getBoundingClientRect().top) < 2,
        head: ${ui.$('pinned-plan-toggle')}.innerText,
        step: step?.innerText,
        spinning: !!step?.querySelector('svg.spin'),
        struck: getComputedStyle(pinned.querySelector('li.completed')).textDecorationLine,
        threadCard: !!document.querySelector('.scroll .plan'),
        counter: ${ui.$('panel-toggle')}.innerText.trim()
      }
    })()`)
    check(pinned.aboveComposer, 'liste épinglée juste au-dessus de la zone de saisie')
    check(
      pinned.head.includes(L('pinnedPlan.title')) && pinned.head.includes('1 / 3'),
      `en-tête de la liste : « ${L('pinnedPlan.title')} 1 / 3 »`
    )
    check(
      pinned.step === M('Modifier la configuration') && pinned.spinning,
      'tâche en cours marquée, son cercle tourne'
    )
    check(pinned.struck === 'none', 'tâches faites grisées, pas barrées')
    check(
      !pinned.threadCard && pinned.counter === '',
      'pendant le tour : ni carte « Plan » dans le fil, ni compteur dans l’en-tête'
    )
    await ui.shot('100-taches-epinglees')

    // Fil remonté : la liste ne bouge pas, la flèche « Aller en bas » passe au-dessus.
    const top = () => ui.ev(`${ui.$('pinned-plan')}.getBoundingClientRect().top`)
    const before = await top()
    await ui.ev(`document.querySelector('.scroll').scrollTop = 0`)
    await ui.waitFor(`!!${ui.$('scroll-to-bottom')}`)
    check(
      (await top()) === before &&
        (await ui.ev(
          `${ui.$('scroll-to-bottom')}.getBoundingClientRect().bottom <= ${ui.$('pinned-plan')}.getBoundingClientRect().top`
        )),
      'fil remonté : la liste reste en place, la flèche « Aller en bas » au-dessus'
    )
    await ui.click(ui.$('scroll-to-bottom'))
    await ui.waitFor(`!${ui.$('scroll-to-bottom')}`)

    // Repliée sur une ligne : la tâche en cours et la progression.
    await ui.click(ui.$('pinned-plan-toggle'))
    await ui.waitFor(`${ui.$('pinned-plan-toggle')}.getAttribute('aria-expanded') === 'false'`)
    check(
      (await ui.ev(`${ui.$('pinned-plan-current')}?.innerText`)) ===
        M('Modifier la configuration') &&
        (await ui.ev(`${ui.$('pinned-plan-toggle')}.innerText`)).includes('1 / 3') &&
        (await ui.ev(`${ui.$('pinned-plan')}.querySelector('.pinned-plan-body').hidden`)),
      'repliée d’un clic : une ligne, tâche en cours et « 1 / 3 »'
    )
    await ui.shot('101-taches-repliees')
    await ui.click(ui.$('pinned-plan-toggle'))
    await ui.waitFor(`${ui.$('pinned-plan-toggle')}.getAttribute('aria-expanded') === 'true'`)

    // À côté (fiche 036) : la conversation qui travaille garde sa liste épinglée.
    const itemNamed = (title) =>
      `[...document.querySelectorAll('[data-testid=history-item]')].find((i) => i.querySelector('.label')?.innerText.startsWith(${JSON.stringify(title)}))`
    await ui.click(ui.$('new-conversation'))
    await ui.waitFor(`!document.querySelector('.history-item.active')`)
    await ui.click(
      `${itemNamed('/scenario streaming-texte')}.querySelector('[data-testid=history-more]')`
    )
    await ui.waitFor(`!!${ui.$('history-open-beside')}`)
    await ui.click(ui.$('history-open-beside'))
    await ui.waitFor(`!!${ui.$('beside')}?.querySelector('[data-testid=pinned-plan]')`)
    check(
      !(await ui.ev(`!!${ui.$('beside')}.querySelector('.scroll .plan')`)),
      'conversation à côté : liste épinglée, pas de carte « Plan » dans son fil'
    )
    await ui.click(ui.$('beside-close'))
    await ui.waitFor(`!${ui.$('beside')}`)
    await ui.click(itemNamed('/scenario streaming-texte'))
    await ui.waitFor(`!!${ui.$('permission')} && !!${ui.$('pinned-plan')}`)

    // Fin du tour : plus de liste épinglée ; la carte du fil et le compteur reviennent.
    await ui.ev(`${ui.$('permission')}.querySelector('[data-kind=allow_once]').click()`)
    await ui.ready()
    await ui.waitFor(`!${ui.$('pinned-plan')}`)
    check(
      (await ui.ev(`document.querySelectorAll('.scroll .plan li.completed').length`)) === 3 &&
        (await ui.ev(`${ui.$('panel-toggle')}.innerText.trim()`)) === '3 / 3',
      'fin du tour : liste épinglée retirée, carte « Plan » dans le fil et compteur revenus'
    )
    await ui.shot('102-taches-fin-du-tour')
  })
}
