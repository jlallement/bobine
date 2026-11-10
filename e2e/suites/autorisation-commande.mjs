import { L, check, withApp } from '../lib.mjs'
import {
  ARGV_COMMAND,
  BOB_LONG_COMMAND,
  LONG_FILE_NAME,
  LONG_NAME_IN_FOLDER,
  OPENCODE_COMMAND,
  OUTSIDE_COMMAND,
  OUTSIDE_FILE,
  OUTSIDE_FOLDER,
  PLAIN_TEXT_COMMAND,
  TRAPPED_COMMAND,
  VERY_LONG_COMMAND
} from '../../src/mock-agent/scenarios-commandes.mts'
import { quoteArg, visibleText } from '../../src/shared/command-view.ts'

/**
 * « Autoriser cette commande ? » (0.11, M1, sécurité) : la carte montre la commande entière avant
 * qu'on accepte, et sa FIN est lisible ou atteignable dans la carte. Comme Bob (commande dans le
 * titre seulement), commande dans `rawInput` (courte, puis 31 lignes dans un dossier hors de la
 * conversation) ; fenêtre normale puis 900 px panneau ouvert. Aucun bouton ne prend le focus.
 */
export async function autorisationCommandeSuite(scheme) {
  console.log(`\n— Autorisation d'une commande (${scheme})`)
  await withApp(scheme, async (ui) => {
    await ui.ready()
    await ui.closePanel()
    await askAndCheck(ui, 'commande-bob', BOB_LONG_COMMAND, 'M1-b-longue-bob')
    // Après la décision : la ligne repliée garde la version courte, la commande entière en
    // infobulle ; dépliée, la commande puis la sortie.
    const tool = `[...document.querySelectorAll('details.tool')].at(-1)`
    check(
      (await ui.ev(`${tool}.querySelector('.tool-title [title]')?.title`)) === BOB_LONG_COMMAND,
      'après : la commande entière en infobulle de la ligne'
    )
    await ui.click(`${tool}.querySelector('summary')`)
    await ui.waitFor(`!!${tool}.querySelector('[data-testid=command-block]')`)
    check(
      (await ui.ev(
        `${tool}.querySelector('[data-testid=command-text]').textContent === ${JSON.stringify(BOB_LONG_COMMAND)}`
      )) && (await ui.ev(`${tool}.innerText.includes('20000 gros.txt')`)),
      'après : dépliée, la commande entière puis la sortie'
    )
    await ui.shot('M1-d-apres-deplie')
    await askAndCheck(ui, 'commande-courte', 'git status --short', 'M1-a-courte')
    await askAndCheck(ui, 'commande-tres-longue', VERY_LONG_COMMAND, 'M1-c-tres-longue')

    // Relecture sécurité : ce qu'on voit est ce qui sera lancé.
    await ui.send('/scenario commande-piegee')
    await ui.waitFor(`!!${PRE}`)
    check(
      (await shownText(ui)) === visibleText(TRAPPED_COMMAND) &&
        (await ui.ev(`${CARD}.querySelectorAll('.cmd-invisible').length`)) === 5 &&
        (await ui.ev(`!!${CARD}.querySelector('[data-testid=command-invisible]')`)),
      'commande piégée : \\r seul, RLO, zéro-largeur, espace cadratin rendus visibles (␍, ⟨U+202E⟩…), signalés'
    )
    check(
      (
        await ui.ev(`${CARD}.querySelector('[data-testid=command-announced]')?.innerText ?? ''`)
      ).includes('npm test'),
      'commande piégée : le titre « npm test » annoncé par l’agent est montré à part'
    )
    await ui.shot('M1-e-piegee')
    await ui.click(`[...${CARD}.querySelectorAll('.pc-actions button')][0]`)
    await ui.waitFor(`!document.querySelector('[data-testid=permission]')`)
    await ui.ready()

    await ui.send('/scenario commande-texte')
    await ui.waitFor(`!!${PRE}`)
    check(
      (await shownText(ui)) === PLAIN_TEXT_COMMAND &&
        !(await ui.ev(`!!${CARD}.querySelector('[data-testid=command-invisible]')`)) &&
        (await ui.ev(`${CARD}.querySelectorAll('.cmd-invisible').length`)) === 0 &&
        (await ui.ev(`${CARD}.querySelectorAll('.cmd-quiet').length`)) === 1,
      'texte ordinaire (insécable entre guillemets, emoji, NFD) : aucune alerte, l’insécable discrète'
    )
    await ui.shot('M1-g-texte-ordinaire')
    await ui.click(`[...${CARD}.querySelectorAll('.pc-actions button')][0]`)
    await ui.waitFor(`!document.querySelector('[data-testid=permission]')`)
    await ui.ready()

    await ui.send('/scenario commande-tableau')
    await ui.waitFor(`!!${PRE}`)
    check(
      (await shownText(ui)) === ARGV_COMMAND.map(quoteArg).join(' ') &&
        (await ui.ev(`${CARD}.querySelectorAll('.cmd-op').length`)) === 0,
      `tableau d'arguments : cité (« ${ARGV_COMMAND.map(quoteArg).join(' ')} »), aucun opérateur marqué`
    )
    await ui.shot('M1-f-tableau')
    await ui.click(`[...${CARD}.querySelectorAll('.pc-actions button')][0]`)
    await ui.waitFor(`!document.querySelector('[data-testid=permission]')`)
    await ui.ready()

    await commandCards(ui)
    await fileCards(ui, '')
    await bobFileCards(ui)
    await riskCards(ui)

    // Fenêtre de 900 px, panneau ouvert : la carte la plus serrée, toujours sans défilement
    // horizontal, la fin de la commande toujours atteignable.
    await ui.viewport(900, 760)
    await ui.waitFor(`!!${ui.$('panel-toggle')}`)
    if (!(await ui.ev(`!!${ui.$('side-panel')}`))) await ui.click(ui.$('panel-toggle'))
    await ui.waitFor(`!!${ui.$('side-panel')}`)
    await askAndCheck(ui, 'commande-bob', BOB_LONG_COMMAND, 'M1-b-longue-bob-900')
    await askAndCheck(ui, 'commande-tres-longue', VERY_LONG_COMMAND, 'M1-c-tres-longue-900')
    // Carte serrée : le début du chemin d'un fichier est coupé, jamais son nom.
    await fileCards(ui, '-900')
    await ui.viewport()
  })
}

