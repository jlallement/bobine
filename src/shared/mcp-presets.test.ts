import { describe, expect, it } from 'vitest'
import { MCP_PRESETS, normalizeMcpUrl, presetById, presetForUrl } from './mcp-presets'

describe('préréglages de serveurs MCP (fiche 293)', () => {
  const figma = presetById('figma')

  it('Figma en donnée : adresse du serveur, hôte et chemin exacts de la page', () => {
    expect(figma).toEqual({
      id: 'figma',
      name: 'figma',
      url: 'https://mcp.figma.com/mcp',
      pageHost: 'www.figma.com',
      pagePath: '/oauth/mcp',
      pageLoopbackRedirect: true,
      logo: 'figma/Figma Icon (Full-color).svg',
      listUrl: 'https://developers.figma.com/docs/figma-mcp-server/'
    })
    expect(MCP_PRESETS).toHaveLength(1)
    expect(presetById('inconnu')).toBeUndefined()
  })

  it('même adresse écrite autrement : `/` final, hôte en majuscules, port par défaut, requête', () => {
    for (const url of [
      'https://mcp.figma.com/mcp',
      'https://mcp.figma.com/mcp/',
      'https://MCP.FIGMA.COM/mcp',
      'https://mcp.figma.com:443/mcp',
      '  https://mcp.figma.com/mcp?x=1  '
    ]) {
      expect(presetForUrl(url), url).toBe(figma)
    }
  })

  it('autre adresse : autre chemin, autre hôte, http, identifiants, illisible, absente', () => {
    for (const url of [
      'https://mcp.figma.com/autre',
      'https://mcp.figma.com/',
      'https://mcp.figma.com',
      'https://mcp.figma.com.evil.tld/mcp',
      'http://mcp.figma.com/mcp',
      'https://u:p@mcp.figma.com/mcp',
      'https://u@mcp.figma.com/mcp',
      'pas une adresse',
      undefined
    ]) {
      expect(presetForUrl(url), String(url)).toBeUndefined()
    }
    expect(normalizeMcpUrl('https://:p@mcp.figma.com/mcp')).toBeUndefined()
  })
})
