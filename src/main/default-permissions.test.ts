import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ app: { isPackaged: true }, session: {} }))
vi.mock('./renderer-windows', () => ({
  RENDERER_FILE: '/Applications/Bobine.app/out/renderer/index.html'
}))

const { allowPermission, isAppPage } = await import('./default-permissions')

const built = { file: '/Applications/Bobine Beta.app/out/renderer/index.html' }
const dev = { file: built.file, devUrl: 'http://localhost:5173' }
const page = 'file:///Applications/Bobine%20Beta.app/out/renderer/index.html'

describe('permissions de la session par défaut', () => {
  it('la page de l’app : fichier construit (vue `#quick` comprise) ou serveur de développement', () => {
    expect(isAppPage(page, built)).toBe(true)
    expect(isAppPage(`${page}#quick`, built)).toBe(true)
    expect(isAppPage('file:///tmp/autre.html', built)).toBe(false)
    expect(isAppPage('http://localhost:5173/#about', dev)).toBe(true)
    expect(isAppPage('http://localhost:5173/', built)).toBe(false)
    // Aperçu HTML (fiche 064) : un serveur local, mais pas la page de l'app.
    expect(isAppPage('http://127.0.0.1:61234/index.html', dev)).toBe(false)
    expect(isAppPage('pas une adresse', dev)).toBe(false)
  })

  it('copier : accordé à la page de l’app, pas à un cadre ni à l’aperçu', () => {
    expect(allowPermission('clipboard-sanitized-write', page, true, built)).toBe(true)
    expect(allowPermission('clipboard-sanitized-write', page, false, built)).toBe(false)
    expect(
      allowPermission('clipboard-sanitized-write', 'http://127.0.0.1:61234/', true, built)
    ).toBe(false)
  })

  it.each([
    'clipboard-read',
    'notifications',
    'media',
    'geolocation',
    'fullscreen',
    'openExternal',
    'midi',
    'hid',
    'serial',
    'usb',
    'display-capture',
    'unknown'
  ])('%s : refusé, même à la page de l’app', (permission) => {
    expect(allowPermission(permission, page, true, built)).toBe(false)
  })
})
