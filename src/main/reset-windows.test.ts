import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, win32 } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { createFreshStart } from './fresh-start'
import { launchReset, type ResetJob } from './reset'
import {
  detachedPowerShell,
  encodedPowerShell,
  MAX_COMMAND_LINE,
  RESET_KEPT_NAME,
  psLiteral,
  scriptLoader,
  selfDeleting,
  windowsCleanupScript,
  windowsResetScript
} from './reset-windows'

const decode = (args: string[]) => Buffer.from(args.at(-1) ?? '', 'base64').toString('utf16le')

/** Chemins longs et piégés : accents, apostrophes, espaces, `$`, guillemets, `%`. */
const LONG = `C:\\Users\\Jérôme d'Artagnan\\AppData\\Roaming\\${'très long dossier $x "q" %PATH% '.repeat(6)}`

const job: ResetJob = {
  pid: 4242,
  paths: [join(LONG, 'bobine'), join(LONG, 'bob-desktop'), join(LONG, 'logs')],
  trashDir: LONG,
  folderName: 'Bobine — données du 2026-11-15 19.00',
  readmeName: 'LISEZ-MOI.txt',
  readme: 'En-tête',
  failureFile: join(LONG, 'bobine', 'reinitialisation-echouee.txt'),
  relaunch: ['C:\\Program Files\\Bobine\\Bobine.exe', '--user-data-dir=C:\\x y']
}

describe('assistants de « Recommencer à neuf » sous Windows (fiche 229)', () => {
  it('-EncodedCommand : UTF-16LE en base64', () => {
    const args = encodedPowerShell("Write-Output 'é'")
    expect(args.slice(0, 4)).toEqual([
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      '-EncodedCommand'
    ])
    expect(decode(args)).toBe("Write-Output 'é'")
  })

  it('chaînes littérales : seule l’apostrophe est doublée', () => {
    expect(psLiteral('d\'Artagnan $x `n "q"')).toBe("'d''Artagnan $x `n \"q\"'")
  })

  it('le travail est relu tel quel (JSON dans une chaîne littérale)', () => {
    const script = windowsResetScript(job, 'C:\\tmp\\h.txt')
    const first = script.split('\n')[0] ?? ''
    const literal = /^\$job = '(.*)' \| ConvertFrom-Json$/.exec(first)?.[1] ?? ''
    expect(JSON.parse(literal.replace(/''/g, "'"))).toMatchObject({
      pid: 4242,
      paths: job.paths,
      relaunch: job.relaunch,
      recycle: true
    })
  })

  it('le relais tient dans une ligne de commande de Windows, même avec des chemins longs', () => {
    const file = join(LONG, 'bobine-reinitialisation-4242.ps1')
    const [, args] = detachedPowerShell('C:\\Windows\\powershell.exe', file)
    expect(['powershell.exe', ...args].join(' ').length).toBeLessThan(MAX_COMMAND_LINE)
    // Le relais lance l'assistant caché, qui charge son script depuis le fichier.
    const relay = decode(args)
    expect(relay).toMatch(
      /^Start-Process -FilePath 'C:\\Windows\\powershell.exe' -WindowStyle Hidden/
    )
    const inner = /-EncodedCommand (\S+)'$/.exec(relay)?.[1] ?? ''
    expect(Buffer.from(inner, 'base64').toString('utf16le')).toBe(scriptLoader(file))
  })

  it('le script efface son fichier avant tout (ses `exit` finissent le processus)', () => {
    const text = selfDeleting('exit 1', "C:\\t\\a'b.ps1")
    expect(text.split('\n')[0]).toBe(
      "Remove-Item -LiteralPath 'C:\\t\\a''b.ps1' -Force -ErrorAction SilentlyContinue"
    )
  })

  it('Corbeille seulement après un témoin arrivé ; sinon le dossier daté reste', () => {
    const script = windowsResetScript(job, 'h')
    expect(script).toMatch(/if \(CanRecycle \$job\.trash\)/)
    expect(script).toMatch(/SendToRecycleBin/)
    expect(windowsResetScript({ ...job, recycle: false }, 'h')).toContain('"recycle":false')
  })

  it('dossier refusé par la Corbeille : note pour la Bobine suivante, lue une fois', async () => {
    const script = windowsResetScript(job, 'h')
    expect(script).toContain(
      `"kept":${JSON.stringify(win32.join(LONG, 'bobine', RESET_KEPT_NAME)).replace(/'/g, "''")}`
    )
    expect(script).toMatch(/if \(-not \$recycled\)/)
    const { takeResetKept } = await import('./reset')
    const userData = mkdtempSync(join(tmpdir(), 'kept-'))
    expect(takeResetKept(userData)).toBeUndefined()
    writeFileSync(
      join(userData, RESET_KEPT_NAME),
      'C:\\Users\\x\\AppData\\Roaming\\Bobine — données\n'
    )
    expect(takeResetKept(userData)).toBe('C:\\Users\\x\\AppData\\Roaming\\Bobine — données')
    expect(takeResetKept(userData)).toBeUndefined()
  })

  it('launchReset sous Windows : script écrit, relais attendu, pas de /bin/sh', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'reset-win-'))
    const spawn = vi.fn(() => ({ unref: vi.fn() }))
    const spawnSync = vi.fn()
    launchReset(job, { tmp, system: 'windows', spawn, spawnSync })
    expect(spawn).not.toHaveBeenCalled()
    expect(spawnSync).toHaveBeenCalledTimes(1)
    const [command, args, options] = spawnSync.mock.calls[0] as unknown as [
      string,
      string[],
      Record<string, unknown>
    ]
    expect(command).toMatch(/powershell\.exe$/i)
    expect(options).toMatchObject({ stdio: 'ignore', windowsHide: true })
    const file = join(tmp, 'bobine-reinitialisation-4242.ps1')
    expect(decode(args)).toContain(
      psLiteral(`-NoLogo -NoProfile -NonInteractive -EncodedCommand`).slice(1, -1)
    )
    expect(readFileSync(file, 'utf8')).toContain(
      windowsResetScript(job, join(tmp, 'bobine-reinitialisation-4242.txt'))
    )
  })

  it('ménage du profil temporaire sous Windows : même relais, préfixe vérifié', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'tmp-win-'))
    const spawn = vi.fn(() => ({ unref: vi.fn() }))
    const spawnSync = vi.fn()
    let onQuit: (() => void) | undefined
    const fresh = createFreshStart(
      {
        hasSwitch: (name) => name === 'profil-temporaire',
        onWillQuit: (listener) => (onQuit = listener),
        isPackaged: true,
        execPath: 'C:\\Bobine\\Bobine.exe',
        appPath: () => ''
      },
      {
        spawn,
        spawnSync,
        tmp,
        env: {},
        pid: 7,
        system: 'windows',
        // Comme Windows avec un fichier encore ouvert (vu dans la VM) : l'assistant part quand même.
        remove: () => {
          throw Object.assign(new Error('EPERM, Permission denied'), { code: 'EPERM' })
        }
      }
    )
    const folder = fresh.userData('C:\\ignoré')
    onQuit?.()
    expect(spawn).not.toHaveBeenCalled()
    expect(spawnSync).toHaveBeenCalledTimes(1)
    // L'effacement de l'app a échoué : le dossier est encore là, l'assistant s'en charge.
    expect(existsSync(folder)).toBe(true)
    expect(windowsCleanupScript(folder, 7, 600, 'x')).toContain('StartsWith($job.prefix)')
  })
})
