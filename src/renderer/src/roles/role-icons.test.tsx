import { Bot, ShieldCheck } from 'lucide-react'
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { RoleAvatar } from '../components/roles/RoleAvatar'
import { roleIcon } from './role-icons'

describe('icône d’un rôle (fiche 223)', () => {
  it('nom connu : son icône ; nom inconnu ou hérité d’Object : l’icône par défaut', () => {
    expect(roleIcon('shield-check')).toBe(ShieldCheck)
    for (const name of ['inconnue', 'constructor', 'toString', '__proto__', 'hasOwnProperty']) {
      expect(roleIcon(name)).toBe(Bot)
    }
  })

  it('un avatar `icon: constructor` s’affiche (pas d’écran blanc)', () => {
    const { getByTestId } = render(<RoleAvatar role={{ icon: 'constructor', color: 'blue' }} />)
    expect(getByTestId('role-avatar').querySelector('svg')).toBeTruthy()
  })
})
