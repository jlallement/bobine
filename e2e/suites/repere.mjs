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
import { L, check, sleep, withApp } from '../lib.mjs'

/**
 * Repère en bas du fil (fiche 261, écran E), contre l'agent factice, dans un dépôt git jetable avec
 * deux rôles du projet (un nom court, un nom long). Le verrou de fin de tour de l'agent factice
 * retient les filles des rôles pendant qu'on remonte le fil ; on l'enlève, elles finissent hors de
 * l'écran :
 * - un rôle : « ↑ Expert sécu a répondu · Voir » ; « Voir » fait défiler jusqu'à la carte,
 *   l'entoure, lui donne le focus ; le repère s'en va ;
 * - deux rôles : « ↑ 2 travaux ont répondu », « Voir » mène au plus ancien, l'autre reste, puis
 *   s'en va quand sa carte est vue ;
 * - 900 px, nom long : seul le nom se coupe, jamais le verbe ;
 * - avec « ↓ N nouveaux » : la pastille passe à droite, le repère reste lisible.
 */
export async function repereSuite(scheme) {
  console.log(`\n— Repère en bas du fil (${scheme})`)
  const workspace = realpathSync(mkdtempSync(join(tmpdir(), 'bob-e2e-repere-')))
  const git = (...args) =>
    execFileSync('git', ['-c', 'user.name=e2e', '-c', 'user.email=e2e@example.invalid', ...args], {
      cwd: workspace,
      encoding: 'utf8'
    }).trim()
  writeFileSync(join(workspace, 'README.md'), '# Carnet\n')
  mkdirSync(join(workspace, '.bobine', 'roles'), { recursive: true })
  const role = (name, label, icon, color) =>
    writeFileSync(
      join(workspace, '.bobine', 'roles', `${name}.md`),
      [
        '---',
        `name: ${name}`,
        `label: ${label}`,
        `icon: ${icon}`,
        `color: ${color}`,
        'description: Relit le projet et donne son avis.',
        'mode: ask',
        'read-only: true',
        '---',
        'Tu relis ce projet et tu donnes ton avis.',
        ''
      ].join('\n')
    )
  role('security-expert', 'Expert sécu', 'shield-check', 'orange')
  role('a11y-expert', LONG_LABEL, 'palette', 'violet')
  git('init', '-q', '-b', 'main')
  git('add', '.')
  git('commit', '-q', '-m', 'init')
  const locks = realpathSync(mkdtempSync(join(tmpdir(), 'bob-e2e-repere-verrou-')))
  const turnLock = join(locks, 'verrou')
  try {
    await withApp(scheme, (ui) => run(ui, turnLock), undefined, 'streaming-texte', {
      BOBINE_WORKSPACE: workspace,
      MOCK_AGENT_TURN_LOCK: turnLock
    })
  } finally {
    rmSync(workspace, { recursive: true, force: true })
    rmSync(locks, { recursive: true, force: true })
  }
}

// 40 caractères au plus (`ROLE_LIMITS.label`), assez pour dépasser les 28ch du nom.
const LONG_LABEL = 'Experte en accessibilité des écrans web'
const input = `document.querySelector('[data-testid="composer-input"]')`
const scroller = `document.querySelector('.thread').closest('.scroll')`
const cue = `document.querySelector('[data-testid=work-cue]')`
// Travaux à place fixe : cartes-réponses sous leur bulle (fiche 263), lignes d'une carte de groupe
// quand une bulle cite plusieurs rôles (fiche 264).
const WORKS = '[data-testid=work-card]:not(.in-group), [data-testid=work-row]'
const works = `document.querySelectorAll(${JSON.stringify(WORKS)})`
// Ceux qui ont répondu.
const reports = `[...${works}].filter((w) => w.dataset.state === 'replied')`

/** Tours retenus par le verrou de l'agent factice (une ligne chacun, `docs/mock-agent.md`). */
const held = (turnLock) => {
  const file = `${turnLock}.retenus`
  return existsSync(file) ? readFileSync(file, 'utf8').split('\n').filter(Boolean).length : 0
}

async function heldTurns(turnLock, count, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs
  while (held(turnLock) < count) {
    if (Date.now() > deadline) throw new Error(`tours retenus : ${held(turnLock)} sur ${count}`)
    await sleep(50)
  }
}

/** Confie un travail à un ou plusieurs rôles (`@rôle …`), retenu par le verrou jusqu'au relâché. */
async function delegate(ui, turnLock, text, roles) {
  writeFileSync(turnLock, '')
  const before = held(turnLock)
  const launches = await ui.ev(`${works}.length`)
  await ui.ev(`${input}.focus()`)
  await ui.type(text)
  await ui.press('Escape')
  await ui.waitFor(`!!document.querySelector('[data-testid=role-destination]')`)
  await ui.enter()
  await ui.waitFor(`${works}.length === ${launches + roles}`, 30000)
  await heldTurns(turnLock, before + roles)
}

/** Remonte le fil tout en haut et vérifie qu'il n'est plus en bas. */
async function scrollUp(ui) {
  await ui.waitFor(
    `(() => { const s = ${scroller}; s.scrollTop = 0; return s.scrollHeight - s.clientHeight - s.scrollTop > 400 })()`
  )
}

/** La carte est-elle à l'écran, dans le fil ? */
const onScreen = (element) =>
  `(() => { const el = ${element}; if (!el) return false; const r = el.getBoundingClientRect(); const v = ${scroller}.getBoundingClientRect(); return r.bottom > v.top + 24 && r.top < v.bottom - 24 })()`

