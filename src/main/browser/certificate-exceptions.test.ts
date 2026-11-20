import { describe, expect, it } from 'vitest'
import {
  cdpMethodAllowed,
  certificateAccepted,
  certificateAgentNote,
  certificateProblem,
  certificateSite,
  fingerprintOf,
  isPrivateDevHost,
  parseException,
  type CertificateMemory
} from './certificate-exceptions'
import type { CertificateException } from '@shared/browser'

/** Certificats publics auto-signés (`CN=localhost`, sans clé privée), faits pour l'essai. */
const CERT_A = [
  '-----BEGIN CERTIFICATE-----',
  'MIIBXjCCAQSgAwIBAgIUdknR/y0+3Wlymf4yG59pDYQ0YncwCgYIKoZIzj0EAwIw',
  'FDESMBAGA1UEAwwJbG9jYWxob3N0MCAXDTI2MTEyMDEwMDc1MVoYDzIxMjYxMDI3',
  'MTAwNzUxWjAUMRIwEAYDVQQDDAlsb2NhbGhvc3QwWTATBgcqhkjOPQIBBggqhkjO',
  'PQMBBwNCAAQpNDI3Zv8GRb0/8zDcnbFH/C/v9Dimf9qB6oXfKVjSy/5WJyT6LOVg',
  '5B8zpYUj93tQpC+lz7Fe3balaX725N98ozIwMDAdBgNVHQ4EFgQUc0tF14NczGXQ',
  'b8/+pEYdZk93iSEwDwYDVR0TAQH/BAUwAwEB/zAKBggqhkjOPQQDAgNIADBFAiB1',
  'Yq1nLcoFRufukynqn4DT8H9467mFdIfyKPGpKFMX/AIhAJ5Tt2KauD+s38ZG7Y/D',
  'x9HC2SzLoYj52IcmiJ+MQF4W',
  '-----END CERTIFICATE-----'
].join('\n')
const CERT_B = [
  '-----BEGIN CERTIFICATE-----',
  'MIIBXjCCAQSgAwIBAgIUYzb/uyz3f36nlXZtP5pOEk8Wz2AwCgYIKoZIzj0EAwIw',
  'FDESMBAGA1UEAwwJbG9jYWxob3N0MCAXDTI2MTEyMDEwMDc1MVoYDzIxMjYxMDI3',
  'MTAwNzUxWjAUMRIwEAYDVQQDDAlsb2NhbGhvc3QwWTATBgcqhkjOPQIBBggqhkjO',
  'PQMBBwNCAASNWIjLt6BP/VWOEZVbSDY/QXkEQl1eF8TbCILCTUEIh29cXUrFO2zU',
  'WnLk3oiMqASjzcFg3DsQeREIlg+v1bv2ozIwMDAdBgNVHQ4EFgQUPa+qGR8gp2Q9',
  'WiZBr6oqJF26pb8wDwYDVR0TAQH/BAUwAwEB/zAKBggqhkjOPQQDAgNIADBFAiBA',
  'SPvefA8Is901k3dzgHMOGgrVg3EXfNO1z4SxB3XcbgIhAM2YIck3PZ3QZKHY7YEm',
  '4dnMnyyBlN6IKK/sFBvtazt6',
  '-----END CERTIFICATE-----'
].join('\n')
const FP_A =
  '69:0C:BF:BA:CC:D2:FA:C5:EC:6F:D0:98:39:A9:69:89:80:EF:A6:EA:87:E3:20:55:A4:A8:41:63:C9:83:9D:A6'
const FP_B =
  'C1:AE:07:C2:22:7F:8C:B0:D6:16:F6:32:FB:35:0D:29:B2:FF:34:2E:AD:7A:06:9D:50:73:99:FC:07:35:A7:63'

/** Mémoire en liste, comme `ApprovalStore.certificates` sans fichier. */
function memory(list: CertificateException[]): CertificateMemory {
  return {
    has: (e) =>
      list.some((x) => x.host === e.host && x.port === e.port && x.fingerprint === e.fingerprint),
    hasSite: (host, port) => list.some((x) => x.host === host && x.port === port),
    add: (e) => list.push(e)
  }
}

