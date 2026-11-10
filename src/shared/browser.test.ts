import { describe, expect, it } from 'vitest'
import { isLocalHost, normalizeUrl, siteToApprove } from './browser'

describe('adresses du navigateur intégré', () => {
  it('complète le schéma : http en local, https ailleurs', () => {
    expect(normalizeUrl('localhost:3000')).toBe('http://localhost:3000/')
    expect(normalizeUrl('127.0.0.1:8080/a')).toBe('http://127.0.0.1:8080/a')
    expect(normalizeUrl('exemple.com')).toBe('https://exemple.com/')
    expect(normalizeUrl(' https://exemple.com/x?y=1 ')).toBe('https://exemple.com/x?y=1')
  })

  it('refuse les autres schémas et les adresses vides', () => {
    expect(() => normalizeUrl('file:///etc/hosts')).toThrow('http')
    expect(() => normalizeUrl('ftp://exemple.com')).toThrow('http')
    expect(() => normalizeUrl('  ')).toThrow('vide')
  })

  it('hôtes locaux autorisés d’office, les autres à approuver', () => {
    expect(isLocalHost('app.localhost')).toBe(true)
    expect(isLocalHost('monprojet.test')).toBe(true)
    expect(isLocalHost('[::1]')).toBe(true)
    expect(siteToApprove('http://localhost:5173/')).toBeUndefined()
    expect(siteToApprove('https://exemple.com:8443/a')).toBe('exemple.com:8443')
  })
})
