import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { focusFallback, installFocusKeeper } from './focus-keeper'

/** Fenêtre de l'essai : la zone de saisie, et une carte avec deux boutons. */
function page() {
  document.body.innerHTML = `
    <textarea data-testid="composer-input"></textarea>
    <div class="card"><button id="allow">Autoriser une fois</button><button id="deny">Refuser</button></div>
    <p id="thread">Fil</p>`
  const $ = (selector: string) => document.querySelector<HTMLElement>(selector) as HTMLElement
  return { $, composer: $('[data-testid=composer-input]') }
}

/** Ce que fait Chromium quand l'élément qui a le focus part : le focus tombe sur la page. */
async function settle() {
  await Promise.resolve()
  vi.advanceTimersByTime(100)
}

let uninstall = () => {}
beforeEach(() => {
  vi.useFakeTimers()
  uninstall = installFocusKeeper()
})
afterEach(() => {
  uninstall()
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('focus jamais perdu sur la page (seconde chasse rc.4)', () => {
  it('bouton d’une carte qui disparaît (« Autoriser une fois ») : la zone de saisie', async () => {
    const { $, composer } = page()
    $('#allow').focus()
    $('.card').remove()
    // jsdom, comme Chromium : rien ne dit le départ, le focus est sur la page.
    expect(document.activeElement).toBe(document.body)
    await settle()
    expect(document.activeElement).toBe(composer)
  })

  it('bouton qui se désactive (« Vérifier maintenant ») hors fenêtre : la zone de saisie', async () => {
    const { $, composer } = page()
    $('#allow').focus()
    $('#allow').setAttribute('disabled', '')
    $('#allow').blur()
    await settle()
    expect(document.activeElement).toBe(composer)
  })

  it('dans une fenêtre ouverte : l’élément suivant de la fenêtre, pas la zone de saisie', async () => {
    const { composer } = page()
    document.body.insertAdjacentHTML(
      'beforeend',
      `<div role="dialog" data-state="open"><button id="close">✕</button>
        <button id="check">Vérifier maintenant</button><a id="news" href="#n">Nouveautés</a></div>`
    )
    const check = document.getElementById('check') as HTMLButtonElement
    check.focus()
    check.disabled = true
    check.blur()
    await settle()
    expect(document.activeElement?.id).toBe('news')
    expect(document.activeElement).not.toBe(composer)
  })

  it('fenêtre fermée (Échap, ✕) dont le bouton d’ouverture est parti : la zone de saisie', async () => {
    const { composer } = page()
    document.body.insertAdjacentHTML(
      'beforeend',
      `<div role="dialog" data-state="open" id="settings"><button id="close">✕</button></div>`
    )
    ;(document.getElementById('close') as HTMLElement).focus()
    document.getElementById('settings')?.remove()
    await settle()
    expect(document.activeElement).toBe(composer)
  })

  it('clic dans le vide : le focus reste où l’utilisateur l’a mis, même si le bouton part ensuite', async () => {
    const { $ } = page()
    $('#allow').focus()
    // Clic dans le fil (rien de focalisable) : le bouton reste, le focus va sur la page.
    $('#allow').blur()
    await settle()
    expect(document.activeElement).toBe(document.body)
    $('.card').remove()
    await settle()
    expect(document.activeElement).toBe(document.body)
  })

  it('quelqu’un pose le focus ailleurs avant la vérification : il a raison', async () => {
    const { $ } = page()
    $('#allow').focus()
    $('.card').remove()
    $('#thread').setAttribute('tabindex', '-1')
    $('#thread').focus()
    await settle()
    expect(document.activeElement).toBe($('#thread'))
  })

  it('sans zone de saisie ni fenêtre : nulle part', () => {
    document.body.innerHTML = '<button id="b">x</button>'
    const button = document.getElementById('b') as HTMLElement
    button.remove()
    expect(focusFallback(button)).toBeNull()
  })
})
