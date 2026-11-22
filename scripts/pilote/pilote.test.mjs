/**
 * Parties pures du pilote de Bobine (fiche 206) : arguments, mise en forme de l'état, raisons de
 * fin d'attente, journal, textes traduits, arguments de lancement. Le pilote réel (Bobine lancée,
 * protocole DevTools) est essayé par la suite e2e `pilote`.
 */
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { JSDOM } from 'jsdom'
import { describe, expect, it } from 'vitest'
import { clickLabel } from './actions.mjs'
import { frenchTypography as appTypography } from '../../src/shared/i18n/typography'
import { formatDuration, parseArgs, parseDuration } from './args.mjs'
import { excerpt, formatState, toolsLine, turnLine } from './etat.mjs'
import { appCommand, launchArgs, launchEnv, ours } from './instance.mjs'
import { appendEntry, formatSummary, readEntries, summarize } from './journal.mjs'
import { busy, EXIT_CODES, parseShownDuration, pendingReason, Watcher } from './raison.mjs'
import { L, frenchTypography, panelTab } from './textes.mjs'

/** Chemin absolu de la machine (le même sous Unix ; sous Windows, sur le lecteur courant). */
const abs = (posixPath) => resolve(posixPath)

/** Écran lu (forme de `lecture.mjs`) : une conversation au repos, tour fini. */
const idle = (extra = {}) => ({
  at: 0,
  lang: 'fr',
  agent: { name: 'Agent factice', status: 'Prêt', dot: 'ready' },
  temporary: true,
  title: 'Carnet de bord',
  welcome: false,
  chips: { mode: 'Code', model: 'Factice rapide', agent: 'Agent factice' },
  composer: { present: true, draft: 0, disabled: false },
  queued: 0,
  messages: 2,
  turnSummary: '21:17 · 44 s · 1 fichier +1 −1',
  turnDuration: '44 s',
  lastAgent: 'Configuration mise à jour.',
  tools: {
    items: [{ kind: 'edit', status: 'completed', label: 'Modification de config.json' }],
    grouped: 0
  },
  cards: [],
  questions: false,
  blockers: [],
  alerts: [],
  sidebar: [{ title: 'Carnet de bord', active: true, unread: false, state: '', code: '' }],
  dialogs: [],
  menu: [],
  ...extra
})
const working = (extra = {}) =>
  idle({
    agent: { name: 'Agent factice', status: 'Répond…', dot: 'busy' },
    working: { label: 'Écrit…', time: '12 s', activity: 'writing' },
    turnSummary: undefined,
    ...extra
  })
const card = {
  type: 'autorisation',
  title: 'Autoriser cette commande ?',
  sub: 'L’agent attend votre accord pour continuer.',
  command: 'npm test',
  cwd: '~/carnet',
  warnings: [],
  file: '',
  stats: '',
  question: '',
  choices: [],
  note: '',
  buttons: ['Autoriser une fois', 'Toujours autoriser', 'Refuser']
}

describe('arguments', () => {
  it('lit commande, options et texte libre', () => {
    expect(parseArgs(['note', '--gravite', 'genant', '--capture', 'La', 'carte'])).toEqual({
      command: 'note',
      options: { gravite: 'genant', capture: true },
      text: 'La carte'
    })
    expect(parseArgs(['attendre', '--max=5m'])).toEqual({
      command: 'attendre',
      options: { max: '5m' },
      text: ''
    })
    expect(parseArgs(['envoyer', '--', '--pas une option'])).toMatchObject({
      text: '--pas une option'
    })
    expect(parseArgs([]).command).toBe('aide')
  })
  it('refuse une commande, une option ou une valeur manquante', () => {
    expect(() => parseArgs(['voler'])).toThrow('commande inconnue')
    expect(() => parseArgs(['etat', '--vite'])).toThrow('option inconnue')
    expect(() => parseArgs(['attendre', '--max'])).toThrow('attend une valeur')
    expect(() => parseArgs(['attendre', '--max', '--calme', '3m'])).toThrow('attend une valeur')
  })
  it('lit et écrit les durées', () => {
    expect(parseDuration('90s')).toBe(90_000)
    expect(parseDuration('3m')).toBe(180_000)
    expect(parseDuration('1h30m')).toBe(5_400_000)
    expect(parseDuration('20')).toBe(20_000)
    expect(parseDuration('1500ms')).toBe(1500)
    expect(() => parseDuration('bientôt')).toThrow('durée illisible')
    expect(() => parseDuration('3m et demi')).toThrow('durée illisible')
    expect(formatDuration(42_000)).toBe('42 s')
    expect(formatDuration(185_000)).toBe('3 min 05 s')
    expect(formatDuration(3_720_000)).toBe('1 h 02 min')
  })
})

