import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { LaunchConfig } from '@shared/launch'
import { DevServers, portOpen, readLaunchConfigs } from './dev-servers'

/** Port libre sur la machine. */
async function freePort(): Promise<number> {
  const server = createServer()
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0
  await new Promise((done) => server.close(done))
  return port
}

function project(serverCode: string) {
  const dir = mkdtempSync(join(tmpdir(), 'dev-servers-'))
  writeFileSync(join(dir, 'server.js'), serverCode)
  return dir
}

const SERVER = (delayMs = 0) => `
const http = require('node:http')
console.log('démarrage…')
setTimeout(() => {
  http.createServer((q, r) => r.end('ok')).listen(Number(process.env.PORT), '127.0.0.1', () =>
    console.log('à l’écoute sur ' + process.env.PORT))
}, ${delayMs})
`

const config = (port: number, extra: Partial<LaunchConfig> = {}): LaunchConfig => ({
  name: 'web',
  runtimeExecutable: process.execPath,
  runtimeArgs: ['server.js'],
  port,
  env: {},
  ...extra
})

const running: DevServers[] = []
afterEach(() => running.splice(0).forEach((s) => s.stopAll()))

function servers() {
  const changes: string[] = []
  const s = new DevServers((c) => changes.push(c.servers.map((v) => v.status).join(',')))
  running.push(s)
  return { s, changes }
}

describe('serveurs de dev', () => {
  it('démarre, attend le port, journalise ; arrêt du groupe de processus', async () => {
    const dir = project(SERVER())
    const port = await freePort()
    const { s, changes } = servers()
    const outcome = await s.start(dir, config(port), 10_000)
    expect(outcome).toMatchObject({ state: 'ready', reused: false })
    expect(outcome.server).toMatchObject({ status: 'running', url: `http://localhost:${port}/` })
    expect(s.logs(dir, 'web').join('\n')).toContain(`à l’écoute sur ${port}`)
    expect(changes).toContain('running')
    expect(s.stop(dir, 'web')).toBe(true)
    await expect.poll(() => portOpen(port), { timeout: 5000 }).toBe(false)
    expect(s.list(dir)[0]?.status).toBe('exited')
    // Durée de l'onglet « Session » (fiche 166) : début, puis fin une fois arrêté.
    const view = s.list(dir)[0]
    expect(view?.startedAt).toBeGreaterThan(0)
    expect(view?.endedAt).toBeGreaterThanOrEqual(view?.startedAt ?? 0)
  })

  it('démarrage plus long que l’attente : « encore en cours », puis réutilisé', async () => {
    const dir = project(SERVER(800))
    const port = await freePort()
    const { s } = servers()
    expect((await s.start(dir, config(port), 100)).state).toBe('starting')
    const again = await s.start(dir, config(port), 10_000)
    expect(again).toMatchObject({ state: 'ready', reused: true })
  })

  it('commande qui échoue ou introuvable : échec avec la fin du journal', async () => {
    const dir = project('console.error("Error: module introuvable"); process.exit(2)')
    const port = await freePort()
    const { s } = servers()
    const failed = await s.start(dir, config(port), 10_000)
    expect(failed.state).toBe('failed')
    expect(failed.tail.join('\n')).toContain('module introuvable')
    expect(s.logs(dir, 'web', { errorsOnly: true })).toEqual(['Error: module introuvable'])
    const missing = await s.start(
      dir,
      config(port, { runtimeExecutable: 'commande-absente-xyz' }),
      5000
    )
    expect(missing.state).toBe('failed')
    expect(missing.tail.join('\n')).toContain('ENOENT')
  })

  it('ligne de commande lancée par le shell (« command »)', async () => {
    const dir = project(SERVER())
    const port = await freePort()
    const { s } = servers()
    const outcome = await s.start(
      dir,
      {
        name: 'web',
        command: `PORT=${port} "${process.execPath}" server.js`,
        runtimeArgs: [],
        port,
        env: {}
      },
      10_000
    )
    expect(outcome).toMatchObject({
      state: 'ready',
      server: { command: expect.stringContaining('server.js') }
    })
  })

  it('serveur « existant » (URL sans commande) qui ne répond pas : échec expliqué', async () => {
    const port = await freePort()
    const { s } = servers()
    const outcome = await s.start(
      project(''),
      { name: 'quiz', url: `http://localhost:${port}/`, runtimeArgs: [], port, env: {} },
      2000
    )
    expect(outcome.state).toBe('failed')
    expect(outcome.tail.join('\n')).toContain('pas de commande')
  })

  it('port déjà occupé : serveur existant utilisé, rien n’est lancé', async () => {
    const port = await freePort()
    const other = createServer()
    await new Promise<void>((done) => other.listen(port, '127.0.0.1', done))
    const { s } = servers()
    const outcome = await s.start(project(SERVER()), config(port), 5000)
    other.close()
    expect(outcome).toMatchObject({ state: 'ready', server: { status: 'attached' } })
  })

  it('fichier de lancement : .bob/ d’abord, sinon .claude/ ; invalide → erreur nommée', () => {
    const dir = mkdtempSync(join(tmpdir(), 'launch-'))
    expect(readLaunchConfigs(dir)).toBeUndefined()
    mkdirSync(join(dir, '.claude'))
    writeFileSync(
      join(dir, '.claude/launch.json'),
      JSON.stringify({ configurations: [{ name: 'web', url: 'http://localhost:3000' }] })
    )
    expect(readLaunchConfigs(dir)?.file).toBe('.claude/launch.json')
    mkdirSync(join(dir, '.bob'))
    writeFileSync(join(dir, '.bob/launch.json'), '{ "configurations": 3 }')
    expect(() => readLaunchConfigs(dir)).toThrow('.bob/launch.json')
  })
})