/** Accepte la carte en attente et attend la fin du tour. */
async function accept(ui) {
  await ui.click(`[...${CARD}.querySelectorAll('.pc-actions button')][0]`)
  await ui.waitFor(`!document.querySelector('[data-testid=permission]')`)
  await ui.ready()
}

/** Mesures de la barre d'une commande : dossier, infobulle, « Copier » sur la première ligne. */
const commandBar = (ui) =>
  ui.ev(`(() => {
    const card = ${CARD}
    const bar = card.querySelector('.cmd-bar')
    const cwd = card.querySelector('[data-testid=command-cwd]')
    const text = card.querySelector('[data-testid=command-cwd-text]')
    const copy = card.querySelector('[data-testid=command-copy]').getBoundingClientRect()
    const where = card.querySelector('.cmd-where').getBoundingClientRect()
    const b = bar.getBoundingClientRect()
    return {
      text: text.textContent,
      title: cwd.getAttribute('title'),
      clipped: text.scrollWidth > text.clientWidth + 1,
      copyTop: copy.top - b.top,
      copyRight: b.right - copy.right,
      copyBesideWhere: copy.left >= where.right - 1,
      locations: card.querySelectorAll('.tool-location').length,
      outside: !!card.querySelector('[data-testid=command-outside]'),
      invisible: !!card.querySelector('[data-testid=command-invisible]'),
      marks: card.querySelectorAll('.cmd-invisible').length,
      // Mentions : leur texte, et leur « · » visible ou non (coupé hors de la colonne quand la
      // mention commence une ligne).
      warns: [...card.querySelectorAll('.cmd-warn')].map((w) => {
        const r = w.getBoundingClientRect()
        const col = card.querySelector('.cmd-where').getBoundingClientRect()
        const clips = getComputedStyle(card.querySelector('.cmd-where')).overflow === 'hidden'
        return {
          text: w.textContent,
          lineStart: r.left - col.left < 2,
          dotShown: !(clips && r.left - 12 < col.left - 0.5)
        }
      })
    }
  })()`)

/**
 * Carte « commande » de la recette OpenCode (fiche 203) : le dossier une seule fois (l'emplacement
 * égal au dossier n'est plus répété), « Dans projet », « Dans projet/src/renderer », hors du
 * dossier le chemin entier jamais coupé ; « Copier » toujours en haut à droite.
 */
