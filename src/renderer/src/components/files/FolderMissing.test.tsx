import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FolderMissing } from './FilesParts'

describe('dossier de la conversation disparu (C10, Q19)', () => {
  it('le dit en clair, et propose d’en choisir un', () => {
    const onChoose = vi.fn()
    render(<FolderMissing onChoose={onChoose} />)
    expect(screen.getByTestId('files-folder-missing').textContent).toContain(
      'Ce dossier n’existe plus.'
    )
    expect(screen.getByTestId('files-choose-folder').textContent).toBe('Choisir un dossier…')
    fireEvent.click(screen.getByTestId('files-choose-folder'))
    expect(onChoose).toHaveBeenCalled()
  })
})