describe('état en texte', () => {
  it('écran calme : quelques lignes, sans ligne vide de sens', () => {
    const text = formatState(idle())
    expect(text.split('\n')).toEqual([
      'Bobine · Agent factice : Prêt (ready) · profil temporaire',
      'Conversation : « Carnet de bord » · Agent factice · Factice rapide · Code',
      'Tour : fini — 21:17 · 44 s · 1 fichier +1 −1',
      'Agent (4 mots) : Configuration mise à jour.',
      'Outils du tour : 1 (edit 1) · dernier : Modification de config.json (completed)',
      'Conversations (1) : ▸ Carnet de bord'
    ])
    expect(text.length).toBeLessThan(600)
  })
  it('carte en attente : titre, commande, dossier, boutons', () => {
    const text = formatState(working({ cards: [card] }))
    expect(text).toContain('Carte (autorisation) : Autoriser cette commande ?')
    expect(text).toContain('  Commande : npm test')
    expect(text).toContain('  Dossier : ~/carnet')
    expect(text).toContain('  Boutons : [Autoriser une fois] [Toujours autoriser] [Refuser]')
  })
  it('message de l’agent : extrait et nombre de mots ; en entier avec --long', () => {
    const long = Array.from({ length: 120 }, (_, i) => `mot${i}`).join(' ')
    const short = formatState(idle({ lastAgent: long }))
    expect(short).toContain('Agent (120 mots) : mot0 mot1')
    expect(short).toContain('…')
    expect(short).not.toContain('mot119')
    expect(formatState(idle({ lastAgent: long }), { long: true })).toContain('mot119')
  })
  it('accueil, blocage, avis, panneau, conversations et saisie', () => {
    const text = formatState(
      idle({
        onboarding: {
          step: 'Dossier',
          title: 'Où travailler ?',
          text: 'Un projet existant',
          error: '',
          waiting: false,
          choices: [
            { label: 'IBM Bob trouvé', checked: true },
            { label: 'OpenCode trouvé', checked: false }
          ],
          buttons: ['Choisir…', 'Créer']
        },
        blockers: [{ id: 'blocker-auth', text: 'Connexion requise', buttons: ['Se connecter'] }],
        alerts: [{ kind: 'erreur', text: 'Erreur interne' }],
        panel: {
          tabs: [
            { id: 'session', label: 'Session', count: '', active: false },
            { id: 'changes', label: 'Modifications', count: '3', active: true }
          ],
          running: '',
          changes: '3 fichiers +10 −2'
        },
        sidebar: [
          { title: 'Mère', active: true, unread: false, state: '', code: '' },
          { title: 'Fille', active: false, unread: true, state: 'En attente', code: 'waiting' }
        ],
        composer: { present: true, draft: 12, disabled: false }
      })
    )
    expect(text).toContain('Accueil : étape « Dossier » — Où travailler ?')
    expect(text).toContain('  Choix : (•) IBM Bob trouvé · ( ) OpenCode trouvé')
    expect(text).toContain('  Boutons : [Choisir…] [Créer]')
    expect(text).not.toContain('Conversation :')
    expect(text).toContain('Blocage (blocker-auth) : Connexion requise')
    expect(text).toContain('Avis (erreur) : Erreur interne')
    expect(text).toContain(
      'Panneau : Session · Modifications (3)* · Modifications : 3 fichiers +10 −2'
    )
    expect(text).toContain('Conversations (2) : ▸ Mère · Fille [En attente, non lu]')
    expect(text).toContain('Saisie : 12 caractères pas encore envoyés')
  })
  it('tour : en cours, fini, ou rien', () => {
    expect(turnLine(working({ queued: 2 }))).toBe(
      'Tour : en cours — Écrit… · 12 s · 2 message(s) en file'
    )
    expect(turnLine(idle({ turnSummary: undefined, turnDuration: undefined }))).toContain(
      'sans résumé'
    )
    expect(
      turnLine(idle({ messages: 0, turnSummary: undefined, turnDuration: undefined }))
    ).toBeNull()
    // Limite d'étapes (fiche 209) : le titre de la carte, plutôt que « sans résumé ».
    expect(
      turnLine(
        idle({ turnSummary: undefined, turnDuration: undefined, turnLimit: 'Arrêt avant la fin' })
      )
    ).toBe('Tour : arrêté — Arrêt avant la fin')
  })
  it('travail après le tour (fiche 261) : « travaille encore », et l’attente continue', () => {
    const after = idle({
      agent: { name: 'Agent factice', status: 'Travaille encore…', dot: 'ready' },
      turnSummary: undefined,
      turnWorking: 'Travaille encore… · 32 s'
    })
    expect(turnLine(after)).toBe('Tour : travaille encore — Travaille encore… · 32 s')
    expect(busy(after)).toBe(true)
    expect(busy(idle())).toBe(false)
  })
  it('travail confié à un rôle (fiche 263) : dit, et l’attente continue tant qu’il tourne', () => {
    const working = idle({ works: [{ role: 'ux-ui-expert', state: 'running', answer: '' }] })
    expect(formatState(working)).toContain('Travail (ux-ui-expert) : running')
    expect(busy(working)).toBe(true)
    const replied = idle({
      works: [{ role: 'ux-ui-expert', state: 'replied', answer: 'Direction calme.' }]
    })
    expect(formatState(replied)).toContain('Travail (ux-ui-expert) : replied · Direction calme.')
    expect(busy(replied)).toBe(false)
  })
  it('outils : par genre, groupés compris', () => {
    expect(
      toolsLine({
        items: [
          { kind: 'read', status: 'completed', label: 'Lecture de a' },
          { kind: 'read', status: 'completed', label: 'Lecture de b' },
          { kind: 'execute', status: 'in_progress', label: 'npm test' }
        ],
        grouped: 30
      })
    ).toBe('Outils du tour : 33 (read 2, execute 1, groupés 30) · dernier : npm test (in_progress)')
    expect(toolsLine({ items: [], grouped: 0 })).toBeNull()
  })
  it('extrait coupé sur un mot', () => {
    expect(excerpt('un deux trois quatre cinq', 16)).toBe('un deux trois…')
    expect(excerpt('court', 12)).toBe('court')
  })
})

