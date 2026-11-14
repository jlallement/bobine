import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProfileSummary } from '@shared/agent'
import type { Role, RolesListing } from '@shared/roles'
import { RoleWizard } from './RoleWizard'
import { resetRolesUi } from '../../roles/roles-store'

const security: Role = {
  name: 'security-expert',
  label: 'Expert sécu',
  icon: 'shield-check',
  color: 'orange',
  description: 'Audits security.',
  readOnly: true,
  prompt: 'You are a security expert.',
  scope: 'builtin'
}
const listing: RolesListing = {
  roles: [{ ...security, enabled: true }],
  problems: []
}
const profiles = [
  { id: 'mock', label: 'Agent factice', available: true },
  { id: 'opencode', label: 'OpenCode', available: true, writesWithoutAsking: true }
] as ProfileSummary[]

let save: ReturnType<typeof vi.fn>
const api = window.api

beforeEach(() => {
  resetRolesUi()
  save = vi.fn(async () => ({ ok: true }))
  Object.assign(window, {
    api: {
      ...api,
      roles: {
        list: vi.fn(async () => listing),
        read: vi.fn(async (_scope: string, name: string) =>
          name === security.name ? security : null
        ),
        save
      }
    }
  })
})
afterEach(() => {
  Object.assign(window, { api })
})

const type = (testId: string, value: string) =>
  fireEvent.change(screen.getByTestId(testId), { target: { value } })

function renderWizard(over: Partial<Parameters<typeof RoleWizard>[0]> = {}) {
  const onCreated = vi.fn()
  const onClose = vi.fn()
  render(
    <RoleWizard
      prefill={{}}
      conversationId="c1"
      conversationProfileId="mock"
      project="boutique"
      profiles={profiles}
      canTry
      onClose={onClose}
      onCreated={onCreated}
      {...over}
    />
  )
  return { onCreated, onClose }
}

