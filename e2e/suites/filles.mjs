import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { L, MAIN_PORT, check, mainProcess, sleep, withApp } from '../lib.mjs'
/** Coût en dollars annoncé par l'agent : affiché en estimation (« ≈ », fiche 245). */
/** Début de l'erreur du main pour une conversation qu'il n'a plus (« Conversation inconnue : »). */
const UNKNOWN_CONVERSATION = L('conversations.error.unknown', { id: '' }).trim()

/**
 * Conversations filles lancées par l'utilisateur (fiche 097, étape 1) : « Lancer en parallèle… »,
 * la fille sous sa mère, sa carte seule à la place de son lancement (fiche 264 : sa réponse, sa
 * branche, son coût), son envoi avec le prochain message, la mère supprimée. Dans un dépôt git jetable : une fille travaille dans un worktree.
 */
export async function fillesSuite(scheme) {
  console.log(`\n— Conversations filles (${scheme})`)
  const { workspace } = repository()
  try {
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        const row = (id) => `document.querySelector('[data-testid=history-item][data-id="${id}"]')`
        const rows = `[...document.querySelectorAll('[data-testid=history-item]')]`
        const activeId = () => ui.ev(`document.querySelector('.history-item.active')?.dataset.id`)
        const launch = async (trigger, item, prompt) => {
          await ui.click(trigger)
          const enabled = `${ui.$(item)} && !${ui.$(item)}.hasAttribute('data-disabled')`
          await ui.waitFor(`!!(${enabled})`)
          await ui.click(ui.$(item))
          await ui.waitFor(`!!${ui.$('child-dialog')}`)
          await ui.ev(`${ui.$('child-prompt')}.focus()`)
          await ui.type(prompt)
          // « Lancer » armé une fois le dossier de la mère lu (fiches 240, 262) : un clic plus tôt
          // est ignoré.
          await ui.waitFor(`!${ui.$('child-launch')}.disabled`, 30000)
        }

        await ui.send('Organise le carnet')
        await ui.ready()
        const mother = await activeId()
        // Onglet Modifications du panneau (fiche 161), rouvert par « + » s'il a été fermé.
        const changesTab = `document.querySelector('.side-panel-tab[data-tab=changes]')`
        const openChanges = async () => {
          if (!(await ui.ev(`!!${ui.$('side-panel')}`))) await ui.click(ui.$('panel-toggle'))
          await ui.waitFor(`!!${ui.$('side-panel')}`)
          if (await ui.ev(`!!${changesTab}`)) await ui.click(changesTab)
          else {
            await ui.click(ui.$('panel-more'))
            await ui.waitFor(`!!${ui.$('panel-more-menu')}`)
            await ui.click(`${ui.$('panel-more-menu')}.querySelector('[data-tab=changes]')`)
          }
          await ui.waitFor(`!!${ui.$('changes-tab')}`)
        }
        const closePanel = async () => {
          await ui.click(
            `${ui.$('side-panel')}.querySelector('[aria-label="${L('sidePanel.close')}"]')`
          )
          await ui.waitFor(`!${ui.$('side-panel')}`)
        }
        await openChanges()
        await closePanel()

        // « Lancer en parallèle… » depuis le menu du titre : agent et modèle de la mère.
        await launch(ui.$('title-menu'), 'title-launch-child', '/scenario modifications')
        await ui.shot('filles-1-lancer')
        await ui.click(ui.$('child-launch'))
        await ui.waitFor(`!${ui.$('child-dialog')}`, 30000)
        await ui.waitFor(`${rows}.some((r) => r.classList.contains('nested'))`)
        const first = await ui.ev(`${rows}.find((r) => r.classList.contains('nested'))?.dataset.id`)

        // Fin du tour de la fille : sa carte seule, à la place de son lancement (fiche 264), avec
        // sa réponse, sa branche et ses fichiers ; ni « Sous-tâches » ni compte rendu séparé.
        const soloCard = `document.querySelector('[data-testid=work-card]')`
        await ui.waitFor(`${soloCard}?.dataset.state === 'replied'`, 30000)
        const branch = await ui.ev(
          `${soloCard}.querySelector('[data-testid=work-changes] .work-changes-branch')?.innerText`
        )
        // La branche lue (plan de fusion) : ce qu'elle apporte, ici ses modifications non commitées.
        await ui.waitFor(
          `${soloCard}.innerText.includes(${JSON.stringify(L('workCard.dirty', { count: 2 }))})`,
          20000
        )
        // Finie, compte rendu vu : la mère est affichée quand il y arrive, il est lu (fiche 258,
        // D35). Sous sa mère, état et origine dans l'infobulle (fiche 149). La fille à lire (mère
        // pas affichée) : suite `inbox`.
        await ui.waitFor(
          `${row(first)}?.classList.contains('nested') && ${row(first)}.querySelector('.child-state')?.dataset.state === 'done'`
        )

        // Une deuxième fille, depuis le menu de la liste : elle attend un accord.
        await launch(
          `${row(mother)}.querySelector('[data-testid=history-more]')`,
          'history-launch-child',
          '/scenario permission'
        )
        await ui.click(ui.$('child-launch'))
        await ui.waitFor(`!${ui.$('child-dialog')}`, 30000)
        await ui.waitFor(
          `!!document.querySelector('[data-testid=work-card][data-state=waiting]')`,
          30000
        )
        await ui.shot('filles-2-sous-taches')

        // Vue « Filles » des Modifications (fiche 161) : ses deux filles, comme la carte.
        await openChanges()
        await ui.waitFor(`!!${ui.$('changes-view-children')}`)
        await ui.click(ui.$('changes-view-children'))
        await ui.waitFor(`!!${ui.$('children-view')}`)
        await ui.shot('filles-161-vue-filles')
        // « Faire relire » d'une ligne (fiche 265) : le même dialogue, celui du Code reviewer, sur
        // la branche de ce travail ; rien ne part sans « Lancer la relecture ».
        const review = `document.querySelector('[data-testid=child-worktree-review]')`
        if (await ui.ev(`!!${review}`)) {
          await ui.click(review)
          await ui.waitFor(`!!${ui.$('review-dialog')}`)
          check(
            (await ui.ev(`${ui.$('review-dialog')}.innerText`)).includes(
              L('review.dialog.description')
            ) &&
              (await ui.ev(`${ui.$('review-scope')}.innerText`)) ===
                L('review.dialog.scopeBranch', { branch }),
            'vue « Filles » : « Faire relire » ouvre la relecture du Code reviewer, sur sa branche'
          )
          await ui.press('Escape')
          await ui.waitFor(`!${ui.$('review-dialog')}`)
        } else check(false, 'vue « Filles » : « Faire relire » sur la ligne d’un travail fini')
        await closePanel()

        // Le compte rendu part à l'agent de la mère avec le prochain message, une seule fois.
        await ui.send('/scenario echo')
        await ui.ready()
        await ui.send('/scenario echo')
        await ui.ready()

        // « Ouvrir » : la fille qui attend son accord ; « ↳ depuis » ramène à la mère (vérifiés dans
        // `parcours-deleguer`).
        await ui.click(
          `document.querySelector('[data-testid=work-card][data-state=waiting] [data-testid=work-open]')`
        )
        await ui.waitFor(`!!document.querySelector('[data-testid=permission]')`, 30000)
        await ui.shot('filles-3-fille-ouverte')
        await ui.click(
          `document.querySelector('[data-testid=permission] button[data-kind=allow_once]')`
        )
        await ui.ready()
        await ui.click(ui.$('title-origin'))
        await ui.waitFor(
          `document.querySelector('.history-item.active')?.dataset.id === '${mother}'`
        )

        // Dossier = projet (fiche 131) : les deux filles, chacune dans son worktree, restent sous
        // leur mère, dans le dossier du dépôt ; aucun dossier ne porte le nom d'un worktree.
        const away = async () => ui.hover(await ui.center(ui.$('composer-input')))
        const kids = await ui.ev(
          `${rows}.filter((r) => r.dataset.mother === '${mother}').map((r) => r.dataset.id)`
        )
        for (const id of kids) {
          if (!(await ui.ev(`${row(id)}?.classList.contains('unread')`))) continue
          await ui.click(`${row(id)}.querySelector('.history-open')`)
          await ui.waitFor(`document.querySelector('.history-item.active')?.dataset.id === '${id}'`)
          await ui.click(`${row(mother)}.querySelector('.history-open')`)
          await away()
          await ui.waitFor(`!${row(id)}?.classList.contains('unread')`)
        }
        await ui.click(ui.$('history-grouping'))
        await ui.waitFor(`!!${ui.$('grouping-folder')}`)
        await ui.click(ui.$('grouping-folder'))
        await away()
        await ui.waitFor(`!!document.querySelector('[data-testid=folder-group]')`)
        await ui.shot('filles-5-dossiers')
        await ui.click(ui.$('history-grouping'))
        await ui.waitFor(`!!${ui.$('grouping-recent')}`)
        await ui.click(ui.$('grouping-recent'))
        await away()

        // Fiche 228 : une troisième fille, au travail, que la confirmation signale.
        await launch(ui.$('title-menu'), 'title-launch-child', '/scenario attend-stop')
        await ui.click(ui.$('child-launch'))
        await ui.waitFor(`!${ui.$('child-dialog')}`, 30000)
        const working = `${rows}.find((r) => r.dataset.mother === '${mother}' && !${JSON.stringify(kids)}.includes(r.dataset.id))`
        await ui.waitFor(
          `${working}?.querySelector('.child-state')?.dataset.state === 'running'`,
          30000
        )
        const busy = await ui.ev(`${working}.dataset.id`)
        const openDelete = async () => {
          await ui.click(`${row(mother)}.querySelector('[data-testid=history-more]')`)
          await ui.waitFor(`!!${ui.$('history-delete')}`)
          await ui.click(ui.$('history-delete'))
          await ui.waitFor(`!!${ui.$('delete-children')}`)
          await ui.waitFor(`${ui.$('delete-children-list')}.querySelectorAll('li').length === 3`)
        }
        await openDelete()
        await ui.shot('filles-4a-confirmation')
        await ui.click(ui.$('delete-children'))
        await ui.waitFor(`!${ui.$('delete-children')}.checked`)
        await ui.shot('filles-4b-confirmation-garder')
        if (scheme === 'dark') {
          // Aurore nuit (fiche 226) : la même confirmation, cochée.
          await ui.click(ui.$('delete-children'))
          await ui.ev(
            `window.api.settings.setPreferences({ darkTheme: 'auroraNight' }).then(() => true)`
          )
          await ui.waitFor(`document.documentElement.dataset.palette === 'auroraNight'`)
          await sleep(300)
          await ui.shot('filles-4c-confirmation-aurore-nuit')
          await ui.ev(`window.api.settings.setPreferences({ darkTheme: 'dark' }).then(() => true)`)
          await ui.waitFor(`!document.documentElement.dataset.palette`)
        }
        // La fille au travail arrêtée, puis lue : la suite vérifie des conversations ordinaires.
        await ui.key('Escape')
        await ui.waitFor(`!${ui.$('delete-dialog')}`)
        await ui.ev(`window.api.agent.cancel(${JSON.stringify(busy)}).then(() => true)`)
        await ui.waitFor(
          `${row(busy)}?.querySelector('.child-state')?.dataset.state !== 'running'`,
          30000
        )
        await ui.click(`${row(busy)}.querySelector('.history-open')`)
        await ui.waitFor(`document.querySelector('.history-item.active')?.dataset.id === '${busy}'`)
        await ui.click(`${row(mother)}.querySelector('.history-open')`)
        await away()
        // Mère supprimée, case décochée : ses filles restent, en conversations ordinaires.
        await openDelete()
        await ui.click(ui.$('delete-children'))
        await ui.waitFor(`!${ui.$('delete-children')}.checked`)
        // Appels vers une conversation que le main n'a plus, quel que soit le canal (git:status,
        // commands:project, children:mergePlan, conversation:appTools… : chasses rc.4).
        const unknownReads = () =>
          ui
            .output()
            .split('\n')
            .filter((line) => line.includes(UNKNOWN_CONVERSATION))
        await ui.click(ui.$('delete-confirm'))
        await ui.waitFor(`!${row(mother)}`)
        await sleep(300)
        // Recettes rc.4 : la mère affichée supprimée, plus rien ne l'interroge (« Conversation
        // inconnue » au journal). Sortie gardée sur 64 Kio glissants : toute la séance compte,
        // filles arrêtées et supprimées avant comprises (aucune n'est attendue).
        const unknown = unknownReads()
        check(
          unknown.length === 0,
          `mère supprimée : aucune lecture d'une conversation supprimée${unknown.length ? ` (${unknown.join(' | ')})` : ''}`
        )
        await ui.shot('filles-4-mere-supprimee')
      },
      undefined,
      'streaming-texte',
      { BOBINE_WORKSPACE: workspace }
    )
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
  await fillesAgentSuite(scheme)
}