describe('raisons de fin d’attente', () => {
  it('ce qui attend l’humain, par priorité', () => {
    expect(pendingReason(idle(), idle())).toBeUndefined()
    expect(pendingReason(working({ cards: [card] }), idle())).toEqual({
      code: 'carte',
      detail: 'Autoriser cette commande ?'
    })
    expect(
      pendingReason(
        working({ cards: [{ ...card, type: 'question', question: 'Quel nom ?' }] }),
        idle()
      )
    ).toEqual({ code: 'question', detail: 'Quel nom ?' })
    expect(
      pendingReason(idle({ blockers: [{ id: 'blocker-auth', text: '', buttons: [] }] }))
    ).toEqual({
      code: 'blocage',
      detail: 'blocker-auth'
    })
    const crash = idle({ agent: { name: 'A', status: 'Arrêté', dot: 'error' }, cards: [card] })
    expect(pendingReason(crash, idle()).code).toBe('erreur')
  })
  it('une erreur déjà là au départ ne relance pas l’attente', () => {
    const error = { kind: 'erreur', text: 'Erreur interne' }
    expect(pendingReason(idle({ alerts: [error] }), idle()).code).toBe('erreur')
    expect(pendingReason(idle({ alerts: [error] }), idle({ alerts: [error] }))).toBeUndefined()
    // Agent silencieux, commande sans sortie : une décision à prendre, pas une erreur.
    expect(
      pendingReason(idle({ alerts: [{ kind: 'silence', text: 'Rien depuis 2 min' }] }), idle())
    ).toEqual({
      code: 'blocage',
      detail: 'silence : Rien depuis 2 min'
    })
  })
  it('une autre conversation qui attend une réponse', () => {
    const child = {
      title: 'Fille',
      active: false,
      unread: true,
      state: 'Autorisation',
      code: 'waiting'
    }
    const shot = idle({ sidebar: [...idle().sidebar, child] })
    expect(pendingReason(shot, idle())).toEqual({
      code: 'carte',
      detail: 'dans « Fille » (Autorisation)'
    })
    expect(pendingReason(shot, shot)).toBeUndefined()
  })
  it('tour fini après un écran calme, pas avant', () => {
    const w = new Watcher({ max: 60_000, calme: 30_000, settle: 3000, now: 0 })
    expect(w.observe(idle(), 0)).toBeUndefined()
    // Le message vient de partir : le tour démarre.
    expect(w.observe(working(), 1500)).toBeUndefined()
    expect(w.observe(working({ lastAgent: 'Je lis' }), 3000)).toBeUndefined()
    expect(w.observe(idle(), 4500)).toBeUndefined()
    expect(w.observe(idle(), 6000)).toBeUndefined()
    expect(w.observe(idle(), 7500)).toEqual({
      code: 'tour-fini',
      detail: '21:17 · 44 s · 1 fichier +1 −1'
    })
  })
  it('calme : un tour qui ne bouge plus ; l’horloge du tour ne compte pas', () => {
    const w = new Watcher({ max: 600_000, calme: 10_000, now: 0 })
    expect(w.observe(working(), 0)).toBeUndefined()
    expect(
      w.observe(working({ working: { label: 'Écrit…', time: '20 s', activity: 'writing' } }), 9000)
    ).toBeUndefined()
    expect(w.observe(working(), 10_000)).toEqual({ code: 'calme', detail: 'Écrit…' })
  })
  it('délai, carte, accueil qui change d’étape', () => {
    const w = new Watcher({ max: 5000, calme: 0, now: 0 })
    expect(w.observe(working(), 0)).toBeUndefined()
    expect(w.observe(working({ lastAgent: 'x' }), 5000)).toEqual({ code: 'delai', detail: '' })
    const o = (title) =>
      idle({ onboarding: { step: 'Agent', title, text: '', waiting: false, buttons: [] } })
    const a = new Watcher({ max: 60_000, calme: 0, now: 0 })
    expect(a.observe(o('Bienvenue'), 0)).toBeUndefined()
    expect(a.observe(o('Connecter'), 1000)).toEqual({ code: 'accueil', detail: 'Connecter' })
    const c = new Watcher({ max: 60_000, calme: 0, now: 0 })
    expect(c.observe(working({ cards: [card] }), 0).code).toBe('carte')
  })
  it('codes de sortie distincts, 0 pour un tour fini', () => {
    const codes = Object.values(EXIT_CODES)
    expect(new Set(codes).size).toBe(codes.length)
    expect(EXIT_CODES['tour-fini']).toBe(0)
    expect(codes.filter((c) => c === 1 || c === 2)).toEqual([])
  })
  it('durée affichée par Bobine', () => {
    expect(parseShownDuration('44 s')).toBe(44_000)
    expect(parseShownDuration('2 min 05 s')).toBe(125_000)
    expect(parseShownDuration('1 h 02 min')).toBe(3_720_000)
    expect(parseShownDuration('3m 5s')).toBe(185_000)
    expect(parseShownDuration('')).toBeNull()
    expect(parseShownDuration('bientôt')).toBeNull()
  })
})

