import { execFileSync, spawnSync } from 'node:child_process'
import { createServer } from 'node:http'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { connect } from '../../scripts/pilote/cdp.mjs'
import {
  L,
  LANG,
  M,
  NEUTRAL_AGENT_ENV,
  NEUTRAL_ENV,
  PORT,
  check,
  captures,
  root,
  sleep
} from '../lib.mjs'

/**
 * Pilote de Bobine (fiche 206) : la commande elle-même, telle que Claude s'en sert pendant une
 * session longue, contre l'app buildée et l'agent factice. Lancement sur un profil temporaire
 * avec `--dossier` (l'accueil le prend par « Choisir… », sans fenêtre de macOS), envoi par-dessus
 * un brouillon (la zone est vidée d'abord), carte d'autorisation (`attendre` → `carte`), réponse, tour fini, tour figé (`calme`),
 * Arrêter, notes et intervention, résumé du journal, arrêt de cette instance seulement. Fiche 248 :
 * navigateur intégré ouvert puis fermé (`etat`, `envoyer`, `capture` visent la fenêtre de Bobine),
 * carte souvenir, « Tâches proposées » traitée, `envoyer` dans une conversation fille.
 * `pnpm e2e pilote --lang en` : la même chose en anglais (libellés par `L`, agent par `M`).
 */
