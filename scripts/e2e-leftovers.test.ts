import { describe, expect, it } from 'vitest'
import {
  COMMAND_WIDTH,
  RUN_MARK,
  ancestry,
  formatLeftovers,
  formatLoad,
  markedPids,
  parsePs,
  pickLeftovers
} from './e2e-leftovers.mts'

const ROOT = '/Users/runner/work/bobine/bobine'

const PS = [
  '    1     0     1 10-02:03:04   0.0 /sbin/launchd',
  '  500     1   500    01:00:00   1.5 /bin/bash -e /Users/runner/work/_temp/step.sh',
  '  501   500   500    00:20:00   0,4 node /opt/pnpm e2e',
  '  502   501   500    00:19:59   2.0 node --disable-warning=X e2e/run.mjs',
  '  510   502   500       00:00   0.0 ps -axww -o pid=,ppid=,pgid=,etime=,%cpu=,command=',
  `  600     1   600    05:12  12.3 ${ROOT}/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron ${ROOT} --user-data-dir=/var/folders/x/T/bob-e2e-abc`,
  `  601     1   601    05:10   0.1 node ${ROOT}/mock-agent/main.mts --store /var/folders/x/T/bob-e2e-abc/s`,
  '  602     1   602    04:00   0.0 git fetch origin',
  '  603     1   603    03:00   0.0 python3 -m http.server 8766',
  '  604     1   500    02:00   0.0 sleep 30',
  '  605   601   601    02:00   0.0 /bin/sh -c npm test',
  '  606     1   601    02:00   0.0 sleep 60',
  '  700     1   700  1-00:00:00   3.0 /Applications/Bobine.app/Contents/MacOS/Bobine --user-data-dir=/x/profil-bricole',
  '  701   700   700    01:00   0.0 /Applications/Bobine.app/Contents/MacOS/opencode acp',
  '  800     1   800       12:00   0.0 /private/var/folders/y/T/bob-e2e-outils-q/sdk/platform-tools/adb',
  '  801   800   800       12:00   0.0 sleep 99',
  'ligne illisible'
].join('\n')

describe('relevé de fin de lot e2e', () => {
  it('lit ps : pid, parent, âge, %CPU (virgule comprise), commande', () => {
    const rows = parsePs(PS)
    expect(rows).toHaveLength(16)
    expect(rows[2]).toEqual({
      pid: 501,
      ppid: 500,
      pgid: 500,
      elapsed: '00:20:00',
      cpu: 0.4,
      command: 'node /opt/pnpm e2e'
    })
  })

  it('trouve la marque du lot dans l’environnement, sans prendre un autre lot', () => {
    const env = [
      `  602 git fetch origin HOME=/u ${RUN_MARK}=42-1 PATH=/bin`,
      `  603 python3 -m http.server 8766 ${RUN_MARK}=42-10`,
      `  604 sleep 30 ${RUN_MARK}=42-1`
    ].join('\n')
    expect([...markedPids(env, RUN_MARK, '42-1')]).toEqual([602, 604])
  })

  it('le lanceur et ses ancêtres ne sont jamais des restes', () => {
    expect([...ancestry(parsePs(PS), 502)].sort()).toEqual([1, 500, 501, 502])
  })

  it('garde ce qui est du lot, jamais le lanceur, son `ps` ni l’app installée', () => {
    const picked = pickLeftovers(parsePs(PS), {
      marked: new Set([602]),
      root: ROOT,
      self: 502,
      group: 500
    })
    expect(picked.map(({ row, why }) => [row.pid, why])).toEqual([
      [600, 'dépôt'],
      [601, 'dépôt'],
      [602, 'marque'],
      [604, 'groupe'],
      [605, 'descendant'],
      [606, 'descendant'],
      [800, 'dossier d’essai']
    ])
  })

  it('en ligne de commande (sans lot) : ni marque ni groupe du lanceur', () => {
    const picked = pickLeftovers(parsePs(PS), { marked: new Set(), root: ROOT, self: 502 })
    expect(picked.map(({ row }) => row.pid)).toEqual([600, 601, 605, 606, 800])
  })

  it('écrit un relevé court, dépôt raccourci et commandes tronquées', () => {
    expect(formatLeftovers([], ROOT)).toEqual(['aucun processus restant'])
    const electron = parsePs(PS).find((r) => r.pid === 600)
    if (!electron) throw new Error('ligne 600 absente')
    const long = { ...electron, command: `${electron.command} ${'--flag '.repeat(30)}` }
    const [head, line = ''] = formatLeftovers([{ row: long, why: 'dépôt' }], ROOT)
    expect(head).toBe('1 processus restant(s) (pid · âge · %CPU · raison · commande) :')
    expect(line).toMatch(/^ {2}600 · 05:12 · 12\.3 % · dépôt · \.\/node_modules\/electron/)
    expect(line.split(' · dépôt · ')[1]?.length).toBe(COMMAND_WIDTH)
    expect(line.endsWith('…')).toBe(true)
  })

  it('dit la charge, les cœurs et la mémoire libre', () => {
    expect(
      formatLoad({
        load: [3.5, 2, 1.25],
        cores: 3,
        freeBytes: 2 * 1024 ** 3,
        totalBytes: 7 * 1024 ** 3
      })
    ).toBe('charge 3.50 2.00 1.25 (1, 5, 15 min) · 3 cœurs · mémoire libre 2.0 / 7.0 Gio')
  })
})
