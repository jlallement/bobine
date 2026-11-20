import { describe, expect, it } from 'vitest'
import {
  canBypass,
  cdpMethodAllowed,
  certificateAccepted,
  certificateAgentNote,
  certificateProblem,
  certificateSite,
  fingerprintOf,
  insecureException,
  isPrivateAddress,
  isPrivateDevHost,
  needsAddressCheck,
  parseException,
  privateAddresses,
  refusalOf,
  sameException,
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

const AUTHORITY = 'net::ERR_CERT_AUTHORITY_INVALID'

/** Mémoire en liste, comme `ApprovalStore.certificates` sans fichier. */
function memory(list: CertificateException[]): CertificateMemory {
  return {
    has: (e) => list.some((x) => sameException(x, e)),
    forSite: (host, port) => list.filter((x) => x.host === host && x.port === port),
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
      'fd12:3456::1',
      'fe80::1',
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
      '127.0.0.1.nip.io',
      ''
    ]) {
      expect(isPrivateDevHost(host), host).toBe(false)
    }
  })

  it('IP contactée : locale ou privée, IPv4 écrite en IPv6 comprise', () => {
    for (const ip of [
      '127.0.0.1',
      '10.1.2.3',
      '192.168.0.9',
      '::1',
      'fe80::1%en0',
      '::ffff:10.0.0.1'
    ]) {
      expect(isPrivateAddress(ip), ip).toBe(true)
    }
    for (const ip of ['8.8.8.8', '2001:db8::1', '::ffff:8.8.8.8', 'localhost', '']) {
      expect(isPrivateAddress(ip), ip).toBe(false)
    }
    expect(privateAddresses(['192.168.1.2', 'fe80::2'])).toBe(true)
    // Une seule adresse publique suffit à refuser ; aucune adresse : refusé.
    expect(privateAddresses(['192.168.1.2', '93.184.216.34'])).toBe(false)
    expect(privateAddresses([])).toBe(false)
  })

  it('`.test` et `.local` : l’IP réellement contactée doit être privée', () => {
    expect(needsAddressCheck('monapp.test')).toBe(true)
    expect(needsAddressCheck('mac.local')).toBe(true)
    expect(needsAddressCheck('localhost')).toBe(false)
    expect(needsAddressCheck('app.localhost')).toBe(false)
    expect(needsAddressCheck('192.168.1.2')).toBe(false)
    const problem = { host: 'monapp.test', fingerprint: FP_A, error: AUTHORITY }
    expect(refusalOf(problem)).toBe('address')
    expect(refusalOf(problem, ['93.184.216.34'])).toBe('address')
    expect(canBypass(problem, ['127.0.0.1'])).toBe(true)
    // Avertissement : en vérification tant que l'adresse n'est pas résolue, jamais permis d'office.
    const pending = certificateProblem('https://monapp.test/', AUTHORITY, { data: CERT_A }, 'j')
    expect(pending?.bypassable).toBe(false)
    expect(pending?.checking).toBe(true)
  })

  it('erreur : seules celles d’un serveur de développement permettent de continuer', () => {
    for (const error of [
      AUTHORITY,
      'net::ERR_CERT_COMMON_NAME_INVALID',
      'net::ERR_CERT_DATE_INVALID'
    ]) {
      expect(canBypass({ host: 'localhost', fingerprint: FP_A, error }), error).toBe(true)
    }
    for (const error of [
      'net::ERR_CERT_REVOKED',
      'net::ERR_CERT_WEAK_KEY',
      'net::ERR_CERT_WEAK_SIGNATURE_ALGORITHM',
      'net::ERR_CERT_INVALID',
      'net::ERR_CERT_SYMANTEC_LEGACY'
    ]) {
      const problem = certificateProblem('https://localhost:5173/', error, { data: CERT_A }, 'j')
      expect(problem?.bypassable, error).toBe(false)
      expect(problem?.refusal, error).toBe('error')
    }
  })

  it('empreinte SHA-256 lue du PEM ou du DER ; illisible : rien', () => {
    expect(fingerprintOf(CERT_A)).toBe(FP_A)
    expect(fingerprintOf(CERT_B)).toBe(FP_B)
    const der = Buffer.from(CERT_A.replace(/-----[^-]+-----|\s/g, ''), 'base64')
    expect(fingerprintOf(der)).toBe(FP_A)
    expect(fingerprintOf('-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----')).toBe(
      undefined
    )
    expect(fingerprintOf('')).toBeUndefined()
  })

  it('accepté seulement pour l’hôte, le port, l’empreinte et le code exacts', () => {
    const granted = memory([{ host: 'localhost', port: 5173, fingerprint: FP_A, error: AUTHORITY }])
    const cert = { data: CERT_A }
    expect(certificateAccepted(granted, 'https://localhost:5173/', AUTHORITY, cert)).toBe(true)
    expect(certificateAccepted(granted, 'wss://localhost:5173/hmr', AUTHORITY, cert)).toBe(true)
    // Autre port, autre hôte (même machine), certificat régénéré, autre code : on redemande.
    expect(certificateAccepted(granted, 'https://localhost:5174/', AUTHORITY, cert)).toBe(false)
    expect(certificateAccepted(granted, 'https://127.0.0.1:5173/', AUTHORITY, cert)).toBe(false)
    expect(
      certificateAccepted(granted, 'https://localhost:5173/', AUTHORITY, { data: CERT_B })
    ).toBe(false)
    expect(
      certificateAccepted(granted, 'https://localhost:5173/', 'net::ERR_CERT_DATE_INVALID', cert)
    ).toBe(false)
    // Pas de mémoire, certificat illisible, adresse non chiffrée : refusé.
    expect(certificateAccepted(undefined, 'https://localhost:5173/', AUTHORITY, cert)).toBe(false)
    expect(certificateAccepted(granted, 'https://localhost:5173/', AUTHORITY, { data: 'x' })).toBe(
      false
    )
    expect(certificateAccepted(granted, 'http://localhost:5173/', AUTHORITY, cert)).toBe(false)
  })

  it('avertissement : continuer seulement pour une adresse locale ou privée', () => {
    const local = certificateProblem(
      'https://localhost:5173/',
      AUTHORITY,
      { data: CERT_A, subjectName: 'localhost', issuerName: 'localhost' },
      'jeton',
      false
    )
    expect(local).toEqual({
      token: 'jeton',
      url: 'https://localhost:5173/',
      host: 'localhost',
      port: 5173,
      error: AUTHORITY,
      subject: 'localhost',
      issuer: 'localhost',
      fingerprint: FP_A,
      bypassable: true,
      rememberable: false
    })
    const remote = certificateProblem('https://exemple.com/', AUTHORITY, { data: CERT_A }, 'j')
    expect(remote?.bypassable).toBe(false)
    expect(remote?.refusal).toBe('public')
    expect(remote?.port).toBe(443)
    // Empreinte illisible : pas d'exception possible, même en local.
    const unreadable = certificateProblem('https://localhost/', AUTHORITY, { data: '' }, 'j')
    expect(unreadable?.bypassable).toBe(false)
    expect(unreadable?.refusal).toBe('unreadable')
    expect(certificateProblem('http://localhost/', 'x', { data: CERT_A }, 'j')).toBeUndefined()
  })

  it('exception relue ou reçue : vérifiée (hôte privé, port, empreinte, code permis)', () => {
    const ok = { host: 'LocalHost', port: 5173, fingerprint: FP_A, error: AUTHORITY }
    expect(parseException(ok)).toEqual({ ...ok, host: 'localhost' })
    expect(parseException({ ...ok, host: 'example.com' })).toBeUndefined()
    expect(parseException({ ...ok, port: 0 })).toBeUndefined()
    expect(parseException({ ...ok, port: 70000 })).toBeUndefined()
    expect(parseException({ ...ok, port: 1.5 })).toBeUndefined()
    expect(parseException({ ...ok, fingerprint: '*' })).toBeUndefined()
    expect(parseException({ ...ok, fingerprint: FP_A.toLowerCase() })).toBeUndefined()
    expect(parseException({ ...ok, error: 'net::ERR_CERT_REVOKED' })).toBeUndefined()
    expect(parseException({ host: 'localhost', port: 1, fingerprint: FP_A })).toBeUndefined()
    expect(parseException('localhost')).toBeUndefined()
    expect(parseException(null)).toBeUndefined()
  })

  it('« Non sécurisé » : une exception vraiment utilisée dans le document, encore accordée', () => {
    const a = { host: 'localhost', port: 5173, fingerprint: FP_A, error: AUTHORITY }
    const b = { host: 'localhost', port: 5174, fingerprint: FP_B, error: AUTHORITY }
    const granted = memory([a, b])
    // Rien d'utilisé (page saine sur un site qui a une exception) : pas d'indicateur.
    expect(insecureException(granted, 'https://localhost:5173/', [])).toBeUndefined()
    expect(insecureException(granted, 'https://localhost:5173/x', [a])).toEqual(a)
    // Sous-ressource seulement (page http, image d'un site sous exception) : l'indicateur aussi.
    expect(insecureException(granted, 'http://localhost:3000/', [b])).toEqual(b)
    // Celle du site de la page d'abord.
    expect(insecureException(granted, 'https://localhost:5174/', [a, b])).toEqual(b)
    // Révoquée : plus d'indicateur.
    expect(insecureException(memory([b]), 'https://localhost:5173/', [a])).toBeUndefined()
    expect(insecureException(undefined, 'https://localhost:5173/', [a])).toBeUndefined()
  })

  it('l’agent apprend qu’il ne peut pas accepter, sans être invité à insister', () => {
    const problem = certificateProblem(
      'https://localhost:5173/',
      AUTHORITY,
      { data: CERT_A },
      'jeton'
    )
    if (!problem) throw new Error('avertissement attendu')
    const note = certificateAgentNote(problem)
    expect(note).toContain(AUTHORITY)
    expect(note).toContain('The user can choose to continue in the panel; do not insist.')
    expect(note).not.toContain('try again')
    expect(note).not.toContain('jeton')
    expect(certificateAgentNote({ ...problem, bypassable: false })).toContain(
      'does not allow continuing'
    )
    const long = `https://localhost:5173/${'x'.repeat(500)}`
    const truncated = certificateAgentNote({ ...problem, url: long })
    expect(truncated).not.toContain(long)
    expect(truncated).toContain(`${long.slice(0, 120)}…`)
  })

  it('CDP : rien du domaine Security, rien vers une autre cible', () => {
    expect(cdpMethodAllowed('Input.dispatchMouseEvent')).toBe(true)
    expect(cdpMethodAllowed('Network.getCertificate')).toBe(true)
    expect(cdpMethodAllowed('Security.setIgnoreCertificateErrors')).toBe(false)
    expect(cdpMethodAllowed('Security.handleCertificateError')).toBe(false)
    expect(cdpMethodAllowed(' security.enable')).toBe(false)
    expect(cdpMethodAllowed('Target.sendMessageToTarget')).toBe(false)
    expect(cdpMethodAllowed('Target.attachToTarget')).toBe(false)
  })
})