describe('journal', () => {
  it('écrit les entrées (Markdown et JSONL) et les résume', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pilote-journal-'))
    appendEntry(dir, { type: 'debut', texte: 'Bobine lancée', at: '2026-11-08T10:00:00.000Z' })
    appendEntry(dir, {
      type: 'attente',
      raison: 'tour-fini',
      attenteMs: 30_000,
      tourMs: 44_000,
      at: '2026-11-08T10:01:00.000Z'
    })
    appendEntry(dir, {
      type: 'attente',
      raison: 'carte',
      attenteMs: 5000,
      at: '2026-11-08T10:02:00.000Z'
    })
    appendEntry(dir, {
      type: 'note',
      gravite: 'genant',
      texte: 'La carte ne dit pas le dossier',
      capture: 'captures/1.png',
      etat: 'Bobine · Agent : Prêt',
      at: '2026-11-08T10:03:00.000Z'
    })
    appendEntry(dir, {
      type: 'intervention',
      texte: 'Relancé après un arrêt',
      at: '2026-11-08T10:04:00.000Z'
    })
    appendEntry(dir, { type: 'fin', texte: 'Bobine arrêtée', at: '2026-11-08T10:10:00.000Z' })
    const md = readFileSync(join(dir, 'journal.md'), 'utf8')
    expect(md).toMatch(/^# Journal de session Bobine/)
    expect(md).toMatch(
      /## \d\d:03:00 · Note · Gênant\n\nLa carte ne dit pas le dossier\n\nCapture : captures\/1.png/
    )
    expect(md).toContain('```text\nBobine · Agent : Prêt\n```')
    const summary = summarize(readEntries(dir))
    expect(summary).toMatchObject({
      notes: 1,
      gravities: { bloquant: 0, genant: 1, mineur: 0, idee: 0 },
      waits: 2,
      waitedMs: 35_000,
      reasons: { 'tour-fini': 1, carte: 1 },
      turns: { count: 1, medianMs: 44_000, maxMs: 44_000 },
      sessionMs: 600_000
    })
    expect(summary.interventions).toEqual([
      { at: '2026-11-08T10:04:00.000Z', texte: 'Relancé après un arrêt' }
    ])
    const text = formatSummary(summary)
    expect(text).toContain('Session : 10 min 00 s · 2 attente(s), 35 s à attendre')
    expect(text).toContain('Notes : 1 — Bloquant 0, Gênant 1, Mineur 0, Idée 0')
    expect(text).toContain('Interventions : 1')
    expect(text).toContain('Relancé après un arrêt')
    expect(text).toContain('Tours mesurés : 1 — médiane 44 s')
    expect(text).toContain('Fins d’attente : tour-fini 1, carte 1')
  })
  it('journal vide ou ligne abîmée : pas d’erreur', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pilote-journal-'))
    expect(readEntries(dir)).toEqual([])
    expect(summarize([]).sessionMs).toBe(0)
  })
})

