import { execFileSync } from 'node:child_process'
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { L, check, withApp } from '../lib.mjs'

/**
 * Historique de la saisie (fiche 227), contre l'agent factice, dans un dépôt git jetable (un
 * message à un rôle lance une fille dans un worktree) :
 * - trois messages : un long d'une ligne (replié à l'affichage), un de plusieurs lignes, un pour
 *   le rôle `security-expert` (jeton posé par le menu `@`) ;
 * - rappel « ↑ Messages précédents » ; ↑ ↑ ↑, pastille « n/3 », jeton et ligne « Sera confié à… » ;
 * - lignes d'abord (replis compris), curseur à l'arrivée, bornes ;
 * - modification → brouillon ; Échap vide avant d'arrêter la réponse ; la fille commence par sa
 *   consigne ; le rappel s'efface après trois utilisations.
 */
export async function historiqueSaisieSuite(scheme) {
  console.log(`\n— Historique de la saisie (${scheme})`)
  const workspace = realpathSync(mkdtempSync(join(tmpdir(), 'bob-e2e-historique-')))
  const git = (...args) =>
    execFileSync('git', ['-c', 'user.name=e2e', '-c', 'user.email=e2e@example.invalid', ...args], {
      cwd: workspace
    })
  writeFileSync(join(workspace, 'README.md'), '# Boutique\n')
  git('init', '-q', '-b', 'main')
  git('add', '.')
  git('commit', '-q', '-m', 'init')
  try {
    await withApp(scheme, (ui) => run(ui), undefined, 'streaming-texte', {
      BOBINE_WORKSPACE: workspace
    })
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
}

const input = `document.querySelector('[data-testid="composer-input"]')`

/**
 * Invite et rappel « ↑ Messages précédents » sur la première ligne de la saisie : bord droit du
 * texte (marge réservée exclue), bord gauche du rappel, nom du rappel visible ou non, invite
 * entière (la saisie a sa hauteur).
 */
const hintLayout = `(() => {
  const input = ${input}
  const hint = document.querySelector('[data-testid="history-hint"]')
  if (!hint) return null
  const box = input.getBoundingClientRect()
  const style = getComputedStyle(input)
  const px = (v) => parseFloat(v) || 0
  const label = hint.querySelector('.sent-history-hint-label').getBoundingClientRect()
  return {
    composer: Math.round(document.querySelector('.composer').getBoundingClientRect().width),
    textRight: box.right - px(style.paddingRight) - px(style.borderRightWidth),
    hintLeft: hint.getBoundingClientRect().left,
    label: label.width > 2,
    title: hint.title,
    whole: input.clientHeight >= input.scrollHeight - 1,
    placeholder: input.placeholder
  }
})()`

/**
 * Pendant une réponse, la saisie vide (invite « Ajouter une suite (envoyée à la fin de la
 * réponse)… ») : à 760 et 640 px, le rappel réduit à « ↑ », l'invite entière (sur deux lignes
 * à 640 px) ; à 1280 px panneau ouvert, le rappel entier. Jamais l'un sur l'autre (maquette rc4).
 */
async function narrowComposer(ui, focus) {
  await ui.send('/scenario lent')
  await ui.waitFor(`!!${ui.$('stop')}`)
  const cases = [
    { width: 760, panel: false, label: false, shot: 'historique-5-saisie-760' },
    // Plus étroite encore : l'invite ne tient plus sur une ligne, elle passe à la ligne, entière.
    { width: 640, panel: false, label: false, shot: 'historique-5b-saisie-640' },
    { width: 1280, panel: true, label: true, shot: 'historique-6-saisie-1280-panneau' }
  ]
  // Panneau ouvert d'office sur « Session » (fiche 166) : l'app le replie faute de place à 760 px
  // et le rouvre d'elle-même à 1280 px (fiche 173) ; l'état mémorisé suit ce qui est affiché.
  await ui.waitFor(`!!${ui.$('side-panel')}`)
  const panelShown = `!!${ui.$('side-panel')} && JSON.parse(localStorage.getItem('bobine.panel')).open === true`
  const panelFolded = `!${ui.$('side-panel')} && JSON.parse(localStorage.getItem('bobine.panel')).open === false`
  for (const c of cases) {
    await ui.viewport(c.width)
    await ui.waitFor(c.panel ? panelShown : panelFolded)
    if (c.panel) {
      // Glissé d'arrivée du panneau fini (la roue de la réponse, infinie, est sur un enfant).
      await ui.waitFor(
        `${ui.$('side-panel')}.getAnimations().every((a) => a.playState !== 'running')`
      )
      await ui.frames()
    }
    await focus()
    await ui.waitFor(`!!document.querySelector('[data-testid=history-hint]')`)
    await ui.frames()
    const at = await ui.ev(hintLayout)
    check(
      at.placeholder === L('composer.placeholder.busy') &&
        at.hintLeft - at.textRight >= 8 &&
        at.whole &&
        at.label === c.label &&
        at.title === L('composer.history.hint'),
      `${c.width} px${c.panel ? ' panneau ouvert' : ''} (saisie ${at.composer} px) : invite et rappel disjoints (8 px au moins), ` +
        `${c.label ? 'rappel entier' : 'rappel « ↑ » seul, nom en infobulle'}, invite entière ` +
        JSON.stringify(at)
    )
    await ui.shot(c.shot)
    if (c.panel) {
      // Un seul appui ferme le panneau que l'app a rouvert : affiché et mémorisé fermés.
      await ui.ev(`${ui.$('panel-toggle')}.click()`)
      await ui.waitFor(panelFolded)
    }
  }
  await ui.viewport()
  // La réponse s'arrête : l'essai d'Échap qui suit repart d'une saisie au repos.
  await ui.ev(`${ui.$('stop')}?.click()`)
  await ui.ready()
  await focus()
}
const LONG =
  'Le test du panier vide échoue sur Android : regarde pourquoi le bouton Payer reste actif après la suppression du dernier article, puis vérifie que le total revient bien à zéro et que la bannière de promotion disparaît aussi.'
const PLAN = [
  'Plan pour le paiement en un clic :',
  '1. createPaymentIntent côté serveur, avec un identifiant d’idempotence pour ne jamais débiter deux fois le même client.',
  '2. Montre-moi le diff avant de toucher à l’app.'
].join('\n')
const ROLE_TEXT = 'relis le diff du paiement : stockage du jeton, journaux, appels au prestataire.'

async function run(ui) {
  await ui.ready()
  const value = () => ui.ev(`${input}.value`)
  const caret = () => ui.ev(`${input}.selectionStart`)
  const pill = () => ui.ev(`document.querySelector('[data-testid=history-pill]')?.innerText ?? ''`)
  const hint = () => ui.ev(`!!document.querySelector('[data-testid=history-hint]')`)
  const focus = () => ui.ev(`${input}.focus()`)

  // Conversation neuve : pas d'historique, pas de rappel ; ↑ ne fait rien.
  await focus()
  check(!(await hint()), 'conversation neuve : pas de rappel « ↑ Messages précédents »')
  await ui.arrow('ArrowUp')
  check((await value()) === '' && !(await pill()), 'conversation neuve : ↑ ne fait rien')

  // Trois messages : long (replié), plusieurs lignes, pour un rôle (jeton du menu `@`).
  await ui.send(LONG)
  await ui.ready()
  await ui.send(PLAN)
  await ui.ready()
  await focus()
  await ui.type(`${ROLE_TEXT} @secu`)
  await ui.waitFor(
    `document.querySelector('[data-testid=role-item]')?.dataset.role === 'security-expert'`
  )
  await ui.enter()
  await ui.waitFor(`!!${ui.$('role-token')}`)
  await ui.enter()
  await ui.waitFor(
    `!!document.querySelector('[data-testid=work-card][data-role=security-expert]')`,
    30000
  )
  await ui.waitFor(`${input}.value === '' && !${ui.$('role-token')}`)

  // Rappel dans la saisie vide, avec le focus.
  await focus()
  await ui.waitFor(`!!document.querySelector('[data-testid=history-hint]')`)
  check(
    (await ui.ev(`${ui.$('history-hint')}.innerText`)).includes(L('composer.history.hint')),
    'saisie vide : rappel « ↑ Messages précédents »'
  )
  await ui.shot('historique-1-rappel')

  // ↑ : le dernier envoyé, avec son jeton et sa ligne « Sera confié à… ».
  await ui.arrow('ArrowUp')
  await ui.waitFor(`!!${ui.$('history-pill')}`)
  check(
    (await value()).startsWith(ROLE_TEXT.slice(0, 20)) &&
      (await pill()).includes(L('composer.history.position', { index: 3, count: 3 })) &&
      (await ui.ev(`${ui.$('role-token')}?.dataset.role`)) === 'security-expert' &&
      (await ui.ev(`!!${ui.$('role-destination')}`)),
    '↑ : le dernier envoyé (3/3), jeton du rôle et ligne « Sera confié à… » repris'
  )
  check(
    (await ui.ev(`${ui.$('history-announce')}.textContent`)) ===
      L('composer.history.announce', { index: 3, count: 3 }),
    'position annoncée poliment'
  )
  check(!(await ui.ev(`!!${ui.$('command-menu')} || !!${ui.$('file-menu')}`)), 'aucun menu ouvert')
  await ui.shot('historique-2-jeton-role')

  // ↑ : le message de plusieurs lignes, curseur en fin de première ligne, champ en haut.
  await ui.arrow('ArrowUp')
  await ui.waitFor(`${input}.value === ${JSON.stringify(PLAN)}`)
  check(
    (await pill()).includes(L('composer.history.position', { index: 2, count: 3 })) &&
      (await caret()) === PLAN.indexOf('\n') &&
      (await ui.ev(`${input}.scrollTop`)) === 0 &&
      !(await ui.ev(`!!${ui.$('role-token')}`)),
    '↑ : 2/3, curseur en fin de première ligne, champ remonté, jeton retiré'
  )
  await ui.shot('historique-3-plusieurs-lignes')

  // Lignes d'abord : ↓ descend d'une ligne sans changer de message, ↑ remonte.
  await ui.arrow('ArrowDown')
  check(
    (await value()) === PLAN &&
      (await caret()) > PLAN.indexOf('\n') &&
      (await pill()).includes(L('composer.history.position', { index: 2, count: 3 })),
    'lignes d’abord : ↓ depuis la ligne 1 descend d’une ligne, même message'
  )
  await ui.arrow('ArrowUp')
  check(
    (await value()) === PLAN && (await caret()) <= PLAN.indexOf('\n'),
    'lignes d’abord : ↑ remonte en ligne 1, même message'
  )

  // ↑ : le long message d'une ligne, replié à l'affichage : curseur en fin de première ligne
  // affichée (avant la fin du texte).
  await ui.arrow('ArrowUp')
  await ui.waitFor(`${input}.value === ${JSON.stringify(LONG)}`)
  const wrapEnd = await caret()
  check(
    wrapEnd > 20 && wrapEnd < LONG.length,
    `ligne repliée : curseur en fin de première ligne affichée (${wrapEnd} / ${LONG.length})`
  )
  // ↑ sur 1/3 : rien. ↓ descend dans la ligne repliée (replis comptés), même message.
  await ui.arrow('ArrowUp')
  check(
    (await value()) === LONG &&
      (await pill()).includes(L('composer.history.position', { index: 1, count: 3 })),
    '↑ sur 1/3 : rien, pas de boucle'
  )
  await ui.arrow('ArrowDown')
  check(
    (await value()) === LONG && (await caret()) > wrapEnd,
    'replis comptés : ↓ descend dans la même ligne réelle, même message'
  )
  await ui.arrow('ArrowUp')
  check(
    (await value()) === LONG &&
      (await caret()) <= wrapEnd &&
      (await pill()).includes(L('composer.history.position', { index: 1, count: 3 })),
    'replis comptés : ↑ depuis la 2e ligne affichée remonte, sans changer de message'
  )
  // ↓ jusqu'à la dernière ligne affichée, puis au message suivant (curseur en fin de texte).
  for (let i = 0; i < 6 && (await value()) === LONG; i++) await ui.arrow('ArrowDown')
  check(
    (await value()) === PLAN && (await caret()) === PLAN.length,
    '↓ depuis la dernière ligne : message suivant, curseur en fin de texte'
  )

  // Modification : brouillon ordinaire, la pastille s'en va, les flèches ne changent plus de message.
  await ui.type(' Et ajoute les tests.')
  await ui.waitFor(`!${ui.$('history-pill')}`)
  await ui.ev(`${input}.setSelectionRange(3, 3)`)
  await ui.arrow('ArrowUp')
  check(
    (await value()) === `${PLAN} Et ajoute les tests.` && !(await pill()),
    'message modifié : plus de pastille, ↑ en ligne 1 ne change plus de message'
  )
  await ui.shot('historique-4-modification')

  // Échap : vide la saisie et quitte l'historique, avant d'arrêter la réponse.
  await ui.ev(`${input}.select(); document.execCommand('delete')`)
  await ui.waitFor(`${input}.value === ''`)
  // Saisie étroite (maquette rc4, variante 1) : pendant une réponse, l'invite longue et le rappel.
  // Sa commande est la même que la suivante : l'historique n'en garde qu'une.
  await narrowComposer(ui, focus)
  await ui.send('/scenario lent')
  await ui.waitFor(`!!${ui.$('stop')}`)
  await focus()
  await ui.arrow('ArrowUp')
  await ui.waitFor(`${input}.value === '/scenario lent'`)
  check(
    (await pill()).includes(L('composer.history.position', { index: 4, count: 4 })) &&
      !(await ui.ev(`!!${ui.$('command-menu')}`)),
    'commande reprise telle que tapée (4/4), menu « / » fermé'
  )
  await ui.press('Escape')
  await ui.waitFor(`${input}.value === '' && !${ui.$('history-pill')}`)
  check(await ui.ev(`!!${ui.$('stop')}`), 'Échap : saisie vidée, la réponse continue')
  await ui.press('Escape')
  await ui.ready()
  check(!(await ui.ev(`!!${ui.$('stop')}`)), 'second Échap : la réponse s’arrête')

  // Trois utilisations : le rappel s'efface pour de bon.
  await focus()
  await ui.arrow('ArrowUp')
  await ui.press('Escape')
  await ui.waitFor(`${input}.value === ''`)
  check(!(await hint()), 'après trois utilisations, plus de rappel')

  // La fille : son historique commence par sa consigne, sans rien de la mère.
  await ui.ev(`${ui.$('work-open')}.click()`)
  await ui.waitFor(`!!${ui.$('role-title-badge')}`)
  await ui.waitFor(`${input} && !${input}.disabled`)
  await focus()
  await ui.arrow('ArrowUp')
  await ui.waitFor(`!!${ui.$('history-pill')}`)
  check(
    (await value()).startsWith(ROLE_TEXT.slice(0, 20)) &&
      (await pill()).includes(L('composer.history.position', { index: 1, count: 1 })),
    'fille : son historique commence par sa consigne (1/1)'
  )
  await ui.press('Escape')
}
