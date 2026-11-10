import { describe, expect, it } from 'vitest'
import { joinCommandLine, parseMcpServer, splitCommandLine } from './mcp'

describe('serveur MCP saisi (fiche 025)', () => {
  it('vérifié et nettoyé selon le transport', () => {
    expect(
      parseMcpServer({
        name: ' recherche ',
        transport: 'stdio',
        command: 'npx',
        args: ['-y', ''],
        env: { API_KEY: 'k', ' ': 'x' },
        url: 'ignorée'
      })
    ).toEqual({
      name: 'recherche',
      transport: 'stdio',
      command: 'npx',
      args: ['-y'],
      env: { API_KEY: 'k' },
      enabled: true
    })
    expect(
      parseMcpServer({ name: 'web', transport: 'http', url: 'https://a.test/mcp', enabled: false })
    ).toEqual({
      name: 'web',
      transport: 'http',
      url: 'https://a.test/mcp',
      enabled: false
    })
    expect(parseMcpServer({ name: 'a b', command: 'x' })).toMatch(/Nom invalide/)
    expect(parseMcpServer({ name: 'x', transport: 'stdio' })).toMatch(/Commande/)
    expect(parseMcpServer({ name: 'x', transport: 'http', url: 'ftp://a' })).toMatch(/Adresse/)
  })

  it('ligne de commande : mots, guillemets, aller-retour', () => {
    const words = splitCommandLine(`npx -y "@acme/serveur mcp" --dir '/mon dossier' ""`)
    expect(words).toEqual(['npx', '-y', '@acme/serveur mcp', '--dir', '/mon dossier', ''])
    expect(splitCommandLine(joinCommandLine(words))).toEqual(words)
    expect(splitCommandLine(joinCommandLine(['dit "bonjour"']))).toEqual(['dit "bonjour"'])
  })
})
