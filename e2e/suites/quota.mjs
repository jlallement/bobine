import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { check, L, LANG, processesUsing, sleep, withApp } from '../lib.mjs'

/** Montant comme l'interface l'écrit (deux décimales au plus), espaces insécables ramenées. */
const amount = (n) =>
  new Intl.NumberFormat(LANG === 'en' ? 'en-US' : 'fr-FR', { maximumFractionDigits: 2 }).format(n)
const plain = (expression) => `(${expression})?.innerText.replace(/[\\u00a0\\u202f]/g, ' ')`
const spaces = (text) => text.replace(/[  ]/g, ' ')

/**
 * Quota de l'agent (fiche 091) : lu au démarrage sur un faux `/status` (812,5 / 1000), affiché sous
 * le nom de l'agent, détail au clic, relu par « Actualiser » ; aucune session vide laissée.
 */
export async function quotaSuite(scheme) {
  console.log(`\n— Quota de l’agent (${scheme})`)
  const userData = mkdtempSync(join(tmpdir(), 'bob-e2e-'))
  await withApp(
    scheme,
    async (ui) => {
      await ui.ready()
      const short = spaces(L('quota.short', { percent: 81 }))
      await ui.waitFor(`${plain(ui.$('agent-status'))}?.includes(${JSON.stringify(short)})`, 30000)
      check(true, 'quota lu au démarrage : part consommée sous le nom de l’agent')
      check(
        await ui.ev(`!!document.querySelector('.agent-quota .usage-bar.warn')`),
        'au-delà de 80 % : barre orange'
      )
      await ui.shot('quota-1-barre-laterale')

      await ui.click(ui.$('agent-quota'))
      await ui.waitFor(`!!${ui.$('quota-details')}`)
      // Unité affichée avec une majuscule (fiche 144).
      const currency = 'Bobcoins'
      const expected = spaces(
        L('quota.value', {
          used: amount(812.5),
          limit: L('quota.amount', { amount: amount(1000), currency })
        })
      )
      const value = await ui.ev(plain(ui.$('quota-value')))
      check(value === expected, `détail : « ${value} » (attendu « ${expected} »)`)
      const left = await ui.ev(plain(ui.$('quota-left')))
      check(
        left === spaces(L('quota.amount', { amount: amount(187.5), currency })),
        `détail : reste « ${left} »`
      )
      await ui.shot('quota-2-detail')

      await ui.click(ui.$('quota-refresh'))
      await ui.waitFor(
        `${ui.$('quota-refresh')}?.innerText === ${JSON.stringify(L('quota.reading'))}`
      )
      await ui.waitFor(
        `${ui.$('quota-refresh')}?.innerText === ${JSON.stringify(L('quota.refresh'))}`,
        30000
      )
      check(true, '« Actualiser » relit le quota')

      // Chaque lecture crée une session vide chez l'agent, comme `bob chat` : toutes supprimées.
      const store = join(userData, 'mock-agent-sessions')
      const leftovers = existsSync(store)
        ? readdirSync(store)
            .filter((f) => f.endsWith('.json'))
            .map((f) => JSON.parse(readFileSync(join(store, f), 'utf8')))
            .filter((s) => String(s.cwd).includes('agent-status'))
        : []
      check(
        leftovers.length === 0,
        `aucune session vide laissée chez l’agent (${leftovers.length})`
      )
    },
    userData,
    'demo',
    { MOCK_AGENT_QUOTA: '1' }
  )
  rmSync(userData, { recursive: true, force: true })
  await quotaAfterFailureSuite(scheme)
  await quitDuringReadSuite(scheme)
}

/**
 * Échec récent (recette 0.11.1, fiche 205) : une lecture ratée (agent pas encore connecté) a posé
 * la pause, la lecture du lancement est sautée ; l'agent de la conversation se montre prêt, le
 * quota encore inconnu est relu quand même. Dossier personnel des agents propre à ce cas : la pause
 * ne touche aucune autre suite.
 */
async function quotaAfterFailureSuite(scheme) {
  console.log(`\n— Quota relu quand l’agent est prêt, malgré un échec récent (${scheme})`)
  const home = mkdtempSync(join(tmpdir(), 'bob-e2e-home-'))
  // Comme `quotaStatusDir` (src/main/agent/quota.ts).
  const statusDir =
    process.platform === 'darwin'
      ? join(home, 'Library', 'Caches', 'Bobine', 'agent-status')
      : join(home, '.cache', 'bobine', 'agent-status')
  mkdirSync(statusDir, { recursive: true })
  const pause = join(statusDir, 'mock.pause.json')
  writeFileSync(pause, JSON.stringify({ until: Date.now() + 3_600_000 }))
  await withApp(
    scheme,
    async (ui) => {
      await ui.ready()
      const short = spaces(L('quota.short', { percent: 81 }))
      await ui.waitFor(`${plain(ui.$('agent-status'))}?.includes(${JSON.stringify(short)})`, 30000)
      check(true, 'pause d’un échec récent : quota relu dès que l’agent est prêt')
      check(!existsSync(pause), 'lecture réussie : la pause est levée')
      await ui.shot('quota-3-relu-agent-pret')
    },
    undefined,
    'demo',
    { MOCK_AGENT_QUOTA: '1', BOBINE_CONFIG_HOME: home, XDG_CACHE_HOME: join(home, '.cache') }
  )
  rmSync(home, { recursive: true, force: true })
}

/**
 * Quitter pendant une lecture (fiche 208) : le faux `bob chat`, lent à démarrer, est fermé avec
 * l'app — il ne lui survit pas et n'écrit rien dans ses données ensuite (sa session vide).
 */
async function quitDuringReadSuite(scheme) {
  console.log(`\n— Quitter pendant la lecture du quota (${scheme})`)
  const userData = mkdtempSync(join(tmpdir(), 'bob-e2e-quota-quitter-'))
  const reading = () =>
    processesUsing(userData).filter((line) => line.includes('status-screen.mts'))
  const store = join(userData, 'mock-agent-sessions')
  const sessions = () => (existsSync(store) ? readdirSync(store) : [])
  const slowMs = 4000
  try {
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        for (let i = 0; i < 100 && reading().length === 0; i++) await sleep(50)
        check(reading().length === 1, 'lecture du quota en cours (faux `bob chat` lent)')
      },
      userData,
      'demo',
      { MOCK_AGENT_QUOTA: '1', MOCK_QUOTA_SLOW_MS: String(slowMs) }
    )
    const left = reading()
    check(left.length === 0, `quitter pendant la lecture : \`bob chat\` fermé avec l’app (${left})`)
    const before = sessions().length
    await sleep(slowMs + 500)
    check(
      sessions().length === before,
      `rien d’écrit dans les données après la sortie (${before} → ${sessions().length})`
    )
    for (const line of left) process.kill(Number(line.split(/\s+/)[0]), 'SIGKILL')
  } finally {
    rmSync(userData, { recursive: true, force: true })
  }
}
