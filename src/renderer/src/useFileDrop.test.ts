import { act, renderHook } from '@testing-library/react'
import type { DragEvent } from 'react'
import { describe, expect, it, vi } from 'vitest'
import {
  ComposerInbox,
  endTreeDrag,
  FILE_DRAG_TYPE,
  startTreeDrag,
  useFileDrop
} from './useFileDrop'

/** Un dépôt dont le `dataTransfer` porte `data` (type → valeur). */
function drop(data: Record<string, string>): DragEvent {
  return {
    preventDefault: () => {},
    stopPropagation: () => {},
    dataTransfer: {
      types: Object.keys(data),
      getData: (type: string) => data[type] ?? '',
      files: []
    }
  } as unknown as DragEvent
}

function setup() {
  const inbox = new ComposerInbox()
  const paths = vi.fn()
  inbox.subscribe({ files: () => {}, text: () => {}, paths })
  const { result } = renderHook(() => useFileDrop(inbox))
  return { result, paths }
}

describe('glisser une ligne de l’onglet Fichiers (C2)', () => {
  it('un dépôt au type falsifié (chemin quelconque) est ignoré', () => {
    const { result, paths } = setup()
    act(() => result.current.handlers.onDrop(drop({ [FILE_DRAG_TYPE]: '/Users/x/.ssh/id_rsa' })))
    expect(paths).not.toHaveBeenCalled()
  })

  it('le glisser parti de l’arbre joint son fichier, une fois ; terminé, il ne vaut plus', () => {
    const { result, paths } = setup()
    const token = startTreeDrag('/p/app/src/a.ts')
    act(() => result.current.handlers.onDrop(drop({ [FILE_DRAG_TYPE]: token })))
    expect(paths).toHaveBeenCalledWith(['/p/app/src/a.ts'])
    const again = startTreeDrag('/p/app/src/b.ts')
    endTreeDrag()
    act(() => result.current.handlers.onDrop(drop({ [FILE_DRAG_TYPE]: again })))
    expect(paths).toHaveBeenCalledTimes(1)
  })
})