/** Un dépôt git jetable, avec ce que modifie le scénario `modifications` de l'agent factice. */
function repository() {
  const workspace = mkdtempSync(join(tmpdir(), 'bob-e2e-filles-'))
  const git = (...args) =>
    execFileSync('git', ['-c', 'user.name=e2e', '-c', 'user.email=e2e@example.invalid', ...args], {
      cwd: workspace,
      encoding: 'utf8'
    }).trim()
  writeFileSync(join(workspace, 'README.md'), '# Carnet\n\nVersion 1\n\n## Utilisation\n')
  git('init', '-q', '-b', 'main')
  git('add', '.')
  git('commit', '-q', '-m', 'init')
  return { workspace, git }
}

/**
 * Étape 2 : l'agent lance et suit ses filles par les outils de l'app (scénarios `filles`,
 * `filles-refus`, `filles-plafond`, `fille-message`). L'agent factice répond `echo` hors de ces
 * scénarios : le réveil groupé de la mère montre ce qu'elle a reçu.
 */
async function fillesAgentSuite(scheme) {
  console.log(`\n— Conversations filles lancées par l’agent (${scheme})`)
  const { workspace } = repository()
  const userData = mkdtempSync(join(tmpdir(), 'bob-e2e-filles-instructions-'))
  let receipt
  try {
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        const main = await mainProcess()
        try {
          receipt = await agentChildren(ui, main)
        } finally {
          main.close()
        }
      },
      userData,
      'echo',
      // Deux agents vivants au plus : la mère et ses filles dépassent la limite dès la deuxième
      // fille ; aucune fille en cours ne doit être arrêtée pour faire de la place (fiche 043).
      { BOBINE_WORKSPACE: workspace, BOBINE_MAX_LIVE: '2' },
      // Le menu « Réglages » est ouvert depuis le processus principal.
      [`--inspect=${MAIN_PORT}`]
    )
    if (!receipt) throw new Error('Essai des consignes interrompu avant son résultat')
    // Le texte accepté par message_child reste dans le fil sauvegardé, replié après redémarrage.
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        await ui.click(
          `document.querySelector('[data-testid=history-item][data-id="${receipt.mother}"] .history-open')`
        )
        await instructionDetails(ui, receipt, 'reprise-apres-redemarrage')
      },
      userData,
      'echo',
      { BOBINE_WORKSPACE: workspace, BOBINE_MAX_LIVE: '2' }
    )
  } finally {
    rmSync(userData, { recursive: true, force: true })
    rmSync(workspace, { recursive: true, force: true })
  }
}

