import { beforeEach, describe, expect, it } from 'vitest'
import {
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  SIDEBAR_WIDTH_KEY,
  clampSidebarWidth,
  fittedSidebarWidth,
  readSidebarWidth,
  writeSidebarWidth
} from './sidebar-width'

describe('largeur de la barre latérale (fiche 113)', () => {
  beforeEach(() => localStorage.removeItem(SIDEBAR_WIDTH_KEY))

  it('300 px par défaut, entre 220 et 440', () => {
    expect(readSidebarWidth()).toBe(SIDEBAR_DEFAULT_WIDTH)
    expect(clampSidebarWidth(100)).toBe(SIDEBAR_MIN_WIDTH)
    expect(clampSidebarWidth(900)).toBe(SIDEBAR_MAX_WIDTH)
    expect(clampSidebarWidth(333.6)).toBe(334)
  })

  it('cède à la conversation sur une fenêtre étroite, jamais sous 220 px', () => {
    expect(fittedSidebarWidth(300, 1280)).toBe(300)
    expect(fittedSidebarWidth(300, 760)).toBe(260)
    expect(fittedSidebarWidth(440, 800)).toBe(300)
    expect(fittedSidebarWidth(300, 600)).toBe(SIDEBAR_MIN_WIDTH)
  })

  it('retenue sur ce poste, ramenée dans les bornes à la relecture', () => {
    writeSidebarWidth(360)
    expect(localStorage.getItem(SIDEBAR_WIDTH_KEY)).toBe('360')
    expect(readSidebarWidth()).toBe(360)
    localStorage.setItem(SIDEBAR_WIDTH_KEY, '9999')
    expect(readSidebarWidth()).toBe(SIDEBAR_MAX_WIDTH)
    localStorage.setItem(SIDEBAR_WIDTH_KEY, 'large')
    expect(readSidebarWidth()).toBe(SIDEBAR_DEFAULT_WIDTH)
  })
})