const cueText = (ui) =>
  ui.ev(`document.querySelector('[data-testid=work-cue-text]')?.innerText.replace(/\\s+/g, ' ')`)

async function run(ui, turnLock) {
  await ui.ready()
  await ui.closePanel()
  await ui.send('Bonjour')
  await ui.ready()
  // Un fil long : de quoi remonter loin au-dessus des cartes.
  await ui.send('/scenario fil-long')
  await ui.ready()

  // Un rôle, qui répond pendant qu'on relit le haut du fil.
  await delegate(ui, turnLock, '@security-expert relis le module de connexion', 1)
  await scrollUp(ui)
  rmSync(turnLock, { force: true })
  await ui.waitFor(`${reports}.length === 1 && !!${cue}`, 30000)
  const one = await cueText(ui)
  check(
    one === `Expert sécu ${L('workCue.replied')}` &&
      !(await ui.ev(onScreen(`${reports}.at(-1)`))) &&
      (await ui.ev(`!!${cue}.querySelector('[data-testid=role-avatar]')`)),
    `un rôle répond hors de l’écran : « ↑ ${one} · Voir », avec son avatar`
  )
  await ui.shot('261-repere-un-role')
  // Clic direct sur « Voir » : le clic à la souris de l'essai prend plus que la durée de l'anneau.
  await ui.ev(`${cue}.querySelector('[data-testid=work-cue-show]').click()`)
  await ui.waitFor(onScreen(`${reports}.at(-1)`))
  // L'anneau ne dure que 1,4 s : figé à son éclat le temps de la photo (l'essai l'a vu ci-dessus).
  await ui.ev(
    `${reports}.at(-1).getAnimations().forEach((a) => { a.pause(); a.currentTime = 300 })`
  )
  await ui.shot('261-repere-anneau')
  await ui.ev(`${reports}.at(-1).getAnimations().forEach((a) => a.play())`)
  await ui.waitFor(`!${reports}.at(-1).hasAttribute('data-cue-flash')`, 4000)

  // Deux rôles : un nombre, « Voir » va au plus ancien, l'autre reste jusqu'à ce qu'on le voie.
  await delegate(ui, turnLock, '@security-expert @code-reviewer relisez calc.js', 2)
  await scrollUp(ui)
  rmSync(turnLock, { force: true })
  await ui.waitFor(`${reports}.length === 3 && ${cue}?.dataset.count === '2'`, 30000)
  await ui.shot('261-repere-deux')
  await ui.click(`${cue}.querySelector('[data-testid=work-cue-show]')`)
  await ui.waitFor(`${cue}?.dataset.count === '1'`)
  await ui.ev(`(() => { const s = ${scroller}; s.scrollTop = s.scrollHeight })()`)
  await ui.waitFor(`!${cue}`)

  // 900 px, nom long : seul le nom se coupe, jamais le verbe.
  await ui.viewport(900, 760)
  await delegate(ui, turnLock, '@a11y-expert relis l’accessibilité de l’écran', 1)
  await scrollUp(ui)
  rmSync(turnLock, { force: true })
  await ui.waitFor(`${reports}.length === 4 && !!${cue}`, 30000)
  const narrow = await ui.ev(`(() => {
    const name = ${cue}.querySelector('.work-cue-name')
    const verb = ${cue}.querySelector('.work-cue-verb')
    const box = ${cue}.getBoundingClientRect()
    const v = verb.getBoundingClientRect()
    return {
      cut: name.scrollWidth > name.clientWidth,
      verb: verb.innerText,
      verbInside: v.left >= box.left && v.right <= box.right && verb.scrollWidth <= verb.clientWidth + 1,
      title: name.title
    }
  })()`)
  check(
    narrow.cut &&
      narrow.verb === L('workCue.replied') &&
      narrow.verbInside &&
      narrow.title === LONG_LABEL,
    `900 px, nom long : le nom coupé (titre complet en infobulle), le verbe entier (${JSON.stringify(narrow)})`
  )
  await ui.shot('261-repere-900')
  await ui.click(`${cue}.querySelector('[data-testid=work-cue-show]')`)
  await ui.waitFor(`!${cue}`)
  await ui.viewport()

  // Avec « ↓ N nouveaux » : l'agent écrit pendant qu'on relit, et un rôle répond.
  await delegate(ui, turnLock, '@security-expert vérifie encore', 1)
  await ui.send('/scenario fil-long')
  await ui.waitFor(
    `(() => {
      const s = ${scroller}
      if (s.scrollHeight > s.clientHeight + 120) s.scrollTop = 0
      return /\\d/.test(${ui.$('scroll-to-bottom')}?.innerText ?? '')
    })()`,
    20_000
  )
  rmSync(turnLock, { force: true })
  await ui.waitFor(
    `(() => { ${scroller}.scrollTop = 0; return !!${cue} && /\\d/.test(${ui.$('scroll-to-bottom')}?.innerText ?? '') })()`,
    30000
  )
  const both = await ui.ev(`(() => {
    const pill = ${ui.$('scroll-to-bottom')}.getBoundingClientRect()
    const dock = document.querySelector('.thread-dock').getBoundingClientRect()
    const line = ${cue}.querySelector('.work-cue-in').getBoundingClientRect()
    return {
      right: Math.round(dock.right - 24 - pill.right),
      clear: pill.bottom <= line.top || pill.left >= line.right
    }
  })()`)
  check(
    Math.abs(both.right) <= 4 && both.clear,
    `repère et « ↓ N nouveaux » ensemble : la pastille à droite, sans couvrir le repère (${JSON.stringify(both)})`
  )
  await ui.shot('261-repere-et-nouveaux')
  await ui.ready()
}
