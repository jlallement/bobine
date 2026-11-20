import { L, Lpart, check, literal, withApp } from '../lib.mjs'

/**
 * Activité lisible pendant un tour (fiche 128) : un outil annoncé sans rien d'autre (OpenCode : le
 * « patch » pendant que le modèle l'écrit) est dit « Prépare… » sur sa carte et dans l'indicateur,
 * jamais « patch » ; interrompu, il garde le nom de son genre ; le temps de l'indicateur est celui
 * du tour, l'étape en plus petit (fiche 267) ; une sortie de commande en JSON est indentée.
 */
export async function activitySuite(scheme) {
  console.log(`\n— Activité lisible (${scheme})`)
  await withApp(scheme, async (ui) => {
    await ui.ready()
    const lastTool = `[...document.querySelectorAll('[data-testid=tool]')].at(-1)`
    // `textContent` : le libellé d'un fichier est en morceaux (fiche 203), son `innerText` passe
    // à la ligne entre eux.
    const toolTitle = `${lastTool}.querySelector('.tool-title').textContent.trim()`

    // 1. Patch annoncé sans cible : « Prépare une modification… », pas « patch ».
    await ui.send('/scenario outil-en-preparation')
    await ui.waitFor(`${lastTool}?.dataset.status === 'pending'`)
    check(
      (await ui.ev(toolTitle)) === L('toolCall.label.preparing.edit'),
      'patch annoncé sans cible : la carte dit « Prépare une modification… »'
    )
    check(
      (await ui.ev(`${lastTool}.querySelector('[data-testid=tool-label]').title`)) === 'patch',
      'le titre brut de l’agent passe en infobulle'
    )
    await ui.waitFor(`${ui.$('working')}?.dataset.activity === 'tool'`)
    const working = () => ui.ev(`${ui.$('working')}.innerText.replace(/\\s+/g, ' ').trim()`)
    const label = await working()
    check(
      label.startsWith(L('toolCall.label.preparing.edit')) && !label.includes('patch'),
      'l’indicateur dit la même chose, jamais « patch »'
    )
    check(
      !(await ui.ev(`document.querySelector('[data-testid=thread]').innerText.includes('patch')`)),
      'nulle part dans le fil, le mot « patch » n’apparaît pendant l’attente'
    )
    // Une seule ligne d'état : la durée du tour à droite (fiche 267, D14), dite aussi en infobulle ;
    // l'étape en cours en plus petit quand ce n'est pas le tour entier.
    await ui.waitFor(`/^\\d+ s$/.test(${ui.$('working')}.querySelector('.working-time').innerText)`)
    check(
      (await ui.ev(`${ui.$('working')}.querySelector('.working-time').title`)).includes(
        Lpart('activity.turnStarted')
      ),
      'la durée du tour est dite en infobulle'
    )
    check(
      (await ui.ev(`document.querySelectorAll('[data-testid=tool] .working-time').length`)) === 0,
      'aucun chronomètre par carte'
    )
    await ui.shot('128-activite-preparation')
    // Les emplacements arrivent : le libellé de la cible remplace celui du genre.
    await ui.waitFor(`${lastTool}?.dataset.status === 'in_progress'`)
    check(
      (await ui.ev(toolTitle)) === L('toolCall.label.edit', { target: 'notes.md' }),
      'les emplacements arrivés, la carte dit « Modification de notes.md »'
    )
    await ui.ready()
    check((await ui.ev(`${lastTool}.dataset.status`)) === 'completed', 'le patch se termine')

    // 2. Interrompu avant d'avoir une cible : le nom de son genre, « Modification · interrompu ».
    await ui.send('/scenario outil-en-preparation-interrompu')
    await ui.waitFor(`${lastTool}?.dataset.status === 'pending'`)
    await ui.press('Escape')
    await ui.ready()
    await ui.waitFor(`${lastTool}?.dataset.status === 'cancelled'`)
    const row = await ui.ev(
      `${lastTool}.querySelector('.tool-row').innerText.replace(/\\s+/g, ' ')`
    )
    check(
      new RegExp(
        `^${literal(L('toolCall.label.kindName.edit'))} ${literal(L('toolCall.state.cancelled'))}`
      ).test(row.trim()),
      `outil interrompu sans cible : « Modification · interrompu » (« ${row.trim()} »)`
    )
    await ui.shot('128-activite-interrompu')

    // 3. `shell` qui n'a que { cwd } : « Prépare une commande… », puis la commande, sortie JSON indentée.
    await ui.send('/scenario shell-en-preparation')
    await ui.waitFor(`${lastTool}?.dataset.status === 'pending'`)
    check(
      (await ui.ev(toolTitle)) === L('toolCall.label.preparing.execute'),
      'shell sans commande : « Prépare une commande… »'
    )
    await ui.ready()
    check((await ui.ev(toolTitle)) === 'node results.js', 'la commande arrivée, la carte la montre')
    await ui.ev(`${lastTool}.querySelector('details').open = true`)
    await ui.waitFor(`!!${lastTool}.querySelector('[data-testid=tool-json]')`)
    const json = await ui.ev(`${lastTool}.querySelector('[data-testid=tool-json]').innerText`)
    check(
      json.includes('"status": "fulfilled"') && json.includes('"value": "ligne 1\nligne 2"'),
      'sortie JSON indentée, avec de vrais retours à la ligne dans les chaînes'
    )
    await ui.shot('128-sortie-json')

    // 4. Fiche 267 (D14) : la durée du tour, l'étape en cours en plus petit ; à 720 px aussi.
    await ui.send('/scenario etapes-longues')
    await ui.waitFor(`!!${ui.$('working-step')}`, 15000)
    // Une seconde d'étape au moins : la durée du tour la dépasse (deux chiffres distincts).
    await ui.waitFor(`/[1-9]/.test(${ui.$('working-step')}.innerText)`, 15000)
    const parts = await ui.ev(`(() => {
      const w = ${ui.$('working')}
      const time = w.querySelector('.working-time')
      const step = w.querySelector('[data-testid=working-step]')
      return {
        time: time.innerText,
        step: step.innerText,
        smaller: parseFloat(getComputedStyle(step).fontSize) < parseFloat(getComputedStyle(time).fontSize)
      }
    })()`)
    check(
      /^\d+ s$/.test(parts.time) && parts.step.startsWith(Lpart('activity.step')) && parts.smaller,
      `indicateur : la durée du tour, puis l’étape en plus petit (${JSON.stringify(parts)})`
    )
    await ui.shot('267-indicateur-etape')
    await ui.viewport(720, 760)
    const height = await ui.ev(`Math.round(${ui.$('working')}.getBoundingClientRect().height)`)
    check(height > 0 && height <= 40, `indicateur à 720 px : sur une ligne (${height} px de haut)`)
    await ui.shot('267-indicateur-720')
    await ui.viewport()
    await ui.ready()
  })
}
