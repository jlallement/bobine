import { execFileSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { L, MAIN_PORT, check, mainProcess, sleep, withApp } from '../lib.mjs'

/**
 * Pannes visibles (fiches 194 et 195), contre l'agent factice : bandeau d'un agent silencieux,
 * aucun processus restant après avoir quitté en plein tour (agent qui ignore SIGTERM), `kill -9`
 * de Bobine puis rapport local au lancement suivant et orphelins arrêtés, élément du fil illisible
 * remplacé sans emporter la fenêtre, avis d'erreur interne du main.
 */
/** Proxy saisi pour la suite (fiche 275) : jamais affiché en clair. */
const PROXY = 'http://jean:s3cr3t@proxy.exem21ple.test:3128'

export async function failuresVisibleSuite(scheme) {
  console.log(`\n— Pannes visibles (${scheme})`)
  const userData = mkdtempSync(join(tmpdir(), 'bob-e2e-pannes-visibles-'))
  // Silence au bout de 1,5 s (5 min dans l'app) ; agent tenace : seul SIGKILL l'arrête.
  const env = { BOBINE_SILENCE_MS: '1500', MOCK_AGENT_TENACE: '1' }
  const inspect = [`--inspect=${MAIN_PORT}`]
  try {
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        // 0. Agent qui ne joint pas son modèle (OpenCode 2.3.0 derrière un proxy injoignable,
        // fiche 275) : reprises lues par le profil, bandeau tout de suite, piste Wi-Fi / VPN sans
        // proxy ; « Réglages réseau » mène au champ du proxy, qu'on renseigne pour la suite.
        await ui.send('/scenario reseau-injoignable-2-3')
        await ui.waitFor(`${ui.$('agent-unreachable')}?.dataset.attempt >= 3`, 15000)
        await ui.ev(`${ui.$('agent-unreachable')}.querySelector('details').open = true; true`)
        await ui.shot('275-injoignable')
        await ui.click(ui.$('agent-unreachable-settings'))
        await ui.waitFor(
          `${ui.$('settings-agents-advanced')}?.open === true && document.activeElement === ${ui.$('network-proxy')}`,
          10000
        )
        await ui.type(PROXY)
        await ui.key('Enter')
        await ui.waitFor(`!!${ui.$('network-note')}`)
        await ui.key('Escape')
        await ui.waitFor(`!${ui.$('settings')}`)
        // Proxy enregistré, agent lancé sans lui (fiche 276, T4) : le bandeau le dit aussitôt, et
        // « Relancer l'agent » prend la place de « Réglages réseau ».
        await ui.waitFor(`${ui.$('agent-unreachable-hint')}?.hasAttribute('data-stale')`, 10000)
        await ui.shot('276-injoignable-relancer')
        const sentBefore = await ui.ev(`document.querySelectorAll('.msg-user').length`)
        await ui.click(ui.$('agent-unreachable-restart'))
        await ui.ready()
        const restarted = await ui.ev(
          `({ input: ${ui.$('composer-input')}.value, sent: document.querySelectorAll('.msg-user').length, banner: !!${ui.$('agent-unreachable')} })`
        )
        check(
          restarted.input.includes('/scenario reseau-injoignable-2-3') &&
            restarted.sent === sentBefore &&
            !restarted.banner,
          `« Relancer l’agent » : agent relancé, message remis dans la saisie, rien d’envoyé (${JSON.stringify(restarted)})`
        )
        await ui.shot('276-message-remis')
        // Saisie vidée pour la suite (comme un utilisateur qui efface).
        await ui.ev(
          `(() => { const el = ${ui.$('composer-input')}; Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, ''); el.dispatchEvent(new Event('input', { bubbles: true })); return true })()`
        )
        await ui.waitFor(`${ui.$('composer-input')}.value === ''`)
        // 1. Agent silencieux : bandeau neutre, « Attendre » le masque, « Arrêter » arrête.
        await ui.send('/scenario muet')
        await ui.waitFor(`!!${ui.$('silence-banner')}`, 15000)
        await ui.shot('194-silence')
        await ui.click(ui.$('silence-wait'))
        await ui.waitFor(`!${ui.$('silence-banner')}`)
        await ui.click(ui.$('stop'))
        await ui.waitFor(`!!${ui.$('restart')}`, 25000)
        await sleep(1000)
        const stopped = await ui.ev(
          `[...document.querySelectorAll('.notice-error')].filter((n) => n.innerText.includes(${JSON.stringify(L('agentHost.exit.unresponsive'))})).length`
        )
        check(
          stopped === 1,
          `agent figé qui ignore Stop et SIGTERM : arrêté, un seul avis clair (${stopped})`
        )
        await ui.send('/scenario streaming-texte')
        await ui.ready()
        // Agent relancé avec le proxy saisi plus haut (fiche 275) : silence sans contenu, puis
        // reprises (proxy cité masqué, nulle part en clair : vérifié dans `parcours-reglages`).
        await ui.send('/scenario silence-annulable')
        await ui.waitFor(`!!${ui.$('silence-proxy')}`, 15000)
        await ui.shot('275-silence-proxy')
        await ui.click(ui.$('silence-stop'))
        await ui.ready()
        await ui.send('/scenario reseau-injoignable-2-3')
        await ui.waitFor(`!!${ui.$('agent-unreachable')}`, 15000)
        await ui.shot('275-injoignable-proxy')
        await ui.click(ui.$('agent-unreachable-stop'))
        await ui.ready()
        // Agent tué par kill -9 pendant une commande (fiche 195, D3) : la commande ne lui survit pas.
        await ui.send('/scenario plantage-avec-enfant')
        await ui.waitFor(`!!${ui.$('restart')}`, 20000)
        let sleeping = []
        for (let i = 0; i < 40; i++) {
          sleeping = execFileSync('ps', ['-A', '-ww', '-o', 'pid=,command='], { encoding: 'utf8' })
            .split('\n')
            .filter((line) => line.trim().endsWith('sleep 31.7'))
          if (sleeping.length === 0) break
          await sleep(250)
        }
        check(
          sleeping.length === 0,
          `agent tué par kill -9 : sa commande ne survit pas (${sleeping})`
        )
        await ui.send('/scenario streaming-texte')
        await ui.ready()
        // Commande mise en arrière-plan par l'agent, dans son groupe (fiche 195, M3) : elle vit
        // après le tour…
        await ui.send('/scenario arriere-plan')
        await ui.ready()
        check(
          sleepsLeft('41.3').length === 1,
          'commande en arrière-plan : elle continue après le tour'
        )
        // 2. Quitter en plein tour : l'agent ignore SIGTERM, il ne doit pas survivre à Bobine.
        await ui.send('/scenario muet')
        await ui.waitFor(`!!${ui.$('stop')}`)
      },
      userData,
      'demo',
      env,
      inspect
    )
    const left = await leftovers(userData)
    for (let i = 0; i < 20 && sleepsLeft('41.3').length > 0; i++) await sleep(250)
    check(
      sleepsLeft('41.3').length === 0,
      '…et ne survit pas à la fermeture de Bobine (même groupe que l’agent)'
    )
    check(
      left.length === 0,
      `quitter en plein tour : aucun processus restant (${left.join(' | ')})`
    )

    // 3. `kill -9` de Bobine en plein tour : l'agent reste orphelin jusqu'au lancement suivant.
    let orphans = []
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        await ui.send('/scenario muet')
        await ui.waitFor(`!!${ui.$('stop')}`)
        await sleep(500)
        orphans = registered(userData)
        const main = await mainProcess()
        const pid = await main.evaluate('process.pid')
        main.close()
        process.kill(pid, 'SIGKILL')
        await sleep(500)
      },
      userData,
      'demo',
      env,
      inspect
    )
    check(
      orphans.length > 0 && orphans.every(alive),
      'après kill -9 : l’agent vit encore (orphelin)'
    )

    // Un fil abîmé : un message dont les pièces jointes ne sont plus une liste.
    damageThread(userData)

    await withApp(
      scheme,
      async (ui) => {
        // 4. Lancement suivant : avis du plantage, rapport local, orphelins arrêtés.
        await ui.waitFor(`!!${ui.$('app-alert-crashed')}`, 20000)
        await ui.shot('194-plantage-precedent')
        await ui.click(ui.$('app-alert-close'))
        await ui.waitFor(`!${ui.$('app-alert-crashed')}`)
        for (let i = 0; i < 40 && orphans.some(alive); i++) await sleep(250)
        check(!orphans.some(alive), 'orphelins du lancement tué arrêtés au lancement suivant')

        // 5. Élément du fil illisible : seul lui est remplacé.
        // Le fil du premier lancement (le plus ancien) : son premier message est illisible.
        await ui.click(`[...document.querySelectorAll('[data-testid=history-item]')].at(-1)`)
        await ui.waitFor(`!!${ui.$('item-error')}`)
        await ui.ev(`${ui.$('item-error')}.scrollIntoView({ block: 'center' })`)
        await sleep(300)
        await ui.shot('194-element-illisible')

        // 6. Erreur interne du main : un avis, son compte, fermé il ne revient pas.
        const main = await mainProcess()
        try {
          const raise = () => main.evaluate(`setTimeout(() => { throw new Error('essai e2e') }), 1`)
          await raise()
          await ui.waitFor(`!!${ui.$('app-alert-internal-error')}`)
          await raise()
          await ui.waitFor(
            `${ui.$('app-alert-internal-error')}?.innerText.includes(${JSON.stringify(L('appAlert.internal.title', { count: 2 }))})`
          )
          await ui.shot('194-erreur-interne')
          await ui.click(
            `${ui.$('app-alert-internal-error')}.querySelector('[data-testid=app-alert-close]')`
          )
          await raise()
          await sleep(800)
        } finally {
          main.close()
        }
      },
      userData,
      'demo',
      {},
      inspect
    )
    const after = await leftovers(userData)
    check(after.length === 0, `en quittant : aucun processus restant (${after.join(' | ')})`)
  } finally {
    rmSync(userData, { recursive: true, force: true })
  }
}