async function commandCards(ui) {
  await ui.send('/scenario commande-opencode')
  await ui.waitFor(`!!${PRE}`)
  const here = await commandBar(ui)
  const name = here.title?.replace(/\/+$/, '').split('/').at(-1)
  check(
    !!here.title && here.text === name && here.locations === 0 && !here.outside,
    `dossier de la conversation : « ${L('toolCall.command.in')} ${here.text} », chemin entier en infobulle, pas répété dessous`
  )
  check(
    here.copyTop < 6 && here.copyRight < 12 && here.copyBesideWhere,
    `« Copier » en haut à droite de la barre (${here.copyTop.toFixed(1)} px du haut)`
  )
  check((await shownText(ui)) === OPENCODE_COMMAND, 'commande OpenCode : entière, inchangée')
  await ui.shot('F203-a-commande-dossier')
  await accept(ui)

  // Comme OpenCode 2.2.5 (trace réelle) : `workdir: "docs"` RELATIF, l'emplacement absolu.
  await ui.send('/scenario commande-sous-dossier')
  await ui.waitFor(`!!${PRE}`)
  const sub = await commandBar(ui)
  check(
    sub.text === `${name}/docs` && sub.title === `${here.title}/docs` && sub.locations === 0,
    `OpenCode, workdir relatif : « ${L('toolCall.command.in')} ${sub.text} », pas répété dessous (${sub.locations} emplacement)`
  )
  await ui.shot('F203-b-commande-sous-dossier')
  await accept(ui)
  const after = await decidedCommand(ui)
  check(
    after.text === `${name}/docs` && after.locations === 0,
    `OpenCode, workdir relatif, après la décision, dépliée : « ${after.text} », pas répété dessous`
  )
  await ui.shot('F203-b2-commande-sous-dossier-apres')

  await ui.send('/scenario commande-dossier-relatif-sortant')
  await ui.waitFor(`!!${PRE}`)
  const up = await commandBar(ui)
  check(
    up.outside && up.text.startsWith('/') && !up.text.includes('..') && up.locations === 1,
    `OpenCode, workdir « ../.. » : alerte « hors du dossier », chemin entier (« ${up.text} »), emplacement gardé`
  )
  check(
    up.warns.length === 1 &&
      !up.warns[0].text.includes('·') &&
      up.warns[0].lineStart &&
      !up.warns[0].dotShown,
    `mention passée à la ligne : « ${up.warns[0]?.text} » sans « · » en début de ligne`
  )
  await ui.shot('F203-b3-commande-relatif-sortant')
  await accept(ui)

  await ui.send('/scenario commande-sous-dossier-absolu')
  await ui.waitFor(`!!${PRE}`)
  const abs = await commandBar(ui)
  check(
    abs.text === `${name}/src/renderer` &&
      abs.title?.endsWith('/src/renderer') &&
      abs.locations === 0,
    `sous-dossier absolu : « ${L('toolCall.command.in')} ${abs.text} », pas répété dessous`
  )
  await accept(ui)

  await ui.send('/scenario commande-hors-dossier')
  await ui.waitFor(`!!${PRE}`)
  const out = await commandBar(ui)
  check(
    out.text === OUTSIDE_FOLDER && !out.clipped && out.title === null && out.locations === 0,
    'hors du dossier : le chemin entier, jamais coupé (il passe à la ligne dans sa colonne)'
  )
  check(
    out.warns.every((w) => !w.text.includes('·') && w.dotShown === !w.lineStart),
    `hors du dossier : « · » entre les mentions sur une ligne, jamais en début de ligne (${out.warns.map((w) => `${w.lineStart ? '↵' : '·'} ${w.text}`).join(' ')})`
  )
  check(
    out.outside && out.invisible && out.marks === 1,
    'hors du dossier : les deux alertes, l’espace cadratin rendue visible'
  )
  check(
    out.copyTop < 6 && out.copyBesideWhere,
    `hors du dossier : « Copier » reste en haut à droite, sur la première ligne (${out.copyTop.toFixed(1)} px)`
  )
  check(
    (await shownText(ui)) === visibleText(OUTSIDE_COMMAND),
    'hors du dossier : la commande entière, exacte'
  )
  await ui.shot('F203-c-commande-hors-dossier')
  await accept(ui)
}

/**
 * Cartes à risque (fiche 211) : bandeau ambré, pas de « Toujours autoriser » ; une lecture hors du
 * dossier reste une carte ordinaire, avec la note « c'est l'agent qui décide ».
 */
