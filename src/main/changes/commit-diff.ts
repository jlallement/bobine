/**
 * Diff des fichiers cochés, tel qu'il part chez l'agent qui rédige le message de commit (fiche 246,
 * ADR-0056) : borné par fichier et en tout, sans secret. Un fichier « secret ? » (`looksSecret`)
 * n'envoie que son chemin ; dans les autres, toute ligne que la détection de secrets reconnaît
 * (`findSecret`, celle du journal) est remplacée par `[redacted]`. Un fichier non suivi est lu ici,
 * dans le dossier, jamais au-delà.
 */
import { open } from 'node:fs/promises'
import { DRAFT_LIMITS, type CommitDraftFile } from '@shared/commit-draft'
import { looksSecret, type CommitFile } from '@shared/worktree-cycle'
import type { Run } from '../simulator/run'
import { findSecret } from '../secret-scan'
import { insideWorkspace } from './git'

const REDACTED = '[redacted]'

/** Lignes où un secret est reconnu, remplacées (le reste tel quel). */
export function redactLines(text: string): string {
  return text
    .split('\n')
    .map((line) => (findSecret(line) ? REDACTED : line))
    .join('\n')
}

/** Lignes ajoutées et retirées d'un diff unifié (en-têtes exclus). */
function counts(diff: string): { added: number; removed: number } {
  let added = 0
  let removed = 0
  for (const line of diff.split('\n')) {
    if (line.startsWith('+++') || line.startsWith('---')) continue
    if (line.startsWith('+')) added++
    else if (line.startsWith('-')) removed++
  }
  return { added, removed }
}

/** Début d'un fichier du dossier (assez pour la borne), ou `null` s'il est illisible. */
async function head(path: string, bytes: number): Promise<Buffer | null> {
  const handle = await open(path, 'r').catch(() => null)
  if (!handle) return null
  try {
    const buffer = Buffer.alloc(bytes)
    const { bytesRead } = await handle.read(buffer, 0, bytes, 0)
    return buffer.subarray(0, bytesRead)
  } finally {
    await handle.close()
  }
}

/** Fichier nouveau, non suivi : son contenu, en diff « tout ajouté ». */
async function newFileDiff(cwd: string, file: CommitFile): Promise<string | 'binary' | null> {
  const content = await head(insideWorkspace(cwd, file.path), DRAFT_LIMITS.fileDiffChars * 4)
  if (!content) return null
  if (content.subarray(0, 8000).includes(0)) return 'binary'
  const lines = content.toString('utf8').replace(/\n$/, '').split('\n')
  return [`--- /dev/null`, `+++ b/${file.path}`, ...lines.map((l) => `+${l}`)].join('\n')
}

/**
 * Ce que chaque fichier coché envoie, dans l'ordre reçu. `cwd` : le dossier où les chemins valent
 * (celui du commit). Au-delà du total, les fichiers suivants sont cités sans leur diff.
 */
export async function draftFiles(
  run: Run,
  cwd: string,
  files: readonly CommitFile[]
): Promise<CommitDraftFile[]> {
  const out: CommitDraftFile[] = []
  let total = 0
  for (const file of files) {
    if (looksSecret(file.path)) {
      out.push({ ...file, withheld: 'secret' })
      continue
    }
    let diff: string | 'binary' | null = null
    if (file.status !== 'untracked') {
      const shown = await run(
        'git',
        [
          '--no-optional-locks',
          'diff',
          'HEAD',
          '--no-color',
          '--no-ext-diff',
          '-M',
          '--',
          file.path
        ],
        { cwd, timeoutMs: 15_000 }
      )
      if (shown.code === 0) {
        const text = shown.stdout.toString('utf8').trim()
        diff = /^Binary files /m.test(text) ? 'binary' : text || null
      }
    }
    // Non suivi, ou nouveau dans un dépôt sans commit : le contenu sur le disque.
    if (diff === null && file.status !== 'deleted') diff = await newFileDiff(cwd, file)
    if (diff === 'binary') {
      out.push({ ...file, withheld: 'binary' })
      continue
    }
    if (diff === null) {
      out.push({ ...file })
      continue
    }
    const clean = redactLines(diff)
    if (
      clean.length > DRAFT_LIMITS.fileDiffChars ||
      total + clean.length > DRAFT_LIMITS.totalDiffChars
    ) {
      // Un fichier non suivi n'est lu qu'en partie : ses comptes seraient faux.
      out.push({
        ...file,
        withheld: 'too-long',
        ...(file.status === 'untracked' ? {} : counts(clean))
      })
      continue
    }
    total += clean.length
    out.push({ ...file, diff: clean })
  }
  return out
}
