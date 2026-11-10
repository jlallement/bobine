/**
 * Ce que l'app montre d'une commande git qui échoue (fiche 123) : les lignes `error:` et `fatal:`
 * en entier, avec ce qui les suit (fichiers en cause, « Please commit your changes… »), sans les
 * conseils `hint:` ni le « Aborting » final, qui ne dit rien à lui seul.
 */

const NOISE = /^(hint:|Aborting\.?$)/

/** Message d'erreur tiré de la sortie d'erreur de git ; vide si elle ne dit rien d'utile. */
export function gitError(stderr: string): string {
  const lines = stderr
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() && !NOISE.test(line.trim()))
  const first = lines.findIndex((line) => /^(error|fatal):/.test(line))
  if (first === -1) return lines.at(-1)?.trim() ?? ''
  // Fichiers listés par git sous l'erreur (tabulation) : indentés de deux espaces.
  return lines
    .slice(first)
    .filter((line) => !/^warning:/.test(line))
    .map((line) => line.replace(/^\t+/, '  '))
    .join('\n')
}

/** Sur une ligne, pour le journal des commandes (`agents.log`). */
export const gitErrorLine = (stderr: string): string =>
  gitError(stderr)
    .split('\n')
    .map((line) => line.trim())
    .join(' ⏎ ')
