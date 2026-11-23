/**
 * Parcours réels enchaînés (fiche 277) : outils communs des suites `parcours-*`. Une « journée »
 * enchaîne ses étapes dans une même instance de l'app ; après chacune, on vérifie ce que
 * l'utilisateur voit (fait par l'étape elle-même), puis ce qu'il ne voit pas : le journal de l'app
 * (aucune erreur IPC, aucune exception non gérée du main ni de la page) et la cohérence entre la
 * barre latérale, le titre et la conversation affichée.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { check, sleep } from './lib.mjs'

/**
 * Lignes du journal du main qui trahissent un défaut : erreurs (`ERROR`), appels IPC en échec
 * (`WARN  IPC canal :`), exceptions et promesses non gérées, plantages de l'interface.
 */
const BAD_LINE =
  /^\S+Z (ERROR|WARN  IPC )|Exception non rattrapée|Promesse rejetée non gérée|Error occurred in handler|Interface arrêtée/

/**
 * Avertissement de Chromium sans conséquence (boucle de `ResizeObserver` reportée à l'image
 * suivante), levé comme une erreur de la page : pas un défaut de l'app.
 */
const BENIGN = /ResizeObserver loop/

/**
 * Enregistreur posé dans la page : erreurs non rattrapées, promesses rejetées sans gestion,
 * `console.error`. Posé à chaque vérification (la page a pu être rechargée) ; ce qui arrive
 * avant la première pose n'est pas vu, le journal du main restant lu en entier.
 */
const RECORDER = `(() => {
  if (!window.__parcours) {
    const seen = (window.__parcours = { errors: [] })
    const note = (what) => seen.errors.length < 50 && seen.errors.push(String(what).slice(0, 400))
    addEventListener('error', (e) => note('exception : ' + (e.error?.stack ?? e.message)))
    addEventListener('unhandledrejection', (e) => note('promesse rejetée : ' + (e.reason?.stack ?? e.reason)))
    const original = console.error.bind(console)
    console.error = (...args) => {
      note('console.error : ' + args.map((a) => (a instanceof Error ? a.stack : typeof a === 'string' ? a : JSON.stringify(a))).join(' '))
      original(...args)
    }
  }
  const errors = window.__parcours.errors.splice(0)
  return errors
})()`

/**
 * Cohérence de ce qui est affiché : la ligne active de la barre latérale est la conversation que
 * le main dit affichée, le titre de la fenêtre est le sien, le point d'état de l'agent dit son
 * statut. Rend la liste des écarts (vide si tout va).
 */
const COHERENCE = `(async () => {
  const s = await window.api.conversations.get()
  const problems = []
  const active = document.querySelector('.history-item.active')
  const shown = s.conversations.find((c) => c.id === s.activeId)
  if (active && active.dataset.id !== s.activeId)
    problems.push('ligne active ' + active.dataset.id + ' ≠ conversation affichée ' + s.activeId)
  if (!active && shown && !shown.draft && !shown.archived)
    problems.push('conversation affichée « ' + shown.title + ' » sans ligne active dans la barre latérale')
  const label = active?.querySelector('.label')?.innerText.trim()
  const title = document.querySelector('[data-testid=title-menu]')?.innerText.trim()
  if (active && label && title && !title.startsWith(label) && !label.startsWith(title))
    problems.push('titre « ' + title + ' » ≠ ligne « ' + label + ' »')
  const dot = document.querySelector('.agent-avatar .status-dot')
  if (dot && shown && shown.status !== 'stopped' && !dot.classList.contains(shown.status))
    problems.push('point d’état « ' + dot.className + ' » ≠ statut ' + shown.status)
  return problems
})()`

/**
 * Journée : `step(label, fn, { allow })` joue une étape, puis vérifie journal et cohérence.
 * `allow` : expressions des lignes du journal attendues à cette étape (panne voulue).
 * `closing` : l'étape ferme l'app (⌘Q) : seul le journal du main est relu, la page n'est plus là.
 * `restarted(ui)` : nouvelle instance de l'app (après un redémarrage), même journée.
 */
