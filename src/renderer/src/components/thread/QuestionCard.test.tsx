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
      // Rien en surbrillance à l'ouverture : ↓ mène à la première option, ↓ encore à la deuxième.
      fireEvent.keyDown(card, { key: 'ArrowDown' })
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

  it('carte « Site web » (fiche 254, D2) : rien ne paraît choisi, « Envoyer » inactif, aucune réponse vide', () => {
    // Comme la carte d'accord par site : choix unique, question facultative, sans « Autre ».
    const site: Question = {
      key: 'answer',
      header: 'Site web',
      text: 'L’agent veut ouvrir example.com. L’autoriser ?',
      multi: false,
      options: [
        { value: 'Autoriser', label: 'Autoriser' },
        { value: 'Toujours autoriser', label: 'Toujours autoriser' },
        { value: 'Refuser', label: 'Refuser' }
      ]
    }
    const { onSubmit } = setup([site])
    const choices = screen.getAllByTestId('choice')
    expect(choices.map((c) => c.getAttribute('aria-checked'))).toEqual(['false', 'false', 'false'])
    expect(choices.filter((c) => /\b(focused|selected)\b/.test(c.className))).toEqual([])
    const send = screen.getByTestId('questions-next') as HTMLButtonElement
    expect(send.disabled).toBe(true)
    fireEvent.click(send)
    // Entrée ou espace sans option en surbrillance : rien non plus.
    fireEvent.keyDown(screen.getByTestId('questions'), { key: 'Enter' })
    fireEvent.keyDown(screen.getByTestId('questions'), { key: ' ' })
    expect(onSubmit).not.toHaveBeenCalled()
    // Une option survolée se distingue, sans paraître choisie ; un clic l'envoie.
    fireEvent.mouseEnter(choices[0] as HTMLElement)
    expect(choices[0]?.className).toContain('focused')
    expect(choices[0]?.getAttribute('aria-checked')).toBe('false')
    fireEvent.click(choices[0] as HTMLElement)
    expect(onSubmit).toHaveBeenCalledWith({ answer: 'Autoriser' })
  })

  it('choix multiple facultatif : « Envoyer » inactif tant que rien n’est coché, Entrée aussi', () => {
    const { onSubmit } = setup([garnitures])
    const send = screen.getByTestId('questions-next') as HTMLButtonElement
    expect(send.disabled).toBe(true)
    fireEvent.keyDown(screen.getByTestId('questions'), { key: 'Enter' })
    expect(onSubmit).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('Olives'))
    expect(send.disabled).toBe(false)
    fireEvent.click(screen.getByText('Olives'))
    expect(send.disabled).toBe(true)
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