export async function piloteSuite() {
  console.log(`\n— Pilote de Bobine (${LANG})`)
  const dir = mkdtempSync(join(tmpdir(), 'bob-e2e-pilote-'))
  const env = {
    ...process.env,
    ...NEUTRAL_ENV,
    // Aucun vrai agent découvert : l'agent factice seul, choisi d'office par l'accueil.
    ...NEUTRAL_AGENT_ENV,
    BOBINE_PILOTE_DIR: join(dir, 'pilote'),
    BOBINE_TRIAL_DIR: join(dir, 'essai'),
    BOBINE_AGENT_PROFILE: 'mock'
  }
  /** Une commande du pilote : code de sortie, sortie, erreur. */
  const pilote = (...args) => {
    const r = spawnSync(
      process.execPath,
      [join(root, 'scripts', 'pilote', 'pilote.mjs'), ...args],
      {
        env,
        encoding: 'utf8',
        timeout: 120_000
      }
    )
    return { code: r.status, out: r.stdout ?? '', err: r.stderr ?? '' }
  }
  const instance = () => JSON.parse(readFileSync(join(dir, 'pilote', 'instance.json'), 'utf8'))
  // Le projet du testeur : `--dossier`, repris par l'étape « Où travailler ? » de l'accueil.
  const project = join(dir, 'projet-du-pilote')
  mkdirSync(project)
  // Dépôt git : l'agent reçoit `start_child` (conversations filles, fiche 248).
  git(project, 'init', '-q', '-b', 'main')
  git(project, 'commit', '-q', '--allow-empty', '-m', 'init')
  /** Évalue dans la fenêtre de Bobine, comme les essais (hors des commandes du pilote). */
  const inPage = async (expression) => {
    const page = await connect(PORT)
    try {
      return await page.ev(expression)
    } finally {
      page.close()
    }
  }
  let pid
  try {
    const launched = pilote('lancer', '--port', String(PORT), '--lang', LANG, '--dossier', project)
    check(launched.code === 0, `lancer : Bobine démarrée (${launched.err.trim() || 'ok'})`)
    pid = instance().pid
    check(
      launched.out.includes(L('onboarding.agent.title')) && launched.out.includes('Accueil :'),
      'lancer : l’état montre l’accueil du premier lancement (profil temporaire)'
    )

    // Accueil, au libellé traduit, comme un humain.
    pilote('cliquer', L('onboarding.continue'))
    let wait = pilote('attendre', '--max', '30s')
    check(
      wait.code === 14 && wait.out.startsWith('accueil'),
      `attendre : étape suivante de l’accueil (${firstLine(wait)})`
    )
    pilote('cliquer', L('onboarding.continue'))
    const chosen = pilote('cliquer', L('onboarding.folder.choose'))
    check(chosen.code === 0, `accueil : « Choisir… » (${chosen.err.trim() || chosen.out.trim()})`)
    pilote('attendre', '--max', '30s')
    const workspace = await inPage(
      `(async () => { const s = await window.api.conversations.get(); return !!document.querySelector('[data-testid=onboarding-send]') && s.conversations.find((c) => c.id === s.activeId)?.workspace })()`
    )
    check(
      typeof workspace === 'string' && workspace.endsWith(`/${basename(project)}`),
      'lancer --dossier : l’accueil travaille dans ce dossier, sans fenêtre de macOS'
    )
    pilote('cliquer', L('onboarding.trial.send'))
    wait = pilote('attendre', '--max', '30s')
    check(wait.out.includes(L('onboarding.start')), 'accueil : essai fini, « Commencer » proposé')
    pilote('cliquer', L('onboarding.start'))
    const ready = pilote('etat')
    check(
      ready.code === 0 &&
        ready.out.includes(`${L('sidebar.status.ready')} (ready)`) &&
        !ready.out.includes('Accueil'),
      'etat : agent prêt, accueil fini'
    )

    // Carte d'autorisation, envoyée par-dessus un brouillon laissé dans la zone de saisie.
    await inPage(`(() => {
      const input = document.querySelector('[data-testid=composer-input]')
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(input, 'brouillon à jeter ')
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.setSelectionRange(0, 0)
      return true
    })()`)
    const sent = pilote('envoyer', '/scenario permission')
    check(sent.code === 0, `envoyer : message parti (${sent.err.trim() || sent.out.trim()})`)
    // `envoyer` rend la main dès la zone vidée par l'envoi : le message arrive dans le fil un peu
    // après (machine lente, Linux sous xvfb). On attend qu'il y soit, puis on compare son texte.
    let lastUser
    for (let i = 0; i < 50 && !lastUser; i++) {
      lastUser = await inPage(
        `[...document.querySelectorAll('.msg-user')].at(-1)?.innerText.trim()`
      )
      if (!lastUser) await sleep(100)
    }
    check(
      lastUser === '/scenario permission',
      `envoyer : zone vidée d’abord, le brouillon ne part pas avec le message (${JSON.stringify(lastUser)})`
    )
    wait = pilote('attendre', '--max', '60s')
    check(wait.code === 10 && wait.out.startsWith('carte'), `attendre → carte (${firstLine(wait)})`)
    const withCard = pilote('etat')
    check(
      withCard.out.includes('Carte (autorisation)') &&
        withCard.out.includes(plain(L('toolCall.permission.question.edit'))) &&
        withCard.out.includes('config.json') &&
        withCard.out.includes(`[${L('permissionOption.allow_once')}]`),
      'etat : titre, fichier et boutons de la carte'
    )
    const shot = pilote('capture', '--zone', 'carte', '--demi')
    check(shot.code === 0 && existsSync(shot.out.trim()), 'capture de la carte (demi-taille)')
    const answered = pilote('repondre', L('permissionOption.allow_once'))
    check(answered.code === 0, `repondre : ${answered.out.trim() || answered.err.trim()}`)
    wait = pilote('attendre', '--max', '60s')
    check(
      wait.code === 0 && wait.out.startsWith('tour-fini'),
      `attendre → tour-fini (${firstLine(wait)})`
    )
    const json = JSON.parse(pilote('etat', '--json').out)
    check(
      json.tools.items.at(-1)?.kind === 'edit' && json.panel?.tabs.some((t) => t.id === 'changes'),
      'etat --json : genre de l’outil, onglet Modifications'
    )
    const panel = pilote('panneau', 'modifications')
    check(
      panel.code === 0 && pilote('etat').out.includes(`${L('panel.tab.changes')} (1)*`),
      'panneau modifications : onglet ouvert, compte affiché'
    )

    // Tour figé : `calme`, puis Arrêter (nom accessible du bouton).
    pilote('envoyer', '/scenario attend-stop')
    wait = pilote('attendre', '--calme', '4s', '--max', '60s')
    const stopped = pilote('cliquer', L('shortcuts.menu.stop'))
    check(
      stopped.code === 0,
      `cliquer « ${L('shortcuts.menu.stop')} » (${stopped.err.trim() || 'ok'})`
    )
    wait = pilote('attendre', '--max', '30s')
    check(wait.code === 0, `après Arrêter : tour-fini (${firstLine(wait)})`)

    // Retours du testeur et journal.
    const note = pilote(
      'note',
      '--gravite',
      'genant',
      '--capture',
      'Le tour ne dit pas pourquoi il attend'
    )
    check(note.code === 0, 'note avec capture')
    check(pilote('note', '--gravite', 'grave', 'x').code === 1, 'note : gravité inconnue refusée')
    check(
      pilote('intervention', 'Agent figé, Arrêter puis relancé').code === 0,
      'intervention notée'
    )
    await targetChecks({ pilote, inPage, project })
  } finally {
    const stop = pilote('arreter')
    check(stop.code === 0 && (!pid || !alive(pid)), 'arreter : cette Bobine-là seulement, arrêtée')
    check(pilote('etat').code === 1, 'etat sans Bobine : erreur claire')
    // Journal gardé pour la relecture, avec les captures des essais.
    const journal = join(instance().journal, 'journal.md')
    if (existsSync(journal)) {
      const copy = join(captures, `${LANG === 'fr' ? '' : `${LANG}-`}pilote-journal.md`)
      copyFileSync(journal, copy)
    }
    rmSync(dir, { recursive: true, force: true })
  }
}

