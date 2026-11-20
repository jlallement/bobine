import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { L, check, withApp } from '../lib.mjs'

/**
 * Rôles au travail (fiche 223, phase 3B), contre l'agent factice, dans un dépôt git jetable qui a
 * un rôle du projet (`security-expert`, il remplace le rôle fourni du même nom) :
 * - menu `@` (rôles en tête, filtre, clavier), jeton, ligne « Sera confié à… », une fille ;
 * - deux `@rôle` dans un message : une bulle, deux cartes-réponses (fiche 263) ;
 * - carte-réponse (fiche 263, scénario `avis-long`) : en cours, a répondu (repliée, « Lire la
 *   suite »), transmise (« Demander à … de l'appliquer »), « Répondre à … » dans la même carte ;
 * - en-tête de la fille ; proposition de l'agent (`roles-delegue`) : badge, mode, lecture seule,
 *   rôle du projet qui en remplace un autre ;
 * - un agent qui écrit sans demander (`MOCK_AGENT_WRITES=silent`) : lecture seule seulement
 *   demandée, sur la ligne « Sera confié à… », la carte de proposition et l'en-tête de la fille.
 */
export async function rolesTravailSuite(scheme) {
  console.log(`\n— Rôles au travail (${scheme})`)
  const workspace = realpathSync(mkdtempSync(join(tmpdir(), 'bob-e2e-roles-')))
  const git = (...args) =>
    execFileSync('git', ['-c', 'user.name=e2e', '-c', 'user.email=e2e@example.invalid', ...args], {
      cwd: workspace,
      encoding: 'utf8'
    }).trim()
  writeFileSync(join(workspace, 'README.md'), '# Carnet\n')
  mkdirSync(join(workspace, '.bobine', 'roles'), { recursive: true })
  writeFileSync(
    join(workspace, '.bobine', 'roles', 'security-expert.md'),
    [
      '---',
      'name: security-expert',
      'label: Expert sécu',
      'icon: shield-check',
      'color: orange',
      'description: Relit le code sensible du projet (authentification, secrets, entrées).',
      'mode: ask',
      'read-only: true',
      '---',
      'Tu es l’expert sécurité de ce projet.',
      ''
    ].join('\n')
  )
  git('init', '-q', '-b', 'main')
  git('add', '.')
  git('commit', '-q', '-m', 'init')
  const env = { BOBINE_WORKSPACE: workspace }
  // Verrou de fin de tour de l'agent factice (hors du dépôt : le garde-fou de la lecture seule
  // n'y voit rien) : tant qu'il existe, les filles ne finissent pas leur tour.
  const locks = realpathSync(mkdtempSync(join(tmpdir(), 'bob-e2e-roles-verrou-')))
  const turnLock = join(locks, 'verrou')
  try {
    // Conversation neuve : `@rôle` en tout premier message (essai réel de la phase 4).
    await withApp(scheme, (ui) => freshRun(ui), undefined, 'streaming-texte', env)
    await withApp(scheme, (ui) => mainRun(ui, turnLock), undefined, 'streaming-texte', {
      ...env,
      MOCK_AGENT_TURN_LOCK: turnLock
    })
    // Carte-réponse (fiche 263) : le scénario de tout l'essai donne un long avis au rôle, une
    // réponse courte à une suite sur le contraste, « C'est appliqué » à la mère qui le reçoit.
    await withApp(scheme, (ui) => cardRun(ui, turnLock), undefined, 'avis-long', {
      ...env,
      MOCK_AGENT_TURN_LOCK: turnLock
    })
    await withApp(
      scheme,
      (ui) => requestedRun(ui),
      undefined,
      'streaming-texte',
      // Agent qui écrit sans demander, comme OpenCode réglé par défaut.
      { ...env, MOCK_AGENT_WRITES: 'silent' }
    )
  } finally {
    rmSync(workspace, { recursive: true, force: true })
    rmSync(locks, { recursive: true, force: true })
  }
}

const input = `document.querySelector('[data-testid="composer-input"]')`
const cards = `[...document.querySelectorAll('[data-testid=work-card]')]`
/** Lignes des cartes de groupe (fiche 264) : plusieurs rôles d'un message, propositions. */
const workRows = `[...document.querySelectorAll('[data-testid=work-row]')]`
const roleItems = `[...document.querySelectorAll('[data-testid=role-item]')].map((i) => i.dataset.role)`

