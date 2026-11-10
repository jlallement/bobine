import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { spawnNodePty } from './node-pty'
import { terminateForeground } from './foreground'
import { TerminalManager, type Pty } from './terminal-manager'

const managers: TerminalManager[] = []
afterEach(() => managers.splice(0).forEach((m) => m.closeAll()))

function setup() {
  const data: string[] = []
  const onChange = vi.fn()
  const manager = new TerminalManager({
    spawn: spawnNodePty,
    shell: '/bin/sh',
    env: () => ({ ...process.env, PS1: '$ ' }),
    onData: (_c, _t, d) => data.push(d),
    onChange,
    terminateForeground
  })
  managers.push(manager)
  return { manager, data, onChange }
}

describe('terminaux (vrai shell)', () => {
  it('onglet dans le dossier, commande lancée, écran lu comme l’utilisateur le voit', async () => {
    const { manager, onChange } = setup()
    const tab = manager.create('c1', tmpdir())
    expect(tab).toMatchObject({ id: '1', busy: false })
    // Ouverture de l'onglet : durée affichée dans l'onglet « Session » (fiche 166).
    expect(tab.startedAt).toBeGreaterThan(0)
    manager.run('c1', tmpdir(), 'printf "\\033[31mrouge\\033[0m\\n"; echo $((6*7))', '1')
    // L’écho peut précéder l’exécution : relire dans le même budget de deux secondes.
    const deadline = Date.now() + 2000
    let screen = ''
    while (Date.now() < deadline && !screen.split('\n').some((line) => line.trim() === '42')) {
      screen = await manager.read('c1', '1', 20, Math.max(0, deadline - Date.now()))
    }
    // Couleurs appliquées : l'agent lit le texte, sans séquences d'échappement.
    expect(screen).toContain('rouge')
    expect(screen).not.toContain('\u001b')
    expect(screen).toContain('42')
    expect(onChange).toHaveBeenCalled()
  })

  it('image pour réafficher, Ctrl+C, programme au premier plan, fermeture', async () => {
    const { manager } = setup()
    manager.create('c1', tmpdir())
    manager.run('c1', tmpdir(), 'sleep 30', '1')
    // Au-delà de la seconde de démarrage du shell.
    await new Promise((r) => setTimeout(r, 1300))
    expect(manager.list('c1')[0]).toMatchObject({
      busy: true,
      title: 'sleep',
      command: { name: 'sleep' }
    })
    manager.interrupt('c1', '1')
    await new Promise((r) => setTimeout(r, 600))
    expect(manager.list('c1')[0]?.busy).toBe(false)
    expect(manager.list('c1')[0]?.command).toBeUndefined()
    expect(await manager.snapshot('c1', '1')).toContain('sleep 30')
    // Onglet ouvert par l'utilisateur : l'agent ne le prend pas, il ouvre le sien (fiche 126) ;
    // libre, le sien est ensuite réutilisé.
    expect(manager.run('c1', tmpdir(), 'true').id).toBe('2')
    await new Promise((r) => setTimeout(r, 600))
    expect(manager.run('c1', tmpdir(), 'true').id).toBe('2')
    manager.close('c1', '1')
    manager.close('c1', '2')
    expect(manager.list('c1')).toEqual([])
  })
})

describe('« Arrêter » une commande (fiche 166, vrai shell)', () => {
  it('Ctrl+C ignoré : SIGTERM à la commande après le délai ; le shell et l’onglet restent', async () => {
    const { manager, onChange } = setup()
    manager.create('c1', tmpdir())
    // Une commande qui ignore Ctrl+C (comme `vim` ou `tmux`).
    manager.run('c1', tmpdir(), `perl -e '$SIG{INT}="IGNORE"; sleep 30'`, '1')
    await new Promise((r) => setTimeout(r, 1300))
    expect(manager.list('c1')[0]?.command?.name).toBe('perl')
    onChange.mockClear()
    manager.stop('c1', '1')
    await new Promise((r) => setTimeout(r, 800))
    expect(manager.list('c1')[0]?.command?.name).toBe('perl')
    await new Promise((r) => setTimeout(r, 2000))
    expect(manager.list('c1')[0]).toMatchObject({ busy: false, title: expect.any(String) })
    expect(manager.list('c1')[0]?.exitCode).toBeUndefined()
    // La fin a été annoncée à l'UI (l'invite revenue).
    expect(onChange.mock.calls.at(-1)?.[0].tabs[0].command).toBeUndefined()
    // Le shell répond encore.
    manager.run('c1', tmpdir(), 'echo encore-$((40+2))', '1')
    expect(await manager.read('c1', '1', 5, 1500)).toContain('encore-42')
    // À l'invite, « Arrêter » n'envoie rien.
    manager.stop('c1', '1')
  }, 10_000)
})

