import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Question } from '@shared/questions'
import { QuestionCard } from './QuestionCard'

const couleur: Question = {
  key: 'couleur',
  header: 'Couleur',
  text: 'Quelle couleur ?',
  multi: false,
  options: [
    { value: 'rouge', label: 'Rouge', description: 'Chaud' },
    { value: 'bleu', label: 'Bleu' }
  ],
  customKey: 'couleur_custom',
  required: true
}

const garnitures: Question = {
  key: 'garnitures',
  text: 'Quelles garnitures ?',
  multi: true,
  options: [
    { value: 'olives', label: 'Olives' },
    { value: 'champignons', label: 'Champignons' }
  ]
}

function setup(questions: Question[]) {
  const onSubmit = vi.fn()
  const onSkip = vi.fn()
  render(
    <QuestionCard message="Question" questions={questions} onSubmit={onSubmit} onSkip={onSkip} />
  )
  return { onSubmit, onSkip }
}

describe('QuestionCard', () => {
  it('choix unique : un clic répond et envoie ; la carte a le focus clavier', () => {
    const { onSubmit } = setup([couleur])
    expect(document.activeElement).toBe(screen.getByTestId('questions'))
    expect(screen.getByTestId('question-text').textContent).toBe('Quelle couleur ?')
    fireEvent.click(screen.getByText('Bleu'))
    expect(onSubmit).toHaveBeenCalledWith({ couleur: 'bleu' })
  })

  it('clavier : le chiffre de l’option choisit, ↓ puis Entrée aussi', () => {
    const first = setup([couleur])
    fireEvent.keyDown(screen.getByTestId('questions'), { key: '1' })
    expect(first.onSubmit).toHaveBeenCalledWith({ couleur: 'rouge' })
    cleanupAnd(() => {
      const second = setup([couleur])
      const card = screen.getByTestId('questions')
      fireEvent.keyDown(card, { key: 'ArrowDown' })
      fireEvent.keyDown(card, { key: 'Enter' })
      expect(second.onSubmit).toHaveBeenCalledWith({ couleur: 'bleu' })
    })
  })

  it('« Autre » : le texte libre remplace l’option', () => {
    const { onSubmit } = setup([couleur])
    const other = screen.getByTestId('choice-other')
    fireEvent.change(other, { target: { value: 'vert' } })
    fireEvent.keyDown(other, { key: 'Enter' })
    expect(onSubmit).toHaveBeenCalledWith({ couleur_custom: 'vert' })
  })

  it('choix multiple : cocher plusieurs options puis « Envoyer » ; « Passer » saute', () => {
    const { onSubmit, onSkip } = setup([garnitures])
    fireEvent.click(screen.getByText('Olives'))
    fireEvent.click(screen.getByText('Champignons'))
    expect(onSubmit).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('questions-next'))
    expect(onSubmit).toHaveBeenCalledWith({ garnitures: ['olives', 'champignons'] })
    fireEvent.click(screen.getByTestId('questions-skip'))
    expect(onSkip).toHaveBeenCalledTimes(1)
  })

  it('question obligatoire sans réponse : « Envoyer » reste inactif', () => {
    setup([couleur])
    expect((screen.getByTestId('questions-next') as HTMLButtonElement).disabled).toBe(true)
  })

  it('plusieurs questions : onglets, passage à la suivante, envoi groupé', () => {
    const { onSubmit } = setup([couleur, garnitures])
    expect(screen.getAllByRole('tab')).toHaveLength(2)
    fireEvent.click(screen.getByText('Rouge'))
    expect(screen.getByTestId('question-text').textContent).toBe('Quelles garnitures ?')
    fireEvent.click(screen.getByText('Olives'))
    fireEvent.click(screen.getByTestId('questions-next'))
    expect(onSubmit).toHaveBeenCalledWith({ couleur: 'rouge', garnitures: ['olives'] })
  })
})

/** Second rendu dans le même test : on nettoie le premier (Testing Library ne le fait qu'entre tests). */
function cleanupAnd(run: () => void): void {
  document.body.innerHTML = ''
  run()
}
