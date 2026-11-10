import { createHmac } from 'node:crypto'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { L, check, sleep, withApp } from '../lib.mjs'

/** Calme d'une conversation neuve ramené à zéro pour l'essai (deux minutes dans l'app). */
const QUIET = { BOBINE_TIPS_QUIET_MS: '0' }

/**
 * Astuces de Bobine (fiche 191) : l'astuce de l'aparté paraît quand on tape pendant que l'agent
 * travaille, sur le bord haut de la saisie ; × la ferme, et elle ne revient pas après relance
 * (une par jour au plus). Contexte presque plein : l'astuce du contexte ; « Ne plus montrer » ;
 * Réglages › Général : le nombre d'astuces masquées et « Tout réafficher ».
 */
export async function tipsSuite(scheme) {
  console.log(`\n— Astuces de Bobine (${scheme})`)
  const profile = mkdtempSync(join(tmpdir(), 'bob-e2e-tips-'))
  const typeWhileBusy = async (ui) => {
    await ui.send('/scenario attend-stop')
    await ui.waitFor(`!!${ui.$('stop')}`, 15000)
    await ui.click(ui.$('composer-input'))
    await ui.type('Et au fait, pourquoi ce flag ?')
  }

  await withApp(
    scheme,
    async (ui) => {
      await ui.ready()
      await typeWhileBusy(ui)
      // Pas avant deux secondes de texte tapé.
      await sleep(800)
      check(!(await ui.ev(`!!${ui.$('tip-aside')}`)), 'pas d’astuce avant deux secondes')
      await ui.waitFor(`!!${ui.$('tip-aside')}`, 6000)
      const text = await ui.ev(`${ui.$('tip-aside')}.innerText`)
      check(
        text.includes('/btw') && text.includes('⇧⌘A'),
        `astuce de l’aparté sur la saisie (${text.replace(/\n/g, ' ')})`
      )
      await ui.shot('astuce-0-aparte')
      await ui.click(ui.$('tip-close'))
      await ui.waitFor(`!${ui.$('tip-aside')}`)
      check(true, '× : astuce fermée')
    },
    profile,
    'demo',
    QUIET
  )

  await withApp(
    scheme,
    async (ui) => {
      await ui.ready()
      await typeWhileBusy(ui)
      await sleep(3500)
      check(
        !(await ui.ev(`!!document.querySelector('.tip-tab')`)),
        'après relance : l’astuce fermée ne revient pas'
      )
    },
    profile,
    'demo',
    QUIET
  )

  // Autre profil : contexte presque plein, « Ne plus montrer », puis les réglages.
  await withApp(
    scheme,
    async (ui) => {
      await ui.ready()
      await ui.send('/scenario contexte-plein')
      await ui.ready()
      await ui.waitFor(`!!${ui.$('tip-context')}`, 8000)
      check(
        (await ui.ev(`${ui.$('tip-context')}.innerText`)).includes('%'),
        'contexte presque plein : astuce du contexte, avec le pourcentage'
      )
      await ui.shot('astuce-1-contexte')
      await ui.click(ui.$('tip-never'))
      await ui.waitFor(`!${ui.$('tip-context')}`)
      check(
        (await ui.ev(`window.api.tips.state().then((s) => s.hidden.join(','))`)) === 'context',
        '« Ne plus montrer » : masquée pour toujours'
      )
      await ui.click(ui.$('open-settings'))
      await ui.waitFor(`!!${ui.$('settings-tips')}`, 8000)
      const hint = await ui.ev(`${ui.$('settings-tips-hidden')}?.innerText`)
      check(
        hint === L('settings.general.tips.hidden', { count: 1 }) &&
          (await ui.ev(`${ui.$('settings-tips')}.checked`)),
        `Réglages › Général : astuces activées, « ${hint} »`
      )
      await ui.shot('astuce-2-reglage')
      await ui.click(ui.$('settings-tips-reset'))
      await ui.waitFor(`!${ui.$('settings-tips-hidden')}`)
      check(
        (await ui.ev(`window.api.tips.state().then((s) => s.hidden.length)`)) === 0,
        '« Tout réafficher » : plus rien de masqué'
      )
    },
    undefined,
    'demo',
    QUIET
  )

  // Même message, troisième jour : deux jours d'avant posés dans le profil, puis « Planifier… ».
  const planned = mkdtempSync(join(tmpdir(), 'bob-e2e-tips-plan-'))
  const MESSAGE = 'Fais le point sur les pull requests ouvertes du dépôt'
  let folder = ''
  await withApp(
    scheme,
    async (ui) => {
      await ui.ready()
      await ui.send('/scenario echo')
      await ui.ready()
      folder = await ui.ev(
        `window.api.conversations.get().then((s) => s.conversations.find((c) => !c.draft)?.workspace)`
      )
    },
    planned,
    'demo',
    QUIET
  )
  const normalized = MESSAGE.normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
  // Empreinte comme le main : HMAC avec la clé de l'installation, posée ici dans le profil.
  const salt = 'c'.repeat(64)
  const key = createHmac('sha256', salt)
    .update(`${folder}\0${normalized}`)
    .digest('hex')
    .slice(0, 32)
  const file = join(planned, 'settings.json')
  const saved = JSON.parse(readFileSync(file, 'utf8'))
  saved.tipsState = { hidden: [], salt, sent: [{ key, days: ['2020-01-01', '2020-01-02'] }] }
  writeFileSync(file, JSON.stringify(saved))
  await withApp(
    scheme,
    async (ui) => {
      await ui.ready()
      await ui.send(MESSAGE)
      // Fin du tour (réponse courte de l'agent factice) : l'astuce paraît alors seulement.
      await ui.ready()
      await ui.waitFor(`!!${ui.$('tip-scheduled')}`, 8000)
      check(
        (await ui.ev(`${ui.$('tip-scheduled')}.innerText`)).includes(L('tips.scheduled.plan')),
        `même message un troisième jour, à la fin du tour : « ${L('tips.scheduled.text')} »`
      )
      await ui.shot('astuce-3-planifier')
      await ui.click(ui.$('tip-plan'))
      await ui.waitFor(`!!${ui.$('scheduled-instruction')}`)
      check(
        (await ui.ev(`${ui.$('scheduled-instruction')}.value`)) === MESSAGE,
        '« Planifier… » : nouvelle tâche préremplie avec le message'
      )
      await ui.shot('astuce-4-tache-preremplie')
      // Rien d'enregistré avant « Enregistrer » ; Annuler ramène à la conversation.
      check(
        (await ui.ev(`window.api.schedule.list().then((l) => l.length)`)) === 0,
        'tâche préremplie : rien d’enregistré'
      )
      await ui.click(`${ui.$('scheduled-cancel')}`)
      await ui.waitFor(`!${ui.$('scheduled-form')} && !!${ui.$('composer-input')}`)
      check(true, '« Annuler » ramène à la conversation')
    },
    planned,
    'echo',
    QUIET
  )
}