export function day(name) {
  let n = 0
  let ui
  const reported = new Set()
  const journal = async (allow, closing) => {
    const lines = ui
      .output()
      .split('\n')
      .filter((line) => BAD_LINE.test(line) && !reported.has(line))
    for (const line of lines) reported.add(line)
    const unexpected = lines.filter((line) => !allow.some((re) => re.test(line)))
    const page = closing
      ? []
      : await ui.ev(RECORDER).catch((e) => [`page illisible : ${e.message}`])
    const pageUnexpected = page.filter(
      (line) => !BENIGN.test(line) && !allow.some((re) => re.test(line))
    )
    return [...unexpected, ...pageUnexpected]
  }
  const coherent = async () => {
    // Un état qui change (fin de tour, ligne qui arrive) : laissé à se poser 3 s au plus.
    let problems = []
    for (let i = 0; i < 15; i++) {
      problems = await ui.ev(COHERENCE).catch((e) => [`cohérence illisible : ${e.message}`])
      if (problems.length === 0) return problems
      await sleep(200)
    }
    return problems
  }
  return {
    attach(next) {
      ui = next
      return ui.ev(RECORDER).catch(() => [])
    },
    /**
     * Une étape. Ce qu'elle vérifie elle-même passe par `check` ; puis une ligne de plus : journal
     * propre et affichage cohérent. Une exception arrête la journée (l'état suivant n'aurait plus
     * de sens), comme dans toutes les suites.
     */
    async step(label, fn, { allow = [], closing = false } = {}) {
      n++
      console.log(`  · ${name} ${n}. ${label}`)
      await fn()
      const errors = await journal(allow, closing)
      const problems = closing ? [] : await coherent()
      check(
        errors.length === 0 && problems.length === 0,
        `${name} ${n}. ${label} : journal propre, affichage cohérent${
          errors.length ? `\n      journal : ${errors.join('\n      ')}` : ''
        }${problems.length ? `\n      écarts : ${problems.join(' ; ')}` : ''}`
      )
    }
  }
}

/** Commande git dans un dossier, avec une identité d'essai. */
export const git = (cwd, ...args) =>
  execFileSync('git', ['-c', 'user.name=e2e', '-c', 'user.email=e2e@example.invalid', ...args], {
    cwd,
    encoding: 'utf8'
  }).trim()

/** Petit dépôt git jetable, comme un vrai projet : README, un fichier source, un commit. */
export function project(prefix) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), prefix)))
  writeFileSync(join(dir, 'README.md'), '# Démo\n\nVersion 1\n\n## Utilisation\n')
  mkdirSync(join(dir, 'public'))
  writeFileSync(join(dir, 'public', 'app.js'), "const list = document.getElementById('books')\n")
  git(dir, 'init', '-q', '-b', 'main')
  git(dir, 'add', '.')
  git(dir, 'commit', '-q', '-m', 'init')
  git(dir, 'config', 'user.name', 'e2e')
  git(dir, 'config', 'user.email', 'e2e@example.invalid')
  return dir
}

/** Lignes de la barre latérale. */
export const ROWS = `[...document.querySelectorAll('[data-testid=history-item]')]`
/** La ligne dont le titre commence par `title`. */
export const row = (title) =>
  `${ROWS}.find((i) => i.querySelector('.label')?.innerText.trim().startsWith(${JSON.stringify(title)}))`
/** Identifiant de la conversation affichée. */
export const activeId = (ui) => ui.ev(`window.api.conversations.get().then((s) => s.activeId)`)
/** Nombre de messages de l'utilisateur dans le fil affiché. */
export const userCount = (ui) => ui.ev(`document.querySelectorAll('.msg-user').length`)

/** Nouvelle conversation (bouton de la barre latérale), prête à recevoir un message. */
export async function newConversation(ui) {
  await ui.click(ui.$('new-conversation'))
  await ui.waitFor(`!document.querySelector('.history-item.active')`)
  await ui.ready()
}

/** Ouvre la conversation de la barre latérale qui porte ce titre. */
export async function open(ui, title) {
  await ui.waitFor(`!!${row(title)}`)
  await ui.click(`${row(title)}.querySelector('.history-open') ?? ${row(title)}`)
  await ui.waitFor(`${row(title)}?.classList.contains('active')`)
}

/** Réglages ouverts (roue de la barre latérale), sur une section. */
export async function openSettings(ui, section) {
  if (!(await ui.ev(`!!${ui.$('settings')}`))) {
    await ui.click(ui.$('open-settings'))
    await ui.waitFor(`!!${ui.$('settings')}`)
  }
  if (section) {
    await ui.click(ui.$(section))
  }
}

/** Réglages fermés (Échap). */
export async function closeSettings(ui) {
  await ui.key('Escape')
  await ui.waitFor(`!${ui.$('settings')}`)
}

/** Choisit une valeur dans une liste (`<select>`) de l'interface, comme l'utilisateur. */
export const choose = (ui, testId, value) =>
  ui.ev(`(() => {
    const select = ${ui.$(testId)}
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, ${JSON.stringify(value)})
    select.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  })()`)

/** Quitte l'app par le main (⌘Q), en répondant « Quitter » à la question d'un tour en cours. */
export async function quitApp(main, mainPort) {
  try {
    await main.evaluate(`(() => {
      const { app, dialog } = require('electron')
      dialog.showMessageBox = async () => ({ response: 0 })
      setTimeout(() => app.quit(), 50)
      return true
    })()`)
  } catch {
    // La connexion au main se ferme avec l'app.
  } finally {
    main.close()
  }
  for (let i = 0; i < 100; i++) {
    const alive = await fetch(`http://127.0.0.1:${mainPort}/json/list`).then(
      () => true,
      () => false
    )
    if (!alive) return
    await sleep(150)
  }
}
