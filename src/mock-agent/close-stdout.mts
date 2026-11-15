/**
 * Ferme la sortie standard de l'agent factice sans le faire sortir (scénario « connexion coupée »,
 * fiche 195). Sous Unix, `process.stdout.end()` suffit. Sous Windows, le processus garde **deux**
 * handles du même tube : celui de `GetStdHandle` et un double pris par node (libuv) ; tant qu'un
 * des deux reste ouvert, le parent ne voit pas la fin du flux (relevé dans la VM, fiche 229,
 * lot 7a : avec les deux fermés, la fin arrive en ~300 ms, le processus vivant). Les handles du
 * processus qui désignent le même objet (`CompareObjectHandles`, Windows 10 et plus) sont fermés.
 */
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

/** Plus grande valeur de handle parcourue (multiples de 4). */
const MAX_HANDLE = 65_536

export function closeStdout(): void {
  process.stdout.end()
  if (process.platform !== 'win32') return
  const koffi = require('koffi') as typeof import('koffi')
  const kernel32 = koffi.load('kernel32.dll')
  const kernelbase = koffi.load('kernelbase.dll')
  const getStdHandle = kernel32.func('void* __stdcall GetStdHandle(int)')
  const closeHandle = kernel32.func('bool __stdcall CloseHandle(void*)')
  const sameObject = kernelbase.func('bool __stdcall CompareObjectHandles(void*, void*)')
  const stdout: unknown = getStdHandle(-11)
  const handle = (value: number): unknown => koffi.as(BigInt(value), 'void*')
  const same: number[] = []
  for (let value = 4; value < MAX_HANDLE; value += 4) {
    if (sameObject(handle(value), stdout) === true) same.push(value)
  }
  for (const value of same) closeHandle(handle(value))
}