/** `sleep <durée>` encore vivants (commandes laissées par l'agent factice). */
function sleepsLeft(duration) {
  return execFileSync('ps', ['-A', '-ww', '-o', 'pid=,command='], { encoding: 'utf8' })
    .split('\n')
    .filter((line) => line.trim().endsWith(`sleep ${duration}`))
}

/** Processus notés au registre (`agents.pids`) du profil. */
function registered(userData) {
  try {
    const data = JSON.parse(readFileSync(join(userData, 'agents.pids'), 'utf8'))
    return data.processes.map((p) => p.pid)
  } catch {
    return []
  }
}

function alive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/** Processus qui citent le profil (app, aides d'Electron, agent factice et son stockage). */
async function leftovers(userData) {
  for (let i = 0; i < 20; i++) {
    const rows = execFileSync('ps', ['-A', '-ww', '-o', 'pid=,command='], { encoding: 'utf8' })
      .split('\n')
      .filter((line) => line.includes(userData))
    if (rows.length === 0) return []
    if (i === 19) return rows.map((r) => r.trim().slice(0, 120))
    await sleep(250)
  }
  return []
}

/**
 * Rend illisible le premier message de l'utilisateur de chaque fil enregistré : ses pièces jointes
 * ne sont plus une liste (fichier d'une autre version, abîmé à la main).
 */
function damageThread(userData) {
  let damaged = false
  const dir = join(userData, 'conversations')
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.json') || name.startsWith('index')) continue
    const file = join(dir, name)
    const thread = JSON.parse(readFileSync(file, 'utf8'))
    const user = thread.items?.find((item) => item.kind === 'user')
    if (!user) continue
    user.attachments = { length: 1 }
    writeFileSync(file, JSON.stringify(thread))
    damaged = true
  }
  return damaged
}
