import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { L, check, withApp } from '../lib.mjs'

/**
 * Corrections de la recette du 20 novembre (fiche 267), dans un dépôt sans commit et non propre
 * (le cas de la recette) :
 * - N3 : quota gratuit épuisé (`-32603` « Free usage limit reached… » d'OpenCode 2.3.0, scénario
 *   `quota-gratuit`) → la carte « Le modèle … n'a pas répondu », raison et « Choisir un autre
 *   modèle », jamais l'erreur brute ; un autre modèle renvoie le message ;
 * - N5 : rôle choisi au menu `@`, demande tapée, Entrée aussitôt (puis une seconde) : une bulle, un
 *   travail, la saisie vide — jamais vidée sans envoi ;
 * - N4 : l'activité d'un travail qui lance une commande de dix lignes tient sur une ligne, la
 *   commande entière en infobulle (scénario `commande-longue`) ;
 * - N8 : le quota d'un travail épuisé : sa carte le dit, et l'on change le modèle **du travail**
 *   depuis elle.
 * Captures `267-quota-*`, `267-activite-commande`.
 */
export async function travailRecetteSuite(scheme) {
  console.log(`\n— Recette du 20 novembre : quota, saisie avec un rôle, activité (${scheme})`)
  const workspace = mkdtempSync(join(tmpdir(), 'bob-e2e-recette-267-'))
  execFileSync('git', ['init', '-q', '-b', 'master'], { cwd: workspace })
  writeFileSync(join(workspace, 'index.html'), '<h1>Courses</h1>\n')
  try {
    await withApp(scheme, quotaRun, undefined, 'quota-gratuit', { BOBINE_WORKSPACE: workspace })
    await withApp(scheme, workRun, undefined, 'echo', { BOBINE_WORKSPACE: workspace })
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
}

const input = `document.querySelector('[data-testid="composer-input"]')`

/** N3 : la conversation affichée, son modèle gratuit à court de quota. */
async function quotaRun(ui) {
  await ui.ready()
  await ui.send('Ajoute un test pour la liste')
  await ui.waitFor(`!!${ui.$('blocker-auth')}`, 30000)
  check(
    !(await ui.ev(
      `document.querySelector('.scroll').innerText.includes(${JSON.stringify(L('agentHost.modelQuota', { model: 'Factice rapide', agent: L('profiles.mock.label') }).slice(0, 30))})`
    )),
    'pas d’avis en double dans le fil tant que la carte est là'
  )
  await ui.shot('267-quota-carte')
  await ui.click(ui.$('auth-choose-model'))
  await ui.waitFor(`!!${ui.$('control-model-factice-precis')}`)
  await ui.click(ui.$('control-model-factice-precis'))
  await ui.waitFor(`!${ui.$('blocker-auth')}`, 30000)
  await ui.ready()
}

/** N5, N4 et N8 : des travaux confiés à un rôle depuis la saisie. */
async function workRun(ui) {
  await ui.ready()
  await ui.send('Bonjour')
  await ui.ready()

  // N5 : le rôle choisi au menu `@` (Entrée), la demande tapée, Entrée aussitôt, deux fois.
  await ui.ev(`${input}.focus()`)
  await ui.type('@ux')
  await ui.waitFor(`!!${ui.$('role-item')}`)
  await ui.enter()
  await ui.waitFor(`${ui.$('role-token')}?.dataset.role === 'ux-ui-expert'`)
  await ui.type('Calcule les contrastes des couleurs.\n/scenario commande-longue')
  await ui.enter()
  await ui.enter()
  const card = `document.querySelector('[data-testid=work-card][data-role=ux-ui-expert]')`
  await ui.waitFor(`!!${card}`, 30000)

  // N4 : la commande de dix lignes, sur une ligne, l'entière en infobulle.
  const live = `${card}.querySelector('[data-testid=work-live-text]')`
  await ui.waitFor(
    `${live}?.innerText.includes(${JSON.stringify(L('workCard.script', { program: 'node', count: 9 }))})`,
    30000
  )
  await ui.reveal(card)
  await ui.shot('267-activite-commande')
  await ui.waitFor(`${card}?.dataset.state === 'replied'`, 30000)

  // N8 : un travail dont le modèle gratuit est à court de quota.
  await ui.ev(`${input}.focus()`)
  await ui.type('@security-expert Relis le stockage.\n/scenario quota-gratuit')
  await ui.press('Escape')
  await ui.waitFor(`!!${ui.$('role-destination')}`)
  await ui.enter()
  const blocked = `document.querySelector('[data-testid=work-card][data-role=security-expert]')`
  await ui.waitFor(`!!${blocked}?.querySelector('[data-testid=work-refused-text]')`, 30000)
  await ui.reveal(blocked)
  await ui.shot('267-quota-travail')
  await ui.click(`${blocked}.querySelector('[data-testid=work-choose-model]')`)
  await ui.waitFor(`!!${ui.$('control-model-factice-precis')}`)
  await ui.click(ui.$('control-model-factice-precis'))
  await ui.waitFor(`${blocked}?.dataset.state === 'replied'`, 30000)
  check(
    (await ui.ev(`${blocked}.innerText`)).includes('Ce modèle a encore du quota'),
    'le travail repart avec l’autre modèle, sa réponse dans sa carte'
  )
}