/**
 * Amène un élément au milieu du fil, en ne faisant défiler que le fil (`scrollIntoView` décalait
 * toute la fenêtre).
 */
function reveal(ui, element) {
  return ui.ev(
    `(() => { const el = ${element}; let p = el.parentElement; while (p && !/(auto|scroll)/.test(getComputedStyle(p).overflowY)) p = p.parentElement; if (!p) return; const r = el.getBoundingClientRect(); const pr = p.getBoundingClientRect(); p.scrollTop += r.top - pr.top - Math.max(0, (pr.height - r.height) / 2) })()`
  )
}

/**
 * Attend que `count` tours soient retenus par le verrou de l'agent factice (une ligne chacun dans
 * `<verrou>.retenus`, voir `docs/mock-agent.md`) : leur conversation est alors en plein tour.
 */
async function heldTurns(turnLock, count, timeoutMs = 30000) {
  const file = `${turnLock}.retenus`
  const read = () =>
    existsSync(file) ? readFileSync(file, 'utf8').split('\n').filter(Boolean).length : 0
  const deadline = Date.now() + timeoutMs
  while (read() < count) {
    if (Date.now() > deadline) {
      throw new Error(`tours retenus par le verrou : ${read()} sur ${count} après ${timeoutMs} ms`)
    }
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
}

/** Tape dans la saisie (sans envoyer). */
async function typeIn(ui, text) {
  await ui.ev(`${input}.focus()`)
  await ui.type(text)
}

/**
 * `@rôle` comme tout premier message d'une conversation neuve : la conversation entre dans
 * l'historique (titrée d'après la demande, sans message à son agent), la fille s'y rattache, deux
 * rôles cités donnent deux filles.
 */
async function freshRun(ui) {
  await ui.ready()
  check(
    (await ui.ev(`document.querySelectorAll('[data-testid=history-item]').length`)) === 0,
    'conversation neuve : rien encore dans l’historique'
  )
  await typeIn(ui, '@security-expert @code-reviewer relisez calc.js')
  await ui.press('Escape')
  await ui.waitFor(`!!${ui.$('role-destination')}`)
  await ui.enter()
  await ui.waitFor(`${workRows}.length === 2`, 30000)
  check(
    (await ui.ev(`${input}.value`)) === '' &&
      (await ui.ev(`document.querySelectorAll('[data-testid=role-request]').length`)) === 1 &&
      (await ui.ev(`document.querySelectorAll('[data-testid=work-group]').length`)) === 1,
    'premier message `@rôle` : parti, saisie vidée, aucun refus ; une bulle, une carte de groupe à deux lignes'
  )
  await ui.waitFor(
    `[...document.querySelectorAll('[data-testid=history-item]')].some((i) => i.innerText.includes('relisez calc.js'))`
  )
  await ui.waitFor(
    `document.querySelectorAll('[data-testid=history-item][data-mother]').length === 2`,
    30000
  )
  check(
    true,
    'la conversation est dans l’historique, titrée d’après la demande ; deux filles dessous'
  )
  await ui.waitFor(`${workRows}.filter((c) => c.dataset.state === 'replied').length === 2`, 30000)
  await ui.shot('roles-travail-0-premier-message')
}

/** `turnLock` : verrou de fin de tour de l'agent factice (fichier absent au départ). */
async function mainRun(ui, turnLock) {
  await ui.ready()
  // La mère : une conversation de l'historique (une fille s'y rattache).
  await ui.send('Bonjour')
  await ui.ready()

  // Menu `@` : les rôles en tête, cinq au plus, puis « Tous les rôles ».
  await typeIn(ui, 'Relis le module de connexion @')
  await ui.waitFor(`!!${ui.$('role-item')}`)
  const shown = await ui.ev(roleItems)
  check(
    shown.length === 5 && (await ui.ev(`!!${ui.$('role-more')}`)),
    'menu @ : cinq rôles en tête, puis « Tous les rôles »'
  )
  check(
    (await ui.ev(
      `!!document.querySelector('[data-testid=role-item][data-role=security-expert] .role-item-project')`
    )) &&
      (await ui.ev(`document.querySelector('[data-testid=file-menu]').innerText`)).includes(
        L('roleWork.menu.title')
      ),
    'menu @ : section « Rôles », marque du rôle du projet'
  )
  await ui.shot('roles-travail-1-menu')

  // Filtre, accents ignorés : le nom d'abord, puis la description.
  await ui.type('secu')
  await ui.waitFor(`${roleItems}[0] === 'security-expert'`)
  await ui.shot('roles-travail-2-filtre')
  // Échap referme, le texte reste ; on rouvre, Entrée prend le rôle surligné.
  await ui.press('Escape')
  await ui.waitFor(`!${ui.$('file-menu')}`)
  await ui.type('r')
  await ui.waitFor(`${roleItems}[0] === 'security-expert'`)
  await ui.enter()
  await ui.waitFor(`!!${ui.$('role-token')}`)
  check(
    (await ui.ev(`${input}.value`)) === 'Relis le module de connexion ' &&
      (await ui.ev(`${ui.$('role-token')}.dataset.role`)) === 'security-expert',
    'Entrée : le rôle devient un jeton, `@requête` sort du texte'
  )
  const line = await ui.ev(`${ui.$('role-destination')}.innerText`)
  check(
    line.includes(L('roleWork.readOnly')) && line.includes(L('roleWork.destination.sameFolder')),
    `ligne « Sera confié à… » : lecture seule, dans ce dossier (${line})`
  )
  await ui.shot('roles-travail-3-jeton')
  // Le rôle sans demande (fiche 267, N7) : l'aide en gris, jamais la couleur d'alerte.
  const typed = await ui.ev(`${input}.value`)
  // La demande effacée comme le ferait la saisie (évènement `input`), le jeton gardé.
  await ui.ev(`(() => {
    const i = ${input}
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(i, '')
    i.dispatchEvent(new Event('input', { bubbles: true }))
  })()`)
  await ui.waitFor(`!!${ui.$('role-destination-empty')}`)
  const hint = await ui.ev(`(() => {
    const el = ${ui.$('role-destination-empty')}
    const probe = document.createElement('span')
    probe.style.color = 'var(--muted)'
    el.appendChild(probe)
    const muted = getComputedStyle(probe).color
    probe.remove()
    return { color: getComputedStyle(el).color, muted }
  })()`)
  check(hint.color === hint.muted, `rôle sans demande : l’aide en gris (${JSON.stringify(hint)})`)
  await ui.shot('roles-travail-3a-jeton-vide')
  await ui.type(typed)
  await ui.waitFor(`!${ui.$('role-destination-empty')}`)
  // Retour arrière en tête de la saisie : le jeton part d'un coup ; on le remet.
  await ui.ev(`${input}.setSelectionRange(0, 0)`)
  await ui.press('Backspace')
  await ui.waitFor(`!${ui.$('role-token')}`)
  await ui.ev(
    `(() => { const i = ${input}; i.setSelectionRange(i.value.length, i.value.length) })()`
  )
  await ui.type('@security-expert')
  await ui.press('Escape')
  await ui.waitFor(`!!${ui.$('role-destination')}`)
  await ui.enter()

  // Une bulle « @Expert sécu … » et sa carte-réponse, à l'identité du rôle (fiche 263).
  await ui.waitFor(
    `!!document.querySelector('[data-testid=work-card][data-role=security-expert]')`,
    30000
  )
  check((await ui.ev(`${input}.value`)) === '', 'envoi : la saisie se vide, rien à la mère')
  // La réponse arrive dans la carte : ni lancement, ni « Sous-tâches », ni compte rendu séparés.
  await ui.waitFor(`${cards}[0]?.dataset.state === 'replied'`, 30000)
  check(
    (await ui.ev(
      `!document.querySelector('[data-testid=role-launch], [data-testid=subtasks], [data-testid=child-report]')`
    )) &&
      (await ui.ev(
        `document.querySelector('[data-testid=role-request] [data-testid=role-mention]')?.dataset.role`
      )) === 'security-expert',
    'une bulle avec la puce du rôle et une carte-réponse, rien d’autre'
  )
  await ui.shot('roles-travail-4-fille')

  // Deux `@rôle` tapés : deux filles, en parallèle, avec le même texte.
  await typeIn(ui, '@security-expert @code-reviewer relisez le carnet avant la fusion')
  await ui.waitFor(`!!${ui.$('role-destination')}`)
  check(
    (await ui.ev(`${ui.$('role-destination')}.innerText`)).includes('2'),
    'deux rôles : la ligne résume'
  )
  await ui.shot('roles-travail-5-deux-roles')
  // Au travail : l'anneau de l'avatar (maquette 03-5), sans le prendre au vol. Le verrou retient
  // la fin du tour des deux filles jusqu'à ce que l'essai l'enlève, après la capture. On attend
  // que leurs deux tours soient retenus (inscrits par l'agent factice) : avant, une fille qui
  // démarre passe par « prête » (rôle : consigne et empreinte du dossier) et s'affiche « a fini ».
  writeFileSync(turnLock, '')
  await ui.enter()
  await ui.waitFor(`${workRows}.length === 2`, 30000)
  await heldTurns(turnLock, 2)
  // Les deux nouveaux travaux, sur les lignes de la carte de groupe sous la bulle (fiche 264) :
  // leur ligne et l'anneau de leur avatar disent « en cours ».
  const fresh = workRows
  const bothRunning = `${fresh}.length === 2 && ${fresh}.every((l) => l.dataset.state === 'running' && l.querySelector('[data-testid=role-avatar]')?.dataset.state === 'running')`
  const states = `JSON.stringify(${fresh}.map((l) => [l.dataset.role, l.dataset.state]))`
  await ui.waitFor(bothRunning, 15000)
  await reveal(ui, `${fresh}[0]`)
  check(await ui.ev(bothRunning), 'deux rôles : deux filles au travail, l’anneau sur leur avatar')
  await ui.shot('roles-travail-5b-au-travail')
  // Toujours au travail après la capture : elle montre bien les anneaux.
  check(
    await ui.ev(bothRunning),
    `capture prise pendant le travail (verrou tenu) ${await ui.ev(states)}`
  )
  rmSync(turnLock)
  await ui.waitFor(
    `[...${cards}, ...${workRows}].every((c) => c.dataset.state === 'replied')`,
    60000
  )
  check(
    (await ui.ev(`[...${cards}, ...${workRows}].map((l) => l.dataset.role).join()`)) ===
      'security-expert,security-expert,code-reviewer' &&
      (await ui.ev(`document.querySelectorAll('[data-testid=role-request]').length`)) === 2 &&
      (await ui.ev(
        `[...document.querySelectorAll('[data-testid=role-request]')][1].querySelectorAll('[data-testid=role-mention]').length`
      )) === 2,
    'deux rôles : une bulle à deux puces, une carte de groupe, une ligne par rôle, dans l’ordre du message'
  )
  check(
    !(await ui.ev(`!!document.querySelector('[data-testid=subtasks]')`)),
    'pas de carte « Sous-tâches » pour les travaux d’une bulle'
  )
  await reveal(ui, ui.$('work-group'))
  await ui.shot('roles-travail-6-sous-taches')

  // L'en-tête de la fille dit son rôle et sa lecture seule.
  await ui.ev(`${ui.$('work-open')}.click()`)
  await ui.waitFor(`!!${ui.$('role-title-badge')}`)
  check(
    (await ui.ev(
      `document.querySelector('[data-testid=role-title-badge] [data-testid=role-read-only]')?.dataset.level`
    )) === 'enforced',
    'en-tête de la fille : son rôle, lecture seule garantie'
  )
  await ui.shot('roles-travail-7-fille-entete')
  // En-tête étroit (essais réels : 1 280 px, panneau ouvert, pastille « Profil temporaire ») : la
  // pastille est posée comme en profil temporaire ; le titre reste lisible, rien ne déborde.
  const narrow = await ui.ev(`(() => {
    const header = document.querySelector('.main-header')
    const chip = document.createElement('span')
    chip.className = 'temporary-chip no-drag'
    chip.dataset.e2e = 'chip'
    chip.textContent = ${JSON.stringify(L('settings.data.fresh.chip'))}
    header.querySelector('.grow').after(chip)
    const right = header.getBoundingClientRect().right
    return {
      title: header.querySelector('.main-title').getBoundingClientRect().width,
      overflow: [...header.children].some((el) => el.getBoundingClientRect().right > right + 1)
    }
  })()`)
  check(
    narrow.title >= 90 && !narrow.overflow,
    `en-tête d'une fille étroit : titre lisible (${Math.round(narrow.title)} px), rien ne déborde`
  )
  await ui.shot('roles-travail-7b-entete-etroit')
  // Fenêtre au plus étroit (800 px, panneau replié) : le titre cède d'abord, puis la pastille se
  // réduit à son icône ; jamais coupée au milieu d'une lettre.
  const header = `(() => {
    const header = document.querySelector('.main-header')
    const badge = document.querySelector('[data-testid=role-title-badge]')
    const pill = badge.querySelector('[data-testid=role-read-only]')
    const b = badge.getBoundingClientRect()
    const p = pill.getBoundingClientRect()
    const right = header.getBoundingClientRect().right
    return {
      title: header.querySelector('.main-title').getBoundingClientRect().width,
      clipped: p.right > b.right + 0.5 || p.left < b.left - 0.5 || pill.scrollWidth > pill.clientWidth + 1,
      overflow: [...header.children]
        .filter((el) => !el.dataset.e2e)
        .some((el) => el.getBoundingClientRect().right > right + 1),
      compact: pill.classList.contains('compact') && !!pill.querySelector('svg')
    }
  })()`
  const wide = await ui.ev(header)
  check(
    !wide.clipped,
    `en-tête étroit, profil temporaire : pastille entière (${wide.compact ? 'icône' : 'texte'})`
  )
  await ui.ev(`document.querySelector('[data-e2e=chip]')?.remove()`)
  await ui.viewport(800)
  const tight = await ui.ev(header)
  check(
    !tight.clipped && !tight.overflow && tight.title >= 90,
    `en-tête d'une fille à 800 px : pastille entière (${tight.compact ? 'icône' : 'texte'}), titre ${Math.round(tight.title)} px, rien ne déborde`
  )
  await ui.shot('roles-travail-7c-entete-800')
  // Encore moins de place (la pastille « Profil temporaire », qui ne se raccourcit pas) : la
  // pastille de la lecture seule se réduit à son icône, entière.
  await ui.ev(`(() => {
    const chip = document.createElement('span')
    chip.className = 'temporary-chip no-drag'
    chip.dataset.e2e = 'chip'
    chip.textContent = ${JSON.stringify(L('settings.data.fresh.chip'))}
    document.querySelector('.main-header .grow').after(chip)
  })()`)
  await ui.waitFor(`!!document.querySelector('[data-testid=role-title-badge][data-compact]')`, 5000)
  const squeezed = await ui.ev(header)
  check(
    squeezed.compact && !squeezed.clipped && squeezed.title >= 90,
    `en-tête d'une fille à 800 px, profil temporaire : pastille réduite à son icône, entière ; titre ${Math.round(squeezed.title)} px`
  )
  await ui.shot('roles-travail-7d-entete-800-icone')
  await ui.ev(`document.querySelector('[data-e2e=chip]')?.remove()`)
  await ui.viewport()
  await ui.click(ui.$('title-origin'))
  await ui.waitFor(`!${ui.$('role-title-badge')}`)

  // L'agent propose un rôle : la carte le montre, figé (badge, mode, lecture seule, projet).
  await ui.send('/scenario roles-delegue')
  const pending = `document.querySelector('[data-testid=proposal-row][data-outcome=pending]')`
  await ui.waitFor(`!!${pending}?.querySelector('[data-testid=proposal-role]')`, 30000)
  check(
    (await ui.ev(`${pending}.querySelector('[data-testid=role-read-only]').dataset.level`)) ===
      'enforced' &&
      (await ui.ev(`${pending}.querySelector('[data-testid=proposal-role-mode]').innerText`)) ===
        L('roleWork.mode', { mode: 'ask' }) &&
      (await ui.ev(`!!${pending}.querySelector('[data-testid=proposal-role-hides]')`)),
    'proposition : lecture seule garantie, mode, rôle du projet qui remplace le fourni'
  )
  await reveal(ui, `${pending}`)
  await ui.shot('roles-travail-8-proposition')
  // « Lancer » armé une fois le dossier de la mère lu (fiches 240, 262).
  await ui.waitFor(`!${pending}.querySelector('[data-testid=proposal-start]').disabled`, 30000)
  await ui.click(`${pending}.querySelector('[data-testid=proposal-start]')`)
  // Travail lancé par l'agent : sur sa ligne de la carte des propositions (fiche 264).
  await ui.waitFor(`${workRows}.length === 3`, 30000)
  check(
    (await ui.ev(`document.querySelectorAll('[data-testid=work-group]').length`)) === 2 &&
      (await ui.ev(`${workRows}[2].dataset.role`)) === 'security-expert' &&
      !(await ui.ev(
        `!!document.querySelector('[data-testid=role-launch], [data-testid=subtasks], [data-testid=child-report]')`
      )) &&
      (await ui.ev(`${cards}.length`)) === 1,
    'proposition de l’agent : sa ligne dans sa carte de groupe, ni lancement ni « Sous-tâches »'
  )
}

/**
 * Carte-réponse unique (fiche 263, écran A des maquettes de la fiche 260), scénario `avis-long` :
 * en cours (activité, temps), a répondu (réponse entière repliée, « Lire la suite »), transmise
 * (« Demander à … de l'appliquer » : le message part à la mère), « Répondre à … » (la suite et sa
 * réponse dans la même carte). Captures `263-carte-*`.
 */
async function cardRun(ui, turnLock) {
  await ui.ready()
  await ui.closePanel()
  // Le travail est retenu par le verrou : on le voit au travail sans le prendre au vol.
  writeFileSync(turnLock, '')
  await typeIn(
    ui,
    '@ux-ui-expert À quoi ça pourrait ressembler visuellement ? Propose une direction.'
  )
  await ui.press('Escape')
  await ui.waitFor(`!!${ui.$('role-destination')}`)
  await ui.enter()
  const card = `document.querySelector('[data-testid=work-card][data-role=ux-ui-expert]')`
  await ui.waitFor(`${card}?.dataset.state === 'running'`, 30000)
  await heldTurns(turnLock, 1)
  // Les deux lectures du scénario sont passées : les derniers faits de la carte.
  await ui.waitFor(
    `${card}.querySelectorAll('[data-testid=work-live-done] li').length === 2`,
    15000
  )
  const running = await ui.ev(`(() => {
    const card = ${card}
    const bubble = document.querySelector('[data-testid=role-request]')
    return {
      before: !!(bubble.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING),
      mention: bubble.querySelector('[data-testid=role-mention]')?.dataset.role,
      elapsed: card.querySelector('[data-testid=work-state]').innerText,
      stop: !!card.querySelector('[data-testid=work-stop]'),
      open: !!card.querySelector('[data-testid=work-open]'),
      others: !!document.querySelector('[data-testid=role-launch], [data-testid=subtasks], [data-testid=child-report]')
    }
  })()`)
  check(
    running.before &&
      running.mention === 'ux-ui-expert' &&
      /^\d+:\d\d$/.test(running.elapsed) &&
      running.stop &&
      running.open &&
      !running.others,
    `en cours : la bulle, la carte juste dessous, temps écoulé, Arrêter, Ouvrir (${JSON.stringify(running)})`
  )
  await ui.shot('263-carte-en-cours')
  check(
    (await ui.ev(`${card}?.dataset.state`)) === 'running',
    'capture prise pendant le travail (verrou tenu)'
  )

  // A répondu : la réponse entière, repliée ; « Lire la suite » la déplie.
  rmSync(turnLock)
  await ui.waitFor(`${card}?.dataset.state === 'replied'`, 30000)
  await ui.waitFor(`!!${card}.querySelector('[data-testid=work-more]')`, 10000)
  const replied = await ui.ev(`(() => {
    const card = ${card}
    const body = card.querySelector('[data-testid=work-body]')
    return {
      folded: body.dataset.folded === 'true' && body.clientHeight < body.scrollHeight,
      whole: body.textContent.includes('FIN-DE-L-AVIS'),
      heading: !!body.querySelector('h3'),
      relay: card.querySelector('[data-testid=work-relay]')?.dataset.sent,
      apply: !!card.querySelector('[data-testid=work-apply]'),
      reply: !!card.querySelector('[data-testid=work-reply]')
    }
  })()`)
  check(
    replied.folded &&
      replied.whole &&
      replied.heading &&
      replied.relay === 'false' &&
      replied.apply &&
      replied.reply,
    `a répondu : réponse entière en Markdown, repliée ; pas encore transmise ; Appliquer, Répondre (${JSON.stringify(replied)})`
  )
  await reveal(ui, card)
  await ui.shot('263-carte-repondu')
  // Fenêtre étroite (revue UX, 9) : la carte réduit son retrait, rien ne déborde.
  await ui.viewport(900, 820)
  await reveal(ui, card)
  const narrow = await ui.ev(`(() => {
    const card = ${card}
    const box = card.getBoundingClientRect()
    return [...card.querySelectorAll('*')].every((el) => el.getBoundingClientRect().right <= box.right + 1)
  })()`)
  check(narrow, '900 px : rien ne déborde de la carte')
  await ui.shot('263-carte-repondu-900')
  await ui.viewport()
  await ui.click(`${card}.querySelector('[data-testid=work-more]')`)
  await ui.waitFor(`!${card}.querySelector('[data-testid=work-body]').dataset.folded`)
  check(
    (await ui.ev(`${card}.querySelector('[data-testid=work-more]').innerText`)) ===
      L('workCard.collapse'),
    '« Lire la suite » déplie sur place, « Replier » la referme'
  )
  await ui.click(`${card}.querySelector('[data-testid=work-more]')`)

  // « Demander à … de l'appliquer » : le message préparé part à la mère, la carte reste en place.
  await ui.click(`${card}.querySelector('[data-testid=work-apply]')`)
  await ui.waitFor(
    `${card}.querySelector('[data-testid=work-relay]')?.dataset.sent === 'true'`,
    30000
  )
  await ui.ready()
  const sent = await ui.ev(`(() => {
    const card = ${card}
    const message = [...document.querySelectorAll('[data-testid=user-message]')].at(-1)
    return {
      text: message?.innerText ?? '',
      after: !!message && !!(card.compareDocumentPosition(message) & Node.DOCUMENT_POSITION_FOLLOWING),
      apply: !!card.querySelector('[data-testid=work-apply]'),
      replied: document.querySelector('.msg-agent')?.innerText.includes('appliqué') ?? false
    }
  })()`)
  check(
    sent.text.includes(L('workCard.applyMessage', { role: 'Expert UX/UI' }).slice(0, 12)) &&
      sent.after &&
      !sent.apply,
    `transmise : le message préparé sous la carte, l’action principale disparue (${JSON.stringify(sent)})`
  )
  await reveal(ui, card)
  await ui.shot('263-carte-transmise')

  // « Répondre à … » : la puce du rôle dans la saisie ; la suite va dans la même carte.
  await ui.click(`${card}.querySelector('[data-testid=work-reply]')`)
  await ui.waitFor(`${ui.$('role-token')}?.dataset.reply === 'true'`)
  await typeIn(ui, 'Et les contrastes ?')
  await ui.waitFor(`${ui.$('role-destination')}?.dataset.reply === 'true'`)
  await ui.enter()
  await ui.waitFor(`!!${card}.querySelector('[data-testid=work-ask]')`, 30000)
  await ui.waitFor(
    `${card}.querySelectorAll('[data-testid=work-answer]').length === 2 && ${card}.dataset.state === 'replied'`,
    30000
  )
  check(
    (await ui.ev(`${cards}.length`)) === 1 &&
      (await ui.ev(`document.querySelectorAll('[data-testid=role-request]').length`)) === 1 &&
      (await ui.ev(
        `${card}.querySelectorAll('[data-testid=work-answer]')[1].innerText.includes('Contrastes')`
      )),
    'Répondre : la suite et sa réponse dans la même carte, aucun nouveau travail'
  )
  await reveal(ui, `${card}.querySelector('[data-testid=work-ask]')`)
  await ui.shot('263-carte-repondre')

  // Arrêté : « Arrêter » n'arrête que ce travail ; la carte le dit, « Relancer » est proposé.
  writeFileSync(turnLock, '')
  const held = existsSync(`${turnLock}.retenus`)
    ? readFileSync(`${turnLock}.retenus`, 'utf8').split('\n').filter(Boolean).length
    : 0
  await typeIn(ui, '@ux-ui-expert Compare deux variantes de palette.')
  await ui.press('Escape')
  await ui.waitFor(`!!${ui.$('role-destination')}`)
  await ui.enter()
  const second = `${cards}[1]`
  await ui.waitFor(`${second}?.dataset.state === 'running'`, 30000)
  await heldTurns(turnLock, held + 1)
  await ui.click(`${second}.querySelector('[data-testid=work-stop]')`)
  await ui.waitFor(`${second}?.dataset.state === 'stopped'`, 30000)
  rmSync(turnLock, { force: true })
  check(
    (await ui.ev(`!!${second}.querySelector('[data-testid=work-retry]')`)) &&
      (await ui.ev(`${cards}[0].dataset.state`)) === 'replied',
    'arrêté : ce travail seulement, « Relancer » proposé'
  )
  await reveal(ui, second)
  await ui.shot('263-carte-arrete')

  // En erreur : le tour du travail échoue, la carte dit l'erreur.
  await typeIn(ui, '@ux-ui-expert Vérifie la base de données.')
  await ui.press('Escape')
  await ui.waitFor(`!!${ui.$('role-destination')}`)
  await ui.enter()
  const third = `${cards}[2]`
  await ui.waitFor(`${third}?.dataset.state === 'error'`, 30000)
  check(
    (await ui.ev(`${third}.querySelector('[data-testid=work-error]')?.innerText ?? ''`)).includes(
      'Base injoignable'
    ) && (await ui.ev(`!!${third}.querySelector('[data-testid=work-retry]')`)),
    'en erreur : l’erreur dite dans la carte, « Relancer » proposé'
  )
  await reveal(ui, third)
  await ui.shot('263-carte-erreur')
}

async function requestedRun(ui) {
  await ui.ready()
  await ui.send('Bonjour')
  await ui.ready()
  // La ligne « Sera confié à… » le dit avant l'envoi.
  await typeIn(ui, '@security-expert relis le carnet')
  await ui.waitFor(`!!${ui.$('role-destination')}`)
  check(
    (await ui.ev(`${ui.$('role-destination')}.innerText`)).includes(
      L('roleWork.readOnlyRequested')
    ),
    'agent qui écrit sans demander : « lecture seule demandée » avant l’envoi'
  )
  await ui.shot('roles-travail-9-jeton-demandee')
  await ui.ev(
    `(() => { const i = ${input}; const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; set.call(i, ''); i.dispatchEvent(new Event('input', { bubbles: true })) })()`
  )
  // La proposition de l'agent : lecture seule seulement demandée, sans nom d'agent.
  await ui.send('/scenario roles-delegue')
  const pending = `document.querySelector('[data-testid=proposal-row][data-outcome=pending]')`
  await ui.waitFor(`!!${pending}?.querySelector('[data-testid=proposal-role]')`, 30000)
  const tag = await ui.ev(
    `(() => { const t = ${pending}.querySelector('[data-testid=role-read-only]'); return { level: t.dataset.level, text: t.innerText } })()`
  )
  check(
    tag.level === 'requested' && tag.text === L('roleWork.readOnlyRequested'),
    'proposition : lecture seule seulement demandée'
  )
  await reveal(ui, `${pending}`)
  await ui.shot('roles-travail-10-proposition-demandee')
  // « Lancer » armé une fois le dossier de la mère lu (fiches 240, 262).
  await ui.waitFor(`!${pending}.querySelector('[data-testid=proposal-start]').disabled`, 30000)
  await ui.click(`${pending}.querySelector('[data-testid=proposal-start]')`)
  // Travail lancé par l'agent : sa ligne de carte de groupe (fiche 264), dépliée, « Ouvrir ».
  const launched = `${workRows}.at(-1)`
  await ui.waitFor(`!!${launched}`, 30000)
  // Boutons ordinaires : cliqués sans viser, le fil peut défiler (réveil de la mère).
  await ui.ev(`${launched}.querySelector('[data-testid=work-row-toggle]').click()`)
  await ui.waitFor(`!!${launched}.querySelector('[data-testid=work-open]')`)
  await ui.ev(`${launched}.querySelector('[data-testid=work-open]').click()`)
  await ui.waitFor(`!!${ui.$('role-title-badge')}`)
  check(
    (await ui.ev(
      `document.querySelector('[data-testid=role-title-badge] [data-testid=role-read-only]')?.dataset.level`
    )) === 'requested',
    'en-tête de la fille : lecture seule seulement demandée'
  )
  await ui.shot('roles-travail-11-fille-demandee')
}
