import { existsSync, mkdtempSync, readdirSync, readFileSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { L, MAIN_PORT, check, mainProcess, sleep, withApp } from '../lib.mjs'

/** Attend une condition sur le disque (l'app vient de quitter, l'assistant travaille). */
async function until(test, ms = 15_000) {
  const start = Date.now()
  while (Date.now() - start < ms) {
    if (test()) return true
    await sleep(200)
  }
  return false
}

/** Réglages › Données, la section « Recommencer à neuf » amenée à l'écran si elle est là. */
async function openData(ui) {
  await ui.click(ui.$('open-settings'))
  await ui.waitFor(`!!${ui.$('settings')}`)
  await ui.click(ui.$('settings-data'))
  await ui.waitFor(`!!${ui.$('usage-reset-card')}`)
  await sleep(300)
}

/**
 * Recommencer à neuf (fiche 148) : une Bobine sur un profil temporaire (pastille, dossier dans les
 * fichiers temporaires, supprimé à la fermeture, pas de section) ; puis la réinitialisation d'une
 * Bobine d'essai : confirmation avec ses lignes, l'app quitte, son dossier part dans une corbeille
 * d'essai avec le LISEZ-MOI (pas de relance, trousseau jamais touché : dossier imposé).
 */
export async function freshStartSuite(scheme) {
  console.log(`\n— Recommencer à neuf (${scheme})`)
  await temporaryProfile(scheme)
  await reset(scheme)
}

async function temporaryProfile(scheme) {
  let folder = ''
  await withApp(
    scheme,
    async (ui) => {
      await ui.ready()
      await ui.waitFor(`!!${ui.$('temporary-profile')}`)
      check(
        (await ui.ev(`${ui.$('temporary-profile')}.innerText`)) === L('settings.data.fresh.chip'),
        'profil temporaire : la pastille dans la barre de titre'
      )
      const main = await mainProcess()
      try {
        folder = await main.evaluate(`require('electron').app.getPath('userData')`)
      } finally {
        main.close()
      }
      check(
        realpathSync(folder).startsWith(join(realpathSync(tmpdir()), 'bobine-profil-')),
        `dossier de données dans les fichiers temporaires (${folder})`
      )
      await openData(ui)
      check(
        !(await ui.ev(`!!${ui.$('fresh-start-card')}`)),
        'profil temporaire : pas de « Recommencer à neuf » dans Données'
      )
      await ui.key('Escape')
      await sleep(300)
      await ui.shot('148-profil-temporaire')
    },
    undefined,
    'demo',
    {},
    ['--profil-temporaire', `--inspect=${MAIN_PORT}`]
  )
  check(
    await until(() => !existsSync(folder)),
    'fermée, la Bobine temporaire ne laisse rien : son dossier est supprimé'
  )
}

async function reset(scheme) {
  const userData = mkdtempSync(join(tmpdir(), 'bob-e2e-neuf-'))
  // L'app le cite par son vrai chemin (`/private/var/…` sur macOS).
  const realUserData = realpathSync(userData)
  const trash = mkdtempSync(join(tmpdir(), 'bob-e2e-corbeille-'))
  await withApp(
    scheme,
    async (ui) => {
      await ui.ready()
      await ui.send('Bonjour')
      await ui.ready()
      await openData(ui)
      await ui.ev(`${ui.$('fresh-start-card')}.scrollIntoView({ block: 'center' })`)
      await ui.click(ui.$('fresh-start-reset'))
      await ui.waitFor(`${ui.$('fresh-start-trash')}?.querySelectorAll('li').length === 5`)
      const trashed = await ui.ev(
        `[...${ui.$('fresh-start-trash')}.querySelectorAll('li')].map((li) => li.dataset.kind + ' ' + li.innerText.replace(/\\s+/g, ' '))`
      )
      // L'app compte ses fils de conversation (celle de l'accueil comprise) : ceux du disque.
      const saved = readdirSync(join(userData, 'conversations')).filter((f) =>
        f.endsWith('.json')
      ).length
      check(
        trashed[0]?.startsWith('conversations') &&
          trashed[0].includes(`${L('settings.data.fresh.kind.conversations')} ${saved} ·`),
        `confirmation : les conversations comptées, avec leur taille (${trashed[0]})`
      )
      check(
        trashed.map((line) => line.split(' ')[0]).join(',') ===
          'conversations,settings,usage,browser,other',
        'confirmation : conversations, réglages, consommation, navigateur, le reste'
      )
      check(
        !(await ui.ev(`!!${ui.$('fresh-start-uninstall')}`)) &&
          (await ui.ev(`${ui.$('fresh-start-confirm-reset')}.innerText`)) ===
            L('settings.data.fresh.confirmClose') &&
          !(await ui.ev(
            `${ui.$('fresh-start-confirm')}.innerText.includes('Bobine Safe Storage')`
          )),
        'app non installée, dossier imposé : ni désinstallation, ni trousseau, « Tout effacer et fermer »'
      )
      await ui.ev(`${ui.$('fresh-start-confirm')}.scrollIntoView({ block: 'center' })`)
      await ui.shot('148b-reinitialiser')
      // « Garder » referme sans rien effacer ; puis confirmé pour de bon.
      await ui.click(ui.$('confirm-row-keep'))
      await ui.waitFor(`!${ui.$('fresh-start-confirm')}`)
      check(existsSync(userData), '« Garder » : rien n’est effacé')
      await ui.click(ui.$('fresh-start-reset'))
      await ui.waitFor(`${ui.$('fresh-start-confirm-reset')}?.disabled === false`)
      await ui.click(ui.$('fresh-start-confirm-reset'))
      // L'app quitte ; l'assistant déplace son dossier dans la corbeille d'essai.
      // Le LISEZ-MOI arrive en dernier (écrit d'un coup) : l'assistant a fini.
      const readmeIn = () =>
        join(trash, readdirSync(trash)[0] ?? '-', L('settings.data.fresh.readmeName'))
      check(
        await until(() => !existsSync(userData) && existsSync(readmeIn())),
        'confirmé : Bobine quitte, son dossier part dans un dossier daté de la corbeille'
      )
      const folder = join(trash, readdirSync(trash)[0])
      const readme = readmeIn()
      check(
        readdirSync(folder).includes(userData.split('/').pop()) &&
          existsSync(readme) &&
          readFileSync(readme, 'utf8').includes(`  <-  ${realUserData}`),
        `corbeille : le dossier de données et ${L('settings.data.fresh.readmeName')} qui dit d’où il vient`
      )
    },
    userData,
    'echo',
    { BOBINE_TRASH_DIR: trash, BOBINE_RESET_RELAUNCH: 'off' }
  )
}
