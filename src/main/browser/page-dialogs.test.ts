import { describe, expect, it } from 'vitest'
import { DialogWatch, PageDialogOpen, dialogAnswerText, dialogOpenText } from './page-dialogs'

/** Commande qui ne répond qu'à la demande, comme une page bloquée par sa boîte. */
function pending<T>() {
  let resolve: (value: T) => void = () => {}
  const promise = new Promise<T>((r) => (resolve = r))
  return { promise, resolve }
}

describe('boîtes JavaScript d’une page (fiche 097, essai réel)', () => {
  it('une commande en attente rend la main dès qu’une boîte s’ouvre', async () => {
    const watch = new DialogWatch()
    const changes: unknown[] = []
    watch.onChange = (dialog) => changes.push(dialog?.type)
    const command = pending<string>()
    const sent = watch.guard(() => command.promise)
    watch.opened({ type: 'confirm', message: 'Supprimer « Dune » ?' })
    await expect(sent).rejects.toBeInstanceOf(PageDialogOpen)
    // Tant qu'elle est ouverte, les commandes suivantes échouent tout de suite.
    await expect(watch.guard(() => Promise.resolve('page'))).rejects.toThrow(
      'The page is showing a confirm dialog: "Supprimer « Dune » ?"'
    )
    watch.closed({ result: true, userInput: '' })
    await expect(watch.guard(() => Promise.resolve('page'))).resolves.toBe('page')
    expect(changes).toEqual(['confirm', undefined])
    expect(watch.takeAnswers()).toEqual([
      { type: 'confirm', message: 'Supprimer « Dune » ?', accepted: true }
    ])
    expect(watch.takeAnswers()).toEqual([])
  })

  it('une action qui ouvre une boîte a eu lieu ; une boîte déjà ouverte l’empêche', async () => {
    const watch = new DialogWatch()
    const click = pending<string>()
    const done = watch.through(() => watch.guard(() => click.promise), 'cliqué')
    watch.opened({ type: 'alert', message: 'Exporté' })
    await expect(done).resolves.toBe('cliqué')
    await expect(watch.through(() => watch.guard(async () => 'x'), 'cliqué')).rejects.toThrow(
      PageDialogOpen
    )
  })

  it('textes pour l’agent : la boîte ouverte, puis la réponse de l’utilisateur', () => {
    expect(dialogOpenText({ type: 'confirm', message: 'Supprimer ?' })).toContain(
      'you cannot answer it yourself'
    )
    expect(dialogAnswerText({ type: 'confirm', message: 'Supprimer ?', accepted: false })).toBe(
      'Note: the user answered the page\'s confirm dialog "Supprimer ?": Cancel.'
    )
    expect(
      dialogAnswerText({ type: 'prompt', message: 'Nom ?', accepted: true, input: 'Ada' })
    ).toBe('Note: the user answered the page\'s prompt dialog "Nom ?": OK, with "Ada".')
  })
})
