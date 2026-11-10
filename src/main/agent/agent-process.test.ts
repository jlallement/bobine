import type { ChildProcessWithoutNullStreams } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { t } from 'i18next'
import { initLog, setVerbosity } from '../log'
import { launchAgent, type LaunchOptions } from './agent-process'
import type { AgentProfile } from './profiles'

/** « Agent » écrit en JavaScript, lancé par Node. */
const scriptProfile = (script: string, env: Record<string, string> = {}): AgentProfile => ({
  id: 'test',
  label: 'Agent de test',
  command: process.execPath,
  args: ['-e', script],
  env
})

function launch(profile: AgentProfile, options: Partial<LaunchOptions> = {}) {
  let activity = 0
  const launched = launchAgent({
    profile,
    cwd: process.cwd(),
    extraArgs: [],
    credentials: {},
    scope: { agent: 'test' },
    label: '(test)',
    onActivity: () => activity++,
    ...options
  })
  return { launched, activity: () => activity }
}

/** Tout ce que l'agent écrit sur sa sortie standard. */
async function readAll(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let text = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) return text + decoder.decode()
    text += decoder.decode(value, { stream: true })
  }
}

/** Processus fini, sorties lues jusqu'au bout (à attendre dès le lancement : `close` ne revient pas). */
const closed = (child: ChildProcessWithoutNullStreams) =>
  new Promise<void>((resolve) => child.once('close', () => resolve()))

describe('processus d’un agent', () => {
  it('fin de la sortie d’erreur : les cinq dernières lignes ; failed rejetée à la sortie', async () => {
    const { launched } = launch(
      scriptProfile(
        "for (const l of ['a','b','c','d','e','f','g']) process.stderr.write(l + '\\n'); process.exitCode = 3"
      )
    )
    const output = readAll(launched.fromAgent)
    const done = closed(launched.child)
    await expect(launched.failed).rejects.toThrow(
      t('agentHost.exit.ended', { status: t('agentHost.exit.code', { code: '3' }) })
    )
    await done
    expect(await output).toBe('')
    expect(launched.stderrHint()).toBe('\nc\nd\ne\nf\ng')
  })

  it('sortie d’erreur bornée ; rien sur la sortie d’erreur : pas d’explication', async () => {
    const long = launch(
      scriptProfile("process.stderr.write('x'.repeat(5000) + '\\nfin\\n')")
    ).launched
    const quiet = launch(scriptProfile('')).launched
    void readAll(long.fromAgent)
    void readAll(quiet.fromAgent)
    await Promise.all([closed(long.child), closed(quiet.child)])
    expect(long.stderrHint().length).toBeLessThanOrEqual(2001)
    expect(long.stderrHint()).toMatch(/x\nfin$/)
    expect(quiet.stderrHint()).toBe('')
  })

  it('commande introuvable : failed le dit en clair', async () => {
    const command = join(tmpdir(), 'bobine-agent-introuvable')
    const { launched } = launch({ ...scriptProfile(''), command, args: [] })
    await expect(launched.failed).rejects.toThrow(t('process.commandMissing', { command }))
  })

  it('environnement : clés posées ou retirées, arguments ajoutés', async () => {
    const { launched } = launch(
      scriptProfile(
        'process.stderr.write([process.env.BOBINE_TEST_ADDED, process.env.BOBINE_TEST_REMOVED ?? "retirée", process.argv[1]].join(" "))',
        { BOBINE_TEST_REMOVED: 'là' }
      ),
      {
        extraArgs: ['en-plus'],
        credentials: { BOBINE_TEST_ADDED: 'posée', BOBINE_TEST_REMOVED: undefined }
      }
    )
    void readAll(launched.fromAgent)
    await closed(launched.child)
    expect(launched.stderrHint()).toBe('\nposée retirée en-plus')
  })

  it('journal sur Trace : variables du profil pour le journal de l’agent (fiche 165)', async () => {
    const profile = {
      ...scriptProfile('process.stderr.write(process.env.BOBINE_TEST_LEVEL ?? "aucune")'),
      traceEnv: { BOBINE_TEST_LEVEL: 'debug' }
    }
    const run = async () => {
      const { launched } = launch(profile)
      void readAll(launched.fromAgent)
      await closed(launched.child)
      return launched.stderrHint()
    }
    setVerbosity('trace')
    try {
      expect(await run()).toBe('\ndebug')
    } finally {
      setVerbosity('normal')
    }
    expect(await run()).toBe('\naucune')
  })

  it('journal Détaillé : échanges et sortie d’erreur dans agents.log, clés masquées ; lancement et arrêt dans main.log', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'agent-process-log-'))
    initLog(dir)
    setVerbosity('detailed')
    try {
      const { launched, activity } = launch(
        scriptProfile(
          [
            'process.stdin.on("data", (d) => process.stdout.write(d))',
            'process.stdin.on("end", () => process.stderr.write(`clé ${process.env.BOBINE_TEST_KEY} reçue\\n`))'
          ].join(';')
        ),
        { credentials: { BOBINE_TEST_KEY: 'carotte-fraise-42' } }
      )
      const done = closed(launched.child)
      const line = `${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} })}\n`
      const writer = launched.toAgent.getWriter()
      await writer.write(new TextEncoder().encode(line))
      await writer.close()
      // L'agent renvoie ce qu'il reçoit : ses octets passent par le relevé et comptent comme activité.
      expect(await readAll(launched.fromAgent)).toBe(line)
      await done
      expect(activity()).toBeGreaterThan(0)
      const agents = readFileSync(join(dir, 'agents.log'), 'utf8')
      expect(agents).toMatch(/\[— · test\] → initialize #1 /)
      expect(agents).toMatch(/\[— · test\] ← initialize #1 /)
      expect(agents).toContain('[— · test] stderr clé «masqué» reçue')
      expect(agents).not.toContain('carotte-fraise-42')
      const main = readFileSync(join(dir, 'main.log'), 'utf8')
      expect(main).toMatch(/Agent lancé \(test\) : .* dans .* \(pid \d+\)/)
      expect(main).toMatch(/Agent arrêté \(test\) : code 0 après /)
    } finally {
      setVerbosity('normal')
    }
  })
})
