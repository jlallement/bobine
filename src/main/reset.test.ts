import { spawnSync } from 'node:child_process'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  classifyEntry,
  launchReset,
  RESET_FAILURE_NAME,
  RESET_HELPER,
  resetFolderName,
  resetInventory,
  resetHelperArgs,
  resetPaths,
  takeResetFailure,
  type ResetJob
} from './reset'

const temp = (name: string) => mkdtempSync(join(tmpdir(), name))

/** Un dossier de données d'essai : deux conversations, réglages, journal, navigateur, cache. */
function fakeUserData(): string {
  const root = temp('donnees-')
  mkdirSync(join(root, 'conversations'))
  writeFileSync(join(root, 'conversations', 'a.json'), 'x'.repeat(100))
  writeFileSync(join(root, 'conversations', 'b.json'), 'x'.repeat(50))
  writeFileSync(join(root, 'settings.json'), 'x'.repeat(10))
  writeFileSync(join(root, 'api-keys.json'), 'x'.repeat(5))
  writeFileSync(join(root, 'usage.sqlite'), 'x'.repeat(30))
  writeFileSync(join(root, 'usage.sqlite-wal'), 'x'.repeat(3))
  mkdirSync(join(root, 'Partitions', 'bob-browser'), { recursive: true })
  writeFileSync(join(root, 'Partitions', 'bob-browser', 'Cookies'), 'x'.repeat(40))
  mkdirSync(join(root, 'Cache'))
  writeFileSync(join(root, 'Cache', 'data_0'), 'x'.repeat(7))
  return root
}

describe('réinitialiser Bobine : inventaire (fiche 148)', () => {
  it('chaque entrée du dossier de données dans son groupe', () => {
    expect(classifyEntry('conversations')).toBe('conversations')
    expect(classifyEntry('usage.sqlite-shm')).toBe('usage')
    expect(classifyEntry('approvals.json')).toBe('settings')
    expect(classifyEntry('Local Storage')).toBe('settings')
    expect(classifyEntry('Partitions')).toBe('browser')
    expect(classifyEntry('downloads-pending')).toBe('browser')
    expect(classifyEntry('GPUCache')).toBe('other')
    expect(classifyEntry('workspace')).toBe('other')
  })

  it('tailles par groupe, nombre de conversations, dossiers hors du dossier de données', async () => {
    const userData = fakeUserData()
    const logs = temp('journaux-')
    writeFileSync(join(logs, 'main.log'), 'x'.repeat(20))
    expect(await resetInventory(userData, [logs])).toEqual([
      { kind: 'conversations', bytes: 150, count: 2 },
      { kind: 'settings', bytes: 15 },
      { kind: 'usage', bytes: 33 },
      { kind: 'browser', bytes: 40 },
      { kind: 'other', bytes: 27 }
    ])
  })

  it('dossier daté sans « : », chemins existants sans doublon ni chemin contenu', () => {
    expect(resetFolderName('Bobine — données du', new Date(2026, 9, 24, 9, 5))).toBe(
      'Bobine — données du 2026-10-24 09.05'
    )
    const root = fakeUserData()
    expect(resetPaths([root, join(root, 'Cache'), root, undefined, '/nulle/part'])).toEqual([root])
  })
})

/** Un processus déjà fini : l'assistant n'attend pas. */
const finishedPid = () => spawnSync('/usr/bin/true').pid ?? 999_999

/** Joue l'assistant pour de vrai, comme `launchReset` (sans détacher). */
function runHelper(job: ResetJob) {
  const header = join(temp('travail-'), 'en-tete.txt')
  writeFileSync(header, job.readme + '\n')
  const run = spawnSync(
    '/bin/sh',
    ['-c', RESET_HELPER, 'bobine-reset', ...resetHelperArgs(job, header)],
    { encoding: 'utf8' }
  )
  return { run, header }
}