async function riskCards(ui) {
  const card = async () =>
    ui.ev(`(() => {
      const card = ${CARD}
      const banner = card?.querySelector('[data-testid=permission-risks]')
      return {
        lines: banner ? [...banner.querySelectorAll('li')].map((l) => l.textContent) : null,
        kinds: [...(card?.querySelectorAll('.pc-actions button') ?? [])].map((b) => b.dataset.kind),
        agentNote: card?.querySelector('[data-testid=permission-agent-always-note]')?.textContent ?? null
      }
    })()`)
  const reject = async () => {
    await ui.click(`${CARD}.querySelector('.pc-actions button[data-kind=reject_once]')`)
    await ui.waitFor(`!document.querySelector('[data-testid=permission]')`)
    await ui.ready()
  }
  const outside = L('toolCall.permission.risk.outside')

  await ui.send('/scenario commande-ecriture-hors-dossier')
  await ui.waitFor(`!!${PRE}`)
  const write = await card()
  check(
    write.lines?.length === 1 &&
      write.lines[0].startsWith(outside) &&
      write.lines[0].endsWith('/dehors/x.properties'),
    `écriture hors du dossier (commande seule, comme Bob) : bandeau « ${write.lines?.[0]} »`
  )
  check(
    write.kinds.join() === 'allow_once,reject_once' && write.agentNote === null,
    `carte à risque : pas de « Toujours autoriser », pas de note (${write.kinds.join(', ')})`
  )
  check(
    (await shownText(ui)).startsWith('echo "docker.host=unix:///var/run/docker.sock" > /'),
    'écriture hors du dossier : la commande entière reste montrée au-dessus du bandeau'
  )
  await ui.shot('F211-a-ecriture-hors-dossier')
  await reject()

  await ui.send('/scenario commande-sudo')
  await ui.waitFor(`!!${PRE}`)
  const sudo = await card()
  check(
    sudo.lines?.length === 2 &&
      sudo.lines[0] === L('toolCall.permission.risk.privilege', { via: 'sudo' }) &&
      sudo.lines[1] === `${L('toolCall.permission.risk.system')} /var/run/docker.sock`,
    `sudo : une ligne par chemin, la raison la plus précise (« ${sudo.lines?.join(' | ')} »)`
  )
  check(!sudo.kinds.includes('allow_always'), 'sudo : pas de « Toujours autoriser »')
  await ui.shot('F211-b-sudo')
  await reject()

  await ui.send('/scenario commande-lecture-hors-dossier')
  await ui.waitFor(`!!${PRE}`)
  const read = await card()
  check(
    read.lines === null && read.kinds.includes('allow_always'),
    'lecture hors du dossier : aucun bandeau, « Toujours autoriser » offert'
  )
  check(
    read.agentNote === L('toolCall.permission.agentAlwaysNote'),
    `lecture : la note « ${read.agentNote} » sous les boutons`
  )
  await ui.shot('F211-c-lecture-hors-dossier')
  await accept(ui)

  await ui.send('/scenario ecriture-hors-dossier')
  await ui.waitFor(`!!${CARD}?.querySelector('[data-testid=permission-risks]')`)
  const edit = await card()
  check(
    edit.lines?.length === 1 &&
      edit.lines[0].startsWith(outside) &&
      edit.lines[0].endsWith('/dehors/outil.toml') &&
      !edit.kinds.includes('allow_always'),
    `modification hors du dossier (outil edit, comme Bob) : « ${edit.lines?.[0]} »`
  )
  await ui.shot('F211-d-modification-hors-dossier')
  await reject()
}

/** La dernière commande, après la décision, dépliée : son dossier et ses emplacements. */
async function decidedCommand(ui) {
  const tool = `[...document.querySelectorAll('details.tool')].at(-1)`
  await ui.click(`${tool}.querySelector('summary')`)
  await ui.waitFor(`!!${tool}.querySelector('[data-testid=command-cwd-text]')`)
  return ui.ev(`(() => {
    const tool = ${tool}
    return {
      text: tool.querySelector('[data-testid=command-cwd-text]').textContent,
      locations: tool.querySelectorAll('.tool-location').length
    }
  })()`)
}

/**
 * Nom long dans un sous-dossier (fiche 203, recette réelle) : sur la ligne d'outil, le dossier est
 * coupé d'abord ; le nom ne l'est que s'il ne tient pas seul. Rend les mesures de la dernière
 * ligne d'outil.
 */
