import { describe, expect, it } from 'vitest'
import { findInAxTree, formatAxTree, type AXNode } from './ax-tree'

/** Petit arbre comme Chromium le renvoie : racine, conteneurs génériques, texte, contrôles. */
const n = (
  nodeId: string,
  role: string,
  name: string,
  childIds: string[] = [],
  extra: Partial<AXNode> = {}
): AXNode => ({
  nodeId,
  ignored: false,
  role: { value: role },
  name: { value: name },
  childIds,
  backendDOMNodeId: Number(nodeId) + 100,
  ...extra
})

const TREE: AXNode[] = [
  n('1', 'RootWebArea', 'Page d’essai', ['2', '3', '9']),
  n('2', 'heading', 'Bonjour', ['20'], {
    properties: [{ name: 'level', value: { value: 1 } }]
  }),
  n('20', 'StaticText', 'Bonjour'),
  n('3', 'generic', '', ['4', '5', '6', '7']),
  n('4', 'textbox', 'Nom', [], { value: { value: 'Ada' } }),
  n('5', 'button', 'Valider', ['50']),
  n('50', 'StaticText', 'Valider'),
  n('6', 'checkbox', 'Se souvenir', [], {
    properties: [
      { name: 'checked', value: { value: 'true' } },
      { name: 'disabled', value: { value: true } }
    ]
  }),
  n('7', 'link', 'Aide', [], { properties: [{ name: 'url', value: { value: 'http://x/aide' } }] }),
  n('9', 'paragraph', '', ['90']),
  n('90', 'StaticText', 'Texte libre'),
  { ...n('99', 'button', 'Caché'), ignored: true }
]
for (const node of TREE)
  for (const child of node.childIds ?? []) {
    const c = TREE.find((x) => x.nodeId === child)
    if (c) c.parentId = node.nodeId
  }

const refs = (id: number) => `ref_${id}`

describe('arbre d’accessibilité pour l’agent', () => {
  it('interactif : contrôles seulement, états utiles, conteneurs génériques effacés', () => {
    const { lines, truncated } = formatAxTree(TREE, 'interactive', 10_000, refs)
    expect(truncated).toBe(false)
    expect(lines).toEqual([
      '- textbox "Nom" valeur="Ada" [ref_104]',
      '- button "Valider" [ref_105]',
      '- checkbox "Se souvenir" (coché) (désactivé) [ref_106]',
      '- link "Aide" → http://x/aide [ref_107]'
    ])
  })

  it('tout : titres et textes, sans répéter le texte d’un bouton', () => {
    const { lines } = formatAxTree(TREE, 'all', 10_000, refs)
    expect(lines).toContain('- heading "Bonjour" (niveau 1) [ref_102]')
    expect(lines).toContain('- paragraph [ref_109]')
    expect(lines).toContain('  - text "Texte libre"')
    expect(lines.filter((l) => l.includes('Valider'))).toHaveLength(1)
    expect(lines.some((l) => l.includes('Caché'))).toBe(false)
  })

  it('tronqué au-delà de la taille demandée', () => {
    const { lines, truncated } = formatAxTree(TREE, 'interactive', 60, refs)
    expect(truncated).toBe(true)
    expect(lines).toHaveLength(1)
  })

  it('recherche par rôle, nom ou valeur', () => {
    expect(findInAxTree(TREE, 'valider', refs)).toEqual(['- button "Valider" [ref_105]'])
    expect(findInAxTree(TREE, 'ada', refs)).toEqual(['- textbox "Nom" valeur="Ada" [ref_104]'])
    expect(findInAxTree(TREE, 'caché', refs)).toEqual([])
  })
})