describe('réinitialiser Bobine : l’assistant (fiches 148, 187)', () => {
  it('lancé détaché par /bin/sh, jamais en mode Node (fusible RunAsNode coupé)', () => {
    const spawn = vi.fn((..._args: unknown[]) => ({ unref: vi.fn() }))
    const tmp = temp('travail-')
    const job: ResetJob = {
      pid: 42,
      paths: ['/a b', '/c'],
      trashDir: '/t',
      folderName: 'f',
      readmeName: 'LISEZ-MOI.txt',
      readme: 'r',
      failureFile: '/a b/echec.txt',
      relaunch: ['/usr/bin/open', '-n', '/Applications/Bobine.app']
    }
    const previous = process.env['ELECTRON_RUN_AS_NODE']
    process.env['ELECTRON_RUN_AS_NODE'] = '1'
    try {
      const header = launchReset(job, { tmp, spawn })
      expect(readFileSync(header, 'utf8')).toBe('r\n')
      expect(spawn).toHaveBeenCalledWith(
        '/bin/sh',
        [
          '-c',
          RESET_HELPER,
          'bobine-reset',
          '42',
          '600',
          '/t',
          'f',
          'LISEZ-MOI.txt',
          header,
          '',
          '',
          '/a b/echec.txt',
          '/a b',
          '/c',
          '--',
          '/usr/bin/open',
          '-n',
          '/Applications/Bobine.app'
        ],
        { detached: true, stdio: 'ignore', env: expect.any(Object) }
      )
      const env = (spawn.mock.calls[0]?.[2] as { env: NodeJS.ProcessEnv }).env
      expect(env['ELECTRON_RUN_AS_NODE']).toBeUndefined()
    } finally {
      if (previous === undefined) delete process.env['ELECTRON_RUN_AS_NODE']
      else process.env['ELECTRON_RUN_AS_NODE'] = previous
    }
  })

  it('pour de vrai : tout part dans le dossier daté, LISEZ-MOI, puis la relance', () => {
    const userData = fakeUserData()
    const logs = temp('journaux avec espace é-')
    writeFileSync(join(logs, 'main.log'), 'journal')
    const trash = temp('corbeille-')
    const marker = join(temp('relance-'), 'relancee')
    const job: ResetJob = {
      pid: finishedPid(),
      paths: [userData, logs, '/nulle/part'],
      trashDir: trash,
      folderName: 'Bobine — données du 2026-10-24 20.15',
      readmeName: 'LISEZ-MOI.txt',
      readme: 'Données de Bobine.',
      failureFile: join(userData, RESET_FAILURE_NAME),
      relaunch: ['/bin/sh', '-c', `echo ok > '${marker}'`]
    }
    const { run, header } = runHelper(job)
    expect(run.status, run.stderr).toBe(0)
    const folder = join(trash, job.folderName)
    expect(readdirSync(folder).sort()).toEqual(
      ['LISEZ-MOI.txt', userData.split('/').pop(), logs.split('/').pop()].sort()
    )
    expect(existsSync(userData)).toBe(false)
    expect(existsSync(logs)).toBe(false)
    expect(readFileSync(join(folder, logs.split('/').pop() ?? '', 'main.log'), 'utf8')).toBe(
      'journal'
    )
    const readme = readFileSync(join(folder, 'LISEZ-MOI.txt'), 'utf8')
    expect(readme.startsWith('Données de Bobine.\n')).toBe(true)
    expect(readme).toContain(`  <-  ${userData}`)
    expect(readme).toContain(`  <-  ${logs}`)
    expect(existsSync(header)).toBe(false)
    // La relance part détachée : on l'attend un peu.
    for (let i = 0; i < 50 && !existsSync(marker); i++) spawnSync('sleep', ['0.05'])
    expect(readFileSync(marker, 'utf8').trim()).toBe('ok')
  })

  it('un déplacement échoue : rien n’est supprimé, tout est remis en place, la raison est gardée', () => {
    const userData = fakeUserData()
    // Un dossier dont on ne peut pas sortir un élément (parent en lecture seule).
    const locked = temp('verrou-')
    const stuck = join(locked, 'journaux')
    mkdirSync(stuck)
    writeFileSync(join(stuck, 'main.log'), 'journal')
    chmodSync(locked, 0o555)
    const trash = temp('corbeille-')
    const marker = join(temp('relance-'), 'relancee')
    try {
      const { run } = runHelper({
        pid: finishedPid(),
        paths: [userData, stuck],
        trashDir: trash,
        folderName: 'Bobine',
        readmeName: 'LISEZ-MOI.txt',
        readme: 'r',
        failureFile: join(userData, RESET_FAILURE_NAME),
        keychain: 'Service qui n’existe pas',
        relaunch: ['/bin/sh', '-c', `echo ok > '${marker}'`]
      })
      expect(run.status, run.stderr).toBe(0)
      // Le dossier de données, déjà déplacé, est revenu ; la corbeille est vide.
      expect(readdirSync(join(userData, 'conversations')).sort()).toEqual(['a.json', 'b.json'])
      expect(existsSync(join(stuck, 'main.log'))).toBe(true)
      expect(readdirSync(trash)).toEqual([])
      expect(takeResetFailure(userData)).toContain(stuck)
      // Lu une fois : supprimé.
      expect(takeResetFailure(userData)).toBeUndefined()
      // Relancée quand même, pour dire ce qui s'est passé.
      for (let i = 0; i < 50 && !existsSync(marker); i++) spawnSync('sleep', ['0.05'])
      expect(existsSync(marker)).toBe(true)
    } finally {
      chmodSync(locked, 0o755)
    }
  })

  it('corbeille impossible à créer : rien ne bouge', () => {
    const userData = fakeUserData()
    const trash = temp('corbeille-')
    chmodSync(trash, 0o555)
    try {
      const { run } = runHelper({
        pid: finishedPid(),
        paths: [userData],
        trashDir: trash,
        folderName: 'Bobine',
        readmeName: 'LISEZ-MOI.txt',
        readme: 'r',
        failureFile: join(userData, RESET_FAILURE_NAME)
      })
      expect(run.status, run.stderr).toBe(0)
      expect(readdirSync(join(userData, 'conversations')).sort()).toEqual(['a.json', 'b.json'])
      expect(takeResetFailure(userData)).toContain(trash)
    } finally {
      chmodSync(trash, 0o755)
    }
  })

  it('Bobine tourne encore à la fin de l’attente : rien ne bouge, pas de relance', () => {
    const userData = fakeUserData()
    const trash = temp('corbeille-')
    const marker = join(temp('relance-'), 'relancee')
    const { run } = runHelper({
      pid: process.pid,
      waitTenths: 3,
      paths: [userData],
      trashDir: trash,
      folderName: 'Bobine',
      readmeName: 'LISEZ-MOI.txt',
      readme: 'r',
      failureFile: join(userData, RESET_FAILURE_NAME),
      relaunch: ['/bin/sh', '-c', `echo ok > '${marker}'`]
    })
    expect(run.status).toBe(1)
    expect(readdirSync(trash)).toEqual([])
    expect(existsSync(join(userData, 'conversations', 'a.json'))).toBe(true)
    expect(takeResetFailure(userData)).toContain('still running')
    spawnSync('sleep', ['0.3'])
    expect(existsSync(marker)).toBe(false)
  })

  it('deuxième réinitialisation le même jour : un autre dossier, rien d’écrasé', () => {
    const trash = temp('corbeille-')
    mkdirSync(join(trash, 'Bobine'))
    const userData = fakeUserData()
    const { run } = runHelper({
      pid: 999_999,
      paths: [userData],
      trashDir: trash,
      folderName: 'Bobine',
      readmeName: 'LISEZ-MOI.txt',
      readme: 'r',
      failureFile: join(userData, RESET_FAILURE_NAME)
    })
    expect(run.status, run.stderr).toBe(0)
    expect(readdirSync(trash).sort()).toEqual(['Bobine', 'Bobine 2'])
  })
})
