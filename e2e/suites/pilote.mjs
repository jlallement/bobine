import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { L, LANG, M, NEUTRAL_AGENT_ENV, NEUTRAL_ENV, PORT, check, captures, root } from '../lib.mjs'

/**
 * Pilote de Bobine (fiche 206) : la commande elle-même, telle que Claude s'en sert pendant une
 * session longue, contre l'app buildée et l'agent factice. Lancement sur un profil temporaire,
 * accueil, carte d'autorisation (`attendre` → `carte`), réponse, tour fini, tour figé (`calme`),
 * Arrêter, notes et intervention, résumé du journal, arrêt de cette instance seulement.
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
  let pid
  try {
    const launched = pilote('lancer', '--port', String(PORT), '--lang', LANG)
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
    pilote('cliquer', L('onboarding.folder.create'))
    pilote('attendre', '--max', '30s')
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

    // Carte d'autorisation.
    const sent = pilote('envoyer', '/scenario permission')
    check(sent.code === 0, `envoyer : message parti (${sent.err.trim() || sent.out.trim()})`)
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
    check(wait.out.includes(M('Configuration mise à jour.')), 'etat : dernier message de l’agent')
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
    check(wait.code === 15 && wait.out.startsWith('calme'), `attendre → calme (${firstLine(wait)})`)
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
    const summary = pilote('journal', '--resume').out
    check(
      summary.includes('Interventions : 1') &&
        summary.includes('Gênant 1') &&
        /Tours mesurés : [12]/.test(summary) &&
        summary.includes('carte 1') &&
        summary.includes('calme 1'),
      `journal --resume : notes, interventions, tours, fins d’attente\n${indent(summary)}`
    )
    const journal = pilote('journal').out
    check(
      journal.includes('Le tour ne dit pas pourquoi il attend') &&
        /Capture : captures\/.*\.png/.test(journal),
      'journal : note, capture et état'
    )
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

/** Texte comme `etat` l'écrit : espaces insécables en espaces simples. */
const plain = (text) => text.replace(/\u00a0/g, ' ')
const firstLine = (r) => (r.out.split('\n')[0] || r.err.trim()).slice(0, 120)
const indent = (text) =>
  text
    .trim()
    .split('\n')
    .map((l) => `      ${l}`)
    .join('\n')
function alive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}