describe('assistant de création d’un rôle (fiche 223, phase 3A)', () => {
  it('étape 1 : « Suivant » montre les erreurs de l’étape sans avancer', async () => {
    renderWizard()
    await act(async () => {})
    fireEvent.click(screen.getByTestId('role-wizard-next'))
    expect(screen.getByTestId('role-wizard').dataset.step).toBe('who')
    expect(
      screen.getAllByTestId('role-field-error').map((e) => e.textContent?.replace(/\u00a0/g, ' '))
    ).toEqual([
      'Donnez un nom au rôle.',
      'Nom invalide : minuscules, chiffres et tirets, 40 caractères au plus.',
      'Description manquante ou trop longue (300 caractères au plus).'
    ])
    expect(screen.getByTestId('role-label').getAttribute('aria-invalid')).toBe('true')
  })

  it('les trois étapes au clavier, modèle présélectionné, enregistrement dans le projet', async () => {
    const { onCreated } = renderWizard()
    await act(async () => {})
    type('role-label', 'Expert sécu')
    expect((screen.getByTestId('role-name') as HTMLInputElement).value).toBe('expert-secu')
    expect(screen.getByTestId('role-icon-shield-check').getAttribute('aria-checked')).toBe('true')
    type('role-description', 'Relit le code sensible avant la fusion.')
    // ⌘↩ : étape suivante.
    fireEvent.keyDown(screen.getByTestId('role-description'), { key: 'Enter', metaKey: true })
    await waitFor(() => expect(screen.getByTestId('role-wizard').dataset.step).toBe('how'))
    // Le rôle fourni qui ressemble au nom est présélectionné, sa consigne remplie.
    expect(screen.getByTestId('role-template-security-expert').getAttribute('aria-checked')).toBe(
      'true'
    )
    expect((screen.getByTestId('role-prompt') as HTMLTextAreaElement).value).toBe(security.prompt)
    fireEvent.click(screen.getByTestId('role-wizard-next'))
    expect(screen.getByTestId('role-wizard').dataset.step).toBe('with')
    expect((screen.getByTestId('role-read-only') as HTMLInputElement).checked).toBe(true)
    fireEvent.click(screen.getByTestId('role-scope-project'))
    expect(screen.getByTestId('role-preview-file').textContent).toContain(
      '.bobine/roles/expert-secu.md'
    )
    await act(async () => {
      fireEvent.click(screen.getByTestId('role-wizard-create-try'))
    })
    expect(save).toHaveBeenCalledWith(
      'project',
      expect.objectContaining({ name: 'expert-secu', readOnly: true, prompt: security.prompt }),
      { conversationId: 'c1' }
    )
    expect(onCreated).toHaveBeenCalledWith('expert-secu', true)
  })

  it('nom déjà pris (refus du main) : retour à l’étape 1, erreur sous l’identifiant', async () => {
    save.mockResolvedValueOnce({ ok: false, error: { code: 'duplicateName', field: 'name' } })
    const { onCreated } = renderWizard({
      prefill: { label: 'Testeur', description: 'Teste.', prompt: 'Teste tout.' }
    })
    await act(async () => {})
    fireEvent.click(screen.getByTestId('role-wizard-next'))
    fireEvent.click(screen.getByTestId('role-wizard-next'))
    await act(async () => {
      fireEvent.click(screen.getByTestId('role-wizard-create'))
    })
    expect(screen.getByTestId('role-wizard').dataset.step).toBe('who')
    expect(screen.getByTestId('role-field-error').textContent?.replace(/\u00a0/g, ' ')).toBe(
      'Un autre rôle porte déjà ce nom à cet endroit.'
    )
    expect(onCreated).not.toHaveBeenCalled()
  })

  it('lecture seule avec un agent qui écrit sans demander : « seulement demandée » est dit', async () => {
    renderWizard({
      prefill: { label: 'Relecteur', description: 'Relit.', prompt: 'Relis.', readOnly: true }
    })
    await act(async () => {})
    fireEvent.click(screen.getByTestId('role-wizard-next'))
    fireEvent.click(screen.getByTestId('role-wizard-next'))
    expect(screen.queryByTestId('role-read-only-requested')).toBeNull()
    fireEvent.change(screen.getByTestId('role-agent'), { target: { value: 'opencode' } })
    expect(screen.getByTestId('role-read-only-requested').textContent).toContain('OpenCode')
  })

  it('sans projet ouvert : « Ce projet » est grisé, pas de « Créer et essayer »', async () => {
    renderWizard({
      conversationId: undefined,
      project: undefined,
      canTry: false,
      prefill: { label: 'Doc', description: 'Écrit la doc.', prompt: 'Écris.' }
    })
    await act(async () => {})
    fireEvent.click(screen.getByTestId('role-wizard-next'))
    fireEvent.click(screen.getByTestId('role-wizard-next'))
    expect((screen.getByTestId('role-scope-project') as HTMLInputElement).disabled).toBe(true)
    expect(screen.queryByTestId('role-wizard-create-try')).toBeNull()
  })

  it('Échap après une saisie demande avant d’abandonner', async () => {
    const { onClose } = renderWizard()
    await act(async () => {})
    type('role-label', 'Quelqu’un')
    fireEvent.keyDown(screen.getByTestId('role-label'), { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('role-wizard-discard'))
    expect(onClose).toHaveBeenCalled()
  })

  it('consigne écrite à la main : choisir un modèle demande avant de la remplacer', async () => {
    renderWizard({ prefill: { label: 'Mon rôle', description: 'Fait des choses.' } })
    await act(async () => {})
    fireEvent.click(screen.getByTestId('role-wizard-next'))
    type('role-prompt', 'Ma consigne à moi.')
    fireEvent.click(screen.getByTestId('role-template-security-expert'))
    expect(screen.getByTestId('role-replace')).toBeTruthy()
    expect((screen.getByTestId('role-prompt') as HTMLTextAreaElement).value).toBe(
      'Ma consigne à moi.'
    )
    fireEvent.click(screen.getByTestId('role-replace-confirm'))
    expect((screen.getByTestId('role-prompt') as HTMLTextAreaElement).value).toBe(security.prompt)
  })
})
