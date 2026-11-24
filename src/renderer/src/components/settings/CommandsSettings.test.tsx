import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { UserCommand } from '@shared/user-commands'
import { CommandsSettings } from './CommandsSettings'

/**
 * Réglages › Commandes (fiche 045) : remplace les vérifications de composant de l'e2e
 * `user-commands` (n° 1, 3). La lecture des fichiers `.bobine/commands/*.md` et l'écriture des
 * commandes personnelles sont dans `user-commands.test.ts` (main).
 */

const review: UserCommand = {
  name: 'revue',
  description: 'Relire le diff',
  hint: '<fichier>',
  prompt: 'Relis $ARGUMENTS',
  scope: 'project',
  file: '/projets/demo/.bobine/commands/revue.md'
}

const show = (commands: UserCommand[] = [], onChange = vi.fn()) => {
  render(
    <CommandsSettings
      commands={commands}
      projectCommands={[review]}
      workspace="/projets/demo"
      onChange={onChange}
    />
  )
  return onChange
}

describe('Réglages › Commandes (fiche 045)', () => {
  it('commande du projet listée, en lecture seule, son fichier en infobulle', () => {
    show()
    const row = screen.getByTestId('project-command')
    expect(row.dataset['name']).toBe('revue')
    expect(row.textContent).toContain('/revue')
    expect(row.textContent).toContain('Projet')
    expect(row.querySelector(`[title="${review.file}"]`)).toBeTruthy()
    expect(row.querySelector('button')).toBeNull()
  })

  it('commande personnelle « /salut » créée par le formulaire, puis enregistrée', () => {
    const onChange = show()
    fireEvent.click(screen.getByTestId('command-add'))
    const save = screen.getByTestId('command-save') as HTMLButtonElement
    fireEvent.change(screen.getByTestId('command-name'), { target: { value: 'Salut' } })
    expect(save.disabled).toBe(true)
    fireEvent.change(screen.getByTestId('command-description'), {
      target: { value: 'Dire bonjour' }
    })
    fireEvent.change(screen.getByTestId('command-prompt'), {
      target: { value: 'Dis bonjour à $ARGUMENTS' }
    })
    expect(save.disabled).toBe(false)
    fireEvent.submit(screen.getByTestId('command-form'))
    expect(onChange).toHaveBeenCalledWith([
      {
        name: 'salut',
        description: 'Dire bonjour',
        prompt: 'Dis bonjour à $ARGUMENTS',
        scope: 'global'
      }
    ])
    expect(screen.queryByTestId('command-form')).toBeNull()
  })

  it('nom déjà pris : refusé tant qu’il ne change pas', () => {
    const salut: UserCommand = {
      name: 'salut',
      description: '',
      prompt: 'Bonjour',
      scope: 'global'
    }
    show([salut])
    fireEvent.click(screen.getByTestId('command-add'))
    fireEvent.change(screen.getByTestId('command-name'), { target: { value: 'salut' } })
    fireEvent.change(screen.getByTestId('command-prompt'), { target: { value: 'Autre' } })
    expect((screen.getByTestId('command-save') as HTMLButtonElement).disabled).toBe(true)
  })
})