describe('textes et lancement', () => {
  it('libellés traduits comme l’app les affiche', () => {
    expect(L('permissionOption.allow_once', 'fr')).toBe('Autoriser une fois')
    expect(L('permissionOption.allow_once', 'en-US')).toBe('Allow once')
    expect(L('panel.tab.changes', 'fr')).toBe('Modifications')
    expect(() => L('pas.une.cle', 'fr')).toThrow('texte inconnu')
  })
  it('même typographie que l’app (fiche 126)', () => {
    for (const sample of [
      'Fichier de OpenCode : prêt ?',
      '« Bob » que IBM sert !',
      'de index.html'
    ]) {
      expect(frenchTypography(sample)).toBe(appTypography(sample))
    }
  })
  it('onglets du panneau, en français ou en anglais', () => {
    expect(panelTab('Modifications')).toBe('changes')
    expect(panelTab('tâches')).toBe('tasks')
    expect(panelTab('navigateur')).toBe('browser')
    expect(panelTab('terminal')).toBe('terminal')
    expect(panelTab('cuisine')).toBeUndefined()
  })
  it('lancement : profil temporaire par défaut, débogage local, accessibilité, trousseau simulé', () => {
    const args = launchArgs({ base: ['/app'], port: 9333, options: {} })
    expect(args).toEqual([
      '/app',
      '--profil-temporaire',
      '--remote-debugging-port=9333',
      '--remote-debugging-address=127.0.0.1',
      '--force-renderer-accessibility',
      '--use-mock-keychain',
      '-ApplePersistenceIgnoreState',
      'YES'
    ])
    const own = launchArgs({
      base: [],
      port: 9333,
      options: {
        profil: abs('/tmp/p'),
        dossier: abs('/tmp/projet'),
        'vrai-trousseau': true,
        'agents-neufs': true
      }
    })
    expect(own).toContain(`--user-data-dir=${abs('/tmp/p')}`)
    expect(own).not.toContain('--profil-temporaire')
    // `--agents-neufs` ne vaut qu'avec le profil temporaire (fiche 148).
    expect(own).not.toContain('--agents-neufs')
    expect(own).not.toContain('--use-mock-keychain')
    expect(own.slice(-2)).toEqual(['--', abs('/tmp/projet')])
    expect(launchArgs({ base: [], port: 1, options: { 'agents-neufs': true } })).toContain(
      '--agents-neufs'
    )
  })
  // Une seule lecture réelle (le cas positif) : sous Windows, chacune lance PowerShell, environ
  // 35 s par appel sur la machine `windows-11-arm` de GitHub (release 1.0.0-beta.6 : 104 s pour
  // trois appels, contre moins de 5 s pour tout ce fichier sur x64). D'où 90 s pour cet essai seul.
  it('arrêt : notre processus reconnu par sa vraie ligne de commande', async () => {
    // Vivant jusqu'à `kill` : un enfant qui ne vivait que 10 s était déjà sorti quand PowerShell
    // lisait sa ligne de commande, et `ours` répondait faux.
    const child = spawn(process.execPath, [
      '-e',
      'setInterval(() => {}, 1000)',
      '--',
      '--remote-debugging-port=9399'
    ])
    try {
      // Processus lancé (sa ligne de commande lisible) : l'évènement, pas 200 ms (fiche 250).
      await once(child, 'spawn')
      expect(ours({ pid: child.pid, port: 9399 })).toBe(true)
    } finally {
      child.kill()
    }
  }, 90_000)
  it('arrêt : seulement le processus lancé par le pilote (pid réutilisé : jamais tué)', () => {
    const lines = {
      1: `node -e x -- --remote-debugging-port=9399`,
      2: `C:\\Program Files\\Autre\\autre.exe --flag`
    }
    const read = (pid) => lines[pid] ?? ''
    expect(ours({ pid: 1, port: 9399 }, read)).toBe(true)
    expect(ours({ pid: 1, port: 9398 }, read)).toBe(false)
    expect(ours({ pid: 2, port: 9399 }, read)).toBe(false)
    expect(
      ours({ pid: 3, port: 9399 }, () => {
        throw new Error('processus introuvable')
      })
    ).toBe(false)
  })
  it('environnement : langue et agent factice sur demande seulement', () => {
    expect(launchEnv({ PATH: '/bin' }, {})).toEqual({ PATH: '/bin', BOBINE_UPDATE_CHECK: 'off' })
    expect(launchEnv({}, { lang: 'en', 'agent-factice': 'permission' })).toEqual({
      BOBINE_UPDATE_CHECK: 'off',
      BOBINE_LANG: 'en',
      MOCK_AGENT_LANG: 'en',
      BOBINE_AGENT_PROFILE: 'mock',
      MOCK_AGENT_SCENARIO: 'permission'
    })
    // `--dossier` sur le profil temporaire : le premier « Choisir… » de l'accueil le rend.
    expect(launchEnv({}, { dossier: abs('/tmp/projet') })).toEqual({
      BOBINE_UPDATE_CHECK: 'off',
      BOBINE_PRESET_FOLDER: abs('/tmp/projet')
    })
    expect(launchEnv({}, { dossier: abs('/tmp/projet'), profil: abs('/tmp/profil') })).toEqual({
      BOBINE_UPDATE_CHECK: 'off'
    })
  })
  it('vérification des nouvelles versions coupée, sauf --verif-versions (fiche 274)', () => {
    // Coupée même si l'environnement l'avait laissée active.
    expect(launchEnv({ BOBINE_UPDATE_CHECK: 'on' }, {}).BOBINE_UPDATE_CHECK).toBe('off')
    // Demandée : rien ne la coupe, pas même un `off` hérité.
    expect(launchEnv({ BOBINE_UPDATE_CHECK: 'off' }, { 'verif-versions': true })).toEqual({})
    expect(parseArgs(['lancer', '--verif-versions']).options).toEqual({ 'verif-versions': true })
  })
})