async function agentChildren(ui, main) {
  const rows = `[...document.querySelectorAll('[data-testid=history-item]')]`
  const rowOf = (title) =>
    `${rows}.find((r) => !r.hasAttribute('data-preparing') && r.innerText.includes(${JSON.stringify(title)}))`
  const activeId = () => ui.ev(`document.querySelector('.history-item.active')?.dataset.id`)
  // Sous la mère dans tous les états (fiche 149).
  const children = () => ui.ev(`${rows}.filter((r) => r.dataset.mother).length`)
  const card = () =>
    ui.ev(`[...document.querySelectorAll('[data-testid=work-group]')].at(-1)?.innerText ?? ''`)
  const groups = () => ui.ev(`document.querySelectorAll('[data-testid=work-group]').length`)
  /** Ligne en attente de la carte « Tâches proposées » (fiche 112) pour cette fille. */
  const pendingRow = (title) =>
    `document.querySelector('[data-testid=proposal-row][data-title=${JSON.stringify(title)}][data-outcome=pending]')`
  /** Décide d'une proposition : `action` start (Lancer), here (Faire ici) ou refuse (Refuser). */
  const approve = async (title, action = 'start') => {
    await ui.waitFor(`!!${pendingRow(title)}`, 30000)
    const button = `${pendingRow(title)}.querySelector('[data-testid=proposal-${action}]')`
    // « Lancer » armé une fois le dossier de la mère lu (fiches 240, 262) : un clic plus tôt est
    // ignoré.
    await ui.waitFor(`!${button}.disabled`, 30000)
    // Pointeur d'abord amené sur le bouton, puis visée de nouveau : une proposition qui arrive
    // déplace la mise en page sous le pointeur immobile ; Chromium y voit un survol de la zone de
    // saisie, qui lève la pause du fil (fiche 124), et le fil redescend après la première visée
    // (échec intermittent « En-tête 2 », fiches 143 et 148). Comme une main qui vise une cible qui
    // vient de bouger.
    await ui.hover(await ui.center(button))
    await sleep(200)
    await ui.click(button)
    await ui.waitFor(`!${pendingRow(title)}`)
  }

  await ui.send('Organise le carnet')
  await ui.ready()
  const mother = await activeId()

  // `filles` : une carte « Tâches proposées » pour les propositions du tour (fiche 112). L'agent
  // factice enchaîne ses deux `start_child` : la deuxième proposition arrive une fois la première
  // décidée, sur la même carte. Deux filles, la mère au repos, un seul réveil.
  await ui.send('/scenario filles')
  await ui.waitFor(`!!${pendingRow('Import CSV')}`, 30000)
  // La consigne se déplie ; les options montrent l'agent de la mère et son modèle.
  await ui.click(`${pendingRow('Import CSV')}.querySelector('[data-testid=proposal-title]')`)
  await ui.waitFor(`${ui.$('proposal-prompt')}?.innerText.includes('/scenario modifications')`)
  await ui.click(`${pendingRow('Import CSV')}.querySelector('[data-testid=proposal-options]')`)
  await ui.waitFor(`!!${ui.$('proposal-model')}`)
  await ui.shot('filles-5-propositions')
  await approve('Import CSV')
  // La deuxième proposition rejoint la carte, la première y garde son issue.
  await ui.waitFor(`!!${pendingRow('Page d’aide')}`, 30000)
  const both = await card()
  // La ligne lancée devient celle de son travail, sur place (fiche 264).
  await ui.waitFor(
    `[...document.querySelectorAll('[data-testid=work-row]')].some((r) => r.innerText.includes('Import CSV'))`,
    30000
  )
  check(
    both.includes(L('workGroup.titleProposed', { count: 2 })) && (await groups()) === 1,
    'deuxième start_child du tour : même carte, deux lignes, la première lancée sur place'
  )
  await ui.shot('filles-5b-deux-propositions')
  // « Import CSV » a fini pendant que la mère attend la décision sur « Page d'aide » : sa réponse
  // lui sera remise à la fin de la sienne (état `pending`). Il a répondu, la carte le dit et le
  // compte, la précision en infobulle (maquette rc4, variante 1).
  const csvRow = `[...document.querySelectorAll('[data-testid=work-row]')].find((r) => r.innerText.includes('Import CSV'))`
  await ui.waitFor(`${csvRow}?.dataset.state === 'pending'`, 30000)
  await ui.shot('filles-5c-travail-fini-en-attente')
  await approve('Page d’aide')
  await ui.waitFor(`document.querySelectorAll('[data-testid=work-row]').length === 2`, 30000)
  await ui.waitFor(`!!${ui.$('wake-message')}`, 60000)
  await ui.ready()
  await ui.ev(`${ui.$('wake-message')}.scrollIntoView({ block: 'center' }), true`)
  await ui.shot('filles-6-reveil')

  // `filles-refus` avec « Faire ici » : la consigne revient à l'agent, qui le dit (fiche 112).
  await ui.send('/scenario filles-refus')
  await approve('Page d’aide', 'here')
  await ui.ready()
  await ui.ev(
    `document.querySelector('[data-testid=proposal-row][data-outcome=here]').scrollIntoView({ block: 'center' }), true`
  )
  await ui.shot('filles-6b-faire-ici')
  // Refusée : l'agent le sait, aucune fille de plus.
  await ui.send('/scenario filles-refus')
  await approve('Page d’aide', 'refuse')
  await ui.ready()

  // `filles-rafale` (fiche 124, D13) : trois propositions en parallèle, qui arrivent pendant que
  // la première attend. Pointeur sur « Lancer » de la première, dépliée : les suivantes s'ajoutent
  // en dessous, ni la ligne ni son bouton ne bougent ; pointeur sorti, le fil rattrape le bas.
  const lastCard = `[...document.querySelectorAll('[data-testid=work-group]')].at(-1)`
  const scroller = `document.querySelector('.scroll')`
  const gapToBottom = () =>
    ui.ev(
      `(() => { const s = ${scroller}; return s.scrollHeight - s.scrollTop - s.clientHeight })()`
    )
  const first = pendingRow('Liste à lire')
  const startOfFirst = `${first}.querySelector('[data-testid=proposal-start]')`
  const startBox = () =>
    ui.ev(
      `(() => { const b = ${startOfFirst}.getBoundingClientRect(); return { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) } })()`
    )
  await ui.send('/scenario filles-rafale')
  await ui.waitFor(`!!${first}`, 30000)
  await ui.click(`${first}.querySelector('[data-testid=proposal-title]')`)
  await ui.waitFor(`!!${first}.querySelector('[data-testid=proposal-prompt]')`)
  // Le fil suit le bas à ce moment-là : sans la pause sous le pointeur, il défilerait.
  await ui.waitFor(
    `(() => { const s = ${scroller}; return s.scrollHeight - s.scrollTop - s.clientHeight < 60 })()`
  )
  // Ce que le pointeur survole à partir d'ici (fiche 181) : la fiche 143 avait vu, sous charge
  // avec le SDK ACP 2.0, la pause levée par un `pointerover` inattendu ; non reproduit depuis.
  // En cas d'échec, la trace dit quel élément l'a reçu, où, et la place de la zone de saisie.
  await ui.ev(`(() => {
    window.__pointerTrace = []
    document.addEventListener('pointerover', (e) => {
      const el = e.target instanceof Element ? e.target : null
      const id = el?.closest('[data-testid]')?.getAttribute('data-testid') ?? el?.tagName
      const dock = document.querySelector('.thread-dock')?.getBoundingClientRect().top
      window.__pointerTrace.push(id + '@' + e.clientX + ',' + e.clientY + ' dock ' + Math.round(dock ?? 0) + ' t' + Math.round(performance.now()))
    }, true)
    return true
  })()`)
  const trace = async (ok, label) =>
    ok ? label : `${label} — survols : ${await ui.ev(`window.__pointerTrace.join(' | ')`)}`
  const aim = await ui.center(startOfFirst)
  await ui.hover(aim)
  await ui.ev('new Promise((r) => requestAnimationFrame(() => r(true)))')
  const before = await startBox()
  const inPlace =
    before.x === Math.round(aim.x) &&
    before.y === Math.round(aim.y) &&
    (await ui.ev(`${lastCard}.querySelectorAll('[data-testid=proposal-row]').length`)) === 1
  check(
    inPlace,
    await trace(
      inPlace,
      'propositions en rafale : pointeur en place avant les propositions suivantes'
    )
  )
  await ui.waitFor(`${lastCard}.querySelectorAll('[data-testid=proposal-row]').length === 3`, 30000)
  await ui.waitFor(`document.body.innerText.includes('l’application mobile')`)
  const after = await startBox()
  const order = await ui.ev(
    `[...${lastCard}.querySelectorAll('[data-testid=proposal-row]')].map((r) => r.dataset.title).join(' / ')`
  )
  await ui.shot('filles-6c-propositions-en-rafale')
  const still =
    order === 'Liste à lire / Tests serveur / Application mobile' &&
    after.x === before.x &&
    after.y === before.y &&
    (await ui.ev(`!!${first}.querySelector('[data-testid=proposal-prompt]')`)) &&
    (await ui.ev(
      `document.elementFromPoint(${before.x}, ${before.y})?.closest('button') === ${startOfFirst}`
    ))
  check(
    still,
    await trace(
      still,
      `propositions en rafale : ajoutées dessous, « Lancer » de la ligne dépliée immobile sous le pointeur (${JSON.stringify(before)} → ${JSON.stringify(after)})`
    )
  )
  // Pointeur sorti de la carte (sur la barre latérale) : le fil rattrape le bas.
  await ui.hover({ x: 20, y: 400 })
  await ui.waitFor(
    `(() => { const s = ${scroller}; return s.scrollHeight - s.scrollTop - s.clientHeight < 60 })()`
  )
  check((await gapToBottom()) < 60, 'pointeur sorti de la carte : le fil reprend le bas')
  for (const title of ['Liste à lire', 'Tests serveur', 'Application mobile']) {
    await approve(title, 'refuse')
  }
  await ui.ready()
  check(
    (await ui.lastAgentText()).includes('Les trois propositions ont leur réponse') &&
      (await children()) === 2,
    'propositions en rafale refusées : le tour finit, pas de fille'
  )

  // `filles-plafond` : plafond réglé à 2 dans Réglages › Conversation.
  await main.evaluate(
    `(require('electron').Menu.getApplicationMenu().getMenuItemById('settings').click(), true)`
  )
  await ui.waitFor(`!!${ui.$('settings')}`)
  await ui.click(ui.$('settings-conversation'))
  await ui.waitFor(`${ui.$('settings-max-children')}?.innerText === '5'`)
  for (let i = 0; i < 3; i++) await ui.click(ui.$('settings-max-children-less'))
  await ui.waitFor(`${ui.$('settings-max-children')}.innerText === '2'`)
  await ui.shot('filles-7-plafond-reglage')
  await ui.key('Escape')
  await ui.waitFor(`!${ui.$('settings')}`)
  await ui.send('/scenario filles-plafond')
  await approve('En-tête 1')
  await approve('En-tête 2')
  await ui.ready()
  // « Lancer en parallèle… » grisé, avec une infobulle.
  await ui.click(ui.$('title-menu'))
  await ui.waitFor(`${ui.$('title-launch-child')}?.hasAttribute('data-disabled')`)
  // Position lue une fois le menu immobile (il s'ouvre en glissant). Sous charge (fiche 115, suites
  // en parallèle), un seul survol n'ouvre pas toujours l'infobulle : la souris est ramenée sur
  // l'élément jusqu'à ce qu'elle s'affiche.
  const limitTip = `document.querySelector('.tooltip')?.innerText === ${JSON.stringify(L('children.limit', { count: 2 }))}`
  for (let attempt = 0; ; attempt++) {
    const at = await ui.center(ui.$('title-launch-child'))
    await ui.hover({ x: at.x + (attempt % 2), y: at.y })
    try {
      await ui.waitFor(limitTip, 3000)
      break
    } catch (error) {
      if (attempt >= 4) throw error
    }
  }
  await ui.shot('filles-8-plafond-menu')
  await ui.key('Escape')
  // Plafond remis à 5 (par défaut) : les deux filles qui attendent un accord restent en cours.
  await ui.ev(`window.api.settings.setPreferences({ maxChildren: 5 }).then(() => true)`)

  // `fille-message` : la mère écrit à sa fille (en file pendant son premier tour), la fille à sa mère.
  await ui.send('/scenario fille-message')
  await approve('Séparateur CSV')
  await ui.waitFor(`!!${rowOf('Séparateur CSV')}`, 30000)
  await ui.click(rowOf('Séparateur CSV'))
  await ui.waitFor(`!!${ui.$('queued-origin')}`, 30000)
  await ui.shot('filles-9-file-fille')
  await ui.waitFor(`${ui.$('message-origin')}?.dataset.origin === 'parent'`, 30000)
  await ui.ready()
  await ui.click(`document.querySelector('[data-testid=history-item][data-id="${mother}"]')`)
  await ui.waitFor(`${ui.$('message-origin')}?.dataset.origin === 'child'`, 30000)
  await ui.ev(
    `document.querySelector('[data-testid=message-origin][data-origin=child]').scrollIntoView({ block: 'center' }), true`
  )
  await ui.shot('filles-10-message-mere')
  const instruction = await ui.ev(
    `window.api.conversations.view(${JSON.stringify(mother)}).then(v => v.transcript.items.findLast(i => i.kind === 'child-instruction'))`
  )
  if (!instruction) throw new Error('Consigne de reprise absente du fil de la mère')
  const receipt = { mother, ...instruction }
  await instructionDetails(ui, receipt, 'reprise')
  // Consigne initiale (fiche 150) : dans la carte du travail aussi, repliée, entière.
  const row = `document.querySelector('[data-testid=work-row][data-child-id="${instruction.childId}"]')`
  const brief = `${row}.querySelector('[data-testid=work-brief]')`
  await ui.click(`${brief}.querySelector('summary')`)
  await ui.ev(`${brief}.scrollIntoView({block:'center'}), true`)
  await ui.shot('150-consigne-initiale')
  await ui.click(`${brief}.querySelector('summary')`)
  return receipt
}

