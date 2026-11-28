/**
 * État JSON partagé entre un essai et une fausse commande (fiche 293) : lecture et écriture qui
 * supportent l'autre côté au travail, sous Windows aussi (un `rename` sur un fichier ouvert y rend
 * `EPERM`, `EBUSY` ou `EACCES` un instant). Réessais espacés, bornés : jamais de boucle à vide.
 */
import { readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'

const RETRIES = 100
const PAUSE_MS = 20
const BUSY = new Set(['EPERM', 'EBUSY', 'EACCES'])

/** Pause synchrone (un processus de fausse commande n'a rien d'autre à faire). */
const pause = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)

/** Lecture d'un fichier JSON en cours de remplacement : relu un peu plus tard (≈ 2 s au plus). */
export function readJson(file) {
  for (let i = 0; ; i++) {
    try {
      return JSON.parse(readFileSync(file, 'utf8'))
    } catch (error) {
      if (i >= RETRIES) throw error
      pause(PAUSE_MS)
    }
  }
}

/** Écriture atomique (fichier voisin, puis renommage), réessayée si le fichier est occupé. */
export function writeJson(file, data) {
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`
  writeFileSync(temp, JSON.stringify(data, null, 2))
  for (let i = 0; ; i++) {
    try {
      renameSync(temp, file)
      return
    } catch (error) {
      if (i >= RETRIES || !BUSY.has(error.code)) {
        rmSync(temp, { force: true })
        throw error
      }
      pause(PAUSE_MS)
    }
  }
}