const titleLine = (ui) =>
  ui.ev(`(() => {
    const tool = [...document.querySelectorAll('[data-testid=tool]')].at(-1)
    const title = tool.querySelector('.tool-title').getBoundingClientRect()
    const label = tool.querySelector('[data-testid=tool-label]')
    const name = label.querySelector('[data-testid=tool-label-name]')
    const dir = label.querySelector('.tool-file-dir')
    const n = name.getBoundingClientRect()
    return {
      text: label.textContent,
      name: name.textContent,
      nameCut: name.scrollWidth > name.clientWidth + 1,
      nameInside: n.right <= title.right + 1 && n.width > 0,
      dirCut: !!dir && dir.scrollWidth > dir.clientWidth + 1,
      dirWidth: dir ? dir.getBoundingClientRect().width : 0,
      // Coupé, le dossier montre « … » : jamais un « / » seul devant le nom.
      dirShown: !dir || dir.getBoundingClientRect().width >= 12,
      dirPresent: !!dir
    }
  })()`)

/**
 * Rétrécit la dernière carte d'outil pour que sa ligne laisse au libellé exactement le texte
 * d'avant + le nom + `extra` px (mesurés dans la page, indépendants des polices) ; le badge
 * « autorisation requise » reste à sa place naturelle. `null` : largeur rendue.
 */
async function squeezeTitle(ui, extra) {
  await ui.ev(`(() => {
    const tool = [...document.querySelectorAll('[data-testid=tool]')].at(-1)
    if (${extra === null}) return (tool.style.width = '')
    const title = tool.querySelector('.tool-title')
    const label = title.querySelector('[data-testid=tool-label]')
    const text = [...label.querySelectorAll('.tool-file-text')].reduce((w, e) => w + e.scrollWidth, 0)
    const name = label.querySelector('[data-testid=tool-label-name]').scrollWidth
    const delta = title.clientWidth - (text + name + ${extra ?? 0})
    tool.style.width = tool.getBoundingClientRect().width - delta + 'px'
    return true
  })()`)
  // Le temps que la ligne se mesure de nouveau (ResizeObserver) et se redessine.
  await new Promise((resolve) => setTimeout(resolve, 300))
}

/** Mesures de l'en-tête du diff de la carte en attente. */
const fileHeader = (ui) =>
  ui.ev(`(() => {
    const card = ${CARD}
    const tool = card.closest('[data-testid=tool]')
    const header = card.querySelector('.diff-header').getBoundingClientRect()
    const path = card.querySelector('[data-testid=diff-path]')
    const dir = path.querySelector('.diff-path-dir')
    const name = path.querySelector('.diff-path-name')
    const stats = card.querySelector('.diff-stats').getBoundingClientRect()
    return {
      label: tool.querySelector('[data-testid=tool-label]')?.textContent,
      icon: !!tool.querySelector('.tool-row .lucide-file-plus'),
      question: card.querySelector('.pc-title').textContent,
      title: path.getAttribute('title'),
      dir: dir?.textContent ?? '',
      dirCut: !!dir && dir.scrollWidth > dir.clientWidth + 1,
      name: name.textContent,
      nameCut: name.scrollWidth > name.clientWidth + 1,
      statsInside: stats.right <= header.right + 1 && stats.width > 0,
      badge: card.querySelector('.diff-badge')?.textContent ?? null
    }
  })()`)

/**
 * Carte « fichier » (fiche 203) : chemin relatif au dossier, création dite comme une création,
 * chemins longs (début coupé, nom entier, chemin entier en infobulle).
 */