describe('clic par libellé (fiche 210)', () => {
  /**
   * Page jouée dans jsdom : chaque élément a une boîte non vide (jsdom n'en calcule pas), et
   * `innerText` (absent de jsdom) suit `textContent`.
   */
  function page(html) {
    const dom = new JSDOM(`<body>${html}</body>`, { runScripts: 'outside-only' })
    const proto = dom.window.HTMLElement.prototype
    proto.getBoundingClientRect = () => ({ x: 10, y: 20, width: 30, height: 10 })
    proto.scrollIntoView = () => {}
    Object.defineProperty(proto, 'innerText', {
      get() {
        return this.textContent
      }
    })
    const clicks = []
    return {
      clicks,
      ev: async (expression) => dom.window.eval(expression),
      mouse: async (x, y) => clicks.push([x, y])
    }
  }
  // Fil : l'icône « Réessayer » sous le message ; carte : son bouton « Réessayer » (le bug).
  const ambiguous = `
    <div data-testid="user-message"><button aria-label="Réessayer" data-testid="message-retry">↻</button></div>
    <div data-testid="blocker-auth"><button data-testid="retry">Réessayer</button></div>`

  it('libellé ambigu : erreur claire qui liste les éléments trouvés, aucun clic', async () => {
    const p = page(ambiguous)
    await expect(clickLabel(p, 'Réessayer')).rejects.toThrow(
      '« Réessayer » ambigu : 2 éléments — Réessayer [message-retry] dans user-message | Réessayer [retry] dans blocker-auth'
    )
    expect(p.clicks).toEqual([])
  })

  it('zone précisée, ou libellé unique : un seul clic', async () => {
    const p = page(ambiguous)
    expect(await clickLabel(p, 'Réessayer', '[data-testid=blocker-auth]')).toBe('Réessayer')
    expect(p.clicks).toEqual([[25, 25]])
    const q = page(`<button>Réessayer</button><button>Réessayer plus tard</button>`)
    expect(await clickLabel(q, 'Réessayer')).toBe('Réessayer')
  })

  it('un cliquable dans un autre (étiquette et son bouton) ne compte qu’une fois', async () => {
    const p = page(`<label><button>Choisir</button></label>`)
    expect(await clickLabel(p, 'Choisir')).toBe('Choisir')
  })
})

