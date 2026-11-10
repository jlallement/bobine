import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  closeSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
  writeSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { L, Lpart, MAIN_PORT, check, mainProcess, root, sleep, withApp } from '../lib.mjs'

/**
 * Intégrité du profil (fiches 196, 197), sur des profils réels des versions 0.7, 0.8 et 0.9
 * (`e2e/fixtures/profils/`, faits avec les versions taguées) : ouverture sans perte, profil abîmé,
 * corbeille, restauration (réversible), lecture seule d'un profil plus récent, disque plein (une
 * vraie petite image disque, macOS seulement).
 */
const FIXTURES = join(root, 'e2e', 'fixtures', 'profils')
/** Date locale au format des tâches planifiées (`AAAA-MM-JJTHH:MM`). */
const localDateTime = (d) => {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
const HISTORY = `document.querySelectorAll('[data-testid=history-item]')`
const titles = `[...${HISTORY}].map((i) => i.innerText).join('\\n')`
const notices = `document.querySelectorAll('[data-testid=profile-notice]')`
const showing = (text) => `document.body.innerText.includes(${JSON.stringify(text)})`

function profileFrom(version) {
  const dir = mkdtempSync(join(tmpdir(), 'bob-e2e-profil-'))
  cpSync(join(FIXTURES, version), dir, { recursive: true })
  return dir
}

/** Empreinte de tous les fichiers d'un dossier (hors ceux de Chromium) : rien n'a-t-il bougé ? */
function fingerprint(dir) {
  const files = ['settings.json', 'profile.json', 'scheduled-tasks.json', 'usage.sqlite']
    .map((name) => join(dir, name))
    .concat(readdirSync(join(dir, 'conversations')).map((n) => join(dir, 'conversations', n)))
    .filter((f) => existsSync(f) && statSync(f).isFile())
    .sort()
  const hash = createHash('sha256')
  for (const file of files) hash.update(file).update(readFileSync(file))
  return hash.digest('hex')
}

const openSettingsData = async (ui, main) => {
  await main.evaluate(
    `require('electron').BrowserWindow.getAllWindows()[0].webContents.send('app:command', 'settings'); true`
  )
  await ui.waitFor(`!!${ui.$('settings-data')}`)
  await ui.click(ui.$('settings-data'))
  await ui.waitFor(`!!${ui.$('trash')}`)
}

const deleteNamed = async (ui, title) => {
  const item = `[...${HISTORY}].find((i) => i.innerText.includes(${JSON.stringify(title)}))`
  await ui.click(`${item}.querySelector('[data-testid=history-more]')`)
  await ui.waitFor(`!!${ui.$('history-delete')}`)
  await ui.click(ui.$('history-delete'))
  await ui.waitFor(`!!${ui.$('delete-dialog')}`)
}

export async function profileSuite(scheme) {
  console.log(`\n— Intégrité du profil (${scheme})`)
  if (scheme === 'light') {
    await realProfiles(scheme)
    await restoreAtLaunch(scheme)
    if (process.platform === 'darwin') await diskFull(scheme)
    else check(true, 'disque plein : image disque macOS seulement (ignoré ici)')
  }
  await damagedProfile(scheme)
  await trashAndRestoreConfirm(scheme)
  await readOnly(scheme)
}

/** Profils réels 0.7, 0.8, 0.9 : tout est là, rien à signaler, la marque de version posée. */
async function realProfiles(scheme) {
  for (const version of ['0.7', '0.8', '0.9']) {
    const dir = profileFrom(version)
    try {
      await withApp(
        scheme,
        async (ui) => {
          await ui.waitFor(`${HISTORY}.length === 3`)
          const shown = await ui.ev(titles)
          check(
            shown.includes('Épinglée et renommée') && shown.includes('/scenario diff'),
            `profil ${version} : les trois conversations, épinglée et renommée comprise`
          )
          check((await ui.ev(`${notices}.length`)) === 0, `profil ${version} : aucun avis`)
          check(
            !(await ui.ev(`!!${ui.$('onboarding')}`)),
            `profil ${version} : pas d’accueil du premier lancement`
          )
          const item = `[...${HISTORY}].find((i) => i.innerText.includes('Épinglée et renommée'))`
          await ui.click(item)
          await ui.waitFor(showing('Première conversation'))
          check(true, `profil ${version} : le fil se relit`)
          if (version === '0.7') await ui.shot('196-profil-0-7')
        },
        dir,
        'streaming-texte',
        // L'accueil est permis à cet essai : seul l'usage passé du profil doit l'écarter.
        { BOBINE_ONBOARDING: '1', BOBINE_TRIAL_DIR: dir }
      )
      const mark = JSON.parse(readFileSync(join(dir, 'profile.json'), 'utf8'))
      const settings = JSON.parse(readFileSync(join(dir, 'settings.json'), 'utf8'))
      check(settings.onboarding === undefined, `profil ${version} : aucune marque d’accueil écrite`)
      check(
        mark.formatVersion === 1 && settings.theme === 'dark' && settings.density === 'compact',
        `profil ${version} : marque de version posée, réglages gardés`
      )
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }
}

/** Réglages du mauvais type, autorisations tronquées, index perdu : tout est dit, rien n'est perdu. */
async function damagedProfile(scheme) {
  const dir = profileFrom('0.9')
  const openLog = join(dir, 'ouvertures.log')
  writeFileSync(join(dir, 'settings.json'), '[1,2,3]')
  writeFileSync(join(dir, 'approvals.json'), '{"sites": ["tronq')
  rmSync(join(dir, 'conversations', 'index.json'))
  rmSync(join(dir, 'conversations', 'index.json.bak'))
  try {
    await withApp(
      scheme,
      async (ui) => {
        await ui.waitFor(`${notices}.length === 3`)
        const levels = await ui.ev(`[...${notices}].map((n) => n.dataset.level).join()`)
        check(levels === 'warning,warning,info', `trois avis, chacun à sa gravité (${levels})`)
        check(
          (await ui.ev(showing(L('profile.notice.settingsDamaged')))) &&
            (await ui.ev(showing(L('profile.notice.indexRebuilt', { count: 3 })))),
          'réglages mis de côté ; liste des conversations refaite'
        )
        check(
          !(await ui.ev(
            `document.querySelector('[data-testid=profile-notices]').innerText.includes('.corrupt-')`
          )),
          'aucun nom de fichier dans les avis'
        )
        await ui.waitFor(`${HISTORY}.length === 3`)
        check(true, 'les trois conversations sont retrouvées dans leurs fils')
        await ui.shot('196-profil-abime')
        await ui.click(`${notices}[0].querySelector('[data-testid=profile-notice-reveal]')`)
        await ui.waitFor(`${notices}.length === 3`)
        await ui.click(`${notices}[0].querySelector('[data-testid=profile-notice-dismiss]')`)
        await ui.waitFor(`${notices}.length === 2`)
        check(true, 'un avis se ferme par ×')
      },
      dir,
      'streaming-texte',
      { BOBINE_OPEN_LOG: openLog }
    )
    const opened = existsSync(openLog) ? readFileSync(openLog, 'utf8') : ''
    check(
      /reveal .*settings\.json\.corrupt-/.test(opened),
      '« Afficher dans le Finder » montre le fichier mis de côté'
    )
    const files = readdirSync(dir)
    check(
      files.some((f) => f.startsWith('settings.json.corrupt-')) &&
        files.some((f) => f.startsWith('approvals.json.corrupt-')),
      'réglages et autorisations abîmés gardés à côté, jamais effacés'
    )
    const index = JSON.parse(readFileSync(join(dir, 'conversations', 'index.json'), 'utf8'))
    check(index.length === 3, `index réécrit avec les trois conversations (${index.length})`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/** Corbeille : suppression, restauration, effacement définitif ; confirmation d'une restauration. */
async function trashAndRestoreConfirm(scheme) {
  const dir = profileFrom('0.9')
  const legacy = profileFrom('0.7')
  const empty = mkdtempSync(join(tmpdir(), 'bob-e2e-pas-une-sauvegarde-'))
  const trash = join(dir, 'conversations', '.trash')
  try {
    await withApp(
      scheme,
      async (ui) => {
        await ui.waitFor(`${HISTORY}.length === 3`)
        await ui.ready()
        await deleteNamed(ui, 'Épinglée et renommée')
        check(
          (await ui.ev(`${ui.$('delete-from-agent')}?.checked`)) === false &&
            (await ui.ev(`${ui.$('delete-confirm')}.innerText`)) === L('deleteDialog.confirm'),
          'supprimer : « Mettre à la corbeille », session chez l’agent jamais cochée d’office'
        )
        await ui.shot('196-suppression')
        await ui.click(ui.$('delete-confirm'))
        await ui.waitFor(`${HISTORY}.length === 2`)
        const main = await mainProcess()
        try {
          await openSettingsData(ui, main)
          await ui.waitFor(`document.querySelectorAll('[data-testid=trash-item]').length === 1`)
          check(
            (await ui.ev(`${ui.$('trash')}.innerText`)).includes('Épinglée et renommée'),
            'la conversation est dans la corbeille de Réglages › Données'
          )
          await ui.shot('196-donnees-corbeille')
          await ui.click(ui.$('trash-restore'))
          await ui.waitFor(`!!${ui.$('trash-empty')}`)
          await ui.waitFor(`${HISTORY}.length === 3`)
          check(true, 'restaurée : de retour dans la liste, corbeille vide')

          // Restauration d'une sauvegarde : refusée pour un dossier quelconque, confirmée sinon.
          const choose = (folder) =>
            main.evaluate(
              `(() => { require('electron').dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [${JSON.stringify(folder)}] }); return true })()`
            )
          await choose(empty)
          await ui.click(ui.$('settings-restore'))
          await ui.waitFor(`!!${ui.$('settings-restore-refused')}`)
          check(
            (await ui.ev(`${ui.$('settings-restore-refused')}.innerText`)) ===
              L('settings.data.restore.notBackup'),
            'un dossier qui n’est pas une sauvegarde est refusé, en clair'
          )
          await choose(legacy)
          await ui.click(ui.$('settings-restore'))
          await ui.waitFor(`!!${ui.$('settings-restore-confirm')}`)
          check(
            (await ui.ev(`${ui.$('settings-restore-confirm')}.innerText`)).includes(
              Lpart('settings.data.restore.confirmText', { count: 3 })
            ) &&
              (await ui.ev(`${ui.$('settings-restore-confirm')}.innerText`)).includes(
                L('settings.data.restore.keys')
              ),
            'restauration : confirmation dans la carte, ce qui sera remplacé, les clés à ressaisir'
          )
          await ui.shot('197-restauration-confirmation')
          // Échap annule (pas la fenêtre des réglages) : rien n'est restauré.
          await ui.ev(`${ui.$('settings-restore-confirm')}.querySelector('button').focus()`)
          await ui.key('Escape')
          await ui.waitFor(`!${ui.$('settings-restore-confirm')}`)
          check(
            !!(await ui.ev(`!!${ui.$('settings')}`)),
            'Échap ferme la confirmation, pas les réglages'
          )
          check(
            !existsSync(join(dir, 'restauration-demandee.json')),
            'Échap : aucune restauration demandée'
          )

          // Effacement définitif, confirmé dans la ligne.
          await ui.click(`document.querySelector('.settings-close')`)
          await ui.waitFor(`!${ui.$('settings')}`)
          await deleteNamed(ui, '/scenario diff')
          await ui.click(ui.$('delete-confirm'))
          await ui.waitFor(`${HISTORY}.length === 2`)
          await openSettingsData(ui, main)
          await ui.waitFor(`document.querySelectorAll('[data-testid=trash-item]').length === 1`)
          await ui.click(ui.$('trash-erase'))
          await ui.waitFor(`!!${ui.$('confirm-row-confirm')}`)
          await ui.click(ui.$('confirm-row-confirm'))
          await ui.waitFor(`!!${ui.$('trash-empty')}`)
        } finally {
          main.close()
        }
      },
      dir,
      'streaming-texte',
      {},
      [`--inspect=${MAIN_PORT}`]
    )
    const left = existsSync(trash) ? readdirSync(trash) : []
    check(
      left.length === 0,
      `effacée définitivement : plus rien sur le disque (${left.join(', ')})`
    )
  } finally {
    for (const d of [dir, legacy, empty]) rmSync(d, { recursive: true, force: true })
  }
}

/** Restauration faite au lancement, puis défaite en restaurant l'état d'avant (réversible). */
async function restoreAtLaunch(scheme) {
  const dir = profileFrom('0.9')
  const backup = profileFrom('0.7')
  const job = (folder) =>
    writeFileSync(join(dir, 'restauration-demandee.json'), JSON.stringify({ folder }))
  try {
    job(backup)
    await withApp(
      scheme,
      async (ui) => {
        await ui.waitFor(`${notices}.length === 1`)
        check(
          (await ui.ev(`${notices}[0].dataset.level`)) === 'success',
          'restauration faite : avis de succès'
        )
        await ui.waitFor(`${HISTORY}.length === 3`)
        check((await ui.ev(titles)).includes('0.7.0'), 'les conversations de la sauvegarde sont là')
        await ui.shot('197-restauration-faite')
      },
      dir,
      'streaming-texte'
    )
    const kept = readdirSync(join(dir, 'restaurations')).filter((n) => n.startsWith('avant-'))
    check(kept.length === 1, 'l’état d’avant est gardé dans restaurations/')
    job(join(dir, 'restaurations', kept[0] ?? ''))
    await withApp(
      scheme,
      async (ui) => {
        await ui.waitFor(`${HISTORY}.length === 3`)
        check(
          (await ui.ev(titles)).includes('0.9.1'),
          'l’état d’avant se restaure : retour au profil 0.9'
        )
      },
      dir,
      'streaming-texte'
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
    rmSync(backup, { recursive: true, force: true })
  }
}

/** Profil d'une version plus récente : lecture seule, rien ne s'envoie, rien ne s'écrit. */
async function readOnly(scheme) {
  const dir = profileFrom('0.9')
  const folder = mkdtempSync(join(tmpdir(), 'bob-e2e-tache-'))
  writeFileSync(join(dir, 'profile.json'), '{"formatVersion": 9, "app": "9.0.0"}\n')
  // Une tâche planifiée échue : en lecture seule, elle ne doit rien lancer.
  const past = new Date(Date.now() - 5 * 60_000)
  writeFileSync(
    join(dir, 'scheduled-tasks.json'),
    JSON.stringify({
      version: 1,
      tasks: [
        {
          id: 'tache-e2e',
          name: 'Rapport',
          instruction: 'Bonjour',
          folder,
          profileId: 'mock',
          schedule: { kind: 'once', at: localDateTime(past) },
          worktree: false,
          catchUp: true,
          paused: false,
          createdAt: new Date(Date.now() - 3_600_000).toISOString(),
          nextRunAt: past.toISOString(),
          runs: []
        }
      ]
    })
  )
  const before = fingerprint(dir)
  try {
    await withApp(
      scheme,
      async (ui) => {
        await ui.waitFor(`!!${ui.$('profile-readonly')}`)
        check(!(await ui.ev(`!!${ui.$('onboarding')}`)), 'lecture seule : pas d’accueil')
        await ui.waitFor(`!!${ui.$('composer-readonly')}`)
        check(
          await ui.ev(`${ui.$('new-conversation')}.disabled`),
          'lecture seule : « Nouvelle conversation » désactivée'
        )
        check(
          await ui.ev(`!!${ui.$('composer-readonly')}.querySelector('[inert]')`),
          'la saisie est inerte, la raison dessous'
        )
        await ui.waitFor(`${HISTORY}.length === 3`)
        const item = `[...${HISTORY}].find((i) => i.innerText.includes('Épinglée et renommée'))`
        await ui.click(item)
        await ui.waitFor(showing('Première conversation'))
        check(true, 'les conversations se relisent')
        await ui.shot('196-lecture-seule')
        // Menus : ce qui changerait le profil est désactivé (pas masqué), la raison en infobulle.
        await ui.click(`${item}.querySelector('[data-testid=history-more]')`)
        await ui.waitFor(`!!${ui.$('history-delete')}`)
        // Souris hors du menu : l'infobulle d'un élément survolé retire son `title` le temps de
        // l'afficher.
        await ui.hover({ x: 1200, y: 1500 })
        const lockedAll = `['pin', 'rename', 'archive', 'delete'].every((n) => document.querySelector('[data-testid=history-' + n + ']')?.hasAttribute('data-disabled'))`
        const reason = JSON.stringify(L('profile.readOnly.line'))
        await ui.waitFor(`${lockedAll} && ${ui.$('history-delete')}.title === ${reason}`)
        check(
          !(await ui.ev(`${ui.$('history-export-markdown')}.hasAttribute('data-disabled')`)),
          'lecture seule : épingler, renommer, archiver, supprimer désactivés ; exporter permis'
        )
        await ui.shot('196-lecture-seule-menu')
        await ui.key('Escape')
        // Envoi forcé par l'IPC, sans passer par la saisie : refusé par le main.
        const refused = await ui.ev(
          `window.api.conversations.get().then((s) => window.api.agent.prompt(s.activeId, 'perdu ?')).then(() => 'envoyé', (e) => String(e))`
        )
        check(/Lecture seule|Read-only/.test(refused), 'un envoi par l’IPC est refusé lui aussi')
        await ui.click(ui.$('open-activity'))
        await ui.waitFor(`!!${ui.$('activity-readonly')}`)
        check(true, 'Mon activité : la lecture seule est dite, pas une page vide')
        await ui.click(ui.$('open-scheduled'))
        await ui.waitFor(`!!${ui.$('scheduled-readonly')}`)
        check(true, 'Tâches planifiées : la lecture seule est dite')
        await sleep(3000)
        check((await ui.ev(`${HISTORY}.length`)) === 3, 'la tâche échue n’a rien lancé')
      },
      dir,
      'streaming-texte',
      { BOBINE_ONBOARDING: '1', BOBINE_TRIAL_DIR: dir }
    )
    check(
      fingerprint(dir) === before,
      'rien n’a été écrit dans le profil (réglages, index, fils, marque, tâches, consommation)'
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
    rmSync(folder, { recursive: true, force: true })
  }
}

/**
 * Disque plein pour de vrai : le profil sur une petite image disque, remplie pendant que l'app
 * tourne. L'échec est dit en clair, sans fichier temporaire laissé ; une fois de la place libérée,
 * les messages arrivent sur le disque.
 */
async function diskFull(scheme) {
  const work = mkdtempSync(join(tmpdir(), 'bob-e2e-disque-'))
  const image = join(work, 'disque.dmg')
  const mount = join(work, 'volume')
  mkdirSync(mount)
  execFileSync(
    'hdiutil',
    ['create', '-size', '160m', '-fs', 'HFS+', '-volname', 'BobineE2E', image],
    {
      stdio: 'ignore'
    }
  )
  execFileSync('hdiutil', ['attach', image, '-mountpoint', mount, '-nobrowse', '-noverify'], {
    stdio: 'ignore'
  })
  const userData = join(mount, 'profil')
  const filler = join(mount, 'remplissage')
  const fill = () => {
    const fd = openSync(filler, 'a')
    try {
      for (const size of [1 << 20, 1 << 16, 1 << 12]) {
        const block = Buffer.alloc(size)
        try {
          for (;;) writeSync(fd, block)
        } catch {
          // Plus de place pour un bloc de cette taille : on passe au plus petit.
        }
      }
    } finally {
      closeSync(fd)
    }
  }
  try {
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        await ui.send('Avant le disque plein')
        await ui.ready()
        fill()
        await ui.send('Pendant le disque plein')
        await ui.ready()
        await ui.waitFor(showing(Lpart('conversations.saveFailedDiskFull')), 20_000)
        // Les avis de l'app (pas ceux de l'agent, dont l'erreur est la sienne) : sans code.
        const saveFailed = JSON.stringify(Lpart('conversations.saveFailedDiskFull'))
        const appNotices = await ui.ev(
          `[...document.querySelectorAll('.notice')].map((n) => n.innerText).filter((t) => t.includes(${saveFailed})).join(' | ')`
        )
        check(
          appNotices !== '' && !appNotices.includes('ENOSPC'),
          'disque plein : dit en clair par l’app, sans code d’erreur'
        )
        await ui.shot('197-disque-plein')
        const conversations = join(userData, 'conversations')
        const tmps = readdirSync(conversations).filter((f) => f.endsWith('.tmp'))
        check(tmps.length === 0, `aucun fichier temporaire laissé (${tmps.join(', ')})`)
        rmSync(filler, { force: true })
        await ui.send('Après le disque plein')
        await ui.ready()
        await sleep(2000)
        const saved = readdirSync(conversations)
          .filter((f) => /^[\w-]+\.json$/.test(f) && f !== 'index.json')
          .map((f) => readFileSync(join(conversations, f), 'utf8'))
          .join('\n')
        check(
          saved.includes('Pendant le disque plein') && saved.includes('Après le disque plein'),
          'place libérée : les messages écrits pendant le disque plein sont sur le disque'
        )
      },
      userData,
      'streaming-texte'
    )
  } finally {
    try {
      execFileSync('hdiutil', ['detach', mount, '-force'], { stdio: 'ignore' })
    } catch {
      // Déjà détachée.
    }
    rmSync(work, { recursive: true, force: true })
  }
}