async function fileCards(ui, suffix) {
  await ui.send('/scenario creation-fichier')
  await ui.waitFor(`!!${CARD}?.querySelector('[data-testid=diff-path]')`)
  const created = await fileHeader(ui)
  check(
    created.label === L('toolCall.label.create', { target: 'notes.md' }) &&
      created.icon &&
      created.question === L('toolCall.permission.question.create'),
    `création : « ${created.label} », icône « fichier + », « ${created.question} »`
  )
  check(
    created.dir === '' &&
      created.name === 'notes.md' &&
      created.title?.endsWith('/notes.md') &&
      created.badge === L('diff.newFile'),
    'création : « notes.md » seul dans l’en-tête, chemin entier en infobulle, badge « nouveau fichier »'
  )
  await ui.shot(`F203-d-creation${suffix}`)
  await accept(ui)

  await ui.send('/scenario creation-sous-dossier')
  await ui.waitFor(`!!${CARD}?.querySelector('[data-testid=diff-path]')`)
  const deep = await fileHeader(ui)
  check(
    deep.dir === 'src/renderer/src/components/thread/' &&
      deep.name === 'notes.md' &&
      !deep.nameCut &&
      deep.statsInside,
    `sous-dossier : « ${deep.dir} » grisé${deep.dirCut ? ' (début coupé)' : ''}, « notes.md » entier`
  )
  await ui.shot(`F203-e-creation-sous-dossier${suffix}`)
  await accept(ui)

  await ui.send('/scenario modification-hors-dossier')
  await ui.waitFor(`!!${CARD}?.querySelector('[data-testid=diff-path]')`)
  const outside = await fileHeader(ui)
  check(
    outside.label?.startsWith(L('toolCall.label.edit', { target: '' }).trim()) &&
      outside.question === L('toolCall.permission.question.edit') &&
      outside.dir === '~/Dev/autre-projet/packages/very-long-package-name/src/' &&
      outside.name === 'configuration-par-defaut.ts' &&
      !outside.nameCut &&
      outside.statsInside &&
      outside.title === OUTSIDE_FILE &&
      outside.badge === null,
    `hors du dossier : en « ~ »${outside.dirCut ? ', début coupé' : ''}, nom entier, compteurs visibles, chemin entier en infobulle`
  )
  if (suffix) check(outside.dirCut, 'hors du dossier, carte serrée : le début du chemin est coupé')
  await ui.shot(`F203-f-modification-hors-dossier${suffix}`)
  await accept(ui)

  await ui.send('/scenario creation-sous-dossier-nom-long')
  await ui.waitFor(`!!${CARD}?.querySelector('[data-testid=diff-path]')`)
  const longName = LONG_NAME_IN_FOLDER.split('/').at(-1)
  // Fenêtre normale : la ligne ramenée à « Création de » + le nom + 24 px (mesurés dans la page,
  // indépendants des polices) — trop étroite pour tout le libellé, assez large pour le nom seul.
  if (!suffix) await squeezeTitle(ui, 24)
  const line = await titleLine(ui)
  if (suffix) {
    // Carte serrée : le nom seul ne tient pas ; le dossier a déjà cédé toute sa place.
    check(
      line.name === longName && (!line.nameCut || line.dirWidth < 20) && line.dirShown,
      `ligne d’outil serrée : le dossier cède d’abord (${line.dirWidth.toFixed(0)} px), puis le nom${line.nameCut ? ' (coupé à la fin)' : ''}`
    )
  } else {
    check(
      line.name === longName && !line.nameCut && line.nameInside && line.dirCut && line.dirShown,
      `ligne d’outil : « ${longName} » entier, extension visible${line.dirCut ? ', le dossier coupé d’abord (« … » visible)' : ''}`
    )
  }
  await ui.shot(`F203-h-titre-nom-long${suffix}`)
  if (!suffix) {
    // Recette réelle (fenêtre de 1280 px, panneau ouvert) : le nom tient seul, mais pas avec
    // « …/ » devant. Le dossier n'est alors pas affiché du tout : le nom entier, pas de « / » seul.
    await squeezeTitle(ui, 6)
    const exact = await titleLine(ui)
    check(
      exact.name === longName &&
        !exact.nameCut &&
        exact.nameInside &&
        !exact.dirPresent &&
        exact.text === L('toolCall.label.create', { target: longName }),
      `ligne d’outil, le nom tient seul (pas avec « …/ ») : « ${exact.text} », extension visible, dossier effacé`
    )
    await ui.shot('F203-j-titre-nom-tient-seul')
    await squeezeTitle(ui, null)
  }
  await accept(ui)
  await changesRow(ui, longName, suffix)

  await ui.send('/scenario creation-nom-tres-long')
  await ui.waitFor(`!!${CARD}?.querySelector('[data-testid=diff-path]')`)
  const long = await fileHeader(ui)
  check(
    long.name === LONG_FILE_NAME && long.nameCut && long.statsInside && !!long.badge,
    'nom seul plus large que la carte : coupé à la fin, badge et compteurs visibles'
  )
  await ui.shot(`F203-g-nom-tres-long${suffix}`)
  await accept(ui)
}

/** Libellé de la ligne de la dernière carte d'outil (après la décision). */
const lastToolLabel = (ui) =>
  ui.ev(
    `[...document.querySelectorAll('[data-testid=tool]')].at(-1)?.querySelector('[data-testid=tool-label]')?.textContent ?? ''`
  )

/**
 * Écriture de Bob 2.0.9 (fiche 203, recette réelle, trace `bob-2.0.9/creation-fichier-neuf-…`) :
 * diff `oldText: ""` pour un fichier neuf comme pour un fichier vide existant. L'app a regardé le
 * disque quand Bob l'a proposé : « Création » pour le neuf, avant comme après l'écriture ;
 * « Modification » pour le vide existant. Une seule fois : le fichier existe ensuite.
 */
