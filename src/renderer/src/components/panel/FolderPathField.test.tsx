import * as Tooltip from '@radix-ui/react-tooltip'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AddFolderResult } from '@shared/extra-folders'
import { FILE_DRAG_TYPE } from '../../useFileDrop'
import {
  ADDED_NOTE_MS,
  FolderPathField,
  severalLines,
  shownPath,
  type FolderPathFieldProps
} from './FolderPathField'

const props = (over: Partial<FolderPathFieldProps> = {}): FolderPathFieldProps => ({
  add: vi.fn(async (): Promise<AddFolderResult | null> => ({ ok: true, folder: '/projets/lib' })),
  pathFor: (file) => `/glisse/${file.name}`,
  onAdded: vi.fn(),
  onError: vi.fn(),
  ...over
})
const show = (p: FolderPathFieldProps) => {
  const view = render(
    <Tooltip.Provider>
      <FolderPathField {...p} />
    </Tooltip.Provider>
  )
  const rerender = (next: FolderPathFieldProps) =>
    view.rerender(
      <Tooltip.Provider>
        <FolderPathField {...next} />
      </Tooltip.Provider>
    )
  return { rerender }
}
const field = () => screen.getByTestId('session-folder-path') as HTMLInputElement
const note = () => screen.getByTestId('session-folder-note')
const type = (text: string) => fireEvent.change(field(), { target: { value: text } })
const settle = () => act(async () => {})

/** Un glisser : types annoncés, fichiers déposés. */
function drag(types: string[], files: File[] = []) {
  return {
    dataTransfer: { types, files, dropEffect: 'none', getData: () => '' }
  }
}
const folder = (name: string) => new File([], name)

afterEach(() => vi.useRealTimers())

describe('champ « Autres dossiers » : chemin saisi (fiche 290)', () => {
  it('vide : pas de ligne d’aide, pas de bouton ↵ ; Entrée ne fait rien', () => {
    const p = props()
    show(p)
    expect(note().textContent).toBe('')
    expect(screen.queryByTestId('session-folder-submit')).toBeNull()
    fireEvent.keyDown(field(), { key: 'Enter' })
    type('   ')
    fireEvent.keyDown(field(), { key: 'Enter' })
    expect(p.add).not.toHaveBeenCalled()
    expect(field().getAttribute('aria-label')).toBe('Chemin d’un autre dossier')
  })

  it('Entrée : le chemin part au main tel quel ; ajouté : champ vidé, une ligne, le dossier signalé', async () => {
    vi.useFakeTimers()
    const p = props()
    show(p)
    type('~/Dev/lib')
    expect(screen.getByTestId('session-folder-submit').getAttribute('aria-label')).toBe(
      'Ajouter ce dossier'
    )
    fireEvent.keyDown(field(), { key: 'Enter' })
    await settle()
    expect(p.add).toHaveBeenCalledWith('~/Dev/lib')
    expect(field().value).toBe('')
    expect(note().textContent).toBe('Ajouté.')
    expect(note().getAttribute('role')).toBe('status')
    expect(p.onAdded).toHaveBeenCalledWith('/projets/lib')
    act(() => vi.advanceTimersByTime(ADDED_NOTE_MS))
    expect(note().textContent).toBe('')
  })

  it('la ligne « Ajouté » s’efface à la frappe suivante', async () => {
    show(props())
    type('/a')
    fireEvent.keyDown(field(), { key: 'Enter' })
    await settle()
    expect(note().textContent).toBe('Ajouté.')
    type('/b')
    expect(note().textContent).toBe('')
  })

  it('refus : la raison sous le champ, reliée et annoncée, le texte gardé ; effacée à la frappe', async () => {
    const p = props({
      add: vi.fn(async () => ({
        ok: false as const,
        reason: 'notFound' as const,
        folder: '/Users/moi/Dev/serveur-apu'
      }))
    })
    show(p)
    type('~/Dev/serveur-apu')
    fireEvent.click(screen.getByTestId('session-folder-submit'))
    await settle()
    expect(field().value).toBe('~/Dev/serveur-apu')
    expect(note().textContent).toContain('/Users/moi/Dev/serveur-apu')
    expect(note().dataset['reason']).toBe('notFound')
    expect(field().getAttribute('aria-invalid')).toBe('true')
    expect(field().getAttribute('aria-describedby')).toBe(note().id)
    type('~/Dev/serveur-api')
    expect(note().textContent).toBe('')
    expect(field().getAttribute('aria-invalid')).toBeNull()
  })

  it('fenêtre du système : sans chemin ; annulée, rien ; refusée, la raison au même endroit', async () => {
    const add = vi
      .fn<FolderPathFieldProps['add']>()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ok: false, reason: 'tooBroad', folder: '/Users/moi' })
    show(props({ add }))
    const choose = screen.getByTestId('session-add-folder')
    expect(choose.getAttribute('aria-label')).toBe('Choisir un dossier…')
    fireEvent.click(choose)
    await settle()
    expect(add).toHaveBeenLastCalledWith(undefined)
    expect(note().textContent).toBe('')
    fireEvent.click(choose)
    await settle()
    expect(note().dataset['reason']).toBe('tooBroad')
    // Le champ, lui, n'est pas en cause.
    expect(field().getAttribute('aria-invalid')).toBeNull()
  })

  it('Échap : vide le champ s’il a du texte ; vide, l’évènement passe', () => {
    show(props())
    type('/a/b')
    expect(fireEvent.keyDown(field(), { key: 'Escape' })).toBe(false)
    expect(field().value).toBe('')
    expect(fireEvent.keyDown(field(), { key: 'Escape' })).toBe(true)
  })

  it('erreur inattendue : remise à `onError`, rien d’affiché sous le champ', async () => {
    const p = props({ add: vi.fn(async () => Promise.reject(new Error('Conversation inconnue'))) })
    show(p)
    type('/a')
    fireEvent.keyDown(field(), { key: 'Enter' })
    await settle()
    expect(p.onError).toHaveBeenCalled()
    expect(note().textContent).toBe('')
  })
})

