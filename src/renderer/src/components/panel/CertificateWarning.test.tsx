/**
 * Avertissement de certificat (fiche 269, ADR-0063) : rien ne s'accepte sans « Avancé » puis
 * « Continuer » ; seul le jeton part au main ; pas de « Continuer » pour un site public.
 */
import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BrowserCertificateProblem } from '@shared/browser'
import { CertificateWarning } from './CertificateWarning'

const FINGERPRINT = `${'AB:'.repeat(31)}AB`
const problem: BrowserCertificateProblem = {
  token: 'jeton-1',
  url: 'https://localhost:5173/',
  host: 'localhost',
  port: 5173,
  error: 'net::ERR_CERT_AUTHORITY_INVALID',
  subject: 'localhost',
  issuer: 'localhost',
  fingerprint: FINGERPRINT,
  bypassable: true
}

const allowCertificate = vi.fn()
const leaveCertificate = vi.fn()

beforeEach(() => {
  allowCertificate.mockReset().mockResolvedValue(undefined)
  leaveCertificate.mockReset().mockResolvedValue(undefined)
  window.api.browser = { allowCertificate, leaveCertificate } as unknown as Window['api']['browser']
})

describe('avertissement de certificat (fiche 269)', () => {
  it('« Continuer » derrière « Avancé », avec le jeton seulement', async () => {
    render(<CertificateWarning conversationId="c1" problem={problem} />)
    expect(screen.queryByTestId('certificate-proceed')).toBeNull()
    expect(screen.queryByTestId('certificate-fingerprint')).toBeNull()
    fireEvent.click(screen.getByTestId('certificate-advanced'))
    expect(screen.getByTestId('certificate-fingerprint').textContent).toBe(FINGERPRINT)
    fireEvent.click(screen.getByTestId('certificate-remember'))
    await act(async () => {
      fireEvent.click(screen.getByTestId('certificate-proceed'))
    })
    expect(allowCertificate).toHaveBeenCalledWith('c1', 'jeton-1', true)
  })

  it('« Retour » ne touche à aucune exception', () => {
    render(<CertificateWarning conversationId="c1" problem={problem} />)
    fireEvent.click(screen.getByTestId('certificate-back'))
    expect(leaveCertificate).toHaveBeenCalledWith('c1')
    expect(allowCertificate).not.toHaveBeenCalled()
  })

  it('site public : pas de « Continuer », le navigateur habituel est conseillé', () => {
    render(
      <CertificateWarning
        conversationId="c1"
        problem={{ ...problem, host: 'exemple.com', port: 443, bypassable: false }}
      />
    )
    fireEvent.click(screen.getByTestId('certificate-advanced'))
    expect(screen.queryByTestId('certificate-proceed')).toBeNull()
    expect(screen.queryByTestId('certificate-remember')).toBeNull()
    expect(screen.getByTestId('certificate-not-allowed')).toBeTruthy()
  })

  it('refus du main : dit dans l’avertissement', async () => {
    allowCertificate.mockRejectedValue(new Error('Certificate warning unknown or out of date'))
    render(<CertificateWarning conversationId="c1" problem={problem} />)
    fireEvent.click(screen.getByTestId('certificate-advanced'))
    await act(async () => {
      fireEvent.click(screen.getByTestId('certificate-proceed'))
    })
    expect(screen.getByTestId('certificate-details').textContent).toContain('out of date')
  })
})