async function bobFileCards(ui) {
  const create = L('toolCall.label.create', { target: '' }).trim()
  const edit = L('toolCall.label.edit', { target: '' }).trim()
  await ui.send('/scenario creation-bob')
  await ui.waitFor(`!!${CARD}?.querySelector('[data-testid=diff-path]')`)
  const asked = await fileHeader(ui)
  check(
    asked.label?.startsWith(create) &&
      asked.label.endsWith('alpha.txt') &&
      asked.icon &&
      asked.question === L('toolCall.permission.question.create') &&
      asked.badge === L('diff.newFile'),
    `Bob, fichier neuf (oldText "") : « ${asked.label} », « ${asked.question} », badge « nouveau fichier »`
  )
  await ui.shot('F203-k-creation-bob')
  await accept(ui)
  const after = await lastToolLabel(ui)
  check(
    after.startsWith(create) && after.endsWith('alpha.txt'),
    `Bob, fichier neuf, écrit depuis : la ligne dit toujours « ${after} »`
  )

  await ui.send('/scenario modification-fichier-vide-bob')
  await ui.waitFor(`!!${CARD}?.querySelector('[data-testid=diff-path]')`)
  const empty = await fileHeader(ui)
  check(
    empty.label?.startsWith(edit) &&
      empty.label.endsWith('vide.txt') &&
      !empty.icon &&
      empty.question === L('toolCall.permission.question.edit') &&
      empty.badge === null,
    `Bob, fichier vide existant (même forme) : « ${empty.label} », pas de badge`
  )
  await ui.shot('F203-l-fichier-vide-bob')
  await accept(ui)
  const emptyAfter = await lastToolLabel(ui)
  check(emptyAfter.startsWith(edit), `Bob, fichier vide existant, après : « ${emptyAfter} »`)
}

/**
 * Modifications › Conversation (fiche 203, recette réelle) : la ligne du fichier au nom long garde
 * le nom entier (extension visible), le dossier est coupé d'abord ; puis le panneau est refermé
 * s'il l'était.
 */
async function changesRow(ui, name, suffix) {
  const panelOpen = await ui.ev(`!!${ui.$('side-panel')}`)
  await ui.waitFor(`!!${ui.$('changes-toggle')}`)
  if (!(await ui.ev(`!!${ui.$('changes-tab')}`))) await ui.click(ui.$('changes-toggle'))
  await ui.waitFor(`!!${ui.$('changes-tab')}`)
  const row = `[...document.querySelectorAll('[data-testid=changes-file]')].find((f) => f.querySelector('.changes-name')?.textContent === ${JSON.stringify(name)})`
  await ui.waitFor(`!!${row}`)
  // Chaque ligne : le dossier cède toute sa place avant que le nom soit coupé ; le chevron
  // garde sa taille.
  const rows =
    await ui.ev(`[...document.querySelectorAll('[data-testid=changes-file]')].map((row) => {
    const name = row.querySelector('.changes-name')
    const dir = row.querySelector('.changes-dir')
    return {
      name: name.textContent,
      nameCut: name.scrollWidth > name.clientWidth + 1,
      dirWidth: dir.textContent ? dir.getBoundingClientRect().width : 0,
      chevron: row.querySelector('.changes-toggle > svg').getBoundingClientRect().width
    }
  })`)
  const wrong = rows.filter((r) => (r.nameCut && r.dirWidth >= 1) || r.chevron < 13)
  check(
    rows.some((r) => r.name === name) && wrong.length === 0,
    `Modifications : le dossier coupé d’abord, le nom ensuite, chevrons entiers (${rows.map((r) => `${r.name}${r.nameCut ? ' coupé' : ''}`).join(', ')})${wrong.length ? ` — en défaut : ${JSON.stringify(wrong)}` : ''}`
  )
  if (!suffix) {
    // Un nom qui tient seul (fichier hors du dossier) : entier, extension visible.
    const config = rows.find((r) => r.name === 'configuration-par-defaut.ts')
    check(
      !!config && !config.nameCut,
      'Modifications : « configuration-par-defaut.ts » entier, son dossier coupé'
    )
  }
  await ui.shot(`F203-i-modifications-nom-long${suffix}`)
  if (!panelOpen) await ui.closePanel()
}