describe('exceptions de certificat (fiche 269, ADR-0064)', () => {
  it('site : hôte et port des adresses chiffrées seulement, 443 par défaut', () => {
    expect(certificateSite('https://localhost:5173/app')).toEqual({ host: 'localhost', port: 5173 })
    expect(certificateSite('https://Dev.Localhost/')).toEqual({ host: 'dev.localhost', port: 443 })
    expect(certificateSite('wss://127.0.0.1:5173/?token=x')).toEqual({
      host: '127.0.0.1',
      port: 5173
    })
    expect(certificateSite('https://[::1]:8443/')).toEqual({ host: '::1', port: 8443 })
    expect(certificateSite('http://localhost:5173/')).toBeUndefined()
    expect(certificateSite('pas une adresse')).toBeUndefined()
  })

  it('hôtes locaux ou privés seulement', () => {
    for (const host of [
      'localhost',
      'app.localhost',
      '127.0.0.1',
      '127.8.9.10',
      '::1',
      '[::1]',
      'monapp.test',
      'mac-de-ada.local',
      '10.0.0.4',
      '172.16.0.1',
      '172.31.255.254',
      '192.168.1.20'
    ]) {
      expect(isPrivateDevHost(host), host).toBe(true)
    }
    for (const host of [
      'example.com',
      'localhost.example.com',
      'local',
      '.local',
      'localhost.',
      '8.8.8.8',
      '172.32.0.1',
      '172.15.0.1',
      '192.169.0.1',
      '11.0.0.1',
      '2001:db8::1',
      'fe80::1',
      '127.0.0.1.nip.io',
      ''
    ]) {
      expect(isPrivateDevHost(host), host).toBe(false)
    }
  })

  it('empreinte SHA-256 lue du PEM ; illisible : rien', () => {
    expect(fingerprintOf(CERT_A)).toBe(FP_A)
    expect(fingerprintOf(CERT_B)).toBe(FP_B)
    expect(fingerprintOf('-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----')).toBe(
      undefined
    )
    expect(fingerprintOf('')).toBeUndefined()
  })

  it('accepté seulement pour l’hôte, le port et l’empreinte exacts', () => {
    const granted = memory([{ host: 'localhost', port: 5173, fingerprint: FP_A }])
    const cert = { data: CERT_A }
    expect(certificateAccepted(granted, 'https://localhost:5173/', cert)).toBe(true)
    expect(certificateAccepted(granted, 'wss://localhost:5173/hmr', cert)).toBe(true)
    // Autre port, autre hôte (même machine), certificat régénéré : on redemande.
    expect(certificateAccepted(granted, 'https://localhost:5174/', cert)).toBe(false)
    expect(certificateAccepted(granted, 'https://127.0.0.1:5173/', cert)).toBe(false)
    expect(certificateAccepted(granted, 'https://localhost:5173/', { data: CERT_B })).toBe(false)
    // Pas de mémoire, certificat illisible, adresse non chiffrée : refusé.
    expect(certificateAccepted(undefined, 'https://localhost:5173/', cert)).toBe(false)
    expect(certificateAccepted(granted, 'https://localhost:5173/', { data: 'x' })).toBe(false)
    expect(certificateAccepted(granted, 'http://localhost:5173/', cert)).toBe(false)
  })

  it('avertissement : continuer seulement pour une adresse locale ou privée', () => {
    const local = certificateProblem(
      'https://localhost:5173/',
      'net::ERR_CERT_AUTHORITY_INVALID',
      { data: CERT_A, subjectName: 'localhost', issuerName: 'localhost' },
      'jeton'
    )
    expect(local).toEqual({
      token: 'jeton',
      url: 'https://localhost:5173/',
      host: 'localhost',
      port: 5173,
      error: 'net::ERR_CERT_AUTHORITY_INVALID',
      subject: 'localhost',
      issuer: 'localhost',
      fingerprint: FP_A,
      bypassable: true
    })
    const remote = certificateProblem(
      'https://exemple.com/',
      'net::ERR_CERT_AUTHORITY_INVALID',
      { data: CERT_A },
      'j'
    )
    expect(remote?.bypassable).toBe(false)
    expect(remote?.port).toBe(443)
    // Empreinte illisible : pas d'exception possible, même en local.
    const unreadable = certificateProblem(
      'https://localhost/',
      'net::ERR_CERT_INVALID',
      { data: '' },
      'j'
    )
    expect(unreadable?.bypassable).toBe(false)
    expect(certificateProblem('http://localhost/', 'x', { data: CERT_A }, 'j')).toBeUndefined()
  })

  it('exception relue ou reçue : vérifiée (hôte privé, port, empreinte)', () => {
    expect(parseException({ host: 'LocalHost', port: 5173, fingerprint: FP_A })).toEqual({
      host: 'localhost',
      port: 5173,
      fingerprint: FP_A
    })
    expect(parseException({ host: 'example.com', port: 443, fingerprint: FP_A })).toBeUndefined()
    expect(parseException({ host: 'localhost', port: 0, fingerprint: FP_A })).toBeUndefined()
    expect(parseException({ host: 'localhost', port: 70000, fingerprint: FP_A })).toBeUndefined()
    expect(parseException({ host: 'localhost', port: 1.5, fingerprint: FP_A })).toBeUndefined()
    expect(parseException({ host: 'localhost', port: 1, fingerprint: '*' })).toBeUndefined()
    expect(
      parseException({ host: 'localhost', port: 1, fingerprint: FP_A.toLowerCase() })
    ).toBeUndefined()
    expect(parseException('localhost')).toBeUndefined()
    expect(parseException(null)).toBeUndefined()
  })

  it('l’agent apprend qu’il ne peut pas accepter', () => {
    const problem = certificateProblem(
      'https://localhost:5173/',
      'net::ERR_CERT_AUTHORITY_INVALID',
      { data: CERT_A },
      'jeton'
    )
    if (!problem) throw new Error('avertissement attendu')
    const note = certificateAgentNote(problem)
    expect(note).toContain('net::ERR_CERT_AUTHORITY_INVALID')
    expect(note).toContain('Only the user can decide')
    expect(note).not.toContain('jeton')
    expect(certificateAgentNote({ ...problem, bypassable: false })).toContain(
      'does not allow continuing'
    )
  })

  it('CDP : aucune commande du domaine Security', () => {
    expect(cdpMethodAllowed('Input.dispatchMouseEvent')).toBe(true)
    expect(cdpMethodAllowed('Security.setIgnoreCertificateErrors')).toBe(false)
    expect(cdpMethodAllowed('Security.handleCertificateError')).toBe(false)
    expect(cdpMethodAllowed(' security.enable')).toBe(false)
  })
})
