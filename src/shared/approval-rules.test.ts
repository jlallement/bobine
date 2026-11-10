import { describe, expect, it } from 'vitest'
import {
  deniedPart,
  commandCoverage,
  commandParts,
  normalizeCommandPrefix,
  parseApprovalRulesChange
} from './approval-rules'

describe('couverture d’une commande par les listes de Bob (fiche 215)', () => {
  const allowed = ['wc', 'git status', 'npm run', 'ls ']
  const denied = ['git', 'npm run deploy', 'rm']
  it.each([
    ['wc -l gros.txt', 'allowed'],
    ['wc', 'allowed'],
    ['wcx -l', undefined],
    ['git status --short', 'allowed'],
    ['git  status', 'allowed'],
    ['git push --force', 'denied'],
    ['npm run lint', 'allowed'],
    ['npm run deploy --prod', 'denied'],
    ['rm -rf x', 'denied'],
    ['ls -la', 'allowed'],
    ['make', undefined],
    ['', undefined]
  ])('%s → %s', (command, expected) => {
    expect(commandCoverage(command, allowed, denied)).toBe(expected)
  })

  it('égalité : autorisée (comme Bob) ; liste vide : rien', () => {
    expect(commandCoverage('npm test', ['npm test'], ['npm test'])).toBe('allowed')
    expect(commandCoverage('npm test', ['npm'], ['npm'])).toBe('allowed')
    expect(commandCoverage('npm test', [], [])).toBeUndefined()
    expect(commandCoverage('npm test', ['  '], [])).toBeUndefined()
  })
})

describe('parties d’une commande enchaînée (fiche 215, Q6)', () => {
  const WS = '/Users/ada/projet'
  it.each([
    ['npm run lint', ['npm run lint']],
    [`cd ${WS} && npm test`, ['npm test']],
    [`cd "${WS}/" && npm test; npm run lint`, ['npm test', 'npm run lint']],
    ['cd . && make', ['make']],
    ['cd /tmp && rm x', ['cd /tmp', 'rm x']],
    ['cat a.txt | grep foo || echo none', ['cat a.txt', 'grep foo', 'echo none']],
    ['echo "a && b" && ls', ['echo "a && b"', 'ls']],
    ["echo 'a | b'", ["echo 'a | b'"]],
    ['echo a\\;b && ls', ['echo a\\;b', 'ls']],
    ['npm test && npm test', ['npm test']],
    ['npm  run   lint', ['npm run lint']]
  ])('%s → %j', (command, parts) => {
    expect(commandParts(command, WS)).toEqual(parts)
  })

  it.each([
    // Recette QA du 2026-11-09 (Bob 2.1.0) : message de commit avec parenthèses.
    [
      'git add -A && git commit -m "feat(calc): add add() and sub()"',
      ['git add -A', 'git commit -m "feat(calc): add add() and sub()"']
    ],
    [
      "git commit -m 'fix(ui): a && b' && git push",
      ["git commit -m 'fix(ui): a && b'", 'git push']
    ],
    ['echo "a && b" ; ls', ['echo "a && b"', 'ls']],
    ["sed 's/(x)/y/' a.txt | sort", ["sed 's/(x)/y/' a.txt", 'sort']],
    ['echo "a \\" (b)" && ls', ['echo "a \\" (b)"', 'ls']],
    ["echo '$(pas une substitution)' && ls", ["echo '$(pas une substitution)'", 'ls']],
    ['grep -E "a|b" f && wc -l f', ['grep -E "a|b" f', 'wc -l f']]
  ])('guillemets respectés : %s', (command, parts) => {
    expect(commandParts(command, WS)).toEqual(parts)
  })

  it.each([
    'echo $(whoami) && ls',
    'echo `id`',
    '(cd x && ls)',
    'echo "pas fermé && ls',
    'echo "$(date)" && ls',
    'echo "`id`" && ls',
    'diff <(ls a) <(ls b)',
    'tee >(gzip > x.gz) < f'
  ])('au moindre doute, la commande entière : %s', (command) => {
    expect(commandParts(command, WS)).toEqual([command])
  })

  it('seulement un cd vers le dossier : la commande entière ; vide : rien', () => {
    expect(commandParts(`cd ${WS}`, WS)).toEqual([`cd ${WS}`])
    expect(commandParts('   ', WS)).toEqual([])
    expect(commandParts(`cd ${WS} && ls`)).toEqual([`cd ${WS}`, 'ls'])
  })
})

describe('préfixe de commande (fiche 215)', () => {
  it('espaces normalisés, un seul mot signalé, vide ou trop long refusé', () => {
    expect(normalizeCommandPrefix('  npm \t run\n build ')).toEqual({
      prefix: 'npm run build',
      singleWord: false
    })
    expect(normalizeCommandPrefix('git')).toEqual({ prefix: 'git', singleWord: true })
    expect(normalizeCommandPrefix(' \n ')).toBeUndefined()
    expect(normalizeCommandPrefix('a'.repeat(1001))).toBeUndefined()
    expect(normalizeCommandPrefix('a'.repeat(1000))?.prefix).toHaveLength(1000)
  })
})

describe('changement venu du renderer (fiche 215)', () => {
  it('seules les formes attendues passent, sans champ en trop', () => {
    expect(
      parseApprovalRulesChange({ type: 'allowCommandEverywhere', prefix: 'npm test', x: 1 })
    ).toEqual({ type: 'allowCommandEverywhere', prefix: 'npm test' })
    expect(parseApprovalRulesChange({ type: 'addCommand', prefix: 'rm', list: 'denied' })).toEqual({
      type: 'addCommand',
      prefix: 'rm',
      list: 'denied'
    })
    expect(
      parseApprovalRulesChange({ type: 'setGroupOutsideWorkspace', group: 'edit', enabled: false })
    ).toEqual({ type: 'setGroupOutsideWorkspace', group: 'edit', enabled: false })
    expect(parseApprovalRulesChange({ type: 'setOutsideWorkspaceAllowed', enabled: true })).toEqual(
      { type: 'setOutsideWorkspaceAllowed', enabled: true }
    )
  })

  it.each([
    null,
    'setGroup',
    { type: 'setGroup', group: 'root', enabled: true },
    { type: 'setGroup', group: 'edit', enabled: 'oui' },
    { type: 'addCommand', prefix: 'rm', list: 'partout' },
    { type: 'removeCommand', list: 'allowed' },
    { type: 'allowCommandEverywhere', prefix: 42 },
    { type: 'setForbiddenGroups', groups: [] }
  ])('refusé : %j', (value) => {
    expect(parseApprovalRulesChange(value)).toBeUndefined()
  })
})

describe('partie refusée partout d’une commande (fiche 215, recette QA)', () => {
  const lists = { allowed: ['npm test', 'node'], denied: ['node --version', 'rm'] }
  it.each([
    ['npm test && node --version', 'node --version'],
    ['node --version', 'node --version'],
    ['node script.js', undefined],
    ['cd /w && rm -rf x', 'rm -rf x'],
    ['echo "rm -rf x"', undefined],
    ['npm test', undefined]
  ])('%s → %s', (command, part) => {
    expect(deniedPart(command, lists, '/w')).toBe(part)
  })
})
