import { describe, expect, it } from 'vitest'
import { commandLine, parseLaunchFile, urlOf } from './launch'

const file = (configurations: unknown) => JSON.stringify({ version: '0.0.1', configurations })

describe('fichier de lancement', () => {
  it('format de Claude Code : commande, arguments, port ; URL par défaut', () => {
    const [web] = parseLaunchFile(
      file([{ name: 'web', runtimeExecutable: 'npm', runtimeArgs: ['run', 'dev'], port: 5173 }])
    )
    expect(web).toEqual({
      name: 'web',
      runtimeExecutable: 'npm',
      runtimeArgs: ['run', 'dev'],
      port: 5173,
      env: {}
    })
    expect(web && commandLine(web)).toBe('npm run dev')
    expect(web && urlOf(web)).toBe('http://localhost:5173/')
  })

  it('serveur existant : une URL sans commande', () => {
    const [api] = parseLaunchFile(file([{ name: 'api', url: 'http://localhost:8080/docs' }]))
    expect(api && urlOf(api)).toBe('http://localhost:8080/docs')
  })

  it('forme en une ligne (« command ») et port déduit de l’URL, comme Bob l’écrit', () => {
    const [quiz] = parseLaunchFile(
      file([
        {
          name: 'quiz',
          command: 'npx --yes serve . -l 3456',
          url: 'http://localhost:3456/quiz.html'
        }
      ])
    )
    expect(quiz).toMatchObject({ command: 'npx --yes serve . -l 3456', port: 3456 })
    expect(quiz && commandLine(quiz)).toBe('npx --yes serve . -l 3456')
    expect(() =>
      parseLaunchFile(file([{ name: 'x', command: 'a', runtimeExecutable: 'b', port: 1 }]))
    ).toThrow('pas les deux')
  })

  it('erreurs lisibles', () => {
    expect(() => parseLaunchFile('{')).toThrow('JSON invalide')
    expect(() => parseLaunchFile('{}')).toThrow('configurations')
    expect(() => parseLaunchFile(file([{ name: 'a b', url: 'http://x' }]))).toThrow('name')
    expect(() => parseLaunchFile(file([{ name: 'web', runtimeExecutable: 'npm' }]))).toThrow('port')
    expect(() => parseLaunchFile(file([{ name: 'web' }]))).toThrow('runtimeExecutable')
    expect(() =>
      parseLaunchFile(file([{ name: 'web', url: 'http://x', cwd: '../ailleurs' }]))
    ).toThrow('cwd')
    expect(() =>
      parseLaunchFile(
        file([
          { name: 'web', url: 'http://x' },
          { name: 'web', url: 'http://y' }
        ])
      )
    ).toThrow('double')
  })
})