/**
 * Fiche 248 : la cible du pilote reste la fenêtre de Bobine quand le navigateur intégré a une page
 * (une maquette servie en local, comme à la recette du 2026-11-17), puis une fois l'onglet fermé ;
 * cartes souvenir et « Tâches proposées » ; `envoyer` dans une conversation fille.
 */
async function targetChecks({ pilote, inPage, project }) {
  const server = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end('<!doctype html><title>Maquette B</title><h1>Maquette B</h1><textarea></textarea>')
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  try {
    await targetSteps({
      pilote,
      inPage,
      project,
      mockup: `http://127.0.0.1:${server.address().port}/b.html`
    })
  } finally {
    server.close()
  }
}

async function targetSteps({ pilote, inPage, project, mockup }) {
  const conversation = `(await window.api.conversations.get()).activeId`
  const listed = async () => {
    const list = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json())
    return list.some((t) => t.url === mockup)
  }
  check(pilote('panneau', 'navigateur').code === 0, 'panneau navigateur ouvert')
  await inPage(
    `(async () => (await window.api.browser.navigate(${conversation}, ${JSON.stringify(mockup)}), true))()`
  )
  let open = false
  for (let i = 0; i < 50 && !open; i++) {
    open = await listed()
    if (!open) await sleep(100)
  }
  check(open, 'navigateur intégré : la maquette est une cible DevTools à côté de Bobine')
  pilote('envoyer', '/scenario echo')
  pilote('attendre', '--max', '30s')
  const shot = pilote('capture')
  const png = shot.code === 0 ? readFileSync(shot.out.trim()) : Buffer.alloc(24)
  const width = await inPage('Math.round(innerWidth * devicePixelRatio)')
  check(
    png.readUInt32BE(16) === width,
    `capture, navigateur ouvert : la fenêtre entière (${png.readUInt32BE(16)} px de large, fenêtre ${width})`
  )
  // Onglet fermé : la cible disparaît (ou non), le pilote ne s'en soucie plus.
  await inPage(`(async () => {
    const id = ${conversation}
    for (const tab of (await window.api.browser.getState(id))?.tabs ?? []) await window.api.browser.closeTab(id, tab.id)
    return true
  })()`)

  // Carte souvenir : `attendre` la voit, `repondre` la décide.
  pilote('envoyer', '/scenario memoire-retient')
  let w = pilote('attendre', '--max', '30s')
  const kept = pilote('repondre', L('memory.card.remember'))
  check(kept.code === 0, `repondre « ${L('memory.card.remember')} » (${kept.err.trim() || 'ok'})`)
  w = pilote('attendre', '--max', '30s')
  check(w.code === 0, `souvenir décidé : plus de carte (${firstLine(w)})`)

  // « Tâches proposées » : en attente, puis traitée (« Lancer ») : plus une carte.
  // Rien de non commité : « Lancer » n'attend pas « Committer d'abord » (fiche 240). L'outil
  // `start_child` demande d'abord l'accord (agent factice, mode Code).
  git(project, 'add', '-A')
  git(project, 'commit', '-q', '--allow-empty', '-m', 'pilote')
  pilote('envoyer', '/scenario filles-refus')
  w = pilote('attendre', '--max', '30s')
  if (w.out.includes('Carte (autorisation)')) {
    pilote('repondre', L('permissionOption.allow_once'))
    w = pilote('attendre', '--max', '30s')
  }
  check(
    w.code === 10 && w.out.includes('Carte (propositions)'),
    `attendre → tâches proposées (${firstLine(w)})`
  )
  const started = pilote('repondre', L('children.proposals.start'))
  check(
    started.code === 0,
    `repondre « ${L('children.proposals.start')} » (${started.err.trim() || 'ok'})`
  )
  // La mère continue (l'agent factice peut demander un accord) : chaque attente rend autre chose
  // que la carte « Tâches proposées » traitée, jusqu'au tour fini.
  let seenProposals = false
  for (let i = 0; i < 5; i++) {
    w = pilote('attendre', '--max', '60s')
    seenProposals ||= w.out.includes('Carte (propositions)')
    if (w.code !== 10 || seenProposals) break
    pilote('repondre', L('permissionOption.allow_once'))
  }

  // `envoyer` dans la conversation fille.
  const child = M('Page d’aide')
  await inPage(`(() => {
    const item = [...document.querySelectorAll('[data-testid=history-item]')].find((i) => i.innerText.includes(${JSON.stringify(child)}))
    item?.querySelector('.history-open')?.click()
    return !!item
  })()`)
  for (let i = 0; i < 50; i++) {
    if (
      (
        await inPage(`document.querySelector('[data-testid=title-menu]')?.innerText ?? ''`)
      ).includes(child)
    )
      break
    await sleep(100)
  }
  pilote('attendre', '--max', '60s')
  const inChild = pilote('envoyer', '/scenario echo')
  check(inChild.code === 0, `envoyer dans la conversation fille (${inChild.err.trim() || 'ok'})`)
  const last = await inPage(`[...document.querySelectorAll('.msg-user')].at(-1)?.innerText.trim()`)
  const title = await inPage(`document.querySelector('[data-testid=title-menu]')?.innerText ?? ''`)
  check(
    last === '/scenario echo' && title.includes(child),
    `envoyer : le message est dans la fille « ${title} »`
  )
  w = pilote('attendre', '--max', '60s')
  check(w.code === 0, `attendre dans la fille : tour-fini (${firstLine(w)})`)
}

/** Git dans le projet du testeur, sans la configuration de la machine. */
const git = (cwd, ...args) =>
  execFileSync(
    'git',
    ['-c', 'user.name=Pilote', '-c', 'user.email=pilote@example.invalid', ...args],
    {
      cwd,
      env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' }
    }
  )

/** Texte comme `etat` l'écrit : espaces insécables en espaces simples. */
const plain = (text) => text.replace(/\u00a0/g, ' ')
const firstLine = (r) => (r.out.split('\n')[0] || r.err.trim()).slice(0, 120)
function alive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}
