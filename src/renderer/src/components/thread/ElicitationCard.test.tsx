import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ElicitationSchema } from '../../../../shared/acp-sdk.mts'
import type { TranscriptItem } from '@shared/transcript'
import { ElicitationCard } from './ElicitationCard'

type Item = Extract<TranscriptItem, { kind: 'elicitation' }>

const form: ElicitationSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', title: 'Nom', minLength: 3 },
    age: { type: 'integer', title: 'Âge', minimum: 18 },
    newsletter: { type: 'boolean', title: 'Lettre d’information' }
  },
  required: ['name']
}

const pending = (prompt: Item['prompt']): Item => ({
  kind: 'elicitation',
  id: 1,
  requestId: 'r1',
  prompt,
  state: 'pending'
})

describe('ElicitationCard', () => {
  it('formulaire : champs requis et bornes vérifiés avant l’envoi, contenu propre envoyé', () => {
    const onRespond = vi.fn()
    render(
      <ElicitationCard
        item={pending({ mode: 'form', message: 'Vos informations', schema: form })}
        onRespond={onRespond}
      />
    )
    fireEvent.click(screen.getByTestId('elicitation-submit'))
    expect(screen.getByText('Champ requis')).not.toBeNull()
    expect(onRespond).not.toHaveBeenCalled()

    // Borne que le HTML ne connaît pas (`minLength` du schéma) : vérifiée par l'app.
    fireEvent.change(screen.getByLabelText(/Nom/), { target: { value: 'Lé' } })
    fireEvent.click(screen.getByTestId('elicitation-submit'))
    expect(screen.getByText('Au moins 3 caractères')).not.toBeNull()
    expect(screen.queryByText('Champ requis')).toBeNull()
    expect(onRespond).not.toHaveBeenCalled()

    // Borne reflétée en HTML (`min`) : le navigateur bloque l'envoi avant l'app.
    fireEvent.change(screen.getByLabelText(/Nom/), { target: { value: 'Léa' } })
    const age = screen.getByLabelText(/Âge/) as HTMLInputElement
    fireEvent.change(age, { target: { value: '17' } })
    fireEvent.click(screen.getByTestId('elicitation-submit'))
    expect(age.validity.rangeUnderflow).toBe(true)
    expect(onRespond).not.toHaveBeenCalled()

    fireEvent.change(age, { target: { value: '20' } })
    fireEvent.click(screen.getByTestId('elicitation-submit'))
    expect(onRespond).toHaveBeenCalledWith('r1', {
      action: 'accept',
      content: { name: 'Léa', age: 20 }
    })
  })

  it('formulaire refusé', () => {
    const onRespond = vi.fn()
    render(
      <ElicitationCard
        item={pending({ mode: 'form', message: 'Vos informations', schema: form })}
        onRespond={onRespond}
      />
    )
    fireEvent.click(screen.getByText('Refuser'))
    expect(onRespond).toHaveBeenCalledWith('r1', { action: 'decline' })
  })

  it('page à ouvrir : hôte affiché, accord ou refus', () => {
    const onRespond = vi.fn()
    render(
      <ElicitationCard
        item={pending({ mode: 'url', message: 'Connexion', url: 'https://auth.exemple.org/login' })}
        onRespond={onRespond}
      />
    )
    expect(screen.getByText('auth.exemple.org')).not.toBeNull()
    fireEvent.click(screen.getByTestId('elicitation-open'))
    expect(onRespond).toHaveBeenCalledWith('r1', { action: 'accept' })
  })

  it('formulaire fait de questions à choix : carte de questions', () => {
    const schema: ElicitationSchema = {
      type: 'object',
      properties: {
        framework: { type: 'string', title: 'Framework', enum: ['React', 'Vue'] }
      }
    }
    render(
      <ElicitationCard
        item={pending({ mode: 'form', message: 'Lequel ?', schema })}
        onRespond={vi.fn()}
      />
    )
    expect(screen.getByTestId('questions')).not.toBeNull()
    expect(screen.getAllByTestId('choice')).toHaveLength(2)
  })

  it('après la réponse : résumé dans le fil', () => {
    const answered: Item = {
      ...pending({ mode: 'form', message: 'Vos informations', schema: form }),
      state: 'accept',
      content: { name: 'Léa' }
    }
    render(<ElicitationCard item={answered} onRespond={vi.fn()} />)
    expect(screen.getByTestId('elicitation-answer').textContent).toContain('Informations envoyées')
  })
})
