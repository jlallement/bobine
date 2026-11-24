import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { check, L, processesUsing, sleep, withApp } from '../lib.mjs'
const plain = (expression) => `(${expression})?.innerText.replace(/[\\u00a0\\u202f]/g, ' ')`
const spaces = (text) => text.replace(/[  ]/g, ' ')

/**
 * Quota de l'agent (fiche 091) : lu sur un faux `/status` (812,5 / 1000) dès que l'agent de la
 * conversation est prêt (fiche 242), affiché sous le nom de l'agent, détail au clic, relu par
 * « Actualiser » ; aucune session vide laissée. Agent installé mais pas utilisé : jamais lu.
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
      check(true, 'quota lu, l’agent de la conversation prêt : part sous le nom de l’agent')
      await ui.shot('quota-1-barre-laterale')

      await ui.click(ui.$('agent-quota'))
      await ui.waitFor(`!!${ui.$('quota-details')}`)
      await ui.shot('quota-2-detail')

      await ui.click(ui.$('quota-refresh'))
      await ui.waitFor(
        `${ui.$('quota-refresh')}?.innerText === ${JSON.stringify(L('quota.reading'))}`
      )
      await ui.waitFor(
        `${ui.$('quota-refresh')}?.innerText === ${JSON.stringify(L('quota.refresh'))}`,
        30000
      )
    },
    userData,
    'demo',
    { MOCK_AGENT_QUOTA: '1' }
  )
  rmSync(userData, { recursive: true, force: true })
  await notUsedSuite(scheme)
  await quitDuringReadSuite(scheme)
}

/**
 * Agent installé mais pas utilisé (fiche 242, recette du 2026-11-17, D17) : la conversation n'a pas
 * de dossier, son agent ne démarre pas ; son quota n'est pas lu, ni au lancement ni après (avant,
 * une lecture de chaque agent installé partait 3 s après le démarrage : chez Bob, une session créée
 * puis supprimée dans le vrai `~/.bob`). Dossier personnel des agents propre à ce cas.
 */
async function notUsedSuite(scheme) {
  console.log(`\n— Quota d’un agent installé mais pas utilisé : pas lu (${scheme})`)
  const home = mkdtempSync(join(tmpdir(), 'bob-e2e-home-'))
  const userData = mkdtempSync(join(tmpdir(), 'bob-e2e-quota-inutilise-'))
  // Comme `quotaStatusDir` (src/main/agent/quota.ts).
  const statusDir =
    process.platform === 'darwin'
      ? join(home, 'Library', 'Caches', 'Bobine', 'agent-status')
      : join(home, '.cache', 'bobine', 'agent-status')
  try {
    await withApp(
      scheme,
      async (ui) => {
        // Pas de `ui.ready()` : sans dossier, l'agent ne démarre pas (c'est ce qu'on vérifie).
        await ui.waitFor(`!!${ui.$('agent-status')}`)
        // Bien au-delà des 3 s de l'ancienne lecture du lancement, et d'un démarrage d'agent.
        await sleep(6000)
        check(!existsSync(statusDir), 'rien écrit dans le dossier de lecture du quota')
        const status = await ui.ev(plain(ui.$('agent-status')))
        check(!/%/.test(status ?? ''), `pas de quota affiché (« ${status} »)`)
        await ui.shot('quota-3-agent-pas-utilise')
      },
      userData,
      'demo',
      {
        MOCK_AGENT_QUOTA: '1',
        BOBINE_DEFAULT_WORKSPACE: '',
        BOBINE_CONFIG_HOME: home,
        XDG_CACHE_HOME: join(home, '.cache')
      }
    )
  } finally {
    rmSync(home, { recursive: true, force: true })
    rmSync(userData, { recursive: true, force: true })
  }
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