describe('app lancée (`--app`)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pilote-app-'))
  const file = (path) => {
    mkdirSync(join(dir, path, '..'), { recursive: true })
    writeFileSync(join(dir, path), '')
    return join(dir, path)
  }

  it('une .app : son exécutable de Contents/MacOS', () => {
    const binary = file('Bobine.app/Contents/MacOS/Bobine')
    expect(appCommand(join(dir, 'Bobine.app'))).toEqual({
      command: binary,
      args: [],
      packaged: true
    })
  })

  it('sous Linux, l’exécutable installé ou le dossier qui le contient (fiche 145)', () => {
    const binary = file('linux-arm64-unpacked/bobine')
    file('linux-arm64-unpacked/resources/app.asar')
    expect(appCommand(binary)).toEqual({ command: binary, args: [], packaged: true })
    expect(appCommand(join(dir, 'linux-arm64-unpacked'))).toEqual({
      command: binary,
      args: [],
      packaged: true
    })
  })

  it('sinon le build du dépôt par son Electron ; un dossier sans build est refusé', () => {
    file('sources/out/main/index.js')
    expect(appCommand(join(dir, 'sources'))).toMatchObject({
      args: [join(dir, 'sources')],
      packaged: false
    })
    expect(() => appCommand(join(dir, 'vide'))).toThrow('pas de build')
  })
})