describe('commande au premier plan (fiche 166)', () => {
  /** Faux pty : le programme au premier plan est celui qu'on dit. */
  function fake() {
    let emit: (data: string) => void = () => {}
    const writes: string[] = []
    const state = { process: 'zsh' }
    const terminate = vi.fn(async () => {})
    const onChange = vi.fn()
    const pty: Pty = {
      pid: 42,
      get process() {
        return state.process
      },
      onData: (listener) => (emit = listener),
      onExit: () => {},
      write: (data) => void writes.push(data),
      resize: () => {},
      kill: () => {}
    }
    const manager = new TerminalManager({
      spawn: () => pty,
      shell: '/bin/zsh',
      onData: () => {},
      onChange,
      terminateForeground: terminate
    })
    managers.push(manager)
    return { manager, state, emit: (d: string) => emit(d), writes, terminate, onChange }
  }

  it('vue après l’écho d’Entrée sans autre sortie, début de la commande, fin à l’invite', () => {
    vi.useFakeTimers({ now: 0 })
    try {
      const { manager, state, emit, onChange } = fake()
      manager.create('c1', '/p/projet')
      vi.setSystemTime(10_000)
      emit('$ ')
      vi.advanceTimersByTime(1000)
      expect(manager.list('c1')[0]).toMatchObject({ busy: false, title: 'projet' })
      expect(manager.list('c1')[0]?.command).toBeUndefined()
      // Entrée : le shell écrit le retour à la ligne, puis la commande prend le premier plan
      // sans rien écrire (`sleep 30`).
      emit('\r\n')
      state.process = 'sleep'
      vi.setSystemTime(10_200)
      onChange.mockClear()
      vi.advanceTimersByTime(400)
      expect(onChange).toHaveBeenCalledTimes(1)
      expect(onChange.mock.calls[0]?.[0].tabs[0]).toMatchObject({
        title: 'sleep',
        busy: true,
        command: { name: 'sleep', startedAt: 10_600 }
      })
      // Elle tourne : le début ne bouge pas.
      vi.setSystemTime(20_000)
      expect(manager.list('c1')[0]?.command).toEqual({ name: 'sleep', startedAt: 10_600 })
      // Fin : l'invite revient.
      state.process = 'zsh'
      onChange.mockClear()
      emit('$ ')
      expect(onChange).toHaveBeenCalledTimes(1)
      expect(onChange.mock.calls[0]?.[0].tabs[0].command).toBeUndefined()
      // Un shell dans le shell, c'est encore l'invite.
      state.process = 'bash'
      emit('bash$ ')
      expect(manager.list('c1')[0]?.command).toBeUndefined()
    } finally {
      vi.useRealTimers()
    }
  })

  it('« Arrêter » : Ctrl+C, puis SIGTERM si la même commande tourne encore ; rien à l’invite', async () => {
    vi.useFakeTimers({ now: 0 })
    try {
      const { manager, state, emit, writes, terminate } = fake()
      manager.create('c1', '/p')
      vi.setSystemTime(10_000)
      manager.stop('c1', '1')
      expect(writes).toEqual([])
      // Commande qui s'arrête au Ctrl+C : pas de SIGTERM.
      state.process = 'sleep'
      emit('\r\n')
      manager.stop('c1', '1')
      expect(writes).toEqual(['\x03'])
      state.process = 'zsh'
      emit('^C\r\n$ ')
      await vi.advanceTimersByTimeAsync(3000)
      expect(terminate).not.toHaveBeenCalled()
      // Commande qui ignore Ctrl+C : SIGTERM au bout de deux secondes, à son groupe.
      state.process = 'vim'
      emit('\r\n')
      manager.stop('c1', '1')
      await vi.advanceTimersByTimeAsync(1900)
      expect(terminate).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(200)
      expect(terminate).toHaveBeenCalledWith(42)
      // Une autre commande a pris la place entre-temps : on ne la tue pas.
      terminate.mockClear()
      manager.stop('c1', '1')
      state.process = 'less'
      emit('\r\n')
      await vi.advanceTimersByTimeAsync(3000)
      expect(terminate).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('programme au premier plan inconnu', () => {
  it('node-pty ne rend pas de nom pendant qu’un programme se termine : pas d’exception', () => {
    vi.useFakeTimers({ now: 0 })
    try {
      let emit: (data: string) => void = () => {}
      const manager = new TerminalManager({
        // Comme node-pty à la fin d'un programme : `process` ne rend rien.
        spawn: () => ({
          pid: 1,
          process: undefined as unknown as string,
          onData: (listener) => (emit = listener),
          onExit: () => {},
          write: () => {},
          resize: () => {},
          kill: () => {}
        }),
        shell: '/bin/zsh',
        onData: () => {},
        onChange: () => {}
      })
      managers.push(manager)
      manager.create('c1', tmpdir())
      vi.setSystemTime(5000)
      expect(() => emit('sortie')).not.toThrow()
      expect(manager.list('c1')[0]).toMatchObject({ busy: false })
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('pager (fiche 126)', () => {
  it('onglets ouverts par l’agent sans pager, ceux de l’utilisateur avec le sien', () => {
    const envs: NodeJS.ProcessEnv[] = []
    const manager = new TerminalManager({
      spawn: (_shell, _args, options) => {
        envs.push(options.env)
        return {
          pid: 1,
          process: 'zsh',
          onData: () => {},
          onExit: () => {},
          write: () => {},
          resize: () => {},
          kill: () => {}
        }
      },
      shell: '/bin/zsh',
      env: () => ({ PAGER: 'less', HOME: '/h' }),
      onData: () => {},
      onChange: () => {}
    })
    managers.push(manager)
    manager.create('c1', tmpdir())
    manager.run('c1', tmpdir(), 'git log --oneline -3')
    expect(envs[0]).toMatchObject({ PAGER: 'less' })
    expect(envs[0]?.['GIT_PAGER']).toBeUndefined()
    expect(envs[1]).toMatchObject({ PAGER: 'cat', GIT_PAGER: 'cat', HOME: '/h' })
  })
})