const CARD = `[...document.querySelectorAll('[data-testid=permission]')].at(-1)`
const PRE = `${CARD}?.querySelector('[data-testid=command-text]')`
/** Le bloc défile jusqu'à `top` (`'end'` : tout en bas). */
const scrollPre = (ui, top) =>
  ui.ev(
    `(() => { const pre = ${PRE}; pre.scrollTop = ${top === 'end' ? 'pre.scrollHeight' : top}; return true })()`
  )

/** Texte affiché dans le bloc de la commande, lignes jointes par `\n`. */
const shownText = (ui) =>
  ui.ev(`[...${PRE}.querySelectorAll('.cmd-lt')].map((l) => l.textContent).join('\\n')`)

/**
 * Demande la commande du scénario, vérifie la carte (texte entier, fin visible ou atteignable dans
 * la carte, pas de défilement horizontal, focus libre), capture, puis accepte.
 */
async function askAndCheck(ui, scenario, command, shot) {
  await ui.send(`/scenario ${scenario}`)
  await ui.waitFor(`!!${PRE}`)
  const shown = await ui.ev(
    `[...${PRE}.querySelectorAll('.cmd-lt')].map((l) => l.textContent).join('\\n')`
  )
  check(shown === command, `${scenario} : la commande entière, brute, dans la carte`)
  const focus = await ui.ev(
    `!${CARD}.contains(document.activeElement) || document.activeElement === document.body`
  )
  check(focus, `${scenario} : aucun bouton de la carte n'a pris le focus`)
  const wide = await ui.ev(`(() => {
    const pre = ${PRE}
    const card = ${CARD}
    const thread = document.querySelector('[data-testid=thread]')
    return pre.scrollWidth <= pre.clientWidth + 1 && card.getBoundingClientRect().right <= thread.getBoundingClientRect().right + 1
  })()`)
  check(wide, `${scenario} : pas de défilement horizontal, la carte tient dans le fil`)
  const scrolls = await ui.ev(`${PRE}.scrollHeight > ${PRE}.clientHeight + 2`)
  if (scrolls) {
    const lines = command.split('\n').length
    check(
      (await ui.ev(`${CARD}.querySelector('[data-testid=command-more]')?.innerText`)) ===
        L('toolCall.command.scroll', { count: lines, n: String(lines) }),
      `${scenario} : la carte annonce les ${lines} lignes à faire défiler`
    )
  }
  await ui.shot(shot)
  // La fin de la commande : visible dans la carte, après défilement dans la carte s'il le faut.
  await scrollPre(ui, 'end')
  await ui.ev(`${CARD}.scrollIntoView({ block: 'end' })`)
  const endVisible = await ui.ev(`(() => {
    const pre = ${PRE}
    const last = [...pre.querySelectorAll('.cmd-lt')].at(-1)
    const r = last.getBoundingClientRect()
    const box = pre.getBoundingClientRect()
    const scroller = document.querySelector('[data-testid=thread]').closest('.scroll').getBoundingClientRect()
    return r.height > 0 && r.top >= box.top - 1 && r.bottom <= box.bottom + 1 && r.top >= scroller.top - 1 && r.bottom <= scroller.bottom + 1
  })()`)
  const lastLine = command.split('\n').at(-1)
  check(
    endVisible,
    `${scenario} : la fin de la commande (« ${lastLine.slice(-30)} ») est à l'écran avant d'accepter`
  )
  if (scrolls) {
    // La molette au bout du bloc ne fait pas défiler le fil (overscroll-behavior: contain) :
    // bloc en haut, molette vers le haut, alors que le fil peut remonter.
    const scroller = `document.querySelector('[data-testid=thread]').closest('.scroll')`
    await scrollPre(ui, 0)
    const before = await ui.ev(`${scroller}.scrollTop`)
    const at = await ui.center(PRE)
    await ui.wheel(at, 0, -400)
    await ui.wheel(at, 0, -400)
    await new Promise((resolve) => setTimeout(resolve, 300))
    check(
      before > 0 && (await ui.ev(`${scroller}.scrollTop`)) === before,
      `${scenario} : la molette au bout du bloc ne fait pas défiler le fil (fil à ${before} px)`
    )
    await scrollPre(ui, 0)
  }
  if (command.includes('/tmp/build-2291') || scenario === 'commande-tres-longue') {
    check(
      await ui.ev(`!!${CARD}.querySelector('[data-testid=command-outside]')`),
      `${scenario} : dossier hors de celui de la conversation signalé`
    )
  }
  await ui.click(`[...${CARD}.querySelectorAll('.pc-actions button')][0]`)
  await ui.waitFor(`!document.querySelector('[data-testid=permission]')`)
  await ui.ready()
}
