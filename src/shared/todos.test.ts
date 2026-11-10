import { describe, expect, it } from 'vitest'
import { MAX_TODOS, parseTodos, todosOf, withTodos } from './todos'

describe('parseTodos : texte à cases (comme Bob 2.0.9)', () => {
  it('lit les trois états', () => {
    expect(parseTodos('[x] Vérifier\n[-] Lancer\n[ ] Tester')).toEqual([
      { text: 'Vérifier', state: 'completed' },
      { text: 'Lancer', state: 'in_progress' },
      { text: 'Tester', state: 'pending' }
    ])
  })

  it('accepte les mêmes marqueurs que Bob : X majuscule, ~ en cours, espaces dans la case', () => {
    expect(parseTodos('[X] A\n[~] B\n[ x ] C\n[  ] D')).toEqual([
      { text: 'A', state: 'completed' },
      { text: 'B', state: 'in_progress' },
      { text: 'C', state: 'completed' },
      { text: 'D', state: 'pending' }
    ])
  })

  it('ignore les lignes vides, le texte sans case et les cases sans texte', () => {
    expect(
      parseTodos('\n  \nIntro\n[ ] Une\n[x]\n[?] Autre\n- [ ] liste\n\n[ ]   Deux  \n')
    ).toEqual([
      { text: 'Une', state: 'pending' },
      { text: 'Deux', state: 'pending' }
    ])
  })

  it('fins de ligne Windows et retraits', () => {
    expect(parseTodos('  [x] A\r\n\t[ ] B\r\n')).toEqual([
      { text: 'A', state: 'completed' },
      { text: 'B', state: 'pending' }
    ])
  })

  it('garde le texte tel quel, marqueurs compris, et les accents', () => {
    expect(parseTodos('[ ] Corriger [x] dans le fichier é')).toEqual([
      { text: 'Corriger [x] dans le fichier é', state: 'pending' }
    ])
  })

  it('texte vide ou sans case : liste vide', () => {
    expect(parseTodos('')).toEqual([])
    expect(parseTodos('rien ici')).toEqual([])
  })

  it('tronque une tâche très longue et borne le nombre de tâches', () => {
    const [long] = parseTodos(`[ ] ${'a'.repeat(2000)}`)
    expect(long?.text.length).toBe(501)
    expect(long?.text.endsWith('…')).toBe(true)
    const many = Array.from({ length: MAX_TODOS + 50 }, (_, i) => `[ ] t${i}`).join('\n')
    expect(parseTodos(many)).toHaveLength(MAX_TODOS)
  })
})

describe('parseTodos : tableau', () => {
  it('tableau de textes : à faire, ou lignes à cases', () => {
    expect(parseTodos(['Lire', '[x] Fait', '  ', '[-] En cours'])).toEqual([
      { text: 'Lire', state: 'pending' },
      { text: 'Fait', state: 'completed' },
      { text: 'En cours', state: 'in_progress' }
    ])
  })

  it('objets : texte et état sous les noms usuels', () => {
    expect(
      parseTodos([
        { content: 'A', status: 'completed' },
        { text: 'B', status: 'in_progress' },
        { title: 'C', state: 'In Progress' },
        { description: 'D', status: 'pending' },
        { task: 'E', done: true },
        { content: 'F' },
        { content: 'G', status: 'inconnu' }
      ])
    ).toEqual([
      { text: 'A', state: 'completed' },
      { text: 'B', state: 'in_progress' },
      { text: 'C', state: 'in_progress' },
      { text: 'D', state: 'pending' },
      { text: 'E', state: 'completed' },
      { text: 'F', state: 'pending' },
      { text: 'G', state: 'pending' }
    ])
  })

  it('ignore ce qui n’est pas lisible, sans planter', () => {
    expect(parseTodos([null, 3, [], {}, { content: '' }, { content: 5 }, 'ok'])).toEqual([
      { text: 'ok', state: 'pending' }
    ])
  })
})

describe('parseTodos : autres valeurs', () => {
  it.each([undefined, null, 5, true, {}, { content: 'x' }])('%j : liste vide', (value) => {
    expect(parseTodos(value)).toEqual([])
  })
})

describe('todosOf / withTodos', () => {
  it('lit rawInput.todos, jamais le titre ni le genre', () => {
    expect(todosOf({ todos: '[x] A' })).toEqual([{ text: 'A', state: 'completed' }])
    expect(todosOf({ command: 'ls' })).toBeUndefined()
    expect(todosOf('[x] A')).toBeUndefined()
    expect(todosOf(null)).toBeUndefined()
    expect(todosOf({ todos: '' })).toBeUndefined()
  })

  it('withTodos : les nouvelles tâches, sinon celles déjà gardées, sinon rien', () => {
    const before = [{ text: 'A', state: 'pending' as const }]
    expect(withTodos({ todos: '[x] B' }, { todos: before })).toEqual({
      todos: [{ text: 'B', state: 'completed' }]
    })
    expect(withTodos({ path: 'a' }, { todos: before })).toEqual({ todos: before })
    expect(withTodos({ path: 'a' })).toEqual({})
  })
})