/**
 * Fiche 150 : texte complet, native details au clavier et retour à l'état replié. Fiche 264 : le
 * message de l'agent au travail (`message_child`) est dans la carte du travail, sur sa ligne.
 */
async function instructionDetails(ui, receipt, name) {
  const line = `document.querySelector('[data-testid=work-row][data-child-id="${receipt.childId}"]')`
  await ui.waitFor(`!!${line}`)
  if (
    (await ui.ev(
      `${line}.querySelector('[data-testid=work-row-toggle]').getAttribute('aria-expanded')`
    )) !== 'true'
  ) {
    await ui.ev(`${line}.querySelector('[data-testid=work-row-toggle]').click(), true`)
  }
  const row = `${line}.querySelector('[data-testid=work-note]')`
  await ui.waitFor(`!!${row}`)
  check(!(await ui.ev(`${row}.open`)), `${name} : consigne repliée par défaut`)
  await ui.ev(
    `${row}.scrollIntoView({block:'center'}), ${row}.querySelector('summary').focus(), true`
  )
  if (name === 'reprise') await ui.shot('150-consigne-repliee')
  await ui.enter()
  await ui.waitFor(`${row}.open`)
  await ui.ev(`${row}.scrollIntoView({block:'center'}), true`)
  check(
    (await ui.ev(`${row}.querySelector('[data-testid=work-note-text]').textContent`)) ===
      receipt.prompt,
    `${name} : texte accepté par message_child conservé sans troncature`
  )
  await ui.shot(`150-consigne-${name}`)
  await ui.enter()
  await ui.waitFor(`!${row}.open`)
}