describe('champ « Autres dossiers » : pendant un tour, et pendant que la session repart', () => {
  const busy = 'L’agent répond : l’ajout et le retrait d’un dossier attendent la fin de son tour.'

  it('tour en cours : lecture seule, atteignable, la raison décrite ; rien ne part ; le texte reste', () => {
    const p = props()
    const view = show(p)
    type('/a/b')
    view.rerender({ ...p, blocked: busy })
    expect(field().readOnly).toBe(true)
    expect(field().getAttribute('aria-disabled')).toBe('true')
    expect(field().getAttribute('aria-description')).toBe(busy)
    expect(field().value).toBe('/a/b')
    fireEvent.keyDown(field(), { key: 'Enter' })
    fireEvent.click(screen.getByTestId('session-folder-submit'))
    fireEvent.click(screen.getByTestId('session-add-folder'))
    expect(p.add).not.toHaveBeenCalled()
    expect(screen.getByTestId('session-add-folder').getAttribute('aria-disabled')).toBe('true')
    // Aucune ligne de plus pendant un tour.
    expect(note().textContent).toBe('')
  })

  it('course clic / début de tour : le main répond `busy`, dit sous le champ', async () => {
    const p = props({ add: vi.fn(async () => ({ ok: false as const, reason: 'busy' as const })) })
    show(p)
    type('/a/b')
    fireEvent.keyDown(field(), { key: 'Enter' })
    await settle()
    expect(note().dataset['reason']).toBe('busy')
    expect(field().value).toBe('/a/b')
  })

  it('ajout en cours (session qui repart) : même traitement, un seul envoi', async () => {
    let finish: (r: AddFolderResult) => void = () => {}
    const add = vi.fn(
      () => new Promise<AddFolderResult | null>((done) => (finish = (r) => done(r)))
    )
    show(props({ add }))
    type('/a/b')
    fireEvent.keyDown(field(), { key: 'Enter' })
    expect(field().readOnly).toBe(true)
    expect(field().getAttribute('aria-description')).toContain('repart')
    fireEvent.keyDown(field(), { key: 'Enter' })
    expect(add).toHaveBeenCalledTimes(1)
    await act(async () => finish({ ok: true, folder: '/a/b' }))
    expect(field().readOnly).toBe(false)
  })
})

