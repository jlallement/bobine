/**
 * Chargement d'une adresse dans un onglet (`loadWithin`) : ce qui est une erreur à afficher, et ce
 * qui ne l'est pas (navigation remplacée, certificat refusé dont l'onglet montre l'avertissement,
 * fiche 269). La vraie vérification du certificat par Chromium reste dans l'e2e `certificats`.
 */
import { describe, expect, it } from 'vitest'
import type { WebContentsView } from 'electron'
import type { CdpTab } from './cdp-tab'
import { loadWithin } from './browser-driver'

function tabRefusing(message: string, certificate?: unknown) {
  return {
    view: {
      webContents: { loadURL: () => Promise.reject(new Error(message)) }
    } as unknown as WebContentsView,
    cdp: { whenReady: async () => {} } as unknown as CdpTab,
    certificate
  }
}

describe('chargement d’une adresse (fiches 007, 269)', () => {
  it('certificat refusé : l’onglet montre l’avertissement, pas d’erreur rendue à la barre', async () => {
    const tab = tabRefusing("ERR_CERT_AUTHORITY_INVALID (-202) loading 'https://localhost:5173/'", {
      token: 'jeton-1'
    })
    await expect(loadWithin(tab, 'https://localhost:5173/')).resolves.toBeUndefined()
  })

  it('navigation remplacée (redirection de la page) : pas une erreur', async () => {
    const tab = tabRefusing("ERR_ABORTED (-3) loading 'http://localhost:3000/'")
    await expect(loadWithin(tab, 'http://localhost:3000/')).resolves.toBeUndefined()
  })

  it('autre échec, ou certificat sans avertissement posé : l’erreur remonte', async () => {
    await expect(
      loadWithin(tabRefusing('ERR_CONNECTION_REFUSED (-102)'), 'http://localhost:9/')
    ).rejects.toThrow('ERR_CONNECTION_REFUSED')
    await expect(
      loadWithin(tabRefusing('ERR_CERT_AUTHORITY_INVALID (-202)'), 'https://exemple.com/')
    ).rejects.toThrow('ERR_CERT_AUTHORITY_INVALID')
  })
})