describe('champ « Autres dossiers » : dossier glissé', () => {
  const box = () => screen.getByTestId('session-folder-field')

  it('un dossier du système : zone de dépôt sur le champ, chemin envoyé au main', async () => {
    const p = props()
    show(p)
    const data = drag(['Files'], [folder('lib')])
    fireEvent.dragEnter(box(), data)
    expect(box().classList.contains('dropping')).toBe(true)
    expect(box().textContent).toContain('Déposer pour ajouter')
    fireEvent.dragOver(box(), data)
    expect(data.dataTransfer.dropEffect).toBe('copy')
    fireEvent.drop(box(), data)
    await settle()
    expect(box().classList.contains('dropping')).toBe(false)
    expect(p.add).toHaveBeenCalledWith('/glisse/lib')
    expect(note().textContent).toBe('Ajouté.')
  })

  it('sortie de la zone : l’indication disparaît, entrée dans un enfant comprise', () => {
    show(props())
    const data = drag(['Files'], [folder('lib')])
    fireEvent.dragEnter(box(), data)
    fireEvent.dragEnter(field(), data)
    fireEvent.dragLeave(box(), data)
    expect(box().classList.contains('dropping')).toBe(true)
    fireEvent.dragLeave(field(), data)
    expect(box().classList.contains('dropping')).toBe(false)
  })

  it('plusieurs éléments : « Un seul dossier à la fois », rien d’ajouté', () => {
    const p = props()
    show(p)
    fireEvent.drop(box(), drag(['Files'], [folder('a'), folder('b')]))
    expect(note().textContent).toContain('Un seul dossier à la fois')
    expect(p.add).not.toHaveBeenCalled()
  })

  it('ligne de l’onglet Fichiers, texte, adresse : ignorés, pas de zone de dépôt ni de texte inséré', () => {
    const p = props()
    show(p)
    for (const types of [
      [FILE_DRAG_TYPE, 'Files'],
      ['text/plain'],
      ['text/uri-list', 'text/plain']
    ]) {
      const data = drag(types, types.includes('Files') ? [folder('x')] : [])
      fireEvent.dragEnter(box(), data)
      expect(box().classList.contains('dropping')).toBe(false)
      // `dragover` refusé : le navigateur ne dépose rien, pas même du texte dans le champ.
      expect(fireEvent.dragOver(box(), data)).toBe(false)
      expect(data.dataTransfer.dropEffect).toBe('none')
      fireEvent.drop(box(), data)
    }
    expect(p.add).not.toHaveBeenCalled()
    expect(field().value).toBe('')
  })

  it('pendant un tour : zone de dépôt désactivée, rien d’ajouté', () => {
    const p = props({ blocked: 'L’agent répond.' })
    show(p)
    const data = drag(['Files'], [folder('lib')])
    fireEvent.dragEnter(box(), data)
    expect(box().classList.contains('dropping')).toBe(false)
    fireEvent.dragOver(box(), data)
    expect(data.dataTransfer.dropEffect).toBe('none')
    fireEvent.drop(box(), data)
    expect(p.add).not.toHaveBeenCalled()
  })

  it('élément sans chemin (pas un fichier du disque) : ignoré', () => {
    const p = props({ pathFor: () => '' })
    show(p)
    fireEvent.drop(box(), drag(['Files'], [folder('x')]))
    expect(p.add).not.toHaveBeenCalled()
  })
})

describe('champ « Autres dossiers » : retours du testeur (fiche 290)', () => {
  it('collage de plusieurs lignes : « Un seul dossier à la fois », rien n’est envoyé (M1)', () => {
    const p = props()
    show(p)
    const several = fireEvent.paste(field(), {
      clipboardData: { getData: () => '/a/b\n/c/d' }
    })
    expect(several).toBe(false)
    expect(note().textContent).toContain('Un seul dossier à la fois')
    expect(p.add).not.toHaveBeenCalled()
    // Une seule ligne (retour final compris) : collage ordinaire.
    expect(fireEvent.paste(field(), { clipboardData: { getData: () => '/a/b\n' } })).toBe(true)
    expect(severalLines('/a\r\n/b')).toBe(true)
    expect(severalLines('/a\u2028/b')).toBe(true)
    expect(severalLines('  /a  \n\n')).toBe(false)
  })

  it('« Ajouté » s’efface dès qu’un tour commence', async () => {
    const p = props()
    const view = show(p)
    type('/a')
    fireEvent.keyDown(field(), { key: 'Enter' })
    await settle()
    expect(note().textContent).toBe('Ajouté.')
    view.rerender({ ...p, blocked: 'L’agent répond.', turn: true })
    expect(note().textContent).toBe('')
  })

  it('chemin long dans un refus : `~`, ellipse au milieu, entier dans l’infobulle', async () => {
    const long = '/Users/moi/Dev/un/chemin/vraiment/tres/long/pour/le/panneau/notes.txt'
    expect(shownPath(long, '/Users/moi')).toBe('~/Dev/un/chemin…our/le/panneau/notes.txt')
    expect(shownPath(long, '/Users/moi').length).toBe(40)
    expect(shownPath('/Users/moi/Dev/lib', '/Users/moi')).toBe('~/Dev/lib')
    expect(shownPath('/opt/lib', undefined)).toBe('/opt/lib')
    const p = props({
      add: vi.fn(async () => ({
        ok: false as const,
        reason: 'notDirectory' as const,
        folder: long
      }))
    })
    show(p)
    type(long)
    fireEvent.keyDown(field(), { key: 'Enter' })
    await settle()
    expect(note().textContent).not.toContain(long)
    expect(note().textContent).toContain('…')
  })
})
